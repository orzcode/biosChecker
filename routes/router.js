import { Router } from "express";
import sql from "../public/js/db.js";
import fs from "fs/promises";
const router = Router();

import * as sqlServices from "../public/js/sqlServices.js";
import { confirmationMail } from "../public/js/mailer.js";


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

  ////validates email input////
  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  if (!validateEmail(email)) {
    return res.status(400).json({ error: "Invalid email format." });
  }
  if (req.body.hachimitsu) {
    return res.status(400).json({ error: "Spam detected." });
  }
  if (!email || !selectedMobo) {
    return res.status(400).send("Missing email or motherboard selection.");
  }
  ////////////////////////////

  //checks for existing user
  try {
    const [user] = await sqlServices.getUsers(email);

    //if no user, make new user with unverified status (handled automatically by sql)
    if (!user) {
      console.log("User not found; creating, sending confirm, & routing")
      const newUser = await sqlServices.addOrUpdateUser(email, selectedMobo);
      await confirmationMail(newUser);
      return res.render("checkEmail", { email });
    }

    //if user exists but still not verified, remind them to confirm
    if (!user.verified) {
      console.log("User found but unverified, routing appropriately")
      return res.render("checkEmail", { email });
    }

    //otherwise, updates the existing verified user
    return updateUserMobo(res, user, selectedMobo);
  } catch (err) {
    console.error("Error processing request:", err);
    res.status(500).send("An error occurred.");
  }
});

router.get("/confirm/:id", async (req, res) => {
  try {
    const [user] = await sqlServices.getUsers(req.params.id);

    if (!user) {
      return res.status(400).send("Invalid or expired confirmation link.");
    }

    if (!user.verified) {
      await sqlServices.verifyUser(req.params.id);
    }

    return updateUserMobo(res, user, null);
    //prevents showing previous mobo for confirmations

  } catch (err) {
    console.error("Error confirming user:", err);
    res.status(500).send("Error confirming your email.");
  }
});

async function updateUserMobo(res, user, selectedMobo) {
  const previousMobo = user.mobo;
  
  //Prevents showing previous mobo for confirmations
  //This means the user got here from the main page,
  //with (res, user, selectedMobo)
  if(selectedMobo != null){
  await sqlServices.addOrUpdateUser(user.email, selectedMobo);
  res.render("submitPage", {
    email: user.email,
    selectedMobo,
    previousMobo,
  });
  }
  //Only used in confirmations
  //This means the user got here from their email link and is a new user,
  //with (res, user, null)
  else{
    res.render("submitPage", {
      email: user.email,
      selectedMobo: user.mobo
    });
  }
}


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
    const [user] = await sqlServices.getUsers(email);

    // Check if the user exists
    if (!user) {
      return res.status(404).render("error", {
        message: "User not found.",
        title: "Error 404",
      });
    }

    // Remove the user from the database
    await sqlServices.deleteUser(email)

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



//for triggering scheduled tasks on koyeb
// import { runTasks } from "../public/js/runTasks.js";
// import { scrapeMotherboards } from "../public/js/moboFetcher.js";
// const KOYEB_REPOPUSHKEY = process.env.KOYEB_REPOPUSHKEY;
// router.post("/trigger", async (req, res) => {
//   try {
//     const { secret, task } = req.body;

//     // Check if the secret is provided and matches
//     if (!secret || secret !== KOYEB_REPOPUSHKEY) {
//       console.warn("Unauthorized request: Invalid or missing permission.");
//       return res.status(403).send({ error: "Unauthorized: Invalid permission" });
//     }

//     // Determine which task to run
//     if (task === "runTasks") {
//       console.log("Running runTasks.js...");
//       await runTasks("fromKoyeb");
//       res.status(200).send({ message: "runTasks.js completed via route trigger" });
//     } else if (task === "moboFetcher") {
//       console.log("Running moboFetcher.js...");
//       await scrapeMotherboards("fromKoyeb");
//       res.status(200).send({ message: "moboFetcher.js completed via route trigger" });
//     } else {
//       res.status(400).send({ error: "Invalid or missing task parameter." });
//     }
//   } catch (error) {
//     console.error("Error triggering task:", error.message);
//     res.status(500).send({ error: "Internal server error." });
//   }
// });

export default router;