import { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function FaceAttendanceModal({ onClose, onSuccess }) {
    const webcamRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [status, setStatus] = useState('Loading...');
    const [verifying, setVerifying] = useState(false);
    const [showQRFallback, setShowQRFallback] = useState(false);
    const [capturedPhoto, setCapturedPhoto] = useState(null);

    useEffect(() => {
        const loadModels = async () => {
            const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
            try {
                // Try WebGL first
                if (faceapi.tf && faceapi.tf.setBackend) {
                    try {
                        await faceapi.tf.setBackend('webgl');
                        await faceapi.tf.ready();
                    } catch (e) {
                        console.log('WebGL not available, trying CPU');
                        await faceapi.tf.setBackend('cpu');
                        await faceapi.tf.ready();
                    }
                }

                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                ]);
                setModelsLoaded(true);
                setStatus('Ready! Capture your photo.');
                setLoading(false);
            } catch (err) {
                console.error('Model loading failed:', err);
                setModelsLoaded(false);
                setStatus('Face detection unavailable. Use QR code instead.');
                setShowQRFallback(true);
                setLoading(false);
            }
        };

        // Timeout for slow model loading
        const timeout = setTimeout(() => {
            if (loading) {
                setModelsLoaded(false);
                setStatus('Loading taking too long. Use QR code.');
                setShowQRFallback(true);
                setLoading(false);
            }
        }, 15000); // 15 second timeout

        loadModels();

        return () => clearTimeout(timeout);
    }, []);

    const captureAndVerify = async () => {
        if (!webcamRef.current || !modelsLoaded) return;

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
            const detection = await faceapi.detectSingleFace(img)
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detection) {
                setStatus('No face detected. Try again.');
                toast.error('No face detected');
                setVerifying(false);
                return;
            }

            setStatus('Getting location...');

            const location = await new Promise((resolve) => {
                if (!navigator.geolocation) resolve(null);
                else {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                        () => resolve(null),
                        { timeout: 10000 }
                    );
                }
            });

            setStatus('Submitting...');

            await api.post('/attendance/mark', {
                faceDescriptor: Array.from(detection.descriptor),
                capturedPhoto: imageSrc,
                location,
                livenessScore: 0.9
            });

            toast.success('Attendance marked!');
            setStatus('✅ Success!');
            setTimeout(() => { onSuccess(); onClose(); }, 1500);

        } catch (err) {
            const msg = err.response?.data?.message || 'Verification failed';
            setStatus(msg);
            toast.error(msg);

            if (msg.includes('far') || msg.includes('location') || msg.includes('zone')) {
                setShowQRFallback(true);
            }
            setVerifying(false);
        }
    };

    const retake = () => {
        setCapturedPhoto(null);
        setStatus('Ready! Capture your photo.');
    };

    const goToQR = () => {
        onClose();
        window.location.href = '/student/dashboard?action=scan-qr';
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5">
                <h2 className="text-lg font-bold text-center mb-4 text-gray-800">Mark Attendance</h2>

                <div className="relative aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden mb-4">
                    {loading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-3"></div>
                            <p className="text-gray-500 text-sm">Loading face detection...</p>
                        </div>
                    ) : capturedPhoto ? (
                        <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover" />
                    ) : (
                        <Webcam
                            audio={false}
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            className="w-full h-full object-cover"
                            videoConstraints={{ facingMode: 'user' }}
                        />
                    )}
                </div>

                <p className={`text-center text-sm font-medium mb-4 ${status.includes('fail') || status.includes('No face') ? 'text-red-600'
                        : status.includes('✅') ? 'text-green-600'
                            : 'text-indigo-600'
                    }`}>
                    {status}
                </p>

                {/* QR Fallback */}
                {showQRFallback && (
                    <button
                        onClick={goToQR}
                        className="w-full mb-3 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-500"
                    >
                        📷 Use QR Code Instead
                    </button>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
                    >
                        Cancel
                    </button>

                    {modelsLoaded && !capturedPhoto && (
                        <button
                            onClick={captureAndVerify}
                            disabled={verifying}
                            className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-500 disabled:opacity-50"
                        >
                            {verifying ? 'Verifying...' : '📸 Capture'}
                        </button>
                    )}

                    {capturedPhoto && !verifying && (
                        <button
                            onClick={retake}
                            className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
                        >
                            🔄 Retake
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
