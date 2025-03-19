import postgres from "postgres";

// Toggle between "koyeb" and "neon"
const DB_PROVIDER = "neon";

const sql = DB_PROVIDER === "koyeb"
  ? postgres({
      host: process.env.DATABASE_HOST,
      database: process.env.DATABASE_NAME,
      username: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      ssl: "require",
      // Connection pooling settings
      max: 10, // Maximum number of connections in pool
      idle_timeout: 10, // Close idle connections after 10 seconds
      connect_timeout: 10, // Connection timeout after 10 seconds
    })
  : postgres({
      host: process.env.PGHOST,
      database: process.env.PGDATABASE,
      username: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      port: 5432,
      ssl: "require",
      // Connection pooling settings
      max: 10, // Maximum number of connections in pool
      idle_timeout: 10, // Close idle connections after 10 seconds
      connect_timeout: 10, // Connection timeout after 10 seconds
    });

export default sql;
