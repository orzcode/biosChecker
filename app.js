import express from "express";
import path from "path";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "url";
import router from "./routes/router.js";
import compression from "compression";
import { minify } from 'html-minifier-terser';
import ejs from 'ejs';

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
// Enable template caching
if (process.env.NODE_ENV === 'production') {
  ejs.cache = true;
}

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

////////////////////////////////////////////////////////////
// HTML-minifier-terser and EJS integration
// Overrides the default res.render method to minify HTML output
if (process.env.NODE_ENV !== 'production') {
  console.log("Production mode: Applying HTML minification middleware.");
  app.use((req, res, next) => {
      // Keep a reference to the original render method
      const originalRender = res.render;

      // Override res.render
      res.render = async function (view, options, callback) {
          // Ensure options is an object, clone it if needed to avoid side effects
          const renderOptions = { ...(options || {}) };
          const appViews = app.get('views');
          const viewPath = path.join(appViews, view + '.ejs');

          try {
              // Step 1: Render the EJS template to an HTML string
              // Pass { async: true } to ejs.renderFile if your EJS templates use async operations
              const html = await ejs.renderFile(viewPath, renderOptions, { async: true });

              // Step 2: Minify the resulting HTML
              const minifiedHtml = await minify(html, {
                  removeAttributeQuotes: true,
                  collapseWhitespace: true,
                  removeComments: true,
                  minifyJS: true,        // Minify JS in <script> tags using Terser
                  minifyCSS: true,        // Minify CSS in <style> tags
                  removeRedundantAttributes: true,
                  removeScriptTypeAttributes: true,
                  removeStyleLinkTypeAttributes: true,
                  useShortDoctype: true
              });

              // Step 3: Handle the response
              // Check if a callback function was provided to res.render
              if (typeof callback === 'function') {
                  // If yes, invoke the callback with the minified HTML, following Express conventions (err, html)
                  callback(null, minifiedHtml);
              } else {
                  // If no callback, send the minified HTML as the response
                  res.send(minifiedHtml);
              }

          } catch (err) {
              // Error Handling: If rendering or minification fails
              console.error(`Error rendering/minifying ${viewPath}:`, err); // Log the specific error
              if (typeof callback === 'function') {
                  // Pass the error to the callback if provided
                  callback(err);
              } else {
                  // Otherwise, pass the error to the next Express error handler
                  next(err);
              }
          }
      }; // End of overridden res.render

      // Continue to the next middleware in the chain (important!)
      next();
  });
}
////////////////////////////////////////////////////////////

// Routes
app.use("/", router);

console.log(`Running in ${process.env.NODE_ENV} mode`);

const PORT = process.env.PORT || 8000;

if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    const delay = Math.floor(Math.random() * 2000) + 100;
    console.log(`Delaying request by ${delay}ms`);
    setTimeout(next, delay);
  });
}

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

// For Vercel
export default app;
