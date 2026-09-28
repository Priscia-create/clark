import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database path: Can be configured via environment variable, otherwise uses ./data/database.json
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'database.json');

// Default database fallback
const defaultDB = {
  chat: [
    {
      id: 'chat-init-1',
      sender: 'stephane',
      senderName: 'Stephane',
      text: 'Welcome to our shared space. Ready for movie night.',
      time: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'chat-init-2',
      sender: 'me',
      senderName: 'Stephanelle',
      text: 'Yes! Picked out some good tracks and movies for this week.',
      time: new Date(Date.now() - 1800000).toISOString()
    }
  ],
  activity: [
    {
      id: 'act-init-1',
      text: 'Shared space database initialized',
      time: new Date().toISOString()
    }
  ],
  movies: {
    weekly: {
      mon: {
        id: 'm-1',
        title: 'Interstellar',
        genre: 'Sci-Fi / Drama',
        addedBy: 'stephane',
        addedAt: new Date().toISOString(),
        url: 'https://vjs.zencdn.net/v/oceans.mp4',
        poster: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80',
        watched: false,
        favorite: true
      },
      tue: null,
      wed: {
        id: 'm-2',
        title: 'La La Land',
        genre: 'Romance / Music',
        addedBy: 'me',
        addedAt: new Date().toISOString(),
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        poster: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
        watched: false,
        favorite: false
      },
      thu: null,
      fri: {
        id: 'm-3',
        title: 'About Time',
        genre: 'Romance / Comedy',
        addedBy: 'stephane',
        addedAt: new Date().toISOString(),
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        poster: 'https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=800&auto=format&fit=crop&q=80',
        watched: false,
        favorite: true
      },
      sat: null,
      sun: null
    },
    library: []
  },
  music: {
    playlist: [],
    currentIndex: 0,
    isPlaying: false
  },
  session: {
    movie: {
      url: 'https://vjs.zencdn.net/v/oceans.mp4',
      title: 'Interstellar',
      isPlaying: false,
      currentTime: 0,
      action: 'INIT',
      sender: 'system',
      timestamp: Date.now()
    },
    music: {
      trackIndex: 0,
      trackTitle: 'Night Drive (Lo-Fi)',
      trackUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      isPlaying: false,
      currentTime: 0,
      action: 'INIT',
      sender: 'system',
      timestamp: Date.now()
    }
  }
};

defaultDB.movies.library = Object.values(defaultDB.movies.weekly).filter(Boolean);

let dbState = null;
function loadDatabase() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const content = fs.readFileSync(DB_PATH, 'utf-8');
      dbState = JSON.parse(content);
      console.log(`[db] Loaded database from ${DB_PATH} (${dbState.chat?.length || 0} messages, ${dbState.activity?.length || 0} activities)`);
    }
  } catch (err) {
    console.error('[db] Error reading database file:', err);
  }

  if (!dbState) {
    dbState = JSON.parse(JSON.stringify(defaultDB));
  }

  if (!Array.isArray(dbState.chat)) dbState.chat = defaultDB.chat;
  if (!Array.isArray(dbState.activity)) dbState.activity = defaultDB.activity;
  if (!dbState.movies || !dbState.movies.weekly) dbState.movies = defaultDB.movies;
  if (!dbState.music || !Array.isArray(dbState.music.playlist)) dbState.music = defaultDB.music;
  if (!dbState.session) dbState.session = defaultDB.session;

  saveDatabaseSync();
  return dbState;
}

let saveTimeout = null;
function scheduleSaveDatabase() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveDatabaseSync();
  }, 300);
}

function saveDatabaseSync() {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(dbState, null, 2), 'utf-8');
  } catch (err) {
    console.error('[db] Failed to write database file:', err);
  }
}

// Initial DB load
loadDatabase();

// Setup Express App
const app = express();
app.use(express.json());

// Enable CORS for API routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// 1. Database Full State Endpoint
app.get('/api/db', (req, res) => {
  res.json(dbState);
});

// 2. Chat API Endpoint
app.post('/api/chat', (req, res) => {
  const body = req.body;
  if (body && body.text) {
    const msgId = body.id || 'chat-' + Date.now();
    const exists = dbState.chat.some(m => m.id === msgId);
    if (!exists) {
      const msg = {
        id: msgId,
        sender: body.sender || 'me',
        senderName: body.senderName || 'Me',
        text: body.text,
        time: body.time || new Date().toISOString(),
        instanceId: body.instanceId
      };
      dbState.chat.push(msg);
      if (dbState.chat.length > 500) dbState.chat.shift();
      scheduleSaveDatabase();
      broadcast({ type: 'CHAT_MESSAGE', payload: msg });
      return res.json({ success: true, message: msg });
    } else {
      return res.json({ success: true, deduplicated: true });
    }
  }
  res.status(400).json({ error: 'Missing text' });
});

// 3. Activity API Endpoint
app.post('/api/activity', (req, res) => {
  const body = req.body;
  if (body && body.text) {
    const actId = body.id || 'act-' + Date.now();
    const exists = dbState.activity.some(a => a.id === actId);
    if (!exists) {
      const entry = {
        id: actId,
        text: body.text,
        time: body.time || new Date().toISOString(),
        instanceId: body.instanceId
      };
      dbState.activity.unshift(entry);
      if (dbState.activity.length > 100) dbState.activity.pop();
      scheduleSaveDatabase();
      broadcast({ type: 'ACTIVITY_LOG', payload: entry });
      return res.json({ success: true, entry });
    } else {
      return res.json({ success: true, deduplicated: true });
    }
  }
  res.status(400).json({ error: 'Missing text' });
});

// 4. YouTube Search Endpoint
app.get('/api/youtube-search', async (req, res) => {
  try {
    const q = req.query.q || 'trending movies music trailers';
    const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    const response = await fetch(ytUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    const html = await response.text();
    const match = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);

    const items = [];
    if (match) {
      const data = JSON.parse(match[1]);
      const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
      if (contents) {
        for (const c of contents) {
          const list = c.itemSectionRenderer?.contents;
          if (list) {
            for (const item of list) {
              const v = item.videoRenderer;
              if (v && v.videoId) {
                const thumbs = v.thumbnail?.thumbnails || [];
                const bestThumb = thumbs.length > 0 ? thumbs[thumbs.length - 1].url : `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`;
                items.push({
                  id: v.videoId,
                  title: v.title?.runs?.[0]?.text || 'Video',
                  channel: v.ownerText?.runs?.[0]?.text || (v.longBylineText?.runs?.[0]?.text || 'YouTube'),
                  duration: v.lengthText?.simpleText || 'VIDEO',
                  thumb: bestThumb
                });
              }
            }
          }
        }
      }
    }

    res.json({ query: q, items });
  } catch (err) {
    res.status(500).json({ error: err.message, items: [] });
  }
});

// 5. Spotify OEmbed Endpoint
app.get('/api/spotify-oembed', async (req, res) => {
  try {
    const target = req.query.url;
    if (!target) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }
    const spotRes = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(target)}`);
    const data = await spotRes.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend static assets (production build in dist/ or fallback to root)
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  app.use(express.static(__dirname));
  app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });
}

// Create HTTP server
const server = http.createServer(app);

// Setup WebSocket Server for cross-client real-time synchronization
const wss = new WebSocketServer({ noServer: true });
const clients = new Set();

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === '/ws-sync') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

function broadcast(data, excludeSocket = null) {
  const msg = JSON.stringify(data);
  clients.forEach((client) => {
    if (client !== excludeSocket && client.readyState === 1) {
      client.send(msg);
    }
  });
}

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[sync] Client connected. Total active connections: ${clients.size}`);

  // Send current full state immediately
  ws.send(JSON.stringify({
    type: 'FULL_STATE',
    payload: dbState
  }));

  ws.on('message', (raw) => {
    let data;
    try { data = JSON.parse(raw); } catch { return; }
    const { type, payload } = data;

    if (type === 'CHAT_MESSAGE') {
      if (payload && payload.id) {
        const exists = dbState.chat.some(m => m.id === payload.id);
        if (!exists) {
          dbState.chat.push(payload);
          if (dbState.chat.length > 500) dbState.chat.shift();
          scheduleSaveDatabase();
        }
      }
      broadcast({ type, payload }, ws);
    } else if (type === 'ACTIVITY_LOG') {
      if (payload && payload.id) {
        const exists = dbState.activity.some(a => a.id === payload.id);
        if (!exists) {
          dbState.activity.unshift(payload);
          if (dbState.activity.length > 100) dbState.activity.pop();
          scheduleSaveDatabase();
        }
      }
      broadcast({ type, payload }, ws);
    } else if (type === 'MOVIE_SYNC') {
      dbState.session.movie = { ...dbState.session.movie, ...payload };
      scheduleSaveDatabase();
      broadcast({ type, payload }, ws);
    } else if (type === 'MUSIC_SYNC') {
      dbState.session.music = { ...dbState.session.music, ...payload };
      scheduleSaveDatabase();
      broadcast({ type, payload }, ws);
    } else if (type === 'MOVIES_UPDATE') {
      if (payload && payload.movies) {
        dbState.movies = payload.movies;
        scheduleSaveDatabase();
      }
      broadcast({ type, payload }, ws);
    } else if (type === 'MUSIC_UPDATE') {
      if (payload && payload.music) {
        dbState.music = payload.music;
        scheduleSaveDatabase();
      }
      broadcast({ type, payload }, ws);
    } else if (type === 'REQUEST_STATE') {
      ws.send(JSON.stringify({
        type: 'FULL_STATE',
        payload: dbState
      }));
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[sync] Client disconnected. Total active connections: ${clients.size}`);
  });

  ws.on('error', () => clients.delete(ws));
});

// Port selection (standard for all cloud hosts)
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] StephaneVerse production server running on port ${PORT}`);
  console.log(`[server] WebSocket synchronization active at /ws-sync`);
});
