import { mailer } from "./mailer.js";
import { getMobos, getUsers, saveUsers, deleteUser } from "./sqlServices.js";
import sql from "./db.js";
import { parseDate, isNewerDate } from "./versionChecker.js";

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
        givendate,
        lastcontacted,
        verified,
      } = user;
      const mobo = mobos.find((m) => m.model === userMobo);

      if (!mobo) {
        console.warn(`Mobo ${userMobo} not found for user ${id}. Skipping.`);
        continue; // Skip if motherboard isn't found
      }

      //checks and removes unverified users, unless within last 18 hours
      if (verified === false) {
        const lastContactedDate = new Date(lastcontacted);
        const eighteenHoursAgo = new Date(Date.now() - 18 * 60 * 60 * 1000); // 18 hours ago

        if (lastContactedDate < eighteenHoursAgo) {
          console.log(
            `Deleting unverified user ${id} (last contacted: ${lastcontacted})`
          );
          await deleteUser(email);
          continue; // Skip user mobo check if they're being deleted
        }
      }

      //main function proceeds below
      
      // Check if there's a newer BIOS version based on release date
      if (await isNewerDate(givendate, mobo.helddate)) {
        console.log(`Notifying ${id} about ${userMobo} update.`);

        try {
          // Send the notification email
          await mailer(user, mobo);

          // Update lastcontacted timestamp, version, and date
          user.lastcontacted = new Date().toISOString();
          user.givenversion = mobo.heldversion;
          user.givendate = mobo.helddate;
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
    } else {
      console.log("No users needed updates. No changes saved.");
    }
  } catch (err) {
    console.error("Error notifying users:", err.message);
  }
  //await sql.end();
}

//notifyUsers();
