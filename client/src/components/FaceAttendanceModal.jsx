import { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function FaceAttendanceModal({ onClose, onSuccess }) {
    const webcamRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('Loading...');
    const [verifying, setVerifying] = useState(false);
    const [showQRFallback, setShowQRFallback] = useState(false);
    const [modelsLoaded, setModelsLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const loadModels = async () => {
            try {
                setStatus('Loading face models...');
                const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

                // Load high-accuracy models
                await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
                await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
                await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

                if (!cancelled) {
                    setModelsLoaded(true);
                    setStatus('Ready! Tap "Mark Attendance"');
                    setLoading(false);
                }
            } catch (err) {
                console.error('Model load error:', err);
                if (!cancelled) {
                    setStatus('Failed to load. Tap to retry.');
                    setLoading(false);
                }
            }
        };

        loadModels();
        return () => { cancelled = true; };
    }, []);

    const handleMarkAttendance = async () => {
        if (!webcamRef.current || verifying || !modelsLoaded) return;

        setVerifying(true);
        setStatus('📸 Capturing...');

        try {
            // Capture photo
            const photo = webcamRef.current.getScreenshot();
            if (!photo) {
                setStatus('❌ Camera error');
                setVerifying(false);
                return;
            }

            setStatus('🔍 Detecting face...');

            // Detect face using High Accuracy SSD MobileNet V1
            const img = await faceapi.fetchImage(photo);
            const detection = await faceapi
                .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detection) {
                setStatus('❌ No face detected. Look at camera.');
                setVerifying(false);
                return;
            }

            setStatus('📍 Getting location...');

            // Get location
            let location;
            try {
                location = await new Promise((resolve, reject) => {
                    if (!navigator.geolocation) reject(new Error('GPS not available'));
                    navigator.geolocation.getCurrentPosition(
                        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                        (err) => reject(err),
                        { enableHighAccuracy: true, timeout: 10000 }
                    );
                });
            } catch (locErr) {
                setStatus('📍 Location failed');
                setShowQRFallback(true);
                setVerifying(false);
                return;
            }

            setStatus('✅ Marking attendance...');

            // Send to backend
            await api.post('/attendance/mark', {
                faceDescriptor: Array.from(detection.descriptor),
                capturedPhoto: photo,
                location,
                livenessScore: detection.detection.score
            });

            toast.success('✅ Attendance marked successfully!');
            setStatus('✅ Done!');
            setTimeout(() => { onSuccess(); onClose(); }, 1000);

        } catch (err) {
            console.error('Error:', err);
            const msg = err.response?.data?.message || err.message || 'Failed';

            if (msg.toLowerCase().includes('location') || msg.toLowerCase().includes('far') || msg.toLowerCase().includes('zone')) {
                setShowQRFallback(true);
            }

            setStatus('❌ ' + msg);
            toast.error(msg);
            setVerifying(false);
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
                        <Webcam
                            audio={false}
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            className="w-full h-full object-cover"
                            videoConstraints={{ facingMode: 'user', width: 480, height: 360 }}
                            mirrored={true}
                        />
                    )}
                </div>

                <p className={`text-center font-semibold mb-4 text-sm ${status.includes('❌') ? 'text-red-600'
                    : status.includes('✅') ? 'text-green-600'
                        : status.includes('📍') ? 'text-orange-500'
                            : 'text-indigo-600'
                    }`}>
                    {status}
                </p>

                {showQRFallback && (
                    <button onClick={goToQR} className="w-full mb-3 py-2.5 bg-purple-600 text-white rounded-lg font-medium">
                        📷 Use QR Code Instead
                    </button>
                )}

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
                    >
                        Cancel
                    </button>

                    {!loading && modelsLoaded && (
                        <button
                            onClick={handleMarkAttendance}
                            disabled={verifying}
                            className={`flex-1 py-2.5 rounded-lg font-bold ${verifying
                                ? 'bg-gray-400 text-white cursor-not-allowed'
                                : 'bg-green-600 text-white hover:bg-green-500'
                                }`}
                        >
                            {verifying ? '⏳ Verifying...' : '✓ Mark Attendance'}
                        </button>
                    )}
                </div>

                <p className="text-xs text-gray-400 text-center mt-3">
                    Look at camera • Good lighting helps
                </p>
            </div>
        </div>
    );
}
