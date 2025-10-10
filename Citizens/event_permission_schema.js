const mongoose = require('mongoose');

//Event Permission Form Schema
const eventPermissionSchema = new mongoose.Schema({
  username: { type: String, required: true },
  EventpermissionId: { type: String, required: true, unique: true },
  eventName: { type: String, required: true },
  organizerName: { type: String, required: true },
  organizerContact: { type: String, required: true },
  organizerEmail: { type: String, required: true },
  eventDate: { type: String, required: true },
  eventTime: { type: String, required: true },
  eventLocation: { type: String, required: true },
  expectedGathering: { type: Number, required: true },
  eventDescription: { type: String, required: true },
  specialRequests: { type: String, default: '' },
  uploadDoc: { type: String,default:null },
  status: { type: String, default: 'Pending' }, 
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('EventPermission', eventPermissionSchema);