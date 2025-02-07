import { chromium } from "playwright";

export async function scrapeWithPlaywright(url) {
  const browser = await chromium.launch({
    channel: 'chromium', // Use the new Chromium channel
  });
  const page = await browser.newPage();

  try {
    // Navigate to the target URL
    await page.goto(url, { waitUntil: "domcontentloaded" });

    // Extract the latest BIOS version (adjust selector as needed)
    const rawVersion = await page.textContent("tbody tr:first-child td:first-child");
    if (!rawVersion) {
      throw new Error("BIOS version not found.");
    }

    const fullVersion = rawVersion.trim();
    const numericVersion = fullVersion.match(/[\d.]+/)?.[0];

    if (!numericVersion) {
      throw new Error("Unable to parse numeric version.");
    }

    return { fullVersion, numericVersion };
  } catch (err) {
    console.error(`Playwright scraping error at ${url}: ${err.message}`);
    return null;
  } finally {
    await browser.close();
  }
}


// Call the function with the BIOS page URL
//scrapeLatestBIOSVersion('https://pg.asrock.com/mb/Intel/Z790%20Lightning%20WiFi/bios.html');
