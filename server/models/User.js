const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    role: { type: String, enum: ['student', 'staff', 'hod', 'admin', 'superadmin'], required: true },
    password: { type: String, required: true }, // For student: DOB (hashed), For staff: chosen password

    // Student Specific Fields
    rollNumber: { type: String, unique: true, sparse: true },
    registerNumber: { type: String, unique: true, sparse: true }, // University registration number
    department: { type: String },
    year: { type: String },
    section: { type: String },
    dob: { type: Date },
    parentPhone: { type: String },
    profilePhoto: { type: String }, // Base64 or URL
    faceEmbedding: { type: [Number], default: [] },
    isProfileComplete: { type: Boolean, default: false }, // True after student fills bio data + face photo

    // Bio Data Fields
    address: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    bloodGroup: { type: String },
    fatherName: { type: String },
    motherName: { type: String },
    emergencyContact: { type: String },

    // Permissions
    canEditProfile: { type: Boolean, default: false }, // Admin controls if student can edit their profile

    // Staff Specific Fields
    staffId: { type: String, unique: true, sparse: true },

    // HOD Specific Fields
    assignedDepartment: { type: String }, // Department the HOD manages

    // Hierarchical Relationship
    managedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // HOD who manages this staff member

    // Faculty Advisor Fields
    isFacultyAdvisor: { type: Boolean, default: false },
    advisorClass: {
        department: { type: String },
        year: { type: String },
        section: { type: String }
    },

    isActive: { type: Boolean, default: true },
    sessionToken: { type: String, default: null }, // For single-device login enforcement
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
userSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('User', userSchema);
