import { chromium } from 'playwright';

async function scrapeLatestBIOSVersion(url) {
  // Launch a headless browser
  const browser = await chromium.launch();

  // Open a new browser page
  const page = await browser.newPage();

  try {
    // Navigate to the target URL
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Select the first <td> element containing the BIOS version (adjust selector if needed)
    const latestBIOSVersion = await page.textContent('td:has-text("Version") + td'); // Example selector

    console.log('Latest BIOS Version:', latestBIOSVersion.trim());
    return latestBIOSVersion.trim();
  } catch (err) {
    console.error(`Error scraping the page: ${err.message}`);
    return null;
  } finally {
    // Close the browser
    await browser.close();
  }
}

// Call the function with the BIOS page URL
scrapeLatestBIOSVersion('https://pg.asrock.com/mb/Intel/Z790%20Lightning%20WiFi/bios.html');
