# Memes & Memories

This folder contains images and videos for the Memes & Memories gallery page.

## How to add images and videos:

1. **Drop your files here** - Place any `.jpg`, `.png`, `.gif` (images) or `.mp4`, `.webm` (videos) files in this folder
2. **Update MemesAndMemories.jsx** - Add entries to the `memories` array with:
   - `media`: The filename (just the filename, no path needed)
   - `type`: Either `'image'` or `'video'`

### Examples:

```javascript
const [memories] = useState([
  { media: '2023-playoff.jpg', type: 'image' },
  { media: 'draft-chaos.png', type: 'image' },
  { media: 'champ-highlights.mp4', type: 'video' },
  { media: 'best-catch.mp4', type: 'video' },
]);
```

The gallery will randomize the order of images and videos on each page load!


