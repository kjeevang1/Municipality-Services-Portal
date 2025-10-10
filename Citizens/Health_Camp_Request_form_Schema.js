const mongoose = require('mongoose');

const healthCampRequestSchema = new mongoose.Schema({
  HealthcampId: { type: String, required: true, unique: true },  // Unique ID
  username: { type: String, required: true },
  orgName: { type: String, required: true },
  contactPerson: { type: String, required: true },
  contactNumber: { type: String, required: true },
  email: { type: String, required: true },
  campTitle: { type: String, required: true },
  campPurpose: { type: String, required: true },
  services: { type: String, required: true },
  doctorsCount: { type: Number, required: true },
  campDate: { type: String, required: true },
  duration: { type: String, required: true },
  location: { type: String, required: true },
  govtCollab: { type: String, enum: ['Yes', 'No'], required: true },
  remarks: { type: String },
  uploadProposal: { type: String, default: null },
  status: { type: String, default: 'Pending' }, 
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('HealthCampRequest', healthCampRequestSchema);
