document.addEventListener('DOMContentLoaded', () => {
    const consentView = document.getElementById('consent-view');
    const activeView = document.getElementById('active-view');
    const agreeBtn = document.getElementById('agree-btn');
    const revokeBtn = document.getElementById('revoke-btn');
    const clientIdDisplay = document.getElementById('client-id-display');

    // Standard UUID v4 Generator for Anonymous Tracking
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // On Load: Check Chrome Storage for GDPR Consent
    chrome.storage.local.get(['consentGiven', 'clientId'], (result) => {
        if (result.consentGiven) {
            showActiveView(result.clientId);
        } else {
            consentView.style.display = 'block';
        }
    });

    // Handle "I Agree"
    agreeBtn.addEventListener('click', () => {
        const newClientId = generateUUID();
        // Save to local storage
        chrome.storage.local.set({ consentGiven: true, clientId: newClientId }, () => {
            consentView.style.display = 'none';
            showActiveView(newClientId);
        });
    });

    // Handle "Revoke Consent" (GDPR Right to Opt-Out)
    revokeBtn.addEventListener('click', () => {
        chrome.storage.local.set({ consentGiven: false, clientId: null }, () => {
            activeView.style.display = 'none';
            consentView.style.display = 'block';
        });
    });

    function showActiveView(clientId) {
        activeView.style.display = 'block';
        clientIdDisplay.textContent = clientId;
    }
});