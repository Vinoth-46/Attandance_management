import { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import api from '../services/api';
import toast from 'react-hot-toast';

// Python face service URL
const FACE_SERVICE_URL = import.meta.env.VITE_FACE_SERVICE_URL || 'https://attandance-management-1.onrender.com';

export default function FaceAttendanceModal({ onClose, onSuccess }) {
    const webcamRef = useRef(null);
    const [status, setStatus] = useState('Ready! Tap "Verify & Mark"');
    const [verifying, setVerifying] = useState(false);
    const [showQRFallback, setShowQRFallback] = useState(false);

    const verifyAndMark = async () => {
        if (!webcamRef.current || verifying) return;

        setVerifying(true);
        setStatus('� Capturing photos...');

        try {
            // Capture 2 photos for liveness check
            const photo1 = webcamRef.current.getScreenshot();
            await new Promise(r => setTimeout(r, 400));
            const photo2 = webcamRef.current.getScreenshot();

            if (!photo1 || !photo2) {
                setStatus('❌ Camera error. Try again.');
                setVerifying(false);
                return;
            }

            setStatus('🔍 Verifying liveness...');

            // Call Python face service for liveness check
            const livenessRes = await fetch(`${FACE_SERVICE_URL}/liveness`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image1: photo1, image2: photo2 })
            });

            const livenessData = await livenessRes.json();

            if (!livenessData.success) {
                setStatus('❌ ' + (livenessData.error || 'Liveness check failed'));
                setVerifying(false);
                return;
            }

            if (!livenessData.isLive) {
                setStatus('❌ Liveness failed. Please move slightly.');
                setVerifying(false);
                return;
            }

            setStatus('📍 Getting location...');

            // Get location
            const location = await new Promise((resolve, reject) => {
                if (!navigator.geolocation) reject(new Error('No GPS'));
                navigator.geolocation.getCurrentPosition(
                    (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                    (err) => reject(err),
                    { enableHighAccuracy: true, timeout: 8000 }
                );
            });

            setStatus('✅ Marking attendance...');

            // Send to Node.js backend
            await api.post('/attendance/mark', {
                faceDescriptor: livenessData.faceDescriptor,
                capturedPhoto: photo2,
                location,
                livenessScore: livenessData.isLive ? 1.0 : 0
            });

            toast.success('✅ Attendance marked!');
            setStatus('✅ Success!');
            setTimeout(() => { onSuccess(); onClose(); }, 1000);

        } catch (err) {
            console.error('Verification error:', err);
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
                    <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        className="w-full h-full object-cover"
                        videoConstraints={{ facingMode: 'user', width: 480, height: 360 }}
                        mirrored={true}
                    />
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

                    <button
                        onClick={verifyAndMark}
                        disabled={verifying}
                        className={`flex-1 py-2.5 rounded-lg font-bold ${verifying ? 'bg-gray-400 text-white' : 'bg-green-600 text-white hover:bg-green-500'
                            }`}
                    >
                        {verifying ? '⏳ Verifying...' : '✓ Verify & Mark'}
                    </button>
                </div>

                {!verifying && (
                    <p className="text-xs text-gray-400 text-center mt-3">
                        Look at camera, stay still, tap Verify
                    </p>
                )}
            </div>
        </div>
    );
}
