import fetch from "node-fetch";
import * as cheerio from "cheerio";

import { generateUniqueId } from "./uuid.js"

import fs from "fs";

export async function scrapeMotherboards() {
  try {
    const url = "https://www.asrock.com/mb/";
    const response = await fetch(url);
    const body = await response.text();

    // Load the HTML into Cheerio
    const $ = cheerio.load(body);

    // Find the script containing 'allmodels='
    const scriptContent = $("script")
      .map((i, el) => $(el).html()) // Get all script content
      .get()
      .find((script) => script.includes("allmodels="));

    if (scriptContent) {
      // Extract only the part containing the array (after 'allmodels=')
      const jsonString =
        scriptContent
          .split("allmodels=")[1] // Get everything after 'allmodels='
          .split("];")[0] + "]"; // Cut off anything after the array (include the closing bracket)

      // Now sanitize and parse it
      const sanitizedJsonString = jsonString.trim().replace(/'/g, '"'); // Convert single quotes to double quotes for JSON validity

      // Try parsing the JSON
      try {
        const allmodels = JSON.parse(sanitizedJsonString);

        // Filter the models to only include those with the specified sockets
        const relevantSockets = ["1700", "1851", "am4", "am5"];
        const filteredModels = allmodels
          .filter((model) => relevantSockets.includes(model[1].toLowerCase())) // Filter by socket
          .map((model) => {
            // Create the desired object for each model
            const maker = model[2].toLowerCase().includes("intel")
              ? "Intel"
              : "AMD";
            const modelName = model[0];
            const socketType = model[1];
            const uniqueId = generateUniqueId('mobo_');
            
            const link = `https://asrock.com/mb/${maker.toLowerCase()}/${modelName
              .replace(/\s/g, "%20")
              .replace(/\//g, "")}`;
            const biospage = `https://www.asrock.com/mb/${maker.toLowerCase()}/${modelName
              .replace(/\s/g, "%20")
              .replace(/\//g, "")}/bios.html`;

            return {
              id: uniqueId,
              model: modelName,
              maker: maker,
              socket: socketType,
              link: link,
              biospage: biospage,
            };
          });

        // Log and return the filtered data
        //console.log('Filtered Models:', filteredModels);
        console.table(filteredModels);

        // Save the filtered models to a JSON file
        fs.writeFileSync(
          "../models.json",
          JSON.stringify(filteredModels, null, 2)
        );
        console.log("Motherboards data saved to models.json");

        return filteredModels;
      } catch (jsonParseError) {
        console.error("Error parsing JSON:", jsonParseError);
      }
    } else {
      console.error("Failed to find allmodels array in the page.");
    }
  } catch (error) {
    console.error("Error scraping motherboards:", error);
  }
}

scrapeMotherboards();
