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
                const MODEL_URL = '/models';

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
            // 1. Capture first photo
            const photo1 = webcamRef.current.getScreenshot();

            // Wait 500ms for natural movement
            await new Promise(r => setTimeout(r, 500));

            // 2. Capture second photo
            const photo2 = webcamRef.current.getScreenshot();

            if (!photo1 || !photo2) {
                setStatus('❌ Camera error');
                setVerifying(false);
                return;
            }

            setStatus('🔍 Checking liveness...');

            // Detect faces in both photos
            const img1 = await faceapi.fetchImage(photo1);
            const img2 = await faceapi.fetchImage(photo2);

            const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });

            const detection1 = await faceapi.detectSingleFace(img1, options).withFaceLandmarks().withFaceDescriptor();
            const detection2 = await faceapi.detectSingleFace(img2, options).withFaceLandmarks().withFaceDescriptor();

            if (!detection1 || !detection2) {
                setStatus('❌ Face lost. Stay still.');
                setVerifying(false);
                return;
            }

            // 3. Liveness Check: Calculate movement of nose tip
            const nose1 = detection1.landmarks.getNose()[3];
            const nose2 = detection2.landmarks.getNose()[3];

            const movement = Math.sqrt(
                Math.pow(nose1.x - nose2.x, 2) + Math.pow(nose1.y - nose2.y, 2)
            );

            console.log('Liveness movement:', movement);

            // Real humans have micro-movements (usually > 2px). Static photos have ~0 movement.
            // If movement is too large (> 50px), it's too shaky.
            if (movement < 2) {
                setStatus('⚠️ Liveness failed: Too still (Photo detected?)');
                setVerifying(false);
                return;
            }

            if (movement > 50) {
                setStatus('⚠️ Liveness failed: Too much movement');
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

            // Send to backend (use best descriptor)
            await api.post('/attendance/mark', {
                faceDescriptor: Array.from(detection1.descriptor),
                capturedPhoto: photo1,
                location,
                livenessScore: 0.99 // Passed client check
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
