import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { generateUniqueId } from "./uuid.js";
import fs from "fs";

//script to fetch motherboard data from ASRock website
//AND it checks the bios page for www or pg
//this renders pgupdater.js useless, generally

const modelsFilePath = "../data/models.json";

async function checkBiosPage(maker, modelName) {
  const baseLink = `https://asrock.com/mb/${maker.toLowerCase()}/${modelName.replace(/\s/g, "%20").replace(/\//g, "")}/bios.html`;

  for (const subdomain of ["www", "pg"]) {
    const testUrl = baseLink.replace("asrock.com", `${subdomain}.asrock.com`);
    try {
      const response = await fetch(testUrl);
      if (response.ok) {
        return testUrl; // Return the working URL
      }
    } catch (error) {
      console.log(`Error checking BIOS page for ${modelName} with ${subdomain}:`, error);
    }
  }
  return null; // Return null if both fail
}

// Delay function to pause execution for a specified time
async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function scrapeMotherboards() {
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

    const jsonString = scriptContent.split("allmodels=")[1].split("];")[0] + "]";
    const sanitizedJsonString = jsonString.trim().replace(/'/g, '"');

    let existingModels = [];
    if (fs.existsSync(modelsFilePath)) {
      existingModels = JSON.parse(fs.readFileSync(modelsFilePath, "utf8"));
    }

    const allmodels = JSON.parse(sanitizedJsonString);
    const relevantSockets = ["1700", "1851", "am4", "am5"];

    const filteredModels = [];

    for (const model of allmodels) {
      if (!relevantSockets.includes(model[1].toLowerCase())) continue;

      const maker = model[2].toLowerCase().includes("intel") ? "Intel" : "AMD";
      const modelName = model[0];
      const socketType = model[1];

      // Check if the model already exists and reuse its ID
      const existingEntry = existingModels.find((m) => m.model === modelName);
      const uniqueId = existingEntry ? existingEntry.id : generateUniqueId("mobo_");

      const biosPage = await checkBiosPage(maker, modelName);

      filteredModels.push({
        id: uniqueId,
        model: modelName,
        maker: maker,
        socket: socketType,
        link: `https://asrock.com/mb/${maker.toLowerCase()}/${modelName.replace(/\s/g, "%20").replace(/\//g, "")}`,
        biospage: biosPage || "Not found",
        heldVersion: null,
      });

      //^insert func there to dynamically get latest ver

      console.log(`Processed: ${modelName}, BIOS Page: ${biosPage || "Not found"}`);

      // Add a 1-second delay between each motherboard check
      await delay(1000);
    }

    fs.writeFileSync(modelsFilePath, JSON.stringify(filteredModels, null, 2));
    console.log("Checked existing data, and removed old or updated new. Saved to models.json");

    return filteredModels;
  } catch (error) {
    console.error("Error scraping motherboards:", error);
  }
}

scrapeMotherboards();
