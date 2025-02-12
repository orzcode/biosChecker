import express from "express";
const app = express();
import path from "path";

import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("view engine", "ejs");
app.set("views", path.join(path.resolve(), "views"));

app.use(express.static(path.join(__dirname, "public")));

// Middleware to parse URL-encoded bodies (for form submissions)
app.use(express.urlencoded({ extended: true }));

// Middleware to parse JSON (if you're sending JSON data)
app.use(express.json());

import router from "./routes/router.js";

app.use("/", router);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`App is live @ http://localhost:${PORT}/`);
});
