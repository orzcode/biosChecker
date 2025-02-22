import { mailer } from "./mailer.js";
import { getMobos, getUsers, saveUsers, deleteUser } from "./sqlServices.js";
import sql from "./db.js";

// Function to compare version strings properly
function compareVersions(v1, v2) {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

export async function notifyUsers() {
  try {
    // Load models and users data
    const mobos = await getMobos();
    const users = await getUsers();

    if (!mobos || mobos.length === 0) {
      console.warn("No motherboard data found. Exiting.");
      return;
    }

    if (!users || users.length === 0) {
      console.warn("No user data found. Exiting.");
      return;
    }

    const updatedUsers = [];

    // Iterate over users to determine if they need to be notified
    for (const user of users) {
      const {
        id,
        email,
        mobo: userMobo,
        givenversion,
        lastcontacted,
        verified,
      } = user;
      const mobo = mobos.find((m) => m.model === userMobo);

      if (!mobo) {
        console.warn(`Mobo ${userMobo} not found for user ${id}. Skipping.`);
        continue; // Skip if motherboard isn't found
      }

      //checks and removes unverified users, unless within last 2 hours
      if (verified === false) {
        const lastContactedDate = new Date(lastcontacted);
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

        if (lastContactedDate < twoHoursAgo) {
          console.log(
            `Deleting unverified user ${id} (last contacted: ${lastcontacted})`
          );
          await deleteUser(email);
          continue; // Skip user mobo check if they're being deleted
        }
      }

      //main function proceeds below

      const heldversion = mobo.heldversion
        .match(/\d+(\.\d+)*|[A-Z]+/g)
        ?.join("");
      const userVersion = givenversion.match(/\d+(\.\d+)*|[A-Z]+/g)?.join("");

      if (!heldversion || !userVersion) {
        console.warn(
          `Invalid version data for ${userMobo} (User: ${id}). Skipping.`
        );
        continue;
      }

      // Compare versions using compareVersions
      if (compareVersions(heldversion, userVersion) > 0) {
        console.log(`Notifying ${id} about ${userMobo} update.`);

        try {
          // Send the notification email
          await mailer(user, mobo);

          // Update lastcontacted timestamp and version
          user.lastcontacted = new Date().toISOString();
          user.givenversion = mobo.heldversion;
          updatedUsers.push(user);
        } catch (emailError) {
          console.error(
            `Failed to notify ${id} about ${userMobo}: ${emailError.message}`
          );
        }
      } else {
        console.log(`No update needed for ${id} (${userMobo}).`);
      }
    }

    // Save updated users to the database
    if (updatedUsers.length > 0) {
      await saveUsers(updatedUsers);
      console.log("Updated users saved successfully.");
      //await sql.end();
    } else {
      console.log("No users needed updates. No changes saved.");
    }
  } catch (err) {
    console.error("Error notifying users:", err.message);
  }
  await sql.end();
}

//notifyUsers();
