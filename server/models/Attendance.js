const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    time: { type: Date, default: Date.now },
    period: { type: String }, // Period name/number (e.g., "Period 1", "Morning", etc.)
    status: { type: String, enum: ['Present', 'Absent', 'Leave', 'Half Day'], default: 'Present' },
    capturedPhoto: { type: String },
    livenessScore: { type: Number },
    verified: { type: Boolean, default: false },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isManual: { type: Boolean, default: false },
}, {
    timestamps: true
});

// Allow multiple attendance records per student per day (different periods)
attendanceSchema.index({ student: 1, date: 1, period: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
