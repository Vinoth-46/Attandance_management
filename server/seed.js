const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

const seed = async () => {
    try {
        const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/attendance_system';
        await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('MongoDB Connected');

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);

        // Create admin1 if not exists
        const admin1Exists = await User.findOne({ staffId: 'admin1' });
        if (!admin1Exists) {
            await User.create({
                name: 'Admin User 1',
                email: 'admin1@college.edu',
                role: 'staff',
                staffId: 'admin1',
                password: hashedPassword,
                department: 'Computer Science'
            });
            console.log('✓ admin1 created!');
        } else {
            console.log('admin1 already exists');
        }

        // Create admin2 if not exists
        const admin2Exists = await User.findOne({ staffId: 'admin2' });
        if (!admin2Exists) {
            await User.create({
                name: 'Admin User 2',
                email: 'admin2@college.edu',
                role: 'staff',
                staffId: 'admin2',
                password: hashedPassword,
                department: 'Computer Science'
            });
            console.log('✓ admin2 created!');
        } else {
            console.log('admin2 already exists');
        }

        // Create admin3 if not exists
        const admin3Exists = await User.findOne({ staffId: 'admin3' });
        if (!admin3Exists) {
            await User.create({
                name: 'Admin User 3',
                email: 'admin3@college.edu',
                role: 'staff',
                staffId: 'admin3',
                password: hashedPassword,
                department: 'Mechanical Engineering'
            });
            console.log('✓ admin3 created!');
        } else {
            console.log('admin3 already exists');
        }

        console.log('\n--- Login Credentials (Test Accounts) ---');
        console.log('Username: admin1 / Password: admin123');
        console.log('Username: admin2 / Password: admin123');
        console.log('Username: admin3 / Password: admin123');
        console.log('------------------------------------------');

        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

seed();
