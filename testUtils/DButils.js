import fs from "fs";
import sql from "../public/js/db.js";

// Function to view all users
async function viewUsers() {
  try {
    const users = await sql`SELECT * FROM users`;
    console.log("Users in the database:", users);
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

// Function to view all models
async function viewModels() {
  try {
    const models = await sql`SELECT * FROM models`;
    console.log("Models in the database:", JSON.stringify(models, null, 2));
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

async function getUserMobos() {
  try {
    const mobos = await sql`SELECT mobo FROM users`;
    const moboMap = mobos.map((row) => row.mobo);
    console.log("User mobos:", moboMap);
  } catch (error) {
    console.error("Error fetching user mobos:", error);
    return [];
  }
}

async function getSocketCounts() {
  try {
    const socketCounts = await sql`
      SELECT m.socket, COUNT(*) AS count
      FROM users u
      JOIN models m ON u.mobo = m.model
      WHERE u.id != 'dummy'
      GROUP BY m.socket
    `;

    console.log(
      socketCounts.reduce((acc, row) => {
        acc[row.socket] = parseInt(row.count, 10);
        return acc;
      }, {})
    );
  } catch (error) {
    console.error("Error fetching socket counts:", error);
    return {};
  }
}

async function modelsToJson() {
  try {
    // Query the database for all models
    const models = await sql`SELECT * FROM models`;

    // Write the models to a JSON file
    fs.writeFileSync("models.json", JSON.stringify(models, null, 2));
    console.log("Data successfully exported to models.json");
  } catch (err) {
    console.error("Error exporting data:", err);
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
    console.error("Error updating user:", error);
  }
}

async function massResetUserDatesViaArray() {
  //i.e: "user_m7ebu1p0sr35ml"

  const userIdsArray = ["dummy"];

  for (const id of userIdsArray) {
    try {
      const result = await sql`
        UPDATE users
        SET givendate = '2000/1/14'
        WHERE id = ${id}
        RETURNING *;
      `;

      if (result.count > 0) {
        console.log(`Updated user ${id}'s givendate to 2000/1/14`);
      } else {
        console.log(`User with ID ${id} not found.`);
      }
    } catch (error) {
      console.error(`Error updating user ${id}:`, error);
    }
  }
}

// Function to reset `givendate` for a specific user
async function userGivenDateReset(email) {
  try {
    const result = await sql`
      UPDATE users
      SET givendate = '2000/1/14'
      WHERE email = ${email}
      RETURNING *;
    `;

    if (result.count > 0) {
      console.log(`Updated ${email}'s givendate to 2000/1/14`);
    } else {
      console.log(`User with email ${email} not found.`);
    }
  } catch (error) {
    console.error("Error updating user:", error);
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
    console.error("Error deleting model:", error);
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
    console.error("Error resetting model heldversion:", error);
  }
}

async function getModelByName(model) {
  try {
    const result = await sql`
      SELECT * FROM models
      WHERE model = ${model};
    `;

    if (result.length > 0) {
      console.log(
        `Model details for '${model}':`,
        JSON.stringify(result, null, 2)
      );
    } else {
      console.log(`No model found with name '${model}'.`);
    }
  } catch (error) {
    console.error("Error fetching model data:", error);
  }
}

async function deleteUser(email) {
  await sql`DELETE FROM users WHERE email = ${email}`;
  console.log(`Deleted user:${email}`);
}

async function verifyUser(email) {
  try {
    const result = await sql`
      UPDATE users
      SET verified = true
      WHERE email = ${email}
      RETURNING *;
    `;

    if (result.length > 0) {
      console.log(`User with ID ${email} has been verified.`);
    } else {
      console.log(`User with ID ${email} not found.`);
    }
  } catch (error) {
    console.error("Error verifying user:", error);
  }
}

async function sendJsonToDB() {
  // Load JSON data
  const data = JSON.parse(fs.readFileSync("./public/data/users.json", "utf8"));

  try {
    for (const item of data) {
      await sql`
		INSERT INTO users (id, email, mobo, givenversion, lastcontacted, verified, signupdate, givendate)
		VALUES (${item.id}, ${item.email}, ${item.mobo}, ${item.givenversion}, ${item.lastcontacted}, ${item.verified}, ${item.givendate}, ${item.signupdate})
		ON CONFLICT (id) DO NOTHING
	  `;
    }

    console.log(`Successfully imported`);
  } catch (error) {
    console.error("Error importing data:", error);
  }
}

async function viewSchema() {
  console.log(
    await sql`
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    numeric_precision,
    numeric_scale,
    is_nullable, 
    column_default
FROM 
    information_schema.columns 
WHERE 
    table_name = 'users';
`
  );
}

async function makeDonator(id) {
  try {
    await sql`UPDATE users SET donator = true WHERE id = ${id}`;
    console.log(`${id} marked as donator - true via makeDonator()`);
  } catch (error) {
    console.error("Error marking user as donator:", error);
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
    case "viewUsers":
      await viewUsers();
      break;
    case "viewModels":
      await viewModels();
      break;
    case "userVerReset":
      if (!param) {
        console.error("Error: Email is required for userVerReset.");
        break;
      }
      await userVerReset(param);
      break;
    case "userGivenDateReset":
      if (!param) {
        console.error("Error: Email is required for userGivenDateReset.");
        break;
      }
      await userGivenDateReset(param);
      break;
    case "modelsToJson":
      await modelsToJson();
      break;
    case "deleteModelById":
      if (!param) {
        console.error("Error: ID is required for deleteModelById.");
        break;
      }
      await deleteModelById(param);
      break;
    case "resetModelHeldVersion":
      if (!param) {
        console.error("Error: ID is required for resetModelHeldVersion.");
        break;
      }
      await resetModelHeldVersion(param);
      break;
    case "getModelByName":
      if (!param) {
        console.error("Error: Model name is required for getModelByName.");
        break;
      }
      await getModelByName(param);
      break;
    case "deleteUser":
      if (!param) {
        console.error("Error: username is required.");
        break;
      }
      await deleteUser(param);
      break;
    case "verifyUser":
      if (!param) {
        console.error("Error: User email is required for verifyUser.");
        break;
      }
      await verifyUser(param);
      break;
    case "sendJsonToDB":
      await sendJsonToDB();
      break;
    case "viewSchema":
      await viewSchema();
      break;
    case "getUserMobos":
      await getUserMobos();
      break;
    case "getSocketCounts":
      await getSocketCounts();
      break;
    case "makeDonator":
      if (!param) {
        console.error("Error: User id is required to make Donator");
        break;
      }
      await makeDonator(param);
      break;
    case "massResetUserDatesViaArray":
      await massResetUserDatesViaArray();
      break;
    default:
      console.log(
        'No valid function specified. Use viewUsers, viewModels, userVerReset <email>, modelsToJson, deleteModelById <id>, resetModelHeldVersion <id>, getModelByName "<name>", deleteUser "<email>", or sendJsonToDB.'
      );
  }

  await sql.end(); // Close the SQL connection after all operations
})();
