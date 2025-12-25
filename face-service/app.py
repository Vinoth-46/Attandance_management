from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import base64
from io import BytesIO
from PIL import Image
import cv2
import os
from scipy.spatial import distance

app = Flask(__name__)
CORS(app)

# Download OpenCV's face detector cascade
CASCADE_PATH = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
face_cascade = cv2.CascadeClassifier(CASCADE_PATH)

def decode_base64_image(base64_str):
    """Convert base64 string to numpy array"""
    try:
        if ',' in base64_str:
            base64_str = base64_str.split(',')[1]
        
        img_data = base64.b64decode(base64_str)
        img = Image.open(BytesIO(img_data))
        
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        return np.array(img)
    except Exception as e:
        print(f"Image decode error: {e}")
        return None

def detect_face(image):
    """Detect face and return face region + simple descriptor"""
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.1, 4, minSize=(50, 50))
    
    if len(faces) == 0:
        return None, None
    
    # Get largest face
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    
    # Extract face region
    face_region = gray[y:y+h, x:x+w]
    
    # Resize to fixed size for comparison
    face_resized = cv2.resize(face_region, (64, 64))
    
    # Create simple descriptor (histogram + flattened pixels)
    hist = cv2.calcHist([face_resized], [0], None, [64], [0, 256]).flatten()
    hist = hist / hist.sum()  # Normalize
    
    return {'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h)}, hist.tolist()

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'face-verification'})

@app.route('/detect', methods=['POST'])
def detect():
    """Detect face and return descriptor"""
    try:
        data = request.json
        image_base64 = data.get('image')
        
        if not image_base64:
            return jsonify({'success': False, 'error': 'No image'}), 400
        
        image = decode_base64_image(image_base64)
        if image is None:
            return jsonify({'success': False, 'error': 'Invalid image'}), 400
        
        face_box, descriptor = detect_face(image)
        
        if face_box is None:
            return jsonify({'success': False, 'error': 'No face detected'}), 400
        
        return jsonify({
            'success': True,
            'faceDetected': True,
            'faceBox': face_box,
            'faceDescriptor': descriptor
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/verify', methods=['POST'])
def verify():
    """Compare two face descriptors"""
    try:
        data = request.json
        desc1 = data.get('registeredDescriptor')
        desc2 = data.get('capturedDescriptor')
        
        if not desc1 or not desc2:
            return jsonify({'success': False, 'error': 'Missing descriptors'}), 400
        
        # Calculate similarity using cosine distance
        similarity = 1 - distance.cosine(desc1, desc2)
        match = similarity > 0.7  # Threshold
        
        return jsonify({
            'success': True,
            'match': bool(match),
            'similarity': float(similarity)
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/liveness', methods=['POST'])
def liveness():
    """Check liveness by comparing two images for movement"""
    try:
        data = request.json
        image1_b64 = data.get('image1')
        image2_b64 = data.get('image2')
        
        if not image1_b64 or not image2_b64:
            return jsonify({'success': False, 'error': 'Need two images'}), 400
        
        img1 = decode_base64_image(image1_b64)
        img2 = decode_base64_image(image2_b64)
        
        if img1 is None or img2 is None:
            return jsonify({'success': False, 'error': 'Invalid images'}), 400
        
        # Detect faces
        face1, desc1 = detect_face(img1)
        face2, desc2 = detect_face(img2)
        
        if face1 is None or face2 is None:
            return jsonify({'success': False, 'error': 'Face not detected in both images'}), 400
        
        # Calculate movement
        movement = (
            abs(face1['x'] - face2['x']) +
            abs(face1['y'] - face2['y']) +
            abs(face1['w'] - face2['w']) +
            abs(face1['h'] - face2['h'])
        )
        
        # Check if same person (histogram similarity)
        similarity = 1 - distance.cosine(desc1, desc2)
        same_person = similarity > 0.6
        
        # Liveness: some movement (>3 pixels) and same person
        is_live = movement > 3 and same_person
        
        return jsonify({
            'success': True,
            'isLive': bool(is_live),
            'movement': float(movement),
            'samePerson': bool(same_person),
            'similarity': float(similarity),
            'faceDescriptor': desc2
        })
        
    except Exception as e:
        print(f"Liveness error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
