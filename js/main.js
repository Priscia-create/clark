/**
 * StephaneVerse — Main Application
 * Unified shared profile for Stephane & Stephanelle.
 * Pinkish Gothic PrisciaVerse & Shared Space Theme.
 * Real-time synchronized session party for movies and music.
 * Zero emojis, no robotic descriptions.
 */

import { store } from './store.js';
import { initParticles, initAudioVisualizer, setVisualizerPlaying, startMusicSakuras, stopMusicSakuras } from './animations.js';
import { Basketball3D } from './basketball3d.js';
import { Spiders3D } from './spiders3d.js';

let basketball = null;
let spiders = null;
let isRemoteVideoSync = false;
let isRemoteMusicSync = false;

document.addEventListener('DOMContentLoaded', () => {
  // Background non-blocking web particles
  initParticles();

  // Setup pinkish gothic audio visualizer
  initAudioVisualizer('gothic-audio-visualizer');

  // Setup UI handlers
  setupAuth();
  setupNavigation();
  setupSenderToggle();
  setupMovies();
  setupMusic();
  setupChat();
  setupActivity();

  // Reactive store subscription
  store.subscribe((event, payload) => {
    if (event === 'exit') {
      showLandingPage();
    } else if (event === 'enter') {
      enterStephaneVerse();
    } else if (event === 'sender_change') {
      updateSenderDisplay();
    } else if (event === 'movies') {
      renderWeeklySchedule();
      renderAllMovies();
      renderGuessGame();
      renderActivity();
    } else if (event === 'music') {
      renderPlaylist();
    } else if (event === 'chat') {
      renderChat();
    } else if (event === 'activity') {
      renderActivity();
    } else if (event === 'guesses') {
      renderGuessGame();
    } else if (event === 'movie_sync') {
      if (!store.isMerging()) handleRemoteMovieSync(payload);
    } else if (event === 'music_sync') {
      if (!store.isMerging()) handleRemoteMusicSync(payload);
    } else if (event === 'sync') {
      // Full state from server received (new connection or reconnect)
      // Only re-render UI, do NOT trigger sync broadcasts
      renderWeeklySchedule();
      renderAllMovies();
      renderGuessGame();
      renderPlaylist();
      renderChat();
      renderActivity();
    }
  });


  // If already entered session, load main app
  if (store.isEntered()) {
    enterStephaneVerse();
  }
});

// ---- 1. UNIFIED AUTH & GATEWAY ----
function setupAuth() {
  const enterUnlockedBtn = document.getElementById('btn-enter-unlocked');
  const passInput = document.getElementById('login-password');
  const hintMsg = document.getElementById('passcode-hint-msg');
  const exitBtn = document.getElementById('btn-exit-app');

  const acceptedList = ['1234', 'stephane', 'stephanelle', 'stephanas', 'clark', 'love', 'verse', 'duo'];

  function checkPasscode() {
    if (!passInput) return false;
    const val = passInput.value.trim().toLowerCase();
    const isValid = acceptedList.includes(val) || val.length >= 4;

    if (isValid) {
      if (enterUnlockedBtn) enterUnlockedBtn.style.display = 'inline-flex';
      if (hintMsg) {
        hintMsg.textContent = 'Code verified. Click Enter to access.';
        hintMsg.classList.add('verified');
        hintMsg.classList.remove('wrong');
      }
      return true;
    } else {
      if (enterUnlockedBtn) enterUnlockedBtn.style.display = 'none';
      if (hintMsg) {
        hintMsg.textContent = val.length > 0 ? 'Incorrect code' : 'Enter correct code to unlock';
        hintMsg.classList.remove('verified');
        if (val.length > 0) hintMsg.classList.add('wrong');
      }
      return false;
    }
  }

  function tryEnter() {
    if (checkPasscode()) {
      store.enter();
      enterStephaneVerse();
    }
  }

  if (passInput) {
    passInput.addEventListener('input', checkPasscode);
    passInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (checkPasscode()) tryEnter();
      }
    });
  }

  if (enterUnlockedBtn) {
    enterUnlockedBtn.addEventListener('click', tryEnter);
  }

  // Return to Landing Page
  if (exitBtn) {
    exitBtn.addEventListener('click', () => {
      store.exit();
      showLandingPage();
    });
  }
}

function showLandingPage() {
  document.getElementById('main-app').style.display = 'none';
  const landing = document.getElementById('landing-page');
  landing.style.display = 'flex';
  landing.classList.add('active');

  const passInput = document.getElementById('login-password');
  if (passInput) passInput.value = '';
  const enterUnlockedBtn = document.getElementById('btn-enter-unlocked');
  if (enterUnlockedBtn) enterUnlockedBtn.style.display = 'none';
  const hintMsg = document.getElementById('passcode-hint-msg');
  if (hintMsg) {
    hintMsg.textContent = 'Enter correct code to unlock';
    hintMsg.classList.remove('verified', 'wrong');
  }

  stopMusicSakuras();
}

function enterStephaneVerse() {
  document.getElementById('landing-page').classList.remove('active');
  document.getElementById('landing-page').style.display = 'none';
  const mainApp = document.getElementById('main-app');
  mainApp.style.display = 'flex';

  updateSenderDisplay();

  // Initialize or resize 3D basketball in static transparent cube
  setTimeout(() => {
    if (!basketball) {
      basketball = new Basketball3D('basketball-3d-container');
    } else {
      basketball.resize();
    }
  }, 100);

  // Render all views
  renderWeeklySchedule();
  renderAllMovies();
  renderGuessGame();
  renderPlaylist();
  renderChat();
  renderActivity();
}

// ---- 2. SENDER TOGGLER (Stephane / Me) ----
function setupSenderToggle() {
  const navToggleBtn = document.getElementById('btn-sender-toggle');
  const chatPill = document.getElementById('chat-sender-pill');

  function toggleSender() {
    const next = store.toggleActiveSender();
    updateSenderDisplay();
  }

  if (navToggleBtn) navToggleBtn.addEventListener('click', toggleSender);
  if (chatPill) chatPill.addEventListener('click', toggleSender);
}

function updateSenderDisplay() {
  const activeSender = store.getActiveSender();
  const displayName = store.getSenderName(activeSender);

  const navSender = document.getElementById('sender-display-name');
  const chatSender = document.getElementById('chat-current-sender');

  if (navSender) navSender.textContent = displayName;
  if (chatSender) chatSender.textContent = displayName;
}

// ---- 3. NAVIGATION ----
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      const pageId = btn.getAttribute('data-page');
      switchPage(pageId);
    });
  });

  // Support elements with data-nav
  document.addEventListener('click', (e) => {
    const navTrigger = e.target.closest('[data-nav]');
    if (navTrigger) {
      const page = navTrigger.getAttribute('data-nav');
      switchPage(page);
    }
  });
}

function switchPage(pageId) {
  document.querySelectorAll('.nav-item').forEach((b) => {
    b.classList.toggle('active', b.getAttribute('data-page') === pageId);
  });

  document.querySelectorAll('.view-page').forEach((p) => {
    p.classList.toggle('active', p.id === `page-${pageId}`);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Manage Sakuras for PrisciaVerse Music Room
  if (pageId === 'music') {
    startMusicSakuras('sakura-ambient-container');
  } else {
    stopMusicSakuras();
  }

  if (pageId === 'home') {
    if (basketball) setTimeout(() => basketball.resize(), 80);
  }
}

// ---- 4. MOVIES & SYNCHRONIZED WATCH PARTY ----

function parseVideoUrl(url) {
  if (!url) return { type: 'none', src: '' };
  let clean = url.trim();

  // 1. Google Drive view/share link -> direct preview embed
  const gDriveMatch = clean.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (gDriveMatch && gDriveMatch[1]) {
    return {
      type: 'embed',
      src: `https://drive.google.com/file/d/${gDriveMatch[1]}/preview`
    };
  }

  // 2. Dropbox share link -> raw streaming
  if (clean.includes('dropbox.com/')) {
    const rawDropbox = clean.replace(/[?&]dl=0/g, '').replace(/[?&]dl=1/g, '');
    const connector = rawDropbox.includes('?') ? '&' : '?';
    return {
      type: 'direct',
      src: `${rawDropbox}${connector}raw=1`
    };
  }

  // 3. YouTube Playlist
  const ytPlaylistMatch = clean.match(/[?&]list=([^#&?]+)/i);
  if ((clean.includes('youtube.com') || clean.includes('youtu.be')) && ytPlaylistMatch && ytPlaylistMatch[1] && !clean.includes('watch?v=')) {
    return {
      type: 'embed',
      src: `https://www.youtube-nocookie.com/embed/videoseries?list=${ytPlaylistMatch[1]}&autoplay=1`
    };
  }

  // 4. YouTube Video ID (standard, youtu.be, shorts, embed, live)
  const ytMatch = clean.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'embed',
      src: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1&enablejsapi=1`
    };
  }

  // 5. Vimeo
  const vimeoMatch = clean.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)/);
  if (vimeoMatch && vimeoMatch[3]) {
    return {
      type: 'embed',
      src: `https://player.vimeo.com/video/${vimeoMatch[3]}?autoplay=1`
    };
  }

  // 6. Dailymotion
  const dmMatch = clean.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/i);
  if (dmMatch && dmMatch[1]) {
    return {
      type: 'embed',
      src: `https://www.dailymotion.com/embed/video/${dmMatch[1]}?autoplay=1`
    };
  }

  // 7. Twitch
  const twitchClip = clean.match(/clips\.twitch\.tv\/([a-zA-Z0-9]+)/i);
  if (twitchClip && twitchClip[1]) {
    return {
      type: 'embed',
      src: `https://clips.twitch.tv/embed?clip=${twitchClip[1]}&parent=127.0.0.1&parent=localhost&autoplay=true`
    };
  }

  // 8. Internet Archive
  const archiveMatch = clean.match(/archive\.org\/details\/([a-zA-Z0-9_-]+)/i);
  if (archiveMatch && archiveMatch[1]) {
    return {
      type: 'embed',
      src: `https://archive.org/embed/${archiveMatch[1]}`
    };
  }

  // 9. Streamable
  const streamableMatch = clean.match(/streamable\.com\/([a-zA-Z0-9]+)/i);
  if (streamableMatch && streamableMatch[1]) {
    return {
      type: 'embed',
      src: `https://streamable.com/e/${streamableMatch[1]}?autoplay=1`
    };
  }

  // 10. Direct video extensions or stream types
  const isDirectVideo = /\.(mp4|webm|ogg|m4v|mov|mkv|m3u8)($|\?)/i.test(clean) || clean.startsWith('blob:') || clean.startsWith('data:video');
  if (isDirectVideo) {
    return {
      type: 'direct',
      src: clean
    };
  }

  // 11. Generic embed or player URL
  if (clean.includes('/embed/') || clean.includes('player.') || clean.includes('/e/')) {
    return {
      type: 'embed',
      src: clean
    };
  }

  // 12. If it's a web URL (movie site, streaming page), default to in-app embed frame
  const isUrl = /^https?:\/\//i.test(clean);
  if (isUrl) {
    return {
      type: 'embed',
      src: clean
    };
  }

  // 13. If text query, search on YouTube
  return {
    type: 'embed',
    src: `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(clean)}&autoplay=1`
  };
}

function loadVideo(url, title = 'Movie', shouldSync = true) {
  const videoPlayer = document.getElementById('shared-video-player');
  const videoIframe = document.getElementById('shared-video-iframe');
  const syncBannerText = document.getElementById('video-sync-status-text');

  if (!url) return;
  const parsed = parseVideoUrl(url);

  if (parsed.type === 'embed') {
    if (videoPlayer) {
      videoPlayer.pause();
      videoPlayer.style.display = 'none';
    }
    if (videoIframe) {
      videoIframe.src = parsed.src;
      videoIframe.style.display = 'block';
    }
  } else {
    if (videoIframe) {
      videoIframe.src = '';
      videoIframe.style.display = 'none';
    }
    if (videoPlayer) {
      videoPlayer.style.display = 'block';
      if (videoPlayer.src !== parsed.src) {
        videoPlayer.src = parsed.src;
      }
      videoPlayer.play().catch(() => {});
    }
  }

  if (syncBannerText) {
    syncBannerText.textContent = `Shared Session Active — Playing: ${title}`;
  }

  if (shouldSync) {
    store.syncMovie({
      action: 'CHANGE_MOVIE',
      url,
      title,
      currentTime: 0,
      isPlaying: true
    });
  }
}

function handleRemoteMovieSync(payload) {
  if (!payload) return;

  const videoPlayer = document.getElementById('shared-video-player');
  const syncBannerText = document.getElementById('video-sync-status-text');
  const senderName = store.getSenderName(payload.sender);

  if (syncBannerText) {
    let actionDesc = 'updated the session';
    if (payload.action === 'PLAY') actionDesc = 'pressed Play';
    else if (payload.action === 'PAUSE') actionDesc = 'paused the movie';
    else if (payload.action === 'SEEK') actionDesc = 'seeked playback';
    else if (payload.action === 'CHANGE_MOVIE') actionDesc = `switched movie to ${payload.title || 'new video'}`;

    syncBannerText.textContent = `${senderName} ${actionDesc} — in sync`;
  }

  isRemoteVideoSync = true;

  if (payload.action === 'CHANGE_MOVIE') {
    loadVideo(payload.url, payload.title || 'Movie', false);
  } else if (videoPlayer && videoPlayer.style.display !== 'none') {
    if (payload.url && videoPlayer.src !== payload.url) {
      videoPlayer.src = payload.url;
    }
    if (typeof payload.currentTime === 'number') {
      if (Math.abs(videoPlayer.currentTime - payload.currentTime) > 1.5) {
        videoPlayer.currentTime = payload.currentTime;
      }
    }
    if (payload.action === 'PLAY') {
      videoPlayer.play().catch(() => {});
    } else if (payload.action === 'PAUSE') {
      videoPlayer.pause();
    }
  }

  setTimeout(() => {
    isRemoteVideoSync = false;
  }, 200);
}

function setupMovies() {
  // Sub-tabs
  const tabPills = document.querySelectorAll('.tab-pill');
  tabPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      tabPills.forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      const tabId = pill.getAttribute('data-tab');

      document.querySelectorAll('.sub-tab-panel').forEach((panel) => {
        panel.classList.remove('active');
      });
      const targetPanel = document.getElementById(`tab-${tabId}-panel`);
      if (targetPanel) targetPanel.classList.add('active');
    });
  });

  // Modal open & close
  const openModalBtn = document.getElementById('btn-open-add-movie');
  const modal = document.getElementById('add-movie-modal');
  const closeModalBtn = document.getElementById('btn-close-modal');
  const cancelModalBtn = document.getElementById('btn-cancel-modal');
  const backdrop = document.getElementById('modal-backdrop');
  const saveMovieBtn = document.getElementById('btn-save-movie');

  let selectedModalVideoUrl = '';
  let selectedModalPosterUrl = '';

  const movieFilePicker = document.getElementById('modal-movie-file-picker');
  const videoFilenameTag = document.getElementById('modal-video-filename-tag');
  const posterFilePicker = document.getElementById('modal-poster-file-picker');
  const posterFilenameTag = document.getElementById('modal-poster-filename-tag');
  const posterPreviewHolder = document.getElementById('modal-poster-preview-holder');
  const posterPreviewImg = document.getElementById('modal-poster-preview-img');

  function extractThumbnailFromUrl(url) {
    if (!url) return '';
    const clean = url.trim();
    // YouTube
    const ytMatch = clean.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    if (ytMatch && ytMatch[1]) {
      return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
    }
    // Vimeo
    const vimeoMatch = clean.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)/);
    if (vimeoMatch && vimeoMatch[3]) {
      return `https://vumbnail.com/${vimeoMatch[3]}.jpg`;
    }
    // If URL is direct image
    if (/\.(jpg|jpeg|png|webp|avif|gif)($|\?)/i.test(clean)) {
      return clean;
    }
    return '';
  }

  function generateCinematicPoster(title) {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 600, 900);
    grad.addColorStop(0, '#0e1017');
    grad.addColorStop(0.5, '#1b1e2a');
    grad.addColorStop(1, '#090a0e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 600, 900);

    // Neon accent borders
    ctx.strokeStyle = 'rgba(255, 0, 60, 0.45)';
    ctx.lineWidth = 4;
    ctx.strokeRect(28, 28, 544, 844);

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(36, 36, 528, 828);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title || 'Movie', 300, 450);

    // Subtitle
    ctx.fillStyle = 'rgba(0, 240, 255, 0.85)';
    ctx.font = '600 18px "Inter", sans-serif';
    ctx.fillText('Shared Space Cinema', 300, 500);

    return canvas.toDataURL('image/jpeg', 0.85);
  }

  if (movieFilePicker) {
    movieFilePicker.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        selectedModalVideoUrl = URL.createObjectURL(file);
        if (videoFilenameTag) {
          videoFilenameTag.textContent = file.name;
          videoFilenameTag.style.display = 'inline-block';
        }
      }
    });
  }

  const urlInput = document.getElementById('modal-movie-url');
  if (urlInput) {
    urlInput.addEventListener('input', () => {
      const val = urlInput.value.trim();
      const autoThumb = extractThumbnailFromUrl(val);
      if (autoThumb && !selectedModalPosterUrl && !((posterInput && posterInput.value.trim()))) {
        selectedModalPosterUrl = autoThumb;
        if (posterPreviewImg) posterPreviewImg.src = autoThumb;
        if (posterPreviewHolder) posterPreviewHolder.style.display = 'block';
        if (posterFilenameTag) {
          posterFilenameTag.textContent = 'Retrieved from movie link';
          posterFilenameTag.style.display = 'inline-block';
        }
      }
    });
  }

  if (posterFilePicker) {
    posterFilePicker.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          selectedModalPosterUrl = evt.target.result;
          if (posterPreviewImg) posterPreviewImg.src = selectedModalPosterUrl;
          if (posterPreviewHolder) posterPreviewHolder.style.display = 'block';
        };
        reader.readAsDataURL(file);
        if (posterFilenameTag) {
          posterFilenameTag.textContent = file.name;
          posterFilenameTag.style.display = 'inline-block';
        }
      }
    });
  }

  function resetModalState() {
    const titleInput = document.getElementById('modal-movie-title');
    const posterInput = document.getElementById('modal-movie-poster');
    if (titleInput) titleInput.value = '';
    if (urlInput) urlInput.value = '';
    if (posterInput) posterInput.value = '';
    if (movieFilePicker) movieFilePicker.value = '';
    if (posterFilePicker) posterFilePicker.value = '';
    if (videoFilenameTag) { videoFilenameTag.textContent = ''; videoFilenameTag.style.display = 'none'; }
    if (posterFilenameTag) { posterFilenameTag.textContent = ''; posterFilenameTag.style.display = 'none'; }
    if (posterPreviewHolder) posterPreviewHolder.style.display = 'none';
    if (posterPreviewImg) posterPreviewImg.src = '';
    selectedModalVideoUrl = '';
    selectedModalPosterUrl = '';
  }

  function openModal(defaultDay = 'mon') {
    if (modal) {
      modal.style.display = 'flex';
      const daySelect = document.getElementById('modal-movie-day');
      if (daySelect) daySelect.value = defaultDay;
    }
  }

  function closeModal() {
    if (modal) modal.style.display = 'none';
    resetModalState();
  }

  if (openModalBtn) openModalBtn.addEventListener('click', () => openModal('mon'));
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
  if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);
  if (backdrop) backdrop.addEventListener('click', closeModal);

  // Link version or Load from File + Image Version (no default Spider-man/stock placeholder)
  if (saveMovieBtn) {
    saveMovieBtn.addEventListener('click', () => {
      const titleInput = document.getElementById('modal-movie-title');
      const daySelect = document.getElementById('modal-movie-day');
      const posterInput = document.getElementById('modal-movie-poster');

      const title = titleInput ? titleInput.value.trim() : '';
      const day = daySelect ? daySelect.value : 'mon';
      const url = selectedModalVideoUrl || (urlInput ? urlInput.value.trim() : '') || 'https://vjs.zencdn.net/v/oceans.mp4';
      
      let poster = selectedModalPosterUrl || (posterInput ? posterInput.value.trim() : '');
      if (!poster && url) {
        poster = extractThumbnailFromUrl(url);
      }
      if (!poster) {
        poster = generateCinematicPoster(title);
      }

      if (!title) {
        alert('Please enter a movie title');
        return;
      }

      store.addWeeklyMovie(
        day,
        {
          title,
          url,
          poster,
          genre: 'Movie'
        }
      );

      closeModal();
    });
  }

  // Search box
  const searchBox = document.getElementById('movie-search-box');
  if (searchBox) {
    searchBox.addEventListener('input', () => {
      renderAllMovies(searchBox.value.trim().toLowerCase());
    });
  }

  // Watch Together stream loading
  const loadStreamBtn = document.getElementById('btn-load-stream');
  const streamInput = document.getElementById('direct-stream-input');
  const localPicker = document.getElementById('local-file-picker');
  const videoPlayer = document.getElementById('shared-video-player');
  const videoIframe = document.getElementById('shared-video-iframe');
  const togglePlayerModeBtn = document.getElementById('btn-toggle-player-mode');

  if (togglePlayerModeBtn) {
    togglePlayerModeBtn.addEventListener('click', () => {
      const isIframeVisible = videoIframe && videoIframe.style.display !== 'none';
      if (isIframeVisible) {
        // Switch to direct video tag
        const currentSrc = (streamInput && streamInput.value.trim()) || (videoIframe && videoIframe.src) || '';
        if (videoIframe) {
          videoIframe.style.display = 'none';
        }
        if (videoPlayer) {
          videoPlayer.style.display = 'block';
          if (currentSrc && videoPlayer.src !== currentSrc) videoPlayer.src = currentSrc;
          videoPlayer.play().catch(() => {});
        }
        togglePlayerModeBtn.textContent = 'Switch to Embed';
      } else {
        // Switch to iframe embed
        const currentSrc = (streamInput && streamInput.value.trim()) || (videoPlayer && videoPlayer.src) || '';
        if (videoPlayer) {
          videoPlayer.pause();
          videoPlayer.style.display = 'none';
        }
        if (videoIframe) {
          videoIframe.style.display = 'block';
          if (currentSrc && videoIframe.src !== currentSrc) videoIframe.src = currentSrc;
        }
        togglePlayerModeBtn.textContent = 'Switch to Direct';
      }
    });
  }

  if (loadStreamBtn && streamInput) {
    const handleLoadStream = () => {
      const url = streamInput.value.trim();
      if (url) {
        loadVideo(url, 'Shared Video', true);
      }
    };
    loadStreamBtn.addEventListener('click', handleLoadStream);
    streamInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLoadStream();
    });
  }

  if (localPicker) {
    localPicker.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const fileUrl = URL.createObjectURL(file);
        loadVideo(fileUrl, file.name, true);
      }
    });
  }

  // YouTube In-App Search & Player Setup
  setupYouTubeSearch();

  // Video player real-time synchronization events (Play, Pause, Seek)
  if (videoPlayer) {
    videoPlayer.addEventListener('play', () => {
      if (!isRemoteVideoSync) {
        store.syncMovie({
          action: 'PLAY',
          url: videoPlayer.src,
          currentTime: videoPlayer.currentTime,
          isPlaying: true
        });
      }
    });

    videoPlayer.addEventListener('pause', () => {
      if (!isRemoteVideoSync) {
        store.syncMovie({
          action: 'PAUSE',
          url: videoPlayer.src,
          currentTime: videoPlayer.currentTime,
          isPlaying: false
        });
      }
    });

    videoPlayer.addEventListener('seeked', () => {
      if (!isRemoteVideoSync) {
        store.syncMovie({
          action: 'SEEK',
          url: videoPlayer.src,
          currentTime: videoPlayer.currentTime,
          isPlaying: !videoPlayer.paused
        });
      }
    });

    // Auto-fallback to iframe embed if direct video errors
    videoPlayer.addEventListener('error', () => {
      console.warn('Direct video format error, automatically falling back to iframe embed player');
      const currentSrc = (streamInput && streamInput.value.trim()) || videoPlayer.src;
      if (currentSrc && videoIframe) {
        videoPlayer.style.display = 'none';
        videoIframe.style.display = 'block';
        videoIframe.src = currentSrc;
        if (togglePlayerModeBtn) togglePlayerModeBtn.textContent = 'Switch to Direct';
      }
    });
  }

  // Watch chat send
  const watchChatBtn = document.getElementById('btn-send-watch-chat');
  const watchChatInput = document.getElementById('watch-chat-text');

  let isWatchSubmitting = false;

  function sendWatchMessage() {
    if (isWatchSubmitting) return;
    const txt = watchChatInput ? watchChatInput.value.trim() : '';
    if (!txt) return;

    isWatchSubmitting = true;
    watchChatInput.value = '';
    store.sendChatMessage(txt);

    setTimeout(() => {
      isWatchSubmitting = false;
    }, 350);
  }

  if (watchChatBtn) {
    watchChatBtn.onclick = (e) => {
      e.preventDefault();
      sendWatchMessage();
    };
  }
  if (watchChatInput) {
    watchChatInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendWatchMessage();
      }
    };
  }

  // Home "Watch Together" button
  const homeWatchBtn = document.getElementById('btn-home-watch');
  if (homeWatchBtn) {
    homeWatchBtn.addEventListener('click', () => {
      switchPage('movies');
      const watchTab = document.querySelector('.tab-pill[data-tab="watch"]');
      if (watchTab) watchTab.click();
    });
  }
}

async function fetchRealYouTube(query) {
  const cleanQ = (query || 'trending movies music trailers').trim();

  // If already a YouTube video URL or ID
  const ytMatch = cleanQ.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
    const vidId = ytMatch[1];
    return [
      {
        id: vidId,
        title: `YouTube Video: ${vidId}`,
        channel: 'YouTube Video',
        duration: 'PLAY',
        thumb: `https://img.youtube.com/vi/${vidId}/hqdefault.jpg`
      }
    ];
  }

  // 1. Local Vite dev server real YouTube search endpoint
  try {
    const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(cleanQ)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.items && data.items.length > 0) {
        return data.items;
      }
    }
  } catch (e) {
    console.warn('Local YouTube search API error, attempting fallback proxies:', e);
  }

  // 2. Client-side fallback via CORS proxy
  try {
    const targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQ)}`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const html = await res.text();
      const match = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);
      if (match) {
        const data = JSON.parse(match[1]);
        const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
        const items = [];
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
                    channel: v.ownerText?.runs?.[0]?.text || 'YouTube',
                    duration: v.lengthText?.simpleText || 'VIDEO',
                    thumb: bestThumb
                  });
                }
              }
            }
          }
        }
        if (items.length > 0) return items;
      }
    }
  } catch (e) {}

  // 3. Fallback: Google YouTube suggestions
  try {
    const res = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(cleanQ)}`);
    if (res.ok) {
      const json = await res.json();
      const suggestions = (json && json[1]) || [];
      if (suggestions.length > 0) {
        return suggestions.map((sug) => ({
          id: `search-${encodeURIComponent(sug)}`,
          customEmbed: `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(sug)}&autoplay=1`,
          title: sug,
          channel: 'YouTube Live Search',
          duration: 'SEARCH',
          thumb: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80'
        }));
      }
    }
  } catch (e) {}

  // 4. Default playable search card
  return [
    {
      id: `search-${encodeURIComponent(cleanQ)}`,
      customEmbed: `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(cleanQ)}&autoplay=1`,
      title: `Watch "${cleanQ}" on YouTube`,
      channel: 'YouTube In-App Search',
      duration: 'LIVE',
      thumb: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80'
    }
  ];
}

function setupYouTubeSearch() {
  const grid = document.getElementById('youtube-video-grid');
  const searchInput = document.getElementById('youtube-search-input');
  const searchBtn = document.getElementById('btn-exec-youtube-search');

  let activeSearchToken = 0;

  function renderVideoCards(items) {
    if (!grid) return;
    grid.innerHTML = '';

    if (!items || items.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No videos found. Type any query above to search all of YouTube in real time.</div>';
      return;
    }

    items.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'youtube-video-card';
      const videoUrl = item.customEmbed || `https://www.youtube.com/watch?v=${item.id}`;

      card.innerHTML = `
        <div class="youtube-card-thumb-wrap">
          <img class="youtube-card-thumb" src="${item.thumb}" alt="${item.title}" loading="lazy" />
          <span class="youtube-duration-tag">${item.duration}</span>
          <div class="youtube-play-hover-overlay">
            <span class="youtube-play-icon-circle">▶</span>
          </div>
        </div>
        <div class="youtube-card-info">
          <div class="youtube-card-title">${item.title}</div>
          <div class="youtube-card-channel">${item.channel}</div>
          <button class="btn-watch-card" type="button">▶ Watch Together</button>
        </div>
      `;

      card.addEventListener('click', () => {
        loadVideo(videoUrl, item.title, true);
        const playerArea = document.getElementById('video-sync-banner');
        if (playerArea) playerArea.scrollIntoView({ behavior: 'smooth' });
      });

      grid.appendChild(card);
    });
  }

  async function performLiveSearch(query) {
    const token = ++activeSearchToken;
    if (grid) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--accent-cyan); padding: 2rem;">Searching real YouTube...</div>';
    }

    const results = await fetchRealYouTube(query);
    if (token === activeSearchToken) {
      renderVideoCards(results);
    }
  }

  let debounceTimer = null;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const val = searchInput.value.trim();
      if (!val) {
        performLiveSearch('trending movies music trailers');
        return;
      }
      debounceTimer = setTimeout(() => {
        performLiveSearch(val);
      }, 350);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(debounceTimer);
        const val = searchInput.value.trim();
        performLiveSearch(val);
        if (val) {
          const directEmbed = `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(val)}&autoplay=1`;
          loadVideo(directEmbed, `YouTube: ${val}`, true);
          const playerArea = document.getElementById('video-sync-banner');
          if (playerArea) playerArea.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      clearTimeout(debounceTimer);
      const val = searchInput ? searchInput.value.trim() : '';
      performLiveSearch(val);
      if (val) {
        const directEmbed = `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(val)}&autoplay=1`;
        loadVideo(directEmbed, `YouTube: ${val}`, true);
        const playerArea = document.getElementById('video-sync-banner');
        if (playerArea) playerArea.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Initial load: Fetch real live trending videos from YouTube
  performLiveSearch('trending movies music trailers');
}

function renderWeeklySchedule() {
  const grid = document.getElementById('weekly-schedule-grid');
  if (!grid) return;

  const weekly = store.getWeeklyMovies();
  const days = [
    { key: 'mon', label: 'Monday' },
    { key: 'tue', label: 'Tuesday' },
    { key: 'wed', label: 'Wednesday' },
    { key: 'thu', label: 'Thursday' },
    { key: 'fri', label: 'Friday' },
    { key: 'sat', label: 'Saturday' },
    { key: 'sun', label: 'Sunday' }
  ];

  grid.innerHTML = '';
  days.forEach(({ key, label }) => {
    const movie = weekly[key];
    const box = document.createElement('div');
    box.className = `week-day-box ${movie ? 'has-movie' : ''}`;

    if (movie) {
      box.innerHTML = `
        <div class="week-day-name">${label}</div>
        <div class="week-movie-content">
          <div class="week-movie-poster" style="background-image: url('${movie.poster}')"></div>
          <div class="week-movie-title">${movie.title}</div>
          <div class="week-card-actions">
            <button class="clean-btn-primary full-btn btn-watch-schedule" type="button">Watch</button>
            <button class="btn-remove-week-movie" type="button" title="Remove">Remove</button>
          </div>
        </div>
      `;
      box.querySelector('.btn-watch-schedule').addEventListener('click', () => {
        playMovie(movie);
      });
      box.querySelector('.btn-remove-week-movie').addEventListener('click', (e) => {
        e.stopPropagation();
        store.removeMovie(movie.id);
      });
    } else {
      box.innerHTML = `
        <div class="week-day-name">${label}</div>
        <div class="empty-day-box">
          <span>+ Add</span>
        </div>
      `;
      box.querySelector('.empty-day-box').addEventListener('click', () => {
        const modal = document.getElementById('add-movie-modal');
        if (modal) {
          modal.style.display = 'flex';
          const daySelect = document.getElementById('modal-movie-day');
          if (daySelect) daySelect.value = key;
        }
      });
    }

    grid.appendChild(box);
  });

  // Update Featured on Home
  const firstMovie = Object.values(weekly).find(Boolean);
  if (firstMovie) {
    const title = document.getElementById('home-movie-title');
    const cover = document.getElementById('home-movie-cover');
    if (title) title.textContent = firstMovie.title;
    if (cover) cover.style.backgroundImage = `url('${firstMovie.poster}')`;
  }
}

function renderAllMovies(query = '') {
  const grid = document.getElementById('all-movies-grid');
  if (!grid) return;

  let list = store.getLibrary();
  if (query) {
    list = list.filter((m) => m.title.toLowerCase().includes(query) || (m.genre && m.genre.toLowerCase().includes(query)));
  }

  grid.innerHTML = '';
  if (list.length === 0) {
    grid.innerHTML = '<div style="color: var(--text-muted); padding: 1.5rem;">No movies found.</div>';
    return;
  }

  list.forEach((movie) => {
    const card = document.createElement('div');
    card.className = 'catalog-movie-card';
    card.innerHTML = `
      <div class="catalog-poster" style="background-image: url('${movie.poster}')"></div>
      <div class="catalog-info">
        <h4 class="catalog-title">${movie.title}</h4>
        <span class="catalog-genre">${movie.genre || 'Movie'}</span>
        <div class="catalog-card-actions">
          <button class="clean-btn-primary full-btn btn-catalog-watch" type="button">Watch Together</button>
          <button class="btn-remove-movie" type="button" title="Remove movie">Remove</button>
        </div>
      </div>
    `;
    card.querySelector('.btn-catalog-watch').addEventListener('click', () => {
      playMovie(movie);
    });
    card.querySelector('.btn-remove-movie').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Remove "${movie.title}" from the list?`)) {
        store.removeMovie(movie.id);
      }
    });
    grid.appendChild(card);
  });
}

function playMovie(movie) {
  loadVideo(movie.url, movie.title, true);
  switchPage('movies');
  const watchTab = document.querySelector('.tab-pill[data-tab="watch"]');
  if (watchTab) watchTab.click();
  store.markWatched(movie.id);
}

// ---- DYNAMIC GUESS GAME ----
function renderGuessGame() {
  const container = document.getElementById('guess-cards-feed');
  if (!container) return;

  const stats = store.getGuessStats();
  const correctEl = document.getElementById('guess-score-correct');
  const totalEl = document.getElementById('guess-score-total');
  const streakEl = document.getElementById('guess-score-streak');

  if (correctEl) correctEl.textContent = stats.correct || 0;
  if (totalEl) totalEl.textContent = stats.total || 0;
  if (streakEl) streakEl.textContent = stats.streak || 0;

  const movies = store.getLibrary();
  container.innerHTML = '';

  movies.forEach((movie) => {
    const hasGuessed = store.hasGuessed(movie.id);
    const card = document.createElement('div');
    card.className = 'guess-card-item';

    if (hasGuessed) {
      const result = stats.results[movie.id];
      const isCorrect = result.correct;
      card.innerHTML = `
        <h4 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.4rem;">${movie.title}</h4>
        <div style="font-size: 0.92rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.5rem; color: ${isCorrect ? 'var(--accent-cyan)' : 'var(--accent-red)'};">
          <span>${isCorrect ? 'Correct guess!' : 'Wrong guess!'}</span>
          <span style="color: var(--text-muted); font-size: 0.82rem; font-weight: 400;">Added by ${store.getSenderName(movie.addedBy)}</span>
        </div>
      `;
    } else {
      card.innerHTML = `
        <h4 style="font-size: 1.1rem; font-weight: 700;">${movie.title}</h4>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0.35rem 0 0.75rem 0;">Guess who selected this movie:</p>
        <div class="guess-choice-buttons">
          <button class="clean-btn-secondary btn-guess-choice btn-guess-stephane" type="button">Stephane</button>
          <button class="clean-btn-secondary btn-guess-choice btn-guess-me" type="button">Me</button>
        </div>
      `;

      const btnStephane = card.querySelector('.btn-guess-stephane');
      const btnMe = card.querySelector('.btn-guess-me');

      function makeAnimatedGuess(choice, btn) {
        btn.classList.add('guessing-active');
        setTimeout(() => {
          store.makeGuess(movie.id, choice);
          renderGuessGame();
        }, 180);
      }

      btnStephane.addEventListener('click', () => makeAnimatedGuess('stephane', btnStephane));
      btnMe.addEventListener('click', () => makeAnimatedGuess('me', btnMe));
    }

    container.appendChild(card);
  });
}

// ---- 5. PRISCIAVERSE MUSIC & SYNCHRONIZED LISTENING PARTY ----

function handleRemoteMusicSync(payload) {
  if (!payload) return;

  const audio = document.getElementById('audio-element');
  const playBtn = document.getElementById('btn-audio-play');
  const miniPlayBtn = document.getElementById('mini-play-btn');
  const vinyl = document.getElementById('music-vinyl');
  const syncBannerText = document.getElementById('music-sync-status-text');

  const senderName = store.getSenderName(payload.sender);

  if (syncBannerText) {
    let actionDesc = 'synced the player';
    if (payload.action === 'PLAY') actionDesc = `started playing ${payload.trackTitle || 'music'}`;
    else if (payload.action === 'PAUSE') actionDesc = 'paused music';
    else if (payload.action === 'CHANGE_TRACK') actionDesc = `switched to ${payload.trackTitle || 'new track'}`;
    else if (payload.action === 'SEEK') actionDesc = 'seeked the song';

    syncBannerText.textContent = `${senderName} ${actionDesc} — in sync`;
  }

  isRemoteMusicSync = true;

  if (payload.action === 'SPOTIFY_PLAY') {
    updateSpotifyDisplayInAllVerses({
      title: payload.trackTitle,
      author_name: payload.trackArtist,
      thumbnail_url: payload.trackArt
    });
    const spotifyIframe = document.getElementById('spotify-player-iframe');
    const spotifyContainer = document.getElementById('spotify-inapp-container');
    if (spotifyIframe && payload.spotifyUrl) {
      const embedUrl = convertToSpotifyEmbed(payload.spotifyUrl);
      if (spotifyIframe.src !== embedUrl) {
        spotifyIframe.src = embedUrl;
      }
      if (spotifyContainer) spotifyContainer.style.display = 'block';
    }
    setTimeout(() => {
      isRemoteMusicSync = false;
    }, 200);
    return;
  }

  if (typeof payload.trackIndex === 'number') {
    loadTrack(payload.trackIndex, false);
  }

  if (audio) {
    if (typeof payload.currentTime === 'number') {
      if (Math.abs(audio.currentTime - payload.currentTime) > 1.5) {
        audio.currentTime = payload.currentTime;
      }
    }

    if (payload.action === 'PLAY' || payload.isPlaying) {
      audio.play().then(() => {
        if (playBtn) playBtn.textContent = 'Pause';
        if (miniPlayBtn) miniPlayBtn.textContent = 'Pause';
        if (vinyl) vinyl.classList.add('spinning');
        setVisualizerPlaying('gothic-audio-visualizer', true);
      }).catch(() => {});
    } else if (payload.action === 'PAUSE' || !payload.isPlaying) {
      audio.pause();
      if (playBtn) playBtn.textContent = 'Play';
      if (miniPlayBtn) miniPlayBtn.textContent = 'Play';
      if (vinyl) vinyl.classList.remove('spinning');
      setVisualizerPlaying('gothic-audio-visualizer', false);
    }
  }

  setTimeout(() => {
    isRemoteMusicSync = false;
  }, 200);
}

let currentTrackIndex = 0;

function loadTrack(idx, shouldSync = false) {
  const playlist = store.getPlaylist();
  const audio = document.getElementById('audio-element');
  if (!playlist || playlist.length === 0) return;
  currentTrackIndex = (idx + playlist.length) % playlist.length;
  const track = playlist[currentTrackIndex];

  if (audio) {
    audio.src = track.url;
    audio.load();
  }

  const title = document.getElementById('current-track-title');
  const artist = document.getElementById('current-track-artist');
  const cover = document.getElementById('vinyl-cover');
  const miniTitle = document.getElementById('mini-track-name');
  const miniArtist = document.getElementById('mini-track-artist');
  const miniArt = document.getElementById('mini-disc-art');

  if (title) title.textContent = track.title;
  if (artist) artist.textContent = track.artist;
  if (cover && track.art) cover.style.backgroundImage = `url('${track.art}')`;

  if (miniTitle) miniTitle.textContent = track.title;
  if (miniArtist) miniArtist.textContent = track.artist;
  if (miniArt && track.art) miniArt.style.backgroundImage = `url('${track.art}')`;

  document.querySelectorAll('.song-item-row').forEach((row, i) => {
    row.classList.toggle('active', i === currentTrackIndex);
  });

  if (shouldSync) {
    store.syncMusic({
      action: 'CHANGE_TRACK',
      trackIndex: currentTrackIndex,
      trackTitle: track.title,
      trackUrl: track.url,
      currentTime: 0,
      isPlaying: audio && !audio.paused
    });
  }
}

function setupMusic() {
  const audio = document.getElementById('audio-element');
  const playBtn = document.getElementById('btn-audio-play');
  const miniPlayBtn = document.getElementById('mini-play-btn');
  const prevBtn = document.getElementById('btn-audio-prev');
  const nextBtn = document.getElementById('btn-audio-next');
  const progressBar = document.getElementById('audio-progress');
  const volumeBar = document.getElementById('audio-volume');
  const vinyl = document.getElementById('music-vinyl');

  function togglePlay() {
    if (!audio) return;
    if (audio.paused) {
      audio.play().then(() => {
        if (playBtn) playBtn.textContent = 'Pause';
        if (miniPlayBtn) miniPlayBtn.textContent = 'Pause';
        if (vinyl) vinyl.classList.add('spinning');
        setVisualizerPlaying('gothic-audio-visualizer', true);

        if (!isRemoteMusicSync) {
          const playlist = store.getPlaylist();
          const cur = playlist[currentTrackIndex] || {};
          store.syncMusic({
            action: 'PLAY',
            trackIndex: currentTrackIndex,
            trackTitle: cur.title,
            trackUrl: cur.url,
            currentTime: audio.currentTime,
            isPlaying: true
          });
        }
      }).catch(() => {});
    } else {
      audio.pause();
      if (playBtn) playBtn.textContent = 'Play';
      if (miniPlayBtn) miniPlayBtn.textContent = 'Play';
      if (vinyl) vinyl.classList.remove('spinning');
      setVisualizerPlaying('gothic-audio-visualizer', false);

      if (!isRemoteMusicSync) {
        const playlist = store.getPlaylist();
        const cur = playlist[currentTrackIndex] || {};
        store.syncMusic({
          action: 'PAUSE',
          trackIndex: currentTrackIndex,
          trackTitle: cur.title,
          trackUrl: cur.url,
          currentTime: audio.currentTime,
          isPlaying: false
        });
      }
    }
  }

  if (playBtn) playBtn.addEventListener('click', togglePlay);
  if (miniPlayBtn) miniPlayBtn.addEventListener('click', togglePlay);

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      loadTrack(currentTrackIndex - 1, true);
      if (audio) {
        audio.play().then(() => {
          if (playBtn) playBtn.textContent = 'Pause';
          if (miniPlayBtn) miniPlayBtn.textContent = 'Pause';
          if (vinyl) vinyl.classList.add('spinning');
          setVisualizerPlaying('gothic-audio-visualizer', true);
        }).catch(() => {});
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      loadTrack(currentTrackIndex + 1, true);
      if (audio) {
        audio.play().then(() => {
          if (playBtn) playBtn.textContent = 'Pause';
          if (miniPlayBtn) miniPlayBtn.textContent = 'Pause';
          if (vinyl) vinyl.classList.add('spinning');
          setVisualizerPlaying('gothic-audio-visualizer', true);
        }).catch(() => {});
      }
    });
  }

  if (audio) {
    audio.addEventListener('timeupdate', () => {
      if (audio.duration) {
        const pct = (audio.currentTime / audio.duration) * 100;
        if (progressBar) progressBar.value = pct;
        const cur = document.getElementById('audio-time-current');
        if (cur) cur.textContent = formatSec(audio.currentTime);
      }
    });

    audio.addEventListener('loadedmetadata', () => {
      const tot = document.getElementById('audio-time-total');
      if (tot) tot.textContent = formatSec(audio.duration);
    });

    audio.addEventListener('ended', () => {
      loadTrack(currentTrackIndex + 1, true);
      if (audio) audio.play().catch(() => {});
    });

    audio.addEventListener('error', () => {
      console.warn('Audio source issue, loading fallback track');
      setTimeout(() => {
        loadTrack(currentTrackIndex + 1, false);
      }, 500);
    });
  }

  if (progressBar && audio) {
    progressBar.addEventListener('input', () => {
      if (audio.duration) {
        audio.currentTime = (progressBar.value / 100) * audio.duration;
      }
    });

    progressBar.addEventListener('change', () => {
      if (!isRemoteMusicSync && audio.duration) {
        const playlist = store.getPlaylist();
        const cur = playlist[currentTrackIndex] || {};
        store.syncMusic({
          action: 'SEEK',
          trackIndex: currentTrackIndex,
          trackTitle: cur.title,
          trackUrl: cur.url,
          currentTime: audio.currentTime,
          isPlaying: !audio.paused
        });
      }
    });
  }

  if (volumeBar && audio) {
    volumeBar.addEventListener('input', () => {
      audio.volume = volumeBar.value / 100;
    });
  }

  // Direct Audio File Upload (.mp3 / .wav)
  const directAudioInput = document.getElementById('direct-audio-file-input');
  if (directAudioInput) {
    directAudioInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const blobUrl = URL.createObjectURL(file);
        const trackTitle = file.name.replace(/\.[^/.]+$/, '');
        const newTrack = {
          title: trackTitle,
          artist: store.getSenderName(store.getActiveSender()),
          url: blobUrl,
          art: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&auto=format&fit=crop&q=80'
        };
        store.addSong(newTrack, store.getActiveSender());
        const playlist = store.getPlaylist();
        loadTrack(playlist.length - 1, true);
        if (audio) {
          audio.play().then(() => {
            if (playBtn) playBtn.textContent = 'Pause';
            if (miniPlayBtn) miniPlayBtn.textContent = 'Pause';
            if (vinyl) vinyl.classList.add('spinning');
            setVisualizerPlaying('gothic-audio-visualizer', true);
          }).catch(() => {});
        }
      }
    });
  }


  // Spotify In-App Integration with synchronized track and album art display
  const spotifyInput = document.getElementById('spotify-link-input');
  const spotifyBtn = document.getElementById('btn-open-spotify');
  const spotifyIframe = document.getElementById('spotify-player-iframe');
  const spotifyContainer = document.getElementById('spotify-inapp-container');
  const toggleSpotifyBtn = document.getElementById('btn-toggle-spotify-window');
  const minimizeSpotifyBtn = document.getElementById('btn-minimize-spotify');
  const iframeWrapper = document.getElementById('spotify-iframe-wrapper');

  async function fetchSpotifyMeta(spotifyUrl) {
    if (!spotifyUrl) return null;
    try {
      const res = await fetch(`/api/spotify-oembed?url=${encodeURIComponent(spotifyUrl)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}

    try {
      const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}

    return null;
  }

  function updateSpotifyDisplayInAllVerses(meta) {
    if (!meta) return;
    const title = meta.title || 'Spotify Music';
    const artist = meta.author_name || 'Spotify';
    const coverUrl = meta.thumbnail_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&auto=format&fit=crop&q=80';

    // 1. Update Left Window in Prisciaverse
    const currentTitle = document.getElementById('current-track-title');
    const currentArtist = document.getElementById('current-track-artist');
    const vinylCover = document.getElementById('vinyl-cover');
    const vinyl = document.getElementById('music-vinyl');

    if (currentTitle) currentTitle.textContent = title;
    if (currentArtist) currentArtist.textContent = artist;
    if (vinylCover) vinylCover.style.backgroundImage = `url('${coverUrl}')`;
    if (vinyl) vinyl.classList.add('spinning');
    setVisualizerPlaying('gothic-audio-visualizer', true);

    // 2. Update Music Window in Stephanevers (Home)
    const miniTitle = document.getElementById('mini-track-name');
    const miniArtist = document.getElementById('mini-track-artist');
    const miniArt = document.getElementById('mini-disc-art');
    const miniPlayBtn = document.getElementById('mini-play-btn');

    if (miniTitle) miniTitle.textContent = title;
    if (miniArtist) miniArtist.textContent = artist;
    if (miniArt) miniArt.style.backgroundImage = `url('${coverUrl}')`;
    if (miniPlayBtn) miniPlayBtn.textContent = 'Pause';
  }

  function convertToSpotifyEmbed(inputUrl) {
    if (!inputUrl) return 'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M?utm_source=generator&theme=0';
    const clean = inputUrl.trim();

    // Already an embed URL
    if (clean.includes('open.spotify.com/embed/')) {
      return clean.includes('?') ? clean : `${clean}?utm_source=generator&theme=0`;
    }

    // Matches open.spotify.com/(track|playlist|album|artist|episode|show)/(id)
    const match = clean.match(/open\.spotify\.com\/(track|playlist|album|artist|episode|show)\/([a-zA-Z0-9]+)/i);
    if (match) {
      const type = match[1];
      const id = match[2];
      return `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`;
    }

    // Spotify URI: spotify:track:id or spotify:playlist:id
    const uriMatch = clean.match(/spotify:(track|playlist|album|artist):([a-zA-Z0-9]+)/i);
    if (uriMatch) {
      return `https://open.spotify.com/embed/${uriMatch[1]}/${uriMatch[2]}?utm_source=generator&theme=0`;
    }

    // If query is title or keyword, embed search player
    return `https://open.spotify.com/embed/search/${encodeURIComponent(clean)}?utm_source=generator&theme=0`;
  }

  async function loadInAppSpotify(url, shouldSync = true) {
    if (!spotifyIframe) return;
    const cleanUrl = (url && url.trim()) || 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M';
    const embedUrl = convertToSpotifyEmbed(cleanUrl);
    spotifyIframe.src = embedUrl;
    if (spotifyContainer) spotifyContainer.style.display = 'block';

    const meta = await fetchSpotifyMeta(cleanUrl);
    if (meta) {
      updateSpotifyDisplayInAllVerses(meta);
      if (shouldSync) {
        store.syncMusic({
          action: 'SPOTIFY_PLAY',
          spotifyUrl: cleanUrl,
          trackTitle: meta.title || 'Spotify Music',
          trackArtist: meta.author_name || 'Spotify',
          trackArt: meta.thumbnail_url,
          isPlaying: true
        });
      }
    }
  }

  if (spotifyBtn && spotifyInput) {
    spotifyBtn.addEventListener('click', () => {
      const val = spotifyInput.value.trim();
      loadInAppSpotify(val, true);
    });

    spotifyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        loadInAppSpotify(spotifyInput.value.trim(), true);
      }
    });
  }

  if (toggleSpotifyBtn && spotifyContainer) {
    toggleSpotifyBtn.addEventListener('click', () => {
      const isHidden = spotifyContainer.style.display === 'none';
      spotifyContainer.style.display = isHidden ? 'block' : 'none';
      toggleSpotifyBtn.textContent = isHidden ? 'Hide Player' : 'Toggle Player';
    });
  }

  if (minimizeSpotifyBtn && iframeWrapper) {
    let isMin = false;
    minimizeSpotifyBtn.addEventListener('click', () => {
      isMin = !isMin;
      iframeWrapper.classList.toggle('minimized', isMin);
      minimizeSpotifyBtn.textContent = isMin ? '+' : '−';
    });
  }

  // Load initial Spotify track and update both Prisciaverse and Stephaneverse
  loadInAppSpotify('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M', false);

  // Toggle Add Web Song Panel
  const toggleAddBtn = document.getElementById('btn-toggle-add-song');
  const addPanel = document.getElementById('add-song-panel');
  if (toggleAddBtn && addPanel) {
    toggleAddBtn.addEventListener('click', () => {
      const isVisible = addPanel.style.display === 'block';
      addPanel.style.display = isVisible ? 'none' : 'block';
      toggleAddBtn.textContent = isVisible ? '+ Add Web Track' : 'Close Form';
    });
  }

  // Save new web song
  const saveSongBtn = document.getElementById('btn-save-song');
  if (saveSongBtn) {
    saveSongBtn.addEventListener('click', () => {
      const title = document.getElementById('new-song-title').value.trim();
      const artist = document.getElementById('new-song-artist').value.trim();
      const url = document.getElementById('new-song-url').value.trim();
      const art = document.getElementById('new-song-art').value.trim();

      if (!title) {
        alert('Please enter song title');
        return;
      }

      store.addSong(
        {
          title,
          artist: artist || 'Artist',
          url: url || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
          art: art || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&auto=format&fit=crop&q=80'
        },
        store.getActiveSender()
      );

      document.getElementById('new-song-title').value = '';
      document.getElementById('new-song-artist').value = '';
      document.getElementById('new-song-url').value = '';
      document.getElementById('new-song-art').value = '';
      addPanel.style.display = 'none';
      toggleAddBtn.textContent = '+ Add Web Track';
    });
  }

  loadTrack(0, false);
}

function formatSec(seconds) {
  if (isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function renderPlaylist() {
  const container = document.getElementById('songs-list-items');
  if (!container) return;

  const playlist = store.getPlaylist();
  container.innerHTML = '';

  if (playlist.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); padding: 1.5rem; text-align: center; font-size: 0.9rem;">No songs in playlist. Upload an MP3 or add a web track above.</div>';
    return;
  }

  playlist.forEach((track, i) => {
    const item = document.createElement('div');
    item.className = `song-item-row ${i === currentTrackIndex ? 'active' : ''}`;
    item.innerHTML = `
      <div class="song-main-details">
        <div class="song-title-text">${track.title}</div>
        <div class="song-artist-text">${track.artist}</div>
      </div>
      <div class="song-row-right">
        <span class="song-added-by-badge">${store.getSenderName(track.addedBy)}</span>
        <button class="btn-remove-song" type="button" title="Remove track">✕</button>
      </div>
    `;

    // Click on row to play track
    item.addEventListener('click', () => {
      loadTrack(i, true);
      const audio = document.getElementById('audio-element');
      if (audio) {
        audio.play().then(() => {
          const playBtn = document.getElementById('btn-audio-play');
          const miniPlayBtn = document.getElementById('mini-play-btn');
          const vinyl = document.getElementById('music-vinyl');
          if (playBtn) playBtn.textContent = 'Pause';
          if (miniPlayBtn) miniPlayBtn.textContent = 'Pause';
          if (vinyl) vinyl.classList.add('spinning');
          setVisualizerPlaying('gothic-audio-visualizer', true);
        }).catch(() => {});
      }
    });

    // Remove song option
    const removeBtn = item.querySelector('.btn-remove-song');
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isRemovingCurrent = (i === currentTrackIndex);
        store.removeSong(track.id);
        const updated = store.getPlaylist();

        if (updated.length === 0) {
          const audio = document.getElementById('audio-element');
          if (audio) {
            audio.pause();
            audio.src = '';
          }
          currentTrackIndex = 0;
          const currentTitle = document.getElementById('current-track-title');
          const currentArtist = document.getElementById('current-track-artist');
          if (currentTitle) currentTitle.textContent = 'No tracks';
          if (currentArtist) currentArtist.textContent = 'Add a song to start';
          const vinyl = document.getElementById('music-vinyl');
          if (vinyl) vinyl.classList.remove('spinning');
          setVisualizerPlaying('gothic-audio-visualizer', false);
        } else {
          if (isRemovingCurrent) {
            const nextIdx = Math.min(i, updated.length - 1);
            loadTrack(nextIdx, true);
          } else if (currentTrackIndex > i) {
            currentTrackIndex--;
          }
        }

        renderPlaylist();
      });
    }

    container.appendChild(item);
  });
}

// ---- 6. CHAT ----
function setupChat() {
  const sendBtn = document.getElementById('btn-send-chat');
  const input = document.getElementById('chat-input-text');

  let isSubmitting = false;

  function sendMessage() {
    if (isSubmitting) return;
    const txt = input ? input.value.trim() : '';
    if (!txt) return;

    isSubmitting = true;
    input.value = '';
    store.sendChatMessage(txt);

    setTimeout(() => {
      isSubmitting = false;
    }, 350);
  }

  if (sendBtn) {
    sendBtn.onclick = (e) => {
      e.preventDefault();
      sendMessage();
    };
  }
  if (input) {
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
      }
    };
  }
}

function renderChat() {
  const fullContainer = document.getElementById('full-chat-messages');
  const homeContainer = document.getElementById('home-chat-list');
  const watchContainer = document.getElementById('watch-chat-stream');

  const messages = store.getChatMessages();
  const currentSender = store.getActiveSender();

  function formatTime(isoStr) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  }

  // Full chat screen
  if (fullContainer) {
    fullContainer.innerHTML = '';
    if (messages.length === 0) {
      fullContainer.innerHTML = `
        <div class="empty-chat-welcome" id="empty-chat-welcome">
          No messages yet. Send a real message below.
        </div>
      `;
    } else {
      messages.forEach((m) => {
        const isMine = m.sender === currentSender;
        const authorName = store.getSenderName(m.sender);
        const senderTag = m.sender === 'stephane' ? 'sender-stephane' : 'sender-stephanelle';
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${isMine ? 'mine' : 'partner'} ${senderTag}`;
        bubble.innerHTML = `
          <div class="bubble-meta-info">
            <span class="bubble-author-badge">${isMine ? 'You (' + authorName + ')' : authorName}</span>
            <span class="bubble-time-stamp">${formatTime(m.time)}</span>
          </div>
          <div class="bubble-text-content">${m.text}</div>
        `;
        fullContainer.appendChild(bubble);
      });
      fullContainer.scrollTop = fullContainer.scrollHeight;
    }
  }

  // Home preview
  if (homeContainer) {
    homeContainer.innerHTML = '';
    if (messages.length === 0) {
      homeContainer.innerHTML = '<div class="empty-chat-hint">No messages yet. Send your first message in Chat.</div>';
    } else {
      messages.slice(-4).forEach((m) => {
        const authorName = store.getSenderName(m.sender);
        const item = document.createElement('div');
        item.className = 'home-chat-bubble';
        item.innerHTML = `
          <div class="home-chat-author" style="display: flex; justify-content: space-between;">
            <span>${authorName}</span>
            <span style="font-size: 0.7rem; opacity: 0.6;">${formatTime(m.time)}</span>
          </div>
          <div style="font-size: 0.88rem; margin-top: 2px;">${m.text}</div>
        `;
        homeContainer.appendChild(item);
      });
    }
  }

  // Watch Together chat
  if (watchContainer) {
    watchContainer.innerHTML = '';
    if (messages.length === 0) {
      watchContainer.innerHTML = '<div class="empty-chat-hint">Chat while watching together.</div>';
    } else {
      messages.forEach((m) => {
        const authorName = store.getSenderName(m.sender);
        const isMine = m.sender === currentSender;
        const item = document.createElement('div');
        item.style.padding = '0.5rem 0.7rem';
        item.style.background = isMine ? 'rgba(255, 0, 60, 0.15)' : 'var(--bg-input)';
        item.style.borderLeft = isMine ? '2px solid var(--accent-red)' : '2px solid var(--accent-cyan)';
        item.style.borderRadius = 'var(--radius-sm)';
        item.style.fontSize = '0.85rem';
        item.innerHTML = `
          <div style="display: flex; justify-content: space-between; font-size: 0.72rem; font-weight: 600; color: ${isMine ? 'var(--accent-red)' : 'var(--accent-cyan)'}; margin-bottom: 2px;">
            <span>${isMine ? 'You (' + authorName + ')' : authorName}</span>
            <span style="opacity: 0.6; font-size: 0.68rem;">${formatTime(m.time)}</span>
          </div>
          <div>${m.text}</div>
        `;
        watchContainer.appendChild(item);
      });
      watchContainer.scrollTop = watchContainer.scrollHeight;
    }
  }
}

// ---- 7. ACTIVITY ----
function setupActivity() {
  // Setup activity handlers
}

function renderActivity() {
  const container = document.getElementById('activity-items-list');
  if (!container) return;

  const activities = store.getActivity();
  container.innerHTML = '';

  if (activities.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); padding: 1.5rem;">No activity recorded yet.</div>';
    return;
  }

  activities.forEach((act) => {
    const item = document.createElement('div');
    item.className = 'activity-entry';
    item.innerHTML = `
      <span class="activity-entry-text">${act.text}</span>
      <span class="activity-entry-time">${new Date(act.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    `;
    container.appendChild(item);
  });
}
