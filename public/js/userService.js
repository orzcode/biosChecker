import fs from "fs";
import { generateUniqueId } from "./uuid.js";
import path from "path";
import sql from './db.js';

// Use import.meta.url to get the directory name in an ES module
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const usersFile = path.resolve(__dirname, "../data/users.json");
const modelsFile = path.resolve(__dirname, "../data/models.json");

export function getUsers() {
  if (fs.existsSync(usersFile)) {
    return JSON.parse(fs.readFileSync(usersFile, "utf8"));
  }
  return [];
}

export function saveUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

//this is what happens when the user hits submit
export function addOrUpdateUser(email, mobo) {
  let users = getUsers();
  let user = users.find((u) => u.email === email);

  let models = JSON.parse(fs.readFileSync(modelsFile, "utf8"));
  let model = models.find((model) => model.model === mobo);
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
    users.push(user);
  }

  saveUsers(users);
}
