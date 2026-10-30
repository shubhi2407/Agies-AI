# AgiesAI Sentinel Chrome Extension — v1.2

This Manifest V3 extension protects ChatGPT submissions using the existing AgiesAI Sentinel `/api/detect` endpoint.

## Flow
1. Capture the ChatGPT input before submission.
2. Run a lightweight client-side pre-check for obvious secrets/PII.
3. Send the text to the local Sentinel backend through the extension service worker.
4. Apply the backend risk/policy decision.
5. ALLOW → submit; WARN → ask the user; BLOCK → prevent submission.
6. Backend keeps incident metadata and does not store the raw submission.

## Load in Chrome
1. Start the backend:
   `uvicorn app.main:app --reload --port 8000`
2. Open `chrome://extensions`
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this `extension` folder.
6. Open `https://chatgpt.com/` and test with safe and API-key text.

## Security behavior
- **BLOCK:** the message is stopped before ChatGPT receives it.
- **WARN:** the message stays blocked until the user explicitly chooses Continue Anyway.
- **ALLOW:** the message is submitted only after Sentinel approves it.
- **Backend unavailable:** the extension fails closed and does **not** send the message.
- The extension does not persist the raw submission in `chrome.storage`; it stores only the backend result/metadata.

## Important
The extension is intentionally scoped to ChatGPT for the MVP. Platform adapters for Gemini/Claude/Copilot can be added later.


### WARN action auditing
When Sentinel returns WARN, the extension creates the incident through the backend detection call and records the employee's final choice:
- `WARNING_CANCELLED` when Cancel is selected.
- `CONTINUE_ANYWAY` when Continue Anyway is selected.

Only incident metadata is sent for these action events; the prompt text is not sent again.


## v1.6 identity binding
The popup lets the demo user select an active employee identity. Each detection sends only the selected employee_id and platform to the backend; incidents store employee metadata, never raw prompt content.
