import postgres from 'postgres';
import fs from 'fs';

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
    console.log('Models in the database:', JSON.stringify(models, null, 2));
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

async function modelsToJson() {
  try {
    // Query the database for all models
    const models = await sql`SELECT * FROM models`;

    // Write the models to a JSON file
    fs.writeFileSync('models.json', JSON.stringify(models, null, 2));
    console.log('Data successfully exported to models.json');
  } catch (err) {
    console.error('Error exporting data:', err);
  }
  await sql.end();
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

async function deleteModelById(id) {
  try {
    const result = await sql`
      DELETE FROM models
      WHERE id = ${id}
      RETURNING *;
    `;

    if (result.count > 0) {
      console.log(`Deleted model with id ${id}`);
    } else {
      console.log(`Model with id ${id} not found.`);
    }
  } catch (error) {
    console.error('Error deleting model:', error);
  }
}

async function resetModelHeldVersion(id) {
  try {
    const result = await sql`
      UPDATE models
      SET heldversion = NULL
      WHERE id = ${id}
      RETURNING *;
    `;

    if (result.count > 0) {
      console.log(`Reset heldversion for model with id ${id}`);
    } else {
      console.log(`Model with id ${id} not found.`);
    }
  } catch (error) {
    console.error('Error resetting model heldversion:', error);
  }
}

async function getModelByName(model) {
  try {
    const result = await sql`
      SELECT * FROM models
      WHERE model = ${model};
    `;

    if (result.length > 0) {
      console.log(`Model details for '${model}':`, JSON.stringify(result, null, 2));
    } else {
      console.log(`No model found with name '${model}'.`);
    }
  } catch (error) {
    console.error('Error fetching model data:', error);
  }
}


// Process CLI arguments
const functionName = process.argv[2];
const param = process.argv[3]; // Capture email if needed

// USAGE:
// node DButils.js viewUsers
// node DButils.js viewModels
// node DButils.js userVerReset user@example.com

(async () => {
  switch (functionName) {
    case 'viewUsers':
      await viewUsers();
      break;
    case 'viewModels':
      await viewModels();
      break;
    case 'userVerReset':
      if (!param) {
        console.error('Error: Email is required for userVerReset.');
        break;
      }
      await userVerReset(param);
      break;
    case 'modelsToJson':
      await modelsToJson();
      break;
    case 'deleteModelById':
      if (!param) {
        console.error('Error: ID is required for deleteModelById.');
        break;
      }
      await deleteModelById(param);
      break;
    case 'resetModelHeldVersion':
      if (!param) {
        console.error('Error: ID is required for resetModelHeldVersion.');
        break;
      }
      await resetModelHeldVersion(param);
      break;
    case 'getModelByName':
      if (!param) {
        console.error('Error: Model name is required for getModelByName.');
        break;
      }
      await getModelByName(param);
      break;
    default:
      console.log('No valid function specified. Use viewUsers, viewModels, userVerReset <email>, modelsToJson, deleteModelById <id>, resetModelHeldVersion <id>, or getModelByName "<name>".');
  }

  await sql.end(); // Close the SQL connection after all operations
})();


