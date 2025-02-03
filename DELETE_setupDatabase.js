import postgres from 'postgres';
import fs from 'fs/promises';

// Database connection
const sql = postgres({
  host: process.env.DATABASE_HOST,
  database: process.env.DATABASE_NAME,
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  ssl: 'require',
});

async function setupDatabase() {
  try {
    // Step 1: Create the table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        mobo TEXT NOT NULL,
        givenVersion TEXT NOT NULL,
        lastContacted TIMESTAMP
      )
    `;
    console.log('Table created or already exists.');

    // Step 2: Read users.json
    const usersData = JSON.parse(await fs.readFile('./public/data/users.json', 'utf-8'));

    // Step 3: Insert data into the database
    for (const user of usersData) {
      await sql`
        INSERT INTO users (id, email, mobo, givenVersion, lastContacted)
        VALUES (${user.id}, ${user.email}, ${user.mobo}, ${user.givenVersion}, ${user.lastContacted})
        ON CONFLICT (id) DO NOTHING
      `;
    }
    console.log('Data inserted successfully.');

    // Close the database connection
    await sql.end();
  } catch (error) {
    console.error('Error setting up the database:', error);
  }
}

setupDatabase();
