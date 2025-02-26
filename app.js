import express from "express";
import path from "path";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "url";
import router from "./routes/router.js";
import compression from "compression";

// Initialize Express app
const app = express();

// Resolve __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enable gzip compression
app.use(compression());

// Set view engine and views directory
app.set("view engine", "ejs");
app.set("views", path.join(path.resolve(), "views"));

// Trust proxy for rate-limiting and security
app.set("trust proxy", 1);

// Middleware
app.use(express.urlencoded({ extended: true })); // Form data parsing
app.use(express.json()); // JSON parsing

// Override cache for models.json (6 hours, must revalidate)
app.use("/public/data/models.json", (req, res, next) => {
  res.setHeader("Cache-Control", "public, max-age=21600, must-revalidate");
  next();
});

// Cache images for a year (immutable)
app.use("/public/images", (req, res, next) => {
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  next();
});

// Serve static files (etag enabled)
app.use(express.static(path.join(__dirname, "public"), { etag: true }));


// 🛡️ Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable if using inline scripts/styles
  })
);

// 🚧 Global Rate Limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests, please try again later.",
  keyGenerator: (request) => {
    if (!request.ip) {
      console.error(
        "WARN | `express-rate-limit` | `request.ip` is undefined. You can avoid this by providing a custom `keyGenerator` function, but it may be indicative of a larger issue."
      );
    }
    return request.ip.replace(/:\d+[^:]*$/, "");
  },
});
app.use(limiter);

// Routes
app.use("/", router);

// Start server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`App is live @ http://localhost:${PORT}/`);
  console.log(
    `Running in ${process.env.NODE_ENV === "prod" ? "prod" : "dev"} mode`
  );
});
