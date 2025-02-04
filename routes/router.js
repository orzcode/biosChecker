import { Router } from "express";
import sql from "../public/js/db.js";
const router = Router();

import * as sqlServices from "../public/js/sqlServices.js";

router.get("/", async (req, res) => {
  try {
    // Query the database for all models
    const motherboards = await sqlServices.getMobos();

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

export default router;
