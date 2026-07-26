# 🎬 Movie Hunt

A single-page movie discovery app built on the [TMDB API](https://www.themoviedb.org/documentation/api). It was built as a 3rd-semester project, with one distinguishing idea: instead of showing only Hollywood movies (the default for most TMDB demo apps), every section of the app **deliberately interleaves popular English and Hindi cinema 50/50** — a home "Spotlight," genre categories, and search results all give equal real estate to Bollywood and Hollywood.

Live demo: [https://hiten1896.github.io/Movie-Hunt/](https://hiten1896.github.io/Movie-Hunt/)_

---

## ✨ Features

- **Home / Spotlight** — a curated, evenly-mixed feed of trending English and Hindi movies.
- **Categories** — ten genres (Action, Comedy, Horror, Romance, Sci-Fi, etc.), each with its own balanced mix, plus a sticky scroll-spy index sidebar for quick jumps.
- **Search** — type-ahead autosuggest (debounced) and a full search that also balances English/Hindi results.
- **Voice search** — press the mic and speak a title (uses the browser's Web Speech API; gracefully hides itself on unsupported browsers).
- **Movie detail modal** — click any poster to see the overview, genres, runtime, rating, top cast, and a link to the trailer on YouTube.
- **Watchlist** — click the heart icon on any card to save it. Stored in `localStorage`, so it persists across visits on the same device/browser with zero backend or login required.
- Fully responsive, from phones to widescreen desktop.
- **PWA & Offline Support** — Includes a `manifest.json` and Service Worker (`sw.js`) so users can install it as an app and access cached assets offline.

## 🧱 Tech stack

- Plain HTML/CSS/JavaScript — no build step, no framework, no bundler.
- [Tailwind CSS (CDN build)](https://tailwindcss.com/) for a handful of utility classes, layered under a custom CSS design system (see the `:root` variables in `index.html`).
- [TMDB API](https://www.themoviedb.org/documentation/api) for all movie data, posters, cast, and trailers.
- Browser `localStorage` for the watchlist — no database, no backend, no user accounts.

## 🚀 Getting started

1. **Clone the repo**
   ```bash
   git clone https://github.com/Hiten1896/movie-hunt.git
   cd movie-hunt
   ```

2. **Get a free TMDB API key**
   Sign up at [themoviedb.org](https://www.themoviedb.org/signup), then generate a key at
   [Settings → API](https://www.themoviedb.org/settings/api). The "API Key (v3 auth)" is what this project uses.

3. **Add your key**
   ```bash
   cp config.example.js config.js
   ```
   Then open `config.js` and paste your key:
   ```js
   window.TMDB_API_KEY = 'your-real-key-here';
   ```
   `config.js` is listed in `.gitignore`, so it will never be committed or pushed to GitHub.

4. **Run it**
   This is a static site — no build step. Either:
   - Open `index.html` directly in a browser, or
   - Serve it locally so `fetch()` calls behave exactly like production (recommended):
     ```bash
     npx serve .
     # or
     python3 -m http.server 8000
     ```


## 📁 Project structure

```
movie-hunt/
├── .github/              # GitHub Actions workflows
├── css/                  # Stylesheets
├── js/                   # Modular JavaScript files
├── .env                  # Environment variables
├── .env.example          # Environment template
├── .gitignore            # Git ignore rules
├── README.md             # Project documentation
├── app.css               # Main app stylesheet
├── app.js                # Core app logic
├── config.example.js     # API config template
├── env.js                # Environment config loader
├── index.html            # Main HTML entry point
├── manifest.json         # PWA manifest
└── sw.js                 # Service worker
```

## ⚠️ Known limitations / honest notes

- The watchlist lives in `localStorage`, so it's per-browser, per-device — it does not sync across devices. That's a deliberate trade-off to avoid needing a backend/login for a student project; see the master prompt below for how to add real accounts later.
- The TMDB v3 API key used here is a client-side key by design (that's how TMDB's client-side auth works) — it's rate-limited, not a secret credential like a database password.
- Category and search pages fetch first-page results only (no pagination yet).

## 🙌 Credits

This project uses the [TMDB API](https://www.themoviedb.org/documentation/api) but is not endorsed or certified by TMDB.
