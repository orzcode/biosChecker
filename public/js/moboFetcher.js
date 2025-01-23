import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { generateUniqueId } from "./uuid.js";
import fs from "fs";

const modelsFilePath = "../data/models.json";

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

    const filteredModels = allmodels
      .filter((model) => relevantSockets.includes(model[1].toLowerCase()))
      .map((model) => {
        const maker = model[2].toLowerCase().includes("intel") ? "Intel" : "AMD";
        const modelName = model[0];
        const socketType = model[1];

        // Check if the model already exists and reuse its ID
        const existingEntry = existingModels.find((m) => m.model === modelName);
        const uniqueId = existingEntry ? existingEntry.id : generateUniqueId("mobo_");

        return {
          id: uniqueId,
          model: modelName,
          maker: maker,
          socket: socketType,
          link: `https://asrock.com/mb/${maker.toLowerCase()}/${modelName.replace(/\s/g, "%20").replace(/\//g, "")}`,
          biospage: `https://www.asrock.com/mb/${maker.toLowerCase()}/${modelName.replace(/\s/g, "%20").replace(/\//g, "")}/bios.html`,
        };
      });

    fs.writeFileSync(modelsFilePath, JSON.stringify(filteredModels, null, 2));
    console.log("Checked existing data, and removed old or updated new. Saved to models.json");

    return filteredModels;
  } catch (error) {
    console.error("Error scraping motherboards:", error);
  }
}

scrapeMotherboards();
