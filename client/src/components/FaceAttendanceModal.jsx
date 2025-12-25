import { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function FaceAttendanceModal({ onClose, onSuccess }) {
    const webcamRef = useRef(null);
    const intervalRef = useRef(null);
    const phaseRef = useRef('loading');

    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('Loading face detection...');
    const [phase, setPhase] = useState('loading'); // loading, ready, blink, left, right, capture, verifying
    const [checks, setChecks] = useState({ blink: false, left: false, right: false });
    const [showQRFallback, setShowQRFallback] = useState(false);

    // Liveness tracking refs
    const lastEarRef = useRef(0.3);
    const blinkStartRef = useRef(false);
    const descriptorRef = useRef(null);
    const photoRef = useRef(null);

    useEffect(() => {
        let cancelled = false;

        const loadModels = async () => {
            const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

            try {
                await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
                await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
                await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

                if (!cancelled) {
                    setStatus('Tap "Start" to begin liveness check');
                    setPhase('ready');
                    phaseRef.current = 'ready';
                    setLoading(false);
                }
            } catch (err) {
                console.error('Model load error:', err);
                if (!cancelled) setStatus('Failed to load. Please refresh.');
            }
        };

        loadModels();
        return () => { cancelled = true; clearInterval(intervalRef.current); };
    }, []);

    // Calculate Eye Aspect Ratio for blink detection
    const getEAR = (landmarks) => {
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();

        const eyeAR = (eye) => {
            const width = Math.hypot(eye[3].x - eye[0].x, eye[3].y - eye[0].y);
            const h1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
            const h2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
            return (h1 + h2) / (2 * width);
        };

        return (eyeAR(leftEye) + eyeAR(rightEye)) / 2;
    };

    // Calculate head turn direction
    const getHeadTurn = (landmarks) => {
        const nose = landmarks.getNose();
        const jaw = landmarks.getJawOutline();

        const faceLeft = jaw[0].x;
        const faceRight = jaw[16].x;
        const faceCenter = (faceLeft + faceRight) / 2;
        const noseTip = nose[6].x;

        return (noseTip - faceCenter) / ((faceRight - faceLeft) / 2);
    };

    const startLivenessCheck = () => {
        setPhase('blink');
        phaseRef.current = 'blink';
        setStatus('👁️ BLINK your eyes');
        setChecks({ blink: false, left: false, right: false });

        intervalRef.current = setInterval(async () => {
            if (!webcamRef.current) return;

            try {
                const screenshot = webcamRef.current.getScreenshot();
                if (!screenshot) return;

                const img = await faceapi.fetchImage(screenshot);
                const detection = await faceapi
                    .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                if (!detection) return;

                // Store latest descriptor
                descriptorRef.current = detection.descriptor;
                photoRef.current = screenshot;

                const ear = getEAR(detection.landmarks);
                const turn = getHeadTurn(detection.landmarks);

                const currentPhase = phaseRef.current;

                // Blink detection
                if (currentPhase === 'blink') {
                    if (lastEarRef.current > 0.2 && ear < 0.18) {
                        blinkStartRef.current = true;
                    }
                    if (blinkStartRef.current && ear > 0.22) {
                        // Blink completed
                        setChecks(c => ({ ...c, blink: true }));
                        setPhase('left');
                        phaseRef.current = 'left';
                        setStatus('👈 Turn head LEFT');
                        blinkStartRef.current = false;
                    }
                    lastEarRef.current = ear;
                }
                // Left turn detection
                else if (currentPhase === 'left') {
                    if (turn < -0.15) {
                        setChecks(c => ({ ...c, left: true }));
                        setPhase('right');
                        phaseRef.current = 'right';
                        setStatus('👉 Turn head RIGHT');
                    }
                }
                // Right turn detection
                else if (currentPhase === 'right') {
                    if (turn > 0.15) {
                        setChecks(c => ({ ...c, right: true }));
                        clearInterval(intervalRef.current);
                        setPhase('capture');
                        phaseRef.current = 'capture';
                        setStatus('✅ Liveness verified! Capturing...');

                        // Capture final photo with face centered
                        setTimeout(() => captureAndSubmit(), 500);
                    }
                }
            } catch (err) {
                console.error('Detection error:', err);
            }
        }, 150);

        // Timeout after 30 seconds
        setTimeout(() => {
            if (phaseRef.current !== 'capture' && phaseRef.current !== 'verifying') {
                clearInterval(intervalRef.current);
                setStatus('⏱️ Timeout. Please try again.');
                setPhase('ready');
                phaseRef.current = 'ready';
            }
        }, 30000);
    };

    const captureAndSubmit = async () => {
        setPhase('verifying');
        phaseRef.current = 'verifying';
        setStatus('📍 Getting location...');

        try {
            const location = await new Promise((resolve, reject) => {
                if (!navigator.geolocation) reject(new Error('No GPS'));
                navigator.geolocation.getCurrentPosition(
                    (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                    (err) => reject(err),
                    { enableHighAccuracy: true, timeout: 10000 }
                );
            });

            setStatus('✅ Submitting attendance...');

            await api.post('/attendance/mark', {
                faceDescriptor: Array.from(descriptorRef.current),
                capturedPhoto: photoRef.current,
                location,
                livenessScore: 1.0 // Passed all liveness checks
            });

            toast.success('✅ Attendance marked!');
            setStatus('✅ Success!');
            setTimeout(() => { onSuccess(); onClose(); }, 1500);

        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed';

            if (msg.includes('far') || msg.includes('location') || msg.includes('zone') || msg.includes('GPS') || msg.includes('Geolocation')) {
                setStatus('📍 ' + msg);
                setShowQRFallback(true);
            } else {
                setStatus('❌ ' + msg);
                toast.error(msg);
            }
            setPhase('ready');
            phaseRef.current = 'ready';
        }
    };

    const goToQR = () => {
        onClose();
        window.location.href = '/student/dashboard?action=scan-qr';
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5">
                <h2 className="text-lg font-bold text-center mb-3 text-gray-800">📸 Face Attendance</h2>

                {/* Webcam */}
                <div className="relative aspect-[4/3] bg-gray-900 rounded-lg overflow-hidden mb-3">
                    {loading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800">
                            <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent mb-3"></div>
                            <p className="text-white text-sm">{status}</p>
                        </div>
                    ) : (
                        <>
                            <Webcam
                                audio={false}
                                ref={webcamRef}
                                screenshotFormat="image/jpeg"
                                className="w-full h-full object-cover"
                                videoConstraints={{ facingMode: 'user', width: 480, height: 360 }}
                                mirrored={true}
                            />

                            {/* Liveness indicators */}
                            {(phase === 'blink' || phase === 'left' || phase === 'right') && (
                                <div className="absolute top-2 left-0 right-0 flex justify-center gap-2">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${checks.blink ? 'bg-green-500 text-white' : phase === 'blink' ? 'bg-yellow-400 animate-pulse' : 'bg-gray-400'}`}>
                                        👁️ {checks.blink ? '✓' : 'Blink'}
                                    </span>
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${checks.left ? 'bg-green-500 text-white' : phase === 'left' ? 'bg-yellow-400 animate-pulse' : 'bg-gray-400'}`}>
                                        👈 {checks.left ? '✓' : 'Left'}
                                    </span>
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${checks.right ? 'bg-green-500 text-white' : phase === 'right' ? 'bg-yellow-400 animate-pulse' : 'bg-gray-400'}`}>
                                        👉 {checks.right ? '✓' : 'Right'}
                                    </span>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Status */}
                <p className={`text-center font-semibold mb-4 ${status.includes('❌') || status.includes('Timeout') ? 'text-red-600'
                        : status.includes('✅') ? 'text-green-600'
                            : status.includes('📍') ? 'text-orange-500'
                                : 'text-indigo-600'
                    }`}>
                    {status}
                </p>

                {/* QR Fallback - Only for GPS issues */}
                {showQRFallback && (
                    <button onClick={goToQR} className="w-full mb-3 py-2.5 bg-purple-600 text-white rounded-lg font-medium">
                        📷 Use QR Code (GPS issue)
                    </button>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">
                        Cancel
                    </button>

                    {phase === 'ready' && (
                        <button onClick={startLivenessCheck} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-500">
                            ▶️ Start
                        </button>
                    )}
                </div>

                {phase === 'ready' && !loading && (
                    <p className="text-xs text-gray-400 text-center mt-3">
                        You'll need to: Blink → Turn Left → Turn Right
                    </p>
                )}
            </div>
        </div>
    );
}
