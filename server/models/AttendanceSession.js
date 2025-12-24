const mongoose = require('mongoose');

const attendanceSessionSchema = new mongoose.Schema({
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    department: { type: String, required: true },
    year: { type: String, required: true },
    section: { type: String },
    period: { type: String, required: true },
    startTime: { type: Date, required: true, default: Date.now },
    endTime: { type: Date, required: true },
    status: { type: String, enum: ['active', 'closed'], default: 'active' },
    location: {
        latitude: { type: Number },
        longitude: { type: Number },
        radius: { type: Number, default: 50 },
        name: { type: String }
    },
    // QR Code fields
    qrEnabled: { type: Boolean, default: false },
    qrToken: { type: String }, // Dynamic token that refreshes every 30 seconds
    qrExpiresAt: { type: Date }, // When current QR token expires
    requiresFaceVerification: { type: Boolean, default: false } // QR + Face verification
}, {
    timestamps: true
});

// Index for quick lookups
attendanceSessionSchema.index({ department: 1, year: 1, section: 1, status: 1 });
attendanceSessionSchema.index({ qrToken: 1 });

module.exports = mongoose.model('AttendanceSession', attendanceSessionSchema);
