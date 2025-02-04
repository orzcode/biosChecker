import postgres from 'postgres';

// Database connection
const sql = postgres({
  host: process.env.DATABASE_HOST,
  database: process.env.DATABASE_NAME,
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  ssl: 'require',
});

// Function to view all users
async function viewUsers() {
  try {
    const users = await sql`SELECT * FROM users`;
    console.log('Users in the database:', users);
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

// Function to view all models
async function viewModels() {
  try {
    const models = await sql`SELECT * FROM models`;
    console.log('Models in the database:', models);
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

// Function to reset `givenVersion` for a specific user
async function userVerReset(email) {
  try {
    const result = await sql`
      UPDATE users
      SET givenversion = '1.0.0'
      WHERE email = ${email}
      RETURNING *;
    `;

    if (result.count > 0) {
      console.log(`Updated ${email}'s givenversion to 1.0.0`);
    } else {
      console.log(`User with email ${email} not found.`);
    }
  } catch (error) {
    console.error('Error updating user:', error);
  }
}

// Process CLI arguments
const functionName = process.argv[2];
const email = process.argv[3]; // Capture email if needed

// USAGE:
// node viewDB.js viewUsers
// node viewDB.js viewModels
// node viewDB.js userVerReset user@example.com

(async () => {
  switch (functionName) {
    case 'viewUsers':
      await viewUsers();
      break;
    case 'viewModels':
      await viewModels();
      break;
    case 'userVerReset':
      if (!email) {
        console.error('Error: Email is required for userVerReset.');
        break;
      }
      await userVerReset(email);
      break;
    default:
      console.log('No valid function specified. Use viewUsers, viewModels, or userVerReset <email>.');
  }

  await sql.end(); // Close the SQL connection after all operations
})();
