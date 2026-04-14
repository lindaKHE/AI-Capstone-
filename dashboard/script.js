const API = 'http://localhost:8000';
let scanHistory = [];

// ============================================
// LOAD STATS
// Fetches real-time stats from Linda's backend
// ============================================
async function loadStats() {
    try {
        const res = await fetch(`${API}/stats`);
        const data = await res.json();
        document.getElementById('total-scans').textContent = data.total_scans;
        document.getElementById('high-risk').textContent = data.high_risk_detected;
        document.getElementById('safe-count').textContent = data.total_scans - data.high_risk_detected;
    } catch {
        document.getElementById('total-scans').textContent = '—';
    }
}

// ============================================
// HELPERS
// ============================================
function getClass(score) {
    if (score < 40) return 'safe';
    if (score < 75) return 'suspicious';
    return 'dangerous';
}

function getVerdict(score) {
    if (score < 40) return '✅ Safe';
    if (score < 75) return '⚠️ Suspicious';
    return '🚨 Dangerous';
}

// ============================================
// ANALYZE MESSAGE
// Sends payload to /analyze and displays result
// ============================================
async function analyzeMessage() {
    const message = document.getElementById('message').value.trim();
    if (!message) {
        alert('Please enter a message to analyze');
        return;
    }

    // Show loading, hide result
    document.getElementById('loading').style.display = 'block';
    document.getElementById('result').style.display = 'none';
    document.getElementById('analyze-btn').disabled = true;

    // Build payload — same format as Thomas's Chrome extension
    const payload = {
        platform: document.getElementById('platform').value,
        extracted_text: message,
        context: {
            sender_email: document.getElementById('sender-email').value,
            hidden_url: document.getElementById('hidden-url').value || null
        }
    };

    try {
        const res = await fetch(`${API}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        // Display result
        const cls = getClass(data.risk_score);
        const resultDiv = document.getElementById('result');
        resultDiv.className = `result ${cls}`;
        resultDiv.style.display = 'block';

        document.getElementById('result-verdict').textContent = getVerdict(data.risk_score);

        const scoreBadge = document.getElementById('result-score');
        scoreBadge.textContent = `${data.risk_score}/100`;
        scoreBadge.className = `score-badge ${cls}`;

        document.getElementById('result-reason').textContent = data.reason;

        // Display detected tactics as tags
        const tacticsDiv = document.getElementById('result-tactics');
        tacticsDiv.innerHTML = '';
        if (data.detected_tactics && data.detected_tactics.length > 0) {
            data.detected_tactics.forEach(t => {
                const tag = document.createElement('span');
                tag.className = 'tactic-tag';
                tag.textContent = t;
                tacticsDiv.appendChild(tag);
            });
        }

        // Add to history
        scanHistory.unshift({ ...payload, result: data });
        updateHistory();
        loadStats();

    } catch (err) {
        alert('Backend error — make sure the server is running on localhost:8000');
    } finally {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('analyze-btn').disabled = false;
    }
}

// ============================================
// UPDATE HISTORY
// Shows last 5 scans
// ============================================
function updateHistory() {
    const list = document.getElementById('history-list');
    if (scanHistory.length === 0) {
        list.innerHTML = '<div class="empty-history">No scans yet</div>';
        return;
    }

    list.innerHTML = scanHistory.slice(0, 5).map(item => {
        const cls = getClass(item.result.risk_score);
        return `
            <div class="history-item">
                <div>
                    <div class="history-text">${item.extracted_text}</div>
                    <div class="history-platform">${item.platform.toUpperCase()}</div>
                </div>
                <div class="mini-score ${cls}">${item.result.risk_score}/100</div>
            </div>
        `;
    }).join('');
}

// ============================================
// AUTO-REFRESH STATS every 10 seconds
// ============================================
loadStats();
setInterval(loadStats, 30000);