import express from "express";
const app = express();
app.set('trust proxy', 1)
app.get('/ip', (request, response) => response.send(request.ip))

import path from "path";

import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("view engine", "ejs");
app.set("views", path.join(path.resolve(), "views"));

app.use(express.static(path.join(__dirname, "public")));

// Middleware to parse URL-encoded bodies (for form submissions)
app.use(express.urlencoded({ extended: true }));

// 🛡️ Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable if using inline scripts/styles
  })
);

// 🚧 Global Rate Limiting
const limiter = rateLimit({
  windowMs: 8 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests, please try again later.",
});
app.use(limiter);

// Middleware to parse JSON (if you're sending JSON data)
app.use(express.json());

import router from "./routes/router.js";

app.use("/", router);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`App is live @ http://localhost:${PORT}/`);
  const isProduction = process.env.NODE_ENV === "prod";
  console.log(`Running in ${isProduction ? "prod" : "dev"} mode`);
});
