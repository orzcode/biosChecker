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

// 1. Long-term caching for images
app.use(
  "/public/images",
  (req, res, next) => {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    next();
  },
  express.static(path.join(__dirname, "public/images"), { etag: true })
);

// 2. Special case for models.json
app.use(
  "/public/data/models.json",
  (req, res, next) => {
    res.setHeader("Cache-Control", "public, max-age=21600, must-revalidate");
    next();
  },
  express.static(path.join(__dirname, "public/data"), { etag: true })
);

// Serve static files (etag enabled)
app.use(express.static(path.join(__dirname, "public"), { etag: true }));

// 🛡️ Security middleware
// Note: all of this horseshit is because of Paypal's dogshit SDK and popup window
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: [
          "'self'", 
          "*.paypal.com", 
          "*.paypalobjects.com", 
          "*.venmo.com"
        ],
        frameSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://ko-fi.com",
          "*.paypal.com",
          "*.paypal.cn",
          "*.paypalobjects.com",
          "*.objects.paypal.cn",
          "*.gstatic.com",
          "*.synchronycredit.com",
          "*.datadoghq-browser-agent.com",
          "*.static.novacredit.com",
          "*.venmo.com"
        ],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "*.paypal.com",
          "*.paypal.cn",
          "*.paypalobjects.com",
          "*.objects.paypal.cn",
          "*.gstatic.com",
          "*.synchronycredit.com",
          "*.datadoghq-browser-agent.com",
          "*.static.novacredit.com",
          "*.venmo.com"
        ],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: [
          "'self'", 
          "'unsafe-inline'", 
          "*.paypal.com", 
          "*.paypalobjects.com", 
          "*.venmo.com"
        ],
        imgSrc: [
          "'self'", 
          "data:", 
          "*.asrock.com", 
          "*.paypal.com", 
          "*.paypalobjects.com", 
          "*.venmo.com"
        ],
        childSrc: [
          "'self'", 
          "*.paypal.com", 
          "*.paypalobjects.com", 
          "*.venmo.com"
        ]
      },
    },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
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

console.log(`Running in ${process.env.NODE_ENV} mode`);

const PORT = process.env.PORT || 8000;

// For local development, or for Koyeb
// Vercel doesn't use 'listen' but seems to run regardless
app.listen(PORT, () => {
  console.log(
    `App is live @ ${
      process.env.NODE_ENV !== "production"
        ? "http://localhost:" + PORT
        : "https://www.asrockbioschecker.link/"
    }`
  );
});

// Only add delay in development
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    setTimeout(next, Math.floor(Math.random() * 2000) + 100);
    console.log("Delaying request by ~1000ms due to development mode");
  });
}

// For Vercel
export default app;
