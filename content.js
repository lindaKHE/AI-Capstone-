// --- 1. State Tracking ---
let lastRightClickedElement = null;
let hoveredLink = null; // New variable to store hidden links
let mouseX = 0;
let mouseY = 0;

document.addEventListener("contextmenu", (event) => {
    lastRightClickedElement = event.target;
    mouseX = event.clientX;
    mouseY = event.clientY;
    
    // Check if the user right-clicked directly on an <a> tag or inside one
    const anchor = event.target.closest('a');
    hoveredLink = anchor ? anchor.href : null; 
    
}, true);

// --- 2. Main Listener ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "trigger_analysis") {
        if (!lastRightClickedElement) return;

        // --- GDPR CONSENT GATE ---
        chrome.storage.local.get(['consentGiven', 'clientId'], (storage) => {
            
            // 1. If no consent, block execution and show warning UI
            if (!storage.consentGiven) {
                renderFloatingUI(mouseX, mouseY, { state: "no_consent" });
                return; 
            }

            // 2. Extract data based on the platform
            const currentUrl = window.location.hostname;
            let payload = { 
                client_id: storage.clientId, // --- ATTACH ANONYMOUS UUID ---
                platform: "unknown", 
                extracted_text: "", 
                context: {
                    hidden_url: hoveredLink 
                } 
            };

            if (currentUrl.includes("leboncoin.fr")) {
                payload = parseLeboncoin(lastRightClickedElement, payload);
            } else if (currentUrl.includes("whatsapp.com")) {
                payload = parseWhatsApp(lastRightClickedElement, payload);
            } else if (currentUrl.includes("mail.google.com")) {
                payload = parseGmail(lastRightClickedElement, payload);
            }

            // Show the loading UI at the mouse coordinates
            renderFloatingUI(mouseX, mouseY, { state: "loading" });

            // Simulate the backend API call (replace with fetch later)
            setTimeout(() => {
                const mockResult = generateMockResponse(payload.platform);
                
                // Update the UI with the final score
                renderFloatingUI(mouseX, mouseY, { state: "complete", data: mockResult });

                // --- THE HIGH-RISK PIPELINE ---
                if (mockResult.risk_score > 85) {
                    flagToBackendDatabase(payload, mockResult);
                }

            }, 1500);
        }); // Close storage callback
    }
});

// --- 3. The High-Risk Telemetry Pipeline ---
function flagToBackendDatabase(extractedData, aiResult) {
    console.warn("🚨 HIGH RISK DETECTED (>85%). Preparing payload for backend storage.");
    
    const threatPayload = {
        timestamp: new Date().toISOString(),
        source_data: extractedData,
        analysis: aiResult
    };

    console.log("Payload ready for IT Engineer's /report endpoint:", JSON.stringify(threatPayload, null, 2));

    /* // THE FUTURE FETCH REQUEST (Uncomment when backend is ready):
    fetch('http://localhost:8000/report_threat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(threatPayload)
    }).then(res => console.log("Threat logged successfully"))
      .catch(err => console.error("Failed to log threat", err));
    */
}

// --- 4. Floating UI Injection ---
function renderFloatingUI(x, y, info) {
    let overlay = document.getElementById("trustlens-overlay");
    
    // Create the overlay if it doesn't exist
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "trustlens-overlay";
        document.body.appendChild(overlay);

        // Click anywhere else to close it
        document.addEventListener("click", function closeOverlay(e) {
            if (!overlay.contains(e.target)) {
                overlay.remove();
                document.removeEventListener("click", closeOverlay);
            }
        });
    }

    // Base CSS to ensure it floats above everything and ignores host site styles
    overlay.style.cssText = `
        position: fixed;
        top: ${y + 10}px;
        left: ${x + 10}px;
        width: 280px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        font-family: Arial, sans-serif;
        z-index: 2147483647; /* Maximum possible z-index */
        padding: 15px;
        border: 1px solid #e2e8f0;
        color: #333;
    `;

    if (info.state === "loading") {
        overlay.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px; color: #2563eb;">Transparency is scanning...</div>
            <div style="font-size: 12px; color: #64748b;">Extracting context and querying AI.</div>
        `;
    } else if (info.state === "no_consent") {
        overlay.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px; color: #991b1b;">Action Required</div>
            <div style="font-size: 13px; line-height: 1.4; color: #475569;">
                Please click the Transparency extension icon in your toolbar and accept the Privacy Policy to enable scanning.
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

// --- 5. Helper & Parsing Functions (From previous steps) ---
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
        ad_title: "Not found",
        ad_price: "Not found",
        ad_description: "Not found",
        seller_name: "Not found",
        seller_stats: "Not found",
        seller_member_since: "Not found",
        url: window.location.href
    };

    try {
        // 1. Title: The <h1> tag is the only clean way to get just the title without the price
        const titleNode = document.querySelector('h1');
        if (titleNode) payload.context.ad_title = titleNode.innerText.trim();

        // 2. Price
        const priceNode = document.querySelector('[data-qa-id="adview_price"]');
        if (priceNode) payload.context.ad_price = priceNode.innerText.replace(/\n/g, ' ').trim();

        // 3. Description
        const descNode = document.querySelector('#readme-content') || document.querySelector('[data-qa-id="adview_description_container"] p');
        if (descNode) payload.context.ad_description = descNode.innerText.trim();

        // 4. Extract Seller Context
        const profileContainer = document.querySelector('[data-qa-id="adview_profile_part"]');
        if (profileContainer) {
            // Name: Target the specific profile link
            const nameNode = profileContainer.querySelector('a[href^="/profile/"][aria-label^="Profil"]');
            if (nameNode) payload.context.seller_name = nameNode.innerText.trim();
        }

        // Stats: Document-wide search for the accessibility label
        // Removing the 'button' restriction since the label is attached to an inner <div>
        const statsNode = document.querySelector('[aria-label^="Utilisateur noté"]');
        if (statsNode) {
            payload.context.seller_stats = statsNode.getAttribute('aria-label');
        }

        // Member Since: Document-wide search for the specific text
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

    console.log("Leboncoin Extraction payload ready:", payload);
    return payload;
}

function parseWhatsApp(targetNode, payload) {
    payload.platform = "whatsapp";
    
    // 1. Grab the specific text the user right-clicked on
    payload.extracted_text = window.getSelection().toString().trim() || targetNode.innerText.trim();

    // Default context scaffolding
    payload.context = {
        ...payload.context,
        sender_name_or_number: "Not found",
        timestamp: "Not found",
        url: window.location.href
    };

    try {
        // 2. Find the message bubble container
        // We traverse up from the clicked text to find the nearest div containing the hidden copy-paste data
        const messageRow = targetNode.closest('[data-pre-plain-text]');

        if (messageRow) {
            const preText = messageRow.getAttribute('data-pre-plain-text');

            // 3. Regex Extraction
            // This reads: "[16:40, 09/03/2026] Edmond de Maistre: "
            // Group 1 matches the date/time. Group 2 matches everything up to the colon.
            const match = preText.match(/\[(.*?)\] (.*?):/);

            if (match && match.length === 3) {
                payload.context.timestamp = match[1].trim(); 
                payload.context.sender_name_or_number = match[2].trim(); 
            }
            
            // 4. Text Fallback: If the user right-clicked but didn't highlight, grab the whole message bubble
            if (!window.getSelection().toString().trim()) {
                // WhatsApp uses 'data-testid' for internal testing. These rarely change.
                const textNode = messageRow.querySelector('[data-testid="selectable-text"]');
                if (textNode) {
                    payload.extracted_text = textNode.innerText.trim();
                }
            }
        } else {
            // 5. Global Fallback: If clicked outside a message bubble, try to grab the chat name from the top header
            const headerTitle = document.querySelector('header span[dir="auto"]');
            if (headerTitle) {
                 payload.context.sender_name_or_number = headerTitle.innerText.trim();
            }
        }

    } catch (error) {
        console.error("Transparency: Error parsing WhatsApp DOM.", error);
    }

    console.log("WhatsApp Extraction payload ready:", payload);
    return payload;
}

function parseGmail(targetNode, payload) {
    payload.platform = "gmail";
    
    // 1. Grab the specific text the user right-clicked on
    payload.extracted_text = window.getSelection().toString().trim() || targetNode.innerText.trim();

    // Default context scaffolding
    payload.context = {
        ...payload.context,
        sender_name: "Not found",
        sender_email: "Not found",
        email_subject: "Not found",
        url: window.location.href
    };

    try {
        // 2. Locate the specific email container
        // Gmail threads can have multiple emails stacked. We traverse up to find the container of the specific email clicked.
        // If it fails to find the specific container, it falls back to searching the whole document.
        const emailContainer = targetNode.closest('.adn') || document;

        // 3. Extract Sender Name and Email
        // Gmail hides the raw email address in a custom 'email' attribute on a span tag.
        const senderNode = emailContainer.querySelector('span[email]');
        if (senderNode) {
            payload.context.sender_email = senderNode.getAttribute('email');
            
            // Gmail also usually puts the clean display name in a 'name' attribute
            payload.context.sender_name = senderNode.getAttribute('name') || senderNode.innerText.trim();
        }

        // 4. Extract Email Subject
        // The subject is typically stored in an <h2> tag with the specific class 'hP'
        const subjectNode = document.querySelector('h2.hP');
        if (subjectNode) {
            payload.context.email_subject = subjectNode.innerText.trim();
        }

    } catch (error) {
        console.error("Transparency: Error parsing Gmail DOM.", error);
    }

    console.log("Gmail Extraction payload ready:", payload);
    return payload;
}