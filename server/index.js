import express from 'express';
import cors from 'cors';
import { Readable } from 'node:stream';
import { Innertube } from 'youtubei.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

let ytInstance = null;
let ytInitPromise = null;

async function getInnertube() {
  if (ytInstance) return ytInstance;
  if (ytInitPromise) return ytInitPromise;

  ytInitPromise = (async () => {
    console.log('[Innertube] Initializing client...');
    try {
      ytInstance = await Innertube.create();
      console.log('[Innertube] Initialized successfully');
      return ytInstance;
    } catch (err) {
      ytInitPromise = null;
      console.error('[Innertube] Initialization error:', err);
      throw err;
    }
  })();

  return ytInitPromise;
}

// Helper to map search results to standard track objects
function mapSongItems(songItems) {
  return songItems
    .map((item) => {
      let durationStr = '0:00';
      if (item.duration?.text) {
        durationStr = item.duration.text;
      } else if (item.duration?.seconds) {
        const mins = Math.floor(item.duration.seconds / 60);
        const secs = String(item.duration.seconds % 60).padStart(2, '0');
        durationStr = `${mins}:${secs}`;
      }

      let thumb = '';
      if (item.thumbnail?.contents?.length) {
        thumb = item.thumbnail.contents[item.thumbnail.contents.length - 1].url;
      } else if (item.thumbnails?.length) {
        thumb = item.thumbnails[item.thumbnails.length - 1].url;
      }

      let artistName = 'Unknown Artist';
      if (item.artists && Array.isArray(item.artists)) {
        artistName = item.artists.map((a) => a.name).filter(Boolean).join(', ');
      } else if (item.author?.name) {
        artistName = item.author.name;
      } else if (item.authors && Array.isArray(item.authors)) {
        artistName = item.authors.map((a) => a.name).filter(Boolean).join(', ');
      }

      return {
        id: item.id,
        title: item.title || 'Unknown Title',
        artist: artistName || 'Unknown Artist',
        duration: durationStr,
        thumbnail: thumb,
      };
    })
    .filter((track) => !!track.id);
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

// Trending / Initial hits endpoint
app.get('/api/trending', async (req, res) => {
  try {
    const yt = await getInnertube();
    const searchResults = await yt.music.search('top hits', { type: 'song' });
    const songItems = searchResults.songs?.contents || [];
    const tracks = mapSongItems(songItems);
    res.json({ results: tracks });
  } catch (err) {
    console.error('[Trending Error]:', err);
    res.status(500).json({ error: 'Failed to fetch trending tracks', message: err.message });
  }
});

// Search YouTube Music tracks
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid search query (?q=)' });
  }

  try {
    const yt = await getInnertube();
    const searchResults = await yt.music.search(query, { type: 'song' });
    const songItems = searchResults.songs?.contents || [];
    const tracks = mapSongItems(songItems);
    res.json({ results: tracks });
  } catch (err) {
    console.error('[Search Error]:', err);
    res.status(500).json({ error: 'Search failed', message: err.message });
  }
});

// Stream audio chunks with Range header support and fallback format
app.get('/api/stream/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Track ID is required' });
  }

  try {
    const yt = await getInnertube();
    const info = await yt.getBasicInfo(id);

    // Resolve best audio format with fallback
    let format = null;
    try {
      format = info.chooseFormat({ type: 'audio', quality: 'best' });
    } catch (e) {
      console.warn(`[Format Notice] quality:best selection failed for ${id}, attempting fallback:`, e.message);
    }

    if (!format) {
      const adaptiveAudio = info.streaming_data?.adaptive_formats?.filter((f) => f.has_audio);
      if (adaptiveAudio && adaptiveAudio.length > 0) {
        format = adaptiveAudio[0];
      } else {
        format = info.chooseFormat({ type: 'audio' });
      }
    }

    if (!format) {
      return res.status(404).json({ error: 'No compatible audio format found' });
    }

    // Decipher stream URL
    let decipheredUrl = format.url;
    if (!decipheredUrl && typeof format.decipher === 'function') {
      decipheredUrl = await format.decipher(yt.session.player);
    }

    if (!decipheredUrl) {
      return res.status(500).json({ error: 'Failed to decipher stream URL' });
    }

    const rangeHeader = req.headers.range;
    const upstreamHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    if (rangeHeader) {
      upstreamHeaders.Range = rangeHeader;
    }

    const response = await fetch(decipheredUrl, {
      headers: upstreamHeaders,
    });

    res.status(response.status);

    const forwardHeaders = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'cache-control',
    ];

    forwardHeaders.forEach((h) => {
      const val = response.headers.get(h);
      if (val) {
        res.setHeader(h, val);
      }
    });

    res.setHeader('Accept-Ranges', 'bytes');
    if (!res.getHeader('content-type')) {
      res.setHeader('Content-Type', format.mime_type || 'audio/webm');
    }

    const bodyStream = Readable.fromWeb(response.body);

    req.on('close', () => {
      bodyStream.destroy();
    });

    bodyStream.pipe(res);
  } catch (err) {
    console.error(`[Stream Error for ${id}]:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Streaming failed', message: err.message });
    }
  }
});

app.listen(PORT, () => {
  console.log(`[Audio Server] Running on http://localhost:${PORT}`);
  getInnertube().catch((e) => console.warn('[Innertube] Eager initialization deferred:', e.message));
});
