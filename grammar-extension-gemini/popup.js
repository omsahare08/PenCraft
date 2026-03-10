// PenCraft Popup Script

document.addEventListener('DOMContentLoaded', () => {
  // Tab navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${tab}`).classList.add('active');
      if (tab === 'history') loadHistory();
      if (tab === 'stats') loadStats();
    });
  });

  // Settings toggle
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('settingsClose').addEventListener('click', closeSettings);

  // Mode selection
  document.querySelectorAll('.mode-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.mode-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });

  // Clear input
  document.getElementById('clearInput').addEventListener('click', () => {
    document.getElementById('inputText').value = '';
    document.getElementById('resultSection').style.display = 'none';
    document.getElementById('inputText').focus();
  });

  // Correct button
  document.getElementById('correctBtn').addEventListener('click', handleCorrect);

  // Ctrl+Enter shortcut
  document.getElementById('inputText').addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleCorrect();
  });

  // Copy result
  document.getElementById('copyResult').addEventListener('click', () => {
    const text = document.getElementById('resultDisplay').textContent;
    navigator.clipboard.writeText(text).then(() => showMiniToast('Copied'));
  });

  // History search
  document.getElementById('historySearch').addEventListener('input', filterHistory);

  // Clear history
  document.getElementById('clearHistory').addEventListener('click', () => {
    if (confirm('Clear all correction history?')) {
      chrome.runtime.sendMessage({ action: 'clearHistory' }, () => loadHistory());
    }
  });

  // API key toggle
  document.getElementById('toggleApiKey').addEventListener('click', () => {
    const input = document.getElementById('apiKeyInput');
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
  });

  // Save settings
  document.getElementById('saveSettings').addEventListener('click', saveSettings);

  // Load API key
  chrome.runtime.sendMessage({ action: 'getApiKey' }, (res) => {
    if (res?.apiKey) document.getElementById('apiKeyInput').value = res.apiKey;
  });

  // Load history initially for count
  loadHistoryCount();
});

let allHistory = [];
let currentManualMode = 'standard';
let lastCorrectedText = '';

function handleCorrect() {
  const text = document.getElementById('inputText').value.trim();
  if (!text) return;

  const mode = document.querySelector('.mode-chip.active')?.dataset.mode || 'standard';
  currentManualMode = mode;

  const btn = document.getElementById('correctBtn');
  const btnText = document.getElementById('correctBtnText');
  const spinner = document.getElementById('btnSpinner');

  btn.disabled = true;
  btnText.textContent = 'Correcting...';
  spinner.style.display = 'block';

  chrome.runtime.sendMessage({ action: 'correctText', text, mode }, (response) => {
    btn.disabled = false;
    btnText.textContent = 'Correct Text';
    spinner.style.display = 'none';

    const section = document.getElementById('resultSection');
    const display = document.getElementById('resultDisplay');
    const changes = document.getElementById('changesDisplay');
    const charStats = document.getElementById('charStats');

    section.style.display = 'block';
    changes.style.display = 'none';

    if (!response?.success) {
      const errMap = {
        'NO_API_KEY': 'Gemini API key not set. Click the settings icon to add your free key.',
        'INVALID_API_KEY': 'Invalid API key. Get a free key at aistudio.google.com/app/apikey',
        'RATE_LIMIT': 'Rate limited — trying fallback models automatically. If this persists, wait 15 seconds.',
        'RATE_LIMIT_ALL': 'All free models are currently busy. Please wait 15 seconds and try again.'
      };
      const errMsg = errMap[response?.error] || `Error: ${response?.error || 'Unknown error'}`;
      display.innerHTML = `<span style="color:#fbbf24;font-size:12px;">${errMsg}</span>`;
      return;
    }

    const rawResult = response.result;
    let correctedText = rawResult;

    if (mode === 'explain') {
      const corrMatch = rawResult.match(/CORRECTED:\s*([\s\S]*?)(?:\nCHANGES:|$)/);
      const changesMatch = rawResult.match(/CHANGES:\s*([\s\S]*?)$/);
      correctedText = corrMatch ? corrMatch[1].trim() : rawResult;
      if (changesMatch) {
        changes.innerHTML = changesMatch[1].trim().replace(/\n/g, '<br>');
        changes.style.display = 'block';
      }
    }

    lastCorrectedText = correctedText.trim();
    display.innerHTML = buildDiffHTML(text, lastCorrectedText);

    const origLen = text.length;
    const corrLen = lastCorrectedText.length;
    charStats.textContent = `${origLen} chars original  →  ${corrLen} chars corrected`;

    // Save history
    const entry = {
      id: Date.now().toString(),
      original: text,
      corrected: lastCorrectedText,
      mode,
      timestamp: new Date().toISOString(),
      url: '',
      domain: 'popup'
    };
    chrome.runtime.sendMessage({ action: 'saveToHistory', entry });
    loadHistoryCount();
  });
}

function buildDiffHTML(original, corrected) {
  if (original === corrected) {
    return escapeHtml(corrected) + ' <span style="color:#4ade80;font-size:11px;">(no changes needed)</span>';
  }
  const origWords = original.split(/\s+/);
  const corrWords = corrected.split(/\s+/);
  const dp = Array(origWords.length + 1).fill(null).map(() => Array(corrWords.length + 1).fill(0));
  for (let i = 1; i <= origWords.length; i++) {
    for (let j = 1; j <= corrWords.length; j++) {
      if (origWords[i-1].toLowerCase() === corrWords[j-1].toLowerCase()) {
        dp[i][j] = dp[i-1][j-1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1]);
      }
    }
  }
  const ops = [];
  let i = origWords.length, j = corrWords.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origWords[i-1].toLowerCase() === corrWords[j-1].toLowerCase()) {
      ops.unshift({ type: 'equal', word: corrWords[j-1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      ops.unshift({ type: 'insert', word: corrWords[j-1] });
      j--;
    } else {
      ops.unshift({ type: 'delete', word: origWords[i-1] });
      i--;
    }
  }
  return ops.map(op => {
    if (op.type === 'equal') return escapeHtml(op.word);
    if (op.type === 'insert') return `<ins>${escapeHtml(op.word)}</ins>`;
    return `<del>${escapeHtml(op.word)}</del>`;
  }).join(' ');
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function loadHistory() {
  chrome.runtime.sendMessage({ action: 'getHistory' }, (res) => {
    allHistory = res?.history || [];
    renderHistory(allHistory);
  });
}

function loadHistoryCount() {
  chrome.runtime.sendMessage({ action: 'getHistory' }, (res) => {
    allHistory = res?.history || [];
    document.getElementById('historyCount').textContent = `${allHistory.length} correction${allHistory.length !== 1 ? 's' : ''}`;
  });
}

function filterHistory() {
  const q = document.getElementById('historySearch').value.toLowerCase();
  const filtered = q ? allHistory.filter(item =>
    item.original.toLowerCase().includes(q) ||
    item.corrected.toLowerCase().includes(q) ||
    (item.domain || '').toLowerCase().includes(q)
  ) : allHistory;
  renderHistory(filtered);
}

function renderHistory(items) {
  const list = document.getElementById('historyList');
  document.getElementById('historyCount').textContent = `${allHistory.length} correction${allHistory.length !== 1 ? 's' : ''}`;

  if (!items.length) {
    list.innerHTML = `
      <div class="empty-state">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <p>${allHistory.length === 0 ? 'No history yet' : 'No results'}</p>
        <span>${allHistory.length === 0 ? 'Corrections will appear here' : 'Try a different search'}</span>
      </div>
    `;
    return;
  }

  list.innerHTML = items.map(item => {
    const date = new Date(item.timestamp);
    const timeStr = formatRelativeTime(date);
    const domain = item.domain && item.domain !== 'popup' ? item.domain : '';
    return `
      <div class="history-item" data-id="${item.id}">
        <div class="history-item-header">
          <div class="history-meta">
            <span class="history-mode">${item.mode || 'standard'}</span>
            <span class="history-time">${timeStr}</span>
            ${domain ? `<span class="history-domain">${domain}</span>` : ''}
          </div>
          <button class="history-item-delete" data-id="${item.id}" title="Delete">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="history-texts">
          <div class="history-orig">${escapeHtml(item.original)}</div>
          <div class="history-corr">${escapeHtml(item.corrected)}</div>
        </div>
        <div class="history-item-actions">
          <button class="history-copy-btn" data-text="${encodeURIComponent(item.corrected)}">Copy Corrected</button>
          <button class="history-copy-btn" data-text="${encodeURIComponent(item.original)}">Copy Original</button>
        </div>
      </div>
    `;
  }).join('');

  // Bind events
  list.querySelectorAll('.history-item-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      chrome.runtime.sendMessage({ action: 'deleteHistoryItem', id }, () => loadHistory());
    });
  });

  list.querySelectorAll('.history-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = decodeURIComponent(btn.dataset.text);
      navigator.clipboard.writeText(text).then(() => showMiniToast('Copied'));
    });
  });
}

function formatRelativeTime(date) {
  const now = new Date();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function loadStats() {
  chrome.runtime.sendMessage({ action: 'getHistory' }, (res) => {
    const history = res?.history || [];
    const today = new Date().toDateString();

    // Total
    document.getElementById('stats-total').textContent = history.length;

    // Today
    const todayCount = history.filter(h => new Date(h.timestamp).toDateString() === today).length;
    document.getElementById('stats-today').textContent = todayCount;

    // Chars corrected
    const totalChars = history.reduce((sum, h) => sum + (h.corrected?.length || 0), 0);
    document.getElementById('stats-chars').textContent = totalChars.toLocaleString();

    // Mode breakdown
    const modes = { standard: 0, formal: 0, concise: 0, explain: 0 };
    history.forEach(h => {
      if (modes[h.mode] !== undefined) modes[h.mode]++;
      else modes.standard++;
    });
    const maxMode = Math.max(...Object.values(modes), 1);
    const modeBars = document.getElementById('modeBars');
    modeBars.innerHTML = Object.entries(modes).map(([mode, count]) => `
      <div class="mode-bar-item">
        <span class="mode-bar-label">${mode}</span>
        <div class="mode-bar-track">
          <div class="mode-bar-fill" style="width: ${Math.round(count / maxMode * 100)}%"></div>
        </div>
        <span class="mode-bar-count">${count}</span>
      </div>
    `).join('');

    // Domain breakdown
    const domains = {};
    history.forEach(h => {
      if (h.domain && h.domain !== 'popup' && h.domain !== '') {
        domains[h.domain] = (domains[h.domain] || 0) + 1;
      }
    });
    const sortedDomains = Object.entries(domains).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const domainList = document.getElementById('domainList');
    if (!sortedDomains.length) {
      domainList.innerHTML = `<div class="empty-state" style="padding: 20px;"><span>Use PenCraft on websites to see domain stats</span></div>`;
    } else {
      domainList.innerHTML = sortedDomains.map(([domain, count]) => `
        <div class="domain-item">
          <span class="domain-name">${domain}</span>
          <span class="domain-count">${count}</span>
        </div>
      `).join('');
    }
  });
}

function openSettings() {
  document.getElementById('settingsPanel').style.display = 'flex';
  chrome.runtime.sendMessage({ action: 'getApiKey' }, (res) => {
    if (res?.apiKey) document.getElementById('apiKeyInput').value = res.apiKey;
  });
}

function closeSettings() {
  document.getElementById('settingsPanel').style.display = 'none';
}

function saveSettings() {
  const apiKey = document.getElementById('apiKeyInput').value.trim();
  const feedback = document.getElementById('saveFeedback');

  if (!apiKey) {
    feedback.textContent = 'Please enter an API key';
    feedback.className = 'save-feedback error';
    feedback.style.display = 'block';
    setTimeout(() => feedback.style.display = 'none', 3000);
    return;
  }

  if (apiKey.length < 20) {
    feedback.textContent = 'Key looks too short. Get yours at aistudio.google.com/app/apikey';
    feedback.className = 'save-feedback error';
    feedback.style.display = 'block';
    setTimeout(() => feedback.style.display = 'none', 4000);
    return;
  }

  chrome.runtime.sendMessage({ action: 'saveApiKey', apiKey }, (res) => {
    if (res?.success) {
      feedback.textContent = 'Settings saved successfully';
      feedback.className = 'save-feedback success';
      feedback.style.display = 'block';
      setTimeout(() => {
        feedback.style.display = 'none';
        closeSettings();
      }, 1500);
    }
  });
}

function showMiniToast(msg) {
  let toast = document.getElementById('mini-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'mini-toast';
    toast.style.cssText = `
      position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
      background: #1a1a2e; color: #e8e4ff; font-family: 'DM Sans', sans-serif;
      font-size: 12px; font-weight: 500; padding: 7px 16px; border-radius: 100px;
      border: 1px solid rgba(120,80,255,0.3); z-index: 9999; pointer-events: none;
      transition: opacity 0.2s;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 1800);
}
