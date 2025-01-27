import fs from "fs";
import { generateUniqueId } from "./uuid.js";
import path from "path";

// Use import.meta.url to get the directory name in an ES module
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const usersFile = path.resolve(__dirname, "../data/users.json");

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
  if (user) {
    // if (!user.mobos.includes(mobo)) {
    //   user.mobos.push(mobo);
    // }
    //old code, to add multiple mobos

    user.mobo = mobo;
    //adds or overwrites mobo choice
    
  } else {
    //generates a new user since they don't exist
    user = {
      id: generateUniqueId("user_"),
      email,
      mobo,
      lastContacted: null,
    };
    users.push(user);
  }

  saveUsers(users);
}
