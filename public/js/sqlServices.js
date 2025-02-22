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

export async function getUsers(identifier) {
  try {
    if (!identifier) {
      return await sql`SELECT * FROM users`;
    }

    const query =
      typeof identifier === "string" && identifier.includes("@")
        ? await sql`SELECT * FROM users WHERE email = ${identifier}`
        : await sql`SELECT * FROM users WHERE id = ${identifier}`;

    //de-structures 'array' to single user, or returns all users.
    //alternatively returns 'null' if user not found
    //return query.length > 0 ? query[0] : null;
    return query;
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
        INSERT INTO users (id, email, mobo, givenversion, lastcontacted, verified)
        VALUES (${user.id}, ${user.email}, ${user.mobo}, ${user.givenversion}, ${user.lastcontacted}, ${user.verified})
        ON CONFLICT (id) DO UPDATE
        SET 
          email = EXCLUDED.email,
          mobo = EXCLUDED.mobo,
          givenversion = EXCLUDED.givenversion,
          lastcontacted = EXCLUDED.lastcontacted,
          verified = EXCLUDED.verified;
      `;
    }
    console.log("Users saved or updated successfully.");
  } catch (error) {
    console.error("Error saving users:", error);
  }
}

// Function to add or update a user
export async function addOrUpdateUser(email, mobo) {

  const model = await getMobos(mobo);
  const latestVersion = model ? model[0].heldversion : null;

  //updates user mobo choice
  try {
    const [existingUser] = await getUsers(email);
    if (existingUser) {
      existingUser.mobo = mobo;
      existingUser.givenversion = latestVersion;
      await saveUsers(existingUser);
      console.log(`Updated user ${email} with mobo: ${mobo} + latestheldversion`);
    }
    //otherwise creates new user (with unverified status)
    else {
      // Fetch the motherboard data for the given model
      const newUser = {
        id: generateUniqueId("user_"),
        email,
        mobo,
        givenversion: latestVersion,
        lastcontacted: new Date().toISOString(),
        verified: false,
      };
      await saveUsers(newUser);
      console.log(`Created new user: ${email} with mobo: ${mobo}`);

      //only returns in case of new user creation
      //if this sucks, just request the user object within router or w/e
      return newUser
    }
  } catch (error) {
    console.error(`Error adding/updating user ${email}:`, error.message);
    throw error;
  }
  // finally {
  //   await sql.end(); // Ensure connection is closed
  // }
}

export async function deleteUser(identifier) {
  try {
    if (!identifier){
      throw new Error("Identifier is required to delete a user.");
    }
    if (identifier === 'dummy'){
      console.log("Skipping deletion of dummy")
      return 
    }
    else{
    const query =
      typeof identifier === "string" && identifier.includes("@")
        ? sql`DELETE FROM users WHERE email = ${identifier}`
        : sql`DELETE FROM users WHERE id = ${identifier}`;

    await query;
    }
  } catch (error) {
    console.error("Error deleting user:", error);
  }
  // finally {
  //   await sql.end(); // Ensure connection is closed
  // }
}

export async function verifyUser(id) {
  try {
    await sql`UPDATE users SET verified = true WHERE id = ${id}`;
    console.log(`${id} verification processed via verifyUser()`)
  } catch (error) {
    console.error("Error verifying user:", error);
  }
}
