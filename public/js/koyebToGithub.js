import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

export async function koyebToRepo() {
  try {
    // Configure Git with user details
    await execAsync(`git config --global user.name "koyeb-bot"`);
    await execAsync(`git config --global user.email "koyeb-bot@example.com"`);

    // Check for changes in models.json
    const hasChanges = await execAsync(
      `git diff --quiet public/data/models.json || echo "CHANGES to models.json detected"`
    );

    if (!hasChanges.stdout.includes("CHANGES")) {
      console.log("No changes to models.json. Skipping commit and push.");
      return;
    }

    // Add and commit changes
    await execAsync(`git add public/data/models.json`);
    await execAsync(`git commit -m "Update models.json from Koyeb task"`);

    // Push changes to GitHub using the token
    const GITHUB_TOKEN = process.env.KOYEB_REPOPUSHKEY;
    if (!GITHUB_TOKEN) {
      throw new Error("Github access token not set");
    }

    const remoteRepo = `https://${GITHUB_TOKEN}@github.com/orzcode/biosChecker.git`;
    await execAsync(`git push ${remoteRepo} main`);
    console.log("models.json pushed from Koyeb to GitHub successfully!");
  } catch (err) {
    console.error("Error pushing changes to GitHub:", err.message);
  }
}
