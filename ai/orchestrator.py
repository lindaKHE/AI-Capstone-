from .virustotal import analyze_all_urls, scan_url_virustotal
from .gemini import call_gemini
from .prompts import build_system_prompt, build_analysis_prompt


def orchestrate(payload: dict) -> dict:
    """
    ============================================================
    FONCTION PRINCIPALE — appelée par l'endpoint /analyze de Linda
    ============================================================

    Payload attendu depuis Thomas (Chrome Extension) :
    {
        "extracted_text": "Votre colis est bloqué, payez ici: http://...",
        "platform": "gmail" | "whatsapp" | "leboncoin",
        "context": {
            "sender_name": "DHL Support",
            "sender_email": "support@dhl-delivery123.com",
            "ad_price": "50",           <- Leboncoin uniquement
            "ad_title": "iPhone 15 Pro" <- Leboncoin uniquement
        },
        "hidden_url": "https://bit.ly/3xSuspicious"  <- optionnel
    }

    Réponse retournée à Thomas :
    {
        "risk_score": 85,
        "reason": "Impersonation of DHL with malicious URL.",
        "detected_tactics": ["impersonation", "urgency", "malicious_link"],
        "verdict": "Dangerous"
    }
    """

    # ── 1. Extraction des données du payload ──────────────────────────
    text = payload.get("extracted_text", "")
    platform = payload.get("platform", "unknown").lower()
    context = payload.get("context", {})

    if not text:
        return {
            "risk_score": 0,
            "reason": "No message text provided.",
            "detected_tactics": [],
            "verdict": "Safe",
        }

    # ── 2. Analyse VirusTotal de toutes les URLs trouvées ─────────────
    print(f"[ORCHESTRATOR] Analyse VirusTotal — plateforme: {platform}")
    vt_results = analyze_all_urls(text)

    # Inclure aussi l'URL cachée si Thomas en a trouvé une
    hidden_url = payload.get("hidden_url")
    if hidden_url:
        vt_results.append(scan_url_virustotal(hidden_url))

    # ── 3. Construction du Super Prompt ──────────────────────────────
    system_prompt = build_system_prompt()
    user_prompt = build_analysis_prompt(
        platform=platform,
        message_text=text,
        context=context,
        vt_results=vt_results,
    )

    # ── 4. Appel Gemini + retour du JSON propre ───────────────────────
    print("[ORCHESTRATOR] Envoi à Groq (Llama-3)...")
    result = call_gemini(system_prompt, user_prompt)

    # Garantir que tous les champs attendus par Thomas sont toujours présents
    return {
        "risk_score": result.get("risk_score", 50),
        "reason": result.get("reason", "Analysis incomplete."),
        "detected_tactics": result.get("detected_tactics", []),
        "verdict": result.get("verdict", "Suspicious"),
    }
