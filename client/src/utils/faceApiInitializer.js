import * as faceapi from '@vladmandic/face-api';

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
