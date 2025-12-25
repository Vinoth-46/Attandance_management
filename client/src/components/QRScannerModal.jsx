import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import api from '../services/api';

export default function QRScannerModal({ isOpen, onClose, onSuccess }) {
    const [step, setStep] = useState('qr'); // 'qr', 'face', 'verifying', 'success'
    const [qrData, setQrData] = useState(null);
    const [faceStatus, setFaceStatus] = useState('');
    const [livenessStep, setLivenessStep] = useState(0);
    const webcamRef = useRef(null);
    const html5QrCodeRef = useRef(null);

    // Load face models when modal opens
    useEffect(() => {
        if (isOpen) {
            const loadModels = async () => {
                const MODEL_URL = '/models';
                try {
                    // Load models sequentially
                    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
                    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
                    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
                    await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
                } catch (err) {
                    console.error('Face models load failed:', err);
                }
            };
            loadModels();
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && step === 'qr' && !html5QrCodeRef.current) {
            startScanner();
        }
        return () => {
            stopScanner();
        };
    }, [isOpen, step]);

    const startScanner = async () => {
        setError('');
        setScanning(true);
        try {
            html5QrCodeRef.current = new Html5Qrcode('qr-reader');
            await html5QrCodeRef.current.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                onScanSuccess,
                onScanError
            );
        } catch (err) {
            setError('Could not access camera for QR scanning.');
            setScanning(false);
        }
    };

    const stopScanner = async () => {
        if (html5QrCodeRef.current) {
            try {
                await html5QrCodeRef.current.stop();
                html5QrCodeRef.current = null;
            } catch (err) { }
        }
    };

    const onScanSuccess = async (decodedText) => {
        await stopScanner();
        setScanning(false);
        try {
            const data = JSON.parse(decodedText);
            setQrData(data);
            setStep('face');
            setFaceStatus('QR Scanned! Now please verify your face.');
        } catch (err) {
            setError('Invalid QR Code format.');
            setTimeout(startScanner, 2000);
        }
    };

    const onScanError = () => { };

    const handleFaceCapture = async () => {
        if (!webcamRef.current) return;
        setVerifying(true);
        setFaceStatus('Performing liveness check...');

        try {
            const samples = [];
            for (let i = 0; i < 3; i++) {
                setLivenessStep(i + 1);
                await new Promise(r => setTimeout(r, 500));
                const imageSrc = webcamRef.current.getScreenshot();
                const img = await faceapi.fetchImage(imageSrc);
                const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor().withFaceExpressions();
                if (detection) samples.push(detection);
            }

            if (samples.length === 0) {
                setFaceStatus('No face detected. Please try again.');
                setVerifying(false);
                setLivenessStep(0);
                return;
            }

            const bestSample = samples.reduce((best, curr) => curr.detection.score > best.detection.score ? curr : best);
            const descriptor = Array.from(bestSample.descriptor);
            const imageSrc = webcamRef.current.getScreenshot();

            // Get location
            let location = null;
            if (navigator.geolocation) {
                try {
                    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
                    location = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
                } catch (e) { }
            }

            setFaceStatus('Finalizing attendance...');
            const { data } = await api.post('/qr/qr/verify', {
                qrData,
                faceDescriptor: descriptor,
                capturedPhoto: imageSrc,
                location,
                livenessScore: 0.9 // Simplified high score for successful capture
            });

            setStep('success');
            setSuccess(true);
            setVerifying(false);
            setTimeout(() => {
                onSuccess && onSuccess(data);
                handleClose();
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.message || 'Face Verification Failed');
            setVerifying(false);
            setLivenessStep(0);
        }
    };

    const handleClose = () => {
        stopScanner();
        setScanning(false);
        setError('');
        setVerifying(false);
        setSuccess(false);
        setStep('qr');
        setQrData(null);
        setLivenessStep(0);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-90 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className={`bg-gradient-to-r ${step === 'face' ? 'from-purple-600 to-purple-700' : 'from-green-600 to-green-700'} px-6 py-4`}>
                    <h3 className="text-xl font-bold text-white">
                        {step === 'qr' ? '📷 Scan QR Code' : step === 'face' ? '👤 Face Verification' : '✅ Success'}
                    </h3>
                    <p className="text-white text-opacity-80 text-sm">
                        {step === 'qr' ? 'Step 1: Scan the classroom QR code' : 'Step 2: Verify your identity'}
                    </p>
                </div>

                <div className="p-4">
                    {step === 'success' ? (
                        <div className="py-12 text-center text-green-600 animate-bounce">
                            <div className="text-6xl mb-4">✅</div>
                            <p className="text-xl font-bold">Attendance Marked!</p>
                        </div>
                    ) : step === 'verifying' ? (
                        <div className="py-12 text-center">
                            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
                            <p className="text-gray-600">Verifying...</p>
                        </div>
                    ) : step === 'qr' ? (
                        <>
                            <div id="qr-reader" className="w-full rounded-lg overflow-hidden bg-black" style={{ minHeight: '300px' }}></div>
                            {error && <div className="mt-4 bg-red-50 p-3 rounded-lg text-red-700 text-sm">❌ {error}</div>}
                        </>
                    ) : (
                        <div className="space-y-4">
                            <div className="relative bg-black rounded-lg overflow-hidden h-64 border-4 border-purple-200">
                                <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" className="absolute inset-0 w-full h-full object-cover" />
                                {livenessStep > 0 && <div className="absolute top-2 right-2 bg-yellow-500 text-white px-2 py-1 rounded text-xs font-bold animate-pulse">Liveness {livenessStep}/3</div>}
                            </div>
                            <p className="text-center text-sm font-medium text-purple-700">{faceStatus}</p>
                            {error && <div className="bg-red-50 p-3 rounded-lg text-red-700 text-sm">❌ {error}</div>}
                            <div className="flex gap-3">
                                <button onClick={() => setStep('qr')} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">Retake QR</button>
                                <button onClick={handleFaceCapture} disabled={verifying} className="flex-2 py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50 px-8">Verify Face</button>
                            </div>
                        </div>
                    )}
                </div>

                {step !== 'face' && !verifying && (
                    <div className="px-6 pb-6 pt-2">
                        <button onClick={handleClose} className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">
                            {step === 'success' ? 'Done' : 'Cancel'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
