import { updateModels } from "./versionChecker.js";
import { notifyUsers } from "./notifyChecker.js";

async function runTasks() {
  console.log(
    "Debug runTasks.js: RESEND_API_KEY:",
    process.env.RESEND_API_KEY ? "Loaded" : "Missing"
  );
  console.log(
    "---GitHub Actions runTasks (daily) - version + notify checks---"
  );
  try {
    console.log("---Starting daily versionChecker...");
    await updateModels();
    console.log("---Finished daily versionChecker.");

    console.log("---Starting daily notifyChecker...");
    await notifyUsers();
    console.log("---Finished daily notifyChecker.");
  } catch (error) {
    console.error("Error running tasks:", error.message);
  }
}

runTasks();
