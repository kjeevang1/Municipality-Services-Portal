const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  username: { type: String, required: true }, // Mobile number
  ComplaintId : { type: String, required: true, unique: true },
  subject: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  location: { type: String, required: true },
  ward: { type: String, required: true },
  imagePath: { type: String, default: null }, // Path to image
  submittedAt: { type: Date, default: Date.now },
  status: { type: String, default: "Pending" },
  status_description: { type: String, default: "" }

});

module.exports = mongoose.model('Complaint', complaintSchema);