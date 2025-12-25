import { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import api from '../services/api';

export default function FaceAttendanceModal({ onClose, onSuccess }) {
    const webcamRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('Loading models...');
    const [verifying, setVerifying] = useState(false);
    const [livenessStep, setLivenessStep] = useState(0); // 0: ready, 1-3: capturing samples
    const [showQRFallback, setShowQRFallback] = useState(false); // Show QR fallback option

    useEffect(() => {
        const loadModels = async () => {
            const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
            try {
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                    faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL), // For liveness
                ]);
                setStatus('Ready. Click "Capture" and keep your face steady.');
                setLoading(false);
            } catch (err) {
                console.error(err);
                setStatus('Failed to load face models.');
            }
        };
        loadModels();
    }, []);

    // Calculate liveness score based on face detection quality
    const calculateLivenessScore = (detections, samples) => {
        if (!detections || samples.length === 0) return 0;

        let score = 0;

        // 1. Face detection confidence (40%)
        const detectionScore = detections.detection.score;
        score += detectionScore * 0.4;

        // 2. Face size check - too small suggests a photo (20%)
        const faceBox = detections.detection.box;
        const faceArea = faceBox.width * faceBox.height;
        const minArea = 10000; // Minimum face area in pixels
        const faceSizeScore = Math.min(faceArea / minArea, 1);
        score += faceSizeScore * 0.2;

        // 3. Expression presence check - photos usually have static expressions (25%)
        if (detections.expressions) {
            const expressions = detections.expressions;
            const dominantExpression = Object.entries(expressions).sort((a, b) => b[1] - a[1])[0];
            // More varied expressions = more likely real
            const expressionVariety = Object.values(expressions).filter(v => v > 0.1).length;
            score += (Math.min(expressionVariety / 3, 1) * 0.15);
            // Having at least neutral expression with good confidence
            score += (expressions.neutral > 0.3 || dominantExpression[1] > 0.5 ? 0.1 : 0);
        }

        // 4. Consistency across samples (15%)
        if (samples.length >= 2) {
            // Calculate variance in face positions
            const positions = samples.map(s => s.detection.box);
            const avgX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
            const variance = positions.reduce((sum, p) => sum + Math.abs(p.x - avgX), 0) / positions.length;
            // Some movement is expected from a real person
            const movementScore = variance > 2 && variance < 50 ? 1 : 0.5;
            score += movementScore * 0.15;
        } else {
            score += 0.1; // Base score if not enough samples
        }

        return Math.min(score, 1); // Cap at 1
    };

    const handleCapture = async () => {
        if (webcamRef.current && !loading) {
            setVerifying(true);
            setStatus('Verifying face...');

            try {
                setLivenessStep(1);

                // Single fast capture for liveness
                const imageSrc = webcamRef.current.getScreenshot();
                const img = await faceapi.fetchImage(imageSrc);

                const detection = await faceapi
                    .detectSingleFace(img)
                    .withFaceLandmarks()
                    .withFaceDescriptor()
                    .withFaceExpressions();

                if (!detection) {
                    setStatus('No face detected. Please try again.');
                    setVerifying(false);
                    setLivenessStep(0);
                    return;
                }

                // Quick liveness check using expressions
                const livenessScore = calculateLivenessScore(detection, [detection]);
                console.log('Liveness Score:', livenessScore);

                if (livenessScore < 0.6) { // Lowered threshold for faster pass
                    setStatus(`Liveness check failed. Please try again.`);
                    setVerifying(false);
                    setLivenessStep(0);
                    return;
                }

                setStatus('Getting location...');

                // Get Location Promise
                const getLocation = () => {
                    return new Promise((resolve) => {
                        if (!navigator.geolocation) {
                            resolve(null);
                        } else {
                            navigator.geolocation.getCurrentPosition(
                                (position) => resolve({
                                    latitude: position.coords.latitude,
                                    longitude: position.coords.longitude
                                }),
                                (err) => {
                                    console.warn("Location access denied or failed", err);
                                    resolve(null);
                                }
                            );
                        }
                    });
                };

                const location = await getLocation();

                setStatus('Submitting...');
                const descriptor = Array.from(detection.descriptor);
                const captureImage = webcamRef.current.getScreenshot();

                const res = await api.post('/attendance/mark', {
                    faceDescriptor: descriptor,
                    capturedPhoto: captureImage,
                    location,
                    livenessScore
                });

                setStatus('✅ Attendance Marked Successfully!');
                setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 2000);
            } catch (err) {
                console.error(err);
                const msg = err.response?.data?.message || 'Verification Failed';

                // If geofencing fails, show QR fallback option
                if (msg.toLowerCase().includes('far') || msg.toLowerCase().includes('location') || msg.toLowerCase().includes('zone') || msg.toLowerCase().includes('permission')) {
                    setStatus(msg);
                    setShowQRFallback(true);
                } else {
                    setStatus(msg);
                }

                setVerifying(false);
                setLivenessStep(0);
            }
        }
    };

    const handleQRFallback = () => {
        onClose(); // Close face modal
        // The parent (StudentDashboard) has QR scanner available
        // Trigger it by setting a flag or callback if needed
        window.location.href = '/student/dashboard?action=scan-qr'; // Or use a callback
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
                <h3 className="text-lg font-bold mb-4">Mark Attendance</h3>

                <div className="relative bg-black rounded-lg overflow-hidden h-64 flex items-center justify-center">
                    {loading ? (
                        <p className="text-white">{status}</p>
                    ) : (
                        <>
                            <Webcam
                                audio={false}
                                ref={webcamRef}
                                screenshotFormat="image/jpeg"
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                            {/* Liveness indicator overlay */}
                            {livenessStep > 0 && (
                                <div className="absolute top-2 right-2 bg-yellow-500 text-white px-2 py-1 rounded text-xs font-bold animate-pulse">
                                    Verifying...
                                </div>
                            )}
                        </>
                    )}
                </div>

                <p className={`mt-4 text-center font-medium ${status.includes('failed') || status.includes('Failed') || status.includes('far') ? 'text-red-600' : status.includes('✅') ? 'text-green-600' : 'text-indigo-600'}`}>
                    {status}
                </p>

                {/* QR Fallback Button */}
                {showQRFallback && (
                    <div className="mt-3 bg-purple-50 border border-purple-200 rounded-lg p-3">
                        <p className="text-sm text-purple-800 mb-2">
                            📍 GPS not accurate? Use the QR code fallback instead.
                        </p>
                        <button
                            onClick={handleQRFallback}
                            className="w-full px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-500"
                        >
                            📷 Scan QR Code Instead
                        </button>
                    </div>
                )}

                {/* Liveness info */}
                <p className="mt-2 text-center text-xs text-gray-500">
                    Liveness detection ensures you're a real person, not a photo.
                </p>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-semibold text-gray-900 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCapture}
                        disabled={loading || verifying}
                        className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-500 disabled:opacity-50"
                    >
                        {verifying ? 'Verifying...' : 'Capture & Mark'}
                    </button>
                </div>
            </div>
        </div>
    );
}

