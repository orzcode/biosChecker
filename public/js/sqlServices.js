import { generateUniqueId } from "./uuid.js";
import sql from "./db.js";
import { today } from "./dater.js";

///////Saving/loading models json to memory///////
import { promises as fs } from "fs";

let cachedMotherboards = null;

export async function loadMotherboards() {
  if (!cachedMotherboards) {
    const localMoboFile = await fs.readFile(
      "./public/data/models.json",
      "utf8"
    );
    cachedMotherboards = JSON.parse(localMoboFile);
  }
  return cachedMotherboards;
}
///////Saving/loading models json to memory///////

export async function getMobos(singleMoboModel) {
  try {
    return singleMoboModel
      ? await sql`SELECT * FROM models WHERE model = ${singleMoboModel}`
      : await sql`SELECT id, model, maker, socket, link, biospage, heldversion, helddate, release FROM models`;
  } catch (error) {
    console.error("Error fetching model(s) from the database:", error);
    return [];
  }
}

export async function saveMobos(moboOrMobos) {
  if (!moboOrMobos) return;
  const mobosArray = Array.isArray(moboOrMobos) ? moboOrMobos : [moboOrMobos];

  try {
    for (const mobo of mobosArray) {
      await sql`
        INSERT INTO models (id, model, maker, socket, link, biospage, heldversion, helddate, release)
        VALUES (${mobo.id}, ${mobo.model}, ${mobo.maker}, ${mobo.socket},
          ${mobo.link}, ${mobo.biospage}, ${mobo.heldversion}, ${mobo.helddate}, ${mobo.release})
        ON CONFLICT (id) DO UPDATE SET
          model = EXCLUDED.model,
          maker = EXCLUDED.maker,
          socket = EXCLUDED.socket,
          link = EXCLUDED.link,
          biospage = EXCLUDED.biospage,
          heldversion = EXCLUDED.heldversion,
          helddate = EXCLUDED.helddate,
          release = EXCLUDED.release;
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
      return await sql`SELECT id, email, mobo, givenversion, givendate, lastcontacted, verified, signupdate, donator FROM users`;
    }
    return await sql`
      SELECT id, email, mobo, givenversion, givendate, lastcontacted, verified, signupdate, donator FROM users
      WHERE ${
        identifier.includes("@")
          ? sql`email = ${identifier}`
          : sql`id = ${identifier}`
      }
    `;
  } catch (error) {
    console.error("Error fetching user(s) from the database:", error);
    return [];
  }
}

export async function saveUsers(userOrUsers) {
  if (!userOrUsers) return;
  const usersArray = Array.isArray(userOrUsers) ? userOrUsers : [userOrUsers];

  try {
    for (const user of usersArray) {
      await sql`
        INSERT INTO users (id, email, mobo, givenversion, givendate, lastcontacted, verified, signupdate, donator)
        VALUES (${user.id}, ${user.email}, ${user.mobo}, ${user.givenversion}, ${user.givendate}, ${user.lastcontacted}, ${user.verified}, ${user.signupdate}, ${user.donator})
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          mobo = EXCLUDED.mobo,
          givenversion = EXCLUDED.givenversion,
          givendate = EXCLUDED.givendate,
          lastcontacted = EXCLUDED.lastcontacted,
          verified = EXCLUDED.verified,
          signupdate = EXCLUDED.signupdate,
          donator = EXCLUDED.donator;
      `;
    }
    console.log("Users saved or updated successfully.");
  } catch (error) {
    console.error("Error saving users:", error);
  }
}

export async function addOrUpdateUser(email, mobo) {
  try {
    const model = await getMobos(mobo);
    const latestVersion = model?.[0]?.heldversion ?? null;
    const latestDate = model?.[0]?.helddate ?? null;

    //console.log(latestDate)

    const [existingUser] = await getUsers(email);
    if (existingUser) {
      existingUser.mobo = mobo;
      existingUser.givenversion = latestVersion;
      await saveUsers(existingUser);
      console.log(
        `Updated user ${existingUser.id} with mobo: ${mobo} + ${latestVersion}`
      );
    } else {
      const newUser = {
        id: await generateUniqueId("user_"),
        email,
        mobo,
        givenversion: latestVersion,
        givendate: latestDate,
        lastcontacted: null,
        verified: false,
        signupdate: await today(),
        donator: false,
      };
      await saveUsers(newUser);
      //console.log(newUser);
      console.log(`Created new user: ${newUser.id} with mobo: ${mobo}`);
      return newUser;
    }
  } catch (error) {
    console.error("Error adding/updating user:", error.message);
    throw error;
  }
}

export async function deleteUser(identifier) {
  if (!identifier) throw new Error("Identifier is required to delete a user.");
  if (identifier === "dummy") return console.log("Skipping deletion of dummy");

  try {
    await sql`
      DELETE FROM users
      WHERE ${
        identifier.includes("@")
          ? sql`email = ${identifier}`
          : sql`id = ${identifier}`
      }
    `;
    console.log("User deleted successfully.");
  } catch (error) {
    console.error("Error deleting user:", error);
  }
}

export async function verifyUser(id) {
  try {
    await sql`UPDATE users SET verified = true WHERE id = ${id}`;
    console.log(`${id} verification processed via verifyUser()`);
  } catch (error) {
    console.error("Error verifying user:", error);
  }
}

export async function makeDonator(id) {
  try {
    await sql`UPDATE users SET donator = true WHERE id = ${id}`;
    console.log(`${id} marked as donator - true via makeDonator()`);
  } catch (error) {
    console.error("Error marking user as donator:", error);
  }
}
