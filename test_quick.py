"""
============================================================
FICHIER DE TEST — Lancer AVANT d'intégrer avec Linda
============================================================
Commande : depuis le dossier backend/, taper :
    python test_quick.py
============================================================
"""

from ai.orchestrator import orchestrate

# ── TEST 1 : Gmail phishing classique ────────────────────────────────
payload_1 = {
    "extracted_text": "Votre compte PayPal est suspendu. Vérifiez ici: http://paypal-secure-verify.ru/login",
    "platform": "gmail",
    "context": {
        "sender_name": "PayPal Support",
        "sender_email": "noreply@paypal-account-verify123.com"
    }
}

# ── TEST 2 : Leboncoin acheteur normal ───────────────────────────────
payload_2 = {
    "extracted_text": "Bonjour, je suis intéressé par votre vélo, il est encore disponible ?",
    "platform": "leboncoin",
    "context": {
        "seller_ratings": "32 avis positifs",
        "ad_price": "150",
        "ad_title": "Vélo VTT Trek"
    }
}

# ── TEST 3 : WhatsApp scam classique ─────────────────────────────────
payload_3 = {
    "extracted_text": "Félicitations ! Vous avez gagné un iPhone 15. Cliquez ici pour réclamer: http://win-iphone-now.tk",
    "platform": "whatsapp",
    "context": {
        "sender": "+44700000000",
        "known_contact": "false"
    }
}

# ── TEST 4 : Leboncoin arnaque Mondial Relay ─────────────────────────
payload_4 = {
    "extracted_text": "Bonjour, votre article m'intéresse. Je préfère passer par Leboncoin Protection avec Mondial Relay. Contactez-moi sur WhatsApp au 07 56 23 44 12.",
    "platform": "leboncoin",
    "context": {
        "seller_ratings": "0 avis",
        "account_age": "créé aujourd'hui",
        "ad_price": "50",
        "ad_title": "MacBook Pro 16 pouces"
    }
}


# ── EXÉCUTION DES TESTS ──────────────────────────────────────────────
if __name__ == "__main__":
    tests = [
        ("Gmail phishing PayPal", payload_1),
        ("Leboncoin acheteur normal", payload_2),
        ("WhatsApp scam iPhone", payload_3),
        ("Leboncoin arnaque Mondial Relay", payload_4),
    ]

    for name, payload in tests:
        print(f"\n{'='*50}")
        print(f"TEST : {name}")
        print('='*50)
        result = orchestrate(payload)
        print(f"  risk_score : {result['risk_score']}/100")
        print(f"  verdict    : {result['verdict']}")
        print(f"  reason     : {result['reason']}")
        print(f"  tactics    : {result['detected_tactics']}")
