# Face Verification Service
Python microservice for face recognition and liveness detection.

## Local Setup
```bash
cd face-service
pip install -r requirements.txt
python app.py
```

## Deploy on Render
1. Create new Web Service
2. Point to this repo, select `face-service` folder
3. Build command: `pip install -r requirements.txt`
4. Start command: `gunicorn app:app`
