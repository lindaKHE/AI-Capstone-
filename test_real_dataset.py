"""
Transparency — Real Dataset Performance Test
Uses the UCI SMS Spam Collection dataset to evaluate the AI model.
Tests 50 messages (25 spam, 25 ham) and computes precision, recall, F1-score.
"""

import requests
import time
import csv
import random

API_BASE = "http://127.0.0.1:8000"
random.seed(42)

def load_dataset(filepath, n_spam=25, n_ham=25):
    """Load n_spam spam and n_ham ham messages from the SMS Spam dataset."""
    spam_msgs = []
    ham_msgs = []

    with open(filepath, encoding='latin-1') as f:
        reader = csv.reader(f)
        next(reader)  # skip header
        for row in reader:
            if len(row) < 2:
                continue
            label, text = row[0].strip(), row[1].strip()
            if label == 'spam' and len(spam_msgs) < n_spam * 3:
                spam_msgs.append(text)
            elif label == 'ham' and len(ham_msgs) < n_ham * 3:
                ham_msgs.append(text)

    # Random sample
    spam_sample = random.sample(spam_msgs, min(n_spam, len(spam_msgs)))
    ham_sample = random.sample(ham_msgs, min(n_ham, len(ham_msgs)))

    dataset = [(msg, 'dangerous') for msg in spam_sample] + \
              [(msg, 'safe') for msg in ham_sample]
    random.shuffle(dataset)
    return dataset

def run_test(text, platform="gmail"):
    """Send a message to the API and get the result."""
    try:
        r = requests.post(
            f"{API_BASE}/analyze",
            json={"extracted_text": text, "platform": platform, "context": {}},
            timeout=30
        )
        d = r.json()
        score = d.get("risk_score", 50)
        verdict = d.get("verdict", "unknown")
        if score >= 60:
            predicted = "dangerous"
        elif score <= 40:
            predicted = "safe"
        else:
            predicted = "ambiguous"
        return score, verdict, predicted
    except Exception as e:
        return 50, "error", "ambiguous"

def main():
    print("\n" + "="*65)
    print("  TRANSPARENCY — REAL DATASET EVALUATION")
    print("  Dataset: UCI SMS Spam Collection (Kaggle)")
    print("="*65)

    dataset = load_dataset("spam.csv", n_spam=25, n_ham=25)
    print(f"\n  Loaded {len(dataset)} messages (25 spam + 25 ham)\n")

    results = []
    tp = fp = tn = fn = 0

    for i, (text, expected) in enumerate(dataset, 1):
        score, verdict, predicted = run_test(text)

        correct = predicted == expected
        if expected == "dangerous" and predicted == "dangerous":
            tp += 1
        elif expected == "safe" and predicted == "dangerous":
            fp += 1
        elif expected == "safe" and predicted == "safe":
            tn += 1
        elif expected == "dangerous" and predicted == "safe":
            fn += 1

        status = "✅" if correct else "❌"
        print(f"[{i:02d}/50] {status} {expected.upper():10} → {predicted.upper():10} ({score}/100) | {text[:50]}...")

        results.append({
            "text": text,
            "expected": expected,
            "predicted": predicted,
            "score": score,
            "correct": correct
        })

        time.sleep(0.8)  # avoid rate limiting

    # ── METRICS ───────────────────────────────────────────────────────────────
    total = len(results)
    correct_total = tp + tn
    accuracy = correct_total / total * 100

    precision = tp / (tp + fp) * 100 if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) * 100 if (tp + fn) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0

    print("\n" + "="*65)
    print("  EVALUATION RESULTS")
    print("="*65)
    print(f"\n  Total messages tested : {total}")
    print(f"  Correct predictions   : {correct_total}")
    print(f"\n  Accuracy              : {accuracy:.1f}%")
    print(f"  Precision             : {precision:.1f}%")
    print(f"  Recall                : {recall:.1f}%")
    print(f"  F1-Score              : {f1:.1f}%")
    print(f"\n  True Positives (TP)   : {tp}")
    print(f"  True Negatives (TN)   : {tn}")
    print(f"  False Positives (FP)  : {fp}  ← safe flagged as dangerous")
    print(f"  False Negatives (FN)  : {fn}  ← dangerous missed as safe")

    # Error analysis
    errors = [r for r in results if not r["correct"]]
    if errors:
        print(f"\n  ERROR ANALYSIS ({len(errors)} mistakes):")
        for e in errors[:5]:
            print(f"  → Expected {e['expected'].upper()}, got {e['predicted'].upper()} (score: {e['score']}) | {e['text'][:60]}...")

    print("\n" + "="*65)
    rating = "🎯 EXCELLENT" if accuracy >= 80 else "✅ GOOD" if accuracy >= 65 else "⚠️ NEEDS IMPROVEMENT"
    print(f"  {rating} — {accuracy:.1f}% accuracy on real-world SMS spam data")
    print("="*65 + "\n")

if __name__ == "__main__":
    main()
