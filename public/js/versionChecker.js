import fetch from "node-fetch";
import * as cheerio from "cheerio";

import fs from "fs/promises";
import { getMobos, saveMobos } from "./sqlServices.js";
import { scrapeWithPlaywright } from "./playwright.js";
import { sendToDiscord } from "./reporter.js";
import { koyebToRepo } from "./koyebToGithub.js";

/////////////////////////////////////////////
// Helper function to add a delay
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// define the insecure agent
const insecureAgent = new https.Agent({
  rejectUnauthorized: false
});

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
    try {
      return await scrapeWithPlaywright(url);
    } catch (playwrightError) {
      // If playwright throws, catch it and return the error object
      console.error(
        `Playwright scraping error at ${url} : ${playwrightError.message}`
      );
      return { error: playwrightError }; // Return the error object
    }
  } else {
    // Use Fetch and Cheerio for www subdomains
    console.log(`Using Fetch to scrape: ${url}`);
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": getRandomUserAgent(), // Add random User-Agent
          //"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        agent: insecureAgent,
        // Use insecureAgent for failing HTTPS certs
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
      return { error: err }; // Return object containing the error
    }
  }
}

// Re-usable function to handle the update logic
// Created due to retry shortlist usage
async function processUpdate(
  //Note - these are UPDATED versions.
  mobo,
  version,
  releaseDate,
  updatedMobos,
  summary
) {
  if (await isNewerDate(mobo.helddate, releaseDate)) {
    const oldVersion = mobo.heldversion || "none";
    const oldDate = mobo.helddate || "none";
    //This was added to ensure it reports the update properly

    mobo.heldversion = version;
    mobo.helddate = releaseDate;

    console.log(
      `Updating ${mobo.model} from ${oldVersion} (${oldDate}) to ${version} (${releaseDate})`
    );

    updatedMobos.push(mobo);
    summary.summary.success++;
    summary.details.push({
      Model: mobo.model,
      "Old Version": oldVersion,
      "New Version": version,
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
  const firstAttemptErrors = new Map(); // Map to store initial errors for retry logic. Apparently I missed this.

  for (const mobo of mobos) {
    const { model, biospage, heldversion, helddate } = mobo;

    console.log(`Checking BIOS for: ${model}...`);

    let scrapedInfo;
    let scrapeError = null; // Add a variable to store the specific error

    try {
      scrapedInfo = await scrapeBIOSInfo(biospage);

      if (scrapedInfo && scrapedInfo.error) {
        scrapeError = scrapedInfo.error; // Store the specific error object
        scrapedInfo = null;
      }
    } catch (error) {
      console.error(`Error scraping ${model}: ${error.message}`);
      scrapeError = error;
      scrapedInfo = null;
    }

    if (!scrapedInfo) {
      // Initial attempt failed
      const errorMessage = scrapeError
        ? scrapeError.message
        : "Unknown scraping failure";

      console.error(
        `Initial attempt failed for ${model}: ${errorMessage}. Adding to retry list.`
      );

      // Store the specific error message for potential final reporting
      firstAttemptErrors.set(model, errorMessage);

      // Add the whole mobo object to retry list
      retryList.push(mobo);
    } else {
      // Initial attempt succeeded
      const { version, releaseDate } = scrapedInfo;

      console.log(
        `Found version: ${version} (date: ${releaseDate}) | Current: ${
          heldversion || "none"
        } (date: ${helddate || "none"})`
      );

      // processUpdate modifies mobo object if needed and adds to updatedMobos
      // It also increments summary.summary.success if an update occurs.
      await processUpdate(mobo, version, releaseDate, updatedMobos, summary);
    }

    console.log("\n\n");
    await delay(2000); // Keep original delay
  }

  // Retry failed URLs
  if (retryList.length > 0) {
    console.log("\n\n Retrying shortlist of failed URLs...");

    for (const mobo of retryList) {
      console.log(`Retrying shortlist for ${mobo.model}...`);

      let retryScrapedInfo;
      let retryScrapeError = null;

      try {
        retryScrapedInfo = await scrapeBIOSInfo(mobo.biospage);

        if (retryScrapedInfo && retryScrapedInfo.error) {
          retryScrapeError = retryScrapedInfo.error;
          retryScrapedInfo = null;
        }
      } catch (retryError) {
        console.error(
          `Shortlist retry failed for ${mobo.model}: ${retryError.message}`
        );
        retryScrapeError = retryError; // Store the specific retry error
        retryScrapedInfo = null;
      }

      if (retryScrapedInfo) {
        // Retry SUCCEEDED
        console.log(`Retry successful for ${mobo.model}.`);

        const { version, releaseDate } = retryScrapedInfo;

        await processUpdate(mobo, version, releaseDate, updatedMobos, summary);

        // If retry succeeded, remove it from the map of initial errors
        firstAttemptErrors.delete(mobo.model);
      } else {
        // Retry FAILED
        // Get the specific error message, or fallback to the initial attempt's error
        const finalErrorMessage = retryScrapeError
          ? retryScrapeError.message
          : firstAttemptErrors.get(mobo.model) || "Unknown failure on retry";

        console.error(
          `Retry also failed for ${mobo.model}: ${finalErrorMessage}. Logging final error.`
        );

        // *** Add to FINAL error summary ONLY if retry also fails ***
        summary.errors.push({ model: mobo.model, error: finalErrorMessage }); // Use the specific message
        summary.summary.errors++;
      }
      await delay(2000);
    }
  }

  try {
    // Only save to DB if there were actual changes
    if (updatedMobos.length > 0) {
      await saveMobos(updatedMobos);
      console.log("Models DB updated.");

      const updatedMoboMap = new Map(
        updatedMobos.map((mobo) => [mobo.id, mobo])
      );
      const combinedMobos = mobos.map(
        (mobo) => updatedMoboMap.get(mobo.id) || mobo
      );
      try {
        await fs.writeFile(
          "./public/data/models.json",
          JSON.stringify(combinedMobos, null, 2)
        );
        console.log("Models.json updated.");
      } catch (error) {
        console.error("Failed to save models.json:", error);
        summary.errors.push({
          model: "File System",
          error: `Failed to save models.json: ${error.message}`,
        });
        summary.summary.errors++;
      }
    } else {
      console.log("No updates found to save to database.");
    }
  } catch (error) {
    console.error("Failed to save updated mobos:", error);
    summary.errors.push({
      model: "Database",
      error: `DB save failed: ${error.message}`,
    });
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
  await sendToDiscord(summary, "versionChecker");
  await new Promise(r => setTimeout(r, 3000));
  //Added a pause so it doesn't get mixed up with the next notifier
} catch (e) {
  // Silent error handling
}

  return summary;
}
