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

async function viewModels() {
  try {
    const models = await sql`SELECT * FROM models`;
    console.log('Models in the database:', models);
  } catch (error) {
    console.error('Error fetching data:', error);
  } finally {
    await sql.end();
  }
}

//Usage: `node viewDB.js viewUsers` etc

const functionName = process.argv[2];
switch (functionName) {
  case "viewUsers":
    viewUsers();
    break;
  case "viewModels":
    viewModels();
    break;
  default:
    console.log("No additional function specified");
}