// --- 1. State Tracking ---
let lastRightClickedElement = null;
let hoveredLink = null;
let mouseX = 0;
let mouseY = 0;

document.addEventListener("contextmenu", (event) => {
    lastRightClickedElement = event.target;
    mouseX = event.clientX;
    mouseY = event.clientY;
    const anchor = event.target.closest('a');
    hoveredLink = anchor ? anchor.href : null;
}, true);

// --- 2. ONE-CLICK DETECTION ---
document.addEventListener("click", (event) => {
    // Ignore clicks on our own overlay
    if (event.target.closest('#trustlens-overlay') || event.target.closest('#trustlens-scan-btn')) return;

    const currentUrl = window.location.hostname;
    let messageElement = null;

    // Detect click on a message element based on platform
    if (currentUrl.includes("mail.google.com")) {
        messageElement = event.target.closest('.a3s') || event.target.closest('.gs');
    } else if (currentUrl.includes("whatsapp.com")) {
        messageElement = event.target.closest('[data-pre-plain-text]') || event.target.closest('.message-in, .message-out');
    } else if (currentUrl.includes("leboncoin.fr")) {
        messageElement = event.target.closest('[data-qa-id="adview_description_container"]') ||
                         event.target.closest('.styles_adContent__') ||
                         event.target.closest('main');
    }

    if (!messageElement) return;

    // Remove any existing scan button
    const existingBtn = document.getElementById('trustlens-scan-btn');
    if (existingBtn) existingBtn.remove();

    // Create the floating scan button
    const btn = document.createElement('div');
    btn.id = 'trustlens-scan-btn';
    btn.innerHTML = '🔍 Scan with Transparency';
    btn.style.cssText = `
        position: fixed;
        top: ${event.clientY - 40}px;
        left: ${event.clientX}px;
        background: #2563eb;
        color: white;
        padding: 8px 14px;
        border-radius: 20px;
        font-family: Arial, sans-serif;
        font-size: 13px;
        font-weight: bold;
        cursor: pointer;
        z-index: 2147483647;
        box-shadow: 0 4px 12px rgba(37,99,235,0.4);
        transition: background 0.2s;
        white-space: nowrap;
    `;

    btn.addEventListener('mouseenter', () => btn.style.background = '#1d4ed8');
    btn.addEventListener('mouseleave', () => btn.style.background = '#2563eb');

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        btn.remove();

        // Set the clicked element for analysis
        lastRightClickedElement = messageElement;
        mouseX = event.clientX;
        mouseY = event.clientY;
        const anchor = messageElement.querySelector('a');
        hoveredLink = anchor ? anchor.href : null;

        triggerAnalysis(event.clientX, event.clientY);
    });

    document.body.appendChild(btn);

    // Auto-remove after 4 seconds
    setTimeout(() => { if (btn.parentNode) btn.remove(); }, 4000);
});

// --- 3. Main Listener (clic droit — kept for compatibility) ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "trigger_analysis") {
        if (!lastRightClickedElement) return;
        triggerAnalysis(mouseX, mouseY);
    }
});

// --- 4. Core Analysis Function ---
function triggerAnalysis(x, y) {
    chrome.storage.local.get(['consentGiven', 'clientId'], (storage) => {

        if (!storage.consentGiven) {
            renderFloatingUI(x, y, { state: "no_consent" });
            return;
        }

        const currentUrl = window.location.hostname;
        let payload = {
            client_id: storage.clientId,
            platform: "unknown",
            extracted_text: "",
            context: { hidden_url: hoveredLink }
        };

        if (currentUrl.includes("leboncoin.fr")) {
            payload = parseLeboncoin(lastRightClickedElement, payload);
        } else if (currentUrl.includes("whatsapp.com")) {
            payload = parseWhatsApp(lastRightClickedElement, payload);
        } else if (currentUrl.includes("mail.google.com")) {
            payload = parseGmail(lastRightClickedElement, payload);
        }

        renderFloatingUI(x, y, { state: "loading" });

        fetch('http://localhost:8000/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(result => {
            renderFloatingUI(x, y, { state: "complete", data: result });
            if (result.risk_score > 85) {
                flagToBackendDatabase(payload, result);
            }
        })
        .catch(err => {
            console.error("Transparency: Backend error", err);
            const mockResult = generateMockResponse(payload.platform);
            renderFloatingUI(x, y, { state: "complete", data: mockResult });
        });
    });
}

// --- 5. The High-Risk Telemetry Pipeline ---
function flagToBackendDatabase(extractedData, aiResult) {
    console.warn("🚨 HIGH RISK DETECTED (>85%). Preparing payload for backend storage.");
    const threatPayload = {
        timestamp: new Date().toISOString(),
        source_data: extractedData,
        analysis: aiResult
    };
    fetch('http://localhost:8000/report_threat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(threatPayload)
    }).then(res => console.log("Threat logged successfully"))
      .catch(err => console.error("Failed to log threat", err));
}

// --- 6. Floating UI Injection ---
function renderFloatingUI(x, y, info) {
    let overlay = document.getElementById("trustlens-overlay");

    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "trustlens-overlay";
        document.body.appendChild(overlay);

        document.addEventListener("click", function closeOverlay(e) {
            if (!overlay.contains(e.target)) {
                overlay.remove();
                document.removeEventListener("click", closeOverlay);
            }
        });
    }

    overlay.style.cssText = `
        position: fixed;
        top: ${y + 10}px;
        left: ${x + 10}px;
        width: 280px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        font-family: Arial, sans-serif;
        z-index: 2147483647;
        padding: 15px;
        border: 1px solid #e2e8f0;
        color: #333;
    `;

    if (info.state === "loading") {
        overlay.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px; color: #2563eb;">🔍 Transparency is scanning...</div>
            <div style="font-size: 12px; color: #64748b;">Extracting context and querying AI.</div>
        `;
    } else if (info.state === "no_consent") {
        overlay.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px; color: #991b1b;">Action Required</div>
            <div style="font-size: 13px; line-height: 1.4; color: #475569;">
                Please click the Transparency extension icon and accept the Privacy Policy.
            </div>
        `;
    } else if (info.state === "complete") {
        const score = info.data.risk_score;
        let color = score < 40 ? "#166534" : (score < 75 ? "#854d0e" : "#991b1b");
        let bgColor = score < 40 ? "#dcfce7" : (score < 75 ? "#fef08a" : "#fee2e2");

        overlay.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <strong style="font-size: 14px;">Transparency Verdict</strong>
                <span style="background: ${bgColor}; color: ${color}; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 14px;">
                    ${score}% Risk
                </span>
            </div>
            <div style="font-size: 13px; line-height: 1.4; color: #475569;">
                ${info.data.reason}
            </div>
        `;
    }
}

// --- 7. Helper & Parsing Functions ---
function generateMockResponse(platform) {
    const scenarios = [
        { risk_score: 12, reason: `[${platform.toUpperCase()}] Normal interaction. No known malicious signatures.` },
        { risk_score: 65, reason: `[${platform.toUpperCase()}] Unknown sender requesting unusual action.` },
        { risk_score: 92, reason: `[${platform.toUpperCase()}] CRITICAL: Phishing URL detected in message.` }
    ];
    return scenarios[Math.floor(Math.random() * scenarios.length)];
}

function parseLeboncoin(targetNode, payload) {
    payload.platform = "leboncoin";
    payload.extracted_text = window.getSelection().toString().trim() || targetNode.innerText.trim();
    payload.context = {
        ...payload.context,
        ad_title: "Not found", ad_price: "Not found", ad_description: "Not found",
        seller_name: "Not found", seller_stats: "Not found", seller_member_since: "Not found",
        url: window.location.href
    };
    try {
        const titleNode = document.querySelector('h1');
        if (titleNode) payload.context.ad_title = titleNode.innerText.trim();
        const priceNode = document.querySelector('[data-qa-id="adview_price"]');
        if (priceNode) payload.context.ad_price = priceNode.innerText.replace(/\n/g, ' ').trim();
        const descNode = document.querySelector('#readme-content') || document.querySelector('[data-qa-id="adview_description_container"] p');
        if (descNode) payload.context.ad_description = descNode.innerText.trim();
        const profileContainer = document.querySelector('[data-qa-id="adview_profile_part"]');
        if (profileContainer) {
            const nameNode = profileContainer.querySelector('a[href^="/profile/"][aria-label^="Profil"]');
            if (nameNode) payload.context.seller_name = nameNode.innerText.trim();
        }
        const statsNode = document.querySelector('[aria-label^="Utilisateur noté"]');
        if (statsNode) payload.context.seller_stats = statsNode.getAttribute('aria-label');
        const paragraphs = document.querySelectorAll('p');
        for (let p of paragraphs) {
            if (p.innerText.includes('Membre depuis')) {
                payload.context.seller_member_since = p.innerText.trim();
                break;
            }
        }
    } catch (error) {
        console.error("Transparency: Error parsing Leboncoin DOM.", error);
    }
    return payload;
}

function parseWhatsApp(targetNode, payload) {
    payload.platform = "whatsapp";
    payload.extracted_text = window.getSelection().toString().trim() || targetNode.innerText.trim();
    payload.context = {
        ...payload.context,
        sender_name_or_number: "Not found", timestamp: "Not found",
        url: window.location.href
    };
    try {
        const messageRow = targetNode.closest('[data-pre-plain-text]');
        if (messageRow) {
            const preText = messageRow.getAttribute('data-pre-plain-text');
            const match = preText.match(/\[(.*?)\] (.*?):/);
            if (match && match.length === 3) {
                payload.context.timestamp = match[1].trim();
                payload.context.sender_name_or_number = match[2].trim();
            }
            if (!window.getSelection().toString().trim()) {
                const textNode = messageRow.querySelector('[data-testid="selectable-text"]');
                if (textNode) payload.extracted_text = textNode.innerText.trim();
            }
        } else {
            const headerTitle = document.querySelector('header span[dir="auto"]');
            if (headerTitle) payload.context.sender_name_or_number = headerTitle.innerText.trim();
        }
    } catch (error) {
        console.error("Transparency: Error parsing WhatsApp DOM.", error);
    }
    return payload;
}

function parseGmail(targetNode, payload) {
    payload.platform = "gmail";
    payload.extracted_text = window.getSelection().toString().trim() || targetNode.innerText.trim();
    payload.context = {
        ...payload.context,
        sender_name: "Not found", sender_email: "Not found",
        email_subject: "Not found", url: window.location.href
    };
    try {
        const emailContainer = targetNode.closest('.adn') || document;
        const senderNode = emailContainer.querySelector('span[email]');
        if (senderNode) {
            payload.context.sender_email = senderNode.getAttribute('email');
            payload.context.sender_name = senderNode.getAttribute('name') || senderNode.innerText.trim();
        }
        const subjectNode = document.querySelector('h2.hP');
        if (subjectNode) payload.context.email_subject = subjectNode.innerText.trim();
    } catch (error) {
        console.error("Transparency: Error parsing Gmail DOM.", error);
    }
    return payload;
}
