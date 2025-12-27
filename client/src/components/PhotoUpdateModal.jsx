import { useState, useRef, useEffect } from 'react';
import * as faceapi from '@vladmandic/face-api';
import Webcam from 'react-webcam';
import api from '../services/api';
import toast from 'react-hot-toast';
import { initializeFaceApi } from '../utils/faceApiInitializer';

export default function PhotoUpdateModal({ onClose, onSuccess, currentPhoto }) {
    const webcamRef = useRef(null);
    const fileInputRef = useRef(null);

    const [mode, setMode] = useState('choose'); // choose, camera, upload
    const [loading, setLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [canRequestApproval, setCanRequestApproval] = useState(false);
    const [status, setStatus] = useState('');
    const [modelsLoaded, setModelsLoaded] = useState(false);

    // Load models only when needed
    const loadModels = async () => {
        if (modelsLoaded) return true;
        setLoading(true);
        setStatus('Loading face detection...');
        try {
            // Use centralized initialization
            const success = await initializeFaceApi();

            setModelsLoaded(success);
            setLoading(false);
            setStatus('');
            return success;
        } catch (err) {
            console.error('Failed to load models:', err);
            setStatus('Failed to load face detection');
            setLoading(false);
            return false;
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewUrl(reader.result);
            setMode('preview');
        };
        reader.readAsDataURL(file);
    };

    const capturePhoto = () => {
        if (!webcamRef.current) return;
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc) {
            setPreviewUrl(imageSrc);
            setMode('preview');
        } else {
            toast.error('Failed to capture photo');
        }
    };

    const verifyAndSubmit = async () => {
        if (!previewUrl) return;

        // Load models if not already loaded
        const loaded = await loadModels();
        if (!loaded) {
            toast.error('Face detection not available');
            return;
        }

        setProcessing(true);
        setStatus('Detecting face...');

        try {
            const img = await faceapi.fetchImage(previewUrl);
            const detection = await faceapi.detectSingleFace(img)
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detection) {
                setStatus('No face detected. Try again.');
                toast.error('No face detected in photo');
                setProcessing(false);
                return;
            }

            setStatus('Verifying with your registered photo...');

            const { data } = await api.put('/students/update-photo', {
                newFaceDescriptor: Array.from(detection.descriptor),
                newProfilePhoto: previewUrl,
                forceRequest: false
            });

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
                toast.error('Photo update is not enabled. Contact your Faculty Advisor.');
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

        const loaded = await loadModels();
        if (!loaded) return;

        setProcessing(true);
        setStatus('Sending request to admin...');

        try {
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
        setStatus('');
        setMode('choose');
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">📷 Update Photo</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                </div>

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

                {/* Loading State */}
                {loading && (
                    <div className="text-center py-6">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-3"></div>
                        <p className="text-gray-500">{status}</p>
                    </div>
                )}

                {/* Choose Mode */}
                {mode === 'choose' && !loading && (
                    <div className="space-y-3">
                        <p className="text-center text-sm text-gray-600 mb-4">Choose how to update your photo:</p>
                        <button
                            onClick={() => setMode('camera')}
                            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-500 flex items-center justify-center gap-2"
                        >
                            📸 Take Photo with Camera
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-500 flex items-center justify-center gap-2"
                        >
                            📁 Upload Photo from Device
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            accept="image/*"
                            className="hidden"
                        />
                    </div>
                )}

                {/* Camera Mode */}
                {mode === 'camera' && !loading && (
                    <div>
                        <div className="relative bg-gray-900 rounded-lg overflow-hidden h-48 mb-4">
                            <Webcam
                                audio={false}
                                ref={webcamRef}
                                screenshotFormat="image/jpeg"
                                videoConstraints={{ facingMode: 'user' }}
                                className="w-full h-full object-cover"
                                mirrored={true}
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setMode('choose')}
                                className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
                            >
                                ← Back
                            </button>
                            <button
                                onClick={capturePhoto}
                                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-500"
                            >
                                📸 Capture
                            </button>
                        </div>
                    </div>
                )}

                {/* Preview Mode */}
                {mode === 'preview' && !loading && (
                    <div>
                        {/* Status */}
                        {status && (
                            <p className={`text-center text-sm font-medium mb-3 ${status.includes('fail') ? 'text-red-600' : 'text-indigo-600'}`}>
                                {status} {failedAttempts > 0 && `(Attempt ${failedAttempts}/4)`}
                            </p>
                        )}

                        {/* Info Alert */}
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                            <p className="text-xs text-amber-800">
                                ⚠️ Your new photo must match your current registered face.
                                After 4 failed attempts, you can request admin approval.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={retake}
                                disabled={processing}
                                className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 disabled:opacity-50"
                            >
                                🔄 Retake
                            </button>
                            {canRequestApproval ? (
                                <button
                                    onClick={requestAdminApproval}
                                    disabled={processing}
                                    className="flex-1 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-400 disabled:opacity-50"
                                >
                                    {processing ? 'Sending...' : '📩 Request Approval'}
                                </button>
                            ) : (
                                <button
                                    onClick={verifyAndSubmit}
                                    disabled={processing}
                                    className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-500 disabled:opacity-50"
                                >
                                    {processing ? 'Verifying...' : '✓ Submit'}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Cancel */}
                <button
                    onClick={onClose}
                    className="w-full mt-4 py-2 text-gray-500 text-sm hover:text-gray-700"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
