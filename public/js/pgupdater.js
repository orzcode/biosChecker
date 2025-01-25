import fetch from "node-fetch";
import fs from "fs";

//
//	Script to check if page is pg or www and update as so
//

// Path to your models.json file
const modelsFilePath = "../data/models.json";

// Delay function to rate limit requests (3 seconds)
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Function to check if the URL is valid and update it accordingly
const checkAndUpdateUrls = async () => {
  // Load models.json
  let models = JSON.parse(fs.readFileSync(modelsFilePath));

  // Iterate through all the models and check the bios page
  for (let model of models) {
    const originalUrl = model.biospage;

    try {
      // Try to make a request to the original URL
      const response = await fetch(originalUrl);

      // Check if the response status is OK (2xx) and if the content doesn't indicate a 404 error
      if (response.ok) {
        const pageContent = await response.text();

        // Check for specific IIS 404 error page title
        if (
          pageContent.includes("IIS 10.0 Detailed Error - 404.0 - Not Found")
        ) {
          throw new Error("404 error page detected");
        } else {
          console.log(`URL for ${model.model} is valid: ${originalUrl}`);
        }
      } else {
        throw new Error(`HTTP status: ${response.status}`);
      }
    } catch (error) {
      // If there was an error (e.g., 404), check if it's a 'pg' or 'www' issue
      console.log(`Error fetching URL for ${model.model}: ${originalUrl}`);

      // Update the URL based on the error and retry
      if (originalUrl.startsWith("https://pg.asrock.com")) {
        model.biospage = originalUrl.replace(
          "https://pg.asrock.com",
          "https://www.asrock.com"
        );
      } else if (originalUrl.startsWith("https://www.asrock.com")) {
        model.biospage = originalUrl.replace(
          "https://www.asrock.com",
          "https://pg.asrock.com"
        );
      }

      console.log(`Updated URL for ${model.model}: ${model.biospage}`);
    }

    // Wait for 3 seconds before checking the next model (rate limiting)
    await delay(2000);
  }

  // Save the updated models back to models.json
  fs.writeFileSync(modelsFilePath, JSON.stringify(models, null, 2), "utf-8");
  console.log("Updated models.json with corrected URLs.");
};

// Run the script
checkAndUpdateUrls().catch(console.error);
