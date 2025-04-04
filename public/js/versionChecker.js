import fetch from "node-fetch";
import * as cheerio from "cheerio";

import fs from "fs/promises";
import { getMobos, saveMobos } from "./sqlServices.js";
import { scrapeWithPlaywright } from "./playwright.js";
import { sendToDiscord } from './reporter.js';
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

// User-Agent list and random selection function
const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.2210.144 Safari/537.36",
    // Add more User-Agent strings here...
];

function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

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
                    "User-Agent": getRandomUserAgent(), // Add random User-Agent
                    //"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
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
            console.error(`Fetch scraping error at ${url} : ${err.message}`);
            return null;
        }
    }
}

// Re-usable function to handle the update logic
// Created due to retry shortlist usage
async function processUpdate(mobo, version, releaseDate, updatedMobos, summary) {
  if (await isNewerDate(mobo.helddate, releaseDate)) {
      mobo.heldversion = version;
      mobo.helddate = releaseDate;
      console.log(`Updating ${mobo.model} from ${mobo.heldversion || "none"} (${mobo.helddate || "none"}) to ${version} (${releaseDate})`);
      updatedMobos.push(mobo);
      summary.summary.success++;
      summary.details.push({
          model: mobo.model,
          oldVersion: mobo.heldversion || "none",
          newVersion: version,
          oldDate: mobo.helddate || "none",
          newDate: releaseDate,
      });
  } else {
      console.log(`No update needed for ${mobo.model}.`);
  }
}

export async function updateModels(fromKoyeb) {
    const mobos = await getMobos();
    const updatedMobos = [];

    const summary = {
        summary: {
            title: "BIOS Update",
            total: mobos.length,
            success: 0,
            errors: 0,
            additional: {},
        },
        details: [],
        errors: [],
    };

    const retryList = []; // List to store URLs that failed
    const errorModels = new Set(); // Set to track models with errors

    for (const mobo of mobos) {
      const { model, biospage, heldversion, helddate } = mobo;

      console.log(`Checking BIOS for: ${model}...`);

      let scrapedInfo;
      let scrapeError = null; // Add a variable to store the specific error

      try {
        scrapedInfo = await scrapeBIOSInfo(biospage);
    } catch (error) {
        console.error(`Error scraping ${model}: ${error.message}`);
        scrapeError = error; // Store the specific error
        if (!errorModels.has(model)) {
            summary.errors.push({ model, error: error.message });
            summary.summary.errors++;
            errorModels.add(model);
        }
        retryList.push(mobo);
        continue;
    }

    if (!scrapedInfo) {
      console.error(`Failed to fetch info for ${model}. Skipping.`);
      if (!errorModels.has(model)) {
          summary.errors.push({ model, error: scrapeError ? scrapeError.message : "Failed to fetch info" }); // Use the stored error message
          summary.summary.errors++;
          errorModels.add(model);
      }
      retryList.push(mobo); // Add the whole mobo object to retry list
      continue;
  }

      const { version, releaseDate } = scrapedInfo;

      console.log(`Found version: ${version} (date: ${releaseDate}) | Current: ${heldversion || "none"} (date: ${helddate || "none"})`);

      await processUpdate(mobo, version, releaseDate, updatedMobos, summary);
      console.log("\n\n");
      await delay(2000);
  }


    // Retry failed URLs
    if (retryList.length > 0) {
      console.log("\n\n Retrying shortlist of failed URLs...");
      for (const mobo of retryList) {
          console.log(`Retrying shortlist for ${mobo.model}...`);
          let retryScrapeError = null; // Add a variable to store retry errors
          try {
              const scrapedInfo = await scrapeBIOSInfo(mobo.biospage);
              if (scrapedInfo) {
                  const { version, releaseDate } = scrapedInfo;
                  await processUpdate(mobo, version, releaseDate, updatedMobos, summary);
                  errorModels.delete(mobo.model); // Remove from error list if retry succeeds
              }
          } catch (retryError) {
              console.error(`Shortlist retry failed for ${mobo.model}: ${retryError.message}`);
              retryScrapeError = retryError; // Store the retry error
              if (!errorModels.has(mobo.model)) {
                  summary.errors.push({ model: mobo.model, error: retryScrapeError.message });
                  summary.summary.errors++;
                  errorModels.add(mobo.model);
              }
          }
          await delay(2000); // delay before retry
      }
  }

    try {
        await saveMobos(updatedMobos);
        console.log("models db updated.");

        const updatedMoboMap = new Map(updatedMobos.map((mobo) => [mobo.id, mobo]));
        const combinedMobos = mobos.map((mobo) => updatedMoboMap.get(mobo.id) || mobo);

        try {
            await fs.writeFile("./public/data/models.json", JSON.stringify(combinedMobos, null, 2));
            console.log("models.json updated.");
        } catch (error) {
            console.error("Failed to save models.json:", error);
            summary.errors.push({ model: "Database", error: error.message });
            summary.summary.errors++;
        }
    } catch (error) {
        console.error("Failed to save updated mobos:", error);
        summary.errors.push({ model: "Database", error: error.message });
        summary.summary.errors++;
    }

    console.log("\n==== BIOS Update Summary ====");
    console.table({
        "Total Items": summary.summary.total,
        "Updates Found": summary.summary.success,
        "Errors Encountered": summary.summary.errors,
    });

    if (summary.summary.success > 0) {
        console.log("\n==== Updated Items ====");
        console.table(summary.details);
    } else {
        console.log("\nNo updates found for any models.");
    }

    if (summary.summary.errors > 0) {
        console.log("\n==== Error Details ====");
        console.table(summary.errors);
    }

    if (fromKoyeb === "fromKoyeb") {
        console.log("'fromKoyeb' flag detected - calling koyebToRepo()");
        koyebToRepo();
    }

    console.log("BIOS version checks complete - proceeding to notifycheck");

    try {
        Promise.resolve().then(() => sendToDiscord(summary, "versionChecker"));
    } catch (e) {
        // Silent error handling
    }

    return summary;
}