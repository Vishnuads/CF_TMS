// controllers/roleController.js
const Role = require("../models/Role");

exports.getRoles = async (req, res) => {
  const roles = await Role.find().sort({ name: 1 });
  res.json(roles);
};
