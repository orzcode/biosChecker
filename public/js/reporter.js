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
  try {
    if (!data) {
      console.log("No data provided to Discord logger");
      return;
    }

    const webhookUrl = DISCORD_WEBHOOKS[scriptName] || DISCORD_WEBHOOKS.default;
    if (!webhookUrl) {
      console.log(`No webhook URL found for script: ${scriptName}`);
      return;
    }

    const emojiMap = {
      notifyUsers: "📨",
      versionChecker: "🔍",
      moboFetcher: "🆕"
    };
    const emoji = emojiMap[scriptName] || "";

    const repository = process.env.GITHUB_REPOSITORY;
    const runId = process.env.GITHUB_RUN_ID;
    const ghRunUrl = (repository && runId)
      ? `[Click to view GH run log](<https://github.com/${repository}/actions/runs/${runId}>)\n\n`
      : "";

    const summaryBlock = () => {
      let message = `**${emoji} ${data.summary.title} Results ${emoji}**\n`;
      if (ghRunUrl) message += ghRunUrl;

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

      return message;
    };

    const buildDetailsBlock = (items, isFirst = false) => {
      const keys = items[0] ? Object.keys(items[0]) : [];
      const padding = 25;
      let block = isFirst
        ? `**Details (${data.details.length}):**\n\`\`\`\n`
        : `**Details (Cont.):**\n\`\`\`\n`;

      if (keys.length > 0) {
        const headerLine = keys.map((key) => key.padEnd(padding)).join("") + "\n";
        const separatorLine = "-".repeat(keys.length * padding) + "\n";
        block += headerLine + separatorLine;
      }

      block += items
        .map(item =>
          keys
            .map((key) => String(item[key] || "N/A").padEnd(padding))
            .join("") + "\n"
        )
        .join("");

      block += "```\n\n";
      return block;
    };

    const sendMessage = async (content) => {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Discord webhook timeout")), 5000)
      );
      const fetchPromise = fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });

      const response = await Promise.race([fetchPromise, timeoutPromise]).catch(
        (error) => {
          console.log(`Discord notification attempt failed: ${error.message}`);
          return null;
        }
      );

      if (!response || !response.ok) {
        console.log(`Discord notification not sent (${response ? response.status : "no response"})`);
      }
    };

    // Compose the main message (summary + first chunk of details if available)
    let message = summaryBlock();

    if (data.details && data.details.length > 0) {
      const chunks = [];
      for (let i = 0; i < data.details.length; i += 10) {
        chunks.push(data.details.slice(i, i + 10));
      }

      message += buildDetailsBlock(chunks[0], true);
      await sendMessage(message);

      for (let i = 1; i < chunks.length; i++) {
        await new Promise(res => setTimeout(res, 1000)); // 1s delay
        await sendMessage(buildDetailsBlock(chunks[i], false));
      }
    } else {
      message += "**No details required.**\n\n";
      await sendMessage(message);
    }

    // Add errors if any (separate message if too long)
    if (data.errors && data.errors.length > 0) {
      let errorBlock = `**Errors (${data.errors.length}):**\n\`\`\`\n`;
      data.errors.forEach((error) => {
        errorBlock += `${error.error}\n`;
      });
      errorBlock += `\`\`\`\n`;

      if (errorBlock.length + message.length > 1900) {
        await new Promise(res => setTimeout(res, 1000));
        await sendMessage(errorBlock);
      } else {
        await sendMessage(message + errorBlock);
      }
    }

    // Optional: send charts if script is moboFetcher
    if (scriptName === "moboFetcher") {
      await sendAllChartsToDiscord();
    }

    console.log(`Summary sent to Discord using ${scriptName} webhook`);
  } catch (error) {
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
