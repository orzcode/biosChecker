import { notifyUsers } from "./notifyChecker.js";

export async function runNotify() {
	try {
		console.log("---Starting re-run of notifyUsers...");
		await notifyUsers();
		console.log("---Finished re-run of notifyUsers...");
	} catch (error) {
		console.error("Error running tasks:", error.message);
	}
}

runNotify();
