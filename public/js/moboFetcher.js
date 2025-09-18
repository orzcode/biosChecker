import fetch from "node-fetch";
import * as cheerio from "cheerio";
import fs from "fs/promises";
import { generateUniqueId } from "./uuid.js";
import { scrapeBIOSInfo } from "./versionChecker.js";
import { getMobos, saveMobos } from "./sqlServices.js";
import { koyebToRepo } from "./koyebToGithub.js";
import { sendToDiscord } from "./reporter.js";

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

import { scrapeWithPlaywright } from "./playwright.js";

async function checkBiosPage(maker, modelName) {
  // Determines the appropriate bios URL/subdomain
  // i.e. PG or non-PG
  const baseLink = `https://asrock.com/mb/${maker.toLowerCase()}/${modelName
    .replace(/\s/g, "%20")
    .replace(/\//g, "")}/`;

  const possiblePages = ["bios.html", "bios1.html"];

  for (const subdomain of ["www", "pg"]) {
    for (const pageName of possiblePages) {
      const testUrl =
        baseLink.replace("asrock.com", `${subdomain}.asrock.com`) + pageName;
      console.log(`Checking: ${testUrl}`);

      if (subdomain === "pg") {
        // Use Playwright for 'pg' subdomain
        const result = await scrapeWithPlaywright(testUrl);
        if (result) {
          console.log(`Valid BIOS page found with Playwright: ${testUrl}`);
          return testUrl; // Return the valid 'pg' URL
        } else {
          console.log(`Playwright failed for: ${testUrl}`);
        }
      } else {
        // Use fetch for 'www' subdomain
        try {
          const response = await fetch(testUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            }
          });

          if (response.ok) {
            const html = await response.text();
            const $ = cheerio.load(html);

            // Check for key content on the page (e.g., BIOS table rows)
            const biosTableExists =
              $("tbody tr:first-child td:first-child").length > 0;

            if (biosTableExists) {
              console.log(`Valid BIOS page found: ${testUrl}`);
              return testUrl; // Return the first valid URL with actual content
            } else {
              console.log(`Page exists but is invalid: ${testUrl}`);
            }
          }
        } catch (error) {
          console.log(
            `Error checking BIOS page for ${modelName} (${subdomain}/${pageName}):`,
            error
          );
        }
      }
      await delay(3000); // Add a 2-second delay between checks
    }
  }

  console.warn(`No valid BIOS page found for ${modelName}`);
  return null; // Return null if no valid page is found
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

  try {
    const url = "https://www.asrock.com/mb/";
    const response = await fetch(url);
    const body = await response.text();

    const $ = cheerio.load(body);
    const scriptContent = $("script")
      .map((i, el) => $(el).html())
      .get()
      .find((script) => script.includes("allmodels="));

    if (!scriptContent) {
      console.error("Failed to find allmodels array in the page.");
      summary.errors.push({
        error: "Failed to find allmodels array in the page.",
      });
      return summary;
    }

    const jsonString =
      scriptContent.split("allmodels=")[1].split("];")[0] + "]";
    const sanitizedJsonString = jsonString.trim().replace(/'/g, '"');

    let allmodels;
    try {
      allmodels = JSON.parse(sanitizedJsonString);
    } catch (error) {
      console.error("Failed to parse allmodels JSON:", error);
      summary.errors.push({
        error: `Failed to parse allmodels JSON: ${error.message}`,
      });
      return summary;
    }

    // First, get existing models from the database
    const existingModels = await getMobos();

    // Then, load the current models.json to prevent overwriting existing data
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

    // Create a combined map of existing models with models.json as the primary source
    // This ensures we don't overwrite any existing BIOS page values
    const existingModelMap = new Map();

    // First add all models from models.json
    for (const model of currentModelsJson) {
      existingModelMap.set(model.model, model);
    }

    // Then add any models from the database that aren't in models.json
    for (const model of existingModels) {
      if (!existingModelMap.has(model.model)) {
        existingModelMap.set(model.model, model);
      }
    }

    const relevantSockets = ["1700", "1851", "am4", "am5"];

    // Filter to only get new models with relevant sockets
    const newModels = allmodels.filter((model) => {
      // Check if it has a relevant socket
      if (!relevantSockets.includes(model[1].toLowerCase())) return false;

      // Check if it already exists in our combined map
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
        const socketType = model[1];

        const biosPage = await checkBiosPage(maker, modelName);
        await delay(3000);
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
    }

    // Create the final allEntries array from the map values
    const allEntries = Array.from(existingModelMap.values());
    // Basically - maps out models.json & DB data with NEW models
    // and removes any duplicates, to prevent over-writing existing data
    // Useful where it bugs out and overwrites with 'biospage: not found'

    // Save only if there are new models
    if (newOrUpdatedModels.length > 0) {
      await saveMobos(newOrUpdatedModels); // Save to database
      console.log(
        `Saved ${newOrUpdatedModels.length} new models to the database.`
      );

      // Display table of added models
      console.log("New models added:");
      console.table(newOrUpdatedModels, [
        "model",
        "socket",
        "maker",
        "heldversion",
        "helddate",
      ]);

      // Save to models.json
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

      // Send report to Discord
      summary.details = newOrUpdatedModels.map((model) => ({
        Maker: model.maker,
        Model: model.model,
        // 'BIOS Page': model.biospage ? `[Link](<${model.biospage}>)` : "Not found"
        // temporarily disabled due to codeblock breaking it
      }));
      await sendToDiscord(summary, "moboFetcher");

      //ONLY USED IN KOYEB TASK!
      if (fromKoyeb === "fromKoyeb") {
        koyebToRepo(); // Push changes to GitHub
        console.log("'fromKoyeb' flag detected - calling koyebToRepo()");
      }
      //ONLY USED IN KOYEB TASK!
    } else {
      console.log("No new models found. Database and JSON remain unchanged.");

      // Send empty report to Discord (optional)
      await sendToDiscord(summary, "moboFetcher");
    }

    console.log("---moboFetcher (weekly) finished---");

    return summary;
  } catch (error) {
    console.error("Error scraping motherboards:", error);
    summary.errors.push({ error: error.message });
    summary.summary.errors++;

    // Send error report to Discord
    await sendToDiscord(summary, "moboFetcher");

    return summary;
  }
}

scrapeMotherboards();
//These Javascript functions ain't gonna run themselves!!
