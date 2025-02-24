import fetch from "node-fetch";
import * as cheerio from "cheerio";
import fs from "fs/promises";
import sql from "./db.js";
import { generateUniqueId } from "./uuid.js";
import { getMobos, saveMobos } from "./sqlServices.js";
import { koyebToRepo } from "./koyebToGithub.js";

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

import { scrapeWithPlaywright } from "./playwright.js";

async function checkBiosPage(maker, modelName) {
  const baseLink = `https://asrock.com/mb/${maker.toLowerCase()}/${modelName
    .replace(/\s/g, "%20")
    .replace(/\//g, "")}/`;

  const possiblePages = ["bios.html", "bios1.html"];

  for (const subdomain of ["www", "pg"]) {
    for (const pageName of possiblePages) {
      const testUrl = baseLink.replace("asrock.com", `${subdomain}.asrock.com`) + pageName;
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
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
          });

          if (response.ok) {
            const html = await response.text();
            const $ = cheerio.load(html);

            // Check for key content on the page (e.g., BIOS table rows)
            const biosTableExists = $("tbody tr:first-child td:first-child").length > 0;

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
      await delay(2000); // Add a 2-second delay between checks
    }
  }

  console.warn(`No valid BIOS page found for ${modelName}`);
  return null; // Return null if no valid page is found
}




export async function scrapeMotherboards(fromKoyeb) {
  console.log("---moboFetcher (weekly) starting...---");
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
        id: existingEntry ? existingEntry.id : await generateUniqueId("mobo_"),
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
      console.log("\n");

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

      //ONLY USED IN KOYEB TASK!
      if(fromKoyeb === "fromKoyeb"){
      koyebToRepo(); // Push changes to GitHub
      console.log("'fromKoyeb' flag detected - calling koyebToRepo()");
      }
      //ONLY USED IN KOYEB TASK!

    } else {
      console.log("No new or updated models found. Database and JSON remain unchanged.");
    }
  } catch (error) {
    console.error("Error scraping motherboards:", error);
  }
  console.log("---moboFetcher (weekly) finished---");
  await sql.end();
}

//checkBiosPage("amd", "B450M Steel Legend");
//checkBiosPage("amd", "X870E Nova WiFi");

scrapeMotherboards();
//note: dont be surprised if koyeb is missing packages, since 
//you're calling the func directly from the router