// Popup script
let aiEnabled = false;

function getChromeError() {
  return chrome.runtime.lastError ? chrome.runtime.lastError.message : '';
}

function showNotification(message) {
  const existing = document.querySelector('.notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

function setAIStatus(active) {
  const aiStatus = document.getElementById('aiStatus');
  aiStatus.textContent = active ? 'Active' : 'Inactive';
  aiStatus.classList.toggle('active', active);
  aiStatus.classList.toggle('inactive', !active);
}

function updateUI() {
  const toggle = document.getElementById('aiToggle');
  const pageStatus = document.getElementById('pageStatus');
  const gameStatus = document.getElementById('gameStatus');
  const gameStateValue = document.getElementById('gameStateValue');
  const makeMoveBtn = document.getElementById('makeMoveBtn');

  aiEnabled = Boolean(toggle?.checked);
  setAIStatus(aiEnabled);

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.url) {
      pageStatus.textContent = 'Unknown';
      pageStatus.style.color = '#aaa';
      makeMoveBtn.disabled = true;
      gameStatus.style.display = 'none';
      return;
    }

    if (!tab.url.includes('chess.com')) {
      pageStatus.textContent = 'Not Chess.com';
      pageStatus.style.color = '#ff4757';
      makeMoveBtn.disabled = true;
      gameStatus.style.display = 'none';
      return;
    }

    pageStatus.textContent = 'Chess.com ✓';
    pageStatus.style.color = '#4CAF50';
    makeMoveBtn.disabled = false;
    gameStatus.style.display = 'flex';

    chrome.tabs.sendMessage(tab.id, { type: 'GET_GAME_STATE' }, (response) => {
      const error = getChromeError();
      if (error) {
        gameStateValue.textContent = 'Reload chess.com tab';
        return;
      }

      if (!response) return;

      gameStateValue.textContent = response.gameState || 'Ready';
      if (response.enabled !== undefined) {
        aiEnabled = response.enabled;
        toggle.checked = aiEnabled;
        setAIStatus(aiEnabled);
      }
    });
  });
}

document.getElementById('aiToggle').addEventListener('change', (event) => {
  aiEnabled = event.target.checked;

  chrome.runtime.sendMessage({
    type: 'TOGGLE_AI',
    enabled: aiEnabled
  });

  showNotification(aiEnabled ? 'Stockfish enabled' : 'Stockfish disabled');
  updateUI();
});

document.getElementById('makeMoveBtn').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.id || !tab.url?.includes('chess.com')) return;

    chrome.tabs.sendMessage(tab.id, { type: 'MAKE_AI_MOVE' }, (response) => {
      const error = getChromeError();
      if (error) {
        if (error.includes('Extension context invalidated')) {
          showNotification('Extension updated. Please refresh Chess.com');
          gameStateValue.textContent = 'Please refresh page';
        } else {
          showNotification(error);
        }
        return;
      }

      if (response?.success) {
        showNotification(`Stockfish moved: ${response.move || 'done'}`);
      } else {
        showNotification(response?.error || 'Could not make move');
      }
    });
  });
});

document.getElementById('refreshBtn').addEventListener('click', () => {
  updateUI();
  showNotification('Status refreshed');
});

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['aiEnabled', 'stockfishDepth', 'stockfishTime'], (result) => {
    if (result.aiEnabled !== undefined) {
      aiEnabled = result.aiEnabled;
      document.getElementById('aiToggle').checked = aiEnabled;
    }
    
    if (result.stockfishDepth !== undefined) {
      const depth = result.stockfishDepth;
      document.getElementById('stockfishDepth').value = depth;
      document.getElementById('depthVal').textContent = depth;
    }
    
    if (result.stockfishTime !== undefined) {
      const time = result.stockfishTime;
      document.getElementById('stockfishTime').value = time;
      document.getElementById('timeVal').textContent = (time / 1000).toFixed(1) + 's';
    } else {
      chrome.storage.local.set({ stockfishDepth: 15, stockfishTime: 2000 });
    }
    
    updateUI();
  });
});

document.getElementById('stockfishDepth').addEventListener('input', (e) => {
  const depth = e.target.value;
  document.getElementById('depthVal').textContent = depth;
});

document.getElementById('stockfishDepth').addEventListener('change', (e) => {
  const depth = parseInt(e.target.value);
  chrome.storage.local.set({ stockfishDepth: depth }, () => {
    showNotification(`Depth set to ${depth}`);
  });
});

document.getElementById('stockfishTime').addEventListener('input', (e) => {
  const time = e.target.value;
  document.getElementById('timeVal').textContent = (time / 1000).toFixed(1) + 's';
});

document.getElementById('stockfishTime').addEventListener('change', (e) => {
  const time = parseInt(e.target.value);
  chrome.storage.local.set({ stockfishTime: time }, () => {
    showNotification(`Max think time: ${(time / 1000).toFixed(1)}s`);
  });
});
