import * as faceapi from 'face-api.js';

export const initializeFaceApi = async () => {
    try {
        console.log("Initialize FaceAPI: Pre-loading models...");

        // Instead of touching faceapi.tf directly (which causes crashes),
        // we simply load the models. This implicitly initializes the backend
        // and safely puts the models in cache for instant use later.

        const MODEL_URL = '/models';

        // Load sequentially to be safe
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        console.log("SSD MobileNet Loaded");

        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        console.log("Face Landmarks Loaded");

        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        console.log("Face Recognition Loaded");

        console.log("FaceAPI Fully Initialized & Models Cached");
        return true;
    } catch (err) {
        console.error("FaceAPI Initialization Warning:", err);
        // We ensure we don't crash the app if this fails
        return false;
    }
};
