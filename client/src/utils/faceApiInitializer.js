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

            // 1. Try to Force CPU Backend for stability (if available)
            // In some bundling environments, faceapi.tf may not be properly exposed
            if (faceapi.tf && typeof faceapi.tf.setBackend === 'function') {
                try {
                    console.log("FaceAPI: Setting CPU backend...");
                    await faceapi.tf.setBackend('cpu');
                    await faceapi.tf.ready();
                    console.log("FaceAPI: Backend ready (cpu)");
                } catch (backendErr) {
                    console.warn("FaceAPI: Could not set backend explicitly, using default:", backendErr.message);
                    // Continue anyway - face-api will use its default backend
                }
            } else {
                console.warn("FaceAPI: tf.setBackend not available, using default backend");
                // This is okay - face-api.js will initialize its own backend when models load
            }

            // 2. Load models (this will trigger backend initialization if not already done)
            const MODEL_URL = '/models';

            console.log("FaceAPI: Loading models...");

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
