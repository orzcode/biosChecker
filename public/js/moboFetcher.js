import fs from "fs/promises";
import { generateUniqueId } from "./uuid.js";
import { scrapeBIOSInfo } from "./versionChecker.js";
import { getMobos, saveMobos } from "./sqlServices.js";
import { koyebToRepo } from "./koyebToGithub.js";
import { sendToDiscord } from "./reporter.js";

// Now relying on Playwright for all HTTP/DOM interactions
import { chromium } from "playwright";
// Note: scrapeWithPlaywright is imported, but we are also using raw Playwright here
// to efficiently get the list of models without opening a new browser for every check.

// Removed: import fetch from "node-fetch";
// Removed: import * as cheerio from "cheerio";

// Delay function to pause execution for a specified time
async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Un-comment / use this when their SSL certs are broken (rare)
//process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

//script to fetch motherboard product info from ASRock website
//run this casually, as it just checks for newly released models, not bios versions

//due to some pages residing on PG subdomain,
//and very rare edge case of some bioses being "bios1.html" or "bios2.html",
//I had to implement the checks below.
//At the time of writing, this is only for B450M Steel Legend

// Note: Removed redundant import of scrapeWithPlaywright as it is used directly in checkBiosPage.

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
            timeout: 15000,
          }); // Check for the BIOS table content using a robust selector

          const biosTableExists = await page
            .locator(
              "table:has(th:text-is('Version')) tbody tr:first-child td:first-child"
            )
            .isVisible({ timeout: 5000 });

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
        await delay(1000); // Shorter delay since we are using a single browser instance
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
  }; // --- Playwright browser initialization for efficiency in model list fetching ---

  let browser;
  try {
    browser = await chromium.launch({
      channel: "chromium",
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    });
    const page = await browser.newPage();
    const url = "https://www.asrock.com/mb/"; // 1. Scrape the allmodels array using Playwright

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }); // We use page.evaluate to run JavaScript directly in the browser context

    const allmodels = await page.evaluate(() => {
      // Find the script tag content containing 'allmodels='
      const scriptContent = Array.from(document.querySelectorAll("script"))
        .map((el) => el.textContent)
        .find((script) => script.includes("allmodels="));

      if (!scriptContent) return null;

      const match = scriptContent.match(/allmodels=(\[[^\]]*\])/);
      if (!match) return null; // The matched string still contains single quotes, which JSON.parse requires replacement for.

      const jsonString = match[1].trim().replace(/'/g, '"');
      try {
        return JSON.parse(jsonString);
      } catch (e) {
        console.error("Failed to parse allmodels JSON in browser context:", e);
        return null;
      }
    });
    await page.close(); // Close page after successful list scraping

    if (!allmodels) {
      console.error("Failed to find or parse allmodels array in the page.");
      summary.errors.push({
        error: "Failed to find allmodels array in the page.",
      }); // The browser is closed in the final catch block if an error occurs below
      throw new Error("Initialization failed: allmodels not found.");
    } // 2. Continuation of logic after model list retrieval
    // First, get existing models from the database

    const existingModels = await getMobos(); // Then, load the current models.json to prevent overwriting existing data

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
    } // Create a combined map of existing models with models.json as the primary source
    // This ensures we don't overwrite any existing BIOS page values

    const existingModelMap = new Map(); // First add all models from models.json

    for (const model of currentModelsJson) {
      existingModelMap.set(model.model, model);
    } // Then add any models from the database that aren't in models.json

    for (const model of existingModels) {
      if (!existingModelMap.has(model.model)) {
        existingModelMap.set(model.model, model);
      }
    }

    const relevantSockets = ["1700", "1851", "am4", "am5"]; // Filter to only get new models with relevant sockets

    const newModels = allmodels.filter((model) => {
      // Check if it has a relevant socket
      if (!relevantSockets.includes(model[1].toLowerCase())) return false; // Check if it already exists in our combined map

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

    summary.summary.total = existingModelMap.size; // Change to existingModelMap.size
    summary.summary.success = newModels.length;

    const newOrUpdatedModels = []; // Only save these models
    // Process only the new models

    for (const model of newModels) {
      try {
        const maker = model[2].toLowerCase().includes("intel")
          ? "Intel"
          : "AMD";
        const modelName = model[0];
        const socketType = model[1]; // Use the local checkBiosPage function

        const biosPage = await checkBiosPage(maker, modelName);
        await delay(3000); // Use the main scraping function (which is now Playwright-only)
        const versionInfo = await scrapeBIOSInfo(biosPage);

        const newEntry = {
          id: await generateUniqueId("mobo_"),
          model: modelName,
          maker: maker,
          socket: socketType,
          link: `https://asrock.com/mb/${maker.toLowerCase()}/${modelName
            .replace(/\s/g, "%20")
            .replace(/\//g, "")}`,
          biospage: biosPage || "Not found",
          heldversion: versionInfo?.version,
          helddate: versionInfo?.releaseDate,
          release: versionInfo?.releaseDate,
        };

        newOrUpdatedModels.push(newEntry);
        existingModelMap.set(modelName, newEntry);

        console.log(
          `Processed new model: ${modelName}, BIOS Page: ${
            biosPage || "Not found"
          }`
        );
        console.log("\n");
      } catch (err) {
        console.warn(`Error while processing model ${model[0]}:`, err.message);
        summary.errors.push({ model: model[0], error: err.message });
        summary.summary.errors++;
      }

      await delay(5000);
    } // Create the final allEntries array from the map values

    const allEntries = Array.from(existingModelMap.values()); // Basically - maps out models.json & DB data with NEW models
    // and removes any duplicates, to prevent over-writing existing data
    // Useful where it bugs out and overwrites with 'biospage: not found'
    // Save only if there are new models
    if (newOrUpdatedModels.length > 0) {
      await saveMobos(newOrUpdatedModels); // Save to database
      console.log(
        `Saved ${newOrUpdatedModels.length} new models to the database.`
      ); // Display table of added models

      console.log("New models added:");
      console.table(newOrUpdatedModels, [
        "model",
        "socket",
        "maker",
        "heldversion",
        "helddate",
      ]); // Save to models.json

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
      } // Send report to Discord

      summary.details = newOrUpdatedModels.map((model) => ({
        Maker: model.maker,
        Model: model.model, // 'BIOS Page': model.biospage ? `[Link](<${model.biospage}>)` : "Not found"
        // temporarily disabled due to codeblock breaking it
      }));
      await sendToDiscord(summary, "moboFetcher"); //ONLY USED IN KOYEB TASK!

      if (fromKoyeb === "fromKoyeb") {
        koyebToRepo(); // Push changes to GitHub
        console.log("'fromKoyeb' flag detected - calling koyebToRepo()");
      } //ONLY USED IN KOYEB TASK!
    } else {
      console.log("No new models found. Database and JSON remain unchanged."); // Send empty report to Discord (optional)

      await sendToDiscord(summary, "moboFetcher");
    }

    console.log("---moboFetcher (weekly) finished---");

    return summary;
  } catch (error) {
    console.error("Error scraping motherboards:", error);
    summary.errors.push({ error: error.message });
    summary.summary.errors++; // Send error report to Discord

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
