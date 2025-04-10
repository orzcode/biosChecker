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
  app.set('view cache', true);
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
// Enhanced HTML-minifier-terser configuration with uglification
if (process.env.NODE_ENV !== 'production') {

  console.log("Applying HTML minification middleware.");
  app.use((req, res, next) => {
    // Keep a reference to the original render method
    const originalRender = res.render;

    // Override res.render
    res.render = function(view, options, callback) {
      // Handle function overloading patterns
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }
      
      options = options || {};
      
      // Enhanced minification options with uglification
      const minificationOptions = {
        // Basic minification
        collapseWhitespace: true,
        removeComments: true,
        removeAttributeQuotes: true,
        
        // More aggressive optimizations
        collapseBooleanAttributes: true,
        removeEmptyAttributes: true,
        removeOptionalTags: true,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        removeTagWhitespace: true,
        sortAttributes: true,
        sortClassName: true,
        useShortDoctype: true,
        
        // Uglify inline JS and CSS
        minifyJS: {
          mangle: true,
          compress: {
            sequences: true,
            dead_code: true,
            conditionals: true,
            booleans: true,
            unused: true,
            if_return: true,
            join_vars: true,
            drop_console: false // Keep console for debugging
          }
        },
        minifyCSS: true,
        
        // Prevents HTML from breaking
        caseSensitive: true,
        keepClosingSlash: true,
        
        // Process conditional comments
        processConditionalComments: true
      };
      
      // Handle different callback scenarios
      if (typeof callback === 'function') {
        // If user provided a callback, wrap it to perform minification first
        originalRender.call(this, view, options, async function(err, html) {
          if (err) {
            return callback(err);
          }
          
          try {
            const minifiedHtml = await minify(html, minificationOptions);
            return callback(null, minifiedHtml);
          } catch (minifyErr) {
            console.error(`Error minifying HTML for ${view}:`, minifyErr);
            return callback(null, html); // Fall back to original HTML
          }
        });
      } else {
        // No callback provided, we need to send the response ourselves
        originalRender.call(this, view, options, async function(err, html) {
          if (err) {
            return next(err);
          }
          
          try {
            const minifiedHtml = await minify(html, minificationOptions);
            res.send(minifiedHtml);
          } catch (minifyErr) {
            console.error(`Error minifying HTML for ${view}:`, minifyErr);
            res.send(html); // Fall back to original HTML
          }
        });
      }
    };

    next();
  });
}
////////////////////////////////////////////////////////////

// Routes
app.use("/", router);

console.log(`Running in ${process.env.NODE_ENV} mode`);

const PORT = process.env.PORT || 8000;

// if (process.env.NODE_ENV !== "production") {
//   app.use((req, res, next) => {
//     const delay = Math.floor(Math.random() * 2000) + 100;
//     console.log(`Delaying request by ${delay}ms`);
//     setTimeout(next, delay);
//   });
// }

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