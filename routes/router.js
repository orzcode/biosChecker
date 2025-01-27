import { Router } from "express";
import fs from "fs";
import path from "path";
const router = Router();

import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { addOrUpdateUser } from "../public/js/userService.js";

//router.get("/", (req, res) => res.send("Hello, world!"));

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

  addOrUpdateUser(email, selectedMobo);

  res.redirect("/");
  //later add redir page here?
  //otherwise need some kind of user feedback
});

export default router;
