import fetch from "node-fetch";
import * as cheerio from "cheerio";

import notifyUsers from "./notifyChecker.js";
import { getMobos, saveMobos } from "./sqlServices.js";

// Helper function to add a delay
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapeBIOSVersion(url) {
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

    const rawVersion = $("tbody tr:first-child td:first-child").html()?.trim();
    if (!rawVersion) {
      throw new Error("Version number not found.");
    }

    const fullVersion = rawVersion.replace(/<[^>]*>/g, "").trim();
    const numericVersion = fullVersion.match(/[\d.]+/)?.[0];

    if (!numericVersion) {
      throw new Error("Unable to parse numeric version.");
    }

    return { fullVersion, numericVersion };
  } catch (err) {
    console.error(`Error scraping BIOS version from ${url}: ${err.message}`);
    return null;
  }
}

async function updateModels() {
  const mobos = await getMobos();
  const updatedMobos = [];

  for (const mobo of mobos) {
    const { model, biospage, heldVersion } = mobo;

    console.log(`Checking BIOS for: ${model}...`);

    // Scrape the latest BIOS version
    const scrapedVersion = await scrapeBIOSVersion(biospage);

    if (!scrapedVersion) {
      console.error(`Failed to fetch version for ${model}. Skipping.`);
      continue;
    }

    const { fullVersion, numericVersion } = scrapedVersion;

    console.log(
      `Found version: ${fullVersion} (held: ${heldVersion || "none"})`
    );

    // Extract numeric part of heldVersion for comparison
    const heldNumeric = heldVersion?.match(/[\d.]+/)?.[0];

    if (!heldNumeric || parseFloat(numericVersion) > parseFloat(heldNumeric)) {
      mobo.heldVersion = fullVersion; // Save the full version string
      console.log(
        `Updating ${model} from ${heldVersion || "none"} to ${fullVersion}`
      );
      updatedMobos.push(mobo); // Add to updated mobos list
    } else {
      console.log(`No update needed for ${model}.`);
    }

    // Add a 1-second delay before proceeding to the next motherboard
    await delay(1000); // Delay for 1000 milliseconds (1 second)
  }

  // Save updated models db
  try {
    await saveMobos(updatedMobos);
    console.log("models db updated.");
    
    console.log("BIOS version checks complete - proceeding to notifycheck");
    
    // Notify users of any updates
    notifyUsers();
  } catch (error) {
    console.error("Failed to save updated mobos:", error);
  }
}

updateModels();
