// ===== Storage & status =====
const STORAGE_KEYS = {
  CLIENT_ID: 'spotify_client_id',
  CODE_VERIFIER: 'spotify_code_verifier',
  TOKENS: 'spotify_tokens',
};

const $ = (sel) => document.querySelector(sel);

function setStatus(msg) {
  const card = $('#statusCard');
  const pre = $('#statusText');
  if (pre) pre.textContent = String(msg);
  if (card) card.classList.remove('hidden');
}

function getClientId() {
  return localStorage.getItem(STORAGE_KEYS.CLIENT_ID) || sessionStorage.getItem(STORAGE_KEYS.CLIENT_ID) || null;
}
function setClientId(id, persist = true) {
  if (!id || !id.trim()) return;
  const v = id.trim();
  persist ? (localStorage.setItem(STORAGE_KEYS.CLIENT_ID, v), sessionStorage.removeItem(STORAGE_KEYS.CLIENT_ID))
          : (sessionStorage.setItem(STORAGE_KEYS.CLIENT_ID, v), localStorage.removeItem(STORAGE_KEYS.CLIENT_ID));
}
function clearClientId() { localStorage.removeItem(STORAGE_KEYS.CLIENT_ID); sessionStorage.removeItem(STORAGE_KEYS.CLIENT_ID); }

// Always returns site root with trailing slash (works for GH Pages/forks)
function getRedirectUri() { return new URL('./', window.location.href).href; }
function fillRedirectUri() { const el = $('#redirectUriCode'); if (el) el.textContent = getRedirectUri(); }

// ===== PKCE helpers =====
function randomString(n = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let s=''; for (let i=0;i<n;i++) s += chars.charAt(Math.floor(Math.random()*chars.length)); return s;
}
async function sha256(plain) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain)); }
function b64url(bytes) { return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }

// ===== OAuth flow =====
async function startLogin(scopes = [
  'user-read-email',
  'user-top-read',
  'user-read-recently-played',
  'playlist-read-private'
]) {
  const clientId = getClientId();
  if (!clientId) { showSetupModal(); return; }

  const verifier = randomString(64);
  const challenge = b64url(await sha256(verifier));
  localStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, verifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    scope: scopes.join(' '),
    code_challenge_method: 'S256',
    code_challenge: challenge
  });
  location.assign(`https://accounts.spotify.com/authorize?${params.toString()}`);
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
    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  const tokens = await res.json();
  tokens.expires_at = Date.now() + (tokens.expires_in*1000) - 60000;
  localStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(tokens));
  return tokens;
}

async function refreshTokenIfNeeded() {
  const raw = localStorage.getItem(STORAGE_KEYS.TOKENS);
  if (!raw) return null;
  const t = JSON.parse(raw);
  if (t.expires_at && Date.now() < t.expires_at) return t;
  if (!t.refresh_token) return t;

  const body = new URLSearchParams({
    client_id: getClientId(), grant_type:'refresh_token', refresh_token: t.refresh_token
  });
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body
  });
  if (!res.ok) { setStatus(`Refresh failed: ${res.status}`); return t; }
  const nt = await res.json();
  const merged = {...t, ...nt, refresh_token: nt.refresh_token || t.refresh_token,
                  expires_at: Date.now() + (nt.expires_in*1000) - 60000};
  localStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(merged));
  return merged;
}

function signOut(){ localStorage.removeItem(STORAGE_KEYS.TOKENS); setStatus('Signed out.'); }
function authHeader(){
  const raw = localStorage.getItem(STORAGE_KEYS.TOKENS);
  if (!raw) throw new Error('Not authenticated');
  const { access_token } = JSON.parse(raw);
  return { Authorization: `Bearer ${access_token}` };
}

// ===== API calls =====
async function fetchMe(){
  const r = await fetch('https://api.spotify.com/v1/me',{headers:authHeader()});
  if (!r.ok) throw new Error(`ME ${r.status}`); return r.json();
}
async function fetchTop(type='artists', time_range='short_term', limit=10){
  const u = new URL(`https://api.spotify.com/v1/me/top/${type}`);
  u.searchParams.set('time_range', time_range); u.searchParams.set('limit', String(limit));
  const r = await fetch(u,{headers:authHeader()}); if(!r.ok) throw new Error(`TOP ${type} ${r.status}`); return r.json();
}
async function fetchRecent(limit=50){
  const u = new URL('https://api.spotify.com/v1/me/player/recently-played');
  u.searchParams.set('limit', String(Math.min(50, limit)));
  const r = await fetch(u,{headers:authHeader()}); if(!r.ok) throw new Error(`RECENT ${r.status}`); return r.json();
}

// ===== Render helpers =====
function renderProfile(me){
  const card = $('#profileCard'); const el = $('#profile'); if (!card||!el) return;
  const img = (me.images && me.images[0]) ? `<img class="avatar" src="${me.images[0].url}" alt="avatar">` : '';
  el.innerHTML = `<div class="profile">${img}<div><div><b>${me.display_name||'—'}</b></div><div>${me.email||''}</div><div>Country: ${me.country||'—'}</div></div></div>`;
  card.classList.remove('hidden');
}
function renderList(items, containerId, formatter){
  const el = $('#'+containerId); if(!el) return;
  el.innerHTML=''; items.forEach((x)=>{ const li=document.createElement('li'); li.innerHTML=formatter(x); el.appendChild(li); });
}

function msToH(ms){ return (ms/3600000); }
function hours(ms){ return msToH(ms).toFixed(2)+' h'; }

// ===== Aggregations =====
function aggregateRecent(recentJson){
  // recentJson.items: { track, played_at }, track.duration_ms
  const byTrack = new Map(); const byArtist = new Map();
  for (const it of recentJson.items||[]){
    const t = it.track; if(!t) continue;
    const tid = t.id || t.name; // fallback if id missing
    const dur = t.duration_ms || 0;
    const artists = (t.artists||[]).map(a=>({id:a.id||a.name, name:a.name}));

    // Track
    const tt = byTrack.get(tid) || { id:tid, name:t.name, artists:t.artists?.map(a=>a.name).join(', ')||'—', plays:0, ms:0 };
    tt.plays += 1; tt.ms += dur; byTrack.set(tid, tt);

    // Artists
    for (const a of artists){
      const ar = byArtist.get(a.id) || { id:a.id, name:a.name, plays:0, ms:0 };
      ar.plays += 1; ar.ms += dur; byArtist.set(a.id, ar);
    }
  }
  const tracks = [...byTrack.values()].sort((a,b)=> b.plays - a.plays || b.ms - a.ms).slice(15);
  const artists = [...byArtist.values()].sort((a,b)=> b.plays - a.plays || b.ms - a.ms).slice(15);
  return {
    tracks: [...byTrack.values()].sort((a,b)=> b.plays - a.plays || b.ms - a.ms).slice(10),
    artists: [...byArtist.values()].sort((a,b)=> b.plays - a.plays || b.ms - a.ms).slice(10)
  };
}

async function renderRecent(){
  try {
    const recent = await fetchRecent(50);
    const agg = aggregateRecent(recent);
    renderList(agg.tracks, 'recentTracks', (x)=> `<b>${x.name}</b><br><small>${x.artists}</small> — ${x.plays} plays · ${hours(x.ms)}`);
    renderList(agg.artists, 'recentArtists', (x)=> `<b>${x.name}</b> — ${x.plays} plays · ${hours(x.ms)}`);
    $('#recentCard')?.classList.remove('hidden');
  } catch(e){ setStatus('Recent plays unavailable. '+e.message); }
}

// ===== Imported Extended Streaming History =====
async function importHistory(files){
  // Accept multiple JSON files. Expect objects with { endTime, artistName, trackName, msPlayed }
  const all = [];
  for (const f of files){
    try{
      const txt = await f.text();
      const data = JSON.parse(txt);
      if (Array.isArray(data)) all.push(...data);
    }catch{ /* ignore */ }
  }
  if (!all.length){ setStatus('No valid JSON data found.'); return; }

  const byTrack = new Map(); const byArtist = new Map();
  for (const r of all){
    const t = (r.trackName || 'Unknown').trim();
    const a = (r.artistName || 'Unknown').trim();
    const ms = Number(r.msPlayed||0);
    const tid = `${a} — ${t}`;
    const tt = byTrack.get(tid) || { name:t, artists:a, plays:0, ms:0 };
    tt.plays += 1; tt.ms += ms; byTrack.set(tid, tt);

    const ar = byArtist.get(a) || { name:a, plays:0, ms:0 };
    ar.plays += 1; ar.ms += ms; byArtist.set(a, ar);
  }
  const tracks = [...byTrack.values()].sort((x,y)=> y.ms - x.ms || y.plays - x.plays).slice(10);
  const artists = [...byArtist.values()].sort((x,y)=> y.ms - x.ms || y.plays - x.plays).slice(10);

  renderList(tracks, 'historyTracks', (x)=> `<b>${x.name}</b><br><small>${x.artists}</small> — ${x.plays} plays · ${hours(x.ms)}`);
  renderList(artists, 'historyArtists', (x)=> `<b>${x.name}</b> — ${x.plays} plays · ${hours(x.ms)}`);
  $('#historyCard')?.classList.remove('hidden');
  setStatus('Imported history computed.');
}

// ===== UI wiring =====
function showSetupModal(){
  fillRedirectUri();
  $('#setupModal')?.classList.remove('hidden');

  $('#copyRedirectBtn')?.addEventListener('click', ()=>{
    const uri = getRedirectUri();
    navigator.clipboard.writeText(uri).catch(()=>{});
  });

  $('#saveClientIdBtn')?.addEventListener('click', ()=>{
    const id = $('#clientIdInput').value;
    const remember = $('#rememberClientId').checked;
    setClientId(id, remember);
    if (getClientId()){
      $('#setupModal')?.classList.add('hidden');
      $('#accountControls')?.classList.remove('hidden');
      setStatus('Client ID saved. Click “Login with Spotify”.');
    }
  });

  $('#cancelSetupBtn')?.addEventListener('click', ()=> $('#setupModal')?.classList.add('hidden'));
}

async function handleAuthCallback(){
  const url = new URL(location.href);
  const error = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  if (error){ setStatus('Auth error: '+error); return false; }
  if (!code) return false;
  try{
    await exchangeCodeForToken(code);
    url.searchParams.delete('code'); url.searchParams.delete('state');
    history.replaceState({}, document.title, url.toString());
    setStatus('Authenticated. Loading…');
    return true;
  }catch(e){ setStatus(e.message||String(e)); return false; }
}

async function init(){
  // Header buttons
  $('#loginBtn')?.addEventListener('click', ()=> startLogin());
  $('#openSetupBtn')?.addEventListener('click', ()=> showSetupModal());
  $('#changeClientIdBtn')?.addEventListener('click', ()=> { clearClientId(); showSetupModal(); });
  $('#clearSessionBtn')?.addEventListener('click', ()=> { signOut(); alert('Signed out. Click “Login with Spotify” to sign in again.'); });
  $('#historyFile')?.addEventListener('change', (e)=> importHistory(e.target.files));

  fillRedirectUri();
  if (getClientId()) $('#accountControls')?.classList.remove('hidden');

  const did = await handleAuthCallback();
  if (!did){ await refreshTokenIfNeeded(); }

  // If authenticated, load data
  const hasTokens = !!localStorage.getItem(STORAGE_KEYS.TOKENS);
  if (hasTokens){
    try{
      await refreshTokenIfNeeded();
      const me = await fetchMe();
      renderProfile(me);
      $('#profileCard')?.classList.remove('hidden');

      // Top lists
      const timeSel = $('#timeRangeSelect');
      async function loadTops(){
        const tr = timeSel?.value || 'short_term';
        const topArtists = await fetchTop('artists', tr, 10);
        const topTracks  = await fetchTop('tracks',  tr, 10);
        renderList(topArtists.items, 'topArtists', (a)=> `<b>${a.name}</b>`);
        renderList(topTracks.items,  'topTracks',  (t)=> `<b>${t.name}</b><br><small>${t.artists.map(a=>a.name).join(', ')}</small>`);
        $('#topsCard')?.classList.remove('hidden');
      }
      timeSel?.addEventListener('change', loadTops);
      await loadTops();

      // Recent aggregation (counts + hours for last 50)
      await renderRecent();
      $('#refreshRecentBtn')?.addEventListener('click', renderRecent);

      setStatus('Loaded.');
    }catch(e){ setStatus('Ready. (Login to load data) '+(e.message||e)); }
  }else{
    setStatus('Ready. Click “How to connect” or paste Client ID and Login.');
  }
}

document.addEventListener('DOMContentLoaded', init);
