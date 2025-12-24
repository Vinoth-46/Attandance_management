// Socket.io Handler for Real-time Updates
const AttendanceSession = require('./models/AttendanceSession');
const Attendance = require('./models/Attendance');
const User = require('./models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_change_this_in_production';

// Track connected sockets by user ID for single-session enforcement
const connectedUsers = new Map(); // Map<userId, {socketId, sessionToken}>

const initializeSocket = (io) => {
    // Middleware for authentication
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            socket.user = decoded;
            next();
        } catch (err) {
            return next(new Error('Authentication error'));
        }
    });

    io.on('connection', async (socket) => {
        console.log(`User connected: ${socket.user.id} (${socket.user.role})`);

        const userId = socket.user.id;
        const incomingSessionToken = socket.user.sessionToken;

        // Single-session enforcement: Check if this is a valid session
        try {
            const user = await User.findById(userId).select('sessionToken');

            if (user && user.sessionToken) {
                // Check if there's an existing connection with a different session token
                const existingConnection = connectedUsers.get(userId);

                if (existingConnection && existingConnection.sessionToken !== incomingSessionToken) {
                    // Old session detected - force logout the old socket
                    const oldSocket = io.sockets.sockets.get(existingConnection.socketId);
                    if (oldSocket) {
                        console.log(`Force logout old session for user: ${userId}`);
                        oldSocket.emit('force_logout', {
                            message: 'You have been logged out because you logged in from another device.'
                        });
                        oldSocket.disconnect(true);
                    }
                }

                // Validate incoming session token matches the one in DB
                if (incomingSessionToken !== user.sessionToken) {
                    // This socket has an outdated token - it should be logged out
                    console.log(`Invalid session token for user: ${userId}`);
                    socket.emit('force_logout', {
                        message: 'Your session has expired. Please login again.'
                    });
                    socket.disconnect(true);
                    return;
                }
            }

            // Register this connection
            connectedUsers.set(userId, {
                socketId: socket.id,
                sessionToken: incomingSessionToken
            });
        } catch (err) {
            console.error('Session validation error:', err);
        }

        // Join rooms based on role and class
        if (socket.user.role === 'student') {
            // Students join their own room
            socket.join(`student:${socket.user.id}`);
            // Join class room for session updates
            if (socket.user.department && socket.user.year) {
                socket.join(`class:${socket.user.department}:${socket.user.year}:${socket.user.section || 'all'}`);
            }
        } else if (['staff', 'admin', 'superadmin'].includes(socket.user.role)) {
            // Staff joins staff room
            socket.join('staff');

            // Faculty advisors join their class room
            if (socket.user.isFacultyAdvisor && socket.user.advisorClass) {
                const { department, year, section } = socket.user.advisorClass;
                socket.join(`class:${department}:${year}:${section || 'all'}`);
            }
        }

        // Handle session start event
        socket.on('session:start', async (sessionData) => {
            const { department, year, section } = sessionData;

            // Notify all students in the class
            io.to(`class:${department}:${year}:${section || 'all'}`).emit('session:started', {
                message: 'Attendance session started!',
                session: sessionData
            });

            // Notify all staff
            io.to('staff').emit('session:started', sessionData);
        });

        // Handle session close event
        socket.on('session:close', async (sessionId) => {
            const session = await AttendanceSession.findById(sessionId);
            if (session) {
                const { department, year, section } = session;

                io.to(`class:${department}:${year}:${section || 'all'}`).emit('session:closed', {
                    message: 'Attendance session closed',
                    sessionId
                });

                io.to('staff').emit('session:closed', { sessionId });
            }
        });

        // Handle attendance marked event
        socket.on('attendance:marked', async (data) => {
            const { studentId, sessionId, status } = data;

            // Notify staff about the attendance
            io.to('staff').emit('attendance:update', {
                studentId,
                sessionId,
                status,
                time: new Date()
            });
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.user.id}`);
            // Clean up from connectedUsers map
            const existingConnection = connectedUsers.get(socket.user.id);
            if (existingConnection && existingConnection.socketId === socket.id) {
                connectedUsers.delete(socket.user.id);
            }
        });
    });

    return io;
};

// Helper function to emit attendance events from controllers
const emitAttendanceUpdate = (io, data) => {
    if (io) {
        io.to('staff').emit('attendance:update', data);

        // Also emit to the specific student
        if (data.studentId) {
            io.to(`student:${data.studentId}`).emit('attendance:marked', {
                message: 'Your attendance has been marked!',
                ...data
            });
        }
    }
};

// Helper function to emit session events
const emitSessionEvent = (io, eventType, session) => {
    if (io && session) {
        const room = `class:${session.department}:${session.year}:${session.section || 'all'}`;

        io.to(room).emit(`session:${eventType}`, session);
        io.to('staff').emit(`session:${eventType}`, session);
    }
};

module.exports = { initializeSocket, emitAttendanceUpdate, emitSessionEvent };
