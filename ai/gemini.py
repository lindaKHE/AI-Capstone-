import os
import json
import re
import requests
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# Réponse de secours si Groq plante
FALLBACK_RESPONSE = {
    "risk_score": 50,
    "reason": "Analysis unavailable — treat with caution.",
    "detected_tactics": [],
    "verdict": "Suspicious",
}


def _extract_json_from_text(text: str) -> dict:
    """
    Extrait le JSON de la réponse même si elle contient
    du texte parasite ou des balises markdown.
    """
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Impossible d'extraire du JSON depuis: {text[:200]}")


def call_gemini(system_prompt: str, user_prompt: str) -> dict:
    """
    Appelle l'API Groq (Llama-3) et retourne un dict JSON propre.
    En cas d'erreur, retourne FALLBACK_RESPONSE.
    """
    if not GROQ_API_KEY:
        print("[GROQ] Clé API manquante dans .env, retour fallback.")
        return FALLBACK_RESPONSE

    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.1,
        "max_tokens": 300,
    }

    try:
        response = requests.post(
            GROQ_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            },
            timeout=15,
        )
        response.raise_for_status()
        raw_text = response.json()["choices"][0]["message"]["content"]
        return _extract_json_from_text(raw_text)

    except requests.exceptions.Timeout:
        print("[GROQ] Timeout — retour fallback.")
        return FALLBACK_RESPONSE

    except requests.exceptions.HTTPError as e:
        print(f"[GROQ] Erreur HTTP {e.response.status_code} — retour fallback.")
        return FALLBACK_RESPONSE

    except (ValueError, KeyError) as e:
        print(f"[GROQ] Erreur de parsing JSON: {e} — retour fallback.")
        return FALLBACK_RESPONSE

    except Exception as e:
        print(f"[GROQ] Erreur inconnue: {e} — retour fallback.")
        return FALLBACK_RESPONSE