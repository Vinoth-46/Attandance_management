import * as faceapi from 'face-api.js';

// Singleton promise to prevent multiple initialization attempts
let initializationPromise = null;
let isInitialized = false;

export const initializeFaceApi = async () => {
    // If already initializing or initialized, return the existing promise
    if (initializationPromise) {
        return initializationPromise;
    }

    initializationPromise = (async () => {
        try {
            console.log("Initialize FaceAPI: Starting initialization sequence...");

            // Import TensorFlow core explicitly to ensure it's available
            let tf;
            try {
                const tfModule = await import('@tensorflow/tfjs-core');
                tf = tfModule.default || tfModule;
                console.log("FaceAPI: TensorFlow.js core imported successfully");
            } catch (importErr) {
                console.warn("FaceAPI: Could not import TensorFlow separately, using face-api's internal tf");
                tf = faceapi.tf;
            }

            // Set backend if tf is available
            if (tf && typeof tf.setBackend === 'function') {
                try {
                    console.log("FaceAPI: Configuring TensorFlow backend to CPU...");
                    await tf.setBackend('cpu');
                    await tf.ready();
                    console.log("FaceAPI: TensorFlow backend ready (CPU)");
                } catch (cpuErr) {
                    console.warn("FaceAPI: CPU backend failed, trying WebGL:", cpuErr.message);
                    try {
                        await tf.setBackend('webgl');
                        await tf.ready();
                        console.log("FaceAPI: TensorFlow backend ready (WebGL)");
                    } catch (webglErr) {
                        console.warn("FaceAPI: WebGL backend also failed, using default backend");
                        // Continue - let models initialize the backend
                    }
                }
            } else {
                console.warn("FaceAPI: TensorFlow setBackend not available, models will auto-initialize backend");
            }

            // Load models
            const MODEL_URL = '/models';

            console.log("FaceAPI: Loading models...");

            // Load necessary models in parallel
            await Promise.all([
                faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
            ]);

            console.log("FaceAPI: All models (SSD, Landmarks, Recognition) loaded successfully");
            isInitialized = true;
            return true;
        } catch (err) {
            console.error("FaceAPI Critical Initialization Error:", err);
            // Reset promise to allow retrying
            initializationPromise = null;
            isInitialized = false;
            return false;
        }
    })();

    return initializationPromise;
};
