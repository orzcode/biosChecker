import { Router } from "express";
import fs from "fs";
import path from "path";
const router = Router();

import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { addOrUpdateUser, getUsers, saveUsers } from "../public/js/userService.js";

router.get("/", (req, res) => {
  // Read the JSON file
  const filePath = path.join(__dirname, "../public/data/models.json");
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading models.json:", err);
      res.status(500).send("Failed to read models.json");
      return;
    }

    // Parse the JSON data
    const motherboards = JSON.parse(data);

    // Render the EJS template with the parsed data
    res.render("allmodels", { motherboards });
  });
});

router.post("/submit", (req, res) => {
  const { email, selectedMobo } = req.body;

  if (!email || !selectedMobo) {
    return res.status(400).send("Missing email or motherboard selection");
  }

  // Get the current users and check for the existing user
  const users = getUsers();
  const user = users.find((u) => u.email === email);
  const previousMobo = user ? user.mobo : null;

  // Add or update the user
  addOrUpdateUser(email, selectedMobo);

  // Render the submit page with the relevant data
  res.render("submitPage", {
    email: email,
    selectedMobo: selectedMobo,
    previousMobo: previousMobo,
  });
});

router.post("/unsubscribe", (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).render("error", { 
      message: "Missing email address.", 
      title: "Error 400" 
    });
  }

  let users = getUsers();
  const userIndex = users.findIndex((u) => u.email === email);

  if (userIndex === -1) {
    return res.status(404).render("error", { 
      message: "User not found.", 
      title: "Error 404" 
    });
  }

  // Remove the user
  const [removedUser] = users.splice(userIndex, 1);

  // Save the updated users list
  saveUsers(users);

  // Render the unsubscribe confirmation view
  res.render("unsubscribe", { email: removedUser.email });
});


export default router;
