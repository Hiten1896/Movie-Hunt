# 🎬 Movie Hunt

A modern, responsive web application for discovering movies with a 50/50 balanced mix of English & Hindi cinema. Powered by TMDB API and Firebase Firestore.

## ✨ Features

- **Movies of the Day**: Curated 50/50 interleaved mix of top English & Hindi films.
- **Genre Categories**: Browse Action, Comedy, Horror, Sci-Fi, Drama and more with a sticky side navigation bar.
- **Instant Auto-Suggest Search**: Real-time title autocompletion while typing.
- **Voice Search**: Search for movies using speech recognition (Web Speech API).
- **Personal Watchlist**: Real-time Firestore sync & Local Storage fallback for saving favorite movies.
- **Responsive & Modern UI**: Smooth scrolling, glassmorphism card design, mobile tab navigation, and animated feedback states.

## 📁 Project Structure

```text
movie hunt/
├── index.html            # Main HTML entry point
├── app.css               # CSS entry point (imports css/app.css)
├── app.js                # JS entry point (imports js/app.js)
├── env.js                # Environment configuration script
├── .env                  # Environment variables (ignored by Git)
├── .env.example          # Template environment variables file
├── .gitignore            # Git ignore rules
├── README.md             # Project documentation
├── css/
│   └── app.css           # Core stylesheet
└── js/
    ├── app.js            # Main application logic & UI controllers
    └── firebase.js       # Firebase authentication & Firestore module
```

## 🚀 Quick Start

1. Clone or open the repository in your browser or local server.
2. Open `index.html` directly in a browser or serve using Live Server (`npx serve` or VS Code Live Server).

## ⚙️ Configuration

- API keys and environment settings can be configured in `env.js` or via `.env`.
- Get a free TMDB API key at [themoviedb.org](https://www.themoviedb.org/settings/api).

## 📤 Pushing to GitHub

To initialize git for this repository and push to your GitHub account, run the following commands in your terminal:

```bash
# 1. Initialize Git in the project directory
git init

# 2. Rename branch to main
git branch -M main

# 3. Add all project files
git add .

# 4. Create initial commit
git commit -m "Initial commit: Refactored modular Movie Hunt app"

# 5. Link your GitHub repository (replace with your repo URL)
git remote add origin https://github.com/YOUR_USERNAME/movie-hunt.git

# 6. Push to GitHub
git push -u origin main
```

## 📜 License

MIT License
