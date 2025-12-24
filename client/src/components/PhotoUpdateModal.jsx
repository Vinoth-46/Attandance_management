import { useState, useRef, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import Webcam from 'react-webcam';
import api from '../services/api';
import { useToast } from './Toast';

export default function PhotoUpdateModal({ onClose, onSuccess, currentPhoto }) {
    const toast = useToast();
    const webcamRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [canRequestApproval, setCanRequestApproval] = useState(false);
    const [status, setStatus] = useState('Initializing...');

    // Load face-api models
    useEffect(() => {
        const loadModels = async () => {
            try {
                const MODEL_URL = '/models';
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
                ]);
                setLoading(false);
                setStatus('Ready to capture');
            } catch (err) {
                console.error('Failed to load models:', err);
                setStatus('Failed to load face detection');
            }
        };
        loadModels();
    }, []);

    const captureAndVerify = async () => {
        if (!webcamRef.current) return;

        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) {
            toast.error('Failed to capture photo');
            return;
        }

        setPreviewUrl(imageSrc);
        setProcessing(true);
        setStatus('Detecting face...');

        try {
            // Detect face in new photo
            const img = await faceapi.fetchImage(imageSrc);
            const detection = await faceapi.detectSingleFace(img)
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detection) {
                setStatus('No face detected. Try again.');
                toast.error('No face detected');
                setProcessing(false);
                return;
            }

            setStatus('Verifying with your registered photo...');

            // Send to backend for verification
            const { data } = await api.put('/students/update-photo', {
                newFaceDescriptor: Array.from(detection.descriptor),
                newProfilePhoto: imageSrc,
                forceRequest: false
            });

            // Success!
            toast.success(data.message);
            onSuccess && onSuccess();
            onClose();

        } catch (err) {
            const errorData = err.response?.data;

            if (errorData?.failedAttempts) {
                setFailedAttempts(errorData.failedAttempts);
            }

            if (errorData?.canRequestApproval) {
                setCanRequestApproval(true);
                setStatus('Face verification failed too many times.');
                toast.warning('You can now request admin approval');
            } else if (errorData?.needsAdminApproval) {
                toast.info('Photo update is not enabled. Contact your Faculty Advisor.');
                onClose();
            } else {
                setStatus(errorData?.message || 'Verification failed');
                toast.error(errorData?.message || 'Verification failed');
            }

            setProcessing(false);
        }
    };

    const requestAdminApproval = async () => {
        if (!previewUrl) {
            toast.error('Please capture a photo first');
            return;
        }

        setProcessing(true);
        setStatus('Sending request to admin...');

        try {
            // Detect face first
            const img = await faceapi.fetchImage(previewUrl);
            const detection = await faceapi.detectSingleFace(img)
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detection) {
                toast.error('No face detected in photo');
                setProcessing(false);
                return;
            }

            const { data } = await api.put('/students/update-photo', {
                newFaceDescriptor: Array.from(detection.descriptor),
                newProfilePhoto: previewUrl,
                forceRequest: true
            });

            toast.success(data.message);
            onClose();

        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to send request');
            setProcessing(false);
        }
    };

    const retake = () => {
        setPreviewUrl(null);
        setStatus('Ready to capture');
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">📷 Update Photo</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                </div>

                {loading ? (
                    <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600 mx-auto mb-3"></div>
                        <p className="text-gray-500">Loading face detection...</p>
                    </div>
                ) : (
                    <>
                        {/* Current vs New Photo */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="text-center">
                                <p className="text-xs text-gray-500 mb-2">Current Photo</p>
                                <div className="w-24 h-24 mx-auto rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-100">
                                    {currentPhoto ? (
                                        <img src={currentPhoto} alt="Current" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="flex items-center justify-center h-full text-3xl text-gray-400">👤</span>
                                    )}
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-gray-500 mb-2">New Photo</p>
                                <div className="w-24 h-24 mx-auto rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-100">
                                    {previewUrl ? (
                                        <img src={previewUrl} alt="New" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="flex items-center justify-center h-full text-3xl text-gray-400">📷</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Webcam */}
                        {!previewUrl && (
                            <div className="relative bg-gray-900 rounded-lg overflow-hidden h-48 mb-4">
                                <Webcam
                                    audio={false}
                                    ref={webcamRef}
                                    screenshotFormat="image/jpeg"
                                    videoConstraints={{ facingMode: 'user' }}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        )}

                        {/* Status */}
                        <p className={`text-center text-sm font-medium mb-4 ${status.includes('fail') ? 'text-red-600' : 'text-brand-600'}`}>
                            {status} {failedAttempts > 0 && `(Attempt ${failedAttempts}/4)`}
                        </p>

                        {/* Info Alert */}
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                            <p className="text-xs text-amber-800">
                                ⚠️ Your new photo must match your current registered face.
                                After 4 failed attempts, you can request admin approval.
                            </p>
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3">
                            {!previewUrl ? (
                                <button
                                    onClick={captureAndVerify}
                                    disabled={processing}
                                    className="flex-1 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-500 disabled:opacity-50"
                                >
                                    {processing ? 'Processing...' : '📸 Capture & Verify'}
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={retake}
                                        disabled={processing}
                                        className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 disabled:opacity-50"
                                    >
                                        🔄 Retake
                                    </button>
                                    {canRequestApproval && (
                                        <button
                                            onClick={requestAdminApproval}
                                            disabled={processing}
                                            className="flex-1 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-400 disabled:opacity-50"
                                        >
                                            📩 Request Approval
                                        </button>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Cancel */}
                        <button
                            onClick={onClose}
                            className="w-full mt-3 py-2 text-gray-500 text-sm hover:text-gray-700"
                        >
                            Cancel
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
