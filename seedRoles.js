const mongoose = require("mongoose");
const Role = require("./models/Role");
// require("dotenv").config();
const path = require('path');
const dotenv = require('dotenv');
 dotenv.config({path:path.join(__dirname,'config','.env')})
async function seedRoles() {
  await mongoose.connect(process.env.DATABASE);

  const roles = [
    {
      name: "ADMIN",
      permissions: [
        {
          page: "dashboard",
          actions: { view: true }
        },
        {
          page: "projects",
          actions: { view: true, create: true, edit: true, delete: true }
        },
        {
          page: "tasks",
          actions: { view: true, create: true, edit: true, delete: true }
        },
        {
          page: "users",
          actions: { view: true, create: true, edit: true, delete: true }
        }
      ]
    }
  ];

  for (const role of roles) {
    const exists = await Role.findOne({ name: role.name });
    if (!exists) {
      await Role.create(role);
      console.log(`${role.name} role created`);
    }
  }

  process.exit(0);
}

seedRoles().catch(console.error);
