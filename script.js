// ===========================
// Config & storage utilities
// ===========================
const STORAGE_KEYS = {
  CLIENT_ID: 'spotify_client_id',
  CODE_VERIFIER: 'spotify_code_verifier',
  TOKENS: 'spotify_tokens', // { access_token, refresh_token, expires_in, token_type, scope, expires_at }
};

function getClientId() {
  return localStorage.getItem(STORAGE_KEYS.CLIENT_ID) || sessionStorage.getItem(STORAGE_KEYS.CLIENT_ID) || null;
}

function setClientId(id, persist = true) {
  if (!id || !id.trim()) return;
  const clean = id.trim();
  if (persist) {
    localStorage.setItem(STORAGE_KEYS.CLIENT_ID, clean);
    sessionStorage.removeItem(STORAGE_KEYS.CLIENT_ID);
  } else {
    sessionStorage.setItem(STORAGE_KEYS.CLIENT_ID, clean);
    localStorage.removeItem(STORAGE_KEYS.CLIENT_ID);
  }
}

function clearClientId() {
  localStorage.removeItem(STORAGE_KEYS.CLIENT_ID);
  sessionStorage.removeItem(STORAGE_KEYS.CLIENT_ID);
}

function setStatus(msg) {
  const el = document.getElementById('statusText');
  const card = document.getElementById('statusCard');
  if (el && card) {
    el.textContent = String(msg);
    card.style.display = 'block';
  }
}

// Always return the site root with trailing slash (works for GH Pages project sites, forks, custom domains)
function getRedirectUri() {
  return new URL('./', window.location.href).href; // e.g., https://username.github.io/spotify-tracker/
}

function fillRedirectUri() {
  const el = document.getElementById('redirectUriCode');
  if (el) el.textContent = getRedirectUri();
}

// ===========================
// PKCE helpers
// ===========================
function randomString(n = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let s = '';
  for (let i = 0; i < n; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return await crypto.subtle.digest('SHA-256', data);
}

function base64UrlEncode(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ===========================
// Auth flow
// ===========================
async function startLogin(scopes = [
  'user-read-email',
  'user-top-read',
  'user-read-recently-played',
  'playlist-read-private'
]) {
  const clientId = getClientId();
  if (!clientId) {
    showSetupModal();
    return;
  }

  const verifier = randomString(64);
  const challenge = base64UrlEncode(await sha256(verifier));
  localStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, verifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    scope: scopes.join(' '),
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });

  window.location.assign(`https://accounts.spotify.com/authorize?${params.toString()}`);
}

async function exchangeCodeForToken(code) {
  const clientId = getClientId();
  const verifier = localStorage.getItem(STORAGE_KEYS.CODE_VERIFIER);
  if (!clientId || !verifier) throw new Error('Missing clientId or code verifier');

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: verifier,
  });

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }
  const tokens = await res.json();
  tokens.expires_at = Date.now() + (tokens.expires_in * 1000) - 60000; // refresh 60s early
  localStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(tokens));
  return tokens;
}

async function refreshTokenIfNeeded() {
  const raw = localStorage.getItem(STORAGE_KEYS.TOKENS);
  if (!raw) return null;
  const tokens = JSON.parse(raw);

  if (tokens.expires_at && Date.now() < tokens.expires_at) return tokens;
  if (!tokens.refresh_token) return tokens;

  const body = new URLSearchParams({
    client_id: getClientId(),
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
  });

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    setStatus(`Refresh failed: ${res.status}`);
    return tokens; // fall back to existing; user may need to log in again
  }

  const newTokens = await res.json();
  const merged = {
    ...tokens,
    ...newTokens,
    refresh_token: newTokens.refresh_token || tokens.refresh_token,
    expires_at: Date.now() + (newTokens.expires_in * 1000) - 60000,
  };
  localStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(merged));
  return merged;
}

function signOut() {
  localStorage.removeItem(STORAGE_KEYS.TOKENS);
  setStatus('Signed out.');
}

function authHeader() {
  const raw = localStorage.getItem(STORAGE_KEYS.TOKENS);
  if (!raw) throw new Error('Not authenticated');
  const { access_token } = JSON.parse(raw);
  return { Authorization: `Bearer ${access_token}` };
}

// ===========================
// API examples & rendering
// ===========================
async function fetchMe() {
  const res = await fetch('https://api.spotify.com/v1/me', { headers: authHeader() });
  if (!res.ok) throw new Error(`ME ${res.status}`);
  return res.json();
}

async function fetchTop(type = 'artists', time_range = 'short_term', limit = 10) {
  const url = new URL(`https://api.spotify.com/v1/me/top/${type}`);
  url.searchParams.set('time_range', time_range);
  url.searchParams.set('limit', String(limit));
  const res = await fetch(url, { headers: authHeader() });
  if (!res.ok) throw new Error(`TOP ${type} ${res.status}`);
  return res.json();
}

function renderProfile(me) {
  const card = document.getElementById('profileCard');
  const el = document.getElementById('profile');
  if (!card || !el) return;
  const img = (me.images && me.images[0]) ? `<img class="avatar" src="${me.images[0].url}" alt="avatar">` : '';
  el.innerHTML = `
    <div class="profile-row">
      ${img}
      <div>
        <div><strong>${me.display_name || 'Unknown user'}</strong></div>
        <div>${me.email || ''}</div>
        <div>Country: ${me.country || '—'}</div>
      </div>
    </div>
  `;
  card.style.display = 'block';
}

function renderTop(list, containerId, formatter) {
  const el = document.getElementById(containerId);
  const card = document.getElementById('topsCard');
  if (!el || !card) return;
  el.innerHTML = '';
  list.items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = formatter(item);
    el.appendChild(li);
  });
  card.style.display = 'block';
}

// ===========================
// Setup modal
// ===========================
function showSetupModal() {
  const modal = document.getElementById('setupModal');
  const redirectCode = document.getElementById('redirectUriCode');
  const copyBtn = document.getElementById('copyRedirectBtn');
  const saveBtn = document.getElementById('saveClientIdBtn');
  const cancelBtn = document.getElementById('cancelSetupBtn');
  const remember = document.getElementById('rememberClientId');
  const input = document.getElementById('clientIdInput');

  if (redirectCode) redirectCode.textContent = getRedirectUri();

  if (copyBtn) copyBtn.onclick = () => {
    const uri = getRedirectUri();
    navigator.clipboard.writeText(uri).catch(() => {});
    copyBtn.textContent = 'Copied';
    setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
  };

  if (saveBtn) saveBtn.onclick = () => {
    setClientId(input.value, !!(remember && remember.checked));
    if (getClientId()) {
      modal.style.display = 'none';
      document.getElementById('accountControls').style.display = 'block';
      setStatus('Client ID saved. Click “Login with Spotify”.');
    }
  };

  if (cancelBtn) cancelBtn.onclick = () => (modal.style.display = 'none');

  modal.style.display = 'block';
}

function showAccountControlsIfReady() {
  if (getClientId()) {
    const ac = document.getElementById('accountControls');
    if (ac) ac.style.display = 'block';
  }
}

// ===========================
// Bootstrap
// ===========================
async function handleAuthCallback() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  if (error) {
    setStatus(`Auth error: ${error}`);
    return false;
  }
  if (!code) return false;

  try {
    await exchangeCodeForToken(code);
    // Clean the URL
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    history.replaceState({}, document.title, url.toString());
    setStatus('Authenticated. Loading your data…');
    return true;
  } catch (e) {
    setStatus(String(e));
    return false;
  }
}

async function initApp() {
  // Wire buttons
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) loginBtn.onclick = () => startLogin();

  const changeClientBtn = document.getElementById('changeClientIdBtn');
  if (changeClientBtn) changeClientBtn.onclick = () => {
    clearClientId();
    showSetupModal();
  };

  const clearSessionBtn = document.getElementById('clearSessionBtn');
  if (clearSessionBtn) clearSessionBtn.onclick = () => {
    signOut();
    alert('Signed out. Click “Login with Spotify” to sign in again.');
  };

  // Ensure Redirect URI shows even if modal HTML rendered before JS
  fillRedirectUri();

  // First-run: prompt for Client ID before anything else
  if (!getClientId()) {
    showSetupModal();
  }
  showAccountControlsIfReady();

  // Handle OAuth callback if present
  const didHandle = await handleAuthCallback();
  if (!didHandle) {
    // If already have tokens, try refresh
    await refreshTokenIfNeeded();
  }

  // If authenticated, load some data
  const tokensRaw = localStorage.getItem(STORAGE_KEYS.TOKENS);
  if (tokensRaw) {
    try {
      await refreshTokenIfNeeded();
      const me = await fetchMe();
      renderProfile(me);

      const topArtists = await fetchTop('artists', 'short_term', 10);
      renderTop(topArtists, 'topArtists', (a) => `${a.name}`);

      const topTracks = await fetchTop('tracks', 'short_term', 10);
      renderTop(topTracks, 'topTracks', (t) => `${t.name} — ${t.artists.map(a => a.name).join(', ')}`);

      setStatus('Loaded.');
    } catch (e) {
      setStatus(`Ready. (Login to load data) ${e?.message ? ' — ' + e.message : ''}`);
    }
  } else {
    setStatus('Ready. Paste your Client ID and click “Login with Spotify”.');
  }
}

document.addEventListener('DOMContentLoaded', initApp);
