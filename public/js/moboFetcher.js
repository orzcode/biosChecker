import fetch from "node-fetch";
import * as cheerio from "cheerio";
import fs from "fs/promises";
import sql from "./db.js";
import { generateUniqueId } from "./uuid.js";
import { getMobos, saveMobos } from "./sqlServices.js";


//script to fetch motherboard data from ASRock website
//run this casually, as it just checks for newly released models, not bioses

//AND it checks the bios page for www or pg
//this is probably not good unless PG actually works
//but for now let's leave it in

//this renders pgupdater.js useless, generally
async function checkBiosPage(maker, modelName) {
  const baseLink = `https://asrock.com/mb/${maker.toLowerCase()}/${modelName
    .replace(/\s/g, "%20")
    .replace(/\//g, "")}/bios.html`;

  for (const subdomain of ["www", "pg"]) {
    const testUrl = baseLink.replace("asrock.com", `${subdomain}.asrock.com`);
    try {
      const response = await fetch(testUrl);
      if (response.ok) {
        return testUrl; // Return the working URL
      }
    } catch (error) {
      console.log(
        `Error checking BIOS page for ${modelName} with ${subdomain}:`,
        error
      );
    }
  }
  return null; // Return null if both fail
}

// Delay function to pause execution for a specified time
async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function scrapeMotherboards() {
  console.log("---GitHub Actions moboFetcher (weekly) starting...---");
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
      return;
    }

    const jsonString =
      scriptContent.split("allmodels=")[1].split("];")[0] + "]";
    const sanitizedJsonString = jsonString.trim().replace(/'/g, '"');

    let allmodels;
    try {
      allmodels = JSON.parse(sanitizedJsonString);
    } catch (error) {
      console.error("Failed to parse allmodels JSON:", error);
      return;
    }

    const relevantSockets = ["1700", "1851", "am4", "am5"];
    const existingModels = await getMobos(); // Fetch existing models from the database
    const newOrUpdatedModels = []; // Only save these models
    const allEntries = []; // To build the full JSON content

    for (const model of allmodels) {
      if (!relevantSockets.includes(model[1].toLowerCase())) continue;

      const maker = model[2].toLowerCase().includes("intel") ? "Intel" : "AMD";
      const modelName = model[0];
      const socketType = model[1];
      const existingEntry = existingModels.find((m) => m.model === modelName);

      const biosPage = await checkBiosPage(maker, modelName);
      const newEntry = {
        id: existingEntry ? existingEntry.id : generateUniqueId("mobo_"),
        model: modelName,
        maker: maker,
        socket: socketType,
        link: `https://asrock.com/mb/${maker.toLowerCase()}/${modelName
          .replace(/\s/g, "%20")
          .replace(/\//g, "")}`,
        biospage: biosPage || "Not found",
        heldversion: existingEntry ? existingEntry.heldversion : null,
      };

      // Add to the full list for JSON
      allEntries.push(newEntry);

      // Only save the model if it's new or has changes
      if (
        !existingEntry || // New entry
        existingEntry.biospage !== newEntry.biospage || // BIOS page changed
        existingEntry.link !== newEntry.link || // Link changed
        existingEntry.maker !== newEntry.maker || // Maker changed (unlikely)
        existingEntry.socket !== newEntry.socket // Socket changed (unlikely)
      ) {
        newOrUpdatedModels.push(newEntry);
      }

      console.log(
        `Processed: ${modelName}, BIOS Page: ${biosPage || "Not found"}, ${
          existingEntry ? "Updated w/ live data" : "New entry"
        }`
      );

      // Add a 1-second delay between each motherboard check
      await delay(1000);
    }

    // Save only if there are new/updated models
    if (newOrUpdatedModels.length > 0) {
      await saveMobos(newOrUpdatedModels); // Save to database
      console.log("Saved new or updated models to the database.");

      // Save to models.json
      try {
        await fs.writeFile(
          "./public/data/models.json",
          JSON.stringify(allEntries, null, 2)
        );
        console.log("Updated models.json with the latest motherboard data.");
      } catch (error) {
        console.error("Failed to save models.json:", error);
      }
    } else {
      console.log("No new or updated models found. Database and JSON remain unchanged.");
    }
  } catch (error) {
    console.error("Error scraping motherboards:", error);
  }
  console.log("---moboFetcher (weekly) finished---");
  await sql.end();
}

scrapeMotherboards();