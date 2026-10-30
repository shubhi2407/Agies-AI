(() => {
  'use strict';

  const STATE = {
    busy: false,
    allowNextSubmit: false,
    allowTimer: null,
  };

  const API_MESSAGE = 'AGIES_ANALYZE';

  const LOCAL_RULES = [
    {
      type: 'API_KEY',
      regex: /\b(?:sk-(?:live|prod|test)-[A-Za-z0-9_-]{12,}|AKIA[0-9A-Z]{16})\b/i
    },
    {
      type: 'EMAIL',
      regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
    },
    {
      type: 'CREDIT_CARD',
      regex: /\b(?:\d[ -]*?){13,19}\b/
    },
    {
      type: 'JWT',
      regex: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/
    },
    {
      type: 'PRIVATE_KEY',
      regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i
    },
    {
      type: 'PASSWORD',
      regex: /\b(?:password|passwd|pwd)\s*[:=]\s*[^\s]{6,}/i
    },
    {
      type: 'DATABASE_URL',
      regex: /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql):\/\/[^\s]+/i
    },
  ];

  function visible(el) {
    if (!el) return false;

    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function findEditor() {
    const candidates = [
      ...document.querySelectorAll('[data-testid="text-input"]'),
      ...document.querySelectorAll('#prompt-textarea'),
      ...document.querySelectorAll('textarea'),
      ...document.querySelectorAll('[contenteditable="true"]'),
      ...document.querySelectorAll('.ProseMirror'),
    ];

    return candidates
      .filter(visible)
      .sort((a, b) => {
        const score = (el) => {
          if (el.matches('[data-testid="text-input"]')) return 5;
          if (el.id === 'prompt-textarea') return 4;
          if (el.matches('[contenteditable="true"]')) return 3;
          if (el.matches('textarea')) return 2;
          return 1;
        };

        return score(b) - score(a);
      })[0] || null;
  }

  function readText(editor) {
    if (!editor) return '';

    if (
      editor instanceof HTMLTextAreaElement ||
      editor instanceof HTMLInputElement
    ) {
      return editor.value || '';
    }

    return (editor.innerText || editor.textContent || '').trim();
  }

  function elementFromEvent(event) {
    if (!event) return null;

    const path =
      typeof event.composedPath === 'function'
        ? event.composedPath()
        : [];

    return (
      path.find((item) => item instanceof Element) ||
      (event.target instanceof Element ? event.target : null)
    );
  }

  function buttonLabel(button) {
    return [
      button?.getAttribute('aria-label'),
      button?.getAttribute('data-testid'),
      button?.getAttribute('data-state'),
      button?.textContent,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  function isSendButton(button) {
    if (!(button instanceof Element)) return false;
    if (button.tagName !== 'BUTTON') return false;

    if (
      button.disabled ||
      button.getAttribute('aria-disabled') === 'true'
    ) {
      return false;
    }

    const label = buttonLabel(button);

    return /send|submit|prompt|message-submit/.test(label);
  }

  function findSubmitButton(editor) {
    const form = editor?.closest('form');

    if (form) {
      const buttons = [...form.querySelectorAll('button')];

      const submit = buttons.find((button) =>
        !button.disabled &&
        (button.type === 'submit' || isSendButton(button))
      );

      if (submit) return submit;
    }

    return [...document.querySelectorAll('button')]
      .find(isSendButton) || null;
  }

  function localScan(text) {
    return LOCAL_RULES
      .filter((rule) => rule.regex.test(text))
      .map((rule) => rule.type);
  }

  function showNotice(kind, title, message, actions = []) {
    document
      .getElementById('agies-sentinel-notice')
      ?.remove();

    const border =
      kind === 'BLOCK'
        ? '#ef4444'
        : kind === 'WARN'
          ? '#f59e0b'
          : '#22c55e';

    const box = document.createElement('div');

    box.id = 'agies-sentinel-notice';

    box.style.cssText = [
      'position:fixed',
      'right:24px',
      'bottom:24px',
      'z-index:2147483647',
      'width:390px',
      'padding:16px',
      'border-radius:14px',
      'background:#0b1220',
      'color:#e5edf7',
      'font-family:Inter,Arial,sans-serif',
      'box-shadow:0 14px 45px rgba(0,0,0,.45)',
      `border:1px solid ${border}`
    ].join(';');

    const heading = document.createElement('div');

    heading.style.cssText =
      'font-size:14px;font-weight:700;margin-bottom:6px';

    heading.textContent =
      `AgiesAI Sentinel — ${title}`;

    const body = document.createElement('div');

    body.style.cssText =
      'font-size:12px;line-height:1.5;color:#a9b6c8';

    body.textContent = message;

    const footer = document.createElement('div');

    footer.style.cssText =
      'display:flex;gap:8px;margin-top:12px';

    for (const action of actions) {
      const button = document.createElement('button');

      button.type = 'button';
      button.textContent = action.label;

      button.style.cssText = [
        'border:0',
        'border-radius:8px',
        'padding:8px 12px',
        'cursor:pointer',
        'background:#162235',
        'color:#e5edf7',
        'font-weight:600',
        'font-size:12px'
      ].join(';');

      button.addEventListener('click', async () => {
        box.remove();

        try {
          await action.onClick();
        } catch (error) {
          console.error(
            '[AgiesAI Sentinel] Action error:',
            error
          );
        }
      });

      footer.appendChild(button);
    }

    box.append(heading, body, footer);

    document.documentElement.appendChild(box);

    if (!actions.length) {
      setTimeout(() => box.remove(), 5500);
    }
  }

  function clearApproval() {
    STATE.allowNextSubmit = false;

    if (STATE.allowTimer) {
      clearTimeout(STATE.allowTimer);
    }

    STATE.allowTimer = null;
  }

  function armApprovedSubmit() {
    STATE.allowNextSubmit = true;

    if (STATE.allowTimer) {
      clearTimeout(STATE.allowTimer);
    }

    STATE.allowTimer = setTimeout(() => {
      clearApproval();
    }, 3000);
  }

  function consumeAllowedSubmit() {
    if (!STATE.allowNextSubmit) {
      return false;
    }

    clearApproval();

    return true;
  }

  async function recordIncidentAction(
    incidentId,
    action
  ) {
    if (!incidentId) return;

    try {
      const response =
        await chrome.runtime.sendMessage({
          type: 'AGIES_RECORD_ACTION',
          incidentId,
          action,
        });

      if (!response?.ok) {
        console.warn(
          '[AgiesAI Sentinel] Could not record incident action:',
          response?.error
        );
      }
    } catch (error) {
      console.warn(
        '[AgiesAI Sentinel] Could not record incident action:',
        error
      );
    }
  }

  function submitAfterDecision(editor) {
    armApprovedSubmit();

    const button = findSubmitButton(editor);

    if (button) {
      button.click();
      return;
    }

    const form = editor?.closest('form');

    if (form?.requestSubmit) {
      form.requestSubmit();
    }
  }

  async function inspectAndDecide(event, editor) {
    if (STATE.busy || STATE.allowNextSubmit) {
      return;
    }

    const text = readText(editor);

    if (!text) {
      return;
    }

    /*
     * CRITICAL:
     * Stop the original ChatGPT submission BEFORE
     * contacting the backend.
     */
    event.preventDefault();
    event.stopPropagation();

    if (
      typeof event.stopImmediatePropagation === 'function'
    ) {
      event.stopImmediatePropagation();
    }

    STATE.busy = true;

    const localFindings = localScan(text);

    showNotice(
      'WARN',
      'Scanning',
      localFindings.length
        ? `Local pre-check matched: ${localFindings.join(', ')}. Checking Sentinel policy before submission.`
        : 'Checking Sentinel policy before submission.'
    );

    try {
      const response =
        await chrome.runtime.sendMessage({
          type: API_MESSAGE,
          text,
        });

      if (!response?.ok) {
        throw new Error(
          response?.error ||
          'Security engine unavailable'
        );
      }

      const result = response.result;

      const decision =
        result?.policy?.decision;

      const score =
        result?.risk?.score ?? '—';

      const incidentId =
        result?.incident_id;

      console.log(
        '[AgiesAI Sentinel] Decision:',
        decision
      );

      console.log(
        '[AgiesAI Sentinel] Risk:',
        result?.risk
      );

      console.log(
        '[AgiesAI Sentinel] Policy:',
        result?.policy
      );

      /*
       * =========================
       * BLOCK
       * =========================
       */

      if (decision === 'BLOCK') {
        showNotice(
          'BLOCK',
          'Submission Blocked',
          `Risk ${score}/100. ${result.policy.message}${
            incidentId
              ? ` Incident: ${incidentId}`
              : ''
          }`
        );

        return;
      }

      /*
       * =========================
       * WARN
       * =========================
       */

      if (decision === 'WARN') {
        showNotice(
          'WARN',
          'Review Required',
          `Risk ${score}/100. ${result.policy.message}`,
          [
            {
              label: 'Cancel',

              onClick: async () => {
                clearApproval();

                await recordIncidentAction(
                  incidentId,
                  'WARNING_CANCELLED'
                );
              },
            },

            {
              label: 'Continue Anyway',

              onClick: async () => {
                await recordIncidentAction(
                  incidentId,
                  'CONTINUE_ANYWAY'
                );

                submitAfterDecision(editor);
              },
            },
          ]
        );

        return;
      }

      /*
       * =========================
       * ALLOW
       * =========================
       */

      if (decision === 'ALLOW') {
        showNotice(
          'ALLOW',
          'Submission Allowed',
          `Risk ${score}/100. Content passed Sentinel policy.`
        );

        submitAfterDecision(editor);

        return;
      }

      throw new Error(
        `Invalid policy decision: ${decision}`
      );

    } catch (error) {
      console.error(
        '[AgiesAI Sentinel] Security engine error:',
        error
      );

      showNotice(
        'BLOCK',
        'Security Engine Unavailable',
        'Sentinel could not verify this submission. The message was NOT sent.'
      );

    } finally {
      STATE.busy = false;
    }
  }

  function handleSubmitEvent(event) {
    /*
     * This is the submit generated after
     * Continue Anyway / Allow.
     */
    if (consumeAllowedSubmit()) {
      return;
    }

    const editor = findEditor();

    if (editor) {
      inspectAndDecide(event, editor);
    }
  }

  function handleClick(event) {
    if (STATE.busy || STATE.allowNextSubmit) {
      return;
    }

    const target = elementFromEvent(event);

    const button =
      target?.closest?.('button');

    if (!isSendButton(button)) {
      return;
    }

    const editor = findEditor();

    if (editor) {
      inspectAndDecide(event, editor);
    }
  }

  function handlePointerDown(event) {
    if (STATE.busy || STATE.allowNextSubmit) {
      return;
    }

    const target = elementFromEvent(event);

    const button =
      target?.closest?.('button');

    if (!isSendButton(button)) {
      return;
    }

    const editor = findEditor();

    if (editor) {
      inspectAndDecide(event, editor);
    }
  }

  function handleKeydown(event) {
    if (STATE.busy || STATE.allowNextSubmit) {
      return;
    }

    if (
      event.key !== 'Enter' ||
      event.shiftKey ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }

    const editor = findEditor();

    const target =
      elementFromEvent(event);

    if (
      !editor ||
      !(target === editor || editor.contains(target))
    ) {
      return;
    }

    inspectAndDecide(event, editor);
  }

  /*
   * Capture phase:
   * Sentinel gets the event before ChatGPT's
   * React event handlers.
   */
  document.addEventListener(
    'submit',
    handleSubmitEvent,
    true
  );

  document.addEventListener(
    'pointerdown',
    handlePointerDown,
    true
  );

  document.addEventListener(
    'mousedown',
    handlePointerDown,
    true
  );

  document.addEventListener(
    'click',
    handleClick,
    true
  );

  document.addEventListener(
    'keydown',
    handleKeydown,
    true
  );

  /*
   * ChatGPT is a SPA.
   */
  const observer =
    new MutationObserver(() => {

      if (
        !document.getElementById(
          'agies-sentinel-status'
        )
      ) {

        const status =
          document.createElement('div');

        status.id =
          'agies-sentinel-status';

        status.textContent =
          'Sentinel active';

        status.style.cssText = [
          'position:fixed',
          'left:12px',
          'bottom:12px',
          'z-index:2147483646',
          'padding:4px 8px',
          'border-radius:6px',
          'background:#0b1220',
          'color:#86efac',
          'font:10px Inter,Arial,sans-serif',
          'opacity:.65',
          'pointer-events:none'
        ].join(';');

        document.documentElement
          .appendChild(status);
      }
    });

  observer.observe(
    document.documentElement,
    {
      childList: true,
      subtree: true
    }
  );

  console.log(
    '[AgiesAI Sentinel] ChatGPT protection active — pre-submit interception enabled.'
  );
})();