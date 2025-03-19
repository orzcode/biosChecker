import { mailer } from "./mailer.js";
import { getMobos, getUsers, saveUsers, deleteUser } from "./sqlServices.js";
import { parseDate, isNewerDate } from "./versionChecker.js";

export async function notifyUsers() {
    try {
        const users = await getUsers();
        const mobos = await getMobos();

        if (!mobos || mobos.length === 0) {
            console.warn("No motherboard data found. Exiting.");
            return;
        }

        if (!users || users.length === 0) {
            console.warn("No user data found. Exiting.");
            return;
        }

        // Create a Map for efficient motherboard lookups
        const moboMap = new Map(mobos.map((mobo) => [mobo.model, mobo]));

        const updatedUsers = [];
        for (const user of users) {
            const mobo = moboMap.get(user.mobo); // O(1) lookup

            if (!mobo) {
                console.warn(`Mobo ${user.mobo} not found for user ${user.id}. Skipping.`);
                continue;
            }

            if (user.verified === false) {
                const lastContactedDate = new Date(user.lastcontacted);
                const fiftyHoursAgo = new Date(Date.now() - 50 * 60 * 60 * 1000);
                if (lastContactedDate < fiftyHoursAgo) {
                    console.log(`Deleting unverified user ${user.id} (last contacted: ${user.lastcontacted})`);
                    await deleteUser(user.email);
                    continue;
                }
            }

            if (await isNewerDate(user.givendate, mobo.helddate)) {
                console.log(`Notifying ${user.id} about ${user.mobo} update.`);
                try {
                    await mailer(user, mobo);
                    updatedUsers.push({
                        ...user,
                        lastcontacted: new Date().toISOString(),
                        givenversion: mobo.heldversion,
                        givendate: mobo.helddate,
                    });
                } catch (emailError) {
                    console.error(`Failed to notify ${user.id} about ${user.mobo}: ${emailError}`);
                    // Add to retry queue here if appropriate
                }
            }
        }

        if (updatedUsers.length > 0) {
            await saveUsers(updatedUsers);
            console.log("Updated users saved successfully.");
        } else {
            console.log("No users needed updates.");
        }
    } catch (error) {
        console.error("Error in notifyUsers:", error);
    }
}