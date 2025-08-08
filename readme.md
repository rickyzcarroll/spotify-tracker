# Spotify Stats Tracker (Client-Only PKCE Version)

A free, open-source Spotify tracker that shows your **top artists** and **top tracks** using Spotify’s PKCE auth flow.  
No server required — just host it on GitHub Pages, Netlify, or Vercel.

---

## Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click **Create App**
3. Add:
   - Name: `Spotify Tracker`
   - Redirect URI: `https://YOUR_GITHUB_USERNAME.github.io/spotify-tracker/`
4. Save, then copy your **Client ID**
5. Open `script.js` and replace:
   ```javascript
   const clientId = "YOUR_SPOTIFY_CLIENT_ID";
