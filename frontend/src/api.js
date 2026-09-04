const BASE = '/api';

// Local model calls can occasionally stall. These timeouts make sure the UI
// always resolves to a clear error instead of spinning indefinitely on
// stage - analysis runs several sequential model calls so it gets a
// generous ceiling; chat is a single call so it can fail fast.
const ANALYSIS_TIMEOUT_MS = 120_000;
const CHAT_TIMEOUT_MS = 45_000;

async function fetchWithTimeout(url, options = {}, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) {
      let detail = `${res.status}`;
      try {
        const body = await res.json();
        if (body?.detail) detail = body.detail;
      } catch {
        // response wasn't JSON, keep the status code as the message
      }
      throw new Error(detail);
    }
    return res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out - check that the configured model provider is available.');
    }
    if (err instanceof TypeError) {
      throw new Error('Could not reach the backend - is it running on port 8000?');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchHealth() {
  return fetchWithTimeout(`${BASE}/health`, {}, 5_000);
}

export async function fetchAnalysis(refresh = false) {
  return fetchWithTimeout(
    `${BASE}/analysis${refresh ? '?refresh=true' : ''}`,
    {},
    ANALYSIS_TIMEOUT_MS
  );
}

export async function sendChatMessage(history, message) {
  return fetchWithTimeout(
    `${BASE}/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history, message }),
    },
    CHAT_TIMEOUT_MS
  );
}
