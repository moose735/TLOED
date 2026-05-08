import React, { useState, useEffect } from 'react';

export default function MemesAndMemories() {
  const [memories] = useState([
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
    { media: 'IMG_0020.JPG', type: 'image' },
    { media: 'IMG_0188.JPG', type: 'image' },
    { media: 'IMG_3689.jpeg', type: 'image' },
    { media: 'IMG_3815.JPEG', type: 'image' },
    { media: 'IMG_7879.JPG', type: 'image' },
    { media: 'IMG_8226.JPG', type: 'image' },
    { media: 'IMG_8338.JPG', type: 'image' },
    { media: 'IMG_8471.JPG', type: 'image' },
    { media: 'IMG_8629.JPG', type: 'image' },
    { media: 'IMG_9515.JPG', type: 'image' },
    { media: 'IMG_9591.JPG', type: 'image' },
    { media: 'IMG_9597.JPG', type: 'image' },
    { media: 'IMG_9693.JPG', type: 'image' },
    { media: 'IMG_9712.JPG', type: 'image' },
    { media: 'IMG_9925.JPG', type: 'image' },
    { media: 'IMG_9935.JPG', type: 'image' },
    { media: 'Starwars.MOV', type: 'video' },
  ]);

  const [randomizedMemories, setRandomizedMemories] = useState([]);
  const [selectedMedia, setSelectedMedia] = useState(null);

  // Fisher-Yates shuffle (stable and unbiased) — untouched
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
    <div className="w-full p-3 sm:p-5 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center flex-shrink-0">
            {/* Photo icon */}
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">Memes & Memories</h1>
            <p className="text-[10px] text-gray-500 mt-0.5">A collection of memories over the years</p>
          </div>
        </div>

        <button
          onClick={shuffleMemories}
          title="Shuffle gallery"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs font-semibold rounded-lg border border-blue-500/30 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Shuffle
        </button>
      </div>

      {/* Gallery grid */}
      {randomizedMemories.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {randomizedMemories.map((memory, index) => (
            <div
              key={index}
              className="group bg-gray-800 border border-white/10 rounded-xl overflow-hidden cursor-pointer hover:border-white/25 hover:shadow-lg hover:shadow-black/40 transition-all duration-200"
              onClick={() => setSelectedMedia(memory)}
            >
              <div className="relative bg-gray-900/60 h-60 overflow-hidden">
                {memory.type === 'video' ? (
                  <>
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
                    {/* Video badge */}
                    <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm rounded-md border border-white/10 pointer-events-none">
                      <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      <span className="text-[9px] font-semibold text-gray-300 uppercase tracking-wider">Video</span>
                    </div>
                  </>
                ) : (
                  <img
                    src={process.env.PUBLIC_URL + '/memes/' + memory.media}
                    alt="Memory"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%231e293b" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" font-size="16" fill="%234b5563" text-anchor="middle" dominant-baseline="middle"%3EMedia Not Found%3C/text%3E%3C/svg%3E';
                    }}
                  />
                )}

                {/* Hover overlay for images */}
                {memory.type === 'image' && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-10 h-10 rounded-full bg-black/60 border border-white/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                      </svg>
                    </div>
                  </div>
                )}

                {/* Fallback */}
                <div className="hidden absolute inset-0 items-center justify-center bg-gray-900/60">
                  <span className="text-gray-500 text-sm">Media Not Found</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-gray-800/50 border border-white/8 rounded-xl text-center">
          <div className="text-4xl mb-3">📸</div>
          <p className="text-sm font-semibold text-gray-400">No memories added yet</p>
          <p className="text-xs text-gray-600 mt-1">Start adding memes and memories to this collection!</p>
        </div>
      )}

      {/* Fullscreen modal */}
      {selectedMedia && (
        <div
          className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={() => setSelectedMedia(null)}
        >
          <div
            className="relative max-w-5xl max-h-[92vh] w-full h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedMedia.type === 'video' ? (
              <video
                src={process.env.PUBLIC_URL + '/memes/' + selectedMedia.media}
                controls
                autoPlay
                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              />
            ) : (
              <img
                src={process.env.PUBLIC_URL + '/memes/' + selectedMedia.media}
                alt="Memory Fullscreen"
                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              />
            )}

            {/* Close button */}
            <button
              className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full bg-black/70 border border-white/15 text-white hover:bg-black/90 hover:border-white/30 transition-all"
              onClick={() => setSelectedMedia(null)}
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}