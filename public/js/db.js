import postgres from "postgres";

const sql = postgres({
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