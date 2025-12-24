import { useState, useRef, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import Webcam from 'react-webcam';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ProfileCompletionModal({ onComplete }) {
    const { user, setUser } = useAuth();
    const webcamRef = useRef(null);
    const fileInputRef = useRef(null);

    // State
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [mode, setMode] = useState('webcam'); // 'webcam' or 'upload'
    const [previewUrl, setPreviewUrl] = useState(null);
    const [faceDescriptor, setFaceDescriptor] = useState(null);
    const [status, setStatus] = useState('Ready.');

    // Form state
    const [formData, setFormData] = useState({
        phone: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        bloodGroup: '',
        fatherName: '',
        motherName: '',
        parentPhone: '',
        emergencyContact: ''
    });

    // Load Face API Models
    useEffect(() => {
        const loadModels = async () => {
            try {
                setLoading(true);
                setStatus('Loading AI models...');
                const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
                ]);
                setStatus('Ready.');
                setLoading(false);
            } catch (error) {
                console.error("Error loading face-api models:", error);
                setStatus('Error loading models.');
                setLoading(false);
            }
        };
        loadModels();
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;

        // Validate phone numbers (only digits, max 10)
        if (name === 'phone' || name === 'parentPhone' || name === 'emergencyContact') {
            const numericValue = value.replace(/\D/g, '').slice(0, 10);
            setFormData(prev => ({ ...prev, [name]: numericValue }));
            return;
        }

        // Validate pincode (only digits, max 6)
        if (name === 'pincode') {
            const numericValue = value.replace(/\D/g, '').slice(0, 6);
            setFormData(prev => ({ ...prev, [name]: numericValue }));
            return;
        }

        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const processFace = async (imageSrc) => {
        try {
            setLoading(true);
            setStatus('Analyzing face...');

            const img = await faceapi.fetchImage(imageSrc);
            const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

            if (detection) {
                setFaceDescriptor(detection.descriptor);
                setStatus('Face detected! ✅');
            } else {
                setFaceDescriptor(null);
                setStatus('No face detected. Please try again. ❌');
            }
        } catch (error) {
            console.error("Face processing error:", error);
            setStatus('Error processing image. ❌');
            setFaceDescriptor(null);
        } finally {
            setLoading(false);
        }
    };

    const handleWebcamCapture = async () => {
        if (webcamRef.current) {
            const imageSrc = webcamRef.current.getScreenshot();
            if (imageSrc) {
                setPreviewUrl(imageSrc);
                await processFace(imageSrc);
            }
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const imageSrc = reader.result;
                setPreviewUrl(imageSrc);
                await processFace(imageSrc);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        // Prevent rapid clicking
        if (submitting) return;

        if (step === 1) {
            // Validate Step 1
            const requiredFields = ['phone', 'address', 'city', 'state', 'fatherName', 'parentPhone'];
            const missing = requiredFields.filter(field => !formData[field]);

            if (missing.length > 0) {
                alert(`Please fill in all required fields: ${missing.join(', ')}`);
                return;
            }
            setStep(2);
        } else {
            // Submit Profile
            if (!faceDescriptor) {
                alert("Please capture or upload a photo with a visible face.");
                return;
            }

            try {
                setSubmitting(true);
                // Convert Float32Array to regular array for JSON serialization
                const descriptorArray = Array.from(faceDescriptor);

                await api.put('/students/complete-profile', {
                    ...formData,
                    faceDescriptor: descriptorArray,
                    profilePhoto: previewUrl // Optional: send base64 photo to save
                });

                // Update local user context if needed, or just close
                if (setUser) {
                    const updatedUser = await api.get('/auth/profile');
                    setUser(updatedUser.data);
                }

                alert('Profile completed successfully!');
                onComplete();
            } catch (error) {
                console.error("Profile submission error:", error);
                alert('Failed to save profile. Please try again.');
            } finally {
                setSubmitting(false);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 relative flex flex-col max-h-[90vh]">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Complete Your Profile</h2>

                <div className="flex-1 overflow-y-auto pr-2">
                    {/* Step 1: Bio Data */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <h3 className="font-semibold text-gray-900 mb-4">Personal Information</h3>

                            {/* Added Student Phone Field */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Student Phone *</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleInputChange}
                                    maxLength={10}
                                    pattern="[0-9]{10}"
                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                                    placeholder="Your 10-digit mobile number"
                                    required
                                />
                                {formData.phone && formData.phone.length < 10 && (
                                    <span className="text-xs text-orange-500">Enter 10 digits ({formData.phone.length}/10)</span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                                    <textarea
                                        name="address"
                                        value={formData.address}
                                        onChange={handleInputChange}
                                        rows="2"
                                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                                        placeholder="Enter your full address"
                                        required
                                    />
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                                        <input
                                            type="text"
                                            name="city"
                                            value={formData.city}
                                            onChange={handleInputChange}
                                            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                                            <input
                                                type="text"
                                                name="state"
                                                value={formData.state}
                                                onChange={handleInputChange}
                                                className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                                            <input
                                                type="text"
                                                name="pincode"
                                                value={formData.pincode}
                                                onChange={handleInputChange}
                                                maxLength={6}
                                                pattern="[0-9]{6}"
                                                className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                                                placeholder="6 digits"
                                            />
                                            {formData.pincode && formData.pincode.length < 6 && formData.pincode.length > 0 && (
                                                <span className="text-xs text-orange-500">{formData.pincode.length}/6 digits</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
                                    <select
                                        name="bloodGroup"
                                        value={formData.bloodGroup}
                                        onChange={handleInputChange}
                                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                                    >
                                        <option value="">Select</option>
                                        <option value="A+">A+</option>
                                        <option value="A-">A-</option>
                                        <option value="B+">B+</option>
                                        <option value="B-">B-</option>
                                        <option value="O+">O+</option>
                                        <option value="O-">O-</option>
                                        <option value="AB+">AB+</option>
                                        <option value="AB-">AB-</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Father's Name *</label>
                                    <input
                                        type="text"
                                        name="fatherName"
                                        value={formData.fatherName}
                                        onChange={handleInputChange}
                                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Mother's Name</label>
                                    <input
                                        type="text"
                                        name="motherName"
                                        value={formData.motherName}
                                        onChange={handleInputChange}
                                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Parent's Phone *</label>
                                    <input
                                        type="tel"
                                        name="parentPhone"
                                        value={formData.parentPhone}
                                        onChange={handleInputChange}
                                        maxLength={10}
                                        pattern="[0-9]{10}"
                                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                                        placeholder="10-digit mobile number"
                                        required
                                    />
                                    {formData.parentPhone && formData.parentPhone.length < 10 && (
                                        <span className="text-xs text-orange-500">{formData.parentPhone.length}/10 digits</span>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
                                    <input
                                        type="tel"
                                        name="emergencyContact"
                                        value={formData.emergencyContact}
                                        onChange={handleInputChange}
                                        maxLength={10}
                                        pattern="[0-9]{10}"
                                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                                        placeholder="10-digit number (optional)"
                                    />
                                    {formData.emergencyContact && formData.emergencyContact.length < 10 && formData.emergencyContact.length > 0 && (
                                        <span className="text-xs text-orange-500">{formData.emergencyContact.length}/10 digits</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Face Photo */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <h3 className="font-semibold text-gray-900 mb-2">Upload Your Face Photo</h3>
                            <p className="text-sm text-gray-500 mb-4">
                                This photo will be used for face recognition attendance. Make sure your face is clearly visible.
                            </p>

                            {/* Mode Tabs */}
                            <div className="flex border-b border-gray-200 mb-4">
                                <button
                                    onClick={() => { setMode('upload'); setPreviewUrl(null); setFaceDescriptor(null); }}
                                    className={`px-4 py-2 text-sm font-medium ${mode === 'upload' ? 'border-b-2 border-brand-600 text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    📁 Upload Photo
                                </button>
                                <button
                                    onClick={() => { setMode('webcam'); setPreviewUrl(null); setFaceDescriptor(null); }}
                                    className={`px-4 py-2 text-sm font-medium ${mode === 'webcam' ? 'border-b-2 border-brand-600 text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    📷 Use Webcam
                                </button>
                            </div>

                            {/* Upload Mode */}
                            {mode === 'upload' && (
                                <div className="relative bg-gray-100 rounded-lg overflow-hidden h-64 flex items-center justify-center border-2 border-dashed border-gray-300 hover:border-brand-500 transition-colors">
                                    {previewUrl ? (
                                        <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
                                    ) : (
                                        <div className="text-center">
                                            <p className="mt-2 text-sm text-gray-600">Click to upload your photo</p>
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

                            {/* Webcam Mode */}
                            {mode === 'webcam' && (
                                <div className="space-y-4">
                                    <div className="relative bg-black rounded-lg overflow-hidden h-64 flex items-center justify-center">
                                        {loading ? (
                                            <div className="text-center">
                                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-2"></div>
                                                <p className="text-white text-sm">{status}</p>
                                            </div>
                                        ) : previewUrl ? (
                                            <img src={previewUrl} alt="Captured" className="max-h-full max-w-full object-contain" />
                                        ) : (
                                            <Webcam
                                                audio={false}
                                                ref={webcamRef}
                                                screenshotFormat="image/jpeg"
                                                className="absolute inset-0 w-full h-full object-cover"
                                            />
                                        )}
                                    </div>
                                    {!previewUrl && (
                                        <button
                                            onClick={handleWebcamCapture}
                                            disabled={loading}
                                            className="w-full py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-500 disabled:opacity-50"
                                        >
                                            📸 Capture Photo
                                        </button>
                                    )}
                                    {previewUrl && (
                                        <button
                                            onClick={() => { setPreviewUrl(null); setFaceDescriptor(null); setStatus('Ready.'); }}
                                            className="w-full py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
                                        >
                                            🔄 Retake Photo
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Status */}
                            <p className={`text-center font-medium ${status.includes('✅') ? 'text-green-600' : status.includes('❌') ? 'text-red-600' : 'text-brand-600'}`}>
                                {status}
                            </p>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="mt-6 flex justify-between pt-4 border-t border-gray-100">
                    {step === 2 && (
                        <button
                            onClick={() => setStep(1)}
                            className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                            ← Back
                        </button>
                    )}
                    <div className="ml-auto">
                        <button
                            onClick={handleSubmit}
                            disabled={submitting || (step === 2 && !faceDescriptor)}
                            className="px-6 py-2 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? 'Saving...' : step === 1 ? 'Next →' : 'Complete Profile'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
