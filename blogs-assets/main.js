const API_URL = "https://script.google.com/macros/s/AKfycbyEHRDgn3RSRJJoV5537TjotyVju0PnWabYRVzI8L0Kvpb47baVwmdw_Cxo40EdmmAaWA/exec";
let postsCache = [];
let allPosts = [];
let filteredPosts = [];
let isSearching = false;
let currentPage = 1;
const postsPerPage = 12;
let autoRefreshInterval;
let currentTrailerLink = '';
let youtubePlayer = null;

// YouTube Player Management
function onYouTubeIframeAPIReady() {
    // YouTube API loaded
    console.log('YouTube API ready');
}

function showTrailer() {
    if (!currentTrailerLink) return;
    
    const trailerContainer = document.getElementById('trailerContainer');
    const trailerVideoDiv = document.getElementById('trailerVideo');
    
    // Extract YouTube video ID from different URL formats
    let videoId = extractYouTubeVideoId(currentTrailerLink);
    
    if (!videoId) {
        // If not a YouTube link, use iframe with the provided URL
        trailerVideoDiv.innerHTML = `
            <iframe 
                src="${currentTrailerLink}" 
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen>
            </iframe>
        `;
    } else {
        // Create YouTube player
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
    
    // Scroll to trailer section
    trailerContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Hide the trailer button and show close button
    document.getElementById('singlePostTrailerBtn').style.display = 'none';
}

function closeTrailer() {
    const trailerContainer = document.getElementById('trailerContainer');
    const trailerVideoDiv = document.getElementById('trailerVideo');
    
    // Stop video if it's playing
    if (youtubePlayer && youtubePlayer.stopVideo) {
        youtubePlayer.stopVideo();
    }
    
    // Clear iframe content
    trailerVideoDiv.innerHTML = '';
    
    trailerContainer.style.display = 'none';
    
    // Show trailer button again
    document.getElementById('singlePostTrailerBtn').style.display = 'inline-block';
}

function onPlayerReady(event) {
    console.log('YouTube player ready');
}

function onPlayerStateChange(event) {
    // Optional: Handle player state changes
    console.log('Player state changed:', event.data);
}

// Extract YouTube video ID from URL
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

// Search functionality
function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput.value.trim().toLowerCase();
    const clearBtn = document.querySelector('.search-clear');
    
    if (searchTerm === '') {
        clearSearch();
        return;
    }
    
    filteredPosts = allPosts.filter(post => {
        const title = post.Title?.toLowerCase() || '';
        const paragraph = post.Paragraph?.toLowerCase() || '';
        
        return title.includes(searchTerm) || paragraph.includes(searchTerm);
    });
    
    isSearching = true;
    currentPage = 1;
    
    // Show search results indicator
    const searchResultsDiv = document.getElementById('searchResults');
    const searchResultsText = document.getElementById('searchResultsText');
    
    if (filteredPosts.length > 0) {
        searchResultsText.textContent = `Found ${filteredPosts.length} result(s) for "${searchTerm}"`;
    } else {
        searchResultsText.textContent = `No results found for "${searchTerm}"`;
    }
    
    searchResultsDiv.style.display = 'block';
    clearBtn.style.display = 'block';
    
    renderPosts(currentPage);
    renderPagination();
}

function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchResultsDiv = document.getElementById('searchResults');
    const clearBtn = document.querySelector('.search-clear');
    
    searchInput.value = '';
    isSearching = false;
    currentPage = 1;
    
    searchResultsDiv.style.display = 'none';
    clearBtn.style.display = 'none';
    
    renderPosts(currentPage);
    renderPagination();
}

// Enter key support for search
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
});

// Auto refresh functionality
function startAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    // Check for new posts every 30 seconds
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
        
        // Check if there are new posts
        if (newPosts.length > allPosts.length) {
            const newPostCount = newPosts.length - allPosts.length;
            console.log(`Found ${newPostCount} new posts`);
            showNewPostNotification(newPostCount);
            
            // Update and sort by latest
            allPosts = newPosts.sort((a, b) => {
                try {
                    return new Date(b.CreatedAt) - new Date(a.CreatedAt);
                } catch (e) {
                    return 0;
                }
            });
            
            postsCache = allPosts;
            
            // If currently searching, re-apply search
            if (isSearching) {
                const searchInput = document.getElementById('searchInput');
                const searchTerm = searchInput.value.trim().toLowerCase();
                if (searchTerm) {
                    performSearch();
                } else {
                    renderPosts(currentPage);
                    renderPagination();
                }
            } else {
                renderPosts(currentPage);
                renderPagination();
            }
        }
        
    } catch (error) {
        console.error("Error checking for new posts:", error);
    }
}

function showNewPostNotification(count) {
    // Remove existing notifications
    const existingNotifs = document.querySelectorAll('.new-post-notification');
    existingNotifs.forEach(notif => notif.remove());
    
    // Create a subtle notification
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
    
    // Auto remove after 5 seconds
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

// Check if we're on a single post page
function checkPageType() {
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('post');
    const page = parseInt(urlParams.get('page')) || 1;
    
    currentPage = page;
    
    if (postId) {
        // We're on a single post page - disable auto refresh
        document.getElementById('mainPage').style.display = 'none';
        document.getElementById('singlePostPage').style.display = 'block';
        loadSinglePost(postId);
        
        // Stop auto refresh
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }
    } else {
        // We're on the main page - enable auto refresh
        document.getElementById('mainPage').style.display = 'block';
        document.getElementById('singlePostPage').style.display = 'none';
        loadPosts();
        startAutoRefresh();
    }
}

async function loadPosts() {
    try {
        const list = document.getElementById("postList");
        
        // Show loading spinner
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
        
        // Sort posts by date (newest first)
        allPosts.sort((a, b) => {
            try {
                return new Date(b.CreatedAt) - new Date(a.CreatedAt);
            } catch (e) {
                console.warn('Date parsing error:', e);
                return 0;
            }
        });
        
        postsCache = allPosts; // Keep backup for single post view
        
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

// Enhanced function to strip HTML and create plain text preview
function createTextPreview(html, maxLines = 3) {
    if (!html) return '';
    
    // Create temporary element to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Get plain text
    const text = temp.textContent || temp.innerText || '';
    
    // Split into lines and take first maxLines
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const previewLines = lines.slice(0, maxLines);
    
    const preview = previewLines.join(' ');
    
    // If text is too long, truncate it
    if (preview.length > 150) {
        return preview.substring(0, 147) + '...';
    }
    
    return preview;
}

function renderPosts(page) {
    const list = document.getElementById("postList");
    list.innerHTML = "";
    
    // Determine which posts to show
    const postsToShow = isSearching ? filteredPosts : allPosts;
    
    // Calculate start and end indices
    const startIndex = (page - 1) * postsPerPage;
    const endIndex = Math.min(startIndex + postsPerPage, postsToShow.length);
    const pagePosts = postsToShow.slice(startIndex, endIndex);

    if (pagePosts.length === 0 && page > 1) {
        currentPage = 1;
        renderPosts(1);
        return;
    }

    if (pagePosts.length === 0) {
        if (isSearching) {
        list.innerHTML = `
            <div class="empty-state">
            <i class="fas fa-search fa-3x mb-4"></i>
            <h3>No results found</h3>
            <p>Try a different search term or clear the search.</p>
            <button class="btn btn-primary btn-custom btn-primary-custom mt-3" onclick="clearSearch()">
                <i class="fas fa-times me-2"></i>Clear Search
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
        
        // Create text preview for main page
        const textPreview = createTextPreview(post.Paragraph, 3);
        
        // Format date for display
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
        
        col.innerHTML = `
        <div class="post-card">
            <img src="${post.ImageURL || 'https://via.placeholder.com/400x300?text=No+Image'}" 
                class="post-img" 
                alt="${post.Title || 'Post Image'}"
                onerror="this.src='https://via.placeholder.com/400x300?text=Image+Error'">
            <div class="card-body">
            <h5 class="post-title">${post.Title || 'Untitled Post'}</h5>
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
    const postsToShow = isSearching ? filteredPosts : allPosts;
    
    if (postsToShow.length <= postsPerPage) {
        pagination.style.display = "none";
        return;
    }
    
    pagination.style.display = "flex";
    const totalPages = Math.ceil(postsToShow.length / postsPerPage);
    
    // Ensure current page is valid
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
    
    // Add event listeners
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
        const postsToShow = isSearching ? filteredPosts : allPosts;
        const totalPages = Math.ceil(postsToShow.length / postsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
        }
    } else {
        currentPage = parseInt(page);
    }
    
    // Update URL without reloading the page
    const url = new URL(window.location);
    url.searchParams.set('page', currentPage);
    window.history.pushState({}, '', url);
    
    renderPosts(currentPage);
    renderPagination();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function loadSinglePost(postId) {
    const post = postsCache.find(p => p.ID == postId);
    
    if (!post) {
        // If post not in cache, try to fetch it
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
    
    // Format date for display
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
    
    // Display full HTML content in single post page
    document.getElementById('singlePostContent').innerHTML = post.Paragraph || '<p>No content available.</p>';
    
    // Store trailer link and show button if exists
    const trailerBtn = document.getElementById('singlePostTrailerBtn');
    if (post.TrailerLink && post.TrailerLink.trim() !== '') {
        currentTrailerLink = post.TrailerLink;
        trailerBtn.style.display = "inline-block";
    } else {
        currentTrailerLink = '';
        trailerBtn.style.display = "none";
    }
    
    // Show Watch Now button if download link exists
    const watchBtn = document.getElementById('singlePostWatch');
    if (post.DownloadLink && post.DownloadLink.trim() !== '') {
        watchBtn.style.display = "inline-block";
        watchBtn.href = post.DownloadLink;
    } else {
        watchBtn.style.display = "none";
    }
    
    // Hide trailer container initially
    document.getElementById('trailerContainer').style.display = 'none';
    
    // Update page title
    document.title = `${post.Title || 'Post'} - M-Movie`;
}

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

// Helper function to strip HTML tags for sharing
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

// Simple notification function
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

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    checkPageType();
    
    // Handle browser back/forward buttons
    window.addEventListener('popstate', function() {
        const urlParams = new URLSearchParams(window.location.search);
        const page = parseInt(urlParams.get('page')) || 1;
        const postId = urlParams.get('post');
        
        if (postId) {
        // Single post page
        document.getElementById('mainPage').style.display = 'none';
        document.getElementById('singlePostPage').style.display = 'block';
        loadSinglePost(postId);
        
        // Stop auto refresh
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }
        } else {
        // Main page
        currentPage = page;
        document.getElementById('mainPage').style.display = 'block';
        document.getElementById('singlePostPage').style.display = 'none';
        renderPosts(currentPage);
        renderPagination();
        startAutoRefresh();
        }
    });
    
    // Close trailer when clicking outside
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

// Clean up interval when page is closed
window.addEventListener('beforeunload', function() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    // Clean up YouTube player
    if (youtubePlayer && youtubePlayer.destroy) {
        youtubePlayer.destroy();
    }
});