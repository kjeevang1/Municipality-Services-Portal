// models/ScrollingNews.js
const mongoose = require('mongoose');

const scrollingNewsSchema = new mongoose.Schema({
    message: {
        type: String,
        required: true,
        trim: true,
        minlength: 5 // Still a good idea to ensure a minimum length
    }
}, { timestamps: true }); // `timestamps: true` will automatically add `createdAt` (for display) and `updatedAt`

module.exports = mongoose.model('ScrollingNews', scrollingNewsSchema);