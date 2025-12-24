const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('./models/User');
const AttendanceSession = require('./models/AttendanceSession');
const Attendance = require('./models/Attendance');
const Leave = require('./models/Leave');
const Zone = require('./models/Zone');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/attendance_system';

const seedDatabase = async () => {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Clear all collections
        console.log('\n🗑️  Clearing all collections...');
        await User.deleteMany({});
        await AttendanceSession.deleteMany({});
        await Attendance.deleteMany({});
        await Leave.deleteMany({});
        await Zone.deleteMany({});
        console.log('✅ All collections cleared');

        // Hash passwords
        const hashedPassword = await bcrypt.hash('password123', 10);
        const hashedStudentPassword = await bcrypt.hash('01-01-2005', 10);

        // 1. Create Super Admin (Principal)
        console.log('\n👤 Creating Super Admin (Principal)...');
        const superAdmin = await User.create({
            name: 'Principal',
            email: 'principal@college.edu',
            password: hashedPassword,
            role: 'superadmin',
            department: 'Administration',
            phone: '9876543210'
        });
        console.log(`✅ Super Admin created: ${superAdmin.email}`);

        // 2. Create One HOD
        console.log('\n👥 Creating HOD...');
        const hod = await User.create({
            name: 'Dr. HOD',
            email: 'hod@college.edu',
            staffId: 'hod',
            password: hashedPassword,
            role: 'hod',
            department: 'Computer Science',
            assignedDepartment: 'Computer Science',
            phone: '9876543211'
        });
        console.log(`✅ HOD created: ${hod.staffId}`);

        // 3. Create One Staff
        console.log('\n👨‍🏫 Creating Staff...');
        const staff = await User.create({
            name: 'Staff User',
            email: 'staff@college.edu',
            staffId: 'staff',
            password: hashedPassword,
            role: 'staff',
            department: 'Computer Science',
            phone: '9876543212',
            isFacultyAdvisor: true,
            advisorClass: {
                department: 'Computer Science',
                year: '2',
                section: 'A'
            }
        });
        console.log(`✅ Staff created: ${staff.staffId}`);

        // 4. Create One Student
        console.log('\n👨‍🎓 Creating Student...');
        const student = await User.create({
            name: 'Student User',
            email: 'student@college.edu',
            rollNumber: '1',
            password: hashedStudentPassword,
            role: 'student',
            department: 'Computer Science',
            year: '2',
            section: 'A',
            phone: '9876543213',
            dob: new Date('2005-01-01'),
            bloodGroup: 'O+',
            canEditProfile: true
        });
        console.log(`✅ Student created: Roll No ${student.rollNumber}`);

        console.log('\n✅✅✅ Database seeded successfully! ✅✅✅');
        console.log('\n📋 Login Credentials:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n🔐 Super Admin (Principal):');
        console.log('   Username: principal@college.edu');
        console.log('   Password: password123');
        console.log('\n👔 HOD:');
        console.log('   Username: hod');
        console.log('   Password: password123');
        console.log('\n👨‍🏫 Staff:');
        console.log('   Username: staff');
        console.log('   Password: password123');
        console.log('\n👨‍🎓 Student:');
        console.log('   Username: 1 (Roll Number)');
        console.log('   Password: 01-01-2005');
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        await mongoose.connection.close();
        process.exit(1);
    }
};

seedDatabase();
