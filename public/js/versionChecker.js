import fetch from "node-fetch";
import * as cheerio from "cheerio";

import fs from "fs/promises";
import { getMobos, saveMobos } from "./sqlServices.js";
import { scrapeWithPlaywright } from "./playwright.js";
import { koyebToRepo } from "./koyebToGithub.js";

/////////////////////////////////////////////
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
/////////////////////////////////////////////
// scrapeBiosInfo(url)
// takes a bios page url, decides whether to use Playwright or normal Fetch based on the URL (checks if it's PG subdomain or not), scrapes the text, and passes it to...

// extractVersionInfo()
// ...which then parses and cleans the relevant data (latest bios and date) and RETURNS these two:
// console.log(`Version found: ${version}, Release date found: ${releaseDate}`);
// return { version, releaseDate };

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
/////////////////////////////////////////////

export async function scrapeBIOSInfo(url) {
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
  
  // Add tracking variables
  let totalChecked = 0;
  let updatesFound = 0;
  let errorCount = 0;
  let errorItems = [];
  let updatedItems = []; // Track details of updated items

  for (const mobo of mobos) {
    const { model, biospage, heldversion, helddate } = mobo;
    totalChecked++;

    console.log(`Checking BIOS for: ${model}...`);

    // Scrape the latest BIOS information
    let scrapedInfo;
    try {
      scrapedInfo = await scrapeBIOSInfo(biospage);
    } catch (error) {
      console.error(`Error scraping ${model}: ${error.message}`);
      errorCount++;
      errorItems.push({ model, error: error.message });
      continue;
    }

    if (!scrapedInfo) {
      console.error(`Failed to fetch info for ${model}. Skipping.`);
      errorCount++;
      errorItems.push({ model, error: "Failed to fetch info" });
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
      updatesFound++;
      
      // Track details of this update
      updatedItems.push({
        model,
        oldVersion: heldversion || "none",
        newVersion: version,
        oldDate: helddate || "none",
        newDate: releaseDate
      });
    } else {
      console.log(`No update needed for ${model}.`);
    }
    console.log("\n\n");

    // Add a delay before proceeding to the next motherboard
    await delay(2000); // Delay for 2000 milliseconds (2 seconds)
  }

  // Save updated models db
  try {
    await saveMobos(updatedMobos);
    console.log("models db updated.");

    // Combine all mobos into one list (updated and unchanged)
    const updatedMoboMap = new Map(updatedMobos.map((mobo) => [mobo.id, mobo]));
    const combinedMobos = mobos.map((mobo) => updatedMoboMap.get(mobo.id) || mobo);

    // Save the full list to models.json
    try {
      await fs.writeFile(
        "./public/data/models.json",
        JSON.stringify(combinedMobos, null, 2)
      );
      console.log("models.json updated.");
    } catch (error) {
      console.error("Failed to save models.json:", error);
      errorCount++;
    }

    // Print summary
    console.log("\n==== BIOS Update Summary ====");
    console.table({
      "Total Items": totalChecked,
      "Updates Found": updatesFound,
      "Errors Encountered": errorCount
    });
    
    // Show detailed information about updated items
    if (updatesFound > 0) {
      console.log("\n==== Updated Items ====");
      console.table(updatedItems);
    } else {
      console.log("\nNo updates found for any models.");
    }
    
    // If there were errors, show detailed error information
    if (errorCount > 0) {
      console.log("\n==== Error Details ====");
      console.table(errorItems);
    }

    //ONLY USED IN KOYEB TASK!
    if (fromKoyeb === "fromKoyeb") {
      console.log("'fromKoyeb' flag detected - calling koyebToRepo()");
      koyebToRepo(); // Push changes to GitHub
    }
    //ONLY USED IN KOYEB TASK!

    console.log("BIOS version checks complete - proceeding to notifycheck");
    
    // Return summary information in case you want to use it elsewhere
    return {
      totalChecked,
      updatesFound,
      errorCount,
      errorItems,
      updatedItems,
      updatedMobos
    };
  } catch (error) {
    console.error("Failed to save updated mobos:", error);
    errorCount++;
    
    // Still print summary even if there was an error
    console.log("\n==== BIOS Update Summary ====");
    console.table({
      "Total Items": totalChecked,
      "Updates Found": updatesFound,
      "Errors Encountered": errorCount
    });
    
    // Show detailed update information even if there was a database error
    if (updatesFound > 0) {
      console.log("\n==== Updated Items ====");
      console.table(updatedItems);
    }
    
    return {
      totalChecked,
      updatesFound,
      errorCount,
      errorItems: [...errorItems, { model: "Database", error: error.message }],
      updatedItems,
      updatedMobos
    };
  }
}