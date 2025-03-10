import postgres from "postgres";

// Toggle between 'koyeb' and 'neon'
const env = "neon"; // Change this to 'neon' as needed

const sql = (() => {
  if (env === "koyeb") {
    return postgres({
      host: process.env.DATABASE_HOST,
      database: process.env.DATABASE_NAME,
      username: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      ssl: "require",
      // Connection pooling settings
      max: 10, // Maximum number of connections in pool
      idle_timeout: 10, // Close idle connections after 30 seconds
      connect_timeout: 10, // Connection timeout after 10 seconds
    });
  } else if (env === "neon") {
    return postgres({
      host: process.env.PGHOST,
      database: process.env.PGDATABASE,
      username: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      port: 5432,
      ssl: 'require',
    });
  } else {
    throw new Error("Invalid environment value. Use 'koyeb' or 'neon'.");
  }
})();

export default sql;
