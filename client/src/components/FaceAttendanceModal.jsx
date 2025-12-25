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

    useEffect(() => {
        const loadModels = async () => {
            try {
                const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
                // Load models one at a time to avoid memory issues on mobile
                await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
                await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
                await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

                setStatus('Ready! Tap "Verify & Mark"');
                setLoading(false);
            } catch (err) {
                console.error('Model load error:', err);
                setStatus('Failed to load. Refresh page.');
            }
        };
        loadModels();
    }, []);

    const verifyAndMark = async () => {
        if (!webcamRef.current || verifying) return;

        setVerifying(true);
        setStatus('🔍 Detecting face...');

        try {
            // Capture 2 photos quickly for liveness
            const photo1 = webcamRef.current.getScreenshot();
            await new Promise(r => setTimeout(r, 300)); // Small delay
            const photo2 = webcamRef.current.getScreenshot();

            // Detect face in both
            const img1 = await faceapi.fetchImage(photo1);
            const detection1 = await faceapi.detectSingleFace(img1).withFaceLandmarks().withFaceDescriptor();

            if (!detection1) {
                setStatus('❌ No face detected. Look at camera.');
                setVerifying(false);
                return;
            }

            const img2 = await faceapi.fetchImage(photo2);
            const detection2 = await faceapi.detectSingleFace(img2).withFaceLandmarks().withFaceDescriptor();

            if (!detection2) {
                setStatus('❌ Face lost. Keep still and try again.');
                setVerifying(false);
                return;
            }

            // Quick liveness: Check if face moved slightly (real person moves, photo is static)
            const box1 = detection1.detection.box;
            const box2 = detection2.detection.box;
            const movement = Math.abs(box1.x - box2.x) + Math.abs(box1.y - box2.y);

            // Real faces have tiny natural movements (breathing, etc)
            // If movement is exactly 0, it's likely a static photo
            const isLive = movement > 0.5 || detection1.detection.score > 0.9;

            if (!isLive) {
                setStatus('❌ Liveness check failed. Move slightly.');
                setVerifying(false);
                return;
            }

            setStatus('📍 Getting location...');

            const location = await new Promise((resolve, reject) => {
                if (!navigator.geolocation) reject(new Error('No GPS'));
                navigator.geolocation.getCurrentPosition(
                    (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                    (err) => reject(err),
                    { enableHighAccuracy: true, timeout: 8000 }
                );
            });

            setStatus('✅ Marking attendance...');

            await api.post('/attendance/mark', {
                faceDescriptor: Array.from(detection2.descriptor),
                capturedPhoto: photo2,
                location,
                livenessScore: detection2.detection.score
            });

            toast.success('✅ Attendance marked!');
            setStatus('✅ Success!');
            setTimeout(() => { onSuccess(); onClose(); }, 1000);

        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed';

            if (msg.includes('far') || msg.includes('location') || msg.includes('zone') || msg.includes('GPS')) {
                setStatus('📍 ' + msg);
                setShowQRFallback(true);
            } else {
                setStatus('❌ ' + msg);
                toast.error(msg);
            }
            setVerifying(false);
        }
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

                <p className={`text-center font-semibold mb-4 ${status.includes('❌') ? 'text-red-600'
                    : status.includes('✅') ? 'text-green-600'
                        : status.includes('📍') ? 'text-orange-500'
                            : 'text-indigo-600'
                    }`}>
                    {status}
                </p>

                {showQRFallback && (
                    <button
                        onClick={() => { onClose(); window.location.href = '/student/dashboard?action=scan-qr'; }}
                        className="w-full mb-3 py-2.5 bg-purple-600 text-white rounded-lg font-medium"
                    >
                        📷 Use QR Code (GPS issue)
                    </button>
                )}

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium">
                        Cancel
                    </button>

                    {!loading && (
                        <button
                            onClick={verifyAndMark}
                            disabled={verifying}
                            className={`flex-1 py-2.5 rounded-lg font-bold ${verifying ? 'bg-gray-400 text-white' : 'bg-green-600 text-white hover:bg-green-500'
                                }`}
                        >
                            {verifying ? '⏳ Verifying...' : '✓ Verify & Mark'}
                        </button>
                    )}
                </div>

                {!loading && !verifying && (
                    <p className="text-xs text-gray-400 text-center mt-3">
                        Look at camera, stay still, tap Verify
                    </p>
                )}
            </div>
        </div>
    );
}
