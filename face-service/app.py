from flask import Flask, request, jsonify
from flask_cors import CORS
import face_recognition
import numpy as np
import base64
from io import BytesIO
from PIL import Image
import os

app = Flask(__name__)
CORS(app)

def decode_base64_image(base64_str):
    """Convert base64 string to numpy array for face_recognition"""
    try:
        # Handle data URL format
        if ',' in base64_str:
            base64_str = base64_str.split(',')[1]
        
        img_data = base64.b64decode(base64_str)
        img = Image.open(BytesIO(img_data))
        
        # Convert to RGB if needed
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        return np.array(img)
    except Exception as e:
        print(f"Image decode error: {e}")
        return None

def encode_face(image_array):
    """Get face encoding from image"""
    try:
        encodings = face_recognition.face_encodings(image_array)
        if encodings:
            return encodings[0].tolist()
        return None
    except Exception as e:
        print(f"Face encoding error: {e}")
        return None

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'face-verification'})

@app.route('/detect', methods=['POST'])
def detect_face():
    """Detect face and return encoding"""
    try:
        data = request.json
        image_base64 = data.get('image')
        
        if not image_base64:
            return jsonify({'success': False, 'error': 'No image provided'}), 400
        
        # Decode image
        image_array = decode_base64_image(image_base64)
        if image_array is None:
            return jsonify({'success': False, 'error': 'Invalid image format'}), 400
        
        # Find faces
        face_locations = face_recognition.face_locations(image_array)
        
        if not face_locations:
            return jsonify({'success': False, 'error': 'No face detected'}), 400
        
        # Get face encoding
        encoding = encode_face(image_array)
        
        if encoding is None:
            return jsonify({'success': False, 'error': 'Could not encode face'}), 400
        
        return jsonify({
            'success': True,
            'faceDetected': True,
            'faceCount': len(face_locations),
            'faceDescriptor': encoding
        })
        
    except Exception as e:
        print(f"Detection error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/verify', methods=['POST'])
def verify_face():
    """Compare two faces and check if they match"""
    try:
        data = request.json
        
        registered_encoding = data.get('registeredDescriptor')  # From database
        captured_image = data.get('capturedImage')  # New photo base64
        
        if not registered_encoding or not captured_image:
            return jsonify({'success': False, 'error': 'Missing data'}), 400
        
        # Decode captured image
        image_array = decode_base64_image(captured_image)
        if image_array is None:
            return jsonify({'success': False, 'error': 'Invalid image'}), 400
        
        # Get encoding from captured image
        captured_encoding = encode_face(image_array)
        if captured_encoding is None:
            return jsonify({'success': False, 'error': 'No face in captured image'}), 400
        
        # Convert registered encoding to numpy array
        registered_np = np.array(registered_encoding)
        captured_np = np.array(captured_encoding)
        
        # Compare faces
        distance = face_recognition.face_distance([registered_np], captured_np)[0]
        match = distance < 0.6  # Standard threshold
        
        return jsonify({
            'success': True,
            'match': bool(match),
            'confidence': float(1 - distance),
            'distance': float(distance)
        })
        
    except Exception as e:
        print(f"Verification error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/liveness', methods=['POST'])
def check_liveness():
    """
    Simple liveness check: Compare two images taken moments apart.
    Real faces have micro-movements, photos are static.
    """
    try:
        data = request.json
        image1_base64 = data.get('image1')
        image2_base64 = data.get('image2')
        
        if not image1_base64 or not image2_base64:
            return jsonify({'success': False, 'error': 'Need two images'}), 400
        
        # Decode images
        img1 = decode_base64_image(image1_base64)
        img2 = decode_base64_image(image2_base64)
        
        if img1 is None or img2 is None:
            return jsonify({'success': False, 'error': 'Invalid images'}), 400
        
        # Find face locations
        loc1 = face_recognition.face_locations(img1)
        loc2 = face_recognition.face_locations(img2)
        
        if not loc1 or not loc2:
            return jsonify({'success': False, 'error': 'Face not detected in both images'}), 400
        
        # Get face positions
        top1, right1, bottom1, left1 = loc1[0]
        top2, right2, bottom2, left2 = loc2[0]
        
        # Calculate movement (real people have tiny natural movements)
        movement = abs(top1 - top2) + abs(left1 - left2) + abs(right1 - right2) + abs(bottom1 - bottom2)
        
        # Get encodings to verify it's the same person
        enc1 = face_recognition.face_encodings(img1, loc1)
        enc2 = face_recognition.face_encodings(img2, loc2)
        
        if not enc1 or not enc2:
            return jsonify({'success': False, 'error': 'Could not encode faces'}), 400
        
        # Check if same person
        same_person = face_recognition.compare_faces([enc1[0]], enc2[0], tolerance=0.6)[0]
        
        # Liveness: some movement expected (>1 pixel), but not too much (<50 pixels)
        # Static photos have 0 movement
        is_live = movement > 1 and movement < 100 and same_person
        
        return jsonify({
            'success': True,
            'isLive': bool(is_live),
            'movement': float(movement),
            'samePerson': bool(same_person),
            'faceDescriptor': enc2[0].tolist() if enc2 else None
        })
        
    except Exception as e:
        print(f"Liveness error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
