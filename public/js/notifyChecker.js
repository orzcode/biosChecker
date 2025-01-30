import fs from "fs";
import path from "path";

import { mailer } from "./mailer.js";

// Paths to data files
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const modelsFile = path.resolve(__dirname, "../data/models.json");
const usersFile = path.resolve(__dirname, "../data/users.json");

// Helper function to send an email (mock for now)
async function sendEmail(email, subject, body) {
  console.log(`Sending email to: ${email}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body:\n${body}`);
  // In a real-world case, you'd use a library like nodemailer or an API like SendGrid
}

async function notifyUsers() {
  try {
    // Load models and users data
    const mobos = JSON.parse(fs.readFileSync(modelsFile, "utf8"));
    const users = JSON.parse(fs.readFileSync(usersFile, "utf8"));

    // Iterate over users to determine if they need to be notified
    for (const user of users) {
      const { id, email, mobo: userMobo, givenVersion } = user;
      const mobo = mobos.find((m) => m.model === userMobo);

      if (!mobo) {
        console.warn(`Mobo ${userMobo} not found for user ${email}. Skipping.`);
        continue;
      }

      const heldVersion = mobo.heldVersion
        .match(/\d+(\.\d+)*|[A-Z]+/g)
        ?.join("");
      const userVersion = givenVersion.match(/\d+(\.\d+)*|[A-Z]+/g)?.join("");

      if (!heldVersion || !userVersion) {
        console.warn(`Invalid version data for ${userMobo}. Skipping.`);
        continue;
      }

      if (heldVersion > userVersion) {
        console.log(`Notifying ${email} about ${userMobo} update.`);
        const subject = `BIOS Update Available for ${userMobo}`;
        const body = `Hi there,\n\nA new BIOS version (${mobo.heldVersion}) is available for your motherboard (${userMobo}).\n\nVisit ${mobo.biospage} for more details.\n\nBest regards,\nYour BIOS Tracker`;

		////////////////

        await mailer(user, mobo);

		////////////////

        // Update lastContacted timestamp
        const date = new Date();
        const hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, "0");
        const ampm = hours >= 12 ? "PM" : "AM";
        const formattedHours = (hours % 12 || 12).toString().padStart(2, "0");
        const formattedDate = `${date.getDate().toString().padStart(2, "0")}-${(
          date.getMonth() + 1
        )
          .toString()
          .padStart(
            2,
            "0"
          )}-${date.getFullYear()}-${formattedHours}:${minutes}${ampm}`;
        user.lastContacted = formattedDate;

        //update user version if successful
        user.givenVersion = mobo.heldVersion;
      } else {
        console.log(`No update needed for ${email} (${userMobo}).`);
      }
    }

    // Save updated users.json
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), "utf8");
    console.log("Notification process complete.");
  } catch (err) {
    console.error("Error notifying users:", err.message);
  }
}

notifyUsers();