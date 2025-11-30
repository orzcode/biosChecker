import fs from "fs/promises";
import { generateUniqueId } from "./uuid.js";
import { scrapeBIOSInfo } from "./versionChecker.js";
import { getMobos, saveMobos } from "./sqlServices.js";
import { koyebToRepo } from "./koyebToGithub.js";
import { sendToDiscord } from "./reporter.js";

// Now relying on Playwright for all HTTP/DOM interactions
import { chromium } from "playwright";

// Un-comment / use this when their SSL certs are broken (rare)
//process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Delay function to pause execution for a specified time
async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

//script to fetch motherboard product info from ASRock website
//run this casually, as it just checks for newly released models, not bios versions

//due to some pages residing on PG subdomain,
//and very rare edge case of some bioses being "bios1.html" or "bios2.html",
//I had to implement the checks below.
//At the time of writing, this is only for B450M Steel Legend

// Playwright instance outside the function for efficiency in sequential checks
let browserInstance;

/**
 * Checks for a valid BIOS page URL by attempting to load it and find the BIOS table.
 * Uses Playwright for ALL checks now to ensure reliability against bot detection.
 * * @param {string} maker - 'Intel' or 'AMD'
 * @param {string} modelName - The model name, e.g., 'B860M Pro-A'
 * @returns {string | null} The valid URL or null if not found.
 */
async function checkBiosPage(maker, modelName) {
  // Initializes browser if it doesn't exist
  if (!browserInstance) {
    browserInstance = await chromium.launch({
      channel: "chromium",
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    });
  }

  const baseLink = `https://asrock.com/mb/${maker.toLowerCase()}/${modelName
    .replace(/\s/g, "%20")
    .replace(/\//g, "")}/`;

  const possiblePages = ["bios.html", "bios1.html"];
  const page = await browserInstance.newPage();

  try {
    for (const subdomain of ["www", "pg"]) {
      for (const pageName of possiblePages) {
        const testUrl =
          baseLink.replace("asrock.com", `${subdomain}.asrock.com`) + pageName;
        console.log(`Checking: ${testUrl}`);

        try {
          // Use Playwright for ALL checks now
          await page.goto(testUrl, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });

          const biosTableExists = await page
            .locator(
              "table:has(th:text-is('Version')) tbody tr:first-child td:first-child"
            )
            .isVisible({ timeout: 30000 });

          if (biosTableExists) {
            console.log(`Valid BIOS page found with Playwright: ${testUrl}`);
            return testUrl; // Return the first valid URL
          } else {
            console.log(
              `Page exists but the BIOS table is empty or missing: ${testUrl}`
            );
          }
        } catch (error) {
          // Page navigation or selector check failed (e.g., 404 or timeout)
          console.log(`Playwright failed for: ${testUrl} (${error.message})`);
        }
        await delay(3000); // Shorter delay since we are using a single browser instance
      }
    }

    console.warn(`No valid BIOS page found for ${modelName}`);
    return null; // Return null if no valid page is found
  } finally {
    await page.close(); // Close the page after checking
  }
}

export async function scrapeMotherboards(fromKoyeb) {
  //Checks for newly released motherboards
  //Skips existing models in the database
  //Maps and compares against DB and JSON to prevent overwriting
  console.log("---moboFetcher (weekly) starting...---");

  const summary = {
    summary: {
      title: "New Motherboards",
      total: 0,
      success: 0,
      errors: 0,
      additional: {},
    },
    details: [],
    errors: [],
  };

  let browser;
  try {
    browser = await chromium.launch({
      channel: "chromium",
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    });
    const page = await browser.newPage();
    const url = "https://www.asrock.com/mb/";

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    const allmodels = await page.evaluate(() => {
      // Check if the variable is defined globally after the script runs
      // This is the simplest and most robust way if the script is loaded
      if (typeof allmodels === "object" && Array.isArray(allmodels)) {
        // We must sanitize the array data here because it contains single quotes,
        // which JavaScript handles, but standard JSON.stringify/parse might struggle with
        // if you were passing it outside the evaluation context incorrectly.
        // Since it's a JS object here, we stringify it *cleanly* then parse it back,
        // ensuring a clean return value that doesn't rely on string matching.
        // However, the array elements themselves need to be clean.
        // Simplest approach: Return the variable if it exists globally
        return allmodels;
      } // Fallback: If not global, try finding the script content again (less reliable)

      const scriptContent = Array.from(document.querySelectorAll("script"))
        .map((el) => el.textContent)
        .find((script) => script.includes("allmodels="));

      if (!scriptContent) return null; // Use the regex to extract the array string

      const match = scriptContent.match(/allmodels\s*=\s*(\[[^\]]*\])/i);
      if (!match) return null; // The matched string still contains single quotes, replace them for JSON.parse

      const jsonString = match[1].trim().replace(/'/g, '"');
      try {
        return JSON.parse(jsonString);
      } catch (e) {
        console.error(
          "Failed to parse allmodels JSON in browser context (fallback):",
          e
        );
        return null;
      }
    });
    await page.close(); // Close page after successful list scraping

    if (!allmodels) {
      console.error("Failed to find or parse allmodels array in the page.");
      summary.errors.push({
        error: "Failed to find allmodels array in the page.",
      });
      throw new Error("Initialization failed: allmodels not found.");
    } // 2. Continuation of logic after model list retrieval

    const existingModels = await getMobos();

    let currentModelsJson = [];
    try {
      const fileContent = await fs.readFile(
        "./public/data/models.json",
        "utf8"
      );
      currentModelsJson = JSON.parse(fileContent);
      console.log(`Loaded ${currentModelsJson.length} models from models.json`);
    } catch (error) {
      console.warn(
        "Could not load models.json, starting with empty list:",
        error
      );
    }

    const existingModelMap = new Map();

    for (const model of currentModelsJson) {
      existingModelMap.set(model.model, model);
    }

    for (const model of existingModels) {
      if (!existingModelMap.has(model.model)) {
        existingModelMap.set(model.model, model);
      }
    }

    const relevantSockets = ["1700", "1851", "am4", "am5"];

    const newModels = allmodels.filter((model) => {
      // Check if it has a relevant socket
      if (!relevantSockets.includes(model[1].toLowerCase())) return false;

      const modelName = model[0];
      return !existingModelMap.has(modelName);
    });

    console.log(
      `Found ${newModels.length} new models out of ${allmodels.length} total models`
    );
    if (newModels.length > 0) {
      console.log("New models:");
      newModels.forEach((model, idx) => {
        console.log(`${idx + 1}. Model: ${model[0]}`);
      });
    } else {
      console.log("No new models detected.");
    }

    summary.summary.total = existingModelMap.size;
    summary.summary.success = newModels.length;

    const newOrUpdatedModels = [];

    for (const model of newModels) {
      // START: Logic moved inside TRY to ensure the entire process fails if the URL check fails
      try {
        const maker = model[2].toLowerCase().includes("intel")
          ? "Intel"
          : "AMD";
        const modelName = model[0];
        const socketType = model[1];

        // 1. Check for valid BIOS Page URL
        const biosPage = await checkBiosPage(maker, modelName);
        await delay(3000);

        // 🛑 NEW CHECK: If no valid URL is found, we must throw an error
        // to immediately jump to the CATCH block, skipping the newEntry creation.
        if (!biosPage) {
          throw new Error(`No valid BIOS page URL found for ${modelName}`);
        }

        // 2. Scrape BIOS Version using the validated URL
        // Because biosPage is guaranteed to be a non-null string here,
        // the Playwright crash is avoided.
        const versionInfo = await scrapeBIOSInfo(biosPage);

        // 🛑 NEW CHECK: If scrapeBIOSInfo returns an error object, skip the model.
        if (versionInfo && versionInfo.error) {
          throw new Error(
            `BIOS scrape failed: ${versionInfo.error.message || versionInfo.error}`
          );
        }

        // 3. IF ALL CHECKS PASS, create and push newEntry
        const newEntry = {
          id: await generateUniqueId("mobo_"),
          model: modelName,
          maker: maker,
          socket: socketType,
          link: `https://asrock.com/mb/${maker.toLowerCase()}/${modelName
            .replace(/\s/g, "%20")
            .replace(/\//g, "")}`,
          biospage: biosPage, // We know this is a valid string now
          // Use ?. for safety, but since we successfully scraped, these should exist
          heldversion: versionInfo?.version,
          helddate: versionInfo?.releaseDate,
          release: versionInfo?.releaseDate,
        };

        newOrUpdatedModels.push(newEntry);
        existingModelMap.set(modelName, newEntry);

        console.log(
          `Processed new model: ${modelName}, BIOS Page: ${biosPage}`
        );
        console.log("\n");
      } catch (err) {
        // This CATCH block now handles:
        // 1. Failure to find a BIOS Page (via the new 'if (!biosPage) throw' check)
        // 2. Failure during scrapeBIOSInfo (via the new 'if (versionInfo.error) throw' check)
        // 3. Other unexpected errors within the loop.

        console.warn(`Error while processing model ${model[0]}:`, err.message);
        summary.errors.push({ model: model[0], error: err.message });
        summary.summary.errors++;
      }

      await delay(3000);
    }

    const allEntries = Array.from(existingModelMap.values());
    if (newOrUpdatedModels.length > 0) {
      await saveMobos(newOrUpdatedModels);
      console.log(
        `Saved ${newOrUpdatedModels.length} new models to the database.`
      );

      console.log("New models added:");
      console.table(newOrUpdatedModels, [
        "model",
        "socket",
        "maker",
        "heldversion",
        "helddate",
      ]);

      try {
        await fs.writeFile(
          "./public/data/models.json",
          JSON.stringify(allEntries, null, 2)
        );
        console.log("Updated models.json with the latest motherboard data.");
      } catch (error) {
        console.error("Failed to save models.json:", error);
        summary.errors.push({
          error: `Failed to save models.json: ${error.message}`,
        });
      }

      summary.details = newOrUpdatedModels.map((model) => ({
        Maker: model.maker,
        Model: model.model,
      }));
      await sendToDiscord(summary, "moboFetcher");

      if (fromKoyeb === "fromKoyeb") {
        koyebToRepo();
        console.log("'fromKoyeb' flag detected - calling koyebToRepo()");
      }
    } else {
      console.log("No new models found. Database and JSON remain unchanged.");

      await sendToDiscord(summary, "moboFetcher");
    }

    console.log("---moboFetcher (weekly) finished---");

    return summary;
  } catch (error) {
    console.error("Error scraping motherboards:", error);
    summary.errors.push({ error: error.message });
    summary.summary.errors++;

    await sendToDiscord(summary, "moboFetcher");

    return summary;
  } finally {
    if (browser) {
      await browser.close();
    }
    if (browserInstance) {
      await browserInstance.close();
    }
  }
}

scrapeMotherboards();
//These Javascript functions ain't gonna run themselves!!
