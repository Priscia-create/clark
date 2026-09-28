/**
 * StephaneVerse Store
 * Unified shared profile for Stephane & Stephanelle.
 * Cross-browser real-time sync with local persistent database.
 * Real-time WebSocket + HTTP sync bus.
 * Zero emojis, no robotic phrasing.
 */

const STORAGE_PREFS_KEY = 'stephaneverse_prefs_v9';
const STORAGE_SENDER_KEY = 'stephaneverse_active_sender';
const WS_URL = `${typeof location !== 'undefined' ? (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host : 'ws://127.0.0.1:5173'}/ws-sync`;

// Unique instance ID for this specific browser tab/window
const INSTANCE_ID = `inst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const defaultData = {
  isEntered: false,
  activeSender: 'me',
  users: {
    stephane: { id: 'stephane', name: 'Stephane' },
    me: { id: 'me', name: 'Stephanelle' }
  },
  movies: {
    weekly: {
      mon: null,
      tue: null,
      wed: null,
      thu: null,
      fri: null,
      sat: null,
      sun: null
    },
    library: []
  },
  guesses: { correct: 0, total: 0, streak: 0, results: {} },
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
  },
  chat: [],
  activity: []
};

class Store {
  constructor() {
    this.data = JSON.parse(JSON.stringify(defaultData));
    this.listeners = [];
    this.ws = null;
    this.wsReady = false;
    this.wsQueue = [];
    this._merging = false;

    // Load active sender preference for this specific browser window
    const savedSender = localStorage.getItem(STORAGE_SENDER_KEY);
    if (savedSender === 'stephane' || savedSender === 'me') {
      this.data.activeSender = savedSender;
    }

    const savedPrefs = localStorage.getItem(STORAGE_PREFS_KEY);
    if (savedPrefs) {
      try {
        const parsed = JSON.parse(savedPrefs);
        // Don't restore isEntered — always show landing page on load
        if (parsed.guesses) this.data.guesses = parsed.guesses;
      } catch (e) {}
    }

    // 1. Immediately hydrate from persistent local database via HTTP
    this._fetchInitialDb();

    // 2. Connect WebSocket for real-time live sync
    this._connectWebSocket();

    // 3. Fallback BroadcastChannel for tabs on same browser
    this._setupBroadcastChannel();

    // 4. Background polling sync (every 6s) as guarantee
    setInterval(() => {
      this._pollDatabaseSync();
    }, 6000);
  }

  // ---- Database Hydration via HTTP ----
  async _fetchInitialDb() {
    try {
      const res = await fetch('/api/db');
      if (res.ok) {
        const db = await res.json();
        this._mergeDatabaseState(db);
      }
    } catch (e) {
      console.warn('[store] Initial DB fetch error, waiting for WebSocket:', e);
    }
  }

  async _pollDatabaseSync() {
    try {
      const res = await fetch('/api/db');
      if (res.ok) {
        const db = await res.json();

        // Check if new chat messages arrived
        if (db.chat && Array.isArray(db.chat)) {
          const currentIds = new Set(this.data.chat.map(m => m.id));
          let hasNewChat = false;
          db.chat.forEach(m => {
            if (m && m.id && !currentIds.has(m.id)) {
              this.data.chat.push(m);
              currentIds.add(m.id);
              hasNewChat = true;
            }
          });
          if (hasNewChat) {
            this.notify('chat');
          }
        }

        // Check if new activity arrived
        if (db.activity && Array.isArray(db.activity)) {
          const currentActIds = new Set(this.data.activity.map(a => a.id));
          let hasNewAct = false;
          db.activity.forEach(a => {
            if (a && a.id && !currentActIds.has(a.id)) {
              this.data.activity.push(a);
              currentActIds.add(a.id);
              hasNewAct = true;
            }
          });
          if (hasNewAct) {
            this.notify('activity');
          }
        }

        // Check if library count changed
        if (db.movies && db.movies.library && db.movies.library.length !== this.data.movies.library.length) {
          this.data.movies = db.movies;
          this.notify('movies');
        }

        // Check if playlist count changed
        if (db.music && db.music.playlist && db.music.playlist.length !== this.data.music.playlist.length) {
          this.data.music = db.music;
          this.notify('music');
        }
      }
    } catch (e) {}
  }

  isMerging() {
    return this._merging;
  }

  _mergeDatabaseState(db) {
    if (!db) return;
    this._merging = true;
    if (Array.isArray(db.chat)) {
      const seen = new Set();
      this.data.chat = db.chat.filter(m => {
        if (!m || !m.id || seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
    }
    if (Array.isArray(db.activity)) {
      const seen = new Set();
      this.data.activity = db.activity.filter(a => {
        if (!a || !a.id || seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
      });
    }
    if (db.movies && db.movies.weekly) {
      this.data.movies = db.movies;
    }
    if (db.music && Array.isArray(db.music.playlist)) {
      this.data.music = db.music;
    }
    if (db.session) {
      this.data.session = db.session;
    }

    this.notify('sync');
    this.notify('chat');
    this.notify('activity');
    this.notify('movies');
    this.notify('music');

    // Release merge lock after all notifications processed
    setTimeout(() => { this._merging = false; }, 500);
  }

  _savePrefs() {
    try {
      localStorage.setItem(STORAGE_PREFS_KEY, JSON.stringify({
        isEntered: this.data.isEntered,
        guesses: this.data.guesses
      }));
    } catch (e) {}
  }

  // ---- WebSocket Sync Channel ----
  _connectWebSocket() {
    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        this.wsReady = true;
        // Flush pending queued packets
        while (this.wsQueue.length > 0) {
          const item = this.wsQueue.shift();
          if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(item);
          }
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this._handleRemotePacket(data);
        } catch (e) {}
      };

      this.ws.onclose = () => {
        this.wsReady = false;
        setTimeout(() => this._connectWebSocket(), 2500);
      };

      this.ws.onerror = () => {
        this.wsReady = false;
      };
    } catch (e) {
      console.warn('WebSocket connection not ready:', e);
    }
  }

  _wsSend(type, payload) {
    const packet = JSON.stringify({
      type,
      payload,
      instanceId: INSTANCE_ID,
      timestamp: Date.now()
    });

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(packet);
    } else {
      this.wsQueue.push(packet);
    }
  }

  _handleRemotePacket(data) {
    if (!data || !data.type) return;
    const { type, payload } = data;

    if (type === 'FULL_STATE') {
      this._mergeDatabaseState(payload);
      return;
    }

    if (type === 'CHAT_MESSAGE') {
      if (payload.instanceId === INSTANCE_ID) return;
      // Deduplicate by message ID
      const exists = this.data.chat.some(m => m.id === payload.id);
      if (!exists) {
        this.data.chat.push(payload);
        this.notify('chat', payload);
      }
      return;
    }

    if (type === 'ACTIVITY_LOG') {
      if (payload.instanceId === INSTANCE_ID) return;
      const exists = this.data.activity.some(a => a.id === payload.id);
      if (!exists) {
        this.data.activity.unshift(payload);
        if (this.data.activity.length > 100) this.data.activity.pop();
        this.notify('activity', payload);
      }
      return;
    }

    if (type === 'MOVIE_SYNC') {
      if (payload.instanceId === INSTANCE_ID) return;
      this.data.session.movie = { ...this.data.session.movie, ...payload };
      this.notify('movie_sync', payload);
      return;
    }

    if (type === 'MUSIC_SYNC') {
      if (payload.instanceId === INSTANCE_ID) return;
      this.data.session.music = { ...this.data.session.music, ...payload };
      this.notify('music_sync', payload);
      return;
    }

    if (type === 'MOVIES_UPDATE') {
      if (payload.instanceId === INSTANCE_ID) return;
      if (payload.movies) {
        this.data.movies = payload.movies;
        this.notify('movies');
      }
      return;
    }

    if (type === 'MUSIC_UPDATE') {
      if (payload.instanceId === INSTANCE_ID) return;
      if (payload.music) {
        this.data.music = payload.music;
        this.notify('music');
      }
      return;
    }
  }

  // ---- BroadcastChannel fallback ----
  _setupBroadcastChannel() {
    try {
      this._bc = new BroadcastChannel('stephaneverse_bc_v9');
      this._bc.onmessage = (e) => {
        if (this.wsReady) return; // WS takes precedence
        this._handleRemotePacket(e.data);
      };
    } catch (e) {}
  }

  _bcBroadcast(type, payload) {
    try {
      if (this._bc) this._bc.postMessage({ type, payload, instanceId: INSTANCE_ID });
    } catch (e) {}
  }

  // ---- Public Event Subscription API ----
  subscribe(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  notify(event, payload) {
    this.listeners.forEach((fn) => {
      try { fn(event, payload); } catch (e) { console.error('Listener error:', e); }
    });
  }

  // ---- App Auth / Entrance ----
  enter() {
    this.data.isEntered = true;
    this._savePrefs();
    this.notify('enter');
  }

  exit() {
    this.data.isEntered = false;
    this._savePrefs();
    this.notify('exit');
  }

  isEntered() {
    return !!this.data.isEntered;
  }

  // ---- Sender Identity (Stephane vs Stephanelle / Me) ----
  getActiveSender() {
    return this.data.activeSender || 'me';
  }

  setActiveSender(sender) {
    this.data.activeSender = sender;
    try {
      localStorage.setItem(STORAGE_SENDER_KEY, sender);
    } catch (e) {}
    this.notify('sender_change', sender);
  }

  toggleActiveSender() {
    const next = this.getActiveSender() === 'stephane' ? 'me' : 'stephane';
    this.setActiveSender(next);
    return next;
  }

  getSenderName(senderId) {
    if (senderId === 'stephane') return 'Stephane';
    return 'Stephanelle';
  }

  // ---- Chat System (Persistent local database + Cross-Browser real-time sync) ----
  getChatMessages() {
    return this.data.chat || [];
  }

  sendChatMessage(text) {
    const sender = this.getActiveSender();
    const senderName = this.getSenderName(sender);
    const message = {
      id: 'chat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      sender,
      senderName,
      text: text.trim(),
      time: new Date().toISOString(),
      instanceId: INSTANCE_ID
    };

    // 1. Local update (check duplicate)
    if (!this.data.chat.some(m => m.id === message.id)) {
      this.data.chat.push(message);
      this.notify('chat', message);
    }

    // 2. Real-time broadcast
    this._wsSend('CHAT_MESSAGE', message);
    this._bcBroadcast('CHAT_MESSAGE', message);

    // 3. Fallback to HTTP only if WebSocket is not open
    if (!this.wsReady) {
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      }).catch(() => {});
    }

    // 4. Log activity
    this.logActivity(`${senderName}: "${text.slice(0, 32)}${text.length > 32 ? '...' : ''}"`);

    return message;
  }

  // ---- Activity System (Persistent local database + Cross-Browser real-time sync) ----
  getActivity() {
    return this.data.activity || [];
  }

  logActivity(text) {
    if (this._merging) return; // Don't log during state hydration
    const entry = {
      id: 'act-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      text,
      time: new Date().toISOString(),
      instanceId: INSTANCE_ID
    };

    if (!this.data.activity.some(a => a.id === entry.id)) {
      this.data.activity.unshift(entry);
      if (this.data.activity.length > 100) this.data.activity.pop();
      this.notify('activity', entry);
    }

    this._wsSend('ACTIVITY_LOG', entry);
    this._bcBroadcast('ACTIVITY_LOG', entry);

    if (!this.wsReady) {
      fetch('/api/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      }).catch(() => {});
    }
  }

  // ---- Movie Session Sync (Watch Together) ----
  syncMovie(actionData) {
    if (this._merging) return; // Don't broadcast during state hydration
    const payload = {
      ...this.data.session.movie,
      ...actionData,
      sender: this.getActiveSender(),
      instanceId: INSTANCE_ID,
      timestamp: Date.now()
    };
    this.data.session.movie = payload;
    this._wsSend('MOVIE_SYNC', payload);
    this._bcBroadcast('MOVIE_SYNC', payload);
  }

  getMovieSession() {
    return this.data.session.movie;
  }

  // ---- Music Session Sync (PrisciaVerse Listening Party) ----
  syncMusic(actionData) {
    if (this._merging) return; // Don't broadcast during state hydration
    const payload = {
      ...this.data.session.music,
      ...actionData,
      sender: this.getActiveSender(),
      instanceId: INSTANCE_ID,
      timestamp: Date.now()
    };
    this.data.session.music = payload;
    this._wsSend('MUSIC_SYNC', payload);
    this._bcBroadcast('MUSIC_SYNC', payload);
  }

  getMusicSession() {
    return this.data.session.music;
  }

  // ---- Movies Management ----
  getWeeklyMovies() {
    return this.data.movies.weekly;
  }

  getLibrary() {
    return this.data.movies.library;
  }

  addWeeklyMovie(day, movieData) {
    const sender = this.getActiveSender();
    const senderName = this.getSenderName(sender);
    const movie = {
      id: 'm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      ...movieData,
      addedBy: sender,
      addedAt: new Date().toISOString(),
      watched: false,
      favorite: false
    };

    this.data.movies.weekly[day] = movie;
    this.data.movies.library.push(movie);

    this.logActivity(`${movie.title} was added to ${day.toUpperCase()} by ${senderName}`);
    this._syncMoviesState();
    this.notify('movies');
    return movie;
  }

  removeMovie(movieId) {
    const senderName = this.getSenderName(this.getActiveSender());
    let removedTitle = 'Movie';

    const idx = this.data.movies.library.findIndex((m) => m.id === movieId);
    if (idx !== -1) {
      removedTitle = this.data.movies.library[idx].title;
      this.data.movies.library.splice(idx, 1);
    }

    Object.keys(this.data.movies.weekly).forEach((day) => {
      if (this.data.movies.weekly[day] && this.data.movies.weekly[day].id === movieId) {
        if (!removedTitle || removedTitle === 'Movie') {
          removedTitle = this.data.movies.weekly[day].title;
        }
        this.data.movies.weekly[day] = null;
      }
    });

    this.logActivity(`${removedTitle} was removed by ${senderName}`);
    this._syncMoviesState();
    this.notify('movies');
  }

  _syncMoviesState() {
    if (this._merging) return; // Don't broadcast during state hydration
    const payload = {
      movies: this.data.movies,
      instanceId: INSTANCE_ID
    };
    this._wsSend('MOVIES_UPDATE', payload);
    this._bcBroadcast('MOVIES_UPDATE', payload);
  }

  markWatched(movieId) {
    const movie = this.data.movies.library.find((m) => m.id === movieId);
    if (movie) {
      movie.watched = true;
      this.logActivity(`${movie.title} was watched together`);
      this._syncMoviesState();
      this.notify('movies');
    }
  }

  // ---- Guess Game ----
  makeGuess(movieId, guess) {
    const movie = this.data.movies.library.find((m) => m.id === movieId);
    if (!movie) return null;
    const correct = guess === movie.addedBy;
    if (!this.data.guesses.results) this.data.guesses.results = {};
    this.data.guesses.results[movieId] = { guess, correct };
    this.data.guesses.total++;
    if (correct) {
      this.data.guesses.correct++;
      this.data.guesses.streak++;
    } else {
      this.data.guesses.streak = 0;
    }
    this._savePrefs();
    this.notify('guesses');
    this.logActivity(`${this.getSenderName(this.getActiveSender())} guessed on ${movie.title} (${correct ? 'Correct' : 'Wrong'})`);
    return { correct, addedBy: movie.addedBy };
  }

  getGuessStats() {
    return this.data.guesses;
  }

  hasGuessed(movieId) {
    return !!(this.data.guesses.results && this.data.guesses.results[movieId]);
  }

  // ---- Music Playlist Management ----
  getPlaylist() {
    return this.data.music.playlist;
  }

  addSong(song, addedBy) {
    const sender = addedBy || this.getActiveSender();
    const senderName = this.getSenderName(sender);
    const newSong = {
      id: 's-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      ...song,
      addedBy: sender,
      favorite: false
    };

    this.data.music.playlist.push(newSong);
    this.logActivity(`${newSong.title} was added to music playlist by ${senderName}`);
    this._syncMusicState();
    this.notify('music');
    return newSong;
  }

  removeSong(songId) {
    const idx = this.data.music.playlist.findIndex((s) => s.id === songId);
    if (idx === -1) return;
    const removed = this.data.music.playlist.splice(idx, 1)[0];
    const senderName = this.getSenderName(this.getActiveSender());
    this.logActivity(`${removed.title} was removed by ${senderName}`);
    this._syncMusicState();
    this.notify('music');
  }

  _syncMusicState() {
    if (this._merging) return; // Don't broadcast during state hydration
    const payload = {
      music: this.data.music,
      instanceId: INSTANCE_ID
    };
    this._wsSend('MUSIC_UPDATE', payload);
    this._bcBroadcast('MUSIC_UPDATE', payload);
  }
}

export const store = new Store();
