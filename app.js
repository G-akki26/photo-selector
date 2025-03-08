// Create a thumbnail canvas for optimization
const thumbnailCanvas = document.createElement('canvas');
const thumbnailCtx = thumbnailCanvas.getContext('2d');
thumbnailCanvas.width = 100;  // Thumbnail width
thumbnailCanvas.height = 100; // Thumbnail height

// State management
const state = {
    currentIndex: 0,
    mediaFiles: [],
    decisions: {
        accepted: new Set(),
        rejected: new Set(),
        held: new Set()
    },
    tags: new Map(), // Map of file paths to array of tags
    currentFilter: 'all',
    thumbnailBatchSize: 20,
    loadedThumbnails: new Set(),
    lastSavedTimestamp: null,
    currentFolderPath: null,
    zoom: {
        level: 1,
        isDragging: false,
        startX: 0,
        startY: 0,
        translateX: 0,
        translateY: 0
    },
    isLoading: false
};

// DOM Elements
const elements = {
    currentMedia: document.getElementById('currentMedia'),
    selectFolder: document.getElementById('selectFolder'),
    exportAccepted: document.getElementById('exportAccepted'),
    thumbnailStrip: document.querySelector('.thumbnail-strip'),
    mediaContainer: document.querySelector('.media-container'),
    sidebar: document.querySelector('.sidebar'),
    sidebarToggle: document.querySelector('.sidebar-toggle'),
    filterButtons: document.querySelectorAll('.filter-btn'),
    stats: {
        accepted: document.getElementById('acceptedCount'),
        rejected: document.getElementById('rejectedCount'),
        held: document.getElementById('heldCount'),
        remaining: document.getElementById('remainingCount')
    },
    progressCircle: document.querySelector('.circle'),
    progressText: document.querySelector('.progress-text'),
    thumbnailLoading: document.querySelector('.thumbnail-loading'),
    imageControls: {
        zoomIn: document.getElementById('zoomIn'),
        zoomOut: document.getElementById('zoomOut'),
        fitView: document.getElementById('fitView'),
        fullScreen: document.getElementById('fullScreen')
    },
    saveButton: document.getElementById('saveProgress'),
    imageStatus: document.getElementById('imageStatus'),
    tagSelector: document.getElementById('tagSelector'),
    statsBar: document.querySelector('.stats-bar'),
    navigation: {
        prev: document.getElementById('prevImage'),
        next: document.getElementById('nextImage')
    }
};

// Initialize the application
function initializeApp() {
    // Bind event listeners
    elements.selectFolder.addEventListener('click', handleFolderSelect);
    elements.exportAccepted.addEventListener('click', handleExport);
    elements.sidebarToggle.addEventListener('click', toggleSidebar);

    // Action buttons
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.classList.contains('accept')) makeDecision('accepted');
            if (btn.classList.contains('reject')) makeDecision('rejected');
            if (btn.classList.contains('hold')) makeDecision('held');
        });
    });

    // Filter buttons
    elements.filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.dataset.filter;
            applyFilter(filter);
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyPress);

    // Infinite scroll for thumbnail strip
    elements.thumbnailStrip.addEventListener('scroll', debounce(handleThumbnailScroll, 150));

    // Restore sidebar state
    const sidebarState = localStorage.getItem('sidebarCollapsed');
    if (sidebarState === 'true') {
        elements.sidebar.classList.add('collapsed');
        elements.sidebarToggle.querySelector('.material-icons').style.transform = 'rotate(180deg)';
    }

    // Auto-save progress periodically
    setInterval(saveProgress, 30000); // Save every 30 seconds

    // Save progress before user leaves
    window.addEventListener('beforeunload', (e) => {
        saveProgress();
        if (hasUnsavedChanges()) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // Check for saved progress
    checkForSavedProgress();

    // Add zoom control listeners
    elements.imageControls.zoomIn.addEventListener('click', () => adjustZoom(0.2));
    elements.imageControls.zoomOut.addEventListener('click', () => adjustZoom(-0.2));
    elements.imageControls.fitView.addEventListener('click', resetZoom);
    elements.imageControls.fullScreen.addEventListener('click', toggleFullscreen);

    // Add image drag support
    elements.currentMedia.addEventListener('mousedown', startDragging);
    document.addEventListener('mousemove', handleDragging);
    document.addEventListener('mouseup', stopDragging);
    elements.currentMedia.addEventListener('wheel', handleZoomWheel);

    // Add save button listener
    elements.saveButton.addEventListener('click', () => {
        saveProgress();
        showNotification('Progress saved manually');
    });

    // Add tag button listeners
    elements.tagSelector.querySelectorAll('.tag-btn').forEach(btn => {
        btn.addEventListener('click', () => toggleTag(btn.dataset.tag));
    });

    // Auto-save every minute
    setInterval(saveProgress, 60000);

    // Add navigation button listeners
    elements.navigation.prev.addEventListener('click', () => navigateImages('prev'));
    elements.navigation.next.addEventListener('click', () => navigateImages('next'));
}

// Toggle sidebar
function toggleSidebar() {
    elements.sidebar.classList.toggle('collapsed');
    const isCollapsed = elements.sidebar.classList.contains('collapsed');
    localStorage.setItem('sidebarCollapsed', isCollapsed);
    
    // Update the toggle button icon
    const icon = elements.sidebarToggle.querySelector('.material-icons');
    icon.style.transform = isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
}

// Handle folder selection
async function handleFolderSelect() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*';
    input.webkitdirectory = true;

    input.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files).filter(file => 
            file.type.startsWith('image/')
        ).sort((a, b) => a.name.localeCompare(b.name));

        if (files.length === 0) return;

        state.mediaFiles = files;
        state.currentIndex = 0;
        state.loadedThumbnails.clear();
        state.currentFolderPath = files[0].webkitRelativePath.split('/')[0];
        resetDecisions();
        await initializeGallery();
        updateFilterCounts();
        showCurrentMedia(); // Ensure first image is shown
    });

    input.click();
}

// Initialize gallery
async function initializeGallery() {
    elements.thumbnailStrip.innerHTML = '';
    await loadThumbnails(0);
    showCurrentMedia();
    updateStats();
}

// Get filtered files
function getFilteredFiles() {
    switch (state.currentFilter) {
        case 'accepted':
            return state.mediaFiles.filter(file => state.decisions.accepted.has(file));
        case 'rejected':
            return state.mediaFiles.filter(file => state.decisions.rejected.has(file));
        case 'held':
            return state.mediaFiles.filter(file => state.decisions.held.has(file));
        case 'unprocessed':
            return state.mediaFiles.filter(file => 
                !state.decisions.accepted.has(file) &&
                !state.decisions.rejected.has(file) &&
                !state.decisions.held.has(file)
            );
        default:
            return state.mediaFiles;
    }
}

// Apply filter
function applyFilter(filter) {
    state.currentFilter = filter;
    
    // Update active state
    elements.filterButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    // Clear and reload thumbnails
    elements.thumbnailStrip.innerHTML = '';
    state.loadedThumbnails.clear();
    loadThumbnails(0);

    // Show first image from filtered set
    const filteredFiles = getFilteredFiles();
    if (filteredFiles.length > 0) {
        state.currentIndex = state.mediaFiles.indexOf(filteredFiles[0]);
        showCurrentMedia();
    }
}

// Update filter counts
function updateFilterCounts() {
    const counts = {
        all: state.mediaFiles.length,
        accepted: state.decisions.accepted.size,
        rejected: state.decisions.rejected.size,
        held: state.decisions.held.size,
        unprocessed: state.mediaFiles.length - 
            (state.decisions.accepted.size + 
             state.decisions.rejected.size + 
             state.decisions.held.size)
    };

    elements.filterButtons.forEach(btn => {
        const count = btn.querySelector('.count');
        if (count) {
            count.textContent = counts[btn.dataset.filter];
        }
    });
}

// Load thumbnails with lazy loading
async function loadThumbnails(startIndex) {
    if (state.isLoading) return;
    
    const filteredFiles = getFilteredFiles();
    if (startIndex >= filteredFiles.length) {
        elements.thumbnailLoading.classList.remove('visible');
        return;
    }

    state.isLoading = true;
    elements.thumbnailLoading.classList.add('visible');

    const endIndex = Math.min(startIndex + state.thumbnailBatchSize, filteredFiles.length);
    const fragment = document.createDocumentFragment();

    for (let i = startIndex; i < endIndex; i++) {
        const file = filteredFiles[i];
        if (!state.loadedThumbnails.has(file)) {
            const thumbnail = await createThumbnail(file);
            fragment.appendChild(thumbnail);
            state.loadedThumbnails.add(file);
        }
    }

    elements.thumbnailStrip.appendChild(fragment);
    state.isLoading = false;
    elements.thumbnailLoading.classList.remove('visible');

    // If we're close to the end, load more
    if (endIndex < filteredFiles.length) {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                observer.disconnect();
                loadThumbnails(endIndex);
            }
        });

        observer.observe(elements.thumbnailStrip.lastElementChild);
    }
}

// Create thumbnail element
async function createThumbnail(file) {
    const thumbnail = document.createElement('div');
    thumbnail.className = 'thumbnail loading';
    
    const fileIndex = state.mediaFiles.indexOf(file);
    thumbnail.dataset.index = fileIndex;

    const img = document.createElement('img');
    img.loading = 'lazy';
    
    // First load a tiny thumbnail
    const tinyUrl = await createThumbnailUrl(file, 20, 0.1);
    img.src = tinyUrl;

    // Then load better quality version
    const betterUrl = await createThumbnailUrl(file, 100, 0.6);
    const betterImg = new Image();
    betterImg.onload = () => {
        img.src = betterUrl;
        thumbnail.classList.remove('loading');
    };
    betterImg.src = betterUrl;
    
    thumbnail.appendChild(img);
    thumbnail.addEventListener('click', () => {
        state.currentIndex = fileIndex;
        showCurrentMedia();
    });

    updateThumbnailStatus(thumbnail, file);
    return thumbnail;
}

// Create thumbnail URL with specified size and quality
async function createThumbnailUrl(file, size, quality) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = size;
    canvas.height = size;

    const bitmap = await createImageBitmap(file);
    const aspectRatio = bitmap.width / bitmap.height;
    let targetWidth = canvas.width;
    let targetHeight = canvas.height;
    let offsetX = 0;
    let offsetY = 0;

    if (aspectRatio > 1) {
        targetHeight = canvas.height / aspectRatio;
        offsetY = (canvas.height - targetHeight) / 2;
    } else {
        targetWidth = canvas.width * aspectRatio;
        offsetX = (canvas.width - targetWidth) / 2;
    }

    ctx.drawImage(bitmap, offsetX, offsetY, targetWidth, targetHeight);
    return canvas.toDataURL('image/jpeg', quality);
}

// Show current media
async function showCurrentMedia() {
    const file = state.mediaFiles[state.currentIndex];
    if (!file) return;

    // Show loading state
    elements.mediaContainer.classList.add('loading');

    // Create a low-quality preview first
    const lowQualityUrl = await createThumbnailUrl(file, 400, 0.5);
    elements.currentMedia.src = lowQualityUrl;

    // Load full quality image
    const fullQualityUrl = URL.createObjectURL(file);
    const fullImg = new Image();
    fullImg.onload = () => {
        elements.currentMedia.src = fullQualityUrl;
        elements.mediaContainer.classList.remove('loading');
    };
    fullImg.src = fullQualityUrl;

    // Update thumbnails
    const thumbnails = elements.thumbnailStrip.children;
    Array.from(thumbnails).forEach(thumb => {
        thumb.classList.toggle('selected', 
            parseInt(thumb.dataset.index) === state.currentIndex
        );
    });

    // Scroll thumbnail into view
    const currentThumb = Array.from(thumbnails)
        .find(thumb => parseInt(thumb.dataset.index) === state.currentIndex);
    if (currentThumb) {
        currentThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Update image status
    updateImageStatus(file);

    // Update tags
    updateTagButtons(file);
}

// Make decision (accept/reject/hold)
function makeDecision(decision) {
    const file = state.mediaFiles[state.currentIndex];
    if (!file) return;

    // Remove from all sets
    Object.values(state.decisions).forEach(set => set.delete(file));
    
    // Add to appropriate set
    state.decisions[decision].add(file);

    // Update UI
    const thumbnails = elements.thumbnailStrip.children;
    const currentThumb = Array.from(thumbnails)
        .find(thumb => parseInt(thumb.dataset.index) === state.currentIndex);
    if (currentThumb) {
        updateThumbnailStatus(currentThumb, file);
    }
    
    updateStats();
    updateFilterCounts();

    // If in filtered view and current image no longer matches filter,
    // find next matching image
    const filteredFiles = getFilteredFiles();
    if (!filteredFiles.includes(file)) {
        const nextFile = filteredFiles.find(f => 
            state.mediaFiles.indexOf(f) > state.currentIndex
        );
        if (nextFile) {
            state.currentIndex = state.mediaFiles.indexOf(nextFile);
        }
    } else if (state.currentIndex < state.mediaFiles.length - 1) {
        state.currentIndex++;
    }

    showCurrentMedia();
}

// Update thumbnail status
function updateThumbnailStatus(thumbnail, file) {
    thumbnail.classList.remove('accepted', 'rejected', 'held');
    
    if (state.decisions.accepted.has(file)) {
        thumbnail.classList.add('accepted');
    } else if (state.decisions.rejected.has(file)) {
        thumbnail.classList.add('rejected');
    } else if (state.decisions.held.has(file)) {
        thumbnail.classList.add('held');
    }
}

// Update statistics
function updateStats() {
    const stats = {
        accepted: state.decisions.accepted.size,
        rejected: state.decisions.rejected.size,
        held: state.decisions.held.size
    };
    stats.remaining = state.mediaFiles.length - 
        (stats.accepted + stats.rejected + stats.held);

    Object.entries(stats).forEach(([key, value]) => {
        elements.stats[key].textContent = value;
    });

    // Update progress bar
    if (state.mediaFiles.length > 0) {
        const processed = stats.accepted + stats.rejected + stats.held;
        const progress = (processed / state.mediaFiles.length) * 100;
        elements.statsBar.style.setProperty('--progress-width', `${progress}%`);
    }
}

// Handle export
function handleExport() {
    if (state.decisions.accepted.size === 0) return;

    // Get folder path components
    const pathParts = state.mediaFiles[0].webkitRelativePath.split('/');
    const parentFolder = pathParts[0];
    const currentFolder = pathParts[1] || '';
    const fileName = `${parentFolder}_${currentFolder}_accepted.txt`;

    let content = '';
    state.decisions.accepted.forEach(file => {
        const tags = state.tags.get(file.webkitRelativePath) || [];
        content += `${file.webkitRelativePath}${tags.length ? ` [${tags.join(', ')}]` : ''}\n`;
    });

    // Create and trigger download
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Export completed successfully!');
}

// Handle keyboard shortcuts
function handleKeyPress(e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    switch (e.key.toLowerCase()) {
        case ' ':
            e.preventDefault();
            makeDecision('accepted');
            break;
        case 'x':
            makeDecision('rejected');
            break;
        case 'h':
            makeDecision('held');
            break;
        case 'arrowleft':
            e.preventDefault();
            navigateImages('prev');
            break;
        case 'arrowright':
            e.preventDefault();
            navigateImages('next');
            break;
    }
}

// Handle thumbnail strip scroll
function handleThumbnailScroll() {
    const strip = elements.thumbnailStrip;
    const scrollRight = strip.scrollLeft + strip.clientWidth;
    
    if (scrollRight >= strip.scrollWidth - 200) {
        const loadedCount = state.loadedThumbnails.size;
        const filteredFiles = getFilteredFiles();
        if (loadedCount < filteredFiles.length) {
            loadThumbnails(loadedCount);
        }
    }
}

// Reset decisions
function resetDecisions() {
    Object.values(state.decisions).forEach(set => set.clear());
    updateStats();
    updateFilterCounts();
}

// Utility: Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Save progress
async function saveProgress() {
    if (!state.currentFolderPath || state.mediaFiles.length === 0) return;

    // Show saving animation
    elements.saveButton.classList.add('saving');

    const progressData = {
        timestamp: new Date().toISOString(),
        folderPath: state.currentFolderPath,
        currentIndex: state.currentIndex,
        decisions: {
            accepted: Array.from(state.decisions.accepted).map(file => file.webkitRelativePath),
            rejected: Array.from(state.decisions.rejected).map(file => file.webkitRelativePath),
            held: Array.from(state.decisions.held).map(file => file.webkitRelativePath)
        },
        tags: Array.from(state.tags.entries()),
        totalFiles: state.mediaFiles.length
    };

    try {
        await localStorage.setItem('photoSelectorProgress', JSON.stringify(progressData));
        state.lastSavedTimestamp = progressData.timestamp;
        
        // Hide saving animation after a short delay
        setTimeout(() => {
            elements.saveButton.classList.remove('saving');
        }, 1000);
    } catch (error) {
        console.error('Error saving progress:', error);
        elements.saveButton.classList.remove('saving');
    }
}

// Check for saved progress
function checkForSavedProgress() {
    try {
        const savedProgress = localStorage.getItem('photoSelectorProgress');
        if (!savedProgress) return;

        const progress = JSON.parse(savedProgress);
        if (progress && progress.folderPath) {
            showRestorePrompt(progress);
        }
    } catch (error) {
        console.error('Error checking saved progress:', error);
    }
}

// Show restore prompt
function showRestorePrompt(progress) {
    const timestamp = new Date(progress.timestamp).toLocaleString();
    const container = document.createElement('div');
    container.className = 'restore-prompt';
    container.innerHTML = `
        <div class="restore-prompt-content">
            <h3>Resume Previous Session?</h3>
            <p>Found saved progress from ${timestamp}</p>
            <p>Folder: ${progress.folderPath}</p>
            <p>Progress: ${Object.values(progress.decisions)
                .reduce((sum, arr) => sum + arr.length, 0)} of ${progress.totalFiles} files processed</p>
            <div class="restore-prompt-actions">
                <button class="primary-button" id="restoreYes">Yes, Resume</button>
                <button class="secondary-button" id="restoreNo">No, Start Fresh</button>
            </div>
        </div>
    `;

    document.body.appendChild(container);

    // Add styles dynamically
    const style = document.createElement('style');
    style.textContent = `
        .restore-prompt {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }
        .restore-prompt-content {
            background: white;
            padding: 24px;
            border-radius: 8px;
            max-width: 400px;
            width: 90%;
        }
        .restore-prompt h3 {
            margin-bottom: 16px;
            color: #2c3e50;
        }
        .restore-prompt p {
            margin-bottom: 8px;
            color: #7f8c8d;
        }
        .restore-prompt-actions {
            margin-top: 20px;
            display: flex;
            gap: 12px;
            justify-content: flex-end;
        }
    `;
    document.head.appendChild(style);

    // Handle restore choice
    document.getElementById('restoreYes').addEventListener('click', () => {
        container.remove();
        restoreProgress(progress);
    });

    document.getElementById('restoreNo').addEventListener('click', () => {
        container.remove();
        localStorage.removeItem('photoSelectorProgress');
    });
}

// Restore progress
async function restoreProgress(progress) {
    try {
        // Create a file input and programmatically select the folder
        const input = document.createElement('input');
        input.type = 'file';
        input.webkitdirectory = true;
        
        input.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files).filter(file => 
                file.type.startsWith('image/')
            );

            // Verify it's the same folder
            if (files.length === 0) return;
            const folderPath = files[0].webkitRelativePath.split('/')[0];
            
            if (folderPath !== progress.folderPath) {
                showNotification('Please select the same folder as before: ' + progress.folderPath);
                return;
            }

            // Initialize with the files
            state.mediaFiles = files.sort((a, b) => a.name.localeCompare(b.name));
            state.currentFolderPath = folderPath;
            state.currentIndex = progress.currentIndex;

            // Restore decisions
            resetDecisions();
            Object.entries(progress.decisions).forEach(([decision, paths]) => {
                paths.forEach(path => {
                    const file = state.mediaFiles.find(f => f.webkitRelativePath === path);
                    if (file) {
                        state.decisions[decision].add(file);
                    }
                });
            });

            // Restore tags
            state.tags = new Map(progress.tags || []);

            // Initialize UI
            await initializeGallery();
            updateFilterCounts();
            showNotification('Progress restored successfully!');
        });

        input.click();
    } catch (error) {
        console.error('Error restoring progress:', error);
        showNotification('Error restoring progress', 'error');
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    // Add styles dynamically
    const style = document.createElement('style');
    style.textContent = `
        .notification {
            position: fixed;
            top: 15%;
            right: 40%;
            padding: 8px 16px;
            border-radius: 4px;
            background: white;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            z-index: 1000;
            animation: slideIn 0.3s ease, fadeOut 0.3s ease 2.7s;
            font-size: 14px;
            line-height: 1.2;
            display: inline-block;
            max-width: 300px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            height: auto;
        }
        .notification.info {
            background: #3498db;
            color: white;
        }
        .notification.error {
            background: #e74c3c;
            color: white;
        }
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);
    setTimeout(() => {
        notification.remove();
        style.remove();
    }, 3000);
}

// Check for unsaved changes
function hasUnsavedChanges() {
    return state.lastSavedTimestamp !== null && 
           new Date() - new Date(state.lastSavedTimestamp) > 30000;
}

// Zoom controls
function adjustZoom(delta) {
    const newZoom = Math.max(1, Math.min(5, state.zoom.level + delta));
    if (newZoom === state.zoom.level) return;

    state.zoom.level = newZoom;
    updateImageTransform();
    elements.currentMedia.classList.toggle('zoomed', state.zoom.level > 1);
}

function resetZoom() {
    state.zoom.level = 1;
    state.zoom.translateX = 0;
    state.zoom.translateY = 0;
    updateImageTransform();
    elements.currentMedia.classList.remove('zoomed');
}

function updateImageTransform() {
    elements.currentMedia.style.transform = 
        `translate(${state.zoom.translateX}px, ${state.zoom.translateY}px) scale(${state.zoom.level})`;
}

function startDragging(e) {
    if (state.zoom.level <= 1) return;

    state.zoom.isDragging = true;
    state.zoom.startX = e.clientX - state.zoom.translateX;
    state.zoom.startY = e.clientY - state.zoom.translateY;
}

function handleDragging(e) {
    if (!state.zoom.isDragging) return;

    state.zoom.translateX = e.clientX - state.zoom.startX;
    state.zoom.translateY = e.clientY - state.zoom.startY;
    updateImageTransform();
}

function stopDragging() {
    state.zoom.isDragging = false;
}

function handleZoomWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    adjustZoom(delta);
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        elements.mediaContainer.requestFullscreen();
        elements.mediaContainer.classList.add('fullscreen');
        elements.imageControls.fullScreen.querySelector('.material-icons').textContent = 'fullscreen_exit';
    } else {
        document.exitFullscreen();
        elements.mediaContainer.classList.remove('fullscreen');
        elements.imageControls.fullScreen.querySelector('.material-icons').textContent = 'fullscreen';
    }
}

// Add image status update function
function updateImageStatus(file) {
    let status = '';
    let icon = '';
    let color = '';

    if (state.decisions.accepted.has(file)) {
        status = 'Accepted';
        icon = 'check_circle';
        color = '#2ecc71';
    } else if (state.decisions.rejected.has(file)) {
        status = 'Rejected';
        icon = 'cancel';
        color = '#e74c3c';
    } else if (state.decisions.held.has(file)) {
        status = 'On Hold';
        icon = 'pause_circle';
        color = '#f39c12';
    }

    if (status) {
        elements.imageStatus.innerHTML = `
            <span class="material-icons" style="color: ${color}">${icon}</span>
            ${status}
        `;
        elements.imageStatus.style.display = 'flex';
    } else {
        elements.imageStatus.style.display = 'none';
    }
}

// Add tag management functions
function toggleTag(tag) {
    const file = state.mediaFiles[state.currentIndex];
    if (!file) return;

    const filePath = file.webkitRelativePath;
    const currentTags = state.tags.get(filePath) || [];
    const tagIndex = currentTags.indexOf(tag);

    if (tagIndex === -1) {
        currentTags.push(tag);
    } else {
        currentTags.splice(tagIndex, 1);
    }

    state.tags.set(filePath, currentTags);
    updateTagButtons(file);
    saveProgress();
}

function updateTagButtons(file) {
    const currentTags = state.tags.get(file.webkitRelativePath) || [];
    elements.tagSelector.querySelectorAll('.tag-btn').forEach(btn => {
        btn.classList.toggle('active', currentTags.includes(btn.dataset.tag));
    });
}

// Add navigation function
function navigateImages(direction) {
    const filteredFiles = getFilteredFiles();
    const currentFilteredIndex = filteredFiles.indexOf(state.mediaFiles[state.currentIndex]);
    
    if (direction === 'prev' && currentFilteredIndex > 0) {
        state.currentIndex = state.mediaFiles.indexOf(filteredFiles[currentFilteredIndex - 1]);
        showCurrentMedia();
    } else if (direction === 'next' && currentFilteredIndex < filteredFiles.length - 1) {
        state.currentIndex = state.mediaFiles.indexOf(filteredFiles[currentFilteredIndex + 1]);
        showCurrentMedia();
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp); 