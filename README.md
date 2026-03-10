
# PenCraft — AI Grammar & Spell Corrector

A professional Chrome extension that instantly corrects spelling and grammar for any selected text on any webpage, powered by Google Gemini AI (free tier — no credit card required).

---

## Features

- **Select & Fix** — Select any text on any webpage, click the floating button that appears, and get it corrected instantly
- **Right-click Support** — Use the context menu "Fix with PenCraft" on any selected text
- **4 Correction Modes**
  - **Standard** — Fix spelling and grammar while preserving your tone
  - **Formal** — Rewrite in a professional, formal tone
  - **Concise** — Tighten and shorten while keeping the meaning
  - **Explain** — Show corrections with a breakdown of what changed
- **Visual Diff** — Green highlights show added words, strikethrough shows removed words
- **Replace in Place** — Directly replace selected text in editable fields (inputs, textareas, rich editors)
- **Copy to Clipboard** — One-click copy of corrected text
- **Correction History** — Full searchable history of all corrections with timestamps and source domain
- **Stats Dashboard** — Track total corrections, daily usage, characters corrected, mode breakdown, and top domains
- **Smart Model Fallback** — Automatically tries multiple Gemini models if one is rate-limited, with auto-retry logic
- **Works Everywhere** — Any website, any text field, any language content in English

---

## Installation

### Step 1 — Get a Free Gemini API Key

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **Create API key**
4. Copy the key (it starts with `AIza...`)

No credit card needed. No billing setup required.

### Step 2 — Install the Extension

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer Mode** using the toggle in the top-right corner
4. Click **Load unpacked**
5. Select the `grammar-extension-gemini` folder

### Step 3 — Add Your API Key

1. Click the PenCraft icon in your Chrome toolbar
2. Click the **settings gear icon** in the top-right of the popup
3. Paste your Gemini API key
4. Click **Save**

You're ready to go.

---

## How to Use

### On Any Webpage
1. Select any text (minimum 3 characters)
2. A small floating button appears near your cursor
3. Click it — a correction panel slides in showing the original and corrected text with a visual diff
4. Click **Replace Text** to swap it in place, or **Copy** to copy to clipboard

### From the Extension Popup
1. Click the PenCraft icon in your toolbar
2. Paste or type text into the input box
3. Choose a correction mode
4. Click **Correct Text**

### Via Right-Click
1. Select any text
2. Right-click → **Fix with PenCraft**

---

## Free Tier Limits

PenCraft uses the Google Gemini API free tier. Limits as of 2026:

| Model | Requests per Minute |
|---|---|
| gemini-2.5-flash-lite | Higher limit (tried first) |
| gemini-2.5-flash | Standard limit (fallback) |

PenCraft automatically cycles through available models when one is rate-limited, so in practice you rarely hit the limit for normal use.

---

## Project Structure

```
grammar-extension-gemini/
├── manifest.json       # Extension config, permissions, host rules
├── background.js       # Service worker — Gemini API calls, history storage, model fallback logic
├── content.js          # Injected into every page — floating button, correction panel, diff rendering
├── content.css         # Styles for the floating button and inline correction panel
├── popup.html          # Extension popup UI
├── popup.css           # Popup styles
├── popup.js            # Popup logic — manual correction, history, stats, settings
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Tech Stack

- **Manifest V3** Chrome Extension
- **Google Gemini API** (free tier via Google AI Studio)
- **Vanilla JS** — no frameworks, no build step required
- **Chrome Storage API** for persisting history and API key locally
- **CSS animations** for the floating panel and diff highlights

---

## Privacy

- Your API key is stored only in Chrome's local extension storage on your device
- No data is sent to any server other than the Google Gemini API to process your text
- No analytics, no tracking, no external services
- Correction history is stored locally on your device only and can be cleared at any time from the History tab

---

## Updating the Extension

After downloading a new version:

1. Go to `chrome://extensions`
2. Find PenCraft and click the **refresh / reload icon**
3. No need to re-enter your API key — it is preserved in local storage

---

## Troubleshooting

**"API key not set"** — Open the popup, click the settings gear, and paste your key from [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

**"Invalid API key"** — Make sure you copied the full key including the `AIza` prefix with no extra spaces

**"Rate limit reached"** — PenCraft auto-retries on a different model. If it persists, wait 15–20 seconds and try again

**"Model not found"** — PenCraft automatically skips deprecated models and tries the next available one. If all fail, download the latest release

**Replace Text not working** — Some websites use custom rich text editors that block direct DOM manipulation. Use the Copy button instead and paste manually

---

## Contributing

Pull requests are welcome. If a Gemini model gets deprecated and starts returning errors, the fix is simple — update the `MODEL_FALLBACKS` array at the top of `background.js` with the current model names from [ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models).

---

## License

MIT License — free to use, modify, and distribute.
