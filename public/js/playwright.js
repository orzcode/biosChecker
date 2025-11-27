import { chromium } from "playwright";
// Removed: import { extractVersionInfo } from "./versionChecker.js"; // Logic moved below

export async function scrapeWithPlaywright(url) {
    let browser;
    try {
        console.log("Playwright initiated...");
        browser = await chromium.launch({
            // Keeping settings optimized for headless environments
            channel: "chromium",
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
        });
        const page = await browser.newPage();

        console.log(`Playwrighting to ${url}`);

        // Increase timeout as Playwright is now handling bot protection challenges
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }); 

        // --- Start: Inlined extractVersionInfo Logic ---

        // Wait for the BIOS table to be visible (critical for dynamic content/bot challenges)
        // We use a robust selector to wait for the first row's version cell
        const versionSelector = "table:has(th:text-is('Version')) tbody tr:first-child td:first-child";
        
        // Wait for the element to exist and be visible before attempting extraction
        await page.waitForSelector(versionSelector, { state: 'visible', timeout: 30000 });

        // Selectors for version and date
        const dateSelector = `${versionSelector}/../td:nth-child(2)`; 
        // Note: Using XPath relative to the version selector for robustness, or CSS if preferred:
        // const dateSelector = "table:has(th:text-is('Version')) tbody tr:first-child td:nth-child(2)";

        // Extract data directly using Playwright's page.textContent()
        const rawVersion = await page.textContent(versionSelector);
        const rawDate = await page.textContent(dateSelector);

        if (!rawVersion || !rawDate) {
            throw new Error("Version or date information not found.");
        }

        const version = rawVersion.trim();
        const releaseDate = rawDate.trim();

        console.log(`Version found: ${version}, Release date found: ${releaseDate}`);
        
        // --- End: Inlined extractVersionInfo Logic ---

        return { version, releaseDate }; // Return the final object
        
    } catch (err) {
        // If Playwright fails due to navigation issues, selector timeout, or extraction failure
        console.error(`Playwright scraping error at ${url} : ${err.message}`);
        return { error: err }; // Return the error object for logging in updateModels
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Call the function with the BIOS page URL
//scrapeWithPlaywright('https://pg.asrock.com/mb/Intel/Z790%20Lightning%20WiFi/bios.html');
