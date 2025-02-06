import { generateUniqueId } from "./uuid.js";
import sql from "./db.js";

export async function getMobos(singleMoboModel) {
  try {
    const query = singleMoboModel
      ? sql`SELECT * FROM models WHERE model = ${singleMoboModel}`
      : sql`SELECT * FROM models`;
    return await query;
  } catch (error) {
    console.error("Error fetching model(s) from the database:", error);
    return [];
  }
}

export async function saveMobos(moboOrMobos) {
  let mobosArray;

  if (!moboOrMobos) {
    const mobos = await sql`SELECT * FROM models`;
    mobosArray = mobos;
  } else {
    mobosArray = Array.isArray(moboOrMobos) ? moboOrMobos : [moboOrMobos];
  }

  try {
    for (const mobo of mobosArray) {
      await sql`
        INSERT INTO models (id, model, maker, socket, link, biospage, heldversion)
        VALUES (
          ${mobo.id},
          ${mobo.model},
          ${mobo.maker},
          ${mobo.socket},
          ${mobo.link},
          ${mobo.biospage},
          ${mobo.heldversion}
        )
        ON CONFLICT (id) DO UPDATE
        SET 
          model = EXCLUDED.model,
          maker = EXCLUDED.maker,
          socket = EXCLUDED.socket,
          link = EXCLUDED.link,
          biospage = EXCLUDED.biospage,
          heldversion = EXCLUDED.heldversion;
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
    return await query;
  } catch (error) {
    console.error("Error fetching user(s) from the database:", error);
    return [];
  }
}

export async function saveUsers(userOrUsers) {
  let usersArray;

  if (!userOrUsers) {
    const users = await sql`SELECT * FROM users`;
    usersArray = users;
  } else {
    usersArray = Array.isArray(userOrUsers) ? userOrUsers : [userOrUsers];
  }

  try {
    for (const user of usersArray) {
      await sql`
        INSERT INTO users (id, email, mobo, givenversion, lastcontacted)
        VALUES (${user.id}, ${user.email}, ${user.mobo}, ${user.givenversion}, ${user.lastcontacted})
        ON CONFLICT (id) DO UPDATE
        SET 
          email = EXCLUDED.email,
          mobo = EXCLUDED.mobo,
          givenversion = EXCLUDED.givenversion,
          lastcontacted = EXCLUDED.lastcontacted;
      `;
    }
    console.log("Users saved or updated successfully.");
  } catch (error) {
    console.error("Error saving users:", error);
  }
}

// Function to add or update a user
export async function addOrUpdateUser(email, mobo) {
  try {
    // Check if the user already exists
    const [existingUser] = await getUsers(email);

    // Fetch the motherboard data for the given model
    const model = await getMobos(mobo);

    const latestVersion = model ? model[0].heldversion : null;

    if (existingUser) {
      // Update the existing user
      existingUser.mobo = mobo;
      await saveUsers(existingUser);
      console.log(`Updated user ${email} with mobo: ${mobo}`);
    } else {
      // Create a new user
      const newUser = {
        id: generateUniqueId("user_"),
        email,
        mobo,
        givenversion: latestVersion,
        lastcontacted: new Date().toISOString(),
      };
      await saveUsers(newUser);
      console.log(`Created new user: ${email} with mobo: ${mobo}`);
    }
  } catch (error) {
    console.error(`Error in addOrUpdateUser for ${email}:`, error.message);
    throw error;
  } finally {
    await sql.end(); // Ensure connection is closed
  }
}
