import { chartManager } from "./chartMan.js";
//import { generateImageFromData } from "./textGraph.js";
import { today } from "./dater.js";
import fs from "fs";
import fetch from "node-fetch";
import https from "https";
import path from "path";
import FormData from "form-data";

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
      moboFetcher: "🆕",
    };
    const emoji = emojiMap[scriptName] || "";

    const repository = process.env.GITHUB_REPOSITORY;
    const runId = process.env.GITHUB_RUN_ID;
    const ghRunUrl =
      repository && runId
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
      if (!items || items.length === 0) return "";

      const keys = Object.keys(items[0]);
      const minPadding = 2;

      // Calculate dynamic width for each column
      const colWidths = {};
      keys.forEach((key) => {
        const maxItemLength = Math.max(
          key.length,
          ...items.map((item) => String(item[key] ?? "N/A").length)
        );
        colWidths[key] = maxItemLength + minPadding;
      });

      let block = isFirst
        ? `**Details (${data.details.length}):**\n\`\`\`\n`
        : `**Details (Cont.):**\n\`\`\`\n`;

      // Header
      const headerLine =
        keys.map((key) => key.padEnd(colWidths[key])).join("") + "\n";
      const separatorLine =
        keys.map((key) => "-".repeat(colWidths[key])).join("") + "\n";
      block += headerLine + separatorLine;

      // Rows
      block += items
        .map(
          (item) =>
            keys
              .map((key) => String(item[key] ?? "N/A").padEnd(colWidths[key]))
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
        console.log(
          `Discord notification not sent (${
            response ? response.status : "no response"
          })`
        );
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
        await new Promise((res) => setTimeout(res, 1000)); // 1s delay
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
        await new Promise((res) => setTimeout(res, 1000));
        await sendMessage(errorBlock);
      } else {
        await sendMessage(message + errorBlock);
      }
    }

    // Optional: send charts if script is moboFetcher
    if (scriptName === "moboFetcher") {
      await attachAllToDiscord();
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

async function downloadImage(url, destPath) {
  // Single pure function for a single URL download
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const file = fs.createWriteStream(destPath);

    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(
            new Error(`Failed to download image: ${res.statusCode} for ${url}`)
          );
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve(destPath)));
      })
      .on("error", reject);
  });
}

async function downloadAllCharts() {
  // Downloads all charts to the local filesystem

  // Preps the charts
    const chartUrlsObject = await chartManager();

    const chartUrls = Object.values(chartUrlsObject);

    await prewarmCharts(chartUrls);
  //

  const names = ["barDistrib", "pieDistrib"];

  for (let i = 0; i < chartUrls.length; i++) {
    const baseName = names[i] || `chart-${i}`;
    const destPath = path.join("public", "images", "charts", `${baseName}.png`);

    try {
      await downloadImage(chartUrls[i], destPath);
      console.log(`✅ Saved: ${destPath}`);
    } catch (err) {
      console.error(`❌ Failed to save ${chartUrls[i]}: ${err.message}`);
    }
  }
}

export async function attachAllToDiscord() {
  await downloadAllCharts();

  try {
    const webhookUrl = DISCORD_WEBHOOKS.statsCharts;
    if (!webhookUrl) {
      console.log(`Error! No webhook found for sending charts to Discord`);
      return;
    }

    const summaryContent = `**📊 Statistics as of ${await today("hyphen")} 📊**`;

    const chartPaths = [
      path.resolve('public/images/charts/barDistrib.png'),
      path.resolve('public/images/charts/pieDistrib.png'),
    ];

    const form = new FormData();
    const embeds = [];

    chartPaths.forEach((chartPath, i) => {
      const fileName = path.basename(chartPath);
      const fileStream = fs.createReadStream(chartPath);
      form.append(`file${i + 1}`, fileStream, fileName);

      embeds.push({
        image: { url: `attachment://${fileName}` },
      });
    });

    form.append('payload_json', JSON.stringify({
      content: summaryContent,
      embeds,
    }));

    const response = await fetch(webhookUrl, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Discord responded with status ${response.status}`);
    }

    console.log(`✅ Chart images uploaded to Discord`);
  } catch (error) {
    console.error(`❌ Error sending chart images to Discord: ${error}`);
  }
}

// attachAllToDiscord().catch((err) => {
//   console.error(`Error attaching charts to Discord: ${err.message}`);
// }
// );