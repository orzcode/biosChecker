import { updateModels } from "./versionChecker.js";
import { notifyUsers } from "./notifyChecker.js";

export async function runTasks(fromKoyeb) {
  console.log(
    "---runTasks (daily) - version + notify checks---"
  );
  try {
    console.log("---Starting daily versionChecker...");
    if(fromKoyeb === "fromKoyeb"){
      await updateModels("fromKoyeb");
    } else {
      await updateModels();
    }
    console.log("---Finished daily versionChecker.");

    console.log("---Starting daily notifyChecker...");
    await notifyUsers();
    console.log("---Finished daily notifyChecker.");
  } catch (error) {
    console.error("Error running tasks:", error.message);
  }
}

runTasks();
