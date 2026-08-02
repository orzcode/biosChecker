const MAX_RETRIES = 3; // Define the maximum number of attempts

// Accepts a shared, already-launched browser instance so callers can scrape
// many URLs without paying browser-launch cost on every single one.
export async function scrapeWithPlaywright(browser, url) {
    let lastError = null; // Store the last error encountered
    
    const versionSelector = "table:has(th:text-is('Version')) tbody tr:first-child td:first-child";
    const dateSelector = "table:has(th:text-is('Version')) tbody tr:first-child td:nth-child(2)";
    
    const SELECTOR_TIMEOUT = 30000; 

    // --- START RETRY LOOP ---
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        let page;
        try {
            console.log(`Playwright initiated (Attempt ${attempt}/${MAX_RETRIES})...`);

            page = await browser.newPage();

            console.log(`Playwrighting to ${url}`);

            // Increase timeout as Playwright is now handling bot protection challenges
            // Set page navigation timeout to 30s for stability
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }); 

            // --- Inlined extractVersionInfo Logic ---
            
            // Wait for the version cell to exist and be visible before attempting extraction
            await page.waitForSelector(versionSelector, { state: 'visible', timeout: SELECTOR_TIMEOUT });

            // Extract data directly using Playwright's page.textContent()
            const rawVersion = await page.textContent(versionSelector);
            const rawDate = await page.textContent(dateSelector);

            if (!rawVersion || !rawDate) {
                throw new Error("Version or date information not found.");
            }

            const version = rawVersion.trim();
            const releaseDate = rawDate.trim();

            console.log(`✅ Success on Attempt ${attempt}. Version found: ${version}, Release date found: ${releaseDate}`);

            // If successful, return the result immediately
            return { version, releaseDate };
            
        } catch (err) {
            // If Playwright fails due to navigation issues, selector timeout, or extraction failure
            lastError = err;
            console.warn(`Attempt ${attempt}/${MAX_RETRIES} failed for ${url}: ${err.message}`);
            
            // If this was the last attempt, break the loop to report the final error
            if (attempt === MAX_RETRIES) {
                break;
            }
            
            // Wait for 5 seconds before the next retry
            await new Promise(resolve => setTimeout(resolve, 5000));
            
        } finally {
            // Close just the page - the browser is shared across calls and stays open
            if (page) {
                await page.close();
            }
        }
    }
    // --- END RETRY LOOP ---

    // This code only runs if the loop completed (all attempts failed)
    console.error(`❌ Final attempt failed for ${url}: ${lastError.message}`);
    // Return the last error object
    return { error: lastError };
}

// Call the function with the BIOS page URL
//scrapeWithPlaywright('https://pg.asrock.com/mb/Intel/Z790%20Lightning%20WiFi/bios.html');
