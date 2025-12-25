import { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function FaceAttendanceModal({ onClose, onSuccess }) {
    const webcamRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('Loading...');
    const [phase, setPhase] = useState('loading'); // loading, ready, smile, verifying, success
    const [smileScore, setSmileScore] = useState(0);
    const [showQRFallback, setShowQRFallback] = useState(false);
    const detectionRef = useRef(null);
    const checkIntervalRef = useRef(null);

    useEffect(() => {
        let cancelled = false;

        const loadModels = async () => {
            try {
                const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
                await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
                await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
                await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
                await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);

                if (!cancelled) {
                    setStatus('Tap "Start" when ready');
                    setPhase('ready');
                    setLoading(false);
                }
            } catch (err) {
                console.error(err);
                if (!cancelled) setStatus('Failed to load. Refresh to retry.');
            }
        };

        loadModels();
        return () => {
            cancelled = true;
            clearInterval(checkIntervalRef.current);
        };
    }, []);

    const startLivenessCheck = () => {
        setPhase('smile');
        setStatus('😊 SMILE at the camera!');
        setSmileScore(0);

        let smileDetectedCount = 0;

        checkIntervalRef.current = setInterval(async () => {
            if (!webcamRef.current) return;

            try {
                const screenshot = webcamRef.current.getScreenshot();
                if (!screenshot) return;

                const img = await faceapi.fetchImage(screenshot);
                const detection = await faceapi
                    .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
                    .withFaceLandmarks()
                    .withFaceDescriptor()
                    .withFaceExpressions();

                if (!detection) {
                    setStatus('👀 Position your face in frame');
                    return;
                }

                // Store detection for later
                detectionRef.current = detection;

                // Check for smile
                const happy = detection.expressions.happy || 0;
                setSmileScore(Math.round(happy * 100));

                if (happy > 0.5) {
                    smileDetectedCount++;
                    setStatus(`� Great! Keep smiling... (${smileDetectedCount}/3)`);

                    // Need 3 consecutive smile detections
                    if (smileDetectedCount >= 3) {
                        clearInterval(checkIntervalRef.current);
                        submitAttendance(detection);
                    }
                } else {
                    smileDetectedCount = 0; // Reset if stopped smiling
                    setStatus('😊 SMILE bigger!');
                }
            } catch (err) {
                console.error('Detection error:', err);
            }
        }, 300); // Check every 300ms

        // Timeout after 20 seconds
        setTimeout(() => {
            if (phase === 'smile') {
                clearInterval(checkIntervalRef.current);
                setStatus('⏱️ Timeout. Try again.');
                setPhase('ready');
            }
        }, 20000);
    };

    const submitAttendance = async (detection) => {
        setPhase('verifying');
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

            setStatus('✅ Submitting...');

            const photo = webcamRef.current.getScreenshot();

            await api.post('/attendance/mark', {
                faceDescriptor: Array.from(detection.descriptor),
                capturedPhoto: photo,
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

                            {/* Smile meter */}
                            {phase === 'smile' && (
                                <div className="absolute bottom-2 left-2 right-2">
                                    <div className="bg-black/50 rounded-lg p-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-2xl">😊</span>
                                            <div className="flex-1 bg-gray-600 rounded-full h-3">
                                                <div
                                                    className={`h-3 rounded-full transition-all ${smileScore > 50 ? 'bg-green-500' : 'bg-yellow-500'}`}
                                                    style={{ width: `${smileScore}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-white text-sm font-bold">{smileScore}%</span>
                                        </div>
                                        <p className="text-white text-xs text-center">Smile until meter reaches 50%+</p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <p className={`text-center font-semibold mb-4 ${status.includes('❌') || status.includes('Timeout') ? 'text-red-600'
                        : status.includes('✅') ? 'text-green-600'
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
                        <button onClick={startLivenessCheck} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-500">
                            ▶️ Start
                        </button>
                    )}
                </div>

                {phase === 'ready' && !loading && (
                    <p className="text-xs text-gray-400 text-center mt-3">
                        Just smile at the camera - easy! 😊
                    </p>
                )}
            </div>
        </div>
    );
}
