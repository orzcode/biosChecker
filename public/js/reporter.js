const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

/**
 * Send a summary to Discord with error protection to prevent affecting parent scripts
 * @param {Object} data - The data to send
 * @param {string} scriptName - Name of the script for the header (e.g., "BIOS Update", "Notification Check", "New Motherboards")
 */
export async function sendToDiscord(data) {
    // Completely wrap everything in try/catch to never interrupt parent script
    try {
        if (!data) {
            console.log("No data provided to Discord logger");
            return;
        }

        // Create the message based on the standardized data structure
        let message = `**${data.summary.title} Results**\n\n`;

        // Add summary
        message += `**Summary:**\n\`\`\`\n`;
        message += `Total Items: ${data.summary.total}\n`;
        message += `Success: ${data.summary.success}\n`;
        message += `Errors: ${data.summary.errors}\n`;
        if (data.summary.additional) {
          for (const [key, value] of Object.entries(data.summary.additional)) {
            message += `${key}: ${value}\n`;
          }
        }
        message += `\`\`\`\n\n`;

        // Add details
        if (data.details && data.details.length > 0) {
            message += `**Details (${data.details.length}):**\n\`\`\`\n`;
            if (data.details[0]) {
                const keys = Object.keys(data.details[0]);
                message += keys.map(key => key.padEnd(20)).join('') + '\n';
                message += '-'.repeat(keys.length * 20) + '\n';
                data.details.forEach(item => {
                    message += keys.map(key => String(item[key] || 'N/A').padEnd(20)).join('') + '\n';
                });
            }
            message += `\`\`\`\n\n`;
        } else {
            message += "**No details available.**\n\n";
        }

        // Add errors
        if (data.errors && data.errors.length > 0) {
            message += `**Errors (${data.errors.length}):**\n\`\`\`\n`;
            data.errors.forEach(error => {
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
            ghRunUrl = `[Click to view GH run log](https://github.com/${repository}/actions/runs/${runId})`;
        }

        // Append GitHub Actions Run URL to the message
        if (ghRunUrl) {
            message += `\n\n${ghRunUrl}`;
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
        const fetchPromise = fetch(DISCORD_WEBHOOK_URL, {
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

        console.log("Summary sent to Discord");
    } catch (error) {
        // Silently log any errors without throwing
        console.log(`Discord logger encountered an error: ${error.message}`);
    }
}