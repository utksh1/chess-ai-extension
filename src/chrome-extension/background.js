/**
 * CHESS.COM AI EXTENSION - Background Service Worker
 * 
 * This is the background script that runs independently of web pages.
 * It manages the extension's state and coordinates between the popup
 * and content scripts.
 */

// Extension state
let extensionState = {
  enabled: false,
  gamesPlayed: 0
};

chrome.storage.sync.get(['aiEnabled', 'gamesPlayed'], (result) => {
  extensionState.enabled = Boolean(result.aiEnabled);
  extensionState.gamesPlayed = result.gamesPlayed || 0;
});

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Chess.com AI Extension installed/updated');
  
  // Set default settings
  chrome.storage.sync.set({
    aiEnabled: false,
    gamesPlayed: 0
  });
  chrome.storage.local.set({
    stockfishDepth: 25
  });
});

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background: Received message:', message.type);
  
  switch (message.type) {
    case 'TOGGLE_AI':
      extensionState.enabled = message.enabled;
      
      // Save to storage
      chrome.storage.sync.set({
        aiEnabled: message.enabled
      });
      
      // Forward to active tab if on chess.com
      forwardToChessComTab({
        type: 'TOGGLE_AI',
        enabled: message.enabled
      });
      
      sendResponse({ success: true });
      break;
      
    case 'MAKE_AI_MOVE':
      // Forward to active tab
      forwardToChessComTab({
        type: 'MAKE_AI_MOVE'
      }, sendResponse);
      
      // Return true to indicate async response
      return true;
      
    case 'GAME_COMPLETED':
      extensionState.gamesPlayed++;
      chrome.storage.sync.set({
        gamesPlayed: extensionState.gamesPlayed
      });
      sendResponse({ success: true });
      break;
      
    case 'GET_STATE':
      sendResponse({
        enabled: extensionState.enabled,
        gamesPlayed: extensionState.gamesPlayed
      });
      break;
      
    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

// Forward message to active chess.com tab
function forwardToChessComTab(message, callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url && tabs[0].url.includes('chess.com')) {
      sendTabMessage(tabs[0].id, message, callback);
    } else if (callback) {
      callback({ 
        success: false, 
        error: 'No active chess.com tab found' 
      });
    }
  });
}

function sendTabMessage(tabId, message, callback) {
  chrome.tabs.sendMessage(tabId, message, (response) => {
    const error = chrome.runtime.lastError;
    if (error) {
      console.debug('Chess AI: content script not ready:', error.message);
      if (callback) {
        callback({
          success: false,
          error: 'Reload chess.com tab'
        });
      }
      return;
    }

    if (callback) {
      callback(response);
    }
  });
}

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('chess.com')) {
    console.log('Chess.com page loaded, injecting AI...');
    
    // Send current state to the page
    setTimeout(() => {
      sendTabMessage(tabId, {
        type: 'INIT_STATE',
        enabled: extensionState.enabled
      });
    }, 500);
  }
});

// Keyboard shortcut handler (if configured)
chrome.commands?.onCommand.addListener((command) => {
  console.log('Command:', command);
  
  if (command === 'toggle-ai') {
    extensionState.enabled = !extensionState.enabled;
    chrome.storage.sync.set({ aiEnabled: extensionState.enabled });
    
    forwardToChessComTab({
      type: 'TOGGLE_AI',
      enabled: extensionState.enabled
    });
  }
});

console.log('Chess.com AI Background Service Worker loaded');
