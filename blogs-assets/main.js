const API_URL = "https://script.google.com/macros/s/AKfycbyAqEcJV9zhQ8iOvbjG6xqVf6NnqbBVDxFGgoYXR_cRG9QMYZZWghS4fREQmtSkIf75/exec";
let postsCache = [];
let allPosts = [];
let filteredPosts = [];
let isSearching = false;
let currentPage = 1;
const postsPerPage = 12;
let autoRefreshInterval;
let currentTrailerLink = '';
let youtubePlayer = null;

// ==================== NEW: GENRE FILTER VARIABLES ====================
let selectedGenre = null;
let allGenres = [];
let genrePostCounts = {};

// YouTube Player Management
function onYouTubeIframeAPIReady() {
    console.log('YouTube API ready');
}

function showTrailer() {
    if (!currentTrailerLink) return;
    
    const trailerContainer = document.getElementById('trailerContainer');
    const trailerVideoDiv = document.getElementById('trailerVideo');
    
    let videoId = extractYouTubeVideoId(currentTrailerLink);
    
    if (!videoId) {
        trailerVideoDiv.innerHTML = `
            <iframe 
                src="${currentTrailerLink}" 
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen>
            </iframe>
        `;
    } else {
        if (youtubePlayer) {
            youtubePlayer.destroy();
        }
        
        youtubePlayer = new YT.Player('trailerVideo', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
                'autoplay': 1,
                'rel': 0,
                'modestbranding': 1,
                'showinfo': 0
            },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange
            }
        });
    }
    
    trailerContainer.style.display = 'block';
    trailerContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('singlePostTrailerBtn').style.display = 'none';
}

function closeTrailer() {
    const trailerContainer = document.getElementById('trailerContainer');
    const trailerVideoDiv = document.getElementById('trailerVideo');
    
    if (youtubePlayer && youtubePlayer.stopVideo) {
        youtubePlayer.stopVideo();
    }
    
    trailerVideoDiv.innerHTML = '';
    trailerContainer.style.display = 'none';
    document.getElementById('singlePostTrailerBtn').style.display = 'inline-block';
}

function onPlayerReady(event) {
    console.log('YouTube player ready');
}

function onPlayerStateChange(event) {
    console.log('Player state changed:', event.data);
}

function extractYouTubeVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
        /youtu\.be\/([a-zA-Z0-9_-]{11})/
    ];
    
    for (let pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    return null;
}

// ==================== NEW: GENRE FILTER FUNCTIONS ====================
function extractAllGenres() {
    allGenres = [];
    genrePostCounts = {};
    
    allPosts.forEach(post => {
        if (post.Genres && post.Genres.trim() !== '') {
            const genres = post.Genres.split(',').map(g => g.trim()).filter(g => g);
            genres.forEach(genre => {
                if (!allGenres.includes(genre)) {
                    allGenres.push(genre);
                    genrePostCounts[genre] = 1;
                } else {
                    genrePostCounts[genre]++;
                }
            });
        }
    });
    
    // Sort genres alphabetically
    allGenres.sort();
}

function populateGenreDropdown() {
    const dropdownMenu = document.getElementById('genreDropdownMenu');
    const loadingElement = dropdownMenu.querySelector('.loading-genres');
    
    if (loadingElement) {
        loadingElement.remove();
    }
    
    // Add genre items
    allGenres.forEach(genre => {
        const count = genrePostCounts[genre] || 0;
        const li = document.createElement('li');
        li.innerHTML = `
            <a class="dropdown-item genre-filter-item" href="#" data-genre="${genre}">
                ${genre}
                <span class="genre-count">${count}</span>
            </a>
        `;
        dropdownMenu.appendChild(li);
    });
    
    // Add event listeners to genre items
    document.querySelectorAll('.genre-filter-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const genre = this.getAttribute('data-genre');
            filterByGenre(genre);
            
            // Close dropdown on mobile
            const dropdown = document.getElementById('genreDropdown');
            const bsDropdown = bootstrap.Dropdown.getInstance(dropdown);
            if (bsDropdown && window.innerWidth < 768) {
                bsDropdown.hide();
            }
        });
    });
}

function filterByGenre(genre) {
    if (genre === 'all') {
        clearGenreFilter();
        return;
    }
    
    selectedGenre = genre;
    
    // Update button text
    const dropdownBtn = document.getElementById('genreDropdown');
    dropdownBtn.innerHTML = `<i class="fas fa-filter me-1"></i>${genre}`;
    
    // Update active filters display
    updateActiveFiltersDisplay();
    
    // Apply filter
    applyFilters();
}

function clearGenreFilter() {
    selectedGenre = null;
    
    // Reset button text
    const dropdownBtn = document.getElementById('genreDropdown');
    dropdownBtn.innerHTML = `<i class="fas fa-film me-1"></i></i>Movie Genres`;
    
    // Update active filters display
    updateActiveFiltersDisplay();
    
    // Apply filter (which will remove genre filter)
    applyFilters();
}

function clearAllFilters() {
    selectedGenre = null;
    clearSearch();
    
    // Reset button text
    const dropdownBtn = document.getElementById('genreDropdown');
    dropdownBtn.innerHTML = `<i class="fas fa-film me-1"></i>Movie Genres`;
    
    // Update active filters display
    updateActiveFiltersDisplay();
    
    // Load all posts
    renderPosts(currentPage);
    renderPagination();
}

function updateActiveFiltersDisplay() {
    const activeFiltersDiv = document.getElementById('activeFilters');
    const activeFiltersText = document.getElementById('activeFiltersText');
    const clearGenreBtn = document.getElementById('clearGenreFilterBtn');
    
    let filters = [];
    
    if (selectedGenre) {
        filters.push(`Genre: <strong>${selectedGenre}</strong>`);
        clearGenreBtn.style.display = 'inline-block';
    } else {
        clearGenreBtn.style.display = 'none';
    }
    
    if (isSearching) {
        const searchInput = document.getElementById('searchInput');
        filters.push(`Search: <strong>"${searchInput.value}"</strong>`);
    }
    
    if (filters.length > 0) {
        activeFiltersText.innerHTML = `Active filters: ${filters.join(' • ')}`;
        activeFiltersDiv.style.display = 'block';
    } else {
        activeFiltersDiv.style.display = 'none';
    }
}

function applyFilters() {
    if (selectedGenre) {
        // Filter by genre
        filteredPosts = allPosts.filter(post => {
            if (!post.Genres) return false;
            const genres = post.Genres.split(',').map(g => g.trim());
            return genres.includes(selectedGenre);
        });
    } else {
        // No genre filter
        filteredPosts = allPosts;
    }
    
    // Apply search filter if active
    if (isSearching) {
        const searchInput = document.getElementById('searchInput');
        const searchTerm = searchInput.value.trim().toLowerCase();
        
        filteredPosts = filteredPosts.filter(post => {
            const title = post.Title?.toLowerCase() || '';
            const paragraph = post.Paragraph?.toLowerCase() || '';
            const genres = post.Genres?.toLowerCase() || '';
            
            return title.includes(searchTerm) || 
                   paragraph.includes(searchTerm) || 
                   genres.includes(searchTerm);
        });
    }
    
    currentPage = 1;
    renderPosts(currentPage);
    renderPagination();
    updateActiveFiltersDisplay();
}

// ==================== GENRES AND RATING FUNCTIONS ====================
function displayGenres(genresString) {
    const genresContainer = document.getElementById('genresContainer');
    const genresTags = document.getElementById('postGenres');
    
    if (!genresString || genresString.trim() === '') {
        genresContainer.style.display = 'none';
        return;
    }
    
    const genres = genresString.split(',').map(g => g.trim()).filter(g => g);
    
    if (genres.length === 0) {
        genresContainer.style.display = 'none';
        return;
    }
    
    genresTags.innerHTML = '';
    genres.forEach(genre => {
        const tag = document.createElement('span');
        tag.className = 'genre-tag';
        tag.textContent = genre;
        genresTags.appendChild(tag);
    });
    
    genresContainer.style.display = 'block';
}

function displayRating(rating) {
    const ratingContainer = document.getElementById('ratingContainer');
    const ratingStars = document.getElementById('postRatingStars');
    const ratingText = document.getElementById('postRatingText');
    
    if (!rating || parseFloat(rating) <= 0) {
        ratingContainer.style.display = 'none';
        return;
    }
    
    const numericRating = parseFloat(rating);
    
    // Create star display
    ratingStars.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('span');
        star.className = 'rating-star';
        if (i <= numericRating) {
            star.innerHTML = '<i class="fas fa-star"></i>';
            star.style.color = '#ffc107';
        } else if (i - 0.5 <= numericRating) {
            star.innerHTML = '<i class="fas fa-star-half-alt"></i>';
            star.style.color = '#ffc107';
        } else {
            star.innerHTML = '<i class="far fa-star"></i>';
            star.style.color = '#ccc';
        }
        ratingStars.appendChild(star);
    }
    
    ratingText.textContent = ` ${numericRating.toFixed(1)}/5`;
    ratingContainer.style.display = 'block';
}

// ==================== UPDATED SEARCH FUNCTIONALITY ====================
function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput.value.trim().toLowerCase();
    const clearBtn = document.querySelector('.search-clear');
    
    if (searchTerm === '') {
        clearSearch();
        return;
    }
    
    isSearching = true;
    currentPage = 1;
    
    const searchResultsDiv = document.getElementById('searchResults');
    const searchResultsText = document.getElementById('searchResultsText');
    
    // Apply both search and genre filters
    applyFilters();
    
    if (filteredPosts.length > 0) {
        searchResultsText.textContent = `Found ${filteredPosts.length} result(s) for "${searchTerm}"`;
    } else {
        searchResultsText.textContent = `No results found for "${searchTerm}"`;
    }
    
    searchResultsDiv.style.display = 'block';
    clearBtn.style.display = 'block';
    
    updateActiveFiltersDisplay();
}

function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchResultsDiv = document.getElementById('searchResults');
    const clearBtn = document.querySelector('.search-clear');
    
    searchInput.value = '';
    isSearching = false;
    
    searchResultsDiv.style.display = 'none';
    clearBtn.style.display = 'none';
    
    // Apply only genre filter if active
    applyFilters();
}

// ==================== AUTO REFRESH ====================
function startAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    autoRefreshInterval = setInterval(() => {
        checkForNewPosts();
    }, 30000);
}

async function checkForNewPosts() {
    try {
        console.log('Checking for new posts...');
        const res = await fetch(`${API_URL}?action=getPosts`);
        
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const newPosts = await res.json();
        
        if (newPosts.length > allPosts.length) {
            const newPostCount = newPosts.length - allPosts.length;
            console.log(`Found ${newPostCount} new posts`);
            showNewPostNotification(newPostCount);
            
            allPosts = newPosts.sort((a, b) => {
                try {
                    return new Date(b.CreatedAt) - new Date(a.CreatedAt);
                } catch (e) {
                    return 0;
                }
            });
            
            postsCache = allPosts;
            
            // Extract genres from new posts
            extractAllGenres();
            populateGenreDropdown();
            
            // Apply current filters
            applyFilters();
        }
        
    } catch (error) {
        console.error("Error checking for new posts:", error);
    }
}

function showNewPostNotification(count) {
    const existingNotifs = document.querySelectorAll('.new-post-notification');
    existingNotifs.forEach(notif => notif.remove());
    
    const notification = document.createElement('div');
    notification.className = 'new-post-notification alert alert-info alert-dismissible fade show position-fixed';
    notification.style.top = '80px';
    notification.style.right = '20px';
    notification.style.zIndex = '9999';
    notification.style.minWidth = '300px';
    notification.innerHTML = `
        <i class="fas fa-bell me-2"></i>
        <strong>${count} new post${count > 1 ? 's' : ''} available!</strong>
        <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
        <div class="mt-2">
            <button class="btn btn-sm btn-light" onclick="refreshPosts()">Refresh Now</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function refreshPosts() {
    loadPosts();
    const notifications = document.querySelectorAll('.new-post-notification');
    notifications.forEach(notif => notif.remove());
}

// ==================== PAGE MANAGEMENT ====================
function checkPageType() {
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('post');
    const page = parseInt(urlParams.get('page')) || 1;
    
    currentPage = page;
    
    if (postId) {
        document.getElementById('mainPage').style.display = 'none';
        document.getElementById('singlePostPage').style.display = 'block';
        loadSinglePost(postId);
        
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }
    } else {
        document.getElementById('mainPage').style.display = 'block';
        document.getElementById('singlePostPage').style.display = 'none';
        loadPosts();
        startAutoRefresh();
    }
}

async function loadPosts() {
    try {
        const list = document.getElementById("postList");
        
        list.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
            <p class="mt-3 text-white">Loading posts...</p>
        </div>
        `;
        
        console.log('Fetching posts from:', `${API_URL}?action=getPosts`);
        const res = await fetch(`${API_URL}?action=getPosts`);
        
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        console.log('Received posts:', data.length);
        
        allPosts = data;
        
        allPosts.sort((a, b) => {
            try {
                return new Date(b.CreatedAt) - new Date(a.CreatedAt);
            } catch (e) {
                console.warn('Date parsing error:', e);
                return 0;
            }
        });
        
        postsCache = allPosts;
        
        if (allPosts.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
            <i class="fas fa-inbox fa-3x mb-4"></i>
            <h3>No posts available</h3>
            <p class="mb-4">Check back later for new content.</p>
            <button class="btn btn-primary btn-custom btn-primary-custom" onclick="loadPosts()">
                <i class="fas fa-redo me-2"></i>Refresh
            </button>
            </div>
        `;
        document.getElementById('pagination').style.display = 'none';
        return;
        }
        
        // Extract genres and populate dropdown
        extractAllGenres();
        populateGenreDropdown();
        
        // Apply any existing filters
        applyFilters();
        
        renderPosts(currentPage);
        renderPagination();

    } catch (error) {
        console.error("Error loading posts:", error);
        const list = document.getElementById("postList");
        list.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-triangle fa-3x mb-4"></i>
            <h3>Error loading posts</h3>
            <p class="mb-3">${error.message}</p>
            <button class="btn btn-primary btn-custom btn-primary-custom" onclick="loadPosts()">
            <i class="fas fa-redo me-2"></i>Try Again
            </button>
        </div>
        `;
        document.getElementById('pagination').style.display = 'none';
    }
}

function createTextPreview(html, maxLines = 3) {
    if (!html) return '';
    
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    const text = temp.textContent || temp.innerText || '';
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const previewLines = lines.slice(0, maxLines);
    
    const preview = previewLines.join(' ');
    
    if (preview.length > 150) {
        return preview.substring(0, 147) + '...';
    }
    
    return preview;
}

// ==================== UPDATED RENDER POSTS FUNCTION ====================
function renderPosts(page) {
    const list = document.getElementById("postList");
    list.innerHTML = "";
    
    const postsToShow = filteredPosts;
    const startIndex = (page - 1) * postsPerPage;
    const endIndex = Math.min(startIndex + postsPerPage, postsToShow.length);
    const pagePosts = postsToShow.slice(startIndex, endIndex);

    if (pagePosts.length === 0 && page > 1) {
        currentPage = 1;
        renderPosts(1);
        return;
    }

    if (pagePosts.length === 0) {
        if (isSearching || selectedGenre) {
            let message = '';
            if (isSearching && selectedGenre) {
                message = 'No posts match both your search term and selected genre.';
            } else if (isSearching) {
                message = 'No results found for your search term.';
            } else if (selectedGenre) {
                message = `No posts found in the "${selectedGenre}" genre.`;
            }
            
            list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search fa-3x mb-4"></i>
                <h3>No results found</h3>
                <p>${message}</p>
                <button class="btn btn-primary btn-custom btn-primary-custom mt-3" onclick="clearAllFilters()">
                    <i class="fas fa-times me-2"></i>Clear All Filters
                </button>
            </div>
            `;
        } else {
            list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <h3>No posts on this page</h3>
                <p>Try going back to page 1.</p>
            </div>
            `;
        }
        return;
    }

    pagePosts.forEach((post, index) => {
        const col = document.createElement("div");
        col.className = "col-lg-3 col-md-6 post-col";
        col.style.animationDelay = `${index * 0.1}s`;
        
        const textPreview = createTextPreview(post.Paragraph, 3);
        
        let displayDate = post.CreatedAt;
        try {
            const date = new Date(post.CreatedAt);
            if (!isNaN(date.getTime())) {
                displayDate = date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
            }
        } catch (e) {
            console.warn('Date formatting error:', e);
        }
        
        // Create genre badges
        let genreBadges = '';
        if (post.Genres) {
            const genres = post.Genres.split(',').map(g => g.trim()).filter(g => g);
            genres.slice(0, 2).forEach(genre => {
                genreBadges += `<span class="genre-badge">${genre}</span>`;
            });
            if (genres.length > 2) {
                genreBadges += `<span class="genre-badge">+${genres.length - 2}</span>`;
            }
        }
        
        // Create rating stars
        let ratingStars = '';
        if (post.Rating && parseFloat(post.Rating) > 0) {
            const rating = parseFloat(post.Rating);
            ratingStars = '<div class="rating-mini">';
            for (let i = 1; i <= 5; i++) {
                if (i <= rating) {
                    ratingStars += '<i class="fas fa-star"></i>';
                } else if (i - 0.5 <= rating) {
                    ratingStars += '<i class="fas fa-star-half-alt"></i>';
                } else {
                    ratingStars += '<i class="far fa-star"></i>';
                }
            }
            ratingStars += ` <span class="rating-text">${rating.toFixed(1)}</span>`;
            ratingStars += '</div>';
        }
        
        col.innerHTML = `
        <div class="post-card">
            <img src="${post.ImageURL || 'https://via.placeholder.com/400x300?text=No+Image'}" 
                class="post-img" 
                alt="${post.Title || 'Post Image'}"
                onerror="this.src='https://via.placeholder.com/400x300?text=Image+Error'">
            <div class="card-body">
                <h5 class="post-title">${post.Title || 'Untitled Post'}</h5>
                
                ${ratingStars ? `
                <div class="post-rating mb-2">
                    ${ratingStars}
                </div>
                ` : ''}
                
                ${genreBadges ? `
                <div class="post-genres mb-2">
                    ${genreBadges}
                </div>
                ` : ''}
                
                <div class="truncate">${textPreview || 'No content available'}</div>
                <div class="post-meta">
                    <i class="far fa-calendar me-1"></i> ${displayDate}
                </div>
                <div class="d-flex flex-wrap gap-2">
                    <a href="?post=${post.ID}" class="btn btn-primary btn-custom btn-primary-custom btn-sm">
                    <i class="fas fa-play-circle me-1"></i>Watch Now
                    </a>
                    <button class="btn btn-secondary btn-custom btn-secondary-custom btn-sm" onclick="sharePost('${post.ID}')">
                    <i class="fas fa-share-alt me-1"></i>Share
                    </button>
                </div>
            </div>
        </div>
        `;
        list.appendChild(col);
    });
}

function renderPagination() {
    const pagination = document.getElementById("pagination");
    const postsToShow = filteredPosts;
    
    if (postsToShow.length <= postsPerPage) {
        pagination.style.display = "none";
        return;
    }
    
    pagination.style.display = "flex";
    const totalPages = Math.ceil(postsToShow.length / postsPerPage);
    
    if (currentPage > totalPages) {
        currentPage = totalPages;
    }
    if (currentPage < 1) {
        currentPage = 1;
    }
    
    const paginationList = document.querySelector("#pagination .pagination");
    if (!paginationList) return;
    
    paginationList.innerHTML = "";
    
    // Previous button
    const prevItem = document.createElement("li");
    prevItem.className = `page-item ${currentPage === 1 ? "disabled" : ""}`;
    prevItem.innerHTML = `
        <a class="page-link pagination-btn" href="#" data-page="prev">
            <i class="fas fa-chevron-left"></i> Previous
        </a>
    `;
    paginationList.appendChild(prevItem);
    
    // Calculate page range to show
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }
    
    // First page if not in range
    if (startPage > 1) {
        const firstPageItem = document.createElement("li");
        firstPageItem.className = "page-item";
        firstPageItem.innerHTML = `
            <a class="page-link pagination-btn" href="#" data-page="1">1</a>
        `;
        paginationList.appendChild(firstPageItem);
        
        if (startPage > 2) {
            const ellipsisItem = document.createElement("li");
            ellipsisItem.className = "page-item disabled";
            ellipsisItem.innerHTML = `<span class="page-link">...</span>`;
            paginationList.appendChild(ellipsisItem);
        }
    }
    
    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        const pageItem = document.createElement("li");
        pageItem.className = `page-item ${i === currentPage ? "active" : ""}`;
        pageItem.innerHTML = `
            <a class="page-link pagination-btn" href="#" data-page="${i}">${i}</a>
        `;
        paginationList.appendChild(pageItem);
    }
    
    // Last page if not in range
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsisItem = document.createElement("li");
            ellipsisItem.className = "page-item disabled";
            ellipsisItem.innerHTML = `<span class="page-link">...</span>`;
            paginationList.appendChild(ellipsisItem);
        }
        
        const lastPageItem = document.createElement("li");
        lastPageItem.className = "page-item";
        lastPageItem.innerHTML = `
            <a class="page-link pagination-btn" href="#" data-page="${totalPages}">${totalPages}</a>
        `;
        paginationList.appendChild(lastPageItem);
    }
    
    // Next button
    const nextItem = document.createElement("li");
    nextItem.className = `page-item ${currentPage === totalPages ? "disabled" : ""}`;
    nextItem.innerHTML = `
        <a class="page-link pagination-btn" href="#" data-page="next">
            Next <i class="fas fa-chevron-right"></i>
        </a>
    `;
    paginationList.appendChild(nextItem);
    
    document.querySelectorAll(".pagination-btn").forEach(btn => {
        btn.addEventListener("click", function(e) {
            e.preventDefault();
            const page = this.getAttribute("data-page");
            navigateToPage(page);
        });
    });
}

function navigateToPage(page) {
    if (page === "prev") {
        if (currentPage > 1) {
            currentPage--;
        }
    } else if (page === "next") {
        const postsToShow = filteredPosts;
        const totalPages = Math.ceil(postsToShow.length / postsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
        }
    } else {
        currentPage = parseInt(page);
    }
    
    const url = new URL(window.location);
    url.searchParams.set('page', currentPage);
    window.history.pushState({}, '', url);
    
    renderPosts(currentPage);
    renderPagination();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==================== SINGLE POST FUNCTIONS ====================
function loadSinglePost(postId) {
    const post = postsCache.find(p => p.ID == postId);
    
    if (!post) {
        fetch(`${API_URL}?action=getPosts`)
        .then(res => res.json())
        .then(posts => {
            postsCache = posts.sort((a, b) => {
                try {
                    return new Date(b.CreatedAt) - new Date(a.CreatedAt);
                } catch (e) {
                    return 0;
                }
            });
            const foundPost = posts.find(p => p.ID == postId);
            if (foundPost) {
            displaySinglePost(foundPost);
            } else {
            showPostNotFound();
            }
        })
        .catch(error => {
            console.error("Error loading post:", error);
            showPostNotFound();
        });
    } else {
        displaySinglePost(post);
    }
}

function showPostNotFound() {
    document.getElementById('singlePostPage').innerHTML = `
        <div class="container my-5">
        <div class="single-post-container text-center py-5">
            <i class="fas fa-exclamation-triangle fa-4x text-warning mb-4"></i>
            <h2>Post Not Found</h2>
            <p class="mb-4">The post you're looking for doesn't exist or has been removed.</p>
            <a href="?" class="btn btn-primary btn-custom btn-primary-custom">
            <i class="fas fa-arrow-left me-2"></i>Back to Posts
            </a>
        </div>
        </div>
    `;
}

function displaySinglePost(post) {
    document.getElementById('singlePostTitle').textContent = post.Title || 'Untitled Post';
    
    let displayDate = post.CreatedAt;
    try {
        const date = new Date(post.CreatedAt);
        if (!isNaN(date.getTime())) {
            displayDate = date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    } catch (e) {
        console.warn('Date formatting error:', e);
    }
    
    document.getElementById('singlePostDate').textContent = `Posted on: ${displayDate}`;
    
    const imageElement = document.getElementById('singlePostImage');
    imageElement.src = post.ImageURL || 'https://via.placeholder.com/800x400?text=No+Image';
    imageElement.alt = post.Title || 'Post Image';
    imageElement.onerror = function() {
        this.src = 'https://via.placeholder.com/800x400?text=Image+Error';
    };
    
    document.getElementById('singlePostContent').innerHTML = post.Paragraph || '<p>No content available.</p>';
    
    // Display genres and rating
    displayGenres(post.Genres);
    displayRating(post.Rating);
    
    // Handle trailer link
    const trailerBtn = document.getElementById('singlePostTrailerBtn');
    if (post.TrailerLink && post.TrailerLink.trim() !== '') {
        currentTrailerLink = post.TrailerLink;
        trailerBtn.style.display = "inline-block";
    } else {
        currentTrailerLink = '';
        trailerBtn.style.display = "none";
    }
    
    // Handle watch button
    const watchBtn = document.getElementById('singlePostWatch');
    if (post.DownloadLink && post.DownloadLink.trim() !== '') {
        watchBtn.style.display = "inline-block";
        watchBtn.href = post.DownloadLink;
    } else {
        watchBtn.style.display = "none";
    }
    
    document.getElementById('trailerContainer').style.display = 'none';
    document.title = `${post.Title || 'Post'} - M-Movie`;
}

// ==================== SHARE FUNCTIONS ====================
function sharePost(postId) {
    const post = postsCache.find(p => p.ID == postId);
    if (!post) return;
    
    const shareUrl = `${window.location.origin}${window.location.pathname}?post=${postId}`;

    if (navigator.share) {
        navigator.share({
        title: post.Title || 'M-Movie',
        text: stripHtml(post.Paragraph).substring(0, 100) + "...",
        url: shareUrl
        });
    } else {
        navigator.clipboard.writeText(shareUrl).then(() => {
        showNotification('Link copied to clipboard!', 'success');
        }).catch(() => {
        prompt("Copy this link to share:", shareUrl);
        });
    }
}

function stripHtml(html) {
    if (!html) return '';
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
}

function shareCurrentPost() {
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('post');
    
    if (postId) {
        sharePost(postId);
    }
}

// ==================== UTILITY FUNCTIONS ====================
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} position-fixed`;
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.zIndex = '9999';
    notification.style.minWidth = '300px';
    notification.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
        <span>${message}</span>
        <button type="button" class="btn-close" onclick="this.parentElement.parentElement.remove()"></button>
        </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
        notification.remove();
        }
    }, 3000);
}

// ==================== UPDATED INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    // Add Enter key support for search
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
    
    checkPageType();
    
    window.addEventListener('popstate', function() {
        const urlParams = new URLSearchParams(window.location.search);
        const page = parseInt(urlParams.get('page')) || 1;
        const postId = urlParams.get('post');
        
        if (postId) {
        document.getElementById('mainPage').style.display = 'none';
        document.getElementById('singlePostPage').style.display = 'block';
        loadSinglePost(postId);
        
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }
        } else {
        currentPage = page;
        document.getElementById('mainPage').style.display = 'block';
        document.getElementById('singlePostPage').style.display = 'none';
        renderPosts(currentPage);
        renderPagination();
        startAutoRefresh();
        }
    });
    
    document.addEventListener('click', function(event) {
        const trailerContainer = document.getElementById('trailerContainer');
        const trailerBtn = document.getElementById('singlePostTrailerBtn');
        
        if (trailerContainer.style.display === 'block' && 
            !trailerContainer.contains(event.target) && 
            event.target !== trailerBtn) {
            closeTrailer();
        }
    });
});

window.addEventListener('beforeunload', function() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    if (youtubePlayer && youtubePlayer.destroy) {
        youtubePlayer.destroy();
    }

});
