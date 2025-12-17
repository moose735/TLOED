# Memes & Memories

This folder contains images and videos for the Memes & Memories gallery page.

## How to add images and videos:

1. **Drop your files here** - Place any `.jpg`, `.png`, `.gif` (images) or `.mp4`, `.webm` (videos) files in this folder
2. **Update MemesAndMemories.jsx** - Add entries to the `memories` array with:
   - `title`: The display name of the memory
   - `description`: A brief description or caption
   - `media`: The filename (just the filename, no path needed)
   - `type`: Either `'image'` or `'video'`

### Examples:

```javascript
const [memories] = useState([
  { title: 'Epic Playoff Run', description: 'That unforgettable 2023 moment', media: '2023-playoff.jpg', type: 'image' },
  { title: 'Draft Day Shenanigans', description: 'When everything went wrong', media: 'draft-chaos.png', type: 'image' },
  { title: 'Championship Highlight', description: 'The winning moment', media: 'champ-highlights.mp4', type: 'video' },
  { title: 'Memorable Play', description: 'Best catch of the season', media: 'best-catch.mp4', type: 'video' },
]);
```

The gallery will randomize the order of images and videos on each page load!

