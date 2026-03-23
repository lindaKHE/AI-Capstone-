from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import datetime

# INITIALISATION DE L'APP
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# BASE DE DONNÉES SQLITE
def init_db():
    conn = sqlite3.connect("transparency.db")
    cursor = conn.cursor()
    
    # Table pour les logs de chaque scan
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS scans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT,
            extracted_text TEXT,
            risk_score INTEGER,
            reason TEXT,
            timestamp TEXT
        )
    """)
    
    # Table pour le cache (évite d'appeler l'API deux fois pour le même texte)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text_hash TEXT UNIQUE,
            risk_score INTEGER,
            reason TEXT,
            timestamp TEXT
        )
    """)
    
    conn.commit()
    conn.close()

init_db()

# MODÈLE DU PAYLOAD
class Payload(BaseModel):
    platform: str
    extracted_text: str
    context: dict


@app.get("/")
def root():
    """
    **Health Check Endpoint**
    
    Verifies that the Transparency backend server
    is running and reachable.
    """
    return {"message": "Transparency Backend is running !"}

@app.post("/analyze")
def analyze(payload: Payload):
    """
    **Main Analysis Endpoint**
    
    Receives the extracted payload from the Chrome extension,
    performs cache lookup, orchestrates AI threat analysis,
    and returns a risk score between 0 and 100.
    
    - **0-40** : Low risk — No threat detected
    - **41-75** : Medium risk — Suspicious activity
    - **76-100** : High risk — Likely phishing or scam
    """
    import hashlib
    
    # Créer un hash du texte pour le cache
    text_hash = hashlib.md5(
        payload.extracted_text.encode()
    ).hexdigest()
    
    conn = sqlite3.connect("transparency.db")
    cursor = conn.cursor()
    
    # Vérifier si on a déjà analysé ce texte
    cursor.execute(
        "SELECT risk_score, reason FROM cache WHERE text_hash = ?",
        (text_hash,)
    )
    cached = cursor.fetchone()
    
    if cached:
        # On renvoie directement sans appeler l'IA
        conn.close()
        return {
            "risk_score": cached[0],
            "reason": cached[1],
            "source": "cache"  # Pour savoir que c'est du cache
        }
    
    # Pas dans le cache → réponse mock pour l'instant
    result = {
        "risk_score": 50,
        "reason": "Analyse IA en cours de développement"
    }
    
    # Sauvegarder dans le cache
    cursor.execute("""
        INSERT OR IGNORE INTO cache 
        (text_hash, risk_score, reason, timestamp)
        VALUES (?, ?, ?, ?)
    """, (
        text_hash,
        result["risk_score"],
        result["reason"],
        datetime.datetime.now().isoformat()
    ))
    
    # Logger le scan dans la table scans
    cursor.execute("""
        INSERT INTO scans 
        (platform, extracted_text, risk_score, reason, timestamp)
        VALUES (?, ?, ?, ?, ?)
    """, (
        payload.platform,
        payload.extracted_text,
        result["risk_score"],
        result["reason"],
        datetime.datetime.now().isoformat()
    ))
    
    conn.commit()
    conn.close()
    
    return result

@app.post("/report_threat")
def report_threat(payload: dict):
    """
    **High-Risk Threat Reporting Endpoint**
    
    Automatically triggered by the Chrome extension
    when a risk score exceeds 85%.
    Stores the full threat payload in the database
    for further analysis and monitoring.
    """
    conn = sqlite3.connect("transparency.db")
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO scans 
        (platform, extracted_text, risk_score, reason, timestamp)
        VALUES (?, ?, ?, ?, ?)
    """, (
        payload.get("source_data", {}).get("platform", "unknown"),
        payload.get("source_data", {}).get("extracted_text", ""),
        payload.get("analysis", {}).get("risk_score", 0),
        payload.get("analysis", {}).get("reason", ""),
        datetime.datetime.now().isoformat()
    ))
    
    conn.commit()
    conn.close()
    
    return {"message": "Threat logged successfully"}

@app.get("/stats")
def get_stats():
    """
    **Telemetry & Statistics Endpoint**
    
    Returns real-time statistics about all scans performed.
    Used for the monitoring dashboard and PoC reporting.
    
    - **total_scans** : Total number of messages analyzed
    - **high_risk_detected** : Number of high-risk threats found
    """
    conn = sqlite3.connect("transparency.db")
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM scans")
    total = cursor.fetchone()[0]
    
    cursor.execute(
        "SELECT COUNT(*) FROM scans WHERE risk_score > 85"
    )
    high_risk = cursor.fetchone()[0]
    
    conn.close()
    
    return {
        "total_scans": total,
        "high_risk_detected": high_risk,
    }