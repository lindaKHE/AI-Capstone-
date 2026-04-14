// Create the context menu item when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "analyze-trustlens",
        title: "Analyze with Transparency",
        contexts: ["all"] // Shows up whether they click text, images, or backgrounds
    });
});

// Listen for clicks on the context menu
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "analyze-trustlens") {
        // Send a message to the content script in the active tab
        chrome.tabs.sendMessage(tab.id, { action: "trigger_analysis" });
    }
});