import * as faceapi from 'face-api.js';

export const initializeFaceApi = async () => {
    try {
        console.log("Initialize FaceAPI: Checking backend...");

        // 1. Force backend if not set
        if (!faceapi.tf.getBackend()) {
            console.log("No backend found. Attempting to set WebGL...");
            try {
                await faceapi.tf.setBackend('webgl');
            } catch (err) {
                console.warn("WebGL failed. Falling back to CPU.", err);
                await faceapi.tf.setBackend('cpu');
            }
        }

        // 2. Wait for ready state
        await faceapi.tf.ready();

        console.log(`FaceAPI Ready. Backend: ${faceapi.tf.getBackend()}`);
        return true;
    } catch (err) {
        console.error("FaceAPI Initialization Failed:", err);
        return false;
    }
};
