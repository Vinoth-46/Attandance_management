import * as faceapi from 'face-api.js';

// Singleton promise to prevent multiple initialization attempts
let initializationPromise = null;

export const initializeFaceApi = async () => {
    // If already initializing or initialized, return the existing promise
    if (initializationPromise) {
        return initializationPromise;
    }

    initializationPromise = (async () => {
        try {
            console.log("Initialize FaceAPI: Starting initialization sequence...");

            // 1. Force CPU Backend for stability
            // This MUST happen before any other face-api operations to avoid WebGL crashes
            console.log("FaceAPI: Forcing CPU backend...");
            await faceapi.tf.setBackend('cpu');
            await faceapi.tf.ready();
            console.log("FaceAPI: Backend ready (cpu)");

            // 2. Load models
            const MODEL_URL = '/models';

            // Load necessary models in parallel
            await Promise.all([
                faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
            ]);

            console.log("FaceAPI: All models (SSD, Landmarks, Recognition) loaded successfully");
            return true;
        } catch (err) {
            console.error("FaceAPI Critical Initialization Error:", err);
            // Reset promise to allow retrying if it fails (though backend errors might be fatal)
            initializationPromise = null;
            return false;
        }
    })();

    return initializationPromise;
};
