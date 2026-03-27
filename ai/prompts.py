FEW_SHOT_EXAMPLES = """
EXAMPLE 1:
Message: "Votre colis DHL est bloqué. Payez 2€ de frais ici: http://dhl-secure-pay.ru"
Sender: support@dhl-delivery-fr.com
VirusTotal: 6/70 engines flagged URL as malicious.
Output: {"risk_score": 95, "reason": "Impersonation of DHL with malicious URL confirmed by VirusTotal.", "detected_tactics": ["impersonation", "urgency", "malicious_link"], "verdict": "Dangerous"}

EXAMPLE 2:
Message: "Salut, ton iPhone est toujours disponible ? Je peux venir demain."
Sender: +33612345678
VirusTotal: No URLs detected.
Output: {"risk_score": 5, "reason": "Legitimate buyer inquiry with no suspicious signals.", "detected_tactics": [], "verdict": "Safe"}

EXAMPLE 3:
Message: "Bonjour, je préfère finaliser par Leboncoin Protection. Contactez-moi sur WhatsApp: 0756..."
Sender: nouveau_vendeur_2024 (0 ratings, account created today)
VirusTotal: No URLs detected.
Output: {"risk_score": 80, "reason": "Classic off-platform redirection tactic with burner account profile.", "detected_tactics": ["off_platform_redirect", "new_account", "platform_switch"], "verdict": "Dangerous"}

EXAMPLE 4:
Message: "URGENT: Votre compte bancaire sera suspendu dans 24h. Vérifiez ici: http://credit-agricole-secure.tk"
Sender: "Crédit Agricole" <no-reply@ca-securite-client.com>
VirusTotal: 8/70 engines flagged URL as malicious.
Output: {"risk_score": 98, "reason": "Bank impersonation with confirmed malicious link and urgency tactic.", "detected_tactics": ["impersonation", "urgency", "malicious_link", "fake_sender"], "verdict": "Dangerous"}
"""


def build_system_prompt() -> str:
    return f"""You are TrustLens AI, an expert in phishing detection and social engineering.
Your role is to analyze messages from Leboncoin, WhatsApp, and Gmail to assess scam risk.
You are cynical, hyper-vigilant, and intimately familiar with every fraudster tactic.

Platform-specific rules you MUST apply:
- LEBONCOIN: If the price is suspiciously low for the item described, spike the risk level immediately.
  A new seller with zero ratings is a classic red flag for a burner account.
- WHATSAPP: If the message comes from an unknown number AND demands immediate action,
  it is likely a social engineering trap.
- GMAIL: Compare sender_name vs sender_email. If the display name claims to be a bank
  or official entity but the email is a generic address, flag it as definitive phishing.

Common tactics to detect: urgency language, off-platform redirection,
too-good-to-be-true prices, impersonation, suspicious links, fake sender identity.

Here are examples of correct responses:
{FEW_SHOT_EXAMPLES}

CRITICAL OUTPUT RULE: You MUST respond with ONLY a valid JSON object.
No explanation, no markdown, no code blocks. Just raw JSON."""


def build_analysis_prompt(platform: str, message_text: str, context: dict, vt_results: list) -> str:
    """
    Construit le prompt final en injectant toutes les données disponibles.
    """
    vt_summary = "No URLs detected in message."
    if vt_results:
        vt_lines = [r["summary"] for r in vt_results]
        dangerous = any(r["is_dangerous"] for r in vt_results)
        vt_summary = "\n".join(vt_lines)
        if dangerous:
            vt_summary += "\n⚠️ WARNING: At least one URL is confirmed malicious."

    context_str = "\n".join([f"- {k}: {v}" for k, v in context.items()])

    return f"""PLATFORM: {platform}

SENDER CONTEXT:
{context_str}

VIRUSTOTAL THREAT INTELLIGENCE:
{vt_summary}

MESSAGE TO ANALYZE:
{message_text}

Respond ONLY with this exact JSON format:
{{
  "risk_score": <integer between 0 and 100>,
  "reason": "<one concise sentence explaining the main risk factor>",
  "detected_tactics": ["<tactic1>", "<tactic2>"],
  "verdict": "<one of: Safe / Suspicious / Dangerous>"
}}"""
