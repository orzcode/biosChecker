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

// Path to models.json
//const __dirname = path.dirname(new URL(import.meta.url).pathname);
//const modelsFile = path.resolve(__dirname, "../public/data/models.json");

async function setupModels() {
  try {
    // Step 1: Create the models table
    await sql`
      CREATE TABLE IF NOT EXISTS models (
        id TEXT PRIMARY KEY,
        model TEXT NOT NULL,
        maker TEXT NOT NULL,
        socket TEXT NOT NULL,
        link TEXT NOT NULL,
        biospage TEXT NOT NULL,
        heldVersion TEXT
      )
    `;
    console.log("Models table created or already exists.");
    await sql`
    ALTER TABLE models ALTER COLUMN heldVersion DROP NOT NULL
  `;
    // Step 2: Read models.json
    const modelsData = JSON.parse(await fs.readFile('./public/data/models.json', 'utf-8'));

    // Step 3: Insert data into the models table
    for (const model of modelsData) {
      await sql`
        INSERT INTO models (id, model, maker, socket, link, biospage, heldVersion)
        VALUES (${model.id}, ${model.model}, ${model.maker}, ${model.socket}, ${model.link}, ${model.biospage}, ${model.heldVersion})
        ON CONFLICT (id) DO NOTHING
      `;
    }
    console.log("Models data inserted successfully.");

    // Close the database connection
    await sql.end();
  } catch (error) {
    console.error("Error setting up the models table:", error);
  }
}

setupModels();