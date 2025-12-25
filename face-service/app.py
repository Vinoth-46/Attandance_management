from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import base64
from io import BytesIO
from PIL import Image
import os
import tempfile

app = Flask(__name__)
CORS(app)

# Import DeepFace after app creation
from deepface import DeepFace

def decode_base64_to_file(base64_str):
    """Convert base64 string to temp file path"""
    try:
        if ',' in base64_str:
            base64_str = base64_str.split(',')[1]
        
        img_data = base64.b64decode(base64_str)
        img = Image.open(BytesIO(img_data))
        
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        temp_file = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False)
        img.save(temp_file.name)
        return temp_file.name
    except Exception as e:
        print(f"Image decode error: {e}")
        return None

def cleanup_file(path):
    try:
        if path and os.path.exists(path):
            os.unlink(path)
    except:
        pass

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'face-verification'})

@app.route('/detect', methods=['POST'])
def detect_face():
    """Detect face and return embedding"""
    img_path = None
    try:
        data = request.json
        image_base64 = data.get('image')
        
        if not image_base64:
            return jsonify({'success': False, 'error': 'No image provided'}), 400
        
        img_path = decode_base64_to_file(image_base64)
        if img_path is None:
            return jsonify({'success': False, 'error': 'Invalid image'}), 400
        
        embedding = DeepFace.represent(img_path, model_name='Facenet', enforce_detection=True)
        cleanup_file(img_path)
        
        if embedding:
            return jsonify({
                'success': True,
                'faceDetected': True,
                'faceDescriptor': embedding[0]['embedding']
            })
        else:
            return jsonify({'success': False, 'error': 'No face detected'}), 400
            
    except Exception as e:
        cleanup_file(img_path)
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/verify', methods=['POST'])
def verify_face():
    """Compare two faces"""
    img1_path = img2_path = None
    try:
        data = request.json
        registered_image = data.get('registeredImage')
        captured_image = data.get('capturedImage')
        
        if not registered_image or not captured_image:
            return jsonify({'success': False, 'error': 'Missing images'}), 400
        
        img1_path = decode_base64_to_file(registered_image)
        img2_path = decode_base64_to_file(captured_image)
        
        if not img1_path or not img2_path:
            cleanup_file(img1_path)
            cleanup_file(img2_path)
            return jsonify({'success': False, 'error': 'Invalid images'}), 400
        
        result = DeepFace.verify(img1_path, img2_path, model_name='Facenet', enforce_detection=True)
        cleanup_file(img1_path)
        cleanup_file(img2_path)
        
        return jsonify({
            'success': True,
            'match': result['verified'],
            'confidence': 1 - result['distance'],
            'distance': result['distance']
        })
        
    except Exception as e:
        cleanup_file(img1_path)
        cleanup_file(img2_path)
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/liveness', methods=['POST'])
def check_liveness():
    """Liveness check: Compare two images for movement"""
    img1_path = img2_path = None
    try:
        data = request.json
        image1_base64 = data.get('image1')
        image2_base64 = data.get('image2')
        
        if not image1_base64 or not image2_base64:
            return jsonify({'success': False, 'error': 'Need two images'}), 400
        
        img1_path = decode_base64_to_file(image1_base64)
        img2_path = decode_base64_to_file(image2_base64)
        
        if not img1_path or not img2_path:
            cleanup_file(img1_path)
            cleanup_file(img2_path)
            return jsonify({'success': False, 'error': 'Invalid images'}), 400
        
        # Get face embeddings from both images
        emb1 = DeepFace.represent(img1_path, model_name='Facenet', enforce_detection=True)
        emb2 = DeepFace.represent(img2_path, model_name='Facenet', enforce_detection=True)
        
        # Get face regions
        region1 = emb1[0]['facial_area']
        region2 = emb2[0]['facial_area']
        
        # Calculate movement
        movement = (
            abs(region1['x'] - region2['x']) +
            abs(region1['y'] - region2['y']) +
            abs(region1['w'] - region2['w']) +
            abs(region1['h'] - region2['h'])
        )
        
        # Compare embeddings to verify same person
        vec1 = np.array(emb1[0]['embedding'])
        vec2 = np.array(emb2[0]['embedding'])
        distance = np.linalg.norm(vec1 - vec2)
        same_person = distance < 10  # Facenet threshold
        
        # Liveness: some movement expected (>2 pixels)
        is_live = movement > 2 and same_person
        
        cleanup_file(img1_path)
        cleanup_file(img2_path)
        
        return jsonify({
            'success': True,
            'isLive': bool(is_live),
            'movement': float(movement),
            'samePerson': bool(same_person),
            'faceDescriptor': emb2[0]['embedding']
        })
        
    except Exception as e:
        cleanup_file(img1_path)
        cleanup_file(img2_path)
        return jsonify({'success': False, 'error': str(e)}), 400

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
