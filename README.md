
# CivicConnect+ : Smart Municipality Services Portal

## Overview

**CivicConnect+** is a full-stack web portal designed to streamline communication between citizens and municipal authorities. Citizens can **submit complaints**, **request permissions for events or health camps**, and **track the status** of their requests. Administrators can manage these requests, **update statuses**, **send notifications**, and maintain records efficiently.

The platform includes **user authentication**, **file/image uploads**, and **real-time tracking**, providing a transparent and efficient experience for both citizens and admins.

---

## Features

* **User Authentication:** Secure login and registration for citizens and admins.
* **Citizen Features:** Submit complaints or requests, upload supporting images/documents, track request status.
* **Admin Features:** Manage and update requests, send notifications, maintain records.
* **Real-time Updates:** Track complaint and request statuses dynamically.
* **File Uploads:** Support for uploading images/documents using Cloudinary.

---

## Technologies Used

* **Backend:** Node.js, Express.js, REST APIs
* **Database:** MongoDB
* **Frontend:** HTML, CSS, JavaScript, Bootstrap
* **File Uploads:** Cloudinary
* **Other Tools:** NodeMailer for email notifications

---

## Prerequisites / Environment Setup

Before running the project, you need to configure some services:

### 1. MongoDB

MongoDB stores all citizen and admin data. You have two options:

* **Local MongoDB:**

  1. Install MongoDB on your computer.
  2. Start the server (`mongod`).
  3. Use the connection string in `.env`:

     ```
     MONGO_URI=mongodb://localhost:27017/civicconnect
     ```

* **MongoDB Atlas (Cloud):**

  1. Sign up at [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
  2. Create a cluster and database.
  3. Get your connection string and add it to `.env` as `MONGO_URI`.

  * This allows the app to run anywhere without local MongoDB installation.

---

### 2. Cloudinary

Cloudinary is used for image and file uploads.

1. Sign up at [https://cloudinary.com/](https://cloudinary.com/).
2. Get your **Cloud Name, API Key, and API Secret**.
3. Add them to `.env`:

   ```
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

---

### 3. Email

Email is used for notifications to citizens or admins.

* Use Gmail or another email service.
* **If using Gmail with 2FA**, create an **App Password**.
* Add credentials to `.env`:

  ```
  EMAIL_USER=your_email@example.com
  EMAIL_PASS=your_email_app_password
  ```

---

### 4. Admin Password

Admin login uses a secure hashed password instead of storing it in plain text.

* Hash your password using **bcrypt** in Node.js:

  ```javascript
  const bcrypt = require('bcrypt');
  const password = 'your_admin_password';
  const hash = await bcrypt.hash(password, 10);
  console.log(hash); // Store this hash as ADMIN_PASS_HASH in .env
  ```
* Add to `.env`:

  ```
  ADMIN_USER=admin
  ADMIN_PASS_HASH=your_hashed_password
  ```

---

## Setup and Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/civicconnect-plus.git
cd civicconnect-plus
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create `.env` File

Follow the **Prerequisites / Environment Setup** section above to configure your `.env` file.

### 4. Start the Application

```bash
npm start
```

* The app will run at `http://localhost:4000` (or the port defined in `.env`).

---

## Usage

### Citizen

1. Register and login using the portal.
2. Submit complaints or event/health camp requests.
3. Upload supporting files and track the status of requests.

### Admin

1. Login using admin credentials defined in `.env`.
2. View, update, and manage complaints/requests.
3. Send notifications and maintain records.

