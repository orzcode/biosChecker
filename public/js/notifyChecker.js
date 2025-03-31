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
            const mobo = moboMap.get(user.mobo);

            if (user.id === "dummy") {
                continue;
            }

            if (!mobo) {
                console.warn(`Mobo ${user.mobo} not found for user ${user.id}. Skipping.`);
                summary.errors.push({
                    id: user.id,
                    mobo: user.mobo,
                    error: "Motherboard not found",
                });
                summary.summary.errors++;
                continue;
            }

            if (user.verified === false) {
                const lastContactedDate = user.lastcontacted; // Now just a string 'YYYY-M-D'
                const formattedToday = await today(); // My custom today() function for YYYY-M-D
            
                // Compare only the date part (YYYY/M/D)
                if (lastContactedDate < formattedToday) {
                    console.log(`Deleting unverified user ${user.id})`);
                    await deleteUser(user.email);
                    summary.summary.additional.usersDeleted++;
                    summary.details.push({
                        id: user.id,
                        mobo: user.mobo,
                        status: "deleted"
                    });
                    continue;
                }
            }
            

            if (await isNewerDate(user.givendate, mobo.helddate)) {
                console.log(`Notifying ${user.id} about ${user.mobo} update.`);
                try {
                    await mailer(user, mobo);
                    const updatedUser = {
                        ...user,
                        lastcontacted: await today(),
                        givenversion: mobo.heldversion,
                        givendate: mobo.helddate,
                    };
                    updatedUsers.push(updatedUser);
                    summary.summary.success++;
                    summary.details.push({
                        id: user.id,
                        mobo: user.mobo,
                        newVersion: mobo.heldversion,
                        newDate: mobo.helddate,
                        status: "notified"
                    });
                } catch (emailError) {
                    console.error(`Failed to notify ${user.id} about ${user.mobo}: ${emailError}`);
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
            "Errors": summary.summary.errors,
        });

        if (summary.summary.success > 0) {
            console.log("\n==== Notified Users ====");
            console.table(summary.details.filter(user => user.status === "notified"));
        }

        if (summary.summary.additional.usersDeleted > 0) {
            console.log("\n==== Deleted Users ====");
            console.table(summary.details.filter(user => user.status === "deleted"));
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
            "Errors": summary.summary.errors,
        });

        await sendToDiscord(summary, "notifyUsers");

        return summary;
    }
}