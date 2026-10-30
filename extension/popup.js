const API_BASE = 'http://127.0.0.1:8000';

async function loadEmployees() {
  const select = document.getElementById('employeeSelect');
  const status = document.getElementById('identityStatus');
  try {
    const response = await fetch(`${API_BASE}/api/employees`);
    if (!response.ok) throw new Error(`Backend returned HTTP ${response.status}`);
    const data = await response.json();
    const stored = await chrome.storage.local.get({ employeeId: 'EMP-DEMO-001' });
    select.innerHTML = '';

    for (const employee of data.employees || []) {
      const option = document.createElement('option');
      option.value = employee.employee_id;
      option.textContent = `${employee.name} · ${employee.employee_id}`;
      option.disabled = employee.status !== 'Active';
      select.appendChild(option);
    }

    const valid = [...select.options].find((o) => o.value === stored.employeeId && !o.disabled);
    select.value = valid ? stored.employeeId : (select.options[0]?.value || '');
    if (select.value) {
      await chrome.storage.local.set({ employeeId: select.value });
      const employee = (data.employees || []).find((e) => e.employee_id === select.value);
      status.textContent = employee ? `${employee.department} · ${employee.role}` : 'Identity selected';
    }
  } catch (error) {
    select.innerHTML = '<option value="EMP-DEMO-001">EMP-DEMO-001</option>';
    select.value = 'EMP-DEMO-001';
    status.textContent = 'Backend unavailable — using demo identity';
  }

  select.addEventListener('change', async () => {
    await chrome.storage.local.set({ employeeId: select.value });
    status.textContent = 'Identity saved for future checks.';
  });
}

async function loadLastResult() {
  const data = await chrome.storage.local.get('lastResult');
  const last = data.lastResult;
  if (!last) return;

  const decision = last.policy?.decision || 'UNKNOWN';
  const score = last.risk?.score;
  const time = last.checkedAt ? new Date(last.checkedAt).toLocaleTimeString() : '';
  const employee = last.employee_name ? ` · ${last.employee_name}` : '';

  document.getElementById('decision').textContent = `${decision}${score != null ? ` · Risk ${score}/100` : ''}`;
  document.getElementById('details').textContent = `${last.policy?.message || 'Security decision received.'}${employee}${time ? ` Checked ${time}.` : ''}`;
}

async function load() {
  await loadEmployees();
  await loadLastResult();
}
load();
