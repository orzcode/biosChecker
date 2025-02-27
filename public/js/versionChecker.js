import fetch from "node-fetch";
import * as cheerio from "cheerio";

import fs from "fs/promises";
import { getMobos, saveMobos } from "./sqlServices.js";
import { scrapeWithPlaywright } from "./playwright.js";
import { koyebToRepo } from "./koyebToGithub.js";

// Helper function to add a delay
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Converts date strings like "2025/2/20" to Date objects for comparison
export async function parseDate(dateStr) {
  // Split the date string and convert to a Date object
  const [year, month, day] = dateStr.split("/").map(Number);
  return new Date(year, month - 1, day); // Month is 0-indexed in JavaScript Date
}

// Checks if foundDate is newer than heldDate
export async function isNewerDate(heldDate, foundDate) {
  if (!heldDate) return true; // If no held date, consider found as newer

  const heldDateTime = (await parseDate(heldDate)).getTime();
  const foundDateTime = (await parseDate(foundDate)).getTime();

  return foundDateTime > heldDateTime;
}

export async function extractVersionInfo(extractor) {
  // Get the first row from the first table
  const firstRowSelector = "table:first-of-type tbody tr:first-child";
  const versionSelector = `${firstRowSelector} td:first-child`;
  const dateSelector = `${firstRowSelector} td:nth-child(2)`;

  // Extract data using the provided extractor function
  const rawVersion = await extractor(versionSelector);
  const rawDate = await extractor(dateSelector);

  if (!rawVersion || !rawDate) {
    throw new Error("Version or date information not found.");
  }

  const version = rawVersion.trim();
  const releaseDate = rawDate.trim();
  
  console.log(`Version found: ${version}, Release date found: ${releaseDate}`);
  return { version, releaseDate };
}
//

async function scrapeBIOSInfo(url) {
  // Determine the subdomain (www or pg)
  const isPGSubdomain = url.includes("pg.");

  if (isPGSubdomain) {
    // Use Playwright for pg subdomains
    console.log(`Using Playwright to scrape: ${url}`);
    return await scrapeWithPlaywright(url);
  } else {
    // Use Fetch and Cheerio for www subdomains
    console.log(`Using Fetch to scrape: ${url}`);
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
      });
    
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
    
      const html = await response.text();
      const $ = cheerio.load(html);
    
      // Create a Cheerio-specific extractor function
      const cheerioExtractor = (selector) => $(selector).text();
      
      return await extractVersionInfo(cheerioExtractor);
    } catch (err) {
      console.error(`Fetch scraping error at ${url}: ${err.message}`);
      return null;
    }
  }
}

export async function updateModels(fromKoyeb) {
  const mobos = await getMobos();
  const updatedMobos = [];

  for (const mobo of mobos) {
    const { model, biospage, heldversion, helddate } = mobo;

    console.log(`Checking BIOS for: ${model}...`);

    // Scrape the latest BIOS information
    const scrapedInfo = await scrapeBIOSInfo(biospage);

    if (!scrapedInfo) {
      console.error(`Failed to fetch info for ${model}. Skipping.`);
      continue;
    }

    const { version, releaseDate } = scrapedInfo;

    console.log(
      `Found version: ${version} (date: ${releaseDate}) | Current: ${
        heldversion || "none"
      } (date: ${helddate || "none"})`
    );

    // Compare dates to determine if an update is needed
    if (await isNewerDate(helddate, releaseDate)) {
      mobo.heldversion = version;
      mobo.helddate = releaseDate;
      console.log(
        `Updating ${model} from ${heldversion || "none"} (${
          helddate || "none"
        }) to ${version} (${releaseDate})`
      );
      updatedMobos.push(mobo); // Add to updated mobos list
    } else {
      console.log(`No update needed for ${model}.`);
    }
    console.log("\n\n");

    // Add a 1-second delay before proceeding to the next motherboard
    await delay(1000); // Delay for 1000 milliseconds (1 second)
  }

  // Save updated models db
  try {
    await saveMobos(updatedMobos);
    console.log("models db updated.");

    // Combine all mobos into one list (updated and unchanged)
    const combinedMobos = mobos.map((mobo) => {
      // If the mobo was updated, replace it with the updated version
      const updatedMobo = updatedMobos.find((uMobo) => uMobo.id === mobo.id);
      return updatedMobo || mobo; // Use updated version or the original
    });

    // Save the full list to models.json
    try {
      await fs.writeFile(
        "./public/data/models.json",
        JSON.stringify(combinedMobos, null, 2)
      );
      console.log("models.json updated.");
    } catch (error) {
      console.error("Failed to save models.json:", error);
    }

    //ONLY USED IN KOYEB TASK!
    if (fromKoyeb === "fromKoyeb") {
      console.log("'fromKoyeb' flag detected - calling koyebToRepo()");
      koyebToRepo(); // Push changes to GitHub
    }
    //ONLY USED IN KOYEB TASK!

    console.log("BIOS version checks complete - proceeding to notifycheck");
  } catch (error) {
    console.error("Failed to save updated mobos:", error);
  }
}

//updateModels();
