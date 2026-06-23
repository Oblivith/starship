import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const SoundManagerContext = createContext(null);

const LS_KEY = 'starship_sound';

function getSavedEnabled() {
  try {
    const v = localStorage.getItem(LS_KEY);
    return v === null ? true : v !== 'false';
  } catch {
    return true;
  }
}

export function SoundManagerProvider({ children }) {
  const [soundEnabled, setSoundEnabled] = useState(getSavedEnabled);
  const [unlocked, setUnlocked] = useState(false);

  const ctxRef = useRef(null);    // AudioContext (for synthesized sounds)
  const windRef = useRef(null);   // HTMLAudioElement — wind-ambient.mp3
  const dustRef = useRef(null);   // HTMLAudioElement — dust-chime.mp3 (pre-loaded; cloned on play)
  const chimeRef = useRef(null);  // HTMLAudioElement — star-chime.mp3 (pre-loaded; cloned on play)

  // Create the AudioContext (and optionally resume it) only after a user gesture.
  const ensureCtx = useCallback(() => {
    if (ctxRef.current) {
      if (ctxRef.current.state === 'suspended') ctxRef.current.resume().catch(() => {});
      return ctxRef.current;
    }
    try {
      const AudioContextCtor =
        window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return null;
      ctxRef.current = new AudioContextCtor();
      setUnlocked(true);
    } catch {
      return null;
    }
    return ctxRef.current;
  }, []);

  // First-gesture listener: unlock the AudioContext.
  useEffect(() => {
    const unlock = () => {
      ensureCtx();
      document.removeEventListener('mousedown', unlock);
      document.removeEventListener('touchstart', unlock);
    };
    document.addEventListener('mousedown', unlock, { passive: true });
    document.addEventListener('touchstart', unlock, { passive: true });
    return () => {
      document.removeEventListener('mousedown', unlock);
      document.removeEventListener('touchstart', unlock);
    };
  }, [ensureCtx]);

  // Lazy-load all HTMLAudioElement sources after the first user gesture.
  // Wind is played via the shared instance; dust + chime are pre-cached here
  // so that subsequent clone calls in playDust/playChime get a cache-hit.
  useEffect(() => {
    if (!unlocked) return;

    // Wind ambient — shared instance, looped
    let windEl;
    try {
      windEl = new Audio('/assets/sounds/wind-ambient.mp3');
      windEl.loop = true;
      windEl.volume = 0;
      windRef.current = windEl;
    } catch (err) {
      console.warn('[SoundManager] wind-ambient.mp3 not available:', err);
    }
    if (windEl) {
      windEl.addEventListener('error', () => {
        console.warn('[SoundManager] wind-ambient.mp3 failed to load — skipping.');
        windRef.current = null;
      });
    }

    // Dust chime — pre-load into browser cache; playDust() clones this on each call
    try {
      dustRef.current = new Audio('/assets/sounds/dust-chime.mp3');
    } catch {
      console.warn('[SoundManager] dust-chime.mp3 not available.');
    }

    // Star chime — pre-load into browser cache; playChime() clones this on each call
    try {
      chimeRef.current = new Audio('/assets/sounds/star-chime.mp3');
    } catch {
      console.warn('[SoundManager] star-chime.mp3 not available.');
    }

    return () => {
      if (windEl) windEl.pause();
    };
  }, [unlocked]);

  // Pause/resume wind when the tab visibility changes.
  useEffect(() => {
    const onVis = () => {
      const w = windRef.current;
      if (!w) return;
      if (document.hidden) {
        w.pause();
      } else if (soundEnabled) {
        w.play().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [soundEnabled]);

  // Mute/unmute wind when soundEnabled changes.
  useEffect(() => {
    const w = windRef.current;
    if (!w) return;
    if (!soundEnabled) {
      w.pause();
    }
    // Resume is handled externally by the Landing scroll listener calling startWind().
  }, [soundEnabled]);

  // Start the ambient wind with a 2-second fade-in (called from Landing.jsx).
  const startWind = useCallback(() => {
    const w = windRef.current;
    if (!w || !soundEnabled) return;
    if (!w.paused) return; // already playing
    w.volume = 0;
    w.play().then(() => {
      const TARGET = 0.10;
      const STEP_MS = 50;
      const STEPS = (2000 / STEP_MS);
      let step = 0;
      const timer = setInterval(() => {
        step += 1;
        w.volume = Math.min(TARGET, (step / STEPS) * TARGET);
        if (step >= STEPS) clearInterval(timer);
      }, STEP_MS);
    }).catch(() => {});
  }, [soundEnabled]);

  // ---- file-backed sounds --------------------------------------------------

  // playDust — plays dust-chime.mp3 (the Sunovia silver chime) for rooftop
  // particle repulsion events. Throttled to every 200ms by the caller in Landing.jsx.
  // Clone strategy: each call creates a fresh Audio instance from the pre-loaded src
  // so rapid triggers (within the chime's natural duration) never cut each other off.
  const playDust = useCallback(() => {
    if (!soundEnabled || !dustRef.current) return;
    try {
      const a = new Audio(dustRef.current.src);
      a.volume = 0.22;
      a.play().catch(() => {});
    } catch {}
  }, [soundEnabled]);

  // playChime — plays star-chime.mp3 (soft/magical chime) for constellation
  // hover-proximity enter events. Clone strategy same as playDust.
  const playChime = useCallback(() => {
    if (!soundEnabled || !chimeRef.current) return;
    try {
      const a = new Audio(chimeRef.current.src);
      a.volume = 0.18;
      a.play().catch(() => {});
    } catch {}
  }, [soundEnabled]);

  // ---- synthesized sounds --------------------------------------------------
  // playClick, playWhoosh, and playHover remain Web Audio synthesis — unchanged.

  const playClick = useCallback(() => {
    if (!soundEnabled) return;
    const ac = ensureCtx();
    if (!ac) return;

    const now = ac.currentTime;

    // Primary tone: 420Hz sine
    const osc1 = ac.createOscillator();
    const gain1 = ac.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = 420;
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.22, now + 0.001);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.040);
    osc1.connect(gain1);
    gain1.connect(ac.destination);
    osc1.start(now);
    osc1.stop(now + 0.040);
    osc1.onended = () => { try { osc1.disconnect(); gain1.disconnect(); } catch {} };

    // Secondary tone: 210Hz triangle
    const osc2 = ac.createOscillator();
    const gain2 = ac.createGain();
    osc2.type = 'triangle';
    osc2.frequency.value = 210;
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.10, now + 0.001);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
    osc2.connect(gain2);
    gain2.connect(ac.destination);
    osc2.start(now);
    osc2.stop(now + 0.040);
    osc2.onended = () => { try { osc2.disconnect(); gain2.disconnect(); } catch {} };
  }, [soundEnabled, ensureCtx]);

  const playWhoosh = useCallback(() => {
    if (!soundEnabled) return;
    const ac = ensureCtx();
    if (!ac) return;

    const now = ac.currentTime;
    const bufferSize = Math.ceil(ac.sampleRate * 0.4);
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const src = ac.createBufferSource();
    src.buffer = buffer;

    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 600;
    filter.Q.value = 0.8;

    const gain = ac.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.060);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.400);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);
    src.start(now);
    src.onended = () => {
      try { src.disconnect(); filter.disconnect(); gain.disconnect(); } catch {}
    };
  }, [soundEnabled, ensureCtx]);

  const playHover = useCallback(() => {
    if (!soundEnabled) return;
    const ac = ensureCtx();
    if (!ac) return;

    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1100;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.065);
    osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch {} };
  }, [soundEnabled, ensureCtx]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try { localStorage.setItem(LS_KEY, String(next)); } catch {}
      if (!next) {
        const w = windRef.current;
        if (w) w.pause();
      }
      return next;
    });
  }, []);

  const value = {
    playChime,
    playClick,
    playWhoosh,
    playHover,
    playDust,
    toggleSound,
    soundEnabled,
    unlocked,
    startWind,
  };

  return (
    <SoundManagerContext.Provider value={value}>
      {children}
    </SoundManagerContext.Provider>
  );
}

export function useSoundManager() {
  const ctx = useContext(SoundManagerContext);
  if (!ctx) throw new Error('useSoundManager must be used inside SoundManagerProvider');
  return ctx;
}

export default SoundManagerProvider;
