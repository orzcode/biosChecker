import { generateUniqueId } from "./uuid.js";
import sql from './db.js';

export async function getMobos(singleMoboModel) {
  try {
    const query = singleMoboModel
      ? sql`SELECT * FROM models WHERE model = ${singleMoboModel}`
      : sql`SELECT * FROM models`;
    const result = await query;
    return result;
  } catch (error) {
    console.error("Error fetching model(s) from the database:", error);
    return []; // Return an empty array if there's an error
  }
}

export async function saveMobos(moboOrMobos) {
  let mobosArray;

  // If no parameter is passed, fetch all models from the database
  if (!moboOrMobos) {
    const mobos = await sql`SELECT * FROM models`;
    mobosArray = mobos; // All models from the database
  } else {
    // If a single model or multiple models are passed, normalize to an array
    //
    //NOTE: if it's empty, that's already caught in the above 'if'!
    mobosArray = Array.isArray(moboOrMobos) ? moboOrMobos : [moboOrMobos];
  }

  try {
    for (const mobo of mobosArray) {
      await sql`
        INSERT INTO models (id, model, biospage, heldVersion)
        VALUES (${mobo.id}, ${mobo.model}, ${mobo.biospage}, ${mobo.heldVersion})
        ON CONFLICT (id) DO UPDATE
        SET 
          model = EXCLUDED.model,
          biospage = EXCLUDED.biospage,
          heldVersion = EXCLUDED.heldVersion;
      `;
    }
    console.log("Models saved or updated successfully.");
  } catch (error) {
    console.error("Error saving models:", error);
  }
}

export async function getUsers(singleUserEmail) {
  try {
    const query = singleUserEmail
      ? sql`SELECT * FROM users WHERE email = ${singleUserEmail}`
      : sql`SELECT * FROM users`;
    const result = await query;
    return result;
  } catch (error) {
    console.error("Error fetching user(s) from the database:", error);
    return []; // Return an empty array if there's an error
  }
}



export async function saveUsers(userOrUsers) {
  let usersArray;

  // If no parameter is passed, fetch all users from the database
  if (!userOrUsers) {
    const users = await sql`SELECT * FROM users`;
    usersArray = users; // All users from the database
  } else {
    // If a single user or multiple users are passed, normalize to an array
    //
    //NOTE: if it's empty, that's already caught in the above 'if'!
    usersArray = Array.isArray(userOrUsers) ? userOrUsers : [userOrUsers];
  }

  try {
    for (const user of usersArray) {
      await sql`
        INSERT INTO users (id, email, mobo, givenVersion, lastContacted)
        VALUES (${user.id}, ${user.email}, ${user.mobo}, ${user.givenVersion}, ${user.lastContacted})
        ON CONFLICT (id) DO UPDATE
        SET 
          email = EXCLUDED.email,
          mobo = EXCLUDED.mobo,
          givenVersion = EXCLUDED.givenVersion,
          lastContacted = EXCLUDED.lastContacted;
      `;
    }
    console.log("Users saved or updated successfully.");
  } catch (error) {
    console.error("Error saving users:", error);
  }
}


//this is what happens when the user hits submit
export async function addOrUpdateUser(email, mobo) {
  let users = await getUsers();
  let user = await getUsers(email);

  let model = await getMobos(mobo);
  let latestVersion = model ? model.heldVersion : null;

  if (user) {
    user.mobo = mobo;
    //adds or overwrites mobo choice    
  } else {
    //generates a new user since they don't exist 
    user = {
      id: generateUniqueId("user_"),
      email,
      mobo,
      givenVersion: latestVersion,
      lastContacted: new Date().toISOString(), //or null
    };
  }

  await saveUsers(user);
}
