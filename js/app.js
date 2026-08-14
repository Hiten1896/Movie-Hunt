const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function initializeApp() {
    if (!TMDB_API_KEY || TMDB_API_KEY === 'your_api_key_here') {
        showKeyConfigurationError();
        return;
    }
    setupEventListeners();
    fetchDiscoverMovies();
    loadWatchlist();
}

function showKeyConfigurationError() {
    const container = document.getElementById('movie-grid');
    if (container) {
        container.innerHTML = `
            <div class="error-card" style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #ffffff; background: rgba(255, 0, 0, 0.1); border: 1px solid rgba(255, 0, 0, 0.3); border-radius: 8px;">
                <h3>TMDB API Key Configuration Required</h3>
                <p>Please ensure your <code>.env</code> file contains a valid <code>VITE_TMDB_API_KEY</code> to view the application live.</p>
            </div>
        `;
    }
}

async function fetchWithBackoff(url, retries = 3, delay = 1000) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 429 && retries > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
                return fetchWithBackoff(url, retries - 1, delay * 2);
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithBackoff(url, retries - 1, delay * 2);
        }
        throw error;
    }
}

function interleaveMovies(englishList, hindiList) {
    const mixed = [];
    const maxLength = Math.max(englishList.length, hindiList.length);
    for (let i = 0; i < maxLength; i++) {
        if (i < englishList.length) mixed.push(englishList[i]);
        if (i < hindiList.length) mixed.push(hindiList[i]);
    }
    return mixed;
}

async function fetchDiscoverMovies() {
    const grid = document.getElementById('movie-grid');
    if (!grid) return;
    grid.innerHTML = '<div class="loading" style="grid-column: 1/-1; text-align: center; color: var(--color-text-muted);">Loading trending titles...</div>';
    try {
        const engUrl = `${TMDB_API_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=en&sort_by=popularity.desc`;
        const hinUrl = `${TMDB_API_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=hi&sort_by=popularity.desc`;
        const [engData, hinData] = await Promise.all([
            fetchWithBackoff(engUrl),
            fetchWithBackoff(hinUrl)
        ]);
        const mixedMovies = interleaveMovies(engData.results || [], hinData.results || []);
        renderMovies(mixedMovies, 'movie-grid');
    } catch (error) {
        console.error('Error fetching movies:', error);
        grid.innerHTML = `<div class="error" style="grid-column: 1/-1; text-align: center; color: var(--color-action);">Failed to load movies. Please try check your internet connection.</div>`;
    }
}

function renderMovies(movies, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (movies.length === 0) {
        container.innerHTML = '<div class="no-results" style="grid-column: 1/-1; text-align: center; color: var(--color-text-muted);">No movies found matching the criteria.</div>';
        return;
    }
    container.innerHTML = movies.map(movie => {
        const posterPath = movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Poster';
        const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
        const isEnrolled = isInWatchlist(movie.id);
        return `
            <div class="movie-card" data-id="${movie.id}">
                <div class="poster-wrapper">
                    <img src="${posterPath}" alt="${movie.title}" loading="lazy">
                    <div class="card-overlay">
                        <button class="watchlist-btn ${isEnrolled ? 'active' : ''}" onclick="toggleWatchlist(${JSON.stringify(movie).replace(/"/g, '&quot;')})">
                            ${isEnrolled ? '★ In Watchlist' : '☆ Add Watchlist'}
                        </button>
                    </div>
                </div>
                <div class="movie-info">
                    <h3 class="movie-title">${movie.title}</h3>
                    <div class="movie-meta">
                        <span class="rating">⭐ ${rating}</span>
                        <span class="release-date">${movie.release_date ? movie.release_date.split('-')[0] : 'Unknown'}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

let debounceTimer;
function debounce(func, delay) {
    return function (...args) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func.apply(this, args), delay);
    };
}

async function performSearch(query) {
    const grid = document.getElementById('movie-grid');
    if (!grid || !query.trim()) {
        if (!query.trim()) fetchDiscoverMovies();
        return;
    }
    try {
        const searchUrl = `${TMDB_API_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`;
        const data = await fetchWithBackoff(searchUrl);
        renderMovies(data.results || [], 'movie-grid');
    } catch (error) {
        console.error('Search failure:', error);
    }
}

let recognition;
function initializeSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.onstart = () => {
        const micIcon = document.getElementById('mic-icon');
        if (micIcon) micIcon.classList.add('recording-active');
    };
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.value = transcript;
            performSearch(transcript);
        }
    };
    recognition.onend = () => {
        const micIcon = document.getElementById('mic-icon');
        if (micIcon) micIcon.classList.remove('recording-active');
    };
}

function toggleVoiceSearch() {
    if (!recognition) initializeSpeechRecognition();
    if (recognition) recognition.start();
}

function getWatchlist() {
    try {
        return JSON.parse(localStorage.getItem('movie_hunt_watchlist')) || [];
    } catch (e) {
        console.error('Failed to parse watchlist from local storage state:', e);
        return [];
    }
}

function isInWatchlist(movieId) {
    const watchlist = getWatchlist();
    return watchlist.some(m => m.id === movieId);
}

window.toggleWatchlist = function(movie) {
    let watchlist = getWatchlist();
    if (isInWatchlist(movie.id)) {
        watchlist = watchlist.filter(m => m.id !== movie.id);
    } else {
        watchlist.push(movie);
    }
    try {
        localStorage.setItem('movie_hunt_watchlist', JSON.stringify(watchlist));
    } catch (e) {
        console.error('Failed to write updates to local storage sandbox:', e);
    }
    const activeSearch = document.getElementById('search-input')?.value;
    if (activeSearch) {
        performSearch(activeSearch);
    } else {
        fetchDiscoverMovies();
    }
    loadWatchlist();
};

function loadWatchlist() {
    const watchlist = getWatchlist();
    renderMovies(watchlist, 'watchlist-grid');
}

function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => performSearch(e.target.value), 400));
    }
    const micBtn = document.getElementById('mic-btn');
    if (micBtn) {
        micBtn.addEventListener('click', toggleVoiceSearch);
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);





