import { chartManager } from "./chartMan.js";
//import { generateImageFromData } from "./textGraph.js";
import { today } from "./dater.js";

// Define webhook URLs for different scripts
const DISCORD_WEBHOOKS = {
  default: process.env.DISCORD_WEBHOOK_URL,
  versionChecker: process.env.DISCORD_WEBHOOK_VERSIONCHECKER,
  notifyUsers: process.env.DISCORD_WEBHOOK_NOTIFYUSERS,
  moboFetcher: process.env.DISCORD_WEBHOOK_MOBOFETCHER,
  statsCharts: process.env.DISCORD_WEBHOOK_STATSCHARTS,
};

/**
 * Send a summary to Discord with error protection to prevent affecting parent scripts
 * @param {Object} data - The data to send
 * @param {string} [scriptName='default'] - Name of the script for determining which webhook to use
 */
export async function sendToDiscord(data, scriptName = "default") {
  // Completely wrap everything in try/catch to never interrupt parent script
  try {
    if (!data) {
      console.log("No data provided to Discord logger");
      return;
    }

    // Determine which webhook URL to use based on scriptName
    const webhookUrl = DISCORD_WEBHOOKS[scriptName] || DISCORD_WEBHOOKS.default;

    if (!webhookUrl) {
      console.log(`No webhook URL found for script: ${scriptName}`);
      return;
    }

    const emojiMap = {
      notifyUsers: "📨",
      versionChecker: "🔍",
    };
    const emoji = emojiMap[scriptName] || "";

    // Create the message based on the standardized data structure
    let message = `**${emoji} ${data.summary.title} Results ${emoji}**\n\n`;

    // Add summary
    message += `**Summary:**\n\`\`\`\n`;
    message += `Base Total: ${data.summary.total}\n`;
    message += `Updated: ${data.summary.success}\n`;
    message += `Errors: ${data.summary.errors}\n`;
    if (data.summary.additional) {
      for (const [key, value] of Object.entries(data.summary.additional)) {
        message += `${key}: ${value}\n`;
      }
    }
    message += `\`\`\`\n\n`;

    // Add details
    // In the 'Details' section of sendToDiscord:
    if (data.details && data.details.length > 0) {
      message += `**Details (${data.details.length}):**\n\`\`\`\n`;
      if (data.details[0]) {
        const keys = Object.keys(data.details[0]);
        const padding = 25; // Adjust padding as needed for the new columns

        message += keys.map((key) => key.padEnd(padding)).join("") + "\n";
        message += "-".repeat(keys.length * padding) + "\n";
        data.details.forEach((item) => {
          message +=
            keys
              .map((key) => String(item[key] || "N/A").padEnd(padding))
              .join("") + "\n";
        });
      }
      message += `\`\`\`\n\n`;
    } else {
      message += "**No details required.**\n\n";
    }

    // Add errors
    if (data.errors && data.errors.length > 0) {
      message += `**Errors (${data.errors.length}):**\n\`\`\`\n`;
      data.errors.forEach((error) => {
        message += `${error.error}\n`;
      });
      message += `\`\`\`\n`;
    }

    /////////////////////////////////////////////////////////////
    // Get GitHub Actions Run URL
    const repository = process.env.GITHUB_REPOSITORY;
    const runId = process.env.GITHUB_RUN_ID;
    let ghRunUrl = "";
    if (repository && runId) {
      ghRunUrl = `[Click to view GH run log](<https://github.com/${repository}/actions/runs/${runId}>)`;
    }

    // Append GitHub Actions Run URL to the message
    if (ghRunUrl) {
      message += `${ghRunUrl}\n\n`;
    }
    /////////////////////////////////////////////////////////////

    // If the message is too long for Discord, truncate it
    if (message.length > 1900) {
      message = message.substring(0, 1900) + "... (truncated)";
    }

    // Use a timeout to ensure this doesn't block the main thread
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Discord webhook timeout")), 5000)
    );

    // Create the fetch promise
    const fetchPromise = fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: message }),
    });

    // Race between the fetch and the timeout
    const response = await Promise.race([fetchPromise, timeoutPromise]).catch(
      (error) => {
        console.log(`Discord notification attempt failed: ${error.message}`);
        return null;
      }
    );

    if (!response || !response.ok) {
      console.log(
        `Discord notification not sent (${
          response ? response.status : "no response"
        })`
      );
      return;
    }

    // Call sendAllChartsToDiscord only if scriptName is "moboFetcher"
    if (scriptName === "moboFetcher") {
      await sendAllChartsToDiscord();
    }

    console.log(`Summary sent to Discord using ${scriptName} webhook`);
  } catch (error) {
    // Silently log any errors without throwing
    console.log(`Discord logger encountered an error: ${error.message}`);
  }
}

//////////////////////////////////////////////////////////////////
const prewarmCharts = async (chartUrls) => {
  await Promise.all(
    chartUrls.map((url) =>
      fetch(url, { method: "GET", cache: "no-store" })
        .then((r) => r.arrayBuffer())
        .catch(() => {})
    )
  );
  // Wait for 3 seconds so QuickChart can fully process
  await new Promise((resolve) => setTimeout(resolve, 3000));
};

// export async function sendChartToDiscord(chartUrl) {
//   //Re-usable, sends a single chosen chart to discord
//   try {
//     const webhookUrl = DISCORD_WEBHOOKS.statsCharts;

//     if (!webhookUrl) {
//       console.log(`Error! No webhook found for sending charts to Discord`);
//       return;
//     }

//     await fetch(webhookUrl, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ content: chartUrl }),
//     });

//     console.log(`QuickChart img URL sent to Discord`);
//   } catch (error) {
//     console.error(`Error sending QuickChart img URL to Discord: ${error}`);
//   }
// }

export async function sendAllChartsToDiscord(mode = "embed") {
  // Embed bundles summary and charts together
  // Direct sends summary and each chart as its own message(s) due to weird Discord resolve behavior
  const chartUrlsObject = await chartManager();

  const chartUrls = Object.values(chartUrlsObject);

  await prewarmCharts(chartUrls);

  try {
    const webhookUrl = DISCORD_WEBHOOKS.statsCharts;
    if (!webhookUrl) {
      console.log(`Error! No webhook found for sending charts to Discord`);
      return;
    }

    const summaryContent = `Statistics as of ${await today(
      "hyphen"
    )} ${chartUrls.map((url) => `[URL](<${url}>)`).join(" | ")}`;

    if (mode === "embed") {
      // Embeds bundle summary and charts together
      const embeds = chartUrls.map((chartUrl) => ({
        image: { url: chartUrl },
      }));

      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: summaryContent,
          embeds: embeds,
        }),
      });
    } else if (mode === "direct") {
      // Summary
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: summaryContent }),
      });

      // Send each chart URL as its own message
      for (const chartUrl of chartUrls) {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: `${chartUrl}` }),
        });
      }
    } else {
      console.warn(`Invalid mode "${mode}" passed to sendAllChartsToDiscord`);
      return;
    }

    console.log(`QuickChart URLs sent to Discord (${mode} mode)`);
  } catch (error) {
    console.error(`Error sending QuickChart URLs to Discord: ${error}`);
  }
}
