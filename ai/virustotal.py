import requests
import time
import os
import re
from dotenv import load_dotenv

load_dotenv()

# Rotation des 3 clés API VirusTotal
API_KEYS = [
    os.getenv("VT_API_KEY_1"),
    os.getenv("VT_API_KEY_2"),
    os.getenv("VT_API_KEY_3"),
]
_key_index = 0


def _get_next_key() -> str:
    """Retourne la prochaine clé API en rotation circulaire."""
    global _key_index
    key = API_KEYS[_key_index % len(API_KEYS)]
    _key_index += 1
    return key


def extract_urls(text: str) -> list:
    """Extrait toutes les URLs d'un texte brut avec regex."""
    pattern = r'https?://[^\s<>"\'{}|\\^`\[\]]+'
    return re.findall(pattern, text)


def unshorten_url(url: str) -> str:
    """Déplie les URLs raccourcies (bit.ly, tinyurl, etc.)."""
    try:
        response = requests.head(url, allow_redirects=True, timeout=5)
        return response.url
    except Exception:
        return url


def scan_url_virustotal(url: str, retries: int = 3) -> dict:
    """
    Envoie une URL à VirusTotal et retourne un résumé simplifié.
    Gère les 429 (rate limit) avec retry automatique.
    """
    full_url = unshorten_url(url)

    for attempt in range(retries):
        api_key = _get_next_key()
        headers = {"x-apikey": api_key}

        try:
            # Étape 1 : Soumettre l'URL pour analyse
            submit_resp = requests.post(
                "https://www.virustotal.com/api/v3/urls",
                headers=headers,
                data={"url": full_url},
                timeout=10,
            )

            if submit_resp.status_code == 429:
                print(f"[VT] Rate limit atteint, attente 15s... (tentative {attempt+1})")
                time.sleep(15)
                continue

            submit_resp.raise_for_status()
            analysis_id = submit_resp.json()["data"]["id"]

            # Étape 2 : Attendre puis récupérer le rapport
            time.sleep(3)
            report_resp = requests.get(
                f"https://www.virustotal.com/api/v3/analyses/{analysis_id}",
                headers=headers,
                timeout=10,
            )
            report_resp.raise_for_status()
            report = report_resp.json()

            # Étape 3 : Extraire uniquement les métriques utiles pour le LLM
            stats = report["data"]["attributes"]["stats"]
            malicious = stats.get("malicious", 0)
            suspicious = stats.get("suspicious", 0)
            total = sum(stats.values())

            return {
                "url": full_url,
                "malicious_engines": malicious,
                "suspicious_engines": suspicious,
                "total_engines": total,
                "summary": f"VirusTotal: {malicious}/{total} engines flagged this URL as malicious.",
                "is_dangerous": malicious >= 3,
            }

        except Exception as e:
            print(f"[VT] Erreur sur tentative {attempt+1}: {e}")
            time.sleep(5)

    # Fallback si tout échoue
    return {
        "url": full_url,
        "malicious_engines": 0,
        "suspicious_engines": 0,
        "total_engines": 0,
        "summary": "VirusTotal: Analyse indisponible (timeout ou erreur réseau).",
        "is_dangerous": False,
    }


def analyze_all_urls(text: str) -> list:
    """Extrait et analyse toutes les URLs trouvées dans un texte."""
    urls = extract_urls(text)
    if not urls:
        return []
    return [scan_url_virustotal(url) for url in urls]
