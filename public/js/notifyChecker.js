import { mailer } from "./mailer.js";
import { getMobos, getUsers, saveUsers, deleteUser } from "./sqlServices.js";
import { parseDate, isNewerDate } from "./versionChecker.js";

export async function notifyUsers() {
    // Simple statistics tracking
    const stats = {
        totalUsers: 0,
        usersNotified: 0,
        usersDeleted: 0,
        errors: 0
    };
    
    // Detailed tracking - no emails
    const notifiedUsers = [];
    const deletedUsers = [];
    const errorDetails = [];

    try {
        const users = await getUsers();
        const mobos = await getMobos();

        if (!mobos || mobos.length === 0) {
            console.warn("No motherboard data found. Exiting.");
            return stats;
        }

        if (!users || users.length === 0) {
            console.warn("No user data found. Exiting.");
            return stats;
        }

        stats.totalUsers = users.length;

        // Create a Map for efficient motherboard lookups
        const moboMap = new Map(mobos.map((mobo) => [mobo.model, mobo]));

        const updatedUsers = [];
        for (const user of users) {
            const mobo = moboMap.get(user.mobo); // O(1) lookup

            if (!mobo) {
                console.warn(`Mobo ${user.mobo} not found for user ${user.id}. Skipping.`);
                stats.errors++;
                errorDetails.push({
                    id: user.id,
                    mobo: user.mobo,
                    error: "Motherboard not found"
                });
                continue;
            }

            if (user.verified === false) {
                const lastContactedDate = new Date(user.lastcontacted);
                const fiftyHoursAgo = new Date(Date.now() - 50 * 60 * 60 * 1000);
                if (lastContactedDate < fiftyHoursAgo) {
                    console.log(`Deleting unverified user ${user.id} (last contacted: ${user.lastcontacted})`);
                    await deleteUser(user.email);
                    stats.usersDeleted++;
                    deletedUsers.push({
                        id: user.id,
                        mobo: user.mobo,
                        lastContacted: user.lastcontacted
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
                        lastcontacted: new Date().toISOString(),
                        givenversion: mobo.heldversion,
                        givendate: mobo.helddate,
                    };
                    updatedUsers.push(updatedUser);
                    stats.usersNotified++;
                    notifiedUsers.push({
                        id: user.id,
                        mobo: user.mobo,
                        newVersion: mobo.heldversion,
                        newDate: mobo.helddate
                    });
                } catch (emailError) {
                    console.error(`Failed to notify ${user.id} about ${user.mobo}: ${emailError}`);
                    stats.errors++;
                    errorDetails.push({
                        id: user.id,
                        mobo: user.mobo,
                        error: emailError.message
                    });
                }
            }
        }

        if (updatedUsers.length > 0) {
            await saveUsers(updatedUsers);
            console.log("Updated users saved successfully.");
        } else {
            console.log("No users needed updates.");
        }
        
        // Print focused summary
        console.log("\n==== Notification Summary ====");
        console.table({
            "Total Users": stats.totalUsers,
            "Users Notified": stats.usersNotified,
            "Users Deleted": stats.usersDeleted,
            "Errors": stats.errors
        });
        
        // Show notified users
        if (stats.usersNotified > 0) {
            console.log("\n==== Notified Users ====");
            console.table(notifiedUsers);
        }
        
        // Show deleted users
        if (stats.usersDeleted > 0) {
            console.log("\n==== Deleted Users ====");
            console.table(deletedUsers);
        }
        
        // Show errors
        if (stats.errors > 0) {
            console.log("\n==== Errors ====");
            console.table(errorDetails);
        }
        
        return {
            stats,
            notifiedUsers,
            deletedUsers,
            errors: errorDetails
        };
    } catch (error) {
        console.error("Error in notifyUsers:", error);
        
        // Simple error summary
        console.log("\n==== Notification Summary ====");
        console.table({
            "Total Users": stats.totalUsers,
            "Users Notified": stats.usersNotified,
            "Users Deleted": stats.usersDeleted,
            "Errors": stats.errors + 1
        });
        
        return {
            stats,
            notifiedUsers,
            deletedUsers,
            errors: [...errorDetails, { id: "system", error: error.message }]
        };
    }
}