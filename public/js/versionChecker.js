import fetch from "node-fetch";
import * as cheerio from "cheerio";

import fs from "fs/promises";
import { getMobos, saveMobos } from "./sqlServices.js";

// Helper function to add a delay
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapeBIOSVersion(url) {
  //currently, this still attempts to check PG pages
  //it will fail, but it's probably better to leave it in?
  //
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

export async function updateModels() {
  const mobos = await getMobos();
  const updatedMobos = [];

  for (const mobo of mobos) {
    const { model, biospage, heldversion } = mobo;

    console.log(`Checking BIOS for: ${model}...`);

    // Scrape the latest BIOS version
    const scrapedVersion = await scrapeBIOSVersion(biospage);

    if (!scrapedVersion) {
      console.error(`Failed to fetch version for ${model}. Skipping.`);
      continue;
    }

    const { fullVersion, numericVersion } = scrapedVersion;

    console.log(
      `Found version: ${fullVersion} (held: ${heldversion || "none"})`
    );

    // Extract numeric part of heldversion for comparison
    const heldNumeric = heldversion?.match(/[\d.]+/)?.[0];

    if (!heldNumeric || parseFloat(numericVersion) > parseFloat(heldNumeric)) {
      mobo.heldversion = fullVersion; // Save the full version string
      console.log(
        `Updating ${model} from ${heldversion || "none"} to ${fullVersion}`
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

    console.log("BIOS version checks complete - proceeding to notifycheck");
  } catch (error) {
    console.error("Failed to save updated mobos:", error);
  }
}

//updateModels();
