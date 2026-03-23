document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('analyze-btn');
    const scoreEl = document.getElementById('score');
    const statusCard = document.getElementById('status-card');
    const statusText = document.getElementById('status-text');
    const reasonEl = document.getElementById('reason-text');

    btn.addEventListener('click', async () => {
        // 1. Find the active tab the user is looking at
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // 2. Ask the content.js script on that tab to extract the data
        chrome.tabs.sendMessage(tab.id, { action: "extract_data" }, (response) => {
            
            // Handle cases where the user didn't highlight anything or script didn't load
            if (chrome.runtime.lastError || !response) {
                reasonEl.textContent = "Error: Refresh the page and try again.";
                return;
            }
            if (response.error) {
                reasonEl.textContent = response.error;
                return;
            }

            // 3. If we successfully got data, start the UI loading sequence
            setLoadingState(btn, scoreEl, reasonEl, statusCard, statusText);

            // Log the extracted data to the console so you can see it working!
            console.log("Data extracted from page:", response);

            // 4. Simulate network delay, then show mock results
            setTimeout(() => {
                const mockResponse = generateMockResponse(response.platform);
                updateUIWithResults(mockResponse, btn, scoreEl, reasonEl, statusCard, statusText);
            }, 1500);
        });
    });
});

function setLoadingState(btn, scoreEl, reasonEl, statusCard, statusText) {
    btn.disabled = true;
    btn.textContent = "Analyzing...";
    scoreEl.textContent = "...";
    reasonEl.textContent = "Querying AI and Threat Intel...";
    statusCard.className = "card default";
    statusText.textContent = "Scanning";
}

function updateUIWithResults(mockResponse, btn, scoreEl, reasonEl, statusCard, statusText) {
    scoreEl.textContent = `${mockResponse.risk_score}%`;
    reasonEl.textContent = mockResponse.reason;
    
    if (mockResponse.risk_score < 40) {
        statusCard.className = "card safe";
        statusText.textContent = "Likely Safe";
    } else if (mockResponse.risk_score < 75) {
        statusCard.className = "card warning";
        statusText.textContent = "Exercise Caution";
    } else {
        statusCard.className = "card danger";
        statusText.textContent = "High Risk Detected";
    }

    btn.disabled = false;
    btn.textContent = "Analyze Again";
}

function generateMockResponse(platform) {
    // Adding the platform name to the reason just to prove it knows where we are
    const scenarios = [
        { risk_score: 12, reason: `[${platform.toUpperCase()}] No suspicious links detected. Standard language.` },
        { risk_score: 65, reason: `[${platform.toUpperCase()}] Urgency detected, proceed with caution.` },
        { risk_score: 92, reason: `[${platform.toUpperCase()}] CRITICAL: URL flagged by VirusTotal.` }
    ];
    return scenarios[Math.floor(Math.random() * scenarios.length)];
}