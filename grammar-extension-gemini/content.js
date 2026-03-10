// PenCraft Content Script

(function() {
  'use strict';

  let triggerBtn = null;
  let panel = null;
  let toast = null;
  let selectedText = '';
  let selectedRange = null;
  let correctedText = '';
  let currentMode = 'standard';
  let activeElement = null;

  // Create trigger button
  function createTriggerBtn() {
    if (document.getElementById('pencraft-trigger-btn')) return;
    triggerBtn = document.createElement('div');
    triggerBtn.id = 'pencraft-trigger-btn';
    triggerBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="url(#pg)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <defs>
          <linearGradient id="pg" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop stop-color="#c4b5fd"/>
            <stop offset="1" stop-color="#818cf8"/>
          </linearGradient>
        </defs>
      </svg>
    `;
    triggerBtn.title = 'Fix with PenCraft';
    triggerBtn.style.display = 'none';
    triggerBtn.style.position = 'fixed';
    document.body.appendChild(triggerBtn);

    triggerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPanel();
    });
  }

  // Create floating panel
  function createPanel() {
    if (document.getElementById('pencraft-panel')) return;
    panel = document.createElement('div');
    panel.id = 'pencraft-panel';
    panel.innerHTML = `
      <div class="pencraft-panel-header">
        <span class="pencraft-panel-title">PenCraft Correction</span>
        <button class="pencraft-panel-close" id="pencraft-close">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="pencraft-panel-body">
        <div class="pencraft-label">Original</div>
        <div class="pencraft-text-box" id="pencraft-original"></div>
        
        <div class="pencraft-modes" id="pencraft-modes">
          <button class="pencraft-mode-btn active" data-mode="standard">Standard</button>
          <button class="pencraft-mode-btn" data-mode="formal">Formal</button>
          <button class="pencraft-mode-btn" data-mode="concise">Concise</button>
          <button class="pencraft-mode-btn" data-mode="explain">Explain</button>
        </div>

        <div class="pencraft-label">Corrected</div>
        <div class="pencraft-result-box" id="pencraft-result">
          <div class="pencraft-loading">
            <div class="pencraft-spinner"></div>
            <span>Correcting...</span>
          </div>
        </div>
        <div class="pencraft-changes" id="pencraft-changes"></div>

        <div class="pencraft-actions" id="pencraft-action-btns" style="display:none;">
          <button class="pencraft-btn-copy" id="pencraft-copy">Copy</button>
          <button class="pencraft-btn-replace" id="pencraft-replace">Replace Text</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    document.getElementById('pencraft-close').addEventListener('click', closePanel);

    document.querySelectorAll('.pencraft-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentMode = btn.dataset.mode;
        document.querySelectorAll('.pencraft-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        triggerCorrection();
      });
    });

    document.getElementById('pencraft-copy').addEventListener('click', copyResult);
    document.getElementById('pencraft-replace').addEventListener('click', replaceSelection);
  }

  // Create toast
  function createToast() {
    if (document.getElementById('pencraft-toast')) return;
    toast = document.createElement('div');
    toast.id = 'pencraft-toast';
    document.body.appendChild(toast);
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
  }

  // Selection handler
  document.addEventListener('mouseup', (e) => {
    if (e.target.closest('#pencraft-panel') || e.target.closest('#pencraft-trigger-btn')) return;
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : '';
      if (text.length >= 3) {
        selectedText = text;
        selectedRange = sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
        activeElement = document.activeElement;
        positionTriggerBtn(e.clientX, e.clientY);
      } else {
        hideTriggerBtn();
      }
    }, 10);
  });

  document.addEventListener('keyup', (e) => {
    if (e.target.closest('#pencraft-panel') || e.target.closest('#pencraft-trigger-btn')) return;
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : '';
    if (text.length >= 3) {
      selectedText = text;
      selectedRange = sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('#pencraft-panel') && !e.target.closest('#pencraft-trigger-btn')) {
      hideTriggerBtn();
      if (!e.target.closest('#pencraft-panel')) closePanel();
    }
  });

  function positionTriggerBtn(x, y) {
    if (!triggerBtn) return;
    const btnSize = 36;
    const padding = 10;
    let left = x + 12;
    let top = y - btnSize - 8;

    if (left + btnSize > window.innerWidth - padding) left = window.innerWidth - btnSize - padding;
    if (top < padding) top = y + 12;

    triggerBtn.style.left = left + 'px';
    triggerBtn.style.top = top + 'px';
    triggerBtn.style.display = 'flex';
  }

  function hideTriggerBtn() {
    if (triggerBtn) triggerBtn.style.display = 'none';
  }

  function openPanel() {
    hideTriggerBtn();
    if (!panel) createPanel();

    const orig = document.getElementById('pencraft-original');
    const result = document.getElementById('pencraft-result');
    const changes = document.getElementById('pencraft-changes');
    const actions = document.getElementById('pencraft-action-btns');

    orig.textContent = selectedText;
    result.innerHTML = `<div class="pencraft-loading"><div class="pencraft-spinner"></div><span>Correcting...</span></div>`;
    changes.style.display = 'none';
    actions.style.display = 'none';
    correctedText = '';

    // Position panel
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const pw = 380;
    const ph = 320;
    let left = (viewW - pw) / 2;
    let top = (viewH - ph) / 2;
    left = Math.max(12, Math.min(left, viewW - pw - 12));
    top = Math.max(12, Math.min(top, viewH - ph - 12));

    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
    panel.style.display = 'block';

    triggerCorrection();
  }

  function closePanel() {
    if (panel) panel.style.display = 'none';
  }

  function triggerCorrection() {
    if (!selectedText) return;
    const result = document.getElementById('pencraft-result');
    const changes = document.getElementById('pencraft-changes');
    const actions = document.getElementById('pencraft-action-btns');

    result.innerHTML = `<div class="pencraft-loading"><div class="pencraft-spinner"></div><span>Correcting...</span></div>`;
    changes.style.display = 'none';
    actions.style.display = 'none';
    correctedText = '';

    chrome.runtime.sendMessage(
      { action: 'correctText', text: selectedText, mode: currentMode },
      (response) => {
        if (chrome.runtime.lastError) {
          result.innerHTML = `<span style="color:#ff6b6b;font-size:12px;">Extension error. Please reload the page.</span>`;
          return;
        }
        if (!response.success) {
          if (response.error === 'NO_API_KEY') {
            result.innerHTML = `<span style="color:#fbbf24;font-size:12px;">Gemini API key not set. Click the PenCraft icon in your toolbar to add your free key.</span>`;
          } else if (response.error === 'INVALID_API_KEY') {
            result.innerHTML = `<span style="color:#ff6b6b;font-size:12px;">Invalid API key. Get a free key at aistudio.google.com/app/apikey</span>`;
          } else if (response.error === 'RATE_LIMIT' || response.error === 'RATE_LIMIT_ALL') {
            result.innerHTML = `<span style="color:#fbbf24;font-size:12px;">All free models are busy right now. Please wait 10–15 seconds and try again.</span>`;
          } else {
            result.innerHTML = `<span style="color:#ff6b6b;font-size:12px;">Error: ${response.error}</span>`;
          }
          return;
        }

        const rawResult = response.result;
        
        if (currentMode === 'explain') {
          const correctedMatch = rawResult.match(/CORRECTED:\s*([\s\S]*?)(?:\nCHANGES:|$)/);
          const changesMatch = rawResult.match(/CHANGES:\s*([\s\S]*?)$/);
          correctedText = correctedMatch ? correctedMatch[1].trim() : rawResult;
          result.innerHTML = `<div class="pencraft-diff">${buildDiff(selectedText, correctedText)}</div>`;
          if (changesMatch) {
            changes.innerHTML = changesMatch[1].trim().replace(/\n/g, '<br>');
            changes.style.display = 'block';
          }
        } else {
          correctedText = rawResult.trim();
          result.innerHTML = `<div class="pencraft-diff">${buildDiff(selectedText, correctedText)}</div>`;
        }

        actions.style.display = 'flex';

        // Save to history
        const entry = {
          id: Date.now().toString(),
          original: selectedText,
          corrected: correctedText,
          mode: currentMode,
          timestamp: new Date().toISOString(),
          url: location.href,
          domain: location.hostname
        };
        chrome.runtime.sendMessage({ action: 'saveToHistory', entry });
      }
    );
  }

  // Simple word-level diff
  function buildDiff(original, corrected) {
    if (original === corrected) return escapeHtml(corrected) + ' <span style="color:#4ade80;font-size:11px;">(no changes needed)</span>';
    
    // Highlight differences at word level
    const origWords = original.split(/\s+/);
    const corrWords = corrected.split(/\s+/);
    
    // Simple LCS-based diff
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

    // Backtrack
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
      if (op.type === 'delete') return `<del>${escapeHtml(op.word)}</del>`;
    }).join(' ');
  }

  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function copyResult() {
    if (!correctedText) return;
    navigator.clipboard.writeText(correctedText).then(() => {
      showToast('Copied to clipboard');
    });
  }

  function replaceSelection() {
    if (!correctedText) return;
    
    // Try to replace in editable elements
    const el = activeElement;
    if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable)) {
      if (el.isContentEditable) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount) {
          sel.removeAllRanges();
          if (selectedRange) sel.addRange(selectedRange);
          document.execCommand('insertText', false, correctedText);
        }
      } else {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const val = el.value;
        el.value = val.substring(0, start) + correctedText + val.substring(end);
        el.setSelectionRange(start, start + correctedText.length);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      showToast('Text replaced');
    } else {
      // Try execCommand on selected content
      if (selectedRange) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(selectedRange);
        const success = document.execCommand('insertText', false, correctedText);
        if (!success) {
          copyResult();
          showToast('Copied (cannot replace here)');
          closePanel();
          return;
        }
      }
      showToast('Text replaced');
    }
    closePanel();
  }

  // Handle context menu trigger
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'correctFromContextMenu') {
      selectedText = request.text;
      openPanel();
    }
  });

  // Initialize
  createTriggerBtn();
  createToast();
})();

// Patch: extended error messages for Gemini-specific errors
// (these override the generic handler in the message listener above)
