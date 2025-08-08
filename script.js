const clientId = "YOUR_SPOTIFY_CLIENT_ID"; // Replace with your Spotify App client_id
const redirectUri = window.location.origin + window.location.pathname; // Same as in Spotify dashboard
const scopes = "user-top-read";

const loginBtn = document.getElementById("login-btn");
const statsDiv = document.getElementById("stats");

function generateCodeVerifier(length) {
  let text = '';
  let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function generateCodeChallenge(codeVerifier) {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

loginBtn.addEventListener("click", async () => {
  const verifier = generateCodeVerifier(128);
  const challenge = await generateCodeChallenge(verifier);
  localStorage.setItem("verifier", verifier);

  const url = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&code_challenge_method=S256&code_challenge=${challenge}`;
  window.location = url;
});

async function getAccessToken(code) {
  const verifier = localStorage.getItem("verifier");

  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", redirectUri);
  params.append("code_verifier", verifier);

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  });

  return res.json();
}

async function fetchSpotifyData(token) {
  const topArtists = await fetch("https://api.spotify.com/v1/me/top/artists?limit=10", {
    headers: { Authorization: `Bearer ${token}` }
  }).then(res => res.json());

  const topTracks = await fetch("https://api.spotify.com/v1/me/top/tracks?limit=10", {
    headers: { Authorization: `Bearer ${token}` }
  }).then(res => res.json());

  renderData(topArtists.items, topTracks.items);
}

function renderData(artists, tracks) {
  statsDiv.style.display = "block";
  loginBtn.style.display = "none";

  const artistList = document.getElementById("artist-list");
  artistList.innerHTML = "";
  artists.forEach(a => {
    const li = document.createElement("li");
    li.textContent = a.name;
    artistList.appendChild(li);
  });

  const trackList = document.getElementById("track-list");
  trackList.innerHTML = "";
  tracks.forEach(t => {
    const li = document.createElement("li");
    li.textContent = `${t.name} — ${t.artists[0].name}`;
    trackList.appendChild(li);
  });

  new Chart(document.getElementById("artist-chart"), {
    type: 'bar',
    data: {
      labels: artists.map(a => a.name),
      datasets: [{
        label: 'Popularity',
        data: artists.map(a => a.popularity),
        backgroundColor: '#1DB954'
      }]
    }
  });

  new Chart(document.getElementById("track-chart"), {
    type: 'bar',
    data: {
      labels: tracks.map(t => t.name),
      datasets: [{
        label: 'Popularity',
        data: tracks.map(t => t.popularity),
        backgroundColor: '#1DB954'
      }]
    }
  });
}

// Handle redirect
(async function handleRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");

  if (code) {
    const tokenData = await getAccessToken(code);
    localStorage.setItem("access_token", tokenData.access_token);
    history.replaceState({}, null, redirectUri);
    fetchSpotifyData(tokenData.access_token);
  } else {
    const token = localStorage.getItem("access_token");
    if (token) {
      fetchSpotifyData(token);
    }
  }
})();
