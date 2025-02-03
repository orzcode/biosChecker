import postgres from 'postgres';

// Database connection
const sql = postgres({
  host: process.env.DATABASE_HOST,
  database: process.env.DATABASE_NAME,
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  ssl: 'require',
});

async function viewUsers() {
  try {
    const users = await sql`SELECT * FROM users`;
    console.log('Users in the database:', users);
  } catch (error) {
    console.error('Error fetching data:', error);
  } finally {
    await sql.end();
  }
}

viewUsers();
