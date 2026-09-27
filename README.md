# 🅿 TPMS — Traffic & Parking Management System

Full-stack web application with real-time parking management, YOLO-based illegal parking detection, complaint system, traffic prediction, and emergency services.

---

## 📁 Project Structure

```
traffic-parking-ps/
├── backend/
│   ├── core/           → DB, config, security (JWT)
│   ├── models/         → SQLAlchemy models
│   ├── routes/         → FastAPI route files
│   ├── services/       → PDF, SMS services
│   ├── yolo/           → YOLO detector + training script
│   ├── main.py         → FastAPI app entry
│   ├── seed.py         → DB seeder (run once)
│   ├── requirements.txt
│   └── .env            → fill in your API keys
├── frontend/
│   ├── src/
│   │   ├── pages/      → Login, Map, Bookings, Complaints, etc.
│   │   ├── components/ → Navbar, BookingModal, TrafficPanel
│   │   ├── store/      → Redux slices
│   │   └── utils/      → axios API, voice alerts
│   └── package.json
├── docker-compose.yml
├── setup_windows.bat   → one-click setup
└── start.bat           → one-click start
```

---

## ⚙️ Prerequisites — Install These First

| Tool | Download |
|------|----------|
| Python 3.11+ | https://python.org/downloads |
| Node.js 20+ | https://nodejs.org |
| Docker Desktop | https://docker.com/products/docker-desktop |
| Git | https://git-scm.com |

---

## 🚀 Setup — Step by Step (Windows)

### Option A — Automatic (Recommended)
```
Double-click setup_windows.bat
```
Then double-click `start.bat` to run both servers.

---

### Option B — Manual

#### 1. Start Database + Redis
```bash
docker-compose up -d db redis
```
Wait ~10 seconds for them to be ready.

#### 2. Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python seed.py
uvicorn main:app --reload --port 8000
```

#### 3. Frontend Setup (new terminal)
```bash
cd frontend
npm install
npm run dev
```

#### 4. Open browser
```
http://localhost:5173
```

---

## 🔑 Login Credentials (after seeding)

| Role   | Email               | Password  |
|--------|---------------------|-----------|
| Admin  | admin@tpms.com      | admin123  |
| Vendor | vendor@tpms.com     | vendor123 |
| User   | user@tpms.com       | user123   |

---

## 🔧 Environment Variables

Edit `backend/.env` and fill in your keys:

```env
# Database (auto-filled if using Docker)
DATABASE_URL=postgresql://postgres:password@localhost:5432/tpms_db

# Google Maps — get from console.cloud.google.com
# (also replace YOUR_GOOGLE_MAPS_KEY in frontend/index.html)

# Razorpay — get from dashboard.razorpay.com
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx

# Cloudinary — get from cloudinary.com (free tier)
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx

# Twilio — get from twilio.com/console (free trial)
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1234567890
POLICE_PHONE_NUMBER=+0987654321
```

---

## 🤖 YOLO Setup

### Without trained model (dev mode)
The system works immediately with mock detections. No model needed to test the UI.

### With your trained model
1. Go to https://roboflow.com → create project → label parking images
2. Export as **YOLOv11** format
3. Place dataset in `backend/yolo/dataset/`
4. Train:
```bash
cd backend/yolo
pip install ultralytics
python train_yolo.py train
```
5. After training, the ONNX model is auto-copied to `backend/yolo/model.onnx`

---

## 📡 API Documentation

After starting backend, visit:
```
http://localhost:8000/docs
```
This shows all API endpoints with interactive testing (Swagger UI).

---

## 🐳 Full Docker Deployment

```bash
docker-compose up --build
```
Opens at `http://localhost:5173`

---

## ✅ Features Implemented

| Feature | Status |
|---------|--------|
| JWT Auth (login/register/roles) | ✅ |
| Live parking map (Google Maps) | ✅ |
| Slot booking + Razorpay payment | ✅ |
| PDF receipt generation | ✅ |
| Traffic heatmap overlay | ✅ |
| Peak hour prediction | ✅ |
| YOLO illegal parking detection | ✅ |
| Real-time WebSocket alerts | ✅ |
| Geo-tagged complaints | ✅ |
| Photo upload (Cloudinary) | ✅ |
| Points system + redemption | ✅ |
| Fine PDF generation | ✅ |
| Police SMS notification (Twilio) | ✅ |
| Admin dashboard + charts | ✅ |
| Vendor zone management | ✅ |
| Emergency one-tap calls | ✅ |
| Hindi/English multilingual | ✅ |
| Voice alerts (Web Speech API) | ✅ |
| Docker + nginx deployment | ✅ |
