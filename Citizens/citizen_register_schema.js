// Citizen.js
const mongoose = require('mongoose');

//Citizen registration form Schema
const CitizenSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  mobile: { type: String, required: true, unique: true },
  ward: { type: String, required: true },
  password: { type: String, required: true },
  email: { type: String, required: true},
  address: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Citizen', CitizenSchema);







