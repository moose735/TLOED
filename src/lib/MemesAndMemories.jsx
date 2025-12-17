import React, { useState, useEffect } from 'react';

export default function MemesAndMemories() {
  // Gallery of memes and memories - images and videos can be added here
  // Format: { title: string, description: string, media: string, type: 'image' | 'video' }
  const [memories] = useState([
    // Add your memes and memories here in the format:
    // { title: 'Title Here', description: 'Description', media: 'filename.jpg', type: 'image' }
    // { title: 'Video Title', description: 'Video description', media: 'video.mp4', type: 'video' }
    // Example:
    // { title: 'Historic Upset', description: 'The memorable playoff run', media: '2023-upset.jpg', type: 'image' },
    // { title: 'Best Moment', description: 'Incredible play', media: 'highlight.mp4', type: 'video' },
  ]);

  const [randomizedMemories, setRandomizedMemories] = useState([]);

  // Randomize memories on mount
  useEffect(() => {
    const shuffled = [...memories].sort(() => Math.random() - 0.5);
    setRandomizedMemories(shuffled);
  }, [memories]);

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Memes & Memories</h1>
          <p className="text-gray-600 text-lg">A collection of epic moments and hilarious memories from over the years</p>
        </div>

        {/* Gallery Grid */}
        {randomizedMemories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {randomizedMemories.map((memory, index) => (
              <div
                key={index}
                className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300"
              >
                {/* Media Container */}
                <div className="relative bg-gray-200 h-64 overflow-hidden">
                  {memory.type === 'video' ? (
                    <video
                      src={process.env.PUBLIC_URL + '/memes/' + memory.media}
                      controls
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : (
                    <img
                      src={process.env.PUBLIC_URL + '/memes/' + memory.media}
                      alt={memory.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23e5e7eb" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" font-size="24" fill="%239ca3af" text-anchor="middle" dominant-baseline="middle"%3EMedia Not Found%3C/text%3E%3C/svg%3E';
                      }}
                    />
                  )}
                  <div className="hidden absolute inset-0 items-center justify-center bg-gray-300">
                    <span className="text-gray-600 text-center">Media Not Found</span>
                  </div>
                </div>

                {/* Content Container */}
                <div className="p-4">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{memory.title}</h3>
                  {memory.description && (
                    <p className="text-gray-600 text-sm leading-relaxed">{memory.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-lg shadow">
            <p className="text-xl text-gray-600 mb-4">No memories added yet</p>
            <p className="text-gray-500">Start adding memes and memories to this collection!</p>
            <p className="text-sm text-gray-400 mt-4 max-w-md mx-auto">
              To add images or videos, place them in the public/memes folder and update the memories array in MemesAndMemories.jsx with their filenames.
            </p>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-12 bg-blue-50 border-l-4 border-blue-600 p-6 rounded">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">How to add memories:</h3>
          <ol className="text-blue-800 space-y-2 list-decimal list-inside">
            <li>Place your image or video files in <code className="bg-white px-2 py-1 rounded">/public/memes/</code></li>
            <li>Update the <code className="bg-white px-2 py-1 rounded">memories</code> array in MemesAndMemories.jsx</li>
            <li>Add entries with: title, description, media (filename), and type ('image' or 'video')</li>
            <li>Supported formats: JPG, PNG, GIF (images) and MP4, WebM (videos)</li>
            <li>The gallery will randomize on each page load</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
