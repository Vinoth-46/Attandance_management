# Render Deployment Guide for Attendance Management System

## Overview
This guide explains how to deploy both the frontend (React) and backend (Node.js) on Render.

---

## 🖥️ Backend Deployment (Web Service)

### 1. Create a New Web Service
- Go to Render Dashboard → New → Web Service
- Connect your GitHub repository

### 2. Configure the Service
| Setting | Value |
|---------|-------|
| Name | `attendance-api` (or your choice) |
| Root Directory | `server` |
| Environment | `Node` |
| Build Command | `npm install` |
| Start Command | `npm start` |

### 3. Environment Variables
Add these environment variables in Render:

```
NODE_ENV=production
JWT_SECRET=<generate a 64+ character random string>
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/attendance_system
ALLOWED_ORIGINS=https://your-frontend-name.onrender.com
PORT=10000
```

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 🌐 Frontend Deployment (Static Site)

### 1. Create a New Static Site
- Go to Render Dashboard → New → Static Site
- Connect your GitHub repository

### 2. Configure the Site
| Setting | Value |
|---------|-------|
| Name | `attendance-app` (or your choice) |
| Root Directory | `client` |
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |

### 3. Environment Variables
Add these environment variables in Render:

```
VITE_API_URL=https://your-backend-name.onrender.com
VITE_MAINTENANCE_MODE=false
```

### 4. Redirect Rules
Add this redirect rule for SPA routing:
- Source: `/*`
- Destination: `/index.html`
- Status: `200`

---

## 🔧 Maintenance Mode

To enable maintenance mode:
1. Go to your Frontend Static Site on Render
2. Go to Environment → Environment Variables
3. Change `VITE_MAINTENANCE_MODE` to `true`
4. Click "Save Changes"
5. Trigger a manual deploy

To disable:
- Set `VITE_MAINTENANCE_MODE` back to `false` and redeploy

---

## 📊 Database Setup (MongoDB Atlas)

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Create a free cluster
3. Create a database user
4. Whitelist all IPs (0.0.0.0/0) for Render access
5. Copy the connection string
6. Use it as `MONGO_URI` in your backend

---

## 🌱 Initial Data Seeding

After first deployment, seed the database:

1. Open Render Shell for your backend service
2. Run: `node seedDatabase.js`

### Default Credentials:
| Role | Username | Password |
|------|----------|----------|
| Principal (Super Admin) | `principal@college.edu` | `password123` |
| HOD | `hod` | `password123` |
| Staff | `staff` | `password123` |
| Student | `1` (roll number) | `01-01-2005` |

---

## 🔗 URLs After Deployment

- **Frontend:** `https://your-frontend-name.onrender.com`
- **Backend:** `https://your-backend-name.onrender.com`
- **API Health Check:** `https://your-backend-name.onrender.com/`

---

## ⚠️ Important Notes

1. **Free Tier Limitations:** Render free tier services spin down after inactivity. First request may take 30-60 seconds.

2. **CORS:** Make sure `ALLOWED_ORIGINS` in backend matches your frontend URL.

3. **WebSockets:** Render supports WebSockets out of the box.

4. **HTTPS:** Render provides free SSL/HTTPS automatically.
