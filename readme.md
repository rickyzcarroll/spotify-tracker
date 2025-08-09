# Spotify Tracker

A client-side web app to visualize your Spotify listening data.  
**No backend, no secrets** — uses Spotify’s Web API with the **PKCE** OAuth flow, so anyone can use it safely from their own browser.

- Multi-user: each person pastes their own **Client ID** (stored locally, not in code).
- Works on **GitHub Pages** or any static host.
- Tokens live only in the user’s browser.

---

## 🚀 Live Demo (after you deploy)

Your Pages URL will look like:

```

https\://<your-username>.github.io/spotify-tracker/

```

For this repo, it’s:

```

[https://rickyzcarroll.github.io/spotify-tracker/](https://rickyzcarroll.github.io/spotify-tracker/)

```

> **Important:** The Redirect URI in your Spotify app **must exactly match** this URL **with a trailing slash**.

---

## 🧠 How It Works (in 10 seconds)

- On first load, the app shows a short setup panel.
- The user pastes a **Spotify Client ID** from the Spotify Developer Dashboard.
- The app performs **PKCE** OAuth (no client secret required).
- Access/refresh tokens are stored **locally** in the browser (not committed anywhere).

---

## ✅ What You Need

- A Spotify account.
- A Spotify “app” (free) from the **Spotify Developer Dashboard** to get a **Client ID**.
- A static site URL (GitHub Pages works great).

---

## 🛠 Quick Start for **End Users**

1. Open the app in your browser.  
   You’ll see a **Connect to Spotify** setup panel the first time.

2. In another tab, go to the **Spotify Developer Dashboard**:  
   https://developer.spotify.com/dashboard

3. **Create an App** → open the app → **Edit Settings**.

4. Add this **Redirect URI** (must match exactly, with trailing slash):  
```

[https://rickyzcarroll.github.io/spotify-tracker/](https://rickyzcarroll.github.io/spotify-tracker/)

```

5. **Save**, then copy the app’s **Client ID**.

6. Return to the app tab, **paste the Client ID**, choose **Remember on this device** if you want, and click **Save & Continue**.

7. Click **Login with Spotify** and approve the permissions.  
You’ll be redirected back and your stats will load.

> Switching devices or browsers? Just repeat steps 1, 5–7 in that browser.

---

## 🌐 Deploying to **GitHub Pages**

1. Push the repo to the `main` branch.
2. In **GitHub → Settings → Pages**:
- **Source**: `Deploy from a branch`
- **Branch**: `main`
- **Folder**: `/ (root)`
3. Wait ~1–2 minutes. Your site will appear at:
```

https\://<your-username>.github.io/spotify-tracker/

````
4. Use that exact URL (with trailing slash) as your **Redirect URI** in the Spotify app.

> **Forks**: If someone forks your repo, their Pages URL will be different. They must add **their** Pages URL (with trailing slash) to their own Spotify app and then paste **their** Client ID in the app.

---

## 🔐 Security & Privacy

- **Client ID is not secret.** It only identifies the app to Spotify.
- **Tokens are sensitive** and are stored **only in the user’s browser** (`localStorage` or `sessionStorage` depending on the “Remember” choice).
- No tokens, IDs, or listening data are sent to any server you control — only to Spotify’s official endpoints during OAuth and API calls.

---

## 🔄 Managing Your Session

- **Change Client ID**: Use the **Change Client ID** button in the app to paste a different one (useful if you switch to another Spotify developer app).
- **Sign out**: Click **Sign out** to clear tokens. Your saved Client ID can remain (if you chose “Remember”) so you don’t have to paste it again.

---

## 📚 Scopes Used (default)

- `user-read-email`
- `user-top-read`
- `user-read-recently-played`
- `playlist-read-private`

> The app requests only what it needs. If you add features requiring more scopes, you must update both the code and the Spotify app approval flow.

---

## 🧪 Local Development

You can run this without any build step.

```bash
# Clone
git clone https://github.com/<your-username>/spotify-tracker.git
cd spotify-tracker

# Open index.html directly in your browser
# or run a tiny static server (Python example):
python -m http.server 8000
# then visit http://localhost:8000/
````

> For local testing, your **Redirect URI** must match how you load the page (e.g., `http://localhost:8000/`). Add that URI to your Spotify app’s Redirect URIs if you want local OAuth to work.

---

## 🧯 Troubleshooting

### 1) “INVALID\_CLIENT” / 400 on `accounts.spotify.com/authorize`

* **Cause:** `client_id` isn’t set or is wrong.
* **Fix:** Use **Change Client ID** in the app and paste the **exact Client ID** from your Spotify app.

### 2) “INVALID\_REDIRECT\_URI” or redirect fails back to the app

* **Cause:** The **Redirect URI** in your Spotify app **does not exactly match** your site’s URL.
* **Fix:** Copy the exact app URL (including **trailing slash**) and add it to **Edit Settings → Redirect URIs** in the Spotify Dashboard. Save changes.

### 3) GitHub Pages shows 404 or old content

* **Cause:** Pages not enabled, wrong branch/folder, or CDN caching.
* **Fix:** In **Settings → Pages**, set `Deploy from a branch` / `main` / `(root)`. Wait a minute and hard refresh (`Ctrl/Cmd+Shift+R`).

### 4) Blank page after login

* **Cause:** Browser blocked popup/redirect, or tokens didn’t store.
* **Fix:** Disable strict tracking blockers for the site, try again. If needed, uncheck “Remember on this device” so tokens go to `sessionStorage`.

### 5) I forked the repo and OAuth doesn’t work

* **Cause:** Your fork’s Pages URL is different.
* **Fix:** Use **your** fork’s URL as the Redirect URI in **your** Spotify app and paste **your** app’s Client ID.

---

## ❓ FAQ

**Q: Can we avoid Spotify Developer setup entirely?**
**A:** Not for live personal data — Spotify requires OAuth. You can optionally build a separate mode that reads Spotify’s **Extended Streaming History** files offline, but that’s a different (non-live) workflow and not part of this PKCE flow.

**Q: Where is my Client ID stored?**
**A:** In your browser’s `localStorage` (or `sessionStorage` if you uncheck “Remember”). Nothing is saved in the repo.

**Q: Can multiple people use the same deployment?**
**A:** Yes. Each person pastes **their own** Client ID the first time they visit. No code changes required.

---

## 🧭 Project Structure

```
/
├─ index.html      # UI + login button + setup modal hooks
├─ script.js       # PKCE auth, token storage, API calls, rendering
├─ style.css       # Styles (optional)
└─ README.md       # This file
```

---

## 🤝 Contributing

Issues and PRs are welcome. Keep it client-only (no secrets), and document any new scopes clearly.

---
