# Photo Selector

A powerful web-based application for efficiently organizing, reviewing, and categorizing large collections of photos.

## Features

- **Intuitive Interface**: Clean and modern UI with a collapsible sidebar and easy-to-use controls
- **Smart Navigation**: Keyboard shortcuts and on-screen buttons for quick photo browsing
- **Efficient Photo Management**: Quick decision-making with Accept/Reject/Hold options
- **Advanced Viewing**: Zoom controls and fullscreen mode for detailed photo examination
- **Photo Tagging**: Categorize photos with predefined tags (Haldi, Mehndi, Varmala, Reception, Family)
- **Progress Tracking**: Visual progress bar and detailed statistics
- **Auto-save**: Automatic progress saving with session restoration
- **Smart Filtering**: Filter photos by status (Accepted, Rejected, On Hold, Unprocessed)
- **Optimized Performance**: Lazy loading and efficient thumbnail generation
- **Export Functionality**: Export accepted photos list with tags

## Getting Started

1. Open the application in a modern web browser
2. Click "Select Folder" to choose a directory containing your photos
3. If there's a previous session, you'll be prompted to restore it or start fresh

## Navigation

### Keyboard Shortcuts

- **Space**: Accept photo
- **X**: Reject photo
- **H**: Hold photo
- **←**: Previous photo
- **→**: Next photo

### Mouse Controls

- **Click thumbnails**: Jump to specific photo
- **Mouse wheel**: Zoom in/out when viewing photos
- **Drag**: Pan around when zoomed in

## Main Features

### Photo Management

1. **Decision Making**
   - Use the buttons at the bottom of the photo:
     - ✓ (Accept)
     - ✕ (Reject)
     - ⏸ (Hold)

2. **Viewing Options**
   - Zoom controls:
     - Zoom In (+)
     - Zoom Out (-)
     - Fit to View
     - Fullscreen Mode

3. **Photo Tagging**
   - Click tag buttons below the photo to categorize:
     - Haldi
     - Mehndi
     - Varmala
     - Reception
     - Family

### Filtering and Organization

1. **Sidebar Filters**
   - All Photos
   - Accepted
   - Rejected
   - On Hold
   - Unprocessed

2. **Progress Tracking**
   - View counts for each category
   - Progress bar shows overall completion
   - Statistics update in real-time

### Saving and Exporting

1. **Auto-save**
   - Progress saves automatically every 30 seconds
   - Manual save available via "Save Progress" button
   - Session can be restored when reopening

2. **Exporting**
   - Click "Export Accepted" to save a list of accepted photos
   - Export includes file paths and associated tags
   - File naming format: `<parent_folder>_<subfolder>_accepted.txt`

## Best Practices

1. **Regular Saving**
   - Though auto-save is enabled, use manual save for important changes
   - Save before closing the browser

2. **Efficient Workflow**
   - Use keyboard shortcuts for faster navigation
   - Apply tags while reviewing to avoid second pass
   - Use filters to review specific categories

3. **Performance**
   - Allow thumbnails to load completely for smooth experience
   - Use "Fit to View" when switching between photos
   - Close other resource-intensive applications for better performance

## Troubleshooting

- If the application seems slow, try:
  1. Reducing the number of photos in the selected folder
  2. Clearing browser cache
  3. Refreshing the page
  
- If progress is lost:
  1. Check local storage in browser settings
  2. Ensure browser cookies/storage is enabled
  3. Export decisions regularly as backup

## System Requirements

- Modern web browser (Chrome, Firefox, Edge recommended)
- JavaScript enabled
- Local storage enabled
- Sufficient system memory for photo processing 