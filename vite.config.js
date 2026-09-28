import { defineConfig } from 'vite';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import os from 'os';
const DB_DIR = path.join(os.tmpdir(), 'stephaneverse-db');
const DB_PATH = path.join(DB_DIR, 'database.json');
const OLD_DB_PATH = path.join(__dirname, 'data', 'database.json');

// ---- Default Database Seed ----
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
    playlist: [
      {
        id: 's-1',
        title: 'Night Drive (Lo-Fi)',
        artist: 'Stephane & Stephanelle',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        art: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&auto=format&fit=crop&q=80',
        addedBy: 'stephane',
        favorite: true
      },
      {
        id: 's-2',
        title: 'Golden Hour Melody',
        artist: 'Priscia',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
        art: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&auto=format&fit=crop&q=80',
        addedBy: 'me',
        favorite: true
      },
      {
        id: 's-3',
        title: 'Midnight Starlight',
        artist: 'Stephane',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
        art: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
        addedBy: 'stephane',
        favorite: false
      }
    ],
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

// ---- Persistent Database Loader & Saver ----
let dbState = null;
function loadDatabase() {
  try {
    // Try new temp location first
    if (fs.existsSync(DB_PATH)) {
      const content = fs.readFileSync(DB_PATH, 'utf-8');
      dbState = JSON.parse(content);
    } else if (fs.existsSync(OLD_DB_PATH)) {
      // Migrate from old project-internal location
      const content = fs.readFileSync(OLD_DB_PATH, 'utf-8');
      dbState = JSON.parse(content);
      console.log('[db] Migrated database from project data/ to temp directory');
    } else {
      dbState = null;
    }
    if (dbState) {
      // Ensure all top-level keys exist
      if (!Array.isArray(dbState.chat)) dbState.chat = defaultDB.chat;
      if (!Array.isArray(dbState.activity)) dbState.activity = defaultDB.activity;
      if (!dbState.movies || !dbState.movies.weekly) dbState.movies = defaultDB.movies;
      if (!dbState.music || !Array.isArray(dbState.music.playlist)) dbState.music = defaultDB.music;
      if (!dbState.session) dbState.session = defaultDB.session;
      console.log(`[db] Loaded database from ${DB_PATH} (${dbState.chat.length} messages, ${dbState.activity.length} activities)`);
      saveDatabaseSync();
      return dbState;
    }
  } catch (err) {
    console.error('[db] Error reading database file:', err);
  }
  dbState = JSON.parse(JSON.stringify(defaultDB));
  saveDatabaseSync();
  return dbState;
}

let saveTimeout = null;
function scheduleSaveDatabase() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveDatabaseSync();
  }, 200);
}

function saveDatabaseSync() {
  try {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(dbState, null, 2), 'utf-8');
  } catch (err) {
    console.error('[db] Failed to write database file:', err);
  }
}

// Load on start
loadDatabase();

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    open: false,
    hmr: {
      overlay: false
    }
  },
  plugins: [
    {
      name: 'shared-sync-server',
      configureServer(server) {
        // ---- WebSocket Server for Cross-Browser Real-Time Sync ----
        // Use noServer mode to avoid conflicting with Vite's own HMR WebSocket
        const wss = new WebSocketServer({ noServer: true });
        const clients = new Set();

        // Manually handle HTTP upgrade only for our /ws-sync path
        server.httpServer.on('upgrade', (request, socket, head) => {
          const url = new URL(request.url, 'http://localhost');
          if (url.pathname === '/ws-sync') {
            wss.handleUpgrade(request, socket, head, (ws) => {
              wss.emit('connection', ws, request);
            });
          }
          // Don't destroy socket for other paths — let Vite HMR handle them
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
          console.log(`[sync] Client connected. Total active windows: ${clients.size}`);

          // Send current full database state to new window immediately
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
                // Deduplicate by id
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
            console.log(`[sync] Client disconnected. Total active windows: ${clients.size}`);
          });

          ws.on('error', () => clients.delete(ws));
        });

        server.httpServer.on('close', () => {
          saveDatabaseSync();
          wss.close();
        });

        console.log('[sync] WebSocket database sync running on ws://127.0.0.1:5174');

        // ---- HTTP API Middleware ----
        server.middlewares.use(async (req, res, next) => {
          // Helper for reading JSON body
          const readJsonBody = () => new Promise((resolve) => {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
              try { resolve(JSON.parse(body)); } catch { resolve({}); }
            });
          });

          // 1. Database Full State Endpoint
          if (req.url === '/api/db' && req.method === 'GET') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify(dbState));
            return;
          }

          // 2. Chat API Endpoint (HTTP fallback)
          if (req.url === '/api/chat' && req.method === 'POST') {
            const body = await readJsonBody();
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
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: true, message: msg }));
                return;
              } else {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: true, deduplicated: true }));
                return;
              }
            }
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing text' }));
            return;
          }

          // 3. Activity API Endpoint
          if (req.url === '/api/activity' && req.method === 'POST') {
            const body = await readJsonBody();
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
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: true, entry }));
                return;
              } else {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: true, deduplicated: true }));
                return;
              }
            }
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing text' }));
            return;
          }

          // 4. YouTube Search Endpoint
          if (req.url && req.url.startsWith('/api/youtube-search')) {
            try {
              const urlObj = new URL(req.url, 'http://127.0.0.1:5173');
              const q = urlObj.searchParams.get('q') || 'trending movies music trailers';

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

              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ query: q, items }));
              return;
            } catch (err) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message, items: [] }));
              return;
            }
          }

          // 5. Spotify OEmbed Endpoint
          if (req.url && req.url.startsWith('/api/spotify-oembed')) {
            try {
              const urlObj = new URL(req.url, 'http://127.0.0.1:5173');
              const target = urlObj.searchParams.get('url');
              if (!target) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Missing url parameter' }));
                return;
              }
              const spotRes = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(target)}`);
              const data = await spotRes.json();
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify(data));
              return;
            } catch (err) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
              return;
            }
          }

          next();
        });
      }
    }
  ],
  build: {
    outDir: 'dist'
  }
});
