import postgres from "postgres";

//Koyeb
const sql = postgres({
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

//Neon (normal postgres, not serverless driver version)
// const sql = postgres({
//   host: process.env.PGHOST,
//   database: process.env.PGDATABASE,
//   username: process.env.PGUSER,
//   password: process.env.PGPASSWORD,
//   port: 5432,
//   ssl: 'require',
// });

export default sql;
