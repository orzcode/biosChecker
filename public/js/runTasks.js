import { versionChecker } from './versionChecker.js';
import { notifyChecker } from './notifyChecker.js';

async function runTasks() {
	console.log("---GitHub Actions runTasks (daily) - version + notify checks---");
  try {
    console.log("---Starting daily versionChecker...");
    await versionChecker();
    console.log("---Finished daily versionChecker.");

    console.log("---Starting daily notifyChecker...");
    await notifyChecker();
    console.log("---Finished daily notifyChecker.");
  } catch (error) {
    console.error("Error running tasks:", error.message);
  }
}

runTasks();
