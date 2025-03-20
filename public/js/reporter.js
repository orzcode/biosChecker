const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

/**
 * Send a summary to Discord with error protection to prevent affecting parent scripts
 * @param {Object} data - The data to send
 * @param {string} scriptName - Name of the script for the header (e.g., "BIOS Update", "Notification Check", "New Motherboards")
 */
export async function sendToDiscord(data, scriptName = "Script") {
  // Completely wrap everything in try/catch to never interrupt parent script
  try {
    if (!data) {
      console.log('No data provided to Discord logger');
      return;
    }

    // Create the message based on what data is available
    let message = `**${scriptName} Results**\n\n`;
    
    // Handle BIOS Update script (updateModels)
    if ('totalChecked' in data && 'updatesFound' in data) {
      message += `**Summary:**\n\`\`\`\n`;
      message += `Total Items: ${data.totalChecked}\n`;
      message += `Updates Found: ${data.updatesFound}\n`;
      message += `Errors Encountered: ${data.errorCount || 0}\n\`\`\`\n\n`;
      
      // Add updated items if any
      if (data.updatedItems && data.updatedItems.length > 0) {
        message += `**Updated Items (${data.updatedItems.length}):**\n\`\`\`\n`;
        data.updatedItems.forEach(item => {
          message += `${item.model}: ${item.oldVersion || 'none'} (${item.oldDate || 'none'}) → ${item.newVersion || 'none'} (${item.newDate || 'none'})\n`;
        });
        message += `\`\`\`\n\n`;
      } else {
        message += "**No updates found for any models.**\n\n";
      }
      
      // Add errors if any
      if (data.errorItems && data.errorItems.length > 0) {
        message += `**Errors (${data.errorItems.length}):**\n\`\`\`\n`;
        data.errorItems.forEach(item => {
          message += `${item.model}: ${item.error}\n`;
        });
        message += `\`\`\`\n`;
      }
    }
    
    // Handle Notification script (notifyUsers)
    else if (data.stats || ('totalUsers' in data)) {
      const stats = data.stats || data;
      
      message += `**Summary:**\n\`\`\`\n`;
      message += `Total Users: ${stats.totalUsers}\n`;
      message += `Users Notified: ${stats.usersNotified}\n`;
      message += `Users Deleted: ${stats.usersDeleted}\n`;
      message += `Errors: ${stats.errors || 0}\n\`\`\`\n\n`;
      
      // Add notified users if any
      if (data.notifiedUsers && data.notifiedUsers.length > 0) {
        message += `**Notified Users (${data.notifiedUsers.length}):**\n\`\`\`\n`;
        data.notifiedUsers.forEach(user => {
          message += `ID: ${user.id}, Model: ${user.mobo}, New Version: ${user.newVersion} (${user.newDate})\n`;
        });
        message += `\`\`\`\n\n`;
      }
      
      // Add deleted users if any
      if (data.deletedUsers && data.deletedUsers.length > 0) {
        message += `**Deleted Users (${data.deletedUsers.length}):**\n\`\`\`\n`;
        data.deletedUsers.forEach(user => {
          message += `ID: ${user.id}, Model: ${user.mobo}, Last Contacted: ${user.lastContacted}\n`;
        });
        message += `\`\`\`\n\n`;
      }
      
      // Add errors if any
      if (data.errors && data.errors.length > 0) {
        message += `**Errors (${data.errors.length}):**\n\`\`\`\n`;
        data.errors.forEach(error => {
          message += `ID: ${error.id}, Model: ${error.mobo || 'N/A'}, Error: ${error.error}\n`;
        });
        message += `\`\`\`\n`;
      }
    }
    
    // Handle New Motherboards script (scrapeMotherboards)
    else if (Array.isArray(data)) {
      const newModels = data;
      message += `**New Motherboards Found (${newModels.length}):**\n\`\`\`\n`;
      
      // Create a simple table format
      message += "Model".padEnd(35) + "Socket".padEnd(10) + "Maker".padEnd(10) + "BIOS Version".padEnd(15) + "BIOS Date\n";
      message += "-".repeat(75) + "\n";
      
      for (const model of newModels) {
        message += 
          model.model.padEnd(35) + 
          (model.socket || 'N/A').padEnd(10) + 
          (model.maker || 'N/A').padEnd(10) + 
          (model.heldversion || 'N/A').padEnd(15) + 
          (model.helddate || 'N/A') + "\n";
      }
      
      message += `\`\`\`\n`;
    }
    
    // Generic fallback for any other data format
    else {
      message += "**Summary Data:**\n```\n";
      message += JSON.stringify(data, null, 2).substring(0, 1500);
      if (JSON.stringify(data, null, 2).length > 1500) {
        message += "\n... (truncated)";
      }
      message += "\n```";
    }
    
    // If the message is too long for Discord, truncate it
    if (message.length > 1900) {
      message = message.substring(0, 1900) + '... (truncated)';
    }
    
    // Use a timeout to ensure this doesn't block the main thread
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Discord webhook timeout')), 5000)
    );
    
    // Create the fetch promise
    const fetchPromise = fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: message }),
    });
    
    // Race between the fetch and the timeout
    const response = await Promise.race([fetchPromise, timeoutPromise])
      .catch(error => {
        console.log(`Discord notification attempt failed: ${error.message}`);
        return null;
      });
    
    if (!response || !response.ok) {
      console.log(`Discord notification not sent (${response ? response.status : 'no response'})`);
      return;
    }
    
    console.log('Summary sent to Discord');
  } catch (error) {
    // Silently log any errors without throwing
    console.log(`Discord logger encountered an error: ${error.message}`);
  }
}