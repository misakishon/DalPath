export function buildClientSdkScript(defaultEndpointOrigin: string): string {
  return `/*!
 * User Flow Analytics SDK v1.0.0
 * Privacy-first page-view & SPA route collector.
 * Strictly collects normalized paths and anonymous first-party session IDs.
 * NEVER reads passwords, form inputs, payment fields, message bodies, or keystrokes.
 */
(function (window, document) {
  if (window.__UFA_LOADED__) return;
  window.__UFA_LOADED__ = true;

  var scriptEl = document.currentScript || document.querySelector('script[data-site-id]');
  if (!scriptEl) return;

  var siteId = scriptEl.getAttribute('data-site-id');
  var integrationKey = scriptEl.getAttribute('data-key');
  var endpoint = scriptEl.getAttribute('data-endpoint') || '${defaultEndpointOrigin}/api/v1/collect';

  if (!siteId || !integrationKey) {
    console.warn('[UserFlowAnalytics] Missing data-site-id or data-key attributes.');
    return;
  }

  function randomHex(len) {
    var chars = '0123456789abcdef';
    var out = '';
    for (var i = 0; i < len; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  }

  function getSessionId() {
    var storageKey = 'ufa_anon_sid_' + siteId;
    try {
      var existing = window.sessionStorage.getItem(storageKey);
      if (existing && /^v_[a-zA-Z0-9_-]{4,24}$/.test(existing)) return existing;
      var created = 'v_' + randomHex(8);
      window.sessionStorage.setItem(storageKey, created);
      return created;
    } catch (e) {
      return 'v_' + randomHex(8);
    }
  }

  function normalizePath(raw) {
    try {
      var u = new URL(raw || window.location.href, window.location.origin);
      var p = (u.pathname || '/').replace(/\\/+$/g, '') || '/';
      return p.toLowerCase();
    } catch (e) {
      var clean = String(raw || '/').split('#')[0].split('?')[0].replace(/\\/+$/g, '') || '/';
      return clean.toLowerCase();
    }
  }

  function detectDevice() {
    var w = window.innerWidth || 1280;
    if (w < 640) return 'mobile';
    if (w < 1024) return 'tablet';
    return 'desktop';
  }

  var sessionId = getSessionId();
  var startedAt = Date.now();
  var lastPath = null;

  function send(eventType, pathOverride, extra) {
    var currentPath = normalizePath(pathOverride || window.location.pathname);
    var payload = {
      siteId: siteId,
      integrationKey: integrationKey,
      sessionId: sessionId,
      eventType: eventType,
      path: currentPath,
      previousPath: lastPath,
      title: document.title ? document.title.slice(0, 64) : null,
      deviceType: detectDevice(),
      durationSec: Math.round((Date.now() - startedAt) / 1000)
    };
    if (extra && extra.authOutcome) {
      payload.authOutcome = extra.authOutcome;
    }

    lastPath = currentPath;
    var body = JSON.stringify(payload);

    try {
      if (navigator.sendBeacon && eventType === 'Session End') {
        var blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(endpoint, blob);
        return;
      }
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
        mode: 'cors'
      }).catch(function () {});
    } catch (e) {}
  }

  // Initial page load
  send('Session Start');

  // Detect SPA route changes via History API
  var origPush = history.pushState;
  var origReplace = history.replaceState;
  history.pushState = function () {
    var ret = origPush.apply(this, arguments);
    var nextPath = normalizePath(window.location.pathname);
    if (nextPath !== lastPath) send('SPA Navigation', nextPath);
    return ret;
  };
  history.replaceState = function () {
    var ret = origReplace.apply(this, arguments);
    var nextPath = normalizePath(window.location.pathname);
    if (nextPath !== lastPath) send('SPA Navigation', nextPath);
    return ret;
  };
  window.addEventListener('popstate', function () {
    var nextPath = normalizePath(window.location.pathname);
    if (nextPath !== lastPath) send('SPA Navigation', nextPath);
  });
  window.addEventListener('pagehide', function () {
    send('Session End');
  });

  // Safe metadata-only API (never accepts passwords or form field values)
  window.UserFlowAnalytics = {
    getSessionId: function () { return sessionId; },
    trackPageView: function (path) { send('Page View', path); },
    trackAuthMetadata: function (outcome) {
      send('Auth Metadata', window.location.pathname, {
        authOutcome: outcome === 'failed' ? 'failed' : 'success'
      });
    }
  };
})(window, document);
`;
}

export function buildDemoClientHtml(params: {
  siteId: string;
  integrationKey: string;
  domain: string;
  origin: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Connected Site Sandbox — ${params.domain}</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; margin: 0; background: #F5F9FF; color: #0F294D; }
    header { background: #FFFFFF; border-bottom: 1px solid #CBD9EC; padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; }
    .brand { font-weight: 700; font-size: 16px; display: flex; align-items: center; gap: 10px; }
    .badge { background: #D1FAE5; color: #047857; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px; }
    main { max-width: 820px; margin: 28px auto; padding: 0 20px; }
    .card { background: #FFFFFF; border: 1px solid #CBD9EC; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
    .nav-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
    button { cursor: pointer; border: 1px solid #BFD3EC; background: #EFF6FF; color: #0F294D; font-weight: 600; padding: 9px 14px; border-radius: 8px; font-size: 13px; }
    button:hover { background: #DBEAFE; border-color: #2563EB; }
    button.primary { background: #1D4ED8; color: #FFFFFF; border-color: #1D4ED8; }
    button.danger { background: #FEF2F2; color: #B91C1C; border-color: #FECACA; }
    input { padding: 8px 12px; border: 1px solid #CBD9EC; border-radius: 8px; font-size: 13px; color: #0F294D; }
    .log { font-family: ui-monospace, monospace; font-size: 12px; background: #F8FAFC; border: 1px solid #DCE6F4; border-radius: 8px; padding: 12px; max-height: 180px; overflow: auto; }
  </style>
  <script src="${params.origin}/sdk/ufa.js" data-site-id="${params.siteId}" data-key="${params.integrationKey}" data-endpoint="${params.origin}/api/v1/collect"></script>
</head>
<body>
  <header>
    <div class="brand">Live Connected Site Sandbox (${params.domain}) <span class="badge">Live SDK Active</span></div>
    <div id="sid" style="font-family: monospace; font-size: 13px; color: #3A547A;"></div>
  </header>
  <main>
    <div class="card">
      <h2 style="margin: 0 0 6px;">Test Real-Time SPA Navigation & Dynamic Page Discovery</h2>
      <p style="margin: 0; font-size: 14px; color: #3A547A;">
        Clicking these routes updates the browser URL via <code>history.pushState</code> (with query strings and hashes stripped automatically by the SDK) and streams real <strong>Live</strong> events to User Flow Analytics.
      </p>
      <div class="nav-grid">
        <button onclick="go('/?utm_source=demo#hero', 'Home')">Home (/?utm_source=demo#hero)</button>
        <button onclick="go('/about?ref=nav', 'About')">About</button>
        <button onclick="go('/login?next=/dashboard', 'Login')">Login</button>
        <button onclick="go('/dashboard#overview', 'Dashboard')">Dashboard</button>
        <button onclick="go('/products?category=pro', 'Products')">Products</button>
        <button onclick="go('/support', 'Support')">Support</button>
        <button onclick="go('/pricing?plan=enterprise', 'Pricing')">Discover New Route: /pricing</button>
      </div>
    </div>

    <div class="card">
      <h3 style="margin: 0 0 8px;">Privacy-Safe Login Event Verification</h3>
      <p style="margin: 0 0 12px; font-size: 13px; color: #3A547A;">
        Typing in this form is NEVER captured. Clicking Submit emits only redacted auth metadata.
      </p>
      <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center;">
        <input type="text" placeholder="Username (never sent)" value="alex@example.com" />
        <input type="password" placeholder="Password (never sent)" value="SuperSecret123!" />
        <button class="primary" onclick="sendAuth('success')">Simulate Login Success (Redacted)</button>
        <button class="danger" onclick="sendAuth('failed')">Simulate Failed Login (Security Alert)</button>
      </div>
    </div>

    <div class="card">
      <h3 style="margin: 0 0 8px;">Client SDK Event Log</h3>
      <div id="log" class="log">SDK initialized. Waiting for route changes...</div>
    </div>
  </main>
  <script>
    function addLog(msg) {
      var el = document.getElementById('log');
      el.innerHTML = '<div>[' + new Date().toLocaleTimeString() + '] ' + msg + '</div>' + el.innerHTML;
    }
    window.addEventListener('load', function () {
      if (window.UserFlowAnalytics) {
        document.getElementById('sid').textContent = 'Anonymous Session: ' + window.UserFlowAnalytics.getSessionId();
        addLog('Session started: ' + window.UserFlowAnalytics.getSessionId());
      }
    });
    function go(url, title) {
      document.title = title;
      history.pushState({}, title, url);
      addLog('SPA Navigation pushed: ' + url + ' (query/hash normalized)');
    }
    function sendAuth(outcome) {
      if (window.UserFlowAnalytics) {
        window.UserFlowAnalytics.trackAuthMetadata(outcome);
        addLog('Auth metadata sent (' + outcome + ') — credentials redacted');
      }
    }
  </script>
</body>
</html>`;
}
