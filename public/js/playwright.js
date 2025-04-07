import { chromium } from "playwright";
import { extractVersionInfo } from "./versionChecker.js";

export async function scrapeWithPlaywright(url) {
  console.log("Playwright initiated...");
  const browser = await chromium.launch({
    channel: "chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage();

  console.log(`Playwrighting to ${url}...`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
  
    // Create a Playwright-specific extractor function
    const playwrightExtractor = async (selector) => await page.textContent(selector);
    
    return await extractVersionInfo(playwrightExtractor);
  } catch (err) {
    console.error(`Playwright scraping error at ${url} : ${err.message}`);
    return null;
  } finally {
    await browser.close();
  }
}

// Call the function with the BIOS page URL
//scrapeWithPlaywright('https://pg.asrock.com/mb/Intel/Z790%20Lightning%20WiFi/bios.html');
