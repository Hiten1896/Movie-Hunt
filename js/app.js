// --- CONFIGURATION ---
const API_KEY = (typeof window.TMDB_API_KEY !== 'undefined') ? window.TMDB_API_KEY : '';
const API_BASE_URL = 'https://api.themoviedb.org/3/';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/w780';
const PROFILE_BASE_URL = 'https://image.tmdb.org/t/p/w185';

// --- DOM Elements ---
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const micButton = document.getElementById('mic-button'); 
const suggestionBox = document.getElementById('suggestion-box');
const homeTab = document.getElementById('home-tab');
const categoriesTab = document.getElementById('categories-tab');
const watchlistTab = document.getElementById('watchlist-tab');
const homeView = document.getElementById('home-view');
const categoriesView = document.getElementById('categories-view');
const searchView = document.getElementById('search-view');
const watchlistView = document.getElementById('watchlist-view');
const categoryIndexBar = document.getElementById('category-index-bar');
const categoryMainContent = document.getElementById('category-main-content');
const indexContent = document.getElementById('index-content');

// Modal + toast elements
const movieModal = document.getElementById('movie-modal');
const modalBody = document.getElementById('modal-body');
const modalClose = document.getElementById('modal-close');
const toastEl = document.getElementById('toast');

// --- STATE ---
let currentFocus = -1; 
let genreMap = {}; 
let currentView = 'home';
let homeLoaded = false;
let categoriesLoaded = false;
let toastTimer = null;

// --- CATEGORIES DEFINITION ---
const CATEGORIES_CONFIG = [
    { name: "Trending Action", genre_id: 28 },
    { name: "Trending Adventure", genre_id: 12 },
    { name: "Trending Comedy", genre_id: 35 },
    { name: "Trending Drama", genre_id: 18 }, 
    { name: "Trending Horror", genre_id: 27 },
    { name: "Trending Romance", genre_id: 10749 }, 
    { name: "Trending Thriller", genre_id: 53 },
    { name: "Trending Crime", genre_id: 80 },
    { name: "Trending Sci-Fi", genre_id: 878 }, 
    { name: "Trending Animation", genre_id: 16 },
];

const DISCOVER_BASE_URL = `${API_BASE_URL}discover/movie?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&include_adult=false&include_video=false&page=1`;
const MAX_RETRIES = 3;

function slugify(text) {
    return text.toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') 
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// --- WATCHLIST LOGIC (stored locally in the browser via localStorage) ---
const WATCHLIST_STORAGE_KEY = 'movieHunt_watchlist_v1';
let currentWatchlist = new Set(); 
let watchlistData = {};           

function loadWatchlistFromStorage() {
    try {
        const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
        watchlistData = raw ? JSON.parse(raw) : {};
    } catch (error) {
        console.error('Error reading watchlist from localStorage:', error);
        watchlistData = {};
    }
    currentWatchlist = new Set(Object.keys(watchlistData).map(id => parseInt(id)));
}

function saveWatchlistToStorage() {
    try {
        localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlistData));
    } catch (error) {
        console.error('Error saving watchlist to localStorage:', error);
        showToast('Could not save — storage may be full or disabled.');
    }
}

function updateLikeButtons() {
    document.querySelectorAll('.like-btn').forEach(likeBtn => {
        const movieId = parseInt(likeBtn.dataset.id);
        likeBtn.classList.toggle('liked', currentWatchlist.has(movieId));
    });
    const modalBtn = document.getElementById('modal-watchlist-btn');
    if (modalBtn) {
        const liked = currentWatchlist.has(parseInt(modalBtn.dataset.id));
        modalBtn.classList.toggle('liked', liked);
        modalBtn.textContent = liked ? '✓ In Watchlist' : '+ Add to Watchlist';
    }
}

function toggleWatchlist(movie) {
    const movieId = parseInt(movie.id);

    if (currentWatchlist.has(movieId)) {
        currentWatchlist.delete(movieId);
        delete watchlistData[movieId];
        showToast('Removed from Watchlist');
    } else {
        currentWatchlist.add(movieId);
        watchlistData[movieId] = {
            id: movieId,
            title: movie.title,
            poster_path: movie.poster_path,
            release_date: movie.release_date,
            vote_average: movie.vote_average,
            genre_ids: movie.genre_ids || (movie.genres ? movie.genres.map(g => g.id) : [])
        };
        showToast('Added to Watchlist');
    }

    saveWatchlistToStorage();
    updateLikeButtons();

    if (currentView === 'watchlist') {
        renderWatchlist();
    }
}

function isLiked(movieId) {
    return currentWatchlist.has(parseInt(movieId));
}

function renderWatchlist() {
    const list = Object.values(watchlistData).sort((a, b) => a.title.localeCompare(b.title));

    watchlistView.innerHTML = '';
    if (list.length === 0) {
        watchlistView.innerHTML = '<div class="message">Your watchlist is empty. Tap the heart icon on any movie to add it here.</div>';
    } else {
        displayMovies(list, "My Watchlist", watchlistView, true, 'watchlist-results');
    }
}

// --- API UTILITY FUNCTIONS ---

async function fetchWithBackoff(url) {
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const response = await fetch(url);
            if (response.ok) return response;
            if (i < MAX_RETRIES - 1) await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        } catch (error) {
            console.error(`Fetch attempt ${i + 1} failed for ${url}:`, error);
            if (i < MAX_RETRIES - 1) await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
    }
    throw new Error('Failed to fetch data after multiple retries.');
}

async function fetchGenreMap() {
    const url = `${API_BASE_URL}genre/movie/list?api_key=${API_KEY}&language=en-US`;
    try {
        const response = await fetchWithBackoff(url);
        const data = await response.json();
        if (data.genres) {
            genreMap = data.genres.reduce((map, genre) => {
                map[genre.id] = genre.name;
                return map;
            }, {});
        }
    } catch (error) {
        console.error("Failed to fetch genre map:", error);
    }
}

async function fetchMovieDetailsByID(tmdbID) {
    const url = `${API_BASE_URL}movie/${tmdbID}?api_key=${API_KEY}`; 
    try {
        const response = await fetchWithBackoff(url);
        const data = await response.json();
        return data; 
    } catch (error) {
        console.error(`Error fetching details for ID ${tmdbID}:`, error);
        return null;
    }
}

async function fetchMovieFullDetails(tmdbID) {
    const url = `${API_BASE_URL}movie/${tmdbID}?api_key=${API_KEY}&append_to_response=credits,videos`;
    try {
        const response = await fetchWithBackoff(url);
        return await response.json();
    } catch (error) {
        console.error(`Error fetching full details for ID ${tmdbID}:`, error);
        return null;
    }
}

// --- UI HELPERS ---

function requireApiKey(container) {
    if (API_KEY) return true;
    container.innerHTML = `
        <div class="message error">
            <strong>Missing TMDB API key.</strong><br>
            Copy <code>config.example.js</code> to <code>config.js</code> and add your
            <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer" style="color:var(--color-action); text-decoration:underline;">TMDB API key</a>, then reload the page.
        </div>`;
    return false;
}

function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function debounce(fn, delayMs) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delayMs);
    };
}

function showToast(message) {
    if (!toastEl) return;
    clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.classList.add('show');
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

function findTrailerKey(videos) {
    if (!videos || !Array.isArray(videos.results)) return null;
    const trailer = videos.results.find(v => v.site === 'YouTube' && v.type === 'Trailer')
        || videos.results.find(v => v.site === 'YouTube');
    return trailer ? trailer.key : null;
}

// --- MOVIE DETAIL MODAL ---

async function openMovieModal(movieId) {
    if (!movieModal) return;
    movieModal.classList.add('open');
    document.body.style.overflow = 'hidden';
    modalBody.innerHTML = '<div class="message animate-pulse" style="box-shadow:none; margin:60px auto;">Loading details...</div>';

    const movie = await fetchMovieFullDetails(movieId);

    if (!movieModal.classList.contains('open')) return;

    if (!movie || movie.success === false) {
        modalBody.innerHTML = '<div class="message error" style="box-shadow:none; margin:60px auto;">Could not load movie details. Please try again.</div>';
        return;
    }
    renderModalContent(movie);
}

function closeMovieModal() {
    if (!movieModal) return;
    movieModal.classList.remove('open');
    document.body.style.overflow = '';
}

function renderModalContent(movie) {
    const poster = movie.poster_path
        ? IMAGE_BASE_URL + movie.poster_path
        : 'https://placehold.co/400x600/D1D5DB/6B7280?text=POSTER+N/A';
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
    const year = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
    const runtime = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : null;
    const genrePills = (movie.genres || []).map(g => `<span class="genre-pill">${escapeHtml(g.name)}</span>`).join('');
    const liked = isLiked(movie.id);
    const trailerKey = findTrailerKey(movie.videos);
    const cast = (movie.credits && Array.isArray(movie.credits.cast)) ? movie.credits.cast.slice(0, 8) : [];

    modalBody.innerHTML = `
        <div class="modal-header">
            <img class="modal-poster" src="${poster}" alt="${escapeHtml(movie.title)} poster"
                 onerror="this.onerror=null;this.src='https://placehold.co/400x600/D1D5DB/6B7280?text=POSTER+N/A';">
            <div class="modal-info">
                <h2 id="modal-title-text" class="modal-title">${escapeHtml(movie.title)}</h2>
                ${movie.tagline ? `<p class="modal-tagline">"${escapeHtml(movie.tagline)}"</p>` : ''}
                <div class="modal-meta">
                    <div class="rating-box">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        ${rating}
                    </div>
                    <span class="genre-pill">${year}</span>
                    ${runtime ? `<span class="genre-pill">${runtime}</span>` : ''}
                    ${genrePills}
                </div>
                <p class="modal-overview">${movie.overview ? escapeHtml(movie.overview) : 'No overview available.'}</p>
                <div class="modal-actions">
                    <button id="modal-watchlist-btn" class="modal-watchlist-btn ${liked ? 'liked' : ''}" data-id="${movie.id}">${liked ? '✓ In Watchlist' : '+ Add to Watchlist'}</button>
                    ${trailerKey ? `<a class="modal-trailer-btn" href="https://www.youtube.com/watch?v=${trailerKey}" target="_blank" rel="noopener noreferrer">▶ Watch Trailer</a>` : ''}
                </div>
            </div>
        </div>
        ${cast.length > 0 ? `
        <div class="modal-cast-section">
            <div class="modal-cast-title">Top Cast</div>
            <div class="cast-scroll">
                ${cast.map(actor => `
                    <div class="cast-member">
                        <img src="${actor.profile_path ? PROFILE_BASE_URL + actor.profile_path : 'https://placehold.co/185x185/D1D5DB/6B7280?text=%3F'}"
                             alt="${escapeHtml(actor.name)}" loading="lazy"
                             onerror="this.onerror=null;this.src='https://placehold.co/185x185/D1D5DB/6B7280?text=%3F';">
                        <div class="cast-name">${escapeHtml(actor.name)}</div>
                        <div class="cast-character">${escapeHtml(actor.character || '')}</div>
                    </div>
                `).join('')}
            </div>
        </div>` : ''}
    `;

    document.getElementById('modal-watchlist-btn').addEventListener('click', () => {
        toggleWatchlist(movie);
    });
}

if (modalClose) modalClose.addEventListener('click', closeMovieModal);
if (movieModal) {
    movieModal.addEventListener('click', (e) => {
        if (e.target === movieModal) closeMovieModal();
    });
}
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && movieModal && movieModal.classList.contains('open')) closeMovieModal();
});

function interleaveMovies(listA, listB, limit) {
    const mixedMovies = [];
    let indexA = 0;
    let indexB = 0;

    while (mixedMovies.length < limit) {
        if (indexA < listA.length) {
            const movieA = listA[indexA++];
            if (!mixedMovies.some(m => m.id === movieA.id)) {
                mixedMovies.push(movieA);
            }
        }

        if (mixedMovies.length < limit && indexB < listB.length) {
            const movieB = listB[indexB++];
            if (!mixedMovies.some(m => m.id === movieB.id)) {
                mixedMovies.push(movieB);
            }
        }
        
        if (indexA >= listA.length && indexB >= listB.length) {
            break;
        }
    }
    return mixedMovies.slice(0, limit);
}

// --- CONTENT FETCHERS ---

async function fetchSpotlightContent() {
    if (homeLoaded) return;
    if (!requireApiKey(homeView)) return;

    homeView.innerHTML = '<div class="message animate-pulse">Building the 50/50 Mixed Spotlight...</div>';
    
    try {
        const fetchUrlEn = `${API_BASE_URL}discover/movie?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&include_adult=false&include_video=false&page=1&with_original_language=en&vote_count.gte=100`;
        const fetchUrlHi = `${API_BASE_URL}discover/movie?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&include_adult=false&include_video=false&page=1&with_original_language=hi&vote_count.gte=50`; 
        
        const [enData, hiData] = await Promise.all([
            fetchWithBackoff(fetchUrlEn).then(r => r.json()),
            fetchWithBackoff(fetchUrlHi).then(r => r.json()),
        ]);

        const englishMovies = enData.results ? enData.results.slice(0, 10) : [];
        const hindiMovies = hiData.results ? hiData.results.slice(0, 10) : [];
        
        const spotlightMovies = interleaveMovies(hindiMovies, englishMovies, 10); 
        
        homeView.innerHTML = '';
        if (spotlightMovies.length > 0) {
            displayMovies(spotlightMovies, "Movies of the Day", homeView);
            homeLoaded = true;
        } else {
            homeView.innerHTML = '<div class="message error">Could not load any Spotlight movies.</div>';
        }

    } catch (error) {
        console.error('An error occurred during Spotlight load:', error);
        homeView.innerHTML = '<div class="message error">An error occurred while fetching the Spotlight.</div>';
    }
}

async function fetchCategoryContent() {
    if (categoriesLoaded) return;
    if (!requireApiKey(categoryMainContent)) return;

    categoryMainContent.innerHTML = '<div class="message animate-pulse">Loading all balanced genre categories...</div>';
    indexContent.innerHTML = '';

    try {
        const fetchPromises = CATEGORIES_CONFIG.map(category => {
            const enUrl = `${DISCOVER_BASE_URL}&with_genres=${category.genre_id}&with_original_language=en&vote_count.gte=100`;
            const hiUrl = `${DISCOVER_BASE_URL}&with_genres=${category.genre_id}&with_original_language=hi&vote_count.gte=50`;

            return Promise.all([
                fetchWithBackoff(enUrl).then(r => r.json()),
                fetchWithBackoff(hiUrl).then(r => r.json())
            ]).then(([enData, hiData]) => {
                const englishMovies = enData.results ? enData.results.slice(0, 4) : [];
                const hindiMovies = hiData.results ? hiData.results.slice(0, 4) : [];

                const mixedMovies = interleaveMovies(hindiMovies, englishMovies, 8);
                
                return {
                    name: category.name, 
                    movies: mixedMovies 
                };
            }).catch(error => {
                console.error(`Error fetching balanced content for ${category.name}:`, error);
                return { name: category.name, movies: [], error: true };
            });
        });
        
        const allCategoryData = await Promise.all(fetchPromises);
        
        categoryMainContent.innerHTML = ''; 
        
        let indexHtml = `<div class="index-header">GENRES</div>`;
        const indexLinks = [];
        let contentLoaded = false;
        
        allCategoryData.forEach(category => {
            const id = slugify(category.name);
            
            if (category.movies.length > 0) {
                indexLinks.push(`<a href="#section-${id}" class="index-item">${category.name}</a>`);
                const categoryTitle = `${category.name} (50/50 Mix)`; 
                displayMovies(category.movies, categoryTitle, categoryMainContent, false, id);
                contentLoaded = true;
            } 
        });

        if (contentLoaded) {
            indexContent.innerHTML = indexHtml + indexLinks.join('');
            categoryIndexBar.classList.remove('hidden');
            categoriesLoaded = true;
            setupIndexObserver();
        } else {
             categoryMainContent.innerHTML = '<div class="message">No trending data could be loaded for any category.</div>';
             categoryIndexBar.classList.add('hidden');
        }
        
    } catch (error) {
        console.error('An error occurred during category load:', error);
        categoryMainContent.innerHTML = '<div class="message error">An unexpected error occurred while fetching all categories.</div>';
        categoryIndexBar.classList.add('hidden');
    }
}

function setupIndexObserver() {
    const observerOptions = {
        root: null,
        rootMargin: '0px 0px -80% 0px', 
        threshold: 0
    };

    const indexItems = indexContent.querySelectorAll('.index-item');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const linkHash = `#${entry.target.id}`; 
            const link = indexContent.querySelector(`a[href="${linkHash}"]`);
            
            if (entry.isIntersecting) {
                indexItems.forEach(l => l.classList.remove('active-category'));
                if (link) {
                    link.classList.add('active-category');
                }
            }
        });
    }, observerOptions);

    categoryMainContent.querySelectorAll('.section-title').forEach(element => {
        observer.observe(element);
    });

    indexItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
}

// --- VIEW MANAGEMENT ---

function renderView(viewName) {
    currentView = viewName;

    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    const targetTab = document.querySelector(`[data-view="${viewName}"]`);
    if (targetTab) targetTab.classList.add('active');

    homeView.classList.add('hidden');
    categoriesView.classList.add('hidden');
    searchView.classList.add('hidden');
    watchlistView.classList.add('hidden');
    
    if (viewName !== 'categories' || window.innerWidth < 1024) {
        categoryIndexBar.classList.add('hidden');
    } else if (viewName === 'categories') {
        categoryIndexBar.classList.remove('hidden');
    }

    searchInput.value = '';
    closeAllLists();
    
    if (viewName === 'home') {
        homeView.classList.remove('hidden');
        fetchSpotlightContent();
    } else if (viewName === 'categories') {
        categoriesView.classList.remove('hidden');
        fetchCategoryContent();
    } else if (viewName === 'watchlist') {
        watchlistView.classList.remove('hidden');
        renderWatchlist();
    }
}

// --- NAVIGATION HANDLERS ---
if (homeTab) homeTab.addEventListener('click', () => renderView('home'));
if (categoriesTab) categoriesTab.addEventListener('click', () => renderView('categories'));
if (watchlistTab) watchlistTab.addEventListener('click', () => renderView('watchlist'));

// --- GENERAL SEARCH LOGIC ---

async function searchMovies(query) {
    closeAllLists();
    
    homeView.classList.add('hidden');
    categoriesView.classList.add('hidden');
    watchlistView.classList.add('hidden');
    searchView.classList.remove('hidden');
    searchView.innerHTML = '<div class="message animate-pulse">Searching the archives (English & Hindi)...</div>';
    categoryIndexBar.classList.add('hidden'); 

    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));

    if (!requireApiKey(searchView)) return;
    
    const searchUrlEn = `${API_BASE_URL}search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=en-US`; 
    const searchUrlHi = `${API_BASE_URL}search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=hi-IN`; 

    try {
        const [enResponse, hiResponse] = await Promise.all([
            fetchWithBackoff(searchUrlEn).then(r => r.json()),
            fetchWithBackoff(searchUrlHi).then(r => r.json())
        ]);

        const enResults = enResponse.results ? enResponse.results.slice(0, 5) : [];
        const hiResults = hiResponse.results ? hiResponse.results.slice(0, 5) : [];
        
        const combinedResults = interleaveMovies(hiResults, enResults, 10); 

        if (combinedResults.length > 0) {
            searchView.innerHTML = '<div class="message animate-pulse">Fetching detailed movie information...</div>';

            const detailPromises = combinedResults
                .filter(movie => movie.id)
                .map(movie => fetchMovieDetailsByID(movie.id));
            
            const detailedMovies = (await Promise.all(detailPromises)).filter(data => data !== null);

            if (detailedMovies.length > 0) {
                searchView.innerHTML = ''; 
                displayMovies(detailedMovies, `Search Results for "${query}" (Balanced Mix)`, searchView, true); 
            } else {
                 searchView.innerHTML = `<div class="message error">No detailed results found for "${query}".</div>`;
            }

        } else {
            searchView.innerHTML = `<div class="message error">No mixed results found for "${query}". Try a different search term.</div>`;
        }

    } catch (error) {
        console.error('Error fetching data:', error);
        searchView.innerHTML = '<div class="message error">An unexpected error occurred. Check your API key and network connection.</div>';
    }
}

function displayMovies(movies, title, container, isSingleSearch = false, customId = null) {
    const titleSlug = customId || slugify(title);

    if (container !== categoryMainContent) {
         container.innerHTML = ''; 
    }

    let titleElement = container.querySelector(`#section-${titleSlug}`);
    if (!titleElement) {
        titleElement = document.createElement('h2');
        titleElement.classList.add('section-title');
        titleElement.textContent = title.replace(/<[^>]*>?/gm, ''); 
        titleElement.id = `section-${titleSlug}`;
        container.appendChild(titleElement);
    }

    let gridContainer = container.querySelector(`.grid-${titleSlug}`);
    if (!gridContainer) {
        gridContainer = document.createElement('div');
        gridContainer.classList.add('category-grid', `grid-${titleSlug}`);
        container.appendChild(gridContainer);
    } else {
        if (isSingleSearch) gridContainer.innerHTML = '';
    }
    
    movies.forEach(movie => {
        const movieCard = document.createElement('div');
        movieCard.classList.add('movie-card');

        const posterPath = movie.poster_path;
        const poster = posterPath
            ? IMAGE_BASE_URL + posterPath
            : 'https://placehold.co/400x600/D1D5DB/6B7280?text=POSTER+N/A'; 
        
        const releaseYear = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
        const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
        
        let genreName = 'N/A';
        if (movie.genres && movie.genres.length > 0) {
            genreName = movie.genres[0].name;
        } else if (movie.genre_ids && movie.genre_ids.length > 0) {
            genreName = genreMap[movie.genre_ids[0]] || 'N/A';
        }
        
        const likedClass = isLiked(movie.id) ? 'liked' : '';
        const safeTitle = escapeHtml(movie.title || 'Untitled');

        const posterHtml = `
            <div class="poster-container">
                <img src="${poster}" alt="${safeTitle} poster" 
                     onerror="this.onerror=null;this.src='https://placehold.co/400x600/D1D5DB/6B7280?text=POSTER+N/A';" 
                     loading="lazy">
                <button class="like-btn ${likedClass}" data-id="${movie.id}" title="Add to Watchlist" aria-label="Add ${safeTitle} to Watchlist">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                </button>
            </div>`;

        const infoHtml = `
            <div class="movie-info">
                <h3 class="movie-title" title="${safeTitle}">${safeTitle}</h3>
                <p class="movie-release"><span class="label">Released:</span> ${releaseYear}</p>
                <div class="card-details">
                    <p class="movie-genre"><span class="label">Genre:</span> ${escapeHtml(genreName)}</p>
                    <div class="rating-box">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none" class="lucide lucide-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        ${rating}
                    </div>
                </div>
            </div>`;

        movieCard.innerHTML = posterHtml + infoHtml;
        gridContainer.appendChild(movieCard);
        
        movieCard.addEventListener('click', () => {
            openMovieModal(movie.id);
        });

        const likeBtn = movieCard.querySelector('.like-btn');
        if (likeBtn) {
            likeBtn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                toggleWatchlist(movie);
            });
        }
    });
}

// --- AUTOSUGGEST LOGIC ---
async function fetchSuggestions(query) {
    if (query.length < 3 || !API_KEY) { closeAllLists(); return; }

    const searchUrl = `${API_BASE_URL}search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}&page=1`;
    
    try {
        const response = await fetchWithBackoff(searchUrl);
        const data = await response.json();
        
        if (data.results) {
            const suggestions = data.results.slice(0, 5); 
            displaySuggestions(suggestions, query);
        } else {
            closeAllLists();
        }
    } catch (error) {
        console.error('Error fetching suggestions:', error);
        closeAllLists();
    }
}

function displaySuggestions(suggestions, query) {
    closeAllLists(); 
    currentFocus = -1;

    suggestions.forEach(movie => {
        const item = document.createElement('div');
        item.classList.add('suggestion-item');
        
        const titleText = movie.title || 'Untitled Movie';
        
        const startIndex = titleText.toLowerCase().indexOf(query.toLowerCase());
        let highlightedTitle;
        if (startIndex > -1) {
            const endIndex = startIndex + query.length;
            const pre = titleText.substring(0, startIndex);
            const match = titleText.substring(startIndex, endIndex);
            const post = titleText.substring(endIndex);
            highlightedTitle = `${pre}<span class="highlight">${match}</span>${post}`;
        } else {
            highlightedTitle = titleText;
        }

        const releaseYear = movie.release_date ? `(${movie.release_date.split('-')[0]})` : '';
        
        item.innerHTML = `${highlightedTitle} <span>${releaseYear}</span>`;
        
        item.addEventListener('click', function(e) {
            searchInput.value = titleText;
            searchMovies(titleText);
            closeAllLists();
        });
        
        suggestionBox.appendChild(item);
    });

    if (suggestions.length > 0) {
        suggestionBox.style.display = 'block';
    }
}

function closeAllLists(elmnt) {
    while (suggestionBox && suggestionBox.firstChild) {
        suggestionBox.removeChild(suggestionBox.firstChild);
    }
    if (suggestionBox) suggestionBox.style.display = 'none';
    currentFocus = -1;
}

function addActive(items) {
    if (!items || items.length === 0) return false;
    removeActive(items);
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = (items.length - 1);
    items[currentFocus].classList.add('active');
    items[currentFocus].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function removeActive(items) {
    items.forEach(item => item.classList.remove('active'));
}

// --- EVENT LISTENERS ---
const debouncedFetchSuggestions = debounce((value) => fetchSuggestions(value), 300);

if (searchInput) {
    searchInput.addEventListener('input', function() {
        debouncedFetchSuggestions(this.value);
    });

    searchInput.addEventListener('keydown', function(e) {
        let items = suggestionBox.querySelectorAll('.suggestion-item');
        if (e.key === 'ArrowDown') {
            currentFocus++;
            addActive(items);
        } else if (e.key === 'ArrowUp') {
            currentFocus--;
            addActive(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (currentFocus > -1) {
                items[currentFocus].click();
            } else if (this.value.trim() !== '') {
                searchMovies(this.value.trim());
            }
        } else if (e.key === 'Escape') {
            closeAllLists();
        }
    });
}

if (searchButton) {
    searchButton.addEventListener('click', () => {
        const query = searchInput.value.trim();
        if (query) {
            searchMovies(query);
        }
    });
}

document.addEventListener('click', function (e) {
    if (searchInput && suggestionBox && e.target !== searchInput && e.target !== suggestionBox && !suggestionBox.contains(e.target)) {
        closeAllLists();
    }
});

// --- VOICE SEARCH LOGIC ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

if (recognition && micButton) {
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    micButton.addEventListener('click', () => {
        if (micButton.classList.contains('listening')) {
            recognition.stop();
        } else {
            try {
                recognition.start();
                micButton.classList.add('listening');
            } catch (error) {
                console.error('Speech recognition error:', error);
                micButton.classList.remove('listening');
            }
        }
    });

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        searchInput.value = transcript.trim();
        searchMovies(transcript.trim());
    };

    recognition.onend = () => {
        micButton.classList.remove('listening');
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        micButton.classList.remove('listening');
    };
} else if (micButton) {
    micButton.style.display = 'none';
    console.warn('Speech Recognition API not supported in this browser.');
}

// --- INITIALIZATION ---
async function init() {
    loadWatchlistFromStorage();
    if (API_KEY) {
        await fetchGenreMap();
    }
    renderView('home');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
