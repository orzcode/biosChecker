import { Router } from "express";
const router = Router();

import * as sqlServices from "../public/js/sqlServices.js";
import { confirmationMail } from "../public/js/mailer.js";

// Prevent caching on dynamic routes
const noCache = (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
};
// Apply only to relevant routes
router.use(["/submit", "/unsubscribe", "/confirm/:id"], noCache);


router.get("/", async (req, res) => {
  try {
    const motherboards = await sqlServices.loadMotherboards();
    res.render("layout", { motherboards, page: "mainPageComponent" });
  } catch (err) {
    console.error("Error reading models.json:", err);
    res.status(500).send("Failed to fetch models.");
  }
});

router.post("/submit", async (req, res) => {
  const { email, selectedMobo } = req.body;

  ////validates email input////
  async function validateEmail(email) {
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
      //console.log("User not found; creating, sending confirm, & routing")
      const newUser = await sqlServices.addOrUpdateUser(email, selectedMobo);
      await confirmationMail(newUser);
      return res.render("layout", { email, page: "checkEmailComponent" });
    }

    //if user exists but still not verified, remind them to confirm
    if (!user.verified) {
      //console.log("User found but unverified, routing appropriately")
      return res.render("layout", { email, page: "checkEmailComponent" });
    }

    //otherwise, updates the existing verified user
    return await updateUserMobo(res, user, selectedMobo);
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

    return await updateUserMobo(res, user, null);
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
  if (selectedMobo != null) {
    await sqlServices.addOrUpdateUser(user.email, selectedMobo);
    res.render("layout", {
      email: user.email,
      selectedMobo,
      previousMobo,
      page: "submitPageComponent",
    });
  }
  //Only used in confirmations
  //This means the user got here from their email link and is a new user,
  //with (res, user, null)
  else {
    res.render("layout", {
      email: user.email,
      selectedMobo: user.mobo,
      page: "submitPageComponent",
    });
  }
}

//handles both form 'POST' and link-based 'GET' requests
router.all("/unsubscribe", async (req, res) => {
  const email = req.method === "POST" ? req.body.email : req.query.email;

  if (!email) {
    return res.status(400).render("layout", {
      message: "Missing email address.",
      title: "Error 400",
      page: "errorComponent",
    });
  }

  try {
    // Fetch user by email
    const [user] = await sqlServices.getUsers(email);

    // Check if the user exists
    if (!user) {
      return res.status(404).render("layout", {
        message: "User not found.",
        title: "Error 404",
        page: "errorComponent",
      });
    }

    // Remove the user from the database
    await sqlServices.deleteUser(email);

    // Render the unsubscribe confirmation view
    res.render("layout", { email: user.email, page: "unsubscribeComponent" });
  } catch (error) {
    console.error("Error handling unsubscribe:", error);
    return res.status(500).render("layout", {
      message: "An error occurred while processing your request.",
      title: "Error 500",
      page: "errorComponent",
    });
  }
});

router.get("/charts", async (req, res) => {
    res.render("layout", { page: "chartsComponent" });
});

export default router;
