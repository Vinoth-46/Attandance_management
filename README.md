# 📚 Attendance Management System

A comprehensive, modern attendance management system built with the MERN stack (MongoDB, Express.js, React, Node.js).

## ✨ Features

### For Students
- 📱 Mark attendance via Face Recognition or QR Code
- 📊 View attendance history and statistics
- 📝 Request leave with approval workflow
- 👤 Manage personal profile

### For Staff
- 📋 Start attendance sessions with geofencing
- 📷 QR Code generation for attendance
- 👥 Manage students in their class
- 📊 View real-time attendance reports
- ✏️ Manual attendance marking

### For HOD (Head of Department)
- 👨‍🏫 Manage staff members
- 📊 Department-wise statistics
- 🔑 Password reset for staff
- 📋 Assign Faculty Advisors

### For Principal (Super Admin)
- 🏫 Complete system overview
- 👥 Manage all HODs and staff
- 📊 Global attendance statistics
- ⚙️ System configuration

## 🛠️ Tech Stack

- **Frontend:** React 18, Vite, TailwindCSS
- **Backend:** Node.js, Express.js
- **Database:** MongoDB
- **Real-time:** Socket.io
- **Authentication:** JWT
- **Face Recognition:** face-api.js

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd attendance-system

# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### Configuration

1. Create `.env` file in the `server` directory:
```env
MONGO_URI=mongodb://localhost:27017/attendance_system
JWT_SECRET=your_secure_secret_key_here
PORT=5000
NODE_ENV=development
```

2. Start the development servers:
```bash
# Backend (from server directory)
npm run dev

# Frontend (from client directory)
npm run dev
```

### Seed Database
```bash
cd server
node seedDatabase.js
```

## 📦 Deployment

See [RENDER_DEPLOY.md](./RENDER_DEPLOY.md) for detailed deployment instructions.

## 🔐 Default Credentials

| Role | Username | Password |
|------|----------|----------|
| Principal | `principal@college.edu` | `password123` |
| HOD | `hod` | `password123` |
| Staff | `staff` | `password123` |
| Student | `1` | `01-01-2005` |

## 📁 Project Structure

```
attendance-system/
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── context/       # React contexts
│   │   ├── pages/         # Page components
│   │   └── services/      # API services
│   └── dist/              # Production build
│
├── server/                 # Express Backend
│   ├── controllers/       # Route controllers
│   ├── middleware/        # Custom middleware
│   ├── models/            # Mongoose models
│   ├── routes/            # API routes
│   └── index.js           # Entry point
│
└── RENDER_DEPLOY.md       # Deployment guide
```

## 🔒 Security Features

- ✅ Rate limiting (DOS protection)
- ✅ Helmet security headers
- ✅ NoSQL injection prevention
- ✅ JWT authentication with session management
- ✅ Password hashing with bcrypt
- ✅ CORS configuration
- ✅ Input validation

## 📄 License

MIT License

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
