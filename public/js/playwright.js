import { chromium } from "playwright";

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

    // Extract the latest BIOS version and date from the first table only
    const rawVersion = await page.textContent(
      "table:first-of-type tbody tr:first-child td:first-child"
    );
    const rawDate = await page.textContent(
      "table:first-of-type tbody tr:first-child td:nth-child(2)"
    );

    if (!rawVersion || !rawDate) {
      throw new Error("BIOS version or release date not found.");
    }

    const version = rawVersion.trim();
    const releaseDate = rawDate.trim();
    console.log(
      `BIOS version found: ${version}, BIOS release date found: ${releaseDate}`
    );

    return { version, releaseDate };
  } catch (err) {
    console.error(`Playwright scraping error at ${url}: ${err.message}`);
    return null;
  } finally {
    await browser.close();
  }
}

// Call the function with the BIOS page URL
//scrapeWithPlaywright('https://pg.asrock.com/mb/Intel/Z790%20Lightning%20WiFi/bios.html');
