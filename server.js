// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const Citizen = require('./Citizens/citizen_register_schema'); //citizen_register_schema
const bcrypt = require('bcryptjs');
const Complaint = require('./Citizens/complaint_form_schema'); //complaint_form_schema
const session = require('express-session');
const EventPermission = require('./Citizens/event_permission_schema'); //Event Permission form Schema
const HealthCampRequest = require('./Citizens/Health_Camp_Request_form_Schema'); // Health Camp Registration form Schema
const nodemailer = require('nodemailer');
//To upload documents to Cloudinary
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
//app.use(express.static(path.join(__dirname, 'public')));

app.use(express.static(__dirname));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Connect to MonsegoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connected to MongoDB');
}).catch((err) => {
  console.error('❌ MongoDB connection error:', err);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

let server;
const gracefulShutdown = () => {
    console.log('Shutting down server...');
    if (server) {
        server.close(() => {
            console.log('Server closed. Disconnecting from MongoDB...');
            mongoose.disconnect(() => {
                console.log('Disconnected from MongoDB. Exiting process.');
                process.exit(0);
            });
        });
    } else {
        console.log('Server not running, exiting process.');
        process.exit(0);
    }

    setTimeout(() => {
        console.error('Forcing shutdown after timeout.');
        process.exit(1);
    }, 10000); 
};

process.on('SIGTERM', gracefulShutdown); 
process.on('SIGINT', gracefulShutdown);  
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown(); 
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    gracefulShutdown(); 
});


//Session
app.use(session({
    secret: process.env.SESSION_SECRET, 
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));


// Default route (index.html)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname,'index.html'));
});

//Get Citizen Login Form
app.get('/citizen_login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '/Citizens/citizen_login.html'));
});

//Citizen Register
app.get('/citizen_register.html', (req, res) => {
  res.sendFile(path.join(__dirname, '/Citizens/citizen_register.html'));
});

//Home page
app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

//Give complaint form
app.get('/complaint-form.html', (req, res) => {
  res.sendFile(path.join(__dirname, '/Citizens//complaint-form.html'));
});



//Citizen Register
app.post('/citizen-register', async (req, res) => {
  try {
    const { firstName, lastName, mobile, ward, email, address, password} = req.body;

    const exists = await Citizen.findOne({ mobile });
    if (exists) {
      return res.status(400).json({ message: 'Mobile number already registered.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const newCitizen = new Citizen({ firstName, lastName, mobile, ward, email, address,password: hashedPassword });
    await newCitizen.save();
    
    await sendRegistrationEmail(newCitizen);

    res.status(201).json({ message: 'Citizen registered successfully' });
    console.log('✅ Citizen registered:', req.body);
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

//Citizen login validation
app.post('/citizen-login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const citizen = await Citizen.findOne({ mobile: username });

    if (!citizen) {
      console.log("No user found.");
      return res.status(401).send('Invalid mobile or password');
    }
    console.log("Found user:", citizen.mobile);
    req.session.username = username; 

    const isMatch = await bcrypt.compare(password, citizen.password);
    console.log("Password match:", isMatch);

    if (!isMatch) {
      return res.status(401).send('Invalid mobile or password');
    }

    // ✅ Login Success
    res.status(200).json({ message: 'Login successful, redirecting......', redirect: '/Citizens/citizen_dashboard.html' });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).send('Server error');
  }
});

app.get('/citizen_dashboard.html', isAuthenticated, (req, res) => {
    console.log(`Serving citizen dashboard for: ${req.session.username}`);
    res.sendFile(path.join(__dirname, 'public', 'citizen_dashboard.html'));
});

//Citizen Logout
app.post('/logout', (req, res) => {
    if (req.session) {
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
                return res.status(500).json({ message: 'Could not log out. Server error.' });
            }
            res.clearCookie('connect.sid');
            res.status(200).json({ message: 'Logged out successfully!' });
        });
    } else {
        res.status(200).json({ message: 'No active session to log out from.' });
    }
});

//Checks if Authenticated
app.get('/api/check-auth-status', isAuthenticated, (req, res) => {
    res.status(200).json({ authenticated: true, username: req.session.username });
});


// --- AUTHENTICATION MIDDLEWARE: isAuthenticated ---
function isAuthenticated(req, res, next) {
    if (req.session && req.session.username) {
        next();
    } else {
        console.log('Access denied: User not authenticated. Redirecting to login.');

        return res.status(401).redirect('/Citizens/citizen_login.html');

    }
}

//Retrieve data for citizen dashboard
app.get('/profile/:mobile', async (req, res) => {
  try {
    const citizen = await Citizen.findOne({ mobile: req.params.mobile });
    if (!citizen) return res.status(404).json({ error: 'Citizen not found' });

    res.json({
      name: citizen.firstName +" "+ citizen.lastName,
      ward: citizen.ward,
      mobile: citizen.mobile
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

//Document / Image Uploads
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// General Storage for images and PDFs (complaints, events, health camps)
const generalStorage = new CloudinaryStorage({ 
  cloudinary: cloudinary,
  params: {
    folder: 'Naidupeta Municipal Corporation',
    // Conditional resource_type:
    resource_type: (req, file) => {
        if (file.mimetype === 'application/pdf') {
            return 'raw'; // Force PDFs to be 'raw'
        }
        return 'auto'; // Let Cloudinary auto-detect for other file types
    },
    public_id: (req, file) => 'upload_' + Date.now(),
    format: async (req, file) => file.mimetype.split('/')[1]
  }
});

const uploadGeneral = multer({ storage: generalStorage });


//Submit Complaint form
app.post('/submit-complaint',uploadGeneral.single('image'),async (req, res) => {
  
  const username = req.session.username;
  console.log(username);
  const ComplaintId = 'CMPT' + Date.now().toString().slice(-6);; 

  try {
    const {subject, category, description, location, ward } = req.body;

    const username = req.session.username;
    console.log(username);

    if (!username) {
      return res.status(401).json('Unauthorized: Username not found in session');
    }

    const imagePath = req.file ? req.file.path : null;
    const complaint = new Complaint({
      username,
      ComplaintId,
      subject,
      category,
      description,
      location,
      ward,
      imagePath
    });
    
    // Lookup the citizen by username (which is mobile number)
    const citizen = await Citizen.findOne({ mobile: complaint.username });
    if (!citizen) {
      return res.status(404).json({ message: 'Citizen not found for this complaint.' });
    }

    await complaint.save();

    console.log(citizen.email);
    await sendComplaintSubmissionEmail(
      citizen.email,
      complaint.ComplaintId,
    );

    res.status(200).json({ message: 'Complaint submitted successfully',imagePath,ComplaintId});
  } catch (error) {
    console.error('Error saving complaint:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});

//Submit Event Permission Form 
app.post('/submit-event-request',  uploadGeneral.single('uploadDoc'), async (req, res) => {
  try {
    const username = req.session.username; // assuming session contains logged-in user's identifier
    const EventpermissionId = 'EVNT' + Date.now().toString().slice(-6);; 
    if (!username) {
      return res.status(401).send('Unauthorized: Username not found in session');
    }

    const {
      eventName,
      organizerName,
      organizerContact,
      organizerEmail,
      eventDate,
      eventTime,
      eventLocation,
      expectedGathering,
      eventDescription,
      specialRequests
    } = req.body;

    const uploadDoc =  req.file ? req.file.path : null;

    const newRequest = new EventPermission({
      username,
      EventpermissionId,
      eventName,
      organizerName,
      organizerContact,
      organizerEmail,
      eventDate,
      eventTime,
      eventLocation,
      expectedGathering,
      eventDescription,
      specialRequests,
      uploadDoc
    });
 
    const citizen = await Citizen.findOne({ mobile:newRequest.username });
    if (!citizen) {
      return res.status(404).json({ message: 'Citizen not found for this event permission.' });
    } 

    await newRequest.save();

    if (citizen.email) {
      await sendEventPermissionSubmissionEmail(
        citizen.email,
        EventpermissionId,
      );
    }
    res.status(200).json({ message: 'Event Permission Request Submitted Successfully',uploadDoc,EventpermissionId});
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server Error' });
  }
});

//Submit Health Camp Request Form 
app.post('/submit-health-camp', uploadGeneral.single('uploadProposal'), async (req, res) => {
  try {
    const username = req.session.username;
    if (!username) return res.status(401).json({ message: 'Unauthorized' });

    const {
      orgName, contactPerson, contactNumber, email,
      campTitle, campPurpose, services, doctorsCount,
      campDate, duration, location, govtCollab, Remarks
    } = req.body;

    // Generate unique camp ID like HCAMP-202407200001
    const uniqueNumber = Date.now().toString().slice(-6); // last 6 digits of timestamp
    const HealthcampId = `HCMP${uniqueNumber}`;

    const uploadProposal = req.file ? req.file.path : null;
    const newRequest = new HealthCampRequest({
      HealthcampId,
      username,
      orgName,
      contactPerson,
      contactNumber,
      email,
      campTitle,
      campPurpose,
      services,
      doctorsCount,
      campDate,
      duration,
      location,
      govtCollab,
      remarks: Remarks,
      uploadProposal
    });

    const citizen = await Citizen.findOne({ mobile:newRequest.username });

    if (!citizen) {
      console.warn(`Citizen not found for health camp request ID: ${id} (username: ${request.username})`);
    }

    await newRequest.save();

     if (citizen && citizen.email) {
      await sendHealthCampSubmissionEmail(
        citizen.email,
        newRequest.HealthcampId,
        newRequest.campTitle, 
      );
    }
    res.status(201).json({
      message: 'Health Camp Request Submitted Successfully',
      HealthcampId,uploadProposal
    });

  } catch (err) {
    console.error('Health Camp Submission Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});




//Get Complaint Details
app.get('/get-complaints', async (req, res) => {
  const username = req.session.username;
  const { status, from, to } = req.query;

  if (!username) {
    return res.status(401).json({ message: 'Unauthorized: No user session found.' });
  }

  try {
    const query = { username };

    if (status) {
      query.status = status;
    }

    if (from && to) {
      query.submittedAt = {
        $gte: new Date(from),
        $lte: new Date(to),
      };
    }

    const complaints = await Complaint.find(query).sort({ _id: -1 });
    res.status(200).json(complaints);
  } catch (error) {
    console.error('Error fetching complaints:', error);
    res.status(500).json({ message: 'Server error while retrieving complaints.' });
  }
});

//Delete Complaint by ID
app.delete('/delete-complaint/:id', async (req, res) => {
  const username = req.session.username;
  const complaintId = req.params.id;

  if (!username) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const deleted = await Complaint.findOneAndDelete({
      _id: complaintId,
      username: username
    });

    if (!deleted) {
      return res.status(404).json({ message: 'Complaint not found or unauthorized' });
    }

    res.status(200).json({ message: 'Complaint withdrawn successfully.' });
  } catch (error) {
    console.error('Error deleting complaint:', error);
    res.status(500).json({ message: 'Server error while deleting complaint.' });
  }
});


//Get Event Permission Details
app.get('/get-event-permissions', async (req, res) => {
  const username = req.session.username;

  if (!username) {
    return res.status(401).json({ message: 'Unauthorized: No session' });
  }

  try {
    const permissions = await EventPermission.find({ username }).sort({ timestamp: -1 });
    res.status(200).json(permissions);
  } catch (error) {
    console.error('Error fetching event permissions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete Event permission by ID
app.delete('/delete-event-permission/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await EventPermission.deleteOne({ EventpermissionId: id });
    res.status(200).json({ message: 'Permission withdrawn successfully' });
  } catch (error) {
    console.error('Error deleting event permission:', error);
    res.status(500).json({ message: 'Error deleting event permission' });
  }
});


// Get health camp requests of the logged-in user
app.get('/get-healthcamps', async (req, res) => {
  const username = req.session.username;
  if (!username) return res.status(401).json({ message: 'Unauthorized' });

  const { status, from, to } = req.query;
  const filter = { username };

  if (status) filter.status = status;

  if (from || to) {
    filter.timestamp = {};
    if (from) filter.timestamp.$gte = new Date(from);
    if (to) filter.timestamp.$lte = new Date(to + 'T23:59:59');
  }

  try {
    const camps = await HealthCampRequest.find(filter).sort({ timestamp: -1 });
    res.json(camps);
  } catch (err) {
    console.error('Fetch Error:', err);
    res.status(500).json({ message: 'Failed to load health camps' });
  }
});

//Delete health camp request
app.delete('/delete-healthcamp/:id', async (req, res) => {
  const username = req.session.username;
  const { id } = req.params;

  try {
    const deleted = await HealthCampRequest.findOneAndDelete({ HealthcampId: id, username });
    if (deleted) {
      res.status(200).json({ message: 'Health camp request deleted successfully.' });
    } else {
      res.status(404).json({ message: 'Health camp not found or unauthorized.' });
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: 'Server error while deleting health camp.' });
  }
});



//Get Citizen Profile
app.get('/get-profile', isAuthenticated, async (req, res) => {
  try {
    const citizen = await Citizen.findOne({ mobile: req.session.username });
    if (!citizen) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json({
      fullName: `${citizen.firstName} ${citizen.lastName}`,
      mobile: citizen.mobile,
      email: citizen.email,
      address: citizen.address,
      ward: citizen.ward
      
    });
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

//Update Citizen Profile
app.post('/update-profile', isAuthenticated, async (req, res) => {
  const { fullName, email,ward, address } = req.body;

  if (!fullName || !email) {
    return res.status(400).json({ message: 'Full name and email are required.' });
  }

  const [firstName, ...lastParts] = fullName.trim().split(' ');
  const lastName = lastParts.join(' ') || '';

  try {
    const updated = await Citizen.findOneAndUpdate(
      { mobile: req.session.username },
      { firstName, lastName, email,ward, address },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json({ message: 'Profile updated successfully.' });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ message: 'Failed to update profile.' });
  }
});

//Change Citizen Profile password
app.post('/change-password', isAuthenticated, async (req, res) => {
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const result = await Citizen.findOneAndUpdate(
      { mobile: req.session.username },
      { password: hashedPassword }
    );

    if (!result) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ message: 'Failed to update password.' });
  }
});


function isAuthenticated(req, res, next) {
  if (req.session && req.session.username) {
    next();
  } else {
    res.status(401).json({ message: 'Unauthorized: Please login.' });
  }
}








//Admin

// Admin Login

app.post('/admin-login', async (req, res) => {
    const { username, password } = req.body;

    console.log(`[Login Attempt] User: ${username}`);

    // *** IMPORTANT CORRECTION: Using process.env.ADMIN_USER here ***
    if (username !== process.env.ADMIN_USER) {
        console.log('[Login] Invalid username.');
        return res.status(401).json({ message: 'Invalid username or password.' });
    }

    try {
        // *** IMPORTANT CORRECTION: Using process.env.ADMIN_PASS_HASH here ***
        const isMatch = await bcrypt.compare(password, process.env.ADMIN_PASS_HASH);

        if (isMatch) {
            req.session.adminUsername = process.env.ADMIN_USER; // Store admin info in session
            req.session.isAdmin = true;
            req.session.lastLogin = Date.now();

            console.log(`[Login Success] Session for ${req.session.adminUsername} set. SessionID: ${req.sessionID}`);

            return res.status(200).json({
                message: 'Admin login successful! Redirecting...',
                redirect: '/Admin/admin_dashboard.html'
            });
        } else {
            console.log('[Login] Invalid password.');
            return res.status(401).json({ message: 'Invalid username or password.' });
        }
    } catch (error) {
        console.error('[Login Error]', error);
        return res.status(500).json({ message: 'Server error during admin login. Please try again.' });
    }
});

//Admin Log out
app.post('/admin/logout', (req, res) => {
    if (req.session) {
        req.session.destroy(err => {
            if (err) {
                console.error('Error destroying admin session:', err); // Keep for server-side debugging
                return res.status(500).json({ message: 'Could not log out. Please try again.' });
            } else {
                res.clearCookie('connect.sid'); // Clear the session cookie
                res.status(200).json({ message: 'Logged out successfully.' }); // Frontend will alert this
            }
        });
    } else {
        res.status(200).json({ message: 'No active admin session to log out from.' }); // Frontend will alert this
    }
});

app.get('/admin_dashboard.html', isAdminAuthenticated, (req, res) => {
    console.log(`Serving admin dashboard for: ${req.session.adminUsername}`);
    res.sendFile(path.join(__dirname,'admin_dashboard.html'));
});

function isAdminAuthenticated(req, res, next) {
    if (req.session && req.session.adminUsername === process.env.ADMIN_USER) {
        next();
    } else {
        console.log('Access denied: Admin not authenticated. Redirecting to admin login.');
        return res.status(401).redirect('/admin_login.html');
    }
}
app.get('/api/check-admin-auth-status', isAdminAuthenticated, (req, res) => {
    return res.status(200).json({ authenticated: true, username: req.session.adminUsername });
});


//Admin Dashboard Counts
app.get('/admin/dashboard-counts', isAdminAuthenticated, async (req, res) => {
  try {
    const complaintCount = await Complaint.countDocuments();
    const healthCampCount = await HealthCampRequest.countDocuments();
    const eventPermissionCount = await EventPermission.countDocuments();
    const citizenscount = await Citizen.countDocuments();
    res.status(200).json({
      complaints: complaintCount,
      healthCamps: healthCampCount,
      eventPermissions: eventPermissionCount,
      citizens:citizenscount
    });
  } catch (error) {
    console.error('Dashboard counts error:', error);
    res.status(500).json({ message: 'Error fetching dashboard counts' });
  }
});

// ADMIN - GET complaints with optional filters
app.get('/admin/get-complaints',  isAdminAuthenticated,async (req, res) => {
  try {
    const { from, to, ward } = req.query;
    const filter = {};
    if (from || to) {
      filter.submittedAt = {};
      if (from) filter.submittedAt.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setDate(toDate.getDate() + 1); 
        filter.submittedAt.$lte = toDate;
      }
    }
    if (ward) {
      filter.ward = ward;
    }
    const complaints = await Complaint.find(filter).sort({ submittedAt: -1 });
    res.status(200).json(complaints);
  } catch (error) {
    console.error('Error fetching complaints with filters:', error);
    res.status(500).json({ message: 'Server error while fetching complaints.' });
  }
});

// ADMIN update complaint status
app.patch('/admin/update-complaint-status/:id', isAdminAuthenticated, async (req, res) => {
  const { id } = req.params;
  const { status, description } = req.body;

  try {
    const complaint = await Complaint.findOne({ ComplaintId: id });
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

     // Lookup the citizen by username (which is mobile number)
    const citizen = await Citizen.findOne({ mobile: complaint.username });
    if (!citizen) {
      return res.status(404).json({ message: 'Citizen not found for this complaint.' });
    }

    complaint.status = status;
    if (description) complaint.status_description = description;

    await complaint.save();

   console.log(citizen.email);
    await sendComplaintStatusEmail(
      citizen.email,
      complaint.ComplaintId,
      status,
      description || 'No additional notes.'
    );

    res.status(200).json({ message: 'Status updated successfully' });
  } catch (error) {
    console.error('Error updating complaint status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});





// ADMIN - GET event permissions with optional filters
app.get('/admin/get-event-permissions',  isAdminAuthenticated,async (req, res) => {
  try {
    const { from, to} = req.query;
    const filter = {};
    if (from || to) {
      filter.eventDate = {};
      if (from) filter.eventDate.$gte = from;
      if (to) {
        const toDate = new Date(to);
        toDate.setDate(toDate.getDate() + 1);
        filter.eventDate.$lte = toDate.toISOString().slice(0, 10);
      }
    }

    const permissions = await EventPermission.find(filter).sort({ timestamp: -1 });
    res.status(200).json(permissions);
  } catch (error) {
    console.error('Error fetching event permissions with filters:', error);
    res.status(500).json({ message: 'Server error while fetching event permissions.' });
  }
});

// ADMIN update event permission status
app.patch('/admin/update-event-permission-status/:id', isAdminAuthenticated, async (req, res) => {
  const { id } = req.params;
  const { status, description } = req.body;
  try {
    const permission = await EventPermission.findOne({ EventpermissionId: id });
    if (!permission) {
      return res.status(404).json({ message: 'Event permission not found' });
    }
    const citizen = await Citizen.findOne({ mobile: permission.username });
    if (!citizen) {
      return res.status(404).json({ message: 'Citizen not found for this event permission.' });
    }
    permission.status = status;
    if (description) permission.status_description = description;
    await permission.save();

    if (citizen.email) {
      await sendEventPermissionStatusEmail(
        citizen.email,
        permission.EventpermissionId,
        status,
        description || 'No additional notes.'
      );
    }
    res.status(200).json({ message: 'Status updated successfully' });
  } catch (error) {
    console.error('Error updating event permission status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});




// ADMIN - GET health camp requests with optional filters
app.get('/admin/get-health-camp-requests',  isAdminAuthenticated,async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = {};

    if (from || to) {
      filter.campDate = {}; 
      if (from) {
        const fromDate = new Date(from);
        fromDate.setUTCHours(0, 0, 0, 0);
        filter.campDate.$gte = fromDate.toISOString().slice(0, 10);
      }
      if (to) {
        const toDate = new Date(to);
        toDate.setUTCHours(23, 59, 59, 999);
        filter.campDate.$lte = toDate.toISOString().slice(0, 10);
      }
    }
    const requests = await HealthCampRequest.find(filter).sort({ timestamp: -1 });
    res.status(200).json(requests);
  } catch (error) {
    console.error('Error fetching health camp requests with filters:', error);
    res.status(500).json({ message: 'Server error while fetching health camp requests.' });
  }
});

// ADMIN update health camp request status
app.patch('/admin/update-health-camp-status/:id', isAdminAuthenticated, async (req, res) => {
  const { id } = req.params; 
  const { status, description } = req.body; 
  try {
    const request = await HealthCampRequest.findOne({ HealthcampId: id });
    if (!request) {
      return res.status(404).json({ message: 'Health camp request not found' });
    }
    const citizen = await Citizen.findOne({ mobile: request.username });

    if (!citizen) {
      console.warn(`Citizen not found for health camp request ID: ${id} (username: ${request.username})`);
    }
    request.status = status;
    request.status_description = description; 
    await request.save();
    if (citizen && citizen.email) {
      await sendHealthCampStatusEmail(
        citizen.email,
        request.HealthcampId,
        request.campTitle, 
        status,
        description || 'No additional notes provided.'
      );
    }
    res.status(200).json({ message: 'Health camp request status updated successfully' });
  } catch (error) {
    console.error('Error updating health camp request status:', error);
    res.status(500).json({ message: 'Server error while updating health camp request status.' });
  }
});




//Send Email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,       // Replace with your email
    pass: process.env.EMAIL_PASS        // Or App Password if 2FA enabled
  }
});

const sendRegistrationEmail = async (citizenDetails) => {
    const { firstName,lastName, email, mobile, ward } = citizenDetails;

    const mailOptions = {
        from: `Naidupeta Municipal Corporation <${process.env.EMAIL_USER}>`, // Sender address
        to: email, // Recipient email
        subject: 'Welcome to NMC! Citizen Registration Successful!', // Subject line
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2 style="color: #33691E;">Dear ${firstName} ${lastName},</h2>
                <p>Thank you for registering with CivicConnect, your online portal for Naidupeta Municipal Corporation!</p>
                <p>We are excited to have you join our community. Your registration allows you to:</p>
                <ul>
                    <li>Easily submit complaints and track their status.</li>
                    <li>Apply for event permissions.</li>
                    <li>Request approvals for conducting health camps.</li>
                    <li>Stay updated with important news and announcements from the Municipal Corporation.</li>
                </ul>
                <p>Here are your registration details:</p>
                <ul>
                    <li><strong>Name:</strong> ${firstName} ${lastName}</li>
                    <li><strong>Mobile:</strong> ${mobile}</li>
                    <li><strong>Ward:</strong> ${ward}</li>
                    <li><strong>Email:</strong> ${email}</li>
                </ul>
                <p>Please keep your login credentials secure.</p>
                <p>
                    Best Regards,<br>
                    Naidupeta Municipal Corporation
                </p>
                <hr style="border: 0; border-top: 1px solid #eee;">
                <p style="font-size: 0.8em; color: #777;">This is an automated email, please do not reply.</p>
            </div>
        `, // HTML body
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Registration email sent successfully to ${email}`);
    } catch (error) {
        console.error(`Failed to send registration email to ${email}:`, error);
    }
};

const sendComplaintSubmissionEmail = async (email, complaintId) => {
  const mailOptions = {
    from: `Naidupeta Municipal Corporation <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Complaint Submitted Successfully - ID: ${complaintId}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #33691E;">Dear Citizen,</h2>
        <p>Your complaint has been successfully submitted to Naidupeta Municipal Corporation.</p>
        <p>Complaint ID: <strong>${complaintId}</strong></p>
        <p>You can track your complaint status anytime on our portal.</p>
        <hr style="border-top: 1px solid #eee;"/>
        <p style="font-size: 0.8em; color: #777;">This is an automated email, please do not reply.</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Complaint submission email sent to ${email}`);
  } catch (error) {
    console.error(`Failed to send complaint submission email to ${email}:`, error);
  }
};

const sendEventPermissionSubmissionEmail = async (email, eventPermissionId) => {
  const mailOptions = {
    from: `Naidupeta Municipal Corporation <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Event Permission Request Submitted - ID: ${eventPermissionId}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #33691E;">Dear Citizen,</h2>
        <p>Your event permission request has been successfully submitted to Naidupeta Municipal Corporation.</p>
        <p>Event Permission ID: <strong>${eventPermissionId}</strong></p>
        <p>You can track your request's status anytime on our portal.</p>
        <hr style="border-top: 1px solid #eee;"/>
        <p style="font-size: 0.8em; color: #777;">This is an automated email, please do not reply.</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Event permission submission email sent to ${email}`);
  } catch (error) {
    console.error(`Failed to send event permission email to ${email}:`, error);
  }
};

const sendHealthCampSubmissionEmail = async (email, healthCampId, campTitle, campPurpose) => {
  const mailOptions = {
    from: `Naidupeta Municipal Corporation <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Health Camp Request Submitted - ID: ${healthCampId}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #33691E;">Dear Citizen,</h2>
        <p>Your health camp request has been successfully submitted to Naidupeta Municipal Corporation.</p>
        <p><strong>Health Camp Title:</strong> ${campTitle}</p>
        <p>Health Camp Request ID: <strong>${healthCampId}</strong></p>
        <p>You can track your request's status anytime on our portal.</p>
        <hr style="border-top: 1px solid #eee;"/>
        <p style="font-size: 0.8em; color: #777;">This is an automated email, please do not reply.</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Health camp submission email sent to ${email}`);
  } catch (error) {
    console.error(`Failed to send health camp email to ${email}:`, error);
  }
};


const sendComplaintStatusEmail = async (toEmail, complaintId, status, description) => {
  const mailOptions = {
    from: '"Municipality Services" <your-email@gmail.com>',
    to: toEmail,
    subject: `Complaint Status Update - ID: ${complaintId}`,
    text: `Dear Citizen,

    Your complaint with ID : ${complaintId} has been updated.
   
    New Status : ${status}
   
    Description : ${description || 'No additional notes.'}

Thank you for using our services.

Regards
Naidupeta Municipality`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${toEmail}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

const sendEventPermissionStatusEmail = async (toEmail, EventpermissionId, status, description) => {
  const mailOptions = {
    from: '"Municipality Services" <your-email@gmail.com>',
    to: toEmail,
    subject: `Event Permission Status Update - ID: ${EventpermissionId}`,
    text: `Dear Citizen,

    Your Event Permission with ID : ${EventpermissionId} has been updated.
   
    New Status : ${status}
   
    Description : ${description || 'No additional notes.'}

Thank you for using our services.

Regards
Naidupeta Municipality`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${toEmail}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

const sendHealthCampStatusEmail = async (toEmail,HealthcampId, status, description) => {
  const mailOptions = {
    from: '"Municipality Services" <your-email@gmail.com>',
    to: toEmail,
    subject: `Health Camp Permission Update - ID: ${HealthcampId}`,
    text: `Dear Citizen,

    Your Health Camp Permission with ID : ${HealthcampId} has been updated.
   
    New Status : ${status}
   
    Description : ${description || 'No additional notes.'}

Thank you for using our services.

Regards
Naidupeta Municipality`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${toEmail}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};



// ADMIN - GET all citizens
app.get('/admin/get-citizens', isAdminAuthenticated, async (req, res) => {
    try {
        const { search, ward, fromDate, toDate } = req.query; 
        let filter = {};
        if (search) {
            const searchTerm = new RegExp(search, 'i'); 
            filter = {
                $or: [ 
                    { firstName: searchTerm },
                    { lastName: searchTerm },
                    { mobile: searchTerm },
                    { email: searchTerm },
                    { address: searchTerm },
                    { ward: searchTerm } 
                ]
            };
        }

        if (ward) {
          if (filter.$or) {
            filter.ward = ward;
          }else{
              filter.ward = ward; 
          }
        }

        if (fromDate || toDate) {
            filter.createdAt = {};
            if (fromDate) {
                filter.createdAt.$gte = new Date(fromDate + 'T00:00:00.000Z');
            }
            if (toDate) {
                filter.createdAt.$lte = new Date(toDate + 'T23:59:59.999Z');
            }
        }

        
        const citizens = await Citizen.find(filter, 'firstName lastName mobile email ward address createdAt')
                                       .sort({ createdAt: -1 }); 
        const formattedCitizens = citizens.map(citizen => ({
            fullName: `${citizen.firstName} ${citizen.lastName}`,
            mobile: citizen.mobile,
            email: citizen.email,
            address: citizen.address,
            ward: citizen.ward, 
            registeredAt: citizen.createdAt 
        }));
        res.status(200).json(formattedCitizens);
    } catch (error) {
        console.error('Error fetching citizens:', error);
        res.status(500).json({ message: 'Server error while fetching citizens.' });
    }
});



// server.js (or your main backend file)

const ScrollingNews = require('./Admin/scrolling_new_schema');

app.get('/admin/get-scrolling-news', isAdminAuthenticated, async (req, res) => {
    try {
        const newsItems = await ScrollingNews.find({}).sort({ createdAt: -1 });
        res.status(200).json(newsItems);
    } catch (error) {
        console.error('Error fetching scrolling news:', error);
        res.status(500).json({ message: 'Server error while fetching scrolling news.' });
    }
});

// GET a single scrolling news item by ID
app.get('/admin/get-scrolling-news-item/:id', isAdminAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const newsItem = await ScrollingNews.findById(id);

        if (!newsItem) {
            return res.status(404).json({ message: 'News item not found' });
        }
        res.status(200).json(newsItem);
    } catch (error) {
        console.error('Error fetching single news item:', error);
        res.status(500).json({ message: 'Server error while fetching news item.' });
    }
});

// POST a new scrolling news item
app.post('/admin/add-scrolling-news-item', isAdminAuthenticated, async (req, res) => {
    try {
        const { message } = req.body;

        if (!message || message.trim().length < 5) {
            return res.status(400).json({ message: 'Message is required and must be at least 5 characters long.' });
        }

        const newNewsItem = new ScrollingNews({
            message: message.trim()
        });

        await newNewsItem.save();
        res.status(201).json({ message: 'News item added successfully!', newsItem: newNewsItem });
    } catch (error) {
        console.error('Error adding news item:', error);
        res.status(500).json({ message: 'Server error while adding news item.' });
    }
});

// PATCH/PUT to update an existing scrolling news item
app.patch('/admin/update-scrolling-news-item/:id', isAdminAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body;

        if (!message || message.trim().length < 5) {
             return res.status(400).json({ message: 'Message is required and must be at least 5 characters long.' });
        }

        const updatedNewsItem = await ScrollingNews.findByIdAndUpdate(
            id, { message: message.trim() }, { new: true, runValidators: true }
        );

        if (!updatedNewsItem) {
            return res.status(404).json({ message: 'News item not found' });
        }
        res.status(200).json({ message: 'News item updated successfully!', newsItem: updatedNewsItem });
    } catch (error) {
        console.error('Error updating news item:', error);
        res.status(500).json({ message: 'Server error while updating news item.' });
    }
});

// DELETE a scrolling news item
app.delete('/admin/delete-scrolling-news-item/:id', isAdminAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const deletedNewsItem = await ScrollingNews.findByIdAndDelete(id);

        if (!deletedNewsItem) {
            return res.status(404).json({ message: 'News item not found' });
        }
        res.status(200).json({ message: 'News item deleted successfully!', newsItem: deletedNewsItem });
    } catch (error) {
        console.error('Error deleting news item:', error);
        res.status(500).json({ message: 'Server error while deleting news item.' });
    }
});






app.get('/api/get-active-scrolling-news', async (req, res) => {
    try {
        const activeNews = await ScrollingNews.find({}).sort({ createdAt: -1 });
        res.status(200).json(activeNews);
    } catch (error) {
        console.error('Error fetching active scrolling news for homepage:', error);
        res.status(500).json({ message: 'Server error while fetching news.' });
    }
});