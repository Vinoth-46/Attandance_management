import { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function FaceAttendanceModal({ onClose, onSuccess }) {
    const webcamRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('Loading face detection...');
    const [verifying, setVerifying] = useState(false);
    const [showQRFallback, setShowQRFallback] = useState(false);
    const [capturedPhoto, setCapturedPhoto] = useState(null);
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        let cancelled = false;

        const loadModels = async () => {
            const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

            try {
                setStatus('Initializing...');

                // Use TinyFaceDetector (much smaller, ~190KB vs ~5MB)
                await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
                await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
                await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

                if (!cancelled) {
                    setStatus('Ready! Position your face and capture.');
                    setLoading(false);
                }
            } catch (err) {
                console.error('Model loading failed:', err);
                if (!cancelled) {
                    if (retryCount < 2) {
                        setRetryCount(r => r + 1);
                        setStatus('Retrying...');
                        setTimeout(loadModels, 2000);
                    } else {
                        setStatus('Face detection failed to load. Please try again.');
                    }
                }
            }
        };

        loadModels();

        return () => { cancelled = true; };
    }, [retryCount]);

    const captureAndVerify = async () => {
        if (!webcamRef.current) return;

        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) {
            toast.error('Failed to capture photo');
            return;
        }

        setCapturedPhoto(imageSrc);
        setVerifying(true);
        setStatus('Detecting face...');

        try {
            const img = await faceapi.fetchImage(imageSrc);

            // Use TinyFaceDetector (faster on mobile)
            const detection = await faceapi
                .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detection) {
                setStatus('❌ No face detected. Please try again.');
                toast.error('No face detected');
                setVerifying(false);
                return;
            }

            // Calculate liveness score from detection quality
            const livenessScore = detection.detection.score;

            if (livenessScore < 0.5) {
                setStatus('❌ Face not clear enough. Try again.');
                toast.error('Please position your face clearly');
                setVerifying(false);
                return;
            }

            setStatus('📍 Getting your location...');

            const location = await new Promise((resolve, reject) => {
                if (!navigator.geolocation) {
                    reject(new Error('Geolocation not supported'));
                    return;
                }
                navigator.geolocation.getCurrentPosition(
                    (pos) => resolve({
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude
                    }),
                    (err) => reject(err),
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                );
            });

            setStatus('✅ Marking attendance...');

            await api.post('/attendance/mark', {
                faceDescriptor: Array.from(detection.descriptor),
                capturedPhoto: imageSrc,
                location,
                livenessScore
            });

            toast.success('✅ Attendance marked successfully!');
            setStatus('✅ Success!');
            setTimeout(() => { onSuccess(); onClose(); }, 1500);

        } catch (err) {
            console.error('Verification error:', err);
            const msg = err.response?.data?.message || err.message || 'Verification failed';

            // Show QR fallback only for location/GPS errors
            if (msg.includes('far') || msg.includes('location') || msg.includes('zone') ||
                msg.includes('Geolocation') || msg.includes('GPS') || msg.includes('permission')) {
                setStatus('📍 Location issue: ' + msg);
                setShowQRFallback(true);
                toast.error('Location verification failed');
            } else {
                setStatus('❌ ' + msg);
                toast.error(msg);
            }
            setVerifying(false);
        }
    };

    const retake = () => {
        setCapturedPhoto(null);
        setShowQRFallback(false);
        setStatus('Ready! Position your face and capture.');
    };

    const goToQR = () => {
        onClose();
        // Use URL param to trigger QR scanner
        window.location.href = '/student/dashboard?action=scan-qr';
    };

    const reloadModels = () => {
        setLoading(true);
        setRetryCount(0);
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5">
                <h2 className="text-lg font-bold text-center mb-4 text-gray-800">
                    📸 Face Attendance
                </h2>

                {/* Webcam / Photo Preview */}
                <div className="relative aspect-[4/3] bg-gray-900 rounded-lg overflow-hidden mb-4">
                    {loading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent mb-4"></div>
                            <p className="text-white text-sm">{status}</p>
                            {retryCount >= 2 && (
                                <button
                                    onClick={reloadModels}
                                    className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg"
                                >
                                    🔄 Retry
                                </button>
                            )}
                        </div>
                    ) : capturedPhoto ? (
                        <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover" />
                    ) : (
                        <Webcam
                            audio={false}
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            className="w-full h-full object-cover"
                            videoConstraints={{ facingMode: 'user', width: 640, height: 480 }}
                            mirrored={true}
                        />
                    )}

                    {/* Face guide overlay */}
                    {!loading && !capturedPhoto && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-40 h-48 border-2 border-dashed border-white/50 rounded-full"></div>
                        </div>
                    )}
                </div>

                {/* Status */}
                <p className={`text-center text-sm font-medium mb-4 ${status.includes('❌') ? 'text-red-600'
                        : status.includes('✅') ? 'text-green-600'
                            : status.includes('📍') ? 'text-orange-600'
                                : 'text-indigo-600'
                    }`}>
                    {status}
                </p>

                {/* QR Fallback - Only for location issues */}
                {showQRFallback && (
                    <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <p className="text-sm text-purple-800 mb-2">
                            📍 GPS not working? Scan the QR code displayed by staff.
                        </p>
                        <button
                            onClick={goToQR}
                            className="w-full py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-500"
                        >
                            📷 Scan QR Code
                        </button>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
                    >
                        Cancel
                    </button>

                    {!loading && !capturedPhoto && (
                        <button
                            onClick={captureAndVerify}
                            disabled={verifying}
                            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-500 disabled:opacity-50"
                        >
                            {verifying ? '⏳ Verifying...' : '📸 Capture'}
                        </button>
                    )}

                    {capturedPhoto && !verifying && (
                        <button
                            onClick={retake}
                            className="flex-1 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
                        >
                            🔄 Retake
                        </button>
                    )}
                </div>

                {/* Tip */}
                {!loading && !capturedPhoto && (
                    <p className="text-xs text-gray-400 text-center mt-3">
                        Position your face within the oval and tap Capture
                    </p>
                )}
            </div>
        </div>
    );
}
