import React, { useState, useEffect } from 'react';

export default function MemesAndMemories() {
  // Gallery of memes and memories - images and videos can be added here
  // Format: { media: string, type: 'image' | 'video' }
  const [memories] = useState([
    // Add your memes and memories here in the format:
    { media: 'ChuckAndFlacco.jpg', type: 'image' },
    { media: 'JoeSpongebob.mp4', type: 'video' },
    { media: 'ShotSki.mp4', type: 'video' },
    { media: 'IMG_0838.jpeg', type: 'image' },
    { media: 'IMG_6065.jpeg', type: 'image' },
    { media: 'IMG_0828.jpeg', type: 'image' },
    { media: 'IMG_0843.jpeg', type: 'image' },
    { media: 'IMG_9141.jpeg', type: 'image' },
    { media: 'IMG_9201.jpeg', type: 'image' },
    { media: 'IMG_9534.jpeg', type: 'image' },
    // Example:
    // { media: '2023-upset.jpg', type: 'image' },
    // { media: 'highlight.mp4', type: 'video' },
  ]);

  const [randomizedMemories, setRandomizedMemories] = useState([]);
  const [selectedMedia, setSelectedMedia] = useState(null);

  // Fisher-Yates shuffle (stable and unbiased)
  const shuffleArray = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const shuffleMemories = () => setRandomizedMemories(shuffleArray(memories));

  useEffect(() => {
    shuffleMemories();
  }, [memories]);

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Memes & Memories</h1>
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
            <p className="text-gray-600 text-lg">A collection of memes and memories over the years</p>
            <button
              className="w-fit md:ml-2 px-3 py-1 bg-blue-600 text-white rounded shadow hover:bg-blue-700 text-sm active:bg-blue-800 transition-colors"
              onClick={() => shuffleMemories()}
              title="Shuffle gallery"
            >
              🔀 Shuffle
            </button>
          </div>
        </div>

        {/* Gallery Grid */}
        {randomizedMemories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {randomizedMemories.map((memory, index) => (
              <div
                key={index}
                className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 cursor-pointer"
                onClick={() => setSelectedMedia(memory)}
              >
                {/* Media Container */}
                <div className="relative bg-gray-200 h-64 overflow-hidden">
                  {memory.type === 'video' ? (
                    <video
                      src={process.env.PUBLIC_URL + '/memes/' + memory.media}
                      controls
                      className="w-full h-full object-cover"
                      onClick={(e) => e.stopPropagation()}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : (
                    <img
                      src={process.env.PUBLIC_URL + '/memes/' + memory.media}
                      alt="Memory"
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
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-lg shadow">
            <p className="text-xl text-gray-600 mb-4">No memories added yet</p>
            <p className="text-gray-500">Start adding memes and memories to this collection!</p>
          </div>
        )}
      </div>

      {/* Fullscreen Modal */}
      {selectedMedia && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedMedia(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedMedia.type === 'video' ? (
              <video
                src={process.env.PUBLIC_URL + '/memes/' + selectedMedia.media}
                controls
                autoPlay
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <img
                src={process.env.PUBLIC_URL + '/memes/' + selectedMedia.media}
                alt="Memory Fullscreen"
                className="max-w-full max-h-full object-contain"
              />
            )}
            <button
              className="absolute top-4 right-4 text-white text-3xl font-bold bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full w-12 h-12 flex items-center justify-center transition-all"
              onClick={() => setSelectedMedia(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
