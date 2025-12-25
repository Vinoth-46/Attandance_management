import { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function FaceAttendanceModal({ onClose, onSuccess }) {
    const webcamRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [loadProgress, setLoadProgress] = useState(0);
    const [status, setStatus] = useState('Loading...');
    const [phase, setPhase] = useState('loading'); // loading, instructions, detecting, verifying, success
    const [showQRFallback, setShowQRFallback] = useState(false);
    const [faceDetected, setFaceDetected] = useState(false);
    const [progress, setProgress] = useState(0);
    const detectionRef = useRef(null);
    const checkIntervalRef = useRef(null);
    const movementCountRef = useRef(0);
    const lastPositionRef = useRef(null);

    useEffect(() => {
        let cancelled = false;

        const loadModels = async () => {
            try {
                const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

                setLoadProgress(25);
                await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
                if (cancelled) return;

                setLoadProgress(60);
                await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
                if (cancelled) return;

                setLoadProgress(100);
                await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
                if (cancelled) return;

                setPhase('instructions');
                setLoading(false);
            } catch (err) {
                console.error('Model load error:', err);
                if (!cancelled) setStatus('Failed to load. Refresh page.');
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
        setStatus('🔍 Keep looking at camera...');
        movementCountRef.current = 0;
        lastPositionRef.current = null;
        setProgress(0);

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
                    setStatus('👀 Keep your face in frame');
                    return;
                }

                setFaceDetected(true);
                detectionRef.current = { detection, screenshot };

                // Get face center position
                const box = detection.detection.box;
                const currentPos = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

                // Check for any movement
                if (lastPositionRef.current) {
                    const dx = Math.abs(currentPos.x - lastPositionRef.current.x);
                    const dy = Math.abs(currentPos.y - lastPositionRef.current.y);

                    if (dx > 3 || dy > 3) {
                        movementCountRef.current++;
                        const prog = Math.min((movementCountRef.current / 4) * 100, 100);
                        setProgress(prog);
                        setStatus(`✓ Verifying... ${Math.round(prog)}%`);
                    }
                }

                lastPositionRef.current = currentPos;

                // Only need 4 movements now (easier)
                if (movementCountRef.current >= 4) {
                    clearInterval(checkIntervalRef.current);
                    submitAttendance();
                }
            } catch (err) {
                console.error('Detection error:', err);
            }
        }, 350);

        // Timeout after 12 seconds
        setTimeout(() => {
            if (phase === 'detecting') {
                clearInterval(checkIntervalRef.current);
                setStatus('⏱️ Timeout. Tap to try again.');
                setPhase('instructions');
            }
        }, 12000);
    };

    const submitAttendance = async () => {
        if (!detectionRef.current) return;

        setPhase('verifying');
        setStatus('📍 Getting your location...');

        try {
            const location = await new Promise((resolve, reject) => {
                if (!navigator.geolocation) reject(new Error('GPS not available'));
                navigator.geolocation.getCurrentPosition(
                    (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                    (err) => reject(err),
                    { enableHighAccuracy: true, timeout: 10000 }
                );
            });

            setStatus('✅ Almost done...');

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
            setPhase('instructions');
        }
    };

    const goToQR = () => {
        onClose();
        window.location.href = '/student/dashboard?action=scan-qr';
    };

    // Instructions Screen
    const renderInstructions = () => (
        <div className="text-center">
            <h3 className="font-bold text-gray-800 mb-4">How to Verify:</h3>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-center gap-4 mb-3">
                    <div className="text-4xl animate-bounce">👤</div>
                    <div className="text-2xl">→</div>
                    <div className="text-4xl animate-pulse">📱</div>
                </div>

                <div className="space-y-2 text-left">
                    <div className="flex items-center gap-2">
                        <span className="bg-indigo-100 text-indigo-700 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</span>
                        <span className="text-sm">Hold phone at <b>arm's length</b></span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="bg-indigo-100 text-indigo-700 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</span>
                        <span className="text-sm">Look at <b>camera</b> (front facing)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="bg-indigo-100 text-indigo-700 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</span>
                        <span className="text-sm"><b>Move head slowly</b> left-right</span>
                    </div>
                </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-yellow-800">
                    💡 <b>Tip:</b> Good lighting helps! Face a window or light.
                </p>
            </div>

            <button
                onClick={startDetection}
                className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold text-lg hover:bg-indigo-500"
            >
                ▶️ I'm Ready - Start!
            </button>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5">
                <h2 className="text-lg font-bold text-center mb-3 text-gray-800">📸 Face Attendance</h2>

                {/* Loading State */}
                {loading && (
                    <div className="aspect-[4/3] bg-gray-800 rounded-lg flex flex-col items-center justify-center mb-3">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent mb-3"></div>
                        <p className="text-white text-sm mb-2">Loading face detection...</p>
                        <div className="w-48 bg-gray-600 rounded-full h-2">
                            <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${loadProgress}%` }}></div>
                        </div>
                    </div>
                )}

                {/* Instructions Phase */}
                {phase === 'instructions' && renderInstructions()}

                {/* Detection Phase */}
                {(phase === 'detecting' || phase === 'verifying' || phase === 'success') && (
                    <>
                        <div className="relative aspect-[4/3] bg-gray-900 rounded-lg overflow-hidden mb-3">
                            <Webcam
                                audio={false}
                                ref={webcamRef}
                                screenshotFormat="image/jpeg"
                                className="w-full h-full object-cover"
                                videoConstraints={{ facingMode: 'user', width: 480, height: 360 }}
                                mirrored={true}
                            />

                            {/* Face indicator */}
                            <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold ${faceDetected ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                {faceDetected ? '✓ Face OK' : '✗ No Face'}
                            </div>

                            {/* Progress bar */}
                            {phase === 'detecting' && (
                                <div className="absolute bottom-0 left-0 right-0 h-2 bg-gray-800">
                                    <div
                                        className="h-full bg-green-500 transition-all duration-200"
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>
                            )}
                        </div>

                        <p className={`text-center font-semibold mb-4 ${status.includes('❌') || status.includes('Timeout') ? 'text-red-600'
                                : status.includes('✅') || status.includes('✓') ? 'text-green-600'
                                    : status.includes('📍') ? 'text-orange-500'
                                        : 'text-indigo-600'
                            }`}>
                            {status}
                        </p>
                    </>
                )}

                {/* QR Fallback */}
                {showQRFallback && (
                    <button onClick={goToQR} className="w-full mb-3 py-2.5 bg-purple-600 text-white rounded-lg font-medium">
                        📷 Use QR Code (GPS issue)
                    </button>
                )}

                {/* Close button */}
                {phase !== 'instructions' && (
                    <button onClick={onClose} className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">
                        Cancel
                    </button>
                )}

                {phase === 'instructions' && (
                    <button onClick={onClose} className="w-full mt-3 py-2 text-gray-500 text-sm hover:text-gray-700">
                        Cancel
                    </button>
                )}
            </div>
        </div>
    );
}
