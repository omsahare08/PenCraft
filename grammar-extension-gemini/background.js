// Background Service Worker - PenCraft Extension (Gemini Free Edition)

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "pencraft-correct",
    title: "Fix with PenCraft",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "pencraft-correct") {
    chrome.tabs.sendMessage(tab.id, {
      action: "correctFromContextMenu",
      text: info.selectionText
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "correctText") {
    correctWithGemini(request.text, request.mode || "standard")
      .then(result => sendResponse({ success: true, result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (request.action === "saveToHistory") {
    saveHistory(request.entry).then(() => sendResponse({ success: true }));
    return true;
  }
  if (request.action === "getHistory") {
    getHistory().then(history => sendResponse({ history }));
    return true;
  }
  if (request.action === "clearHistory") {
    chrome.storage.local.set({ pencraft_history: [] }, () => sendResponse({ success: true }));
    return true;
  }
  if (request.action === "deleteHistoryItem") {
    deleteHistoryItem(request.id).then(() => sendResponse({ success: true }));
    return true;
  }
  if (request.action === "getApiKey") {
    chrome.storage.local.get("pencraft_api_key", (data) => {
      sendResponse({ apiKey: data.pencraft_api_key || "" });
    });
    return true;
  }
  if (request.action === "saveApiKey") {
    chrome.storage.local.set({ pencraft_api_key: request.apiKey }, () => sendResponse({ success: true }));
    return true;
  }
});

// Current confirmed working models (March 2026)
// gemini-2.5-flash-lite: fastest, highest free RPM
// gemini-2.5-flash: smarter, slightly slower
// Extension will auto-skip any model that returns 404/not-found
const MODEL_FALLBACKS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
];

async function correctWithGemini(text, mode) {
  const data = await chrome.storage.local.get("pencraft_api_key");
  const apiKey = data.pencraft_api_key;
  if (!apiKey) throw new Error("NO_API_KEY");

  const prompts = {
    standard: `You are an expert editor. Correct ALL spelling mistakes and grammatical errors in the following text. Return ONLY the corrected text with no explanations, no preamble, no quotes. Preserve the original meaning and tone exactly.\n\nText: ${text}`,
    formal: `You are an expert editor. Correct all spelling and grammar errors AND rewrite the following text in a formal, professional tone. Return ONLY the corrected text with no explanations, no preamble, no quotes.\n\nText: ${text}`,
    concise: `You are an expert editor. Correct all spelling and grammar errors AND make the following text more concise while preserving meaning. Return ONLY the corrected text with no explanations, no preamble, no quotes.\n\nText: ${text}`,
    explain: `You are an expert editor. Correct all spelling and grammar errors in the following text. Then provide a brief explanation.\n\nFormat your response EXACTLY as:\nCORRECTED: [corrected text here]\nCHANGES: [brief bullet list of what was fixed]\n\nText: ${text}`
  };

  const prompt = prompts[mode] || prompts.standard;

  // Try each model — skip on rate limit OR model-not-found
  for (const model of MODEL_FALLBACKS) {
    try {
      const result = await callGeminiModel(apiKey, model, prompt);
      return result;
    } catch (err) {
      if (err.message === "RATE_LIMIT" || err.message === "MODEL_NOT_FOUND") {
        continue; // silently try next
      }
      throw err; // hard error (bad key, network) — stop
    }
  }

  // All models failed — wait 6s then retry the first one
  await sleep(6000);
  try {
    return await callGeminiModel(apiKey, MODEL_FALLBACKS[0], prompt);
  } catch (err) {
    if (err.message === "RATE_LIMIT") throw new Error("RATE_LIMIT_ALL");
    throw err;
  }
}

async function callGeminiModel(apiKey, model, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = (err?.error?.message || "").toLowerCase();
    const status = response.status;

    // 404 or "not found/not supported" = wrong model name, skip it
    if (status === 404 || msg.includes("not found") || msg.includes("not supported")) {
      throw new Error("MODEL_NOT_FOUND");
    }
    // 429 = rate limited on this model
    if (status === 429) throw new Error("RATE_LIMIT");
    // 400/403 with key-related message = bad API key
    if (status === 400 || status === 403) throw new Error("INVALID_API_KEY");

    throw new Error(err?.error?.message || `API error ${status}`);
  }

  const json = await response.json();
  const result = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!result) throw new Error("Empty response from Gemini");
  return result;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function saveHistory(entry) {
  const data = await chrome.storage.local.get("pencraft_history");
  const history = data.pencraft_history || [];
  history.unshift(entry);
  if (history.length > 100) history.splice(100);
  await chrome.storage.local.set({ pencraft_history: history });
}

async function getHistory() {
  const data = await chrome.storage.local.get("pencraft_history");
  return data.pencraft_history || [];
}

async function deleteHistoryItem(id) {
  const data = await chrome.storage.local.get("pencraft_history");
  const history = (data.pencraft_history || []).filter(item => item.id !== id);
  await chrome.storage.local.set({ pencraft_history: history });
}
