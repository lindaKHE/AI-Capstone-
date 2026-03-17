# Transparency — AI-Powered Phishing Detection

 A lightweight Chrome extension that protects non-technical users from phishing, scams, and social engineering attacks( before the click).



# 🎯 What is Transparency?

Transparency analyzes messages on Gmail, WhatsApp Web... in real-time.
It combines **VirusTotal link reputation** with **Gemini AI semantic analysis** to generate a **0-100% risk score** with a plain-English explanation.



##  Project Architecture
```
Chrome Extension 
        ↓ sends payload
Backend API - FastAPI 
        ↓ routes to
AI Module - VirusTotal + LLM 
        ↓ returns score
Backend API
        ↓ returns result
Chrome Extension → displays popup
```

---

# ⚙️ Installation & Setup

### Prerequisites
- Python 3.11+
- Git

### 1 Clone the repository
```bash
git clone https://github.com/lindaKHE/AI-Capstone-.git
cd AI-Capstone-
```

### 2 Create virtual environment
```bash
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Mac/Linux
```

### 3 Install dependencies
```bash
pip install -r requirements.txt
```

### 4 Run the server
```bash
uvicorn main:app --reload
```

The server will be running at **http://127.0.0.1:8000**

---

##  API Endpoints

| Method | Endpoint | Description |
| GET | `/` | Health check |
| POST | `/analyze` | Main analysis endpoint |
| POST | `/report_threat` | Log high-risk threats (>85%) |
| GET | `/stats` | Telemetry & statistics |

### Example Request
```json
POST /analyze
{
  "platform": "gmail",
  "extracted_text": "Click here to claim your prize!",
  "context": {
    "sender_email": "scam@fake.com",
    "sender_name": "Amazon",
    "email_subject": "You won!",
    "hidden_url": "http://fake-amazon.ru"
  }
}
```

### Example Response
```json
{
  "risk_score": 92,
  "reason": "Suspicious sender + malicious link detected"
}
```

---

##  Database

SQLite database (`transparency.db`) with two tables:
- **`scans`** — logs every analysis performed
- **`cache`** — stores results to avoid duplicate API calls

---

##  Team

| Name | Role | Responsibility |
|------|------|----------------|
| Thomas | Frontend & Data Extraction | Chrome Extension, DOM parsing, UI |
| Edmond | AI Logic & Threat Intelligence | VirusTotal API, LLM prompt engineering, scoring |
| Linda | Backend Infrastructure | FastAPI server, SQLite, Docker, orchestration |

---

##  Tech Stack

- **Backend**: Python, FastAPI, Uvicorn
- **Database**: SQLite
- **AI**: Gemini API / Groq (Llama-3)
- **Threat Intel**: VirusTotal, PhishTank
- **Frontend**: JavaScript (Manifest V3 Chrome Extension)
- **DevOps**: Docker, Docker Compose