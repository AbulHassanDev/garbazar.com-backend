
// hashPassword.js
const bcrypt = require("bcryptjs");

const password = "newpassword123";
bcrypt.hash(password, 10, (err, hash) => {
  if (err) throw err;
  console.log("Hashed Password:", hash);
});











