/* ============================================================
   ELITEPACE — Complete Application Logic
   Zero Errors | Premium Quality | Production Ready
   ============================================================ */

'use strict';

// ── CONSTANTS & CONFIG ──────────────────────────────────────
const CONFIG = {
  WARNING_THRESHOLD_SECONDS: 120, // 2 minutes
  ROOM_ID_LENGTH: 6,
  MESSAGE_MAX_LENGTH: 150,
  MAX_HISTORY_ITEMS: 10,
  RECONNECT_DELAY_MS: 2000,
  TOAST_DURATION_MS: 3500,
  LOADING_DURATION_MS: 1800,
  DEMO_MODE_SYNC_INTERVAL: 500
};

const ICONS = {
  success: 'fas fa-check-circle',
  error: 'fas fa-exclamation-circle',
  info: 'fas fa-info-circle',
  warning: 'fas fa-exclamation-triangle'
};

// ── APP STATE ───────────────────────────────────────────────
const AppState = {
  currentView: 'home',
  currentRoomId: null,
  isManager: false,
  isSpeaker: false,

  timer: {
    totalSeconds: 900,
    remainingSeconds: 900,
    isRunning: false,
    isPaused: false,
    startTime: null,
    intervalId: null,
    localIntervalId: null
  },

  session: {
    messagesSent: 0,
    pauseCount: 0,
    adjustCount: 0,
    sessionStartTime: null,
    rating: 0
  },

  theme: localStorage.getItem('elitepace_theme') || 'dark',
  firebaseListener: null,
  isOffline: false,
  lastSyncedRemaining: null
};

// ── DOM CACHE ───────────────────────────────────────────────
const DOM = {};

function cacheDOMElements() {
  const ids = [
    'loadingScreen', 'app',
    'homeView', 'managerView', 'speakerView', 'endedView',
    'createSessionBtn', 'joinSessionBtn',
    'joinModal', 'closeJoinModal', 'joinRoomIdInput', 'joinRoomBtn',
    'themeToggle', 'themeIcon',
    'managerRoomId', 'connectionDot',
    'shareRoomBtn', 'endSessionBtn', 'endSessionModal',
    'cancelEndBtn', 'confirmEndBtn', 'endFeedback',
    'timerMinutes', 'timerSeconds', 'setTimerBtn',
    'managerTimerDisplay', 'timerStatus',
    'startBtn', 'pauseBtn', 'resetBtn',
    'minus5Btn', 'minus1Btn', 'plus1Btn', 'plus5Btn',
    'qrCodeContainer', 'speakerUrlDisplay', 'copyUrlBtn',
    'whatsappShareBtn', 'emailShareBtn',
    'messageInput', 'charCount', 'clearMsgBtn', 'sendMessageBtn',
    'aiTeaserBtn',
    'statDuration', 'statMessages', 'statPauses', 'statAdjusts',
    'previewTimer', 'previewMessage', 'speakerPreview',
    'speakerContainer', 'speakerStatusBar', 'speakerStatusText',
    'speakerRoomBadge', 'speakerTimerDisplay', 'speakerLabel',
    'speakerProgressFill', 'speakerMessageWrap', 'speakerMessage',
    'speakerWaiting', 'timeUpOverlay',
    'statRooms', 'toastContainer',
    'ratingStars', 'feedbackText', 'submitFeedbackBtn'
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) DOM[id] = el;
  });
}

// ── UTILITY FUNCTIONS ───────────────────────────────────────

/**
 * Format seconds into MM:SS string
 * @param {number} totalSecs
 * @returns {string}
 */
function formatTime(totalSecs) {
  if (typeof totalSecs !== 'number' || isNaN(totalSecs)) return '00:00';
  const safeSecs = Math.max(0, Math.floor(totalSecs));
  const mins = Math.floor(safeSecs / 60);
  const secs = safeSecs % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Generate unique room ID
 * @returns {string}
 */
function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < CONFIG.ROOM_ID_LENGTH; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
 * Get Speaker URL for a room
 * @param {string} roomId
 * @returns {string}
 */
function getSpeakerUrl(roomId) {
  const base = window.location.origin + window.location.pathname;
  return `${base}?room=${roomId}&role=speaker`;
}

/**
 * Get Manager URL for a room
 * @param {string} roomId
 * @returns {string}
 */
function getManagerUrl(roomId) {
  const base = window.location.origin + window.location.pathname;
  return `${base}?room=${roomId}&role=manager`;
}

/**
 * Show toast notification
 * @param {string} msg
 * @param {'success'|'error'|'info'|'warning'} type
 */
function showToast(msg, type = 'info') {
  if (!DOM.toastContainer || !msg) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="${ICONS[type] || ICONS.info} toast-icon"></i>
    <span>${msg}</span>
  `;

  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 350);
  }, CONFIG.TOAST_DURATION_MS);
}

/**
 * Show a view, hide all others
 * @param {string} viewId
 */
function showView(viewId) {
  const views = ['homeView', 'managerView', 'speakerView', 'endedView'];
  views.forEach(v => {
    if (DOM[v]) DOM[v].classList.add('hidden');
  });
  if (DOM[viewId]) DOM[viewId].classList.remove('hidden');
  AppState.currentView = viewId;
}

/**
 * Animate element with shake
 * @param {HTMLElement} el
 */
function shakeElement(el) {
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 500);
}

// ── THEME MANAGEMENT ────────────────────────────────────────
function initTheme() {
  if (AppState.theme === 'light') {
    document.body.classList.add('light-theme');
    if (DOM.themeIcon) {
      DOM.themeIcon.classList.replace('fa-moon', 'fa-sun');
    }
  }
}

function toggleTheme() {
  document.body.classList.toggle('light-theme');
  const isLight = document.body.classList.contains('light-theme');
  AppState.theme = isLight ? 'light' : 'dark';
  localStorage.setItem('elitepace_theme', AppState.theme);

  if (DOM.themeIcon) {
    if (isLight) {
      DOM.themeIcon.classList.replace('fa-moon', 'fa-sun');
    } else {
      DOM.themeIcon.classList.replace('fa-sun', 'fa-moon');
    }
  }
}

// ── WAKE LOCK (No Sleep) ─────────────────────────────────────
let wakeLock = null;

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('✅ Wake Lock active');
    }
  } catch (err) {
    console.warn('Wake lock not available:', err.message);
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(console.warn);
    wakeLock = null;
  }
}

// Re-acquire wake lock when page becomes visible
document.addEventListener('visibilitychange', async () => {
  if (wakeLock !== null && document.visibilityState === 'visible') {
    await requestWakeLock();
  }
});

// ── FIREBASE / LOCAL SYNC ────────────────────────────────────

/**
 * Write data to Firebase or localStorage (demo fallback)
 */
function writeRoomData(roomId, data) {
  if (!roomId || !data) return;

  if (window.FIREBASE_READY && window.db) {
    window.db.ref(`rooms/${roomId}`).update(data).catch(err => {
      console.warn('Firebase write error:', err);
    });
  } else {
    // Demo mode: use localStorage + BroadcastChannel
    try {
      const existing = JSON.parse(localStorage.getItem(`ep_room_${roomId}`) || '{}');
      const updated = { ...existing, ...data, _ts: Date.now() };
      localStorage.setItem(`ep_room_${roomId}`, JSON.stringify(updated));
      broadcastUpdate(roomId, updated);
    } catch (e) {
      console.warn('LocalStorage write error:', e);
    }
  }
}

/**
 * Read room data once
 */
function readRoomData(roomId, callback) {
  if (!roomId || typeof callback !== 'function') return;

  if (window.FIREBASE_READY && window.db) {
    window.db.ref(`rooms/${roomId}`).once('value').then(snap => {
      callback(snap.val());
    }).catch(err => {
      console.warn('Firebase read error:', err);
      callback(null);
    });
  } else {
    try {
      const data = JSON.parse(localStorage.getItem(`ep_room_${roomId}`) || 'null');
      callback(data);
    } catch (e) {
      callback(null);
    }
  }
}

/**
 * Listen to room data in real-time
 */
function listenRoomData(roomId, callback) {
  if (!roomId || typeof callback !== 'function') return;

  if (window.FIREBASE_READY && window.db) {
    const ref = window.db.ref(`rooms/${roomId}`);
    AppState.firebaseListener = ref;
    ref.on('value', snap => {
      callback(snap.val());
    }, err => {
      console.warn('Firebase listen error:', err);
      setConnectionStatus('disconnected');
    });
  } else {
    // Demo mode: poll localStorage
    AppState.localPollInterval = setInterval(() => {
      try {
        const data = JSON.parse(localStorage.getItem(`ep_room_${roomId}`) || 'null');
        if (data) callback(data);
      } catch (e) {}
    }, CONFIG.DEMO_MODE_SYNC_INTERVAL);
  }
}

/**
 * Stop listening to room data
 */
function stopListening() {
  if (AppState.firebaseListener && window.FIREBASE_READY) {
    AppState.firebaseListener.off();
    AppState.firebaseListener = null;
  }
  if (AppState.localPollInterval) {
    clearInterval(AppState.localPollInterval);
    AppState.localPollInterval = null;
  }
}

// BroadcastChannel for same-device demo
let broadcastChannel = null;
try {
  broadcastChannel = new BroadcastChannel('elitepace_channel');
} catch (e) {}

function broadcastUpdate(roomId, data) {
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ roomId, data });
    } catch (e) {}
  }
}

// ── CONNECTION STATUS ────────────────────────────────────────
function setConnectionStatus(status) {
  if (!DOM.connectionDot) return;
  DOM.connectionDot.className = `connection-dot ${status}`;
  DOM.connectionDot.title = status.charAt(0).toUpperCase() + status.slice(1);
}

// Monitor online/offline
window.addEventListener('online', () => {
  AppState.isOffline = false;
  setConnectionStatus('connected');
  showToast('Connection restored', 'success');
  // Re-sync after reconnect
  if (AppState.currentRoomId && AppState.timer.isRunning) {
    syncManagerTimerToFirebase();
  }
});

window.addEventListener('offline', () => {
  AppState.isOffline = true;
  setConnectionStatus('disconnected');
  showToast('Connection lost — timer continues locally', 'warning');
});

// ── ROOM CREATION ────────────────────────────────────────────
function createNewSession() {
  const roomId = generateRoomId();
  AppState.currentRoomId = roomId;
  AppState.isManager = true;
  AppState.isSpeaker = false;

  // Initialize room in Firebase
  const roomData = {
    roomId,
    createdAt: Date.now(),
    status: 'waiting',
    timer: {
      totalSeconds: 900,
      remainingSeconds: 900,
      isRunning: false,
      isPaused: false,
      serverTimestamp: null
    },
    message: '',
    managerActive: true
  };

  writeRoomData(roomId, roomData);

  // Update URL without reload
  const managerUrl = getManagerUrl(roomId);
  window.history.pushState({ roomId, role: 'manager' }, '', `?room=${roomId}&role=manager`);

  initManagerView(roomId);
  trackEvent('room_created', { roomId });

  // Increment stat counter
  updateDailyRoomStat();
}

function updateDailyRoomStat() {
  const today = new Date().toDateString();
  const stored = localStorage.getItem('ep_daily_stat');
  let stat = { date: today, count: 0 };

  try {
    const parsed = JSON.parse(stored || '{}');
    if (parsed.date === today) {
      stat = parsed;
    }
  } catch (e) {}

  stat.count++;
  localStorage.setItem('ep_daily_stat', JSON.stringify(stat));

  if (DOM.statRooms) {
    DOM.statRooms.textContent = stat.count;
  }
}

// ── MANAGER VIEW INITIALIZATION ──────────────────────────────
function initManagerView(roomId) {
  showView('managerView');

  // Set room ID display
  if (DOM.managerRoomId) DOM.managerRoomId.textContent = roomId;

  // Reset session stats
  AppState.session = {
    messagesSent: 0,
    pauseCount: 0,
    adjustCount: 0,
    sessionStartTime: Date.now(),
    rating: 0
  };

  updateSessionStats();
  updateManagerTimerDisplay(AppState.timer.remainingSeconds);
  generateQRCode(roomId);
  updateShareLinks(roomId);
  updateSpeakerPreview();
  setConnectionStatus('connected');
  requestWakeLock();
}

// ── SPEAKER VIEW INITIALIZATION ──────────────────────────────
function initSpeakerView(roomId) {
  AppState.currentRoomId = roomId;
  AppState.isManager = false;
  AppState.isSpeaker = true;

  showView('speakerView');

  if (DOM.speakerRoomBadge) {
    DOM.speakerRoomBadge.textContent = `Room: ${roomId}`;
  }

  setSpeakerStatus('connecting');
  requestWakeLock();

  // Check room exists
  readRoomData(roomId, (data) => {
    if (!data) {
      showToast('Room not found. Check the Room ID.', 'error');
      setTimeout(goHome, 2000);
      return;
    }

    if (data.status === 'ended') {
      showView('endedView');
      return;
    }

    setSpeakerStatus('connected');
    applySpeakerState(data);

    // Start listening
    listenRoomData(roomId, (roomData) => {
      if (!roomData) return;

      if (roomData.status === 'ended') {
        stopListening();
        showView('endedView');
        return;
      }

      applySpeakerState(roomData);
    });
  });

  trackEvent('speaker_joined', { roomId });
}

/**
 * Apply room state to Speaker View
 */
function applySpeakerState(data) {
  if (!data) return;

  try {
    const timerData = data.timer || {};
    const remaining = typeof timerData.remainingSeconds === 'number'
      ? timerData.remainingSeconds : 0;
    const total = typeof timerData.totalSeconds === 'number'
      ? timerData.totalSeconds : 900;
    const isRunning = timerData.isRunning === true;

    // Show/hide waiting state
    if (DOM.speakerWaiting) {
      DOM.speakerWaiting.style.display = isRunning ? 'none' : 'block';
    }

    if (DOM.speakerTimerDisplay) {
      DOM.speakerTimerDisplay.style.display = isRunning ? 'block' : 'none';
    }

    if (DOM.speakerProgressFill) {
      DOM.speakerProgressFill.closest('.speaker-progress-bar').style.display
        = isRunning ? 'block' : 'none';
    }

    // Update timer display
    updateSpeakerTimerDisplay(remaining, total);

    // Update speaker message
    const msg = (data.message || '').trim();
    if (DOM.speakerMessage) {
      if (msg) {
        DOM.speakerMessage.textContent = msg;
        DOM.speakerMessage.style.display = 'inline-block';
        if (DOM.speakerMessageWrap) {
          DOM.speakerMessageWrap.style.animation = 'none';
          void DOM.speakerMessageWrap.offsetWidth;
          DOM.speakerMessageWrap.style.animation = '';
        }
      } else {
        DOM.speakerMessage.textContent = '';
        DOM.speakerMessage.style.display = 'none';
      }
    }

    // Handle real-time sync for running timer
    if (isRunning && timerData.serverTimestamp) {
      const serverRemaining = remaining;
      const serverTimestamp = timerData.serverTimestamp;
      const elapsed = (Date.now() - serverTimestamp) / 1000;
      const adjustedRemaining = Math.max(0,
        serverRemaining - elapsed);
      AppState.lastSyncedRemaining = adjustedRemaining;

      startSpeakerLocalTimer(adjustedRemaining, total);
    } else if (!isRunning) {
      stopSpeakerLocalTimer();
      if (AppState.lastSyncedRemaining !== null) {
        updateSpeakerTimerDisplay(remaining, total);
      }
    }

  } catch (err) {
    console.warn('Error applying speaker state:', err);
  }
}

let speakerLocalTimerInterval = null;
let speakerLocalRemaining = 0;
let speakerLocalTotal = 900;

function startSpeakerLocalTimer(remaining, total) {
  stopSpeakerLocalTimer();
  speakerLocalRemaining = remaining;
  speakerLocalTotal = total;

  speakerLocalTimerInterval = setInterval(() => {
    if (speakerLocalRemaining <= 0) {
      speakerLocalRemaining = 0;
      updateSpeakerTimerDisplay(0, speakerLocalTotal);
      stopSpeakerLocalTimer();
      handleSpeakerTimeUp();
      return;
    }
    speakerLocalRemaining -= 1;
    updateSpeakerTimerDisplay(speakerLocalRemaining, speakerLocalTotal);
  }, 1000);
}

function stopSpeakerLocalTimer() {
  if (speakerLocalTimerInterval) {
    clearInterval(speakerLocalTimerInterval);
    speakerLocalTimerInterval = null;
  }
}

function handleSpeakerTimeUp() {
  if (DOM.timeUpOverlay) DOM.timeUpOverlay.classList.remove('hidden');
  if (DOM.speakerContainer) {
    DOM.speakerContainer.className = 'speaker-container state-danger';
  }
}

/**
 * Update Speaker timer display + color state
 */
function updateSpeakerTimerDisplay(remaining, total) {
  if (!DOM.speakerTimerDisplay) return;

  const timeStr = formatTime(remaining);
  DOM.speakerTimerDisplay.textContent = timeStr;

  // Progress bar
  if (DOM.speakerProgressFill && total > 0) {
    const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
    DOM.speakerProgressFill.style.width = `${pct}%`;
  }

  // Color psychology states
  if (!DOM.speakerContainer) return;

  if (remaining <= 0) {
    DOM.speakerContainer.className = 'speaker-container state-danger';
    if (DOM.speakerLabel) DOM.speakerLabel.textContent = 'TIME IS UP';
  } else if (remaining <= CONFIG.WARNING_THRESHOLD_SECONDS) {
    DOM.speakerContainer.className = 'speaker-container state-warning';
    if (DOM.speakerLabel) DOM.speakerLabel.textContent = 'WRAPPING UP';
  } else {
    DOM.speakerContainer.className = 'speaker-container state-normal';
    if (DOM.speakerLabel) DOM.speakerLabel.textContent = 'PRESENTATION TIME';
  }
}

function setSpeakerStatus(status) {
  if (!DOM.speakerStatusText) return;
  const messages = {
    connecting: { text: 'Connecting...', cls: 'reconnecting' },
    connected: { text: 'Live', cls: 'connected' },
    disconnected: { text: 'Reconnecting...', cls: 'disconnected' },
    ended: { text: 'Session Ended', cls: 'disconnected' }
  };
  const s = messages[status] || messages.connecting;
  DOM.speakerStatusText.innerHTML =
    `<i class="fas fa-circle"></i> ${s.text}`;
  DOM.speakerStatusText.className = s.cls;
}

// ── MANAGER TIMER CONTROLS ───────────────────────────────────

function setTimer() {
  try {
    const minsVal = parseInt(DOM.timerMinutes?.value || '15', 10);
    const secsVal = parseInt(DOM.timerSeconds?.value || '0', 10);

    if (isNaN(minsVal) || minsVal < 1 || minsVal > 180) {
      showToast('Minutes must be between 1 and 180', 'error');
      if (DOM.timerMinutes) shakeElement(DOM.timerMinutes);
      return;
    }

    if (isNaN(secsVal) || secsVal < 0 || secsVal > 59) {
      showToast('Seconds must be between 0 and 59', 'error');
      if (DOM.timerSeconds) shakeElement(DOM.timerSeconds);
      return;
    }

    const total = (minsVal * 60) + secsVal;
    AppState.timer.totalSeconds = total;
    AppState.timer.remainingSeconds = total;
    AppState.timer.isRunning = false;
    AppState.timer.isPaused = false;

    stopManagerTimer();
    updateManagerTimerDisplay(total);
    updateSpeakerPreview();

    if (DOM.timerStatus) DOM.timerStatus.textContent = 'Ready to Start';
    updateTimerButtonStates();
    showToast(`Timer set to ${formatTime(total)}`, 'success');

  } catch (err) {
    console.error('setTimer error:', err);
    showToast('Error setting timer', 'error');
  }
}

function startTimer() {
  try {
    if (AppState.timer.remainingSeconds <= 0) {
      showToast('Please reset the timer first', 'warning');
      return;
    }

    AppState.timer.isRunning = true;
    AppState.timer.isPaused = false;

    if (DOM.timerStatus) DOM.timerStatus.textContent = 'Running';
    updateTimerButtonStates();

    syncManagerTimerToFirebase();
    runManagerLocalTimer();
    showToast('Timer started!', 'success');

    trackEvent('timer_started', { room: AppState.currentRoomId });

  } catch (err) {
    console.error('startTimer error:', err);
    showToast('Error starting timer', 'error');
  }
}

function pauseTimer() {
  try {
    AppState.timer.isRunning = false;
    AppState.timer.isPaused = true;
    AppState.session.pauseCount++;

    stopManagerTimer();

    if (DOM.timerStatus) DOM.timerStatus.textContent = 'Paused';
    updateTimerButtonStates();

    syncManagerTimerToFirebase();
    updateSessionStats();
    showToast('Timer paused', 'info');

  } catch (err) {
    console.error('pauseTimer error:', err);
  }
}

function resetTimer() {
  try {
    AppState.timer.isRunning = false;
    AppState.timer.isPaused = false;
    AppState.timer.remainingSeconds = AppState.timer.totalSeconds;

    stopManagerTimer();

    if (DOM.timerStatus) DOM.timerStatus.textContent = 'Ready to Start';
    updateManagerTimerDisplay(AppState.timer.totalSeconds);
    updateTimerButtonStates();
    updateSpeakerPreview();

    syncManagerTimerToFirebase();
    showToast('Timer reset', 'info');

  } catch (err) {
    console.error('resetTimer error:', err);
  }
}

function adjustTime(seconds) {
  try {
    const wasRunning = AppState.timer.isRunning;
    const newRemaining = Math.max(0,
      Math.min(
        AppState.timer.totalSeconds,
        AppState.timer.remainingSeconds + seconds
      )
    );

    AppState.timer.remainingSeconds = newRemaining;
    AppState.session.adjustCount++;

    updateManagerTimerDisplay(newRemaining);
    updateSpeakerPreview();
    updateSessionStats();
    syncManagerTimerToFirebase();

    const sign = seconds > 0 ? '+' : '';
    showToast(`${sign}${seconds}s adjusted`, 'info');

  } catch (err) {
    console.error('adjustTime error:', err);
  }
}

function runManagerLocalTimer() {
  stopManagerTimer();

  AppState.timer.intervalId = setInterval(() => {
    try {
      if (!AppState.timer.isRunning) {
        stopManagerTimer();
        return;
      }

      if (AppState.timer.remainingSeconds <= 0) {
        AppState.timer.remainingSeconds = 0;
        AppState.timer.isRunning = false;
        stopManagerTimer();
        updateManagerTimerDisplay(0);
        if (DOM.timerStatus) DOM.timerStatus.textContent = 'Time Up!';
        updateTimerButtonStates();
        syncManagerTimerToFirebase();
        showToast("⏰ Time's up!", 'warning');
        return;
      }

      AppState.timer.remainingSeconds--;
      updateManagerTimerDisplay(AppState.timer.remainingSeconds);
      updateSpeakerPreview();

      // Sync every 5 seconds to Firebase
      if (AppState.timer.remainingSeconds % 5 === 0) {
        syncManagerTimerToFirebase();
      }

    } catch (err) {
      console.error('Timer interval error:', err);
      stopManagerTimer();
    }
  }, 1000);
}

function stopManagerTimer() {
  if (AppState.timer.intervalId) {
    clearInterval(AppState.timer.intervalId);
    AppState.timer.intervalId = null;
  }
}

function syncManagerTimerToFirebase() {
  if (!AppState.currentRoomId) return;

  const timerData = {
    timer: {
      totalSeconds: AppState.timer.totalSeconds,
      remainingSeconds: AppState.timer.remainingSeconds,
      isRunning: AppState.timer.isRunning,
      isPaused: AppState.timer.isPaused,
      serverTimestamp: Date.now()
    }
  };

  writeRoomData(AppState.currentRoomId, timerData);
}

/**
 * Update manager timer display with color coding
 */
function updateManagerTimerDisplay(remaining) {
  if (!DOM.managerTimerDisplay) return;

  const timeStr = formatTime(remaining);
  DOM.managerTimerDisplay.textContent = timeStr;

  DOM.managerTimerDisplay.className = 'manager-timer-display';

  if (remaining <= 0) {
    DOM.managerTimerDisplay.classList.add('danger');
  } else if (remaining <= CONFIG.WARNING_THRESHOLD_SECONDS) {
    DOM.managerTimerDisplay.classList.add('warning');
  }

  // Update duration stat
  const elapsed = AppState.timer.totalSeconds - remaining;
  if (DOM.statDuration) DOM.statDuration.textContent = formatTime(elapsed);
}

function updateTimerButtonStates() {
  const { isRunning, isPaused, remainingSeconds } = AppState.timer;

  if (DOM.startBtn) {
    DOM.startBtn.disabled = isRunning || remainingSeconds <= 0;
  }
  if (DOM.pauseBtn) {
    DOM.pauseBtn.disabled = !isRunning;
  }
}

// ── SPEAKER PREVIEW (Manager Side) ──────────────────────────
function updateSpeakerPreview() {
  if (!DOM.previewTimer || !DOM.speakerPreview) return;

  const remaining = AppState.timer.remainingSeconds;
  DOM.previewTimer.textContent = formatTime(remaining);

  // Apply color to preview
  DOM.speakerPreview.style.background = '';
  DOM.previewTimer.style.color = '#fff';

  if (remaining <= 0) {
    DOM.speakerPreview.style.background = '#3d0000';
    DOM.previewTimer.style.color = '#ef4444';
  } else if (remaining <= CONFIG.WARNING_THRESHOLD_SECONDS) {
    DOM.speakerPreview.style.background = '#3d2800';
    DOM.previewTimer.style.color = '#f59e0b';
  }
}

// ── MESSAGE HANDLING ─────────────────────────────────────────
function sendMessage() {
  try {
    if (!DOM.messageInput) return;

    const msg = DOM.messageInput.value.trim();
    if (!msg) {
      showToast('Please type a message first', 'warning');
      shakeElement(DOM.messageInput);
      return;
    }

    if (msg.length > CONFIG.MESSAGE_MAX_LENGTH) {
      showToast('Message too long', 'error');
      return;
    }

    if (!AppState.currentRoomId) {
      showToast('No active room', 'error');
      return;
    }

    writeRoomData(AppState.currentRoomId, { message: msg });

    AppState.session.messagesSent++;
    updateSessionStats();

    // Update preview
    if (DOM.previewMessage) DOM.previewMessage.textContent = msg;

    showToast('Message sent to speaker!', 'success');
    trackEvent('message_sent', { room: AppState.currentRoomId });

    // Auto-clear after 30 seconds
    setTimeout(() => {
      if (DOM.messageInput && DOM.messageInput.value === msg) {
        clearMessage();
      }
    }, 30000);

  } catch (err) {
    console.error('sendMessage error:', err);
    showToast('Error sending message', 'error');
  }
}

function clearMessage() {
  if (!DOM.messageInput) return;

  DOM.messageInput.value = '';
  if (DOM.charCount) DOM.charCount.textContent = '0';

  if (AppState.currentRoomId) {
    writeRoomData(AppState.currentRoomId, { message: '' });
  }

  if (DOM.previewMessage) DOM.previewMessage.textContent = '';
  showToast('Message cleared', 'info');
}

// ── QR CODE GENERATION ───────────────────────────────────────
function generateQRCode(roomId) {
  if (!DOM.qrCodeContainer) return;

  DOM.qrCodeContainer.innerHTML = '';

  const speakerUrl = getSpeakerUrl(roomId);

  try {
    new QRCode(DOM.qrCodeContainer, {
      text: speakerUrl,
      width: 150,
      height: 150,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  } catch (err) {
    DOM.qrCodeContainer.innerHTML =
      `<p style="color:var(--text-muted);font-size:0.8rem">QR: ${roomId}</p>`;
    console.warn('QRCode generation error:', err);
  }
}

function updateShareLinks(roomId) {
  const speakerUrl = getSpeakerUrl(roomId);

  if (DOM.speakerUrlDisplay) {
    DOM.speakerUrlDisplay.textContent = speakerUrl;
  }
}

function copyUrl() {
  if (!DOM.speakerUrlDisplay) return;

  const url = DOM.speakerUrlDisplay.textContent;
  if (!url || url === '--') {
    showToast('No URL to copy', 'warning');
    return;
  }

  navigator.clipboard.writeText(url)
    .then(() => showToast('Speaker link copied!', 'success'))
    .catch(() => {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast('Link copied!', 'success');
    });
}

function shareWhatsApp() {
  if (!AppState.currentRoomId) return;
  const url = getSpeakerUrl(AppState.currentRoomId);
  const msg = encodeURIComponent(
    `You're invited to present! Open this link on your device:\n${url}\n\nRoom ID: ${AppState.currentRoomId}\n\nPowered by ElitePace`
  );
  window.open(`https://wa.me/?text=${msg}`, '_blank', 'noopener');
}

function shareEmail() {
  if (!AppState.currentRoomId) return;
  const url = getSpeakerUrl(AppState.currentRoomId);
  const subject = encodeURIComponent('Your ElitePace Speaker Link');
  const body = encodeURIComponent(
    `Hi,\n\nHere is your speaker timer link:\n${url}\n\nRoom ID: ${AppState.currentRoomId}\n\nSimply open this link on your device before presenting.\n\nPowered by ElitePace`
  );
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

// ── SESSION MANAGEMENT ───────────────────────────────────────
function endSession() {
  if (DOM.endSessionModal) {
    DOM.endSessionModal.classList.remove('hidden');
  }
}

function cancelEnd() {
  if (DOM.endSessionModal) {
    DOM.endSessionModal.classList.add('hidden');
  }
}

function confirmEndSession() {
  try {
    const feedback = DOM.endFeedback?.value?.trim() || '';

    // Save feedback
    if (feedback) {
      saveFeedback({ feedback, roomId: AppState.currentRoomId });
    }

    // Update room status
    if (AppState.currentRoomId) {
      writeRoomData(AppState.currentRoomId, {
        status: 'ended',
        endedAt: Date.now()
      });
    }

    // Cleanup
    stopManagerTimer();
    stopListening();
    releaseWakeLock();

    if (DOM.endSessionModal) DOM.endSessionModal.classList.add('hidden');

    showView('endedView');
    trackEvent('session_ended', { room: AppState.currentRoomId });

  } catch (err) {
    console.error('confirmEndSession error:', err);
    showToast('Error ending session', 'error');
  }
}

// ── SESSION STATS ────────────────────────────────────────────
function updateSessionStats() {
  if (DOM.statMessages) {
    DOM.statMessages.textContent = AppState.session.messagesSent;
  }
  if (DOM.statPauses) {
    DOM.statPauses.textContent = AppState.session.pauseCount;
  }
  if (DOM.statAdjusts) {
    DOM.statAdjusts.textContent = AppState.session.adjustCount;
  }
}

// ── FEEDBACK & ANALYTICS ─────────────────────────────────────
function saveFeedback(data) {
  try {
    const feedbacks = JSON.parse(
      localStorage.getItem('ep_feedbacks') || '[]'
    );
    feedbacks.push({ ...data, timestamp: Date.now() });
    localStorage.setItem('ep_feedbacks', JSON.stringify(feedbacks.slice(-50)));
  } catch (e) {}
}

function trackEvent(eventName, properties = {}) {
  // Google Analytics 4
  try {
    if (typeof gtag !== 'undefined') {
      gtag('event', eventName, properties);
    }
  } catch (e) {}

  // PostHog
  try {
    if (typeof posthog !== 'undefined') {
      posthog.capture(eventName, properties);
    }
  } catch (e) {}

  // Local tracking
  try {
    const events = JSON.parse(
      localStorage.getItem('ep_events') || '[]'
    );
    events.push({ event: eventName, properties, ts: Date.now() });
    localStorage.setItem('ep_events',
      JSON.stringify(events.slice(-100)));
  } catch (e) {}
}

// ── URL ROUTING ──────────────────────────────────────────────
function handleRouting() {
  try {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('room');
    const role = params.get('role');

    if (roomId && role === 'speaker') {
      initSpeakerView(roomId.toUpperCase().trim());
    } else if (roomId && role === 'manager') {
      AppState.currentRoomId = roomId.toUpperCase().trim();
      initManagerView(roomId.toUpperCase().trim());
    } else {
      showView('homeView');
    }

  } catch (err) {
    console.error('Routing error:', err);
    showView('homeView');
  }
}

function goHome() {
  stopManagerTimer();
  stopSpeakerLocalTimer();
  stopListening();
  releaseWakeLock();

  AppState.currentRoomId = null;
  AppState.isManager = false;
  AppState.isSpeaker = false;
  AppState.timer.isRunning = false;

  window.history.pushState({}, '', window.location.pathname);
  showView('homeView');
  loadDailyStat();
}

function loadDailyStat() {
  try {
    const today = new Date().toDateString();
    const stored = JSON.parse(localStorage.getItem('ep_daily_stat') || '{}');
    if (stored.date === today && DOM.statRooms) {
      DOM.statRooms.textContent = stored.count || '0';
    }
  } catch (e) {}
}

// ── LOADING SCREEN ───────────────────────────────────────────
function hideLoadingScreen() {
  setTimeout(() => {
    if (DOM.loadingScreen) {
      DOM.loadingScreen.classList.add('fade-out');
      setTimeout(() => {
        if (DOM.loadingScreen) DOM.loadingScreen.style.display = 'none';
        if (DOM.app) DOM.app.classList.remove('hidden');
        handleRouting();
      }, 500);
    }
  }, CONFIG.LOADING_DURATION_MS);
}

// ── STAR RATING ──────────────────────────────────────────────
function initStarRating() {
  if (!DOM.ratingStars) return;

  const stars = DOM.ratingStars.querySelectorAll('.star');
  stars.forEach((star, idx) => {
    star.addEventListener('click', () => {
      AppState.session.rating = idx + 1;
      stars.forEach((s, i) => {
        s.classList.toggle('active', i <= idx);
      });
    });

    star.addEventListener('mouseenter', () => {
      stars.forEach((s, i) => {
        s.style.filter = i <= idx ? 'grayscale(0%)' : 'grayscale(100%)';
      });
    });

    star.addEventListener('mouseleave', () => {
      stars.forEach((s, i) => {
        const isActive = s.classList.contains('active');
        s.style.filter = isActive ? 'grayscale(0%)' : 'grayscale(100%)';
      });
    });
  });
}

function submitFeedback() {
  const text = DOM.feedbackText?.value?.trim() || '';
  const rating = AppState.session.rating;

  saveFeedback({ text, rating, type: 'end_screen' });
  trackEvent('feedback_submitted', { rating, hasText: !!text });

  showToast('Thank you for your feedback! 🙏', 'success');

  if (DOM.feedbackText) DOM.feedbackText.value = '';
  if (DOM.submitFeedbackBtn) {
    DOM.submitFeedbackBtn.innerHTML =
      '<i class="fas fa-check"></i> Feedback Submitted!';
    DOM.submitFeedbackBtn.disabled = true;
  }
}

// ── AI TEASER ────────────────────────────────────────────────
function showAITeaser() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="text-align:center">
      <div style="font-size:3rem;margin-bottom:1rem">✨</div>
      <h2 style="justify-content:center">AI Tone Polish</h2>
      <p style="margin-bottom:1.5rem">
        This feature uses AI to craft perfectly-toned messages
        based on speaker behavior, pacing patterns, and time remaining.
        <br/><br/>
        <strong style="color:var(--accent-primary)">Coming in Pro Version!</strong>
      </p>
      <div style="background:var(--surface);border-radius:var(--radius-md);
        padding:1rem;margin-bottom:1.5rem;font-size:0.9rem;
        color:var(--text-secondary)">
        🎯 AI-crafted messages<br/>
        📊 Behavior-based tone detection<br/>
        🔮 Smart timing suggestions
      </div>
      <button class="btn-primary full-width" id="aiWaitlistBtn">
        <i class="fas fa-bell"></i> Join the Waitlist
      </button>
      <button class="btn-ghost full-width" style="margin-top:0.75rem"
        onclick="this.closest('.modal-overlay').remove()">
        Maybe Later
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#aiWaitlistBtn').addEventListener('click', () => {
    trackEvent('ai_waitlist_click');
    showToast("You're on the list! We'll notify you. 🚀", 'success');
    overlay.remove();

    // Save waitlist intent
    try {
      const waitlist = JSON.parse(
        localStorage.getItem('ep_waitlist') || '[]'
      );
      waitlist.push({ ts: Date.now(), feature: 'ai_tone_polish' });
      localStorage.setItem('ep_waitlist', JSON.stringify(waitlist));
    } catch (e) {}
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  trackEvent('ai_teaser_clicked');
}

// ── EVENT LISTENERS ──────────────────────────────────────────
function attachEventListeners() {

  // Theme toggle
  DOM.themeToggle?.addEventListener('click', toggleTheme);

  // Create Session
  DOM.createSessionBtn?.addEventListener('click', createNewSession);

  // Join Session
  DOM.joinSessionBtn?.addEventListener('click', () => {
    if (DOM.joinModal) DOM.joinModal.classList.remove('hidden');
    setTimeout(() => DOM.joinRoomIdInput?.focus(), 100);
  });

  DOM.closeJoinModal?.addEventListener('click', () => {
    if (DOM.joinModal) DOM.joinModal.classList.add('hidden');
  });

  DOM.joinRoomBtn?.addEventListener('click', joinRoom);

  DOM.joinRoomIdInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinRoom();
  });

  // Close modal on backdrop click
  DOM.joinModal?.addEventListener('click', (e) => {
    if (e.target === DOM.joinModal) {
      DOM.joinModal.classList.add('hidden');
    }
  });

  // Timer Controls
  DOM.setTimerBtn?.addEventListener('click', setTimer);
  DOM.startBtn?.addEventListener('click', startTimer);
  DOM.pauseBtn?.addEventListener('click', pauseTimer);
  DOM.resetBtn?.addEventListener('click', resetTimer);

  // Quick Adjust
  DOM.minus5Btn?.addEventListener('click', () => adjustTime(-300));
  DOM.minus1Btn?.addEventListener('click', () => adjustTime(-60));
  DOM.plus1Btn?.addEventListener('click', () => adjustTime(60));
  DOM.plus5Btn?.addEventListener('click', () => adjustTime(300));

  // Share
  DOM.shareRoomBtn?.addEventListener('click', () => {
    if (AppState.currentRoomId) {
      const url = getSpeakerUrl(AppState.currentRoomId);
      if (navigator.share) {
        navigator.share({ title: 'ElitePace Speaker Link', url })
          .catch(() => copyUrl());
      } else {
        copyUrl();
      }
    }
  });

  DOM.copyUrlBtn?.addEventListener('click', copyUrl);
  DOM.whatsappShareBtn?.addEventListener('click', shareWhatsApp);
  DOM.emailShareBtn?.addEventListener('click', shareEmail);

  // Message
  DOM.messageInput?.addEventListener('input', () => {
    const len = (DOM.messageInput.value || '').length;
    if (DOM.charCount) DOM.charCount.textContent = len;
    if (len > CONFIG.MESSAGE_MAX_LENGTH) {
      DOM.messageInput.value =
        DOM.messageInput.value.slice(0, CONFIG.MESSAGE_MAX_LENGTH);
      if (DOM.charCount) {
        DOM.charCount.textContent = CONFIG.MESSAGE_MAX_LENGTH;
      }
    }
  });

  DOM.sendMessageBtn?.addEventListener('click', sendMessage);
  DOM.clearMsgBtn?.addEventListener('click', clearMessage);

  // Quick messages
  document.querySelectorAll('.quick-msg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const msg = btn.getAttribute('data-msg');
      if (msg && DOM.messageInput) {
        DOM.messageInput.value = msg;
        if (DOM.charCount) DOM.charCount.textContent = msg.length;
        DOM.messageInput.focus();
      }
    });
  });

  // AI Teaser
  DOM.aiTeaserBtn?.addEventListener('click', showAITeaser);

  // End Session
  DOM.endSessionBtn?.addEventListener('click', endSession);
  DOM.cancelEndBtn?.addEventListener('click', cancelEnd);
  DOM.confirmEndBtn?.addEventListener('click', confirmEndSession);

  // Feedback
  DOM.submitFeedbackBtn?.addEventListener('click', submitFeedback);

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);

  // BroadcastChannel for demo mode
  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', (e) => {
      if (e.data && e.data.roomId === AppState.currentRoomId
        && AppState.isSpeaker) {
        applySpeakerState(e.data.data);
      }
    });
  }

  // Timer inputs - Enter key
  DOM.timerMinutes?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') setTimer();
  });
  DOM.timerSeconds?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') setTimer();
  });

  // Message - Enter key (Ctrl+Enter)
  DOM.messageInput?.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      sendMessage();
    }
  });
}

function handleKeyboardShortcuts(e) {
  if (AppState.currentView === 'managerView') {
    // Space = Start/Pause
    if (e.code === 'Space' &&
      e.target.tagName !== 'INPUT' &&
      e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      if (AppState.timer.isRunning) {
        pauseTimer();
      } else {
        startTimer();
      }
    }
    // R = Reset
    if (e.code === 'KeyR' && e.ctrlKey) {
      e.preventDefault();
      resetTimer();
    }
    // Escape = close modals
    if (e.code === 'Escape') {
      cancelEnd();
      if (DOM.joinModal) DOM.joinModal.classList.add('hidden');
    }
  }
}

function joinRoom() {
  try {
    const rawId = DOM.joinRoomIdInput?.value?.trim() || '';
    const roomId = rawId.toUpperCase();

    if (!roomId) {
      showToast('Please enter a Room ID', 'warning');
      if (DOM.joinRoomIdInput) shakeElement(DOM.joinRoomIdInput);
      return;
    }

    if (roomId.length < 4 || roomId.length > 8) {
      showToast('Invalid Room ID format', 'error');
      if (DOM.joinRoomIdInput) shakeElement(DOM.joinRoomIdInput);
      return;
    }

    if (DOM.joinModal) DOM.joinModal.classList.add('hidden');

    window.history.pushState(
      { roomId, role: 'speaker' }, '',
      `?room=${roomId}&role=speaker`
    );
    initSpeakerView(roomId);

  } catch (err) {
    console.error('joinRoom error:', err);
    showToast('Error joining room', 'error');
  }
}

// ── INITIALIZATION ───────────────────────────────────────────
function init() {
  try {
    cacheDOMElements();
    initTheme();
    initStarRating();
    attachEventListeners();
    loadDailyStat();
    hideLoadingScreen();

    // Handle browser back/forward
    window.addEventListener('popstate', () => {
      handleRouting();
    });

    console.log('✅ ElitePace initialized successfully');

  } catch (err) {
    console.error('❌ ElitePace init error:', err);
    // Still try to show the app
    if (DOM.loadingScreen) DOM.loadingScreen.style.display = 'none';
    if (DOM.app) DOM.app.classList.remove('hidden');
    showView('homeView');
  }
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
