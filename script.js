// ===== Storage: keep client ID out of code =====
const STORAGE_KEYS = {
  CLIENT_ID: 'spotify_client_id',
  CODE_VERIFIER: 'spotify_code_verifier',
  TOKENS: 'spotify_tokens'
};

function getClientId() {
  return localStorage.getItem(STORAGE_KEYS.CLIENT_ID) || sessionStorage.getItem(STORAGE_KEYS.CLIENT_ID) || null;
}

function setClientId(id, persist = true) {
  if (!id || !id.trim()) return;
  // Persist locally or for session only
  if (persist) {
    localStorage.setItem(STORAGE_KEYS.CLIENT_ID, id.trim());
    sessionStorage.removeItem(STORAGE_KEYS.CLIENT_ID);
  } else {
    sessionStorage.setItem(STORAGE_KEYS.CLIENT_ID, id.trim());
    localStorage.removeItem(STORAGE_KEYS.CLIENT_ID);
  }
}

function clearClientId() {
  localStorage.removeItem(STORAGE_KEYS.CLIENT_ID);
  sessionStorage.removeItem(STORAGE_KEYS.CLIENT_ID);
}

// ===== Redirect URI is computed so forks/Pages work automatically =====
function getRedirectUri() {
  // Handles GitHub Pages project sites and custom domains:
  // e.g. https://username.github.io/repo/ -> exact path matters
  return `${window.location.origin}${window.location.pathname.replace(/index\.html?$/, '')}`;
}

// ===== PKCE utilities =====
async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return await crypto.subtle.digest('SHA-256', data);
}
function base64UrlEncode(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function randomString(n = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let s = '';
  for (let i = 0; i < n; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

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
    code_challenge: challenge
  });
  window.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

async function exchangeCodeForToken(code) {
  const clientId = getClientId();
  const verifier = localStorage.getItem(STORAGE_KEYS.CODE_VERIFIER);
  if (!clientId || !verifier) throw new Error('Missing clientId or verifier');

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: verifier
  });

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  const tokens = await res.json();
  localStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(tokens));
  return tokens;
}

async function refreshTokenIfNeeded() {
  const raw = localStorage.getItem(STORAGE_KEYS.TOKENS);
  if (!raw) return null;
  const tokens = JSON.parse(raw);
  if (!tokens.refresh_token) return tokens;

  // Attempt refresh if access token is older than ~45 min
  // (You could track expires_at; this keeps it simple.)
  const body = new URLSearchParams({
    client_id: getClientId(),
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token
  });
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body
  });
  if (!res.ok) return tokens; // fall back
  const newTokens = await res.json();
  const merged = {
    ...tokens,
    ...newTokens,
    refresh_token: newTokens.refresh_token || tokens.refresh_token
  };
  localStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(merged));
  return merged;
}

function signOut() {
  localStorage.removeItem(STORAGE_KEYS.TOKENS);
  // keep clientId so user doesn't need to re-enter
}

// ===== App bootstrap =====
function showSetupModal() {
  const modal = document.getElementById('setupModal');
  const redirectCode = document.getElementById('redirectUriCode');
  const copyBtn = document.getElementById('copyRedirectBtn');
  const saveBtn = document.getElementById('saveClientIdBtn');
  const cancelBtn = document.getElementById('cancelSetupBtn');
  const remember = document.getElementById('rememberClientId');
  const input = document.getElementById('clientIdInput');

  redirectCode.textContent = getRedirectUri();

  copyBtn.onclick = () => {
    navigator.clipboard.writeText(getRedirectUri());
    copyBtn.textContent = 'Copied';
    setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
  };
  saveBtn.onclick = () => {
    setClientId(input.value, remember.checked);
    if (getClientId()) {
      modal.style.display = 'none';
      document.getElementById('accountControls').style.display = 'block';
    }
  };
  cancelBtn.onclick = () => (modal.style.display = 'none');

  modal.style.display = 'block';
}

function showAccountControlsIfReady() {
  if (getClientId()) {
    document.getElementById('accountControls').style.display = 'block';
  }
}

async function handleAuthCallback() {
  const url = new URL(window.lo
