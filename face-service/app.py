from flask import Flask, request, jsonify
from flask_cors import CORS
from deepface import DeepFace
import numpy as np
import base64
from io import BytesIO
from PIL import Image
import os
import tempfile

app = Flask(__name__)
CORS(app)

def decode_base64_to_file(base64_str):
    """Convert base64 string to temp file path"""
    try:
        if ',' in base64_str:
            base64_str = base64_str.split(',')[1]
        
        img_data = base64.b64decode(base64_str)
        img = Image.open(BytesIO(img_data))
        
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Save to temp file (DeepFace needs file path)
        temp_file = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False)
        img.save(temp_file.name)
        return temp_file.name
    except Exception as e:
        print(f"Image decode error: {e}")
        return None

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'face-verification'})

@app.route('/detect', methods=['POST'])
def detect_face():
    """Detect face and return embedding"""
    try:
        data = request.json
        image_base64 = data.get('image')
        
        if not image_base64:
            return jsonify({'success': False, 'error': 'No image provided'}), 400
        
        img_path = decode_base64_to_file(image_base64)
        if img_path is None:
            return jsonify({'success': False, 'error': 'Invalid image'}), 400
        
        try:
            # Get face embedding using DeepFace
            embedding = DeepFace.represent(img_path, model_name='Facenet', enforce_detection=True)
            
            os.unlink(img_path)  # Clean up temp file
            
            if embedding:
                return jsonify({
                    'success': True,
                    'faceDetected': True,
                    'faceDescriptor': embedding[0]['embedding']
                })
            else:
                return jsonify({'success': False, 'error': 'No face detected'}), 400
                
        except Exception as e:
            os.unlink(img_path)
            return jsonify({'success': False, 'error': f'Face detection failed: {str(e)}'}), 400
        
    except Exception as e:
        print(f"Detection error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/verify', methods=['POST'])
def verify_face():
    """Compare two faces"""
    try:
        data = request.json
        registered_image = data.get('registeredImage')
        captured_image = data.get('capturedImage')
        
        if not registered_image or not captured_image:
            return jsonify({'success': False, 'error': 'Missing images'}), 400
        
        img1_path = decode_base64_to_file(registered_image)
        img2_path = decode_base64_to_file(captured_image)
        
        if not img1_path or not img2_path:
            return jsonify({'success': False, 'error': 'Invalid images'}), 400
        
        try:
            result = DeepFace.verify(img1_path, img2_path, model_name='Facenet', enforce_detection=True)
            
            os.unlink(img1_path)
            os.unlink(img2_path)
            
            return jsonify({
                'success': True,
                'match': result['verified'],
                'confidence': 1 - result['distance'],
                'distance': result['distance']
            })
            
        except Exception as e:
            if img1_path and os.path.exists(img1_path): os.unlink(img1_path)
            if img2_path and os.path.exists(img2_path): os.unlink(img2_path)
            return jsonify({'success': False, 'error': str(e)}), 400
        
    except Exception as e:
        print(f"Verification error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/liveness', methods=['POST'])
def check_liveness():
    """Liveness check: Compare two images for movement"""
    try:
        data = request.json
        image1_base64 = data.get('image1')
        image2_base64 = data.get('image2')
        
        if not image1_base64 or not image2_base64:
            return jsonify({'success': False, 'error': 'Need two images'}), 400
        
        img1_path = decode_base64_to_file(image1_base64)
        img2_path = decode_base64_to_file(image2_base64)
        
        if not img1_path or not img2_path:
            return jsonify({'success': False, 'error': 'Invalid images'}), 400
        
        try:
            # Get face embeddings from both images
            emb1 = DeepFace.represent(img1_path, model_name='Facenet', enforce_detection=True)
            emb2 = DeepFace.represent(img2_path, model_name='Facenet', enforce_detection=True)
            
            if not emb1 or not emb2:
                os.unlink(img1_path)
                os.unlink(img2_path)
                return jsonify({'success': False, 'error': 'Face not detected'}), 400
            
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
            same_person = distance < 0.6
            
            # Liveness: some movement expected (>2 pixels)
            is_live = movement > 2 and same_person
            
            os.unlink(img1_path)
            os.unlink(img2_path)
            
            return jsonify({
                'success': True,
                'isLive': bool(is_live),
                'movement': float(movement),
                'samePerson': bool(same_person),
                'faceDescriptor': emb2[0]['embedding']
            })
            
        except Exception as e:
            if img1_path and os.path.exists(img1_path): os.unlink(img1_path)
            if img2_path and os.path.exists(img2_path): os.unlink(img2_path)
            return jsonify({'success': False, 'error': str(e)}), 400
        
    except Exception as e:
        print(f"Liveness error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
