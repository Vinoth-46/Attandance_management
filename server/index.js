require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('mongo-sanitize');

const app = express();
// Trust proxy is required for rate limiting behind a proxy (Render/Heroku/Nginx)
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

// ===== SECURITY: Validate critical environment variables =====
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    console.error('FATAL ERROR: JWT_SECRET must be set in production!');
    process.exit(1);
}

// ===== SECURITY: Helmet for HTTP security headers =====
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow images/resources
    contentSecurityPolicy: false // Disable CSP for now (can be configured later)
}));

// ===== SECURITY: Rate Limiting =====
// General API rate limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Limit each IP to 200 requests per window
    message: { message: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Stricter rate limiter for authentication endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Only 10 login attempts per 15 minutes
    message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ===== Middleware - Increase JSON body limit for base64 images =====
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ===== SECURITY: NoSQL Injection Prevention =====
app.use((req, res, next) => {
    if (req.body) req.body = mongoSanitize(req.body);
    if (req.query) req.query = mongoSanitize(req.query);
    if (req.params) req.params = mongoSanitize(req.params);
    next();
});

// ===== CORS Configuration =====
// In production, set ALLOWED_ORIGINS env variable (comma-separated)
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['*']; // Allow all in development

app.use(cors({
    origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// ===== Apply Rate Limiters =====
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/attendance_system';

// Auto-seed function for first run (when Shell is not available)
const autoSeed = async () => {
    const User = require('./models/User');
    const bcrypt = require('bcryptjs');

    const userCount = await User.countDocuments();
    if (userCount > 0) {
        console.log('Database already has users, skipping auto-seed');
        return;
    }

    console.log('🌱 Auto-seeding database with default users...');
    const hashedPassword = await bcrypt.hash('password123', 10);
    const hashedStudentPassword = await bcrypt.hash('01-01-2005', 10);

    try {
        // Create default users
        await User.create([
            {
                name: 'Principal',
                email: 'principal@college.edu',
                password: hashedPassword,
                role: 'superadmin',
                department: 'Administration'
            },
            {
                name: 'Dr. HOD',
                email: 'hod@college.edu',
                staffId: 'hod',
                password: hashedPassword,
                role: 'hod',
                department: 'Computer Science',
                assignedDepartment: 'Computer Science'
            },
            {
                name: 'Staff User',
                email: 'staff@college.edu',
                staffId: 'staff',
                password: hashedPassword,
                role: 'staff',
                department: 'Computer Science',
                isFacultyAdvisor: true,
                advisorClass: { department: 'Computer Science', year: '2', section: 'A' }
            },
            {
                name: 'Student User',
                email: 'student@college.edu',
                rollNumber: '1',
                password: hashedStudentPassword,
                role: 'student',
                department: 'Computer Science',
                year: '2',
                section: 'A',
                dob: new Date('2005-01-01'),
                canEditProfile: true
            }
        ]);
        console.log('✅ Auto-seed complete! Default users created.');
        console.log('   Principal: principal@college.edu / password123');
        console.log('   HOD: hod / password123');
        console.log('   Staff: staff / password123');
        console.log('   Student: 1 / 01-01-2005');
    } catch (error) {
        console.error('Auto-seed error:', error.message);
    }
};

// Database Connection
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(async () => {
        console.log('MongoDB Connected');
        await autoSeed();
    })
    .catch(err => console.error('MongoDB Connection Error:', err));

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const hodRoutes = require('./routes/hodRoutes');
const zoneRoutes = require('./routes/zoneRoutes');
const reportRoutes = require('./routes/reportRoutes');
const qrRoutes = require('./routes/qrRoutes');
const studentRoutes = require('./routes/studentRoutes');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/hod', hodRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/students', studentRoutes);

// ===== SECURITY: Global Error Handler (hide stack traces in production) =====
app.use((err, req, res, next) => {
    console.error(err.stack);
    if (process.env.NODE_ENV === 'production') {
        res.status(500).json({ message: 'Internal server error' });
    } else {
        res.status(500).json({ message: err.message, stack: err.stack });
    }
});

// ===== PRODUCTION: Serve Frontend Static Files =====
const path = require('path');

if (process.env.NODE_ENV === 'production') {
    // Serve static files from the React app build
    app.use(express.static(path.join(__dirname, '../client/dist')));

    // Handle React routing - return index.html for all non-API routes
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../client/dist/index.html'));
    });
} else {
    app.get('/', (req, res) => {
        res.send('Attendance System API is running');
    });
}

// Socket.io Setup
const http = require('http');
const { Server } = require('socket.io');
const { initializeSocket } = require('./socketHandler');

const server = http.createServer(app);

// Get allowed origins for Socket.io
const getSocketOrigins = () => {
    if (process.env.CLIENT_URL) {
        return [process.env.CLIENT_URL];
    }
    if (process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS !== '*') {
        return process.env.ALLOWED_ORIGINS.split(',');
    }
    return '*';
};

const io = new Server(server, {
    cors: {
        origin: getSocketOrigins(),
        methods: ['GET', 'POST']
    }
});

// Initialize socket handlers
initializeSocket(io);

// Export io for use in controllers
app.set('io', io);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} with WebSocket support`);
    if (process.env.NODE_ENV === 'production') {
        console.log('Serving frontend from /client/dist');
    }
});
