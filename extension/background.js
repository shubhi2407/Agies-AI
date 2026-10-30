const API_BASE = 'http://127.0.0.1:8000';

async function getEmployeeIdentity() {
  const data = await chrome.storage.local.get({ employeeId: 'EMP-DEMO-001' });
  return data.employeeId || 'EMP-DEMO-001';
}

async function analyze(text) {
  const response = await fetch(`${API_BASE}/api/detect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, employee_id: await getEmployeeIdentity(), platform: 'ChatGPT' })
  });

  if (!response.ok) {
    throw new Error(`Backend returned HTTP ${response.status}`);
  }

  return response.json();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'AGIES_RECORD_ACTION') {
    recordIncidentAction(message.incidentId, message.action)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type !== 'AGIES_ANALYZE') return;

  analyze(message.text)
    .then(async (result) => {
      await chrome.storage.local.set({
        lastResult: {
          ...result,
          platform: 'ChatGPT',
          checkedAt: new Date().toISOString()
        }
      });
      sendResponse({ ok: true, result });
    })
    .catch((error) => {
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});


async function recordIncidentAction(incidentId, action) {
  if (!incidentId) throw new Error('Missing incident ID');

  const response = await fetch(`${API_BASE}/api/incidents/${encodeURIComponent(incidentId)}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  });

  if (!response.ok) {
    throw new Error(`Backend returned HTTP ${response.status}`);
  }

  return response.json();
}
