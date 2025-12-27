const AttendanceSession = require('../models/AttendanceSession');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

// QR token refresh interval (30 seconds)
const QR_REFRESH_INTERVAL = 30 * 1000;

// @desc    Generate/Refresh QR code for a session
// @route   POST /api/sessions/:sessionId/qr/generate
// @access  Staff/Admin
const generateQRCode = async (req, res) => {
    const { sessionId } = req.params;

    try {
        const session = await AttendanceSession.findById(sessionId);

        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        if (session.status !== 'active') {
            return res.status(400).json({ message: 'Session is not active' });
        }

        // Generate new token
        const qrToken = uuidv4();
        const qrExpiresAt = new Date(Date.now() + QR_REFRESH_INTERVAL);

        // Update session with new token
        session.qrToken = qrToken;
        session.qrExpiresAt = qrExpiresAt;
        session.qrEnabled = true;
        await session.save();

        // Generate QR code data URL
        const qrData = JSON.stringify({
            sessionId: session._id,
            token: qrToken,
            expiresAt: qrExpiresAt.getTime()
        });

        const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });

        res.json({
            qrCode: qrCodeDataUrl,
            token: qrToken,
            expiresAt: qrExpiresAt,
            refreshIn: QR_REFRESH_INTERVAL / 1000
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Verify QR code and mark attendance
// @route   POST /api/sessions/qr/verify
// @access  Student
const verifyQRAndMarkAttendance = async (req, res) => {
    const { qrData, faceDescriptor, capturedPhoto, location, livenessScore } = req.body;
    // qrData: { sessionId, token }

    if (!qrData || !qrData.token) {
        return res.status(400).json({ message: 'QR code data required' });
    }

    try {
        const student = await User.findById(req.user.id);
        if (!student || student.role !== 'student') {
            return res.status(403).json({ message: 'Only students can mark attendance' });
        }

        // Find session by token
        const session = await AttendanceSession.findOne({
            _id: qrData.sessionId,
            qrToken: qrData.token,
            status: 'active'
        });

        if (!session) {
            return res.status(400).json({ message: 'Invalid or expired QR code' });
        }

        // Check if QR token has expired
        if (new Date() > session.qrExpiresAt) {
            return res.status(400).json({ message: 'QR code has expired. Please scan the new code.' });
        }

        // Check if student belongs to this session's class
        if (student.department !== session.department ||
            student.year !== session.year ||
            (session.section && student.section !== session.section)) {
            return res.status(400).json({ message: 'This session is not for your class' });
        }

        // If face verification is required OR provided as a fallback
        if (session.requiresFaceVerification || faceDescriptor) {
            if (!faceDescriptor) {
                return res.status(400).json({ message: 'Face verification required for this session' });
            }

            const storedFace = student.faceEmbedding;
            if (!storedFace || storedFace.length === 0) {
                return res.status(400).json({ message: 'Face not registered. Contact Admin.' });
            }

            // Calculate Euclidean distance
            const getEuclideanDistance = (arr1, arr2) => {
                if (arr1.length !== arr2.length) return Infinity;
                let sum = 0;
                for (let i = 0; i < arr1.length; i++) {
                    sum += Math.pow(arr1[i] - arr2[i], 2);
                }
                return Math.sqrt(sum);
            };

            const distance = getEuclideanDistance(Object.values(faceDescriptor), storedFace);

            if (distance > 0.45) {
                return res.status(401).json({ message: 'Face verification failed', distance });
            }

            // Check liveness
            if (livenessScore !== undefined && livenessScore < 0.8) {
                return res.status(400).json({
                    message: 'Liveness check failed',
                    livenessScore
                });
            }
        }

        // Check geofencing if enabled
        if (session.location && session.location.latitude) {
            // Bypass geofencing if QR + Face verification is performed
            // (Successfully scanning a dynamic QR code already proves physical presence)
            if (faceDescriptor) {
                console.log(`Geofencing bypass allowed for ${req.user.name} via QR + Face`);
            } else {
                if (!location || !location.latitude || !location.longitude) {
                    return res.status(400).json({ message: 'Location required for this session' });
                }

                const getDistanceFromLatLonInM = (lat1, lon1, lat2, lon2) => {
                    const R = 6371000;
                    const dLat = (lat2 - lat1) * Math.PI / 180;
                    const dLon = (lon2 - lon1) * Math.PI / 180;
                    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                        Math.sin(dLon / 2) * Math.sin(dLon / 2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    return R * c;
                };

                const distance = getDistanceFromLatLonInM(
                    session.location.latitude,
                    session.location.longitude,
                    location.latitude,
                    location.longitude
                );

                if (distance > session.location.radius) {
                    return res.status(400).json({
                        message: `You are too far from the class. Distance: ${Math.round(distance)}m. If GPS is inaccurate, use QR Fallback.`
                    });
                }
            }
        }

        // Check if already marked attendance today for this period
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const existingAttendance = await Attendance.findOne({
            student: req.user.id,
            date: { $gte: startOfDay, $lte: endOfDay },
            period: session.period
        });

        if (existingAttendance) {
            return res.status(400).json({ message: 'Attendance already marked for this period' });
        }

        // Create attendance record
        const attendance = await Attendance.create({
            student: req.user.id,
            date: startOfDay,
            time: new Date(),
            period: session.period,
            status: 'Present',
            capturedPhoto: capturedPhoto || null,
            livenessScore: livenessScore || null,
            verified: true,
            isManual: false
        });

        // Emit socket event for real-time update
        const io = req.app.get('io');
        if (io) {
            io.to('staff').emit('attendance:update', {
                studentId: student._id,
                studentName: student.name,
                sessionId: session._id,
                status: 'Present',
                time: new Date()
            });
        }

        res.status(201).json({
            message: 'Attendance marked successfully via QR code!',
            attendance
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get QR session status
// @route   GET /api/sessions/:sessionId/qr/status
// @access  Staff/Admin
const getQRStatus = async (req, res) => {
    const { sessionId } = req.params;

    try {
        const session = await AttendanceSession.findById(sessionId);

        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        const isExpired = session.qrExpiresAt ? new Date() > session.qrExpiresAt : true;

        res.json({
            qrEnabled: session.qrEnabled,
            requiresFaceVerification: session.requiresFaceVerification,
            qrExpiresAt: session.qrExpiresAt,
            isExpired,
            timeRemaining: isExpired ? 0 : Math.max(0, session.qrExpiresAt - Date.now())
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Toggle QR mode for session
// @route   PUT /api/sessions/:sessionId/qr/toggle
// @access  Staff/Admin
const toggleQRMode = async (req, res) => {
    const { sessionId } = req.params;
    const { requiresFaceVerification } = req.body;

    try {
        const session = await AttendanceSession.findById(sessionId);

        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        session.qrEnabled = !session.qrEnabled;

        if (requiresFaceVerification !== undefined) {
            session.requiresFaceVerification = requiresFaceVerification;
        }

        await session.save();

        res.json({
            message: `QR mode ${session.qrEnabled ? 'enabled' : 'disabled'}`,
            qrEnabled: session.qrEnabled,
            requiresFaceVerification: session.requiresFaceVerification
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    generateQRCode,
    verifyQRAndMarkAttendance,
    getQRStatus,
    toggleQRMode
};
