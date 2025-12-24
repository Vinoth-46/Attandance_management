# Deploying to Render (Unified Service)

This guide explains how to deploy the Attendance Management System on Render as a **Unified Service** (Backend serves Frontend).

## Prerequisites
- Push your latest code to GitHub
- Have a MongoDB Atlas account with a database ready

---

## Step 1: Create New Web Service on Render

1. Log in to [dashboard.render.com](https://dashboard.render.com)
2. Click **New +** → **Web Service**
3. Connect your GitHub repository: `Attandance_management`

---

## Step 2: Configure Settings

| Setting | Value |
|---------|-------|
| **Name** | `attendance-system` (or your choice) |
| **Region** | Closest to you (e.g., Singapore, Oregon) |
| **Branch** | `main` |
| **Root Directory** | **LEAVE BLANK** (empty) |
| **Runtime** | `Node` |
| **Build Command** | `npm run build` |
| **Start Command** | `npm start` |
| **Instance Type** | Free |

> ⚠️ **Important**: Leave "Root Directory" completely empty!

---

## Step 3: Environment Variables

Click **"Advanced"** and add these environment variables:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `MONGO_URI` | Your MongoDB Atlas connection string |
| `JWT_SECRET` | Your generated secret key (see below) |
| `CLIENT_URL` | `https://your-app-name.onrender.com` |

### Generate JWT_SECRET
Run this in your terminal:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Your JWT_SECRET (already generated):
```
e12e44d4aab0fd5da94c957a39c5545f00276a78afc6e3c60865e8c152dacdd4ac095485b8f1eb4437c8e7e571f34091565d11d643fb609c1994bddc30ee16e04
```

---

## Step 4: Deploy

Click **Create Web Service**

Render will:
1. ✅ Install backend dependencies (`server/`)
2. ✅ Install frontend dependencies (`client/`)
3. ✅ Build React frontend to `client/dist`
4. ✅ Start the backend server (which serves the frontend)

**First deployment takes 5-10 minutes.**

---

## Step 5: Seed the Database

After deployment completes:

1. Go to your Web Service in Render
2. Click the **Shell** tab
3. Run:
```bash
node server/seedDatabase.js
```

---

## Step 6: Update CLIENT_URL

After you get your Render URL:

1. Go to **Environment** tab
2. Update `CLIENT_URL` to your actual URL:
   ```
   CLIENT_URL=https://attendance-system-xxxx.onrender.com
   ```
3. Click **Save Changes** (service will redeploy)

---

## 🎉 Done!

Your app is live at: `https://your-app-name.onrender.com`

### Default Login Credentials

| Role | Username | Password |
|------|----------|----------|
| Principal | `principal@college.edu` | `password123` |
| HOD | `hod` | `password123` |
| Staff | `staff` | `password123` |
| Student | `1` | `01-01-2005` |

---

## 🔧 Maintenance Mode

To enable maintenance mode:
1. Go to **Environment** in Render
2. Add: `VITE_MAINTENANCE_MODE=true`
3. Trigger a new deploy

---

## Troubleshooting

### "Service Root Directory is missing"
- You typed something in **Root Directory**. Clear it completely and save.

### Build Failed
- Check the build logs in Render
- Make sure `package.json` exists at the root level

### White Screen
- Check browser console for errors
- Verify the build completed successfully

### Socket/Real-time Issues
- Ensure `CLIENT_URL` matches your browser URL exactly
- Check that WebSocket connections are not blocked
