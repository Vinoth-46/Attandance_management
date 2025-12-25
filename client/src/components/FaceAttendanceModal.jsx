import { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import api from '../services/api';

export default function FaceAttendanceModal({ onClose, onSuccess }) {
    const webcamRef = useRef(null);
    const detectionIntervalRef = useRef(null);
    const phaseRef = useRef('ready');
    const checksRef = useRef({ blink: false, left: false, right: false });
    const lastEarRef = useRef(0.3);
    const descriptorRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('Loading models...');
    const [verifying, setVerifying] = useState(false);
    const [showQRFallback, setShowQRFallback] = useState(false);
    const [checks, setChecks] = useState({ blink: false, left: false, right: false });
    const [phase, setPhase] = useState('ready');

    useEffect(() => {
        const loadModels = async () => {
            const MODEL_URL = '/models';
            try {
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                    faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
                ]);
                setStatus('Press "Start" and follow the instructions');
                setLoading(false);
            } catch (err) {
                console.error(err);
                setStatus('Failed to load face models.');
            }
        };
        loadModels();

        return () => {
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
            }
        };
    }, []);

    // Calculate Eye Aspect Ratio for blink detection
    const calculateEAR = (landmarks) => {
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();

        const eyeAR = (eye) => {
            const width = Math.hypot(eye[3].x - eye[0].x, eye[3].y - eye[0].y);
            const height1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
            const height2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
            return (height1 + height2) / (2.0 * width);
        };

        return (eyeAR(leftEye) + eyeAR(rightEye)) / 2;
    };

    // Calculate head pose from landmarks
    const calculateHeadPose = (landmarks) => {
        const nose = landmarks.getNose();
        const jawOutline = landmarks.getJawOutline();

        const faceLeft = jawOutline[0].x;
        const faceRight = jawOutline[16].x;
        const faceCenter = (faceLeft + faceRight) / 2;
        const noseTip = nose[6];
        const noseOffset = noseTip.x - faceCenter;
        const faceWidth = faceRight - faceLeft;

        return noseOffset / (faceWidth / 2);
    };

    const updatePhase = (newPhase, message) => {
        phaseRef.current = newPhase;
        setPhase(newPhase);
        setStatus(message);
    };

    const updateChecks = (key) => {
        checksRef.current = { ...checksRef.current, [key]: true };
        setChecks({ ...checksRef.current });
    };

    const startLivenessCheck = async () => {
        setVerifying(true);
        checksRef.current = { blink: false, left: false, right: false };
        setChecks({ blink: false, left: false, right: false });
        updatePhase('blink', '👁️ Please BLINK your eyes');

        detectionIntervalRef.current = setInterval(async () => {
            if (!webcamRef.current) return;

            try {
                const imageSrc = webcamRef.current.getScreenshot();
                if (!imageSrc) return;

                const img = await faceapi.fetchImage(imageSrc);
                const detection = await faceapi
                    .detectSingleFace(img)
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                if (!detection) return;

                // Store descriptor
                if (!descriptorRef.current) {
                    descriptorRef.current = detection.descriptor;
                }

                const ear = calculateEAR(detection.landmarks);
                const headPose = calculateHeadPose(detection.landmarks);

                // Phase: Blink detection
                if (phaseRef.current === 'blink') {
                    if (lastEarRef.current > 0.22 && ear < 0.18) {
                        updateChecks('blink');
                        updatePhase('left', '👈 Turn your head LEFT');
                    }
                    lastEarRef.current = ear;
                }
                // Phase: Left turn detection
                else if (phaseRef.current === 'left') {
                    if (headPose < -0.15) {
                        updateChecks('left');
                        updatePhase('right', '👉 Turn your head RIGHT');
                    }
                }
                // Phase: Right turn detection
                else if (phaseRef.current === 'right') {
                    if (headPose > 0.15) {
                        updateChecks('right');
                        updatePhase('done', '✅ Verified! Submitting...');
                        clearInterval(detectionIntervalRef.current);
                        submitAttendance();
                    }
                }
            } catch (err) {
                console.error('Detection error:', err);
            }
        }, 150);

        // Timeout after 20 seconds
        setTimeout(() => {
            if (phaseRef.current !== 'done') {
                clearInterval(detectionIntervalRef.current);
                setStatus('⏱️ Timeout - Please try again');
                setVerifying(false);
                updatePhase('ready', '⏱️ Timeout - Please try again');
            }
        }, 20000);
    };

    const submitAttendance = async () => {
        try {
            const location = await new Promise((resolve) => {
                if (!navigator.geolocation) resolve(null);
                else {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                        () => resolve(null)
                    );
                }
            });

            const captureImage = webcamRef.current.getScreenshot();

            await api.post('/attendance/mark', {
                faceDescriptor: Array.from(descriptorRef.current),
                capturedPhoto: captureImage,
                location,
                livenessScore: 1.0
            });

            setStatus('✅ Attendance Marked Successfully!');
            setTimeout(() => { onSuccess(); onClose(); }, 2000);
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed';
            if (msg.toLowerCase().includes('far') || msg.toLowerCase().includes('location')) {
                setShowQRFallback(true);
            }
            setStatus(msg);
            setVerifying(false);
            updatePhase('ready', msg);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
                <h2 className="text-xl font-bold text-center mb-4 text-gray-800">Mark Attendance</h2>

                <div className="relative aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
                    {loading ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : (
                        <>
                            <Webcam
                                audio={false}
                                ref={webcamRef}
                                screenshotFormat="image/jpeg"
                                className="absolute inset-0 w-full h-full object-cover"
                                mirrored={true}
                            />

                            {/* Phase indicators */}
                            {verifying && (
                                <div className="absolute top-3 left-0 right-0 flex justify-center gap-2">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${checks.blink ? 'bg-green-500 text-white' : phase === 'blink' ? 'bg-yellow-400 text-gray-800 animate-pulse' : 'bg-gray-300'
                                        }`}>
                                        👁️ {checks.blink ? '✓' : 'Blink'}
                                    </span>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${checks.left ? 'bg-green-500 text-white' : phase === 'left' ? 'bg-yellow-400 text-gray-800 animate-pulse' : 'bg-gray-300'
                                        }`}>
                                        👈 {checks.left ? '✓' : 'Left'}
                                    </span>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${checks.right ? 'bg-green-500 text-white' : phase === 'right' ? 'bg-yellow-400 text-gray-800 animate-pulse' : 'bg-gray-300'
                                        }`}>
                                        👉 {checks.right ? '✓' : 'Right'}
                                    </span>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <p className={`mt-4 text-center font-semibold text-lg ${status.includes('Timeout') || status.includes('Failed') || status.includes('failed')
                        ? 'text-red-600'
                        : status.includes('✅') ? 'text-green-600' : 'text-indigo-600'
                    }`}>
                    {status}
                </p>

                {!verifying && !loading && (
                    <p className="text-sm text-gray-500 text-center mt-1">
                        Blink → Turn Left → Turn Right
                    </p>
                )}

                {showQRFallback && (
                    <div className="mt-3 bg-purple-50 border border-purple-200 rounded-lg p-3">
                        <button
                            onClick={() => { onClose(); window.location.href = '/student/dashboard?action=scan-qr'; }}
                            className="w-full px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-500"
                        >
                            📷 Use QR Code Instead
                        </button>
                    </div>
                )}

                <div className="mt-5 flex gap-3 justify-center">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
                        Cancel
                    </button>
                    <button
                        onClick={startLivenessCheck}
                        disabled={loading || verifying}
                        className={`px-6 py-2 text-sm font-semibold text-white rounded-md ${loading || verifying ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500'
                            }`}
                    >
                        {verifying ? 'Follow Instructions...' : 'Start'}
                    </button>
                </div>
            </div>
        </div>
    );
}
