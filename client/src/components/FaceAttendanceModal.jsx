import { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import api from '../services/api';
import toast from 'react-hot-toast';
import { initializeFaceApi } from '../utils/faceApiInitializer';

export default function FaceAttendanceModal({ onClose, onSuccess }) {
    const webcamRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('Loading...');
    const [verifying, setVerifying] = useState(false);
    const [modelsLoaded, setModelsLoaded] = useState(false);

    // New State for logic flow
    const [step, setStep] = useState('face'); // 'face', 'location', 'failed_location'
    const [capturedData, setCapturedData] = useState(null); // Stores validated face data

    useEffect(() => {
        let cancelled = false;

        const loadModels = async () => {
            try {
                setStatus('Loading face models...');

                // Use centralized initialization
                const success = await initializeFaceApi();

                if (!cancelled) {
                    if (success) {
                        setModelsLoaded(true);
                        setStatus('Ready! Tap "Mark Attendance"');
                        setLoading(false);
                    } else {
                        setStatus('Failed to load. Tap to retry.');
                        setLoading(false);
                    }
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

    const processLocationAndAttendance = async (faceData) => {
        setStep('location');
        setStatus('📍 Getting location...');

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
            setStep('failed_location');
            setStatus('📍 Location failed. Retry or use QR.');
            setVerifying(false);
            return;
        }

        setStatus('✅ Sending data...');

        try {
            await api.post('/attendance/mark', {
                faceDescriptor: faceData.descriptor,
                capturedPhoto: faceData.photo,
                location,
                livenessScore: 0.99
            });

            toast.success('✅ Attendance marked successfully!');
            setStatus('✅ Done!');

            // Close logic
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1000);

        } catch (err) {
            console.error('Attendance Error:', err);
            const msg = err.response?.data?.message || err.message || 'Failed';

            if (msg.toLowerCase().includes('location') || msg.toLowerCase().includes('far') || msg.toLowerCase().includes('zone')) {
                setStep('failed_location');
                setStatus(`📍 Location Error: ${msg}`);
                toast.error('Location check failed');
            } else if (msg.toLowerCase().includes('already marked')) {
                toast.success('Attendance already marked!');
                onSuccess();
                onClose();
            } else {
                setStatus('❌ ' + msg);
                toast.error(msg);
                setVerifying(false);
                setStep('face'); // Reset to face on other errors
            }
        }
    };

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

            // Detect faces
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

            // Liveness Check (Movement)
            const nose1 = detection1.landmarks.getNose()[3];
            const nose2 = detection2.landmarks.getNose()[3];
            const movement = Math.sqrt(Math.pow(nose1.x - nose2.x, 2) + Math.pow(nose1.y - nose2.y, 2));

            console.log('Liveness movement:', movement);

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

            // Face Verified! Store data and move to location
            const faceData = {
                descriptor: Array.from(detection1.descriptor),
                photo: photo1
            };
            setCapturedData(faceData);

            // Proceed to location check
            await processLocationAndAttendance(faceData);

        } catch (err) {
            console.error('Error:', err);
            setStatus('❌ Error: ' + err.message);
            setVerifying(false);
        }
    };

    const goToQR = () => {
        onClose();
        window.location.href = '/student/dashboard?action=scan-qr';
    };

    const retryLocation = () => {
        if (capturedData) {
            setVerifying(true);
            processLocationAndAttendance(capturedData);
        } else {
            setStep('face');
            setVerifying(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5">
                <h2 className="text-lg font-bold text-center mb-3 text-gray-800">📸 Face Attendance</h2>

                {/* Camera View - Only show if in 'face' step */}
                {step === 'face' && (
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
                )}

                {/* Location Failure View */}
                {(step === 'failed_location') && (
                    <div className="text-center py-6 bg-orange-50 rounded-lg mb-4 border border-orange-100">
                        <div className="text-4xl mb-2">📍❌</div>
                        <h3 className="font-bold text-orange-800">Location Failed</h3>
                        <p className="text-sm text-orange-700 mb-4 px-2">{status}</p>
                        <p className="text-xs text-gray-500 mb-4">Your face was verified. You can retry location or use QR.</p>

                        <div className="flex flex-col gap-2 px-4">
                            <button onClick={retryLocation} className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-500">
                                🔄 Retry Location
                            </button>
                            <button onClick={goToQR} className="w-full py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-500">
                                📷 Scan QR Code
                            </button>
                        </div>
                    </div>
                )}

                {/* Status Text (only for non-failure states) */}
                {step !== 'failed_location' && (
                    <p className={`text-center font-semibold mb-4 text-sm ${status.includes('❌') ? 'text-red-600'
                        : status.includes('✅') ? 'text-green-600'
                            : status.includes('📍') ? 'text-orange-500'
                                : 'text-indigo-600'
                        }`}>
                        {status}
                    </p>
                )}

                {/* Action Buttons for Face Step */}
                {step === 'face' && (
                    <>
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

                        <div className="bg-blue-50 p-2 rounded-lg mt-3 text-center border border-blue-100">
                            <p className="text-xs text-blue-700 font-medium">
                                💡 Instructions: <br />
                                Look at the camera and <b>breathe naturally</b>.<br />
                                The system checks for tiny movements to ensure you are real.
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
