import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search,
  Music,
  ListMusic,
  Mic2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Volume1,
  VolumeX,
  Heart,
  Plus,
  Trash2,
  Loader2,
  FolderPlus,
  ListPlus,
  Radio,
  Shuffle,
  Repeat,
  Repeat1,
  Disc3,
} from 'lucide-react';

export interface Track {
  id: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail: string;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
}

export interface LyricLine {
  time: number;
  text: string;
}

const STORAGE_KEY = 'warp_playlists';
const BACKEND_URL = 'http://localhost:3001';

export default function App() {
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<'search' | 'playlists' | 'lyrics'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Track[]>([]);

  // Player State
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentQueue, setCurrentQueue] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');

  // Lyrics State
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [isLyricsLoading, setIsLyricsLoading] = useState(false);
  const [lyricsError, setLyricsError] = useState<string | null>(null);
  const activeLyricRef = useRef<HTMLDivElement>(null);

  // Playlists State
  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.error('Failed to parse playlists from localStorage:', err);
    }
    return [{ id: 'liked', name: 'Liked Songs', tracks: [] }];
  });
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('liked');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [addToPlaylistTrack, setAddToPlaylistTrack] = useState<Track | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load trending / initial hits on initial mount
  useEffect(() => {
    let isMounted = true;
    const loadTrending = async () => {
      try {
        setIsSearching(true);
        const res = await fetch(`${BACKEND_URL}/api/trending`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (isMounted && data.results && data.results.length > 0) {
          setSearchResults(data.results);
          if (!currentTrack) {
            setCurrentQueue(data.results);
          }
        }
      } catch (err) {
        console.warn('Initial trending fetch deferred:', err);
      } finally {
        if (isMounted) setIsSearching(false);
      }
    };
    loadTrending();
    return () => {
      isMounted = false;
    };
  }, []);

  // Persist playlists to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
    } catch (err) {
      console.error('Failed to save playlists to localStorage:', err);
    }
  }, [playlists]);

  // Handle Search Submission
  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    setActiveTab('search');
    try {
      const res = await fetch(`${BACKEND_URL}/api/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err) {
      console.error('Search request failed:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Play Track & set queue
  const playTrack = useCallback(
    (track: Track, queue?: Track[]) => {
      setCurrentTrack(track);
      if (queue) {
        setCurrentQueue(queue);
      } else if (searchResults.length > 0) {
        setCurrentQueue(searchResults);
      }
      setIsPlaying(true);
      setCurrentTime(0);
    },
    [searchResults]
  );

  // Toggle Play / Pause
  const togglePlay = () => {
    if (!currentTrack) {
      if (searchResults.length > 0) {
        playTrack(searchResults[0], searchResults);
      }
      return;
    }
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch((err) => console.error('Play failed:', err));
      }
    }
    setIsPlaying(!isPlaying);
  };

  // Next Track
  const handleNext = useCallback(() => {
    if (!currentTrack || currentQueue.length === 0) return;

    if (repeatMode === 'one' && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
      return;
    }

    if (isShuffle) {
      const remainingTracks = currentQueue.filter((t) => t.id !== currentTrack.id);
      if (remainingTracks.length > 0) {
        const randTrack = remainingTracks[Math.floor(Math.random() * remainingTracks.length)];
        playTrack(randTrack, currentQueue);
        return;
      }
    }

    const currentIndex = currentQueue.findIndex((t) => t.id === currentTrack.id);
    if (currentIndex >= 0 && currentIndex < currentQueue.length - 1) {
      playTrack(currentQueue[currentIndex + 1], currentQueue);
    } else if (repeatMode === 'all' && currentQueue.length > 0) {
      playTrack(currentQueue[0], currentQueue);
    } else {
      setIsPlaying(false);
    }
  }, [currentTrack, currentQueue, repeatMode, isShuffle, playTrack]);

  // Previous Track
  const handlePrev = useCallback(() => {
    if (!currentTrack || currentQueue.length === 0) return;
    if (currentTime > 3 && audioRef.current) {
      audioRef.current.currentTime = 0;
      return;
    }
    const currentIndex = currentQueue.findIndex((t) => t.id === currentTrack.id);
    if (currentIndex > 0) {
      playTrack(currentQueue[currentIndex - 1], currentQueue);
    } else if (currentQueue.length > 0) {
      playTrack(currentQueue[currentQueue.length - 1], currentQueue);
    }
  }, [currentTrack, currentQueue, currentTime, playTrack]);

  // MediaSession integration
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    try {
      const artwork = [];
      if (currentTrack.thumbnail && currentTrack.thumbnail.startsWith('http')) {
        artwork.push(
          { src: currentTrack.thumbnail, sizes: '96x96', type: 'image/jpeg' },
          { src: currentTrack.thumbnail, sizes: '128x128', type: 'image/jpeg' },
          { src: currentTrack.thumbnail, sizes: '256x256', type: 'image/jpeg' },
          { src: currentTrack.thumbnail, sizes: '512x512', type: 'image/jpeg' }
        );
      }
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title || 'Unknown Title',
        artist: currentTrack.artist || 'Unknown Artist',
        album: 'YouTube Music',
        artwork,
      });
    } catch (err) {
      console.warn('Failed to set MediaMetadata:', err);
    }

    navigator.mediaSession.setActionHandler('play', () => {
      audioRef.current?.play().catch(console.error);
      setIsPlaying(true);
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      audioRef.current?.pause();
      setIsPlaying(false);
    });
    navigator.mediaSession.setActionHandler('previoustrack', handlePrev);
    navigator.mediaSession.setActionHandler('nexttrack', handleNext);
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined && audioRef.current) {
        audioRef.current.currentTime = details.seekTime;
        setCurrentTime(details.seekTime);
      }
    });

    return () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('seekto', null);
      }
    };
  }, [currentTrack, handlePrev, handleNext]);

  // Sync playback state to mediaSession
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  // Seek handler
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  // Volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const toggleRepeat = () => {
    if (repeatMode === 'off') setRepeatMode('all');
    else if (repeatMode === 'all') setRepeatMode('one');
    else setRepeatMode('off');
  };

  // Fetch LRCLIB Synced Lyrics when current track changes
  useEffect(() => {
    if (!currentTrack) {
      setLyrics([]);
      setLyricsError(null);
      return;
    }

    let isMounted = true;
    setIsLyricsLoading(true);
    setLyricsError(null);
    setLyrics([]);

    const cleanTitle = (str: string) =>
      str
        .replace(/\s*[\(\[](official\s*(music\s*)?video|audio|lyrics|visualizer|hd|4k|remastered)[\)\]]/gi, '')
        .trim();

    const fetchLyrics = async () => {
      try {
        const title = cleanTitle(currentTrack.title);
        const artist = currentTrack.artist.split(',')[0].trim();
        const url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error('No synced lyrics found on LRCLIB');
        }

        const data = await res.json();
        if (!isMounted) return;

        if (data.syncedLyrics) {
          const lines = data.syncedLyrics.split('\n');
          const parsed: LyricLine[] = [];
          for (const line of lines) {
            const match = line.match(/\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\](.*)/);
            if (match) {
              const min = parseFloat(match[1]);
              const sec = parseFloat(match[2]);
              const text = match[3].trim();
              if (text) {
                parsed.push({ time: min * 60 + sec, text });
              }
            }
          }
          parsed.sort((a, b) => a.time - b.time);
          setLyrics(parsed);
        } else if (data.plainLyrics) {
          const lines = data.plainLyrics.split('\n').filter((l: string) => l.trim().length > 0);
          setLyrics(lines.map((text: string, idx: number) => ({ time: idx * 5, text })));
        } else {
          setLyricsError('No lyrics available for this song');
        }
      } catch (err: any) {
        if (isMounted) {
          setLyricsError(err.message || 'Failed to fetch lyrics');
          setLyrics([]);
        }
      } finally {
        if (isMounted) {
          setIsLyricsLoading(false);
        }
      }
    };

    fetchLyrics();

    return () => {
      isMounted = false;
    };
  }, [currentTrack]);

  // Active Lyric Index based on currentTime
  const activeLyricIndex = useMemo(() => {
    if (!lyrics.length) return -1;
    let idx = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i].time <= currentTime) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [lyrics, currentTime]);

  // Auto-scroll active lyric into view
  useEffect(() => {
    if (activeLyricIndex >= 0 && activeTab === 'lyrics') {
      const el = document.getElementById(`lyric-line-${activeLyricIndex}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLyricIndex, activeTab]);

  // Playlist & Liked Song Helpers
  const likedPlaylist = playlists.find((p) => p.id === 'liked') || {
    id: 'liked',
    name: 'Liked Songs',
    tracks: [],
  };

  const isTrackLiked = (trackId: string) => {
    return likedPlaylist.tracks.some((t) => t.id === trackId);
  };

  const toggleLikeTrack = (track: Track) => {
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== 'liked') return pl;
        const exists = pl.tracks.some((t) => t.id === track.id);
        const updatedTracks = exists
          ? pl.tracks.filter((t) => t.id !== track.id)
          : [track, ...pl.tracks];
        return { ...pl, tracks: updatedTracks };
      })
    );
  };

  const createPlaylist = () => {
    const trimmed = newPlaylistName.trim();
    if (!trimmed) return;
    const newId = `pl_${Date.now()}`;
    const newPl: Playlist = {
      id: newId,
      name: trimmed,
      tracks: [],
    };
    setPlaylists((prev) => [...prev, newPl]);
    setSelectedPlaylistId(newId);
    setNewPlaylistName('');
    setShowCreatePlaylist(false);
  };

  const deletePlaylist = (playlistId: string) => {
    if (playlistId === 'liked') return;
    setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
    if (selectedPlaylistId === playlistId) {
      setSelectedPlaylistId('liked');
    }
  };

  const addTrackToPlaylist = (playlistId: string, track: Track) => {
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== playlistId) return pl;
        if (pl.tracks.some((t) => t.id === track.id)) return pl;
        return { ...pl, tracks: [...pl.tracks, track] };
      })
    );
    setAddToPlaylistTrack(null);
  };

  const removeTrackFromPlaylist = (playlistId: string, trackId: string) => {
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== playlistId) return pl;
        return { ...pl, tracks: pl.tracks.filter((t) => t.id !== trackId) };
      })
    );
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const mins = Math.floor(secs / 60);
    const rem = Math.floor(secs % 60);
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0a0a0e] text-white overflow-hidden select-none">
      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        src={currentTrack ? `${BACKEND_URL}/api/stream/${currentTrack.id}` : undefined}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }}
        onDurationChange={() => {
          if (audioRef.current && !isNaN(audioRef.current.duration)) {
            setDuration(audioRef.current.duration);
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current && !isNaN(audioRef.current.duration)) {
            setDuration(audioRef.current.duration);
          }
        }}
        onWaiting={() => setIsAudioLoading(true)}
        onPlaying={() => {
          setIsAudioLoading(false);
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={handleNext}
        onError={(e) => {
          console.error('Audio playback error:', e);
          setIsAudioLoading(false);
          setIsPlaying(false);
        }}
        autoPlay
      />

      {/* Top Search Header */}
      <header className="h-16 border-b border-zinc-800/80 px-6 flex items-center justify-between gap-4 bg-zinc-950/70 backdrop-blur-md shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-red-600 flex items-center justify-center shadow-lg shadow-red-900/30">
            <Radio className="h-5 w-5 text-white animate-pulse" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              WARP // MUSIC
            </span>
          </div>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-xl mx-auto">
          <div className="relative flex items-center">
            {isSearching ? (
              <Loader2 className="absolute left-3.5 h-4 w-4 text-zinc-400 animate-spin" />
            ) : (
              <Search className="absolute left-3.5 h-4 w-4 text-zinc-400" />
            )}
            <input
              type="text"
              placeholder="Search songs, artists, or albums on YouTube Music..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900/90 border border-zinc-800 rounded-full py-2 pl-10 pr-12 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50 transition-all"
            />
            {searchQuery && (
              <button
                type="submit"
                className="absolute right-2 px-2.5 py-1 text-xs bg-red-600 hover:bg-red-500 rounded-full font-medium transition-colors"
              >
                Go
              </button>
            )}
          </div>
        </form>

        <div className="flex items-center gap-3">
          {currentTrack && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
              <span>Opus 160 kbps</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Split Container */}
      <main className="flex-1 flex overflow-hidden p-6 gap-6 min-h-0">
        {/* Left Slot: Now Playing Album Poster View (Metrolist / Apple Music style) */}
        <section className="relative flex-1 flex flex-col items-center justify-center min-w-0 bg-zinc-950/60 rounded-3xl border border-zinc-800/60 overflow-hidden shadow-2xl p-6 select-none">
          {/* Full-bleed blurred ambient backdrop */}
          {currentTrack?.thumbnail && (
            <div
              className="absolute inset-0 bg-cover bg-center filter blur-3xl scale-150 opacity-25 pointer-events-none transition-all duration-1000 ease-out"
              style={{ backgroundImage: `url(${currentTrack.thumbnail})` }}
            />
          )}
          {/* Dark glass gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0e] via-zinc-950/70 to-zinc-950/30 pointer-events-none" />

          {/* Centered Poster & Telemetry Info */}
          <div className="relative z-10 flex flex-col items-center max-w-sm md:max-w-md w-full text-center my-auto">
            {/* Album Cover Poster with Ambient Glow */}
            <div className="relative group mb-8">
              {currentTrack?.thumbnail && (
                <div
                  className="absolute -inset-4 bg-cover bg-center rounded-3xl filter blur-2xl opacity-40 group-hover:opacity-60 transition-opacity duration-700 pointer-events-none"
                  style={{ backgroundImage: `url(${currentTrack.thumbnail})` }}
                />
              )}

              <div className="relative h-64 w-64 md:h-80 md:w-80 rounded-2xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.85)] border border-white/10 bg-zinc-900/90 flex items-center justify-center transition-transform duration-500 ease-out group-hover:scale-[1.02]">
                {currentTrack?.thumbnail ? (
                  <img
                    src={currentTrack.thumbnail}
                    alt={currentTrack.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-zinc-600 gap-4 p-8">
                    <div className="h-24 w-24 rounded-full border-2 border-dashed border-zinc-700/80 flex items-center justify-center bg-zinc-800/40">
                      <Disc3 className="h-12 w-12 text-zinc-500 animate-spin-slow" />
                    </div>
                    <span className="text-xs font-semibold text-zinc-500 tracking-wider uppercase">
                      No Track Selected
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Song title and artist */}
            <div className="w-full px-4 mb-5">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white truncate drop-shadow-md">
                {currentTrack?.title || 'WARP // MUSIC'}
              </h1>
              <p className="text-sm md:text-base font-medium text-zinc-400 truncate mt-1.5">
                {currentTrack?.artist || 'Discover & stream your favorite music'}
              </p>
            </div>

            {/* Pill badges with live status */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-zinc-900/90 border border-zinc-800/80 text-zinc-300 backdrop-blur-md shadow-sm">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
                  }`}
                />
                <span>{currentTrack ? 'Opus Audio • 160 kbps' : 'Standby'}</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-zinc-900/90 border border-zinc-800/80 text-zinc-300 backdrop-blur-md shadow-sm">
                <Mic2 className="h-3 w-3 text-purple-400" />
                <span>
                  {isLyricsLoading
                    ? 'Fetching LRCLIB...'
                    : lyrics.length > 0
                    ? `${lyrics.length} Synced Lines`
                    : 'No Lyrics'}
                </span>
              </span>

              {/* Active lyric line preview */}
              {currentTrack && activeLyricIndex >= 0 && lyrics[activeLyricIndex] && (
                <div
                  onClick={() => setActiveTab('lyrics')}
                  className="w-full mt-3 px-4 py-2.5 rounded-xl bg-purple-950/30 hover:bg-purple-950/50 border border-purple-800/40 backdrop-blur-md text-xs font-medium text-purple-200 truncate cursor-pointer transition-colors shadow-inner flex items-center justify-center gap-2"
                  title="Click to open synced lyrics tab"
                >
                  <span className="text-purple-400">♪</span>
                  <span className="italic truncate">{lyrics[activeLyricIndex].text}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right Slot: Tabbed Navigation (Search / Playlists / Lyrics) */}
        <aside className="w-[450px] flex flex-col bg-zinc-900/30 rounded-2xl border border-zinc-800/60 overflow-hidden shrink-0">
          {/* Tab Navigation */}
          <div className="flex border-b border-zinc-800/80 bg-zinc-950/40 p-1.5 gap-1 shrink-0">
            <button
              onClick={() => setActiveTab('search')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-all ${
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
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-all ${
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
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'lyrics'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Mic2 className="h-3.5 w-3.5" />
              <span>Lyrics</span>
              {lyrics.length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              )}
            </button>
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 p-4 overflow-y-auto min-h-0 text-sm scrollbar-thin scrollbar-thumb-zinc-800">
            {/* TAB 1: SEARCH / TRENDING */}
            {activeTab === 'search' && (
              <div className="h-full flex flex-col">
                {isSearching ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-400 gap-3">
                    <Loader2 className="h-8 w-8 text-red-500 animate-spin" />
                    <p className="text-sm font-medium">Loading tracks from YouTube Music...</p>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/60 text-xs text-zinc-400">
                      <span>{searchQuery ? `${searchResults.length} Results` : 'Top Trending Hits'}</span>
                      <button
                        onClick={() => playTrack(searchResults[0], searchResults)}
                        className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-medium"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" />
                        <span>Play All</span>
                      </button>
                    </div>

                    {searchResults.map((track) => {
                      const isCurrent = currentTrack?.id === track.id;
                      const isLiked = isTrackLiked(track.id);

                      return (
                        <div
                          key={track.id}
                          className={`group flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer ${
                            isCurrent
                              ? 'bg-red-950/30 border border-red-900/50 text-white'
                              : 'hover:bg-zinc-800/60 border border-transparent'
                          }`}
                          onClick={() => playTrack(track, searchResults)}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="relative h-11 w-11 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                              {track.thumbnail ? (
                                <img
                                  src={track.thumbnail}
                                  alt={track.title}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-zinc-600">
                                  <Music className="h-5 w-5" />
                                </div>
                              )}
                              <div
                                className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                                  isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                }`}
                              >
                                {isCurrent && isPlaying ? (
                                  <div className="flex items-end gap-0.5 h-3">
                                    <span className="w-1 bg-red-500 animate-pulse h-full" />
                                    <span className="w-1 bg-red-400 animate-pulse h-2/3" />
                                    <span className="w-1 bg-red-500 animate-pulse h-4/5" />
                                  </div>
                                ) : (
                                  <Play className="h-4 w-4 text-white fill-current" />
                                )}
                              </div>
                            </div>

                            <div className="truncate flex-1">
                              <p
                                className={`text-xs font-semibold truncate ${
                                  isCurrent ? 'text-red-400' : 'text-zinc-200'
                                }`}
                              >
                                {track.title}
                              </p>
                              <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                                {track.artist}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pl-2">
                            <span className="text-[11px] text-zinc-500">{track.duration}</span>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLikeTrack(track);
                              }}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isLiked
                                  ? 'text-red-500 hover:text-red-400'
                                  : 'text-zinc-500 hover:text-zinc-200 opacity-0 group-hover:opacity-100'
                              }`}
                              title={isLiked ? 'Unlike' : 'Like'}
                            >
                              <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAddToPlaylistTrack(track);
                              }}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition-colors"
                              title="Add to playlist"
                            >
                              <ListPlus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-center p-6">
                    <Search className="h-10 w-10 mb-3 text-zinc-600 stroke-[1.5]" />
                    <p className="font-semibold text-zinc-300">Discover Songs & Artists</p>
                    <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                      Type a track or artist name into the search bar above to fetch songs directly
                      from YouTube Music.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: PLAYLISTS */}
            {activeTab === 'playlists' && (
              <div className="h-full flex flex-col">
                {/* Playlist Selection & Creator Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800/80">
                  <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none flex-1 mr-2">
                    {playlists.map((pl) => (
                      <button
                        key={pl.id}
                        onClick={() => setSelectedPlaylistId(pl.id)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition-all ${
                          selectedPlaylistId === pl.id
                            ? 'bg-zinc-200 text-black shadow-sm'
                            : 'bg-zinc-800/70 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                        }`}
                      >
                        {pl.name} ({pl.tracks.length})
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setShowCreatePlaylist(!showCreatePlaylist)}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors shrink-0"
                    title="Create new playlist"
                  >
                    <FolderPlus className="h-4 w-4" />
                  </button>
                </div>

                {/* Create Playlist Inline Form */}
                {showCreatePlaylist && (
                  <div className="flex items-center gap-2 mb-3 p-2 bg-zinc-800/40 rounded-xl border border-zinc-800">
                    <input
                      type="text"
                      placeholder="Playlist name..."
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && createPlaylist()}
                      className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                    />
                    <button
                      onClick={createPlaylist}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold transition-colors"
                    >
                      Create
                    </button>
                  </div>
                )}

                {/* Playlist Tracks View */}
                {(() => {
                  const currentPl =
                    playlists.find((p) => p.id === selectedPlaylistId) || likedPlaylist;

                  if (currentPl.tracks.length === 0) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-center p-6">
                        <ListMusic className="h-10 w-10 mb-3 text-zinc-600 stroke-[1.5]" />
                        <p className="font-semibold text-zinc-300">{currentPl.name} is Empty</p>
                        <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                          {currentPl.id === 'liked'
                            ? 'Heart any song from search results or the bottom player bar to add it here.'
                            : 'Click the "+" icon on any search result to add songs into this playlist.'}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/60 text-xs text-zinc-400">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-200">{currentPl.name}</span>
                          <span>• {currentPl.tracks.length} tracks</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => playTrack(currentPl.tracks[0], currentPl.tracks)}
                            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-medium"
                          >
                            <Play className="h-3.5 w-3.5 fill-current" />
                            <span>Play All</span>
                          </button>
                          {currentPl.id !== 'liked' && (
                            <button
                              onClick={() => deletePlaylist(currentPl.id)}
                              className="text-zinc-500 hover:text-red-400 transition-colors"
                              title="Delete Playlist"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {currentPl.tracks.map((track) => {
                        const isCurrent = currentTrack?.id === track.id;

                        return (
                          <div
                            key={track.id}
                            className={`group flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer ${
                              isCurrent
                                ? 'bg-red-950/30 border border-red-900/50 text-white'
                                : 'hover:bg-zinc-800/60 border border-transparent'
                            }`}
                            onClick={() => playTrack(track, currentPl.tracks)}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="relative h-10 w-10 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                                {track.thumbnail ? (
                                  <img
                                    src={track.thumbnail}
                                    alt={track.title}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center text-zinc-600">
                                    <Music className="h-4 w-4" />
                                  </div>
                                )}
                              </div>
                              <div className="truncate flex-1">
                                <p
                                  className={`text-xs font-semibold truncate ${
                                    isCurrent ? 'text-red-400' : 'text-zinc-200'
                                  }`}
                                >
                                  {track.title}
                                </p>
                                <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                                  {track.artist}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pl-2">
                              <span className="text-[11px] text-zinc-500">{track.duration}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeTrackFromPlaylist(currentPl.id, track.id);
                                }}
                                className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-colors"
                                title="Remove from playlist"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* TAB 3: LYRICS */}
            {activeTab === 'lyrics' && (
              <div className="h-full flex flex-col">
                {isLyricsLoading ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-400 gap-3">
                    <Loader2 className="h-8 w-8 text-purple-400 animate-spin" />
                    <p className="text-sm font-medium">Fetching synced lyrics from LRCLIB...</p>
                  </div>
                ) : lyrics.length > 0 ? (
                  <div className="space-y-4 py-8 px-2 flex-1">
                    {lyrics.map((line, idx) => {
                      const isActive = activeLyricIndex === idx;
                      const isPast = activeLyricIndex > idx;

                      return (
                        <div
                          key={idx}
                          id={`lyric-line-${idx}`}
                          ref={isActive ? activeLyricRef : null}
                          onClick={() => {
                            if (audioRef.current) {
                              audioRef.current.currentTime = line.time;
                            }
                          }}
                          className={`cursor-pointer transition-all duration-300 rounded-lg p-2 ${
                            isActive
                              ? 'text-white font-bold text-lg scale-[1.03] bg-purple-950/40 border border-purple-800/50 shadow-lg shadow-purple-950/50'
                              : isPast
                              ? 'text-zinc-500 hover:text-zinc-300 text-sm font-medium'
                              : 'text-zinc-400 hover:text-zinc-200 text-sm font-medium'
                          }`}
                        >
                          <p className="leading-relaxed">{line.text}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-center p-6">
                    <Mic2 className="h-10 w-10 mb-3 text-zinc-600 stroke-[1.5]" />
                    <p className="font-semibold text-zinc-300">
                      {lyricsError || 'No Synced Lyrics Loaded'}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                      {currentTrack
                        ? `LRCLIB did not match synced lyrics for "${currentTrack.title}".`
                        : 'Play a song to automatically load and synchronize lyrics in real-time.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* Add To Playlist Modal Popup */}
      {addToPlaylistTrack && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setAddToPlaylistTrack(null)}
        >
          <div
            className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800">
              <h3 className="font-semibold text-sm text-zinc-200">Add to Playlist</h3>
              <button
                onClick={() => setAddToPlaylistTrack(null)}
                className="text-zinc-500 hover:text-white text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-zinc-400 mb-3 truncate">
              Adding: <span className="text-white font-medium">{addToPlaylistTrack.title}</span>
            </p>
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {playlists.map((pl) => (
                <button
                  key={pl.id}
                  onClick={() => addTrackToPlaylist(pl.id, addToPlaylistTrack)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-800/80 transition-colors text-left"
                >
                  <span className="text-xs font-medium text-zinc-200">{pl.name}</span>
                  <Plus className="h-4 w-4 text-zinc-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bottom Player Bar */}
      <footer className="h-24 border-t border-zinc-800/80 px-6 bg-zinc-950/95 backdrop-blur-md flex items-center justify-between shrink-0 gap-6 z-20">
        {/* Track Info */}
        <div className="flex items-center gap-3 w-1/4 min-w-[220px]">
          <div className="relative h-14 w-14 rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700/50 flex items-center justify-center shrink-0 shadow-md">
            {currentTrack?.thumbnail ? (
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <Music className="h-6 w-6 text-zinc-600" />
            )}
            {isAudioLoading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <Loader2 className="h-5 w-5 text-red-500 animate-spin" />
              </div>
            )}
          </div>
          <div className="truncate flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-100 truncate">
              {currentTrack?.title || 'No track selected'}
            </p>
            <p className="text-xs text-zinc-400 truncate mt-0.5">
              {currentTrack?.artist || 'Search or pick a song to begin'}
            </p>
          </div>
          {currentTrack && (
            <button
              onClick={() => toggleLikeTrack(currentTrack)}
              className={`p-2 rounded-lg transition-colors ${
                isTrackLiked(currentTrack.id)
                  ? 'text-red-500 hover:text-red-400'
                  : 'text-zinc-500 hover:text-white'
              }`}
            >
              <Heart
                className={`h-4 w-4 ${isTrackLiked(currentTrack.id) ? 'fill-current' : ''}`}
              />
            </button>
          )}
        </div>

        {/* Player Controls & Scrubber */}
        <div className="flex-1 max-w-xl flex flex-col items-center gap-2">
          <div className="flex items-center gap-5">
            <button
              onClick={() => setIsShuffle(!isShuffle)}
              className={`transition-colors ${
                isShuffle ? 'text-red-500 hover:text-red-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title={isShuffle ? 'Shuffle enabled' : 'Shuffle disabled'}
            >
              <Shuffle className="h-4 w-4" />
            </button>

            <button
              onClick={handlePrev}
              disabled={!currentTrack}
              className="text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors"
              title="Previous Track"
            >
              <SkipBack className="h-5 w-5" />
            </button>

            <button
              onClick={togglePlay}
              disabled={!currentTrack && searchResults.length === 0}
              className="h-11 w-11 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 transition-all shadow-lg"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isAudioLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-black" />
              ) : isPlaying ? (
                <Pause className="h-5 w-5 fill-current" />
              ) : (
                <Play className="h-5 w-5 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={handleNext}
              disabled={!currentTrack}
              className="text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors"
              title="Next Track"
            >
              <SkipForward className="h-5 w-5" />
            </button>

            <button
              onClick={toggleRepeat}
              className={`transition-colors ${
                repeatMode !== 'off'
                  ? 'text-red-500 hover:text-red-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="h-4 w-4" />
              ) : (
                <Repeat className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="w-full flex items-center gap-3 text-xs text-zinc-400">
            <span className="w-10 text-right font-mono text-[11px]">
              {formatTime(currentTime)}
            </span>
            <div className="relative flex-1 flex items-center">
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-red-500 focus:outline-none"
              />
            </div>
            <span className="w-10 text-left font-mono text-[11px] text-zinc-500">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Volume & Controls */}
        <div className="flex items-center justify-end gap-3 w-1/4 min-w-[220px]">
          <button
            onClick={toggleMute}
            className="text-zinc-400 hover:text-white transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-5 w-5" />
            ) : volume < 0.5 ? (
              <Volume1 className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </button>
          <div className="w-28 flex items-center">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-white focus:outline-none"
            />
          </div>
        </div>
      </footer>
    </div>
  );
}
