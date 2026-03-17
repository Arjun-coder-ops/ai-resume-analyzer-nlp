# 🧠 Smart Resume Analyzer & ATS Optimizer

A full-stack AI-powered web app that analyzes your resume against job descriptions, computes an ATS compatibility score, and surfaces matched/missing skills with improvement suggestions.

---

## 📁 Project Structure

```
smart-resume-analyzer/
├── backend/                  # Node.js + Express API
│   ├── config/db.js          # MongoDB connection
│   ├── controllers/          # Business logic
│   │   ├── authController.js
│   │   ├── analyzeController.js
│   │   └── historyController.js
│   ├── middleware/           # JWT auth + Multer upload
│   ├── models/               # Mongoose schemas (User, Analysis)
│   ├── routes/               # Express routers
│   ├── uploads/              # Temp PDF storage (auto-created)
│   ├── .env                  # Environment variables
│   └── server.js             # Entry point
│
├── nlp-service/              # Python Flask NLP microservice
│   ├── app.py                # Flask API with /analyze endpoint
│   ├── skills_db.py          # 200+ skills keyword database
│   └── requirements.txt
│
└── frontend/                 # React + Vite + Tailwind UI
    ├── src/
    │   ├── components/       # Reusable UI components
    │   ├── context/          # Auth context (global state)
    │   ├── pages/            # AuthPage, Dashboard
    │   └── utils/api.js      # Axios instance
    └── index.html
```

---

## ⚙️ Prerequisites

| Tool        | Version   | Install                        |
|-------------|-----------|--------------------------------|
| Node.js     | v18+      | https://nodejs.org             |
| npm         | v9+       | Included with Node             |
| Python      | 3.9+      | https://python.org             |
| MongoDB     | 6+        | https://mongodb.com/try/download/community |

---

## 🚀 Setup Instructions

### Step 1 — Clone / extract the project

```bash
cd smart-resume-analyzer
```

---

### Step 2 — Backend Setup

```bash
cd backend
npm install
```

Edit `.env` if needed (MongoDB URI, JWT secret, ports).

Start the server:
```bash
npm run dev          # Development (nodemon auto-reload)
# or
npm start            # Production
```

✅ Backend runs on **http://localhost:5000**

---

### Step 3 — NLP Service Setup

```bash
cd nlp-service

# Create and activate virtual environment (recommended)
python -m venv venv
source venv/bin/activate          # Linux/macOS
# venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt

# Download spaCy language model
python -m spacy download en_core_web_sm

# Start the Flask service
python app.py
```

✅ NLP Service runs on **http://localhost:5001**

---

### Step 4 — Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

✅ Frontend runs on **http://localhost:5173**

---

## 🔗 API Reference

### Auth
| Method | Route                 | Access  | Body                          |
|--------|-----------------------|---------|-------------------------------|
| POST   | /api/auth/register   | Public  | `{ name, email, password }`   |
| POST   | /api/auth/login      | Public  | `{ email, password }`         |
| GET    | /api/auth/me         | Private | JWT in header                 |

### Analysis
| Method | Route         | Access  | Body                                         |
|--------|---------------|---------|----------------------------------------------|
| POST   | /api/analyze  | Private | `FormData: resume (PDF) + jobDescription`    |

### History
| Method | Route             | Access  | Description          |
|--------|-------------------|---------|----------------------|
| GET    | /api/history      | Private | Get past analyses    |
| GET    | /api/history/:id  | Private | Single analysis      |
| DELETE | /api/history/:id  | Private | Delete analysis      |

---

## 🔄 API Flow

```
Browser (React)
    │
    ├─ POST /api/analyze (FormData: PDF + JD)
    │
Node.js Backend (port 5000)
    │
    ├─ Validates JWT
    ├─ Saves to MongoDB (status: "processing")
    ├─ Forwards PDF + JD to Python NLP service
    │
Python NLP Service (port 5001)
    │
    ├─ Extracts text from PDF (PyMuPDF)
    ├─ Extracts skills (spaCy + keyword matching)
    ├─ Compares resume vs JD skills
    ├─ Calculates score = matched/total_jd * 100
    └─ Returns { score, matched_skills, missing_skills, suggestions }
    │
Node.js Backend
    ├─ Updates MongoDB record (status: "completed")
    └─ Returns full result to frontend
    │
Browser → Displays animated results
```

---

## 🔧 Environment Variables

### backend/.env
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/smart_resume_analyzer
JWT_SECRET=your_super_secret_key_change_this
JWT_EXPIRE=7d
NLP_SERVICE_URL=http://localhost:5001
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
```

### nlp-service/.env
```env
FLASK_ENV=development
PORT=5001
```

---

## 🧪 Testing the API with curl

```bash
# 1. Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alex","email":"alex@test.com","password":"test123"}'

# 2. Login → save the token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex@test.com","password":"test123"}'

# 3. Analyze (replace TOKEN and path to PDF)
curl -X POST http://localhost:5000/api/analyze \
  -H "Authorization: Bearer TOKEN" \
  -F "resume=@/path/to/resume.pdf" \
  -F "jobDescription=We are looking for a React developer with Node.js, MongoDB, Docker, AWS and TypeScript experience..."
```

---

## 🎨 UI Features

- **Dark theme** with volt-green accent palette
- **Syne + DM Sans** typography pairing
- **Glassmorphism** cards with subtle borders
- **Animated SVG score ring** with count-up
- **Drag & drop** PDF upload zone
- **Green / red skill badges** with staggered animations
- **Step-by-step loading animation** during analysis
- **Analysis history** with one-click restore
- Fully **responsive** (mobile → desktop)

---

## 🛠️ Common Issues

| Issue | Fix |
|-------|-----|
| `ECONNREFUSED 5001` | NLP service not running. Start `python app.py` |
| `MongoServerError` | MongoDB not running. Start `mongod` |
| `spacy model not found` | Run `python -m spacy download en_core_web_sm` |
| CORS error | Ensure `CLIENT_URL` in backend `.env` matches frontend port |
| PDF shows score 0 | PDF may be image-based. Use a text-searchable PDF |
