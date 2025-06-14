import { mailer } from "./mailer.js";
import { getMobos, getUsers, saveUsers, deleteUser } from "./sqlServices.js";
import { parseDate, isNewerDate } from "./versionChecker.js";
import { sendToDiscord } from "./reporter.js";
import { today } from "./dater.js";

export async function notifyUsers() {
  const summary = {
    summary: {
      title: "Notification Check",
      total: 0,
      success: 0,
      errors: 0,
      additional: {
        usersDeleted: 0,
      },
    },
    details: [],
    errors: [],
  };

  const DAILY_EMAIL_CAP = 160;
  let emailsSent = 0;

  try {
    const users = await getUsers();
    const mobos = await getMobos();

    if (!mobos || mobos.length === 0) {
      console.warn("No motherboard data found. Exiting.");
      return summary;
    }

    if (!users || users.length === 0) {
      console.warn("No user data found. Exiting.");
      return summary;
    }

    summary.summary.total = users.length;

    const moboMap = new Map(mobos.map((mobo) => [mobo.model, mobo]));

    const updatedUsers = [];

    for (const user of users) {

        //Keeps update emails at 150, giving room for new signups.
      if (emailsSent >= DAILY_EMAIL_CAP) {
        console.log(
          `Daily email cap of ${DAILY_EMAIL_CAP} reached. Ending early.`
        );
        break;
      }

      const mobo = moboMap.get(user.mobo);

      if (user.id === "dummy") {
        continue;
      }

      if (!mobo) {
        console.warn(
          `Mobo ${user.mobo} not found for user ${user.id}. Skipping.`
        );
        summary.errors.push({
          id: user.id,
          mobo: user.mobo,
          error: "Motherboard not found",
        });
        summary.summary.errors++;
        continue;
      }

      if (user.verified === false) {
        const signupdate = user.signupdate; // Format: 'YYYY/M/D'

        // Convert signupdate to Date object
        const [year, month, day] = signupdate.split("/");
        const signupDateTime = new Date(year, month - 1, day); // month is 0-indexed in JS Date

        // 50 hours ago
        const fiftyHoursAgo = new Date(Date.now() - 50 * 60 * 60 * 1000);

        // Compare actual timestamps, not just date strings
        if (signupDateTime < fiftyHoursAgo) {
          console.log(`Deleting unverified user ${user.id})`);
          await deleteUser(user.email);
          summary.summary.additional.usersDeleted++;
          summary.details.push({
            id: user.id,
            mobo: user.mobo,
            status: "deleted",
          });
          continue;
        }
      }

      if (await isNewerDate(user.givendate, mobo.helddate)) {
        console.log(`Notifying ${user.id} about ${user.mobo} update.`);
        try {
          await mailer(user, mobo);
          emailsSent++; // increments daily email cap
          const updatedUser = {
            ...user,
            lastcontacted: await today(),
            givenversion: mobo.heldversion,
            givendate: mobo.helddate,
          };
          updatedUsers.push(updatedUser);
          summary.summary.success++;
          summary.details.push({
            ID: user.id,
            Mobo: user.mobo,
            "New Ver": mobo.heldversion, // POST-UPDATE version; DB's MODEL version, not the user's version (givenver)
            Status: "notified",
          });
        } catch (emailError) {
          console.error(
            `Failed to notify ${user.id} about ${user.mobo}: ${emailError}`
          );
          summary.errors.push({
            id: user.id,
            mobo: user.mobo,
            error: emailError.message,
          });
          summary.summary.errors++;
        }
      }
    }

    if (updatedUsers.length > 0) {
      await saveUsers(updatedUsers);
      console.log("Updated users saved successfully.");
    } else {
      console.log("No users needed updates.");
    }

    console.log("\n==== Notification Summary ====");
    console.table({
      "Total Users": summary.summary.total,
      "Users Notified": summary.summary.success,
      "Users Deleted": summary.summary.additional.usersDeleted,
      Errors: summary.summary.errors,
    });

    if (summary.summary.success > 0) {
      console.log("\n==== Notified Users ====");
      console.table(
        summary.details.filter((user) => user.status === "notified")
      );
    }

    if (summary.summary.additional.usersDeleted > 0) {
      console.log("\n==== Deleted Users ====");
      console.table(
        summary.details.filter((user) => user.status === "deleted")
      );
    }

    if (summary.summary.errors > 0) {
      console.log("\n==== Errors ====");
      console.table(summary.errors);
    }

    await sendToDiscord(summary, "notifyUsers");

    return summary;
  } catch (error) {
    console.error("Error in notifyUsers:", error);
    summary.errors.push({ id: "system", error: error.message });
    summary.summary.errors++;

    console.log("\n==== Notification Summary ====");
    console.table({
      "Total Users": summary.summary.total,
      "Users Notified": summary.summary.success,
      "Users Deleted": summary.summary.additional.usersDeleted,
      Errors: summary.summary.errors,
    });

    await sendToDiscord(summary, "notifyUsers");

    return summary;
  }
}
