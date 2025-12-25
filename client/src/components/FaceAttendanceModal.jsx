import { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function FaceAttendanceModal({ onClose, onSuccess }) {
    const webcamRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [loadProgress, setLoadProgress] = useState(0);
    const [status, setStatus] = useState('Loading face models...');
    const [phase, setPhase] = useState('loading'); // loading, ready, detecting, verifying, success
    const [showQRFallback, setShowQRFallback] = useState(false);
    const [faceDetected, setFaceDetected] = useState(false);
    const detectionRef = useRef(null);
    const checkIntervalRef = useRef(null);
    const movementCountRef = useRef(0);
    const lastPositionRef = useRef(null);

    useEffect(() => {
        let cancelled = false;

        const loadModels = async () => {
            try {
                const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

                // Load models one by one with progress
                setLoadProgress(20);
                await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
                if (cancelled) return;

                setLoadProgress(50);
                await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
                if (cancelled) return;

                setLoadProgress(80);
                await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
                if (cancelled) return;

                setLoadProgress(100);
                setStatus('Ready! Tap "Verify Face"');
                setPhase('ready');
                setLoading(false);
            } catch (err) {
                console.error('Model load error:', err);
                if (!cancelled) {
                    setStatus('Failed to load. Check internet and refresh.');
                }
            }
        };

        loadModels();
        return () => {
            cancelled = true;
            clearInterval(checkIntervalRef.current);
        };
    }, []);

    const startDetection = () => {
        setPhase('detecting');
        setStatus('� Look at camera and move slightly...');
        movementCountRef.current = 0;
        lastPositionRef.current = null;

        checkIntervalRef.current = setInterval(async () => {
            if (!webcamRef.current) return;

            try {
                const screenshot = webcamRef.current.getScreenshot();
                if (!screenshot) return;

                const img = await faceapi.fetchImage(screenshot);
                const detection = await faceapi
                    .detectSingleFace(img)
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                if (!detection) {
                    setFaceDetected(false);
                    setStatus('👀 No face detected. Look at camera.');
                    return;
                }

                setFaceDetected(true);
                detectionRef.current = { detection, screenshot };

                // Get face position
                const nose = detection.landmarks.getNose()[3];
                const currentPos = { x: nose.x, y: nose.y };

                // Check for movement (liveness)
                if (lastPositionRef.current) {
                    const dx = Math.abs(currentPos.x - lastPositionRef.current.x);
                    const dy = Math.abs(currentPos.y - lastPositionRef.current.y);

                    // Any small movement counts
                    if (dx > 2 || dy > 2) {
                        movementCountRef.current++;
                        setStatus(`🔍 Good! Keep looking... (${movementCountRef.current}/5)`);
                    }
                }

                lastPositionRef.current = currentPos;

                // Need 5 movement detections (proves it's not a static photo)
                if (movementCountRef.current >= 5) {
                    clearInterval(checkIntervalRef.current);
                    submitAttendance();
                }
            } catch (err) {
                console.error('Detection error:', err);
            }
        }, 400);

        // Timeout after 15 seconds
        setTimeout(() => {
            if (phase === 'detecting') {
                clearInterval(checkIntervalRef.current);
                setStatus('⏱️ Timeout. Try again.');
                setPhase('ready');
            }
        }, 15000);
    };

    const submitAttendance = async () => {
        if (!detectionRef.current) return;

        setPhase('verifying');
        setStatus('📍 Getting location...');

        try {
            const location = await new Promise((resolve, reject) => {
                if (!navigator.geolocation) reject(new Error('GPS not available'));
                navigator.geolocation.getCurrentPosition(
                    (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                    (err) => reject(err),
                    { enableHighAccuracy: true, timeout: 10000 }
                );
            });

            setStatus('✅ Submitting attendance...');

            await api.post('/attendance/mark', {
                faceDescriptor: Array.from(detectionRef.current.detection.descriptor),
                capturedPhoto: detectionRef.current.screenshot,
                location,
                livenessScore: 1.0
            });

            toast.success('✅ Attendance marked!');
            setStatus('✅ Success!');
            setPhase('success');
            setTimeout(() => { onSuccess(); onClose(); }, 1500);

        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed';

            if (msg.includes('far') || msg.includes('location') || msg.includes('zone') || msg.includes('GPS')) {
                setStatus('📍 ' + msg);
                setShowQRFallback(true);
            } else {
                setStatus('❌ ' + msg);
                toast.error(msg);
            }
            setPhase('ready');
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

                <div className="relative aspect-[4/3] bg-gray-900 rounded-lg overflow-hidden mb-3">
                    {loading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800">
                            <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent mb-3"></div>
                            <p className="text-white text-sm mb-2">{status}</p>
                            <div className="w-48 bg-gray-600 rounded-full h-2">
                                <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${loadProgress}%` }}></div>
                            </div>
                            <p className="text-gray-400 text-xs mt-1">{loadProgress}%</p>
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

                            {/* Face detection indicator */}
                            {phase === 'detecting' && (
                                <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold ${faceDetected ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                    {faceDetected ? '✓ Face OK' : '✗ No Face'}
                                </div>
                            )}

                            {/* Progress indicator */}
                            {phase === 'detecting' && (
                                <div className="absolute bottom-2 left-2 right-2">
                                    <div className="bg-black/60 rounded-lg p-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-white text-xs">Liveness:</span>
                                            <div className="flex-1 bg-gray-600 rounded-full h-2">
                                                <div
                                                    className="bg-green-500 h-2 rounded-full transition-all"
                                                    style={{ width: `${(movementCountRef.current / 5) * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <p className={`text-center font-semibold mb-4 ${status.includes('❌') || status.includes('Timeout') || status.includes('No face') ? 'text-red-600'
                        : status.includes('✅') || status.includes('Good') ? 'text-green-600'
                            : status.includes('📍') ? 'text-orange-500'
                                : 'text-indigo-600'
                    }`}>
                    {status}
                </p>

                {showQRFallback && (
                    <button onClick={goToQR} className="w-full mb-3 py-2.5 bg-purple-600 text-white rounded-lg font-medium">
                        📷 Use QR Code (GPS issue)
                    </button>
                )}

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">
                        Cancel
                    </button>

                    {phase === 'ready' && (
                        <button onClick={startDetection} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-500">
                            ▶️ Verify Face
                        </button>
                    )}
                </div>

                {phase === 'ready' && !loading && (
                    <p className="text-xs text-gray-400 text-center mt-3">
                        Look at camera and move your head slightly
                    </p>
                )}
            </div>
        </div>
    );
}
