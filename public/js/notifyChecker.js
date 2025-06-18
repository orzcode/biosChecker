import { mailer } from "./mailer.js";
import { getMobos, getUsers, saveUsers, deleteUser } from "./sqlServices.js";
import { parseDate, isNewerDate } from "./versionChecker.js";
import { sendToDiscord } from "./reporter.js";
import { today } from "./dater.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

    // Prioritize donators
    const sortedUsers = [
      ...users.filter((u) => u.donator),
      ...users.filter((u) => !u.donator),
    ];

    const updatedUsers = [];

    for (const user of sortedUsers) {
      if (emailsSent >= DAILY_EMAIL_CAP) {
        console.log(
          `Daily email cap of ${DAILY_EMAIL_CAP} reached. Ending early.`
        );
        break;
      }

      if (user.id === "dummy") continue;

      const mobo = moboMap.get(user.mobo);
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
        const signupdate = user.signupdate;
        const [year, month, day] = signupdate.split("/");
        const signupDateTime = new Date(year, month - 1, day);
        const fiftyHoursAgo = new Date(Date.now() - 50 * 60 * 60 * 1000);

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

      // Actual checking function - based on user's givendate and mobo's helddate
      if (await isNewerDate(user.givendate, mobo.helddate)) {
        const heldDateObj = await parseDate(user.givendate);
        const foundDateObj = await parseDate(mobo.helddate);
        const heldDateTime = heldDateObj.getTime();
        const foundDateTime = foundDateObj.getTime();

        // Logging the comparison for debugging
        console.log(`[CHECK] Considered ${user.id} / ${user.mobo}`);
        console.log(
          `- User.givendate: ${
            user.givendate
          } => ${heldDateObj.toISOString()} (${heldDateTime})`
        );
        console.log(
          `- Mobo.helddate: ${
            mobo.helddate
          } => ${foundDateObj.toISOString()} (${foundDateTime})`
        );

        try {
          // For verbose Resend error handling
          const mailResult = await mailer(user, mobo);

          if (mailResult?.error) {
            const { name, message } = mailResult.error;
            throw new Error(`Resend Error [${name}]: ${message}`);
          }
          // For verbose Resend error handling
          // If this errors, it gets caught below, without updating the user

          // Log only after successful send
          console.log(
            `[NOTIFY] Successfully sent to ${user.id} / ${user.mobo}`
          );

          await sleep(1000); // 1 second pause between emails

          emailsSent++;
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
            "New Ver": mobo.heldversion,
            Status: "notified",
          });
        } catch (emailError) {
          console.error(
            `❌ Failed to notify ${user.id} about ${user.mobo}: ${emailError}`
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
