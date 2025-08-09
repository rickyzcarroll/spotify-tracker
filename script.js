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
  if (!el || !
