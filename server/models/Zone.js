const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    latitude: {
        type: Number,
        required: true
    },
    longitude: {
        type: Number,
        required: true
    },
    radius: {
        type: Number,
        required: true,
        default: 50 // meters
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true });

// Compound index for uniqueness per staff
zoneSchema.index({ name: 1, createdBy: 1 }, { unique: true });

module.exports = mongoose.model('Zone', zoneSchema);
