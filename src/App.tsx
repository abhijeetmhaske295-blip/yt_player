import { useState } from 'react';
import { Search, Music, ListMusic, Mic2, Play, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import WarpCarousel from '@/components/ui/warp-carousel';

export default function App() {
  const [activeTab, setActiveTab] = useState<'search' | 'playlists' | 'lyrics'>('search');
  const [searchQuery, setSearchQuery] = useState('');

  // TODO: Player state management (currentTrack, isPlaying, progress, duration, volume, audioRef)
  // TODO: LocalStorage playlists persistence (load, save, create, delete)
  // TODO: LRCLIB lyrics fetching and synced display with playback time
  // TODO: Search results state and API integration with /api/search
  // TODO: Audio stream integration with /api/stream/:id

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Trigger search request to backend (/api/search?q=...)
    console.log('Search initiated for:', searchQuery);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0a0a0e] text-white overflow-hidden">
      {/* Top Search Header */}
      <header className="h-16 border-b border-zinc-800/80 px-6 flex items-center justify-between gap-4 bg-zinc-950/70 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-red-600 flex items-center justify-center shadow-lg shadow-red-900/20">
            <Music className="h-5 w-5 text-white" />
          </div>
          <span className="font-semibold text-lg tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            YT Warp Player
          </span>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search songs, artists, or albums..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900/90 border border-zinc-800 rounded-full py-2 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500/70 focus:ring-1 focus:ring-red-500/50 transition-all"
            />
          </div>
        </form>

        <div className="w-28 flex justify-end">
          {/* Header action buttons / user badge placeholder */}
        </div>
      </header>

      {/* Split Main Container */}
      <main className="flex-1 flex overflow-hidden p-6 gap-6 min-h-0">
        {/* Left Slot: WarpCarousel */}
        <section className="flex-1 flex flex-col min-w-0 bg-zinc-900/30 rounded-2xl border border-zinc-800/60 p-4 overflow-hidden shadow-2xl relative">
          <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full bg-zinc-900/80 border border-zinc-800 text-xs font-medium text-zinc-400 backdrop-blur-sm">
            WebGL Carousel Slot
          </div>
          <div className="flex-1 w-full h-full">
            <WarpCarousel />
          </div>
        </section>

        {/* Right Slot: Tabs for Search / Playlists / Lyrics */}
        <aside className="w-[420px] flex flex-col bg-zinc-900/30 rounded-2xl border border-zinc-800/60 overflow-hidden shrink-0">
          {/* Tab Navigation */}
          <div className="flex border-b border-zinc-800/80 bg-zinc-950/40 p-1.5 gap-1 shrink-0">
            <button
              onClick={() => setActiveTab('search')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-lg transition-all ${
                activeTab === 'search'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search</span>
            </button>
            <button
              onClick={() => setActiveTab('playlists')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-lg transition-all ${
                activeTab === 'playlists'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <ListMusic className="h-3.5 w-3.5" />
              <span>Playlists</span>
            </button>
            <button
              onClick={() => setActiveTab('lyrics')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-lg transition-all ${
                activeTab === 'lyrics'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Mic2 className="h-3.5 w-3.5" />
              <span>Lyrics</span>
            </button>
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 p-4 overflow-y-auto min-h-0 text-sm">
            {activeTab === 'search' && (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-center p-6">
                <Search className="h-8 w-8 mb-3 text-zinc-600 stroke-[1.5]" />
                <p className="font-medium text-zinc-400">Search for Music</p>
                <p className="text-xs text-zinc-600 mt-1">
                  // TODO: Render search results from /api/search here
                </p>
              </div>
            )}

            {activeTab === 'playlists' && (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-center p-6">
                <ListMusic className="h-8 w-8 mb-3 text-zinc-600 stroke-[1.5]" />
                <p className="font-medium text-zinc-400">Your Playlists</p>
                <p className="text-xs text-zinc-600 mt-1">
                  // TODO: Render saved playlists from localStorage here
                </p>
              </div>
            )}

            {activeTab === 'lyrics' && (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-center p-6">
                <Mic2 className="h-8 w-8 mb-3 text-zinc-600 stroke-[1.5]" />
                <p className="font-medium text-zinc-400">Synchronized Lyrics</p>
                <p className="text-xs text-zinc-600 mt-1">
                  // TODO: Fetch from LRCLIB and render synced lyrics here
                </p>
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* Bottom Player Bar */}
      <footer className="h-22 border-t border-zinc-800/80 px-6 bg-zinc-950/90 backdrop-blur-md flex items-center justify-between shrink-0 gap-6">
        {/* Track Info */}
        <div className="flex items-center gap-3 w-1/4 min-w-[200px]">
          <div className="h-12 w-12 rounded-lg bg-zinc-800 border border-zinc-700/50 flex items-center justify-center text-zinc-600 shrink-0">
            <Music className="h-6 w-6" />
          </div>
          <div className="truncate">
            <p className="text-sm font-medium text-zinc-200 truncate">No track selected</p>
            <p className="text-xs text-zinc-500 truncate">// TODO: Active track artist</p>
          </div>
        </div>

        {/* Player Controls & Scrubber */}
        <div className="flex-1 max-w-xl flex flex-col items-center gap-2">
          <div className="flex items-center gap-4">
            <button className="text-zinc-400 hover:text-white transition-colors">
              <SkipBack className="h-5 w-5" />
            </button>
            <button className="h-10 w-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform shadow-md">
              <Play className="h-5 w-5 fill-current ml-0.5" />
            </button>
            <button className="text-zinc-400 hover:text-white transition-colors">
              <SkipForward className="h-5 w-5" />
            </button>
          </div>

          <div className="w-full flex items-center gap-2 text-xs text-zinc-500">
            <span>0:00</span>
            <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden cursor-pointer group">
              <div className="h-full bg-red-500 w-0 group-hover:bg-red-400 transition-all" />
            </div>
            <span>0:00</span>
          </div>
        </div>

        {/* Volume & Additional Options */}
        <div className="flex items-center justify-end gap-3 w-1/4 min-w-[200px]">
          <Volume2 className="h-5 w-5 text-zinc-400" />
          <div className="w-24 h-1 bg-zinc-800 rounded-full overflow-hidden cursor-pointer">
            <div className="h-full bg-zinc-400 w-3/4 hover:bg-white" />
          </div>
        </div>
      </footer>
    </div>
  );
}
