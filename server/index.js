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
    console.log('[Innertube] Initializing client with ANDROID client_type...');
    try {
      ytInstance = await Innertube.create({
        client_type: 'ANDROID',
      });
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

    // Query stream info with client fallback (IOS provides unthrottled direct format.url; ANDROID fallback)
    let info = null;
    let format = null;

    for (const client of ['IOS', 'ANDROID']) {
      try {
        const candidateInfo = await yt.getBasicInfo(id, { client });
        let candidateFormat = null;
        try {
          candidateFormat = candidateInfo.chooseFormat({ type: 'audio', quality: 'best' });
        } catch {
          const adaptive = candidateInfo.streaming_data?.adaptive_formats?.filter((f) => f.has_audio);
          candidateFormat = adaptive?.[0] || candidateInfo.chooseFormat({ type: 'audio' });
        }

        if (candidateFormat && (candidateFormat.url || candidateFormat.signature_cipher)) {
          info = candidateInfo;
          format = candidateFormat;
          break;
        }

        if (!format && candidateFormat) {
          info = candidateInfo;
          format = candidateFormat;
        }
      } catch (clientErr) {
        console.warn(`[Client ${client} notice for ${id}]:`, clientErr.message);
      }
    }

    if (!format && !info) {
      info = await yt.getBasicInfo(id);
      format = info.chooseFormat({ type: 'audio', quality: 'best' });
    }

    if (!format) {
      return res.status(404).json({ error: 'No compatible audio format found' });
    }

    // Resolve direct or deciphered stream URL
    let streamUrl = format.url;
    if (!streamUrl && typeof format.decipher === 'function') {
      try {
        streamUrl = await format.decipher(yt.session.player);
      } catch (decErr) {
        console.warn(`[Decipher notice for ${id}]:`, decErr.message);
      }
    }

    if (!streamUrl) {
      return res.status(500).json({ error: 'Failed to resolve stream URL' });
    }

    // Setup headers with Android User-Agent and Range header
    const rangeHeader = req.headers.range;
    const upstreamHeaders = {
      'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
    };

    if (rangeHeader) {
      upstreamHeaders.Range = rangeHeader;
    }

    const response = await fetch(streamUrl, {
      headers: upstreamHeaders,
    });

    // Log upstream status code if not 200/206
    if (response.status !== 200 && response.status !== 206) {
      console.warn(`[Upstream Audio Warning for ${id}] Status: ${response.status} ${response.statusText}`);
    }

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
      res.setHeader('Content-Type', format.mime_type || 'audio/mp4');
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
