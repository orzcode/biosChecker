import { Router } from "express";
import sql from "../public/js/db.js";
import fs from "fs/promises";
const router = Router();

import * as sqlServices from "../public/js/sqlServices.js";

import { runTasks } from "../public/js/runTasks.js";
import { scrapeMotherboards } from "../public/js/moboFetcher.js";
const KOYEB_REPOPUSHKEY = process.env.KOYEB_REPOPUSHKEY;

import { execSync } from "child_process";

router.get("/", async (req, res) => {
  try {
    const localMoboFile = await fs.readFile("./public/data/models.json", "utf8");

    const motherboards = JSON.parse(localMoboFile);

    // Render the EJS template with the fetched data
    res.render("allmodels", { motherboards });
  } catch (err) {
    console.error("Error querying the database:", err);
    res.status(500).send("Failed to fetch models from the database");
  }
});

router.post("/submit", async (req, res) => {
  const { email, selectedMobo } = req.body;

  if (!email || !selectedMobo) {
    return res.status(400).send("Missing email or motherboard selection");
  }

  try {
    //SQL always returns even a single row as an array, hence the destructure
    const [user] = await sqlServices.getUsers(email);
    const previousMobo = user ? user.mobo : null;


    // Add or update the user
    await sqlServices.addOrUpdateUser(email, selectedMobo);

    // Render the submit page with the relevant data
    res.render("submitPage", {
      email,
      selectedMobo,
      previousMobo,
    });
  } catch (err) {
    console.error("Error processing the request:", err);
    return res
      .status(500)
      .send("An error occurred while processing your request");
  }
});

//handles both form 'POST' and link-based 'GET' requests
router.all("/unsubscribe", async (req, res) => {
  const email = req.method === "POST" ? req.body.email : req.query.email;

  if (!email) {
    return res.status(400).render("error", {
      message: "Missing email address.",
      title: "Error 400",
    });
  }

  try {
    // Fetch user by email
    const user = await sqlServices.getUsers(email);

    // Check if the user exists
    if (!user) {
      return res.status(404).render("error", {
        message: "User not found.",
        title: "Error 404",
      });
    }

    // Remove the user from the database
    await sql`DELETE FROM users WHERE email = ${email}`;

    // Render the unsubscribe confirmation view
    res.render("unsubscribe", { email: user.email });
  } catch (error) {
    console.error("Error handling unsubscribe:", error);
    return res.status(500).render("error", {
      message: "An error occurred while processing your request.",
      title: "Error 500",
    });
  }
});

//for triggering scheduled tasks
router.post("/trigger", async (req, res) => {
  try {
    const { secret, task } = req.body;

    // Check if the secret is provided and matches
    if (!secret || secret !== KOYEB_REPOPUSHKEY) {
      console.warn("Unauthorized request: Invalid or missing permission.");
      return res.status(403).send({ error: "Unauthorized: Invalid permission" });
    }

    console.log("Installing Playwright dependencies...");
    execSync("sudo npx playwright install --with-deps --no-shell", { stdio: "inherit" });

    // Determine which task to run
    if (task === "runTasks") {
      console.log("Running runTasks.js...");
      await runTasks("fromKoyeb");
      res.status(200).send({ message: "runTasks.js completed via route trigger" });
    } else if (task === "moboFetcher") {
      console.log("Running moboFetcher.js...");
      await scrapeMotherboards("fromKoyeb");
      res.status(200).send({ message: "moboFetcher.js completed via route trigger" });
    } else {
      res.status(400).send({ error: "Invalid or missing task parameter." });
    }
  } catch (error) {
    console.error("Error triggering task:", error.message);
    res.status(500).send({ error: "Internal server error." });
  }
});

export default router;