import { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import api from '../services/api';

export default function FaceRegistrationModal({ student, onClose, onSuccess }) {
    const webcamRef = useRef(null);
    const fileInputRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('Loading face detection models...');
    const [registering, setRegistering] = useState(false);
    const [mode, setMode] = useState('webcam'); // 'webcam' or 'upload'
    const [uploadedImage, setUploadedImage] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);

    useEffect(() => {
        const loadModels = async () => {
            const MODEL_URL = '/models';
            try {
                // Load models one by one to avoid race conditions
                await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
                await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
                await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

                setStatus('Ready. Choose webcam or upload a photo.');
                setLoading(false);
            } catch (err) {
                console.error(err);
                setStatus('Failed to load face detection models.');
            }
        };
        loadModels();
    }, []);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setUploadedImage(file);
            setPreviewUrl(URL.createObjectURL(file));
            setStatus('Photo loaded. Click "Register Face" to process.');
        }
    };

    const processAndRegister = async (imageSource) => {
        setRegistering(true);
        setStatus('Detecting face...');

        try {
            let img;
            if (typeof imageSource === 'string') {
                // It's a data URL from webcam
                img = await faceapi.fetchImage(imageSource);
            } else {
                // It's a File object
                const dataUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.readAsDataURL(imageSource);
                });
                img = await faceapi.fetchImage(dataUrl);
            }

            // Detect Face (High Accuracy)
            const detections = await faceapi
                .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detections) {
                setStatus('No face detected in the image. Please try again with a clearer photo.');
                setRegistering(false);
                return;
            }

            setStatus('Face detected! Registering...');
            const descriptor = Array.from(detections.descriptor);

            // Get the photo as base64 for profilePhoto
            let photoBase64;
            if (typeof imageSource === 'string') {
                photoBase64 = imageSource;
            } else {
                photoBase64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.readAsDataURL(imageSource);
                });
            }

            await api.post(`/admin/students/${student._id}/face`, {
                faceDescriptor: descriptor,
                profilePhoto: photoBase64
            });
            setStatus('Face registered successfully!');

            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1500);
        } catch (err) {
            console.error(err);
            setStatus(err.response?.data?.message || 'Registration failed. Please try again.');
            setRegistering(false);
        }
    };

    const handleWebcamCapture = async () => {
        if (webcamRef.current && !loading) {
            const imageSrc = webcamRef.current.getScreenshot();
            await processAndRegister(imageSrc);
        }
    };

    const handleUploadRegister = async () => {
        if (uploadedImage) {
            await processAndRegister(uploadedImage);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
                <h3 className="text-lg font-bold mb-2 text-gray-900">Register Face</h3>
                <p className="text-sm text-gray-500 mb-4">
                    Registering face for: <span className="font-semibold">{student?.name}</span> ({student?.rollNumber})
                </p>

                {/* Mode Tabs */}
                <div className="flex border-b border-gray-200 mb-4">
                    <button
                        onClick={() => { setMode('webcam'); setPreviewUrl(null); setUploadedImage(null); }}
                        className={`px-4 py-2 text-sm font-medium ${mode === 'webcam' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        📷 Webcam Capture
                    </button>
                    <button
                        onClick={() => setMode('upload')}
                        className={`px-4 py-2 text-sm font-medium ${mode === 'upload' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        📁 Upload Photo
                    </button>
                </div>

                {/* Webcam Mode */}
                {mode === 'webcam' && (
                    <div className="relative bg-black rounded-lg overflow-hidden h-64 flex items-center justify-center">
                        {loading ? (
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-2"></div>
                                <p className="text-white text-sm">{status}</p>
                            </div>
                        ) : (
                            <Webcam
                                audio={false}
                                ref={webcamRef}
                                screenshotFormat="image/jpeg"
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                        )}
                    </div>
                )}

                {/* Upload Mode */}
                {mode === 'upload' && (
                    <div className="relative bg-gray-100 rounded-lg overflow-hidden h-64 flex items-center justify-center border-2 border-dashed border-gray-300">
                        {previewUrl ? (
                            <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
                        ) : (
                            <div className="text-center">
                                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <p className="mt-2 text-sm text-gray-600">Click to upload a student photo</p>
                                <p className="text-xs text-gray-400">JPG, PNG supported</p>
                            </div>
                        )}
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*"
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                    </div>
                )}

                <p className={`mt-4 text-center font-medium ${status.includes('success') ? 'text-green-600' : status.includes('failed') || status.includes('No face') ? 'text-red-600' : 'text-indigo-600'}`}>
                    {status}
                </p>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-semibold text-gray-900 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                        Cancel
                    </button>
                    {mode === 'webcam' ? (
                        <button
                            onClick={handleWebcamCapture}
                            disabled={loading || registering}
                            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {registering ? 'Registering...' : 'Capture & Register'}
                        </button>
                    ) : (
                        <button
                            onClick={handleUploadRegister}
                            disabled={loading || registering || !uploadedImage}
                            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {registering ? 'Registering...' : 'Register Face'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
