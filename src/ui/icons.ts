/**
 * Custom vector icons for Tango²: Dog vs Cat Logic Puzzle Game.
 * Ultra-crisp, stylized, resolution-independent SVGs.
 */

export const ICONS = {
  DOG: `
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-svg icon-dog" aria-label="Dog">
      <defs>
        <radialGradient id="dogFur" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stop-color="#fbbf24"/>
          <stop offset="100%" stop-color="#d97706"/>
        </radialGradient>
        <linearGradient id="dogEarL" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#b45309"/>
          <stop offset="100%" stop-color="#78350f"/>
        </linearGradient>
        <linearGradient id="dogEarR" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#b45309"/>
          <stop offset="100%" stop-color="#78350f"/>
        </linearGradient>
      </defs>
      <!-- Left Ear (floppy puppy style) -->
      <path d="M14 18 C8 24, 6 36, 12 44 C15 48, 20 46, 22 40 C24 34, 22 22, 16 18 Z" fill="url(#dogEarL)" filter="drop-shadow(0 2px 3px rgba(0,0,0,0.25))"/>
      <!-- Right Ear -->
      <path d="M50 18 C56 24, 58 36, 52 44 C49 48, 44 46, 42 40 C40 34, 42 22, 48 18 Z" fill="url(#dogEarR)" filter="drop-shadow(0 2px 3px rgba(0,0,0,0.25))"/>
      <!-- Head Base -->
      <circle cx="32" cy="34" r="23" fill="url(#dogFur)" filter="drop-shadow(0 3px 4px rgba(0,0,0,0.2))"/>
      <!-- Muzzle / Snout -->
      <ellipse cx="32" cy="41" rx="14" ry="11" fill="#fef3c7"/>
      <!-- Nose -->
      <path d="M28 35 C30 33, 34 33, 36 35 C37 36.5, 34 40, 32 40.5 C30 40, 27 36.5, 28 35 Z" fill="#1e1b4b"/>
      <ellipse cx="30" cy="35.5" rx="1.5" ry="0.8" fill="#ffffff" opacity="0.6"/>
      <!-- Smile -->
      <path d="M28 42 Q32 45 36 42" stroke="#451a03" stroke-width="2" stroke-linecap="round" fill="none"/>
      <!-- Tongue (subtle cute) -->
      <path d="M30.5 43.5 C30.5 46.5, 33.5 46.5, 33.5 43.5 Z" fill="#f43f5e"/>
      <!-- Left Eye -->
      <ellipse cx="23" cy="30" rx="3.5" ry="4" fill="#1e1b4b"/>
      <circle cx="21.5" cy="28.5" r="1.3" fill="#ffffff"/>
      <circle cx="24" cy="31.5" r="0.6" fill="#ffffff"/>
      <!-- Right Eye -->
      <ellipse cx="41" cy="30" rx="3.5" ry="4" fill="#1e1b4b"/>
      <circle cx="39.5" cy="28.5" r="1.3" fill="#ffffff"/>
      <circle cx="42" cy="31.5" r="0.6" fill="#ffffff"/>
      <!-- Cute Cheeks -->
      <circle cx="16" cy="38" r="3.5" fill="#f87171" opacity="0.45"/>
      <circle cx="48" cy="38" r="3.5" fill="#f87171" opacity="0.45"/>
    </svg>
  `,

  CAT: `
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-svg icon-cat" aria-label="Cat">
      <defs>
        <radialGradient id="catFur" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stop-color="#818cf8"/>
          <stop offset="100%" stop-color="#4f46e5"/>
        </radialGradient>
        <linearGradient id="catEarInner" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#fda4af"/>
          <stop offset="100%" stop-color="#f43f5e"/>
        </linearGradient>
      </defs>
      <!-- Left Ear (perky feline triangle) -->
      <path d="M12 24 L22 7 C24 5, 27 10, 27 16 L17 29 Z" fill="#4338ca"/>
      <path d="M15 23 L22 10 C23 9, 25 12, 25 16 L18 26 Z" fill="url(#catEarInner)"/>
      <!-- Right Ear -->
      <path d="M52 24 L42 7 C40 5, 37 10, 37 16 L47 29 Z" fill="#4338ca"/>
      <path d="M49 23 L42 10 C41 9, 39 12, 39 16 L46 26 Z" fill="url(#catEarInner)"/>
      <!-- Head Base -->
      <ellipse cx="32" cy="36" rx="23" ry="20" fill="url(#catFur)" filter="drop-shadow(0 3px 4px rgba(0,0,0,0.25))"/>
      <!-- Forehead Mark (cute diamond/tabby mark) -->
      <path d="M32 20 L34 26 L32 28 L30 26 Z" fill="#312e81" opacity="0.4"/>
      <!-- Left Eye (almond feline) -->
      <ellipse cx="22" cy="34" rx="4" ry="4.5" fill="#0f172a"/>
      <circle cx="22" cy="34" r="3.5" fill="#34d399"/>
      <ellipse cx="22" cy="34" rx="1.4" ry="3.5" fill="#0f172a"/>
      <circle cx="20.5" cy="32" r="1.1" fill="#ffffff"/>
      <!-- Right Eye -->
      <ellipse cx="42" cy="34" rx="4" ry="4.5" fill="#0f172a"/>
      <circle cx="42" cy="34" r="3.5" fill="#34d399"/>
      <ellipse cx="42" cy="34" rx="1.4" ry="3.5" fill="#0f172a"/>
      <circle cx="40.5" cy="32" r="1.1" fill="#ffffff"/>
      <!-- Snout / Nose -->
      <polygon points="32,41 29,38 35,38" fill="#fda4af"/>
      <!-- Mouth -->
      <path d="M29 42 Q32 44 32 41 Q32 44 35 42" stroke="#1e1b4b" stroke-width="1.8" stroke-linecap="round" fill="none"/>
      <!-- Whiskers Left -->
      <line x1="26" y1="41" x2="11" y2="39" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>
      <line x1="26" y1="43" x2="12" y2="44" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>
      <!-- Whiskers Right -->
      <line x1="38" y1="41" x2="53" y2="39" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>
      <line x1="38" y1="43" x2="52" y2="44" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>
      <!-- Blush -->
      <circle cx="15" cy="40" r="3" fill="#f43f5e" opacity="0.3"/>
      <circle cx="49" cy="40" r="3" fill="#f43f5e" opacity="0.3"/>
    </svg>
  `,

  EQUAL: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-clue icon-equal" aria-label="Equal Clue">
      <rect x="4" y="6" width="16" height="4" rx="2" fill="currentColor"/>
      <rect x="4" y="14" width="16" height="4" rx="2" fill="currentColor"/>
    </svg>
  `,

  CROSS: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-clue icon-cross" aria-label="Different Clue">
      <line x1="5" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/>
      <line x1="19" y1="5" x2="5" y2="19" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/>
    </svg>
  `,

  UNDO: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>`,
  REDO: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>`,
  HINT: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-7 7c0 2.5 1.5 4.5 3 6h8c1.5-1.5 3-3.5 3-6a7 7 0 0 0-7-7z"/></svg>`,
  RESTART: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6"/><path d="M20 15.5A9 9 0 0 1 5.6 18.4L2.5 16M4 8.5A9 9 0 0 1 18.4 5.6L21.5 8"/></svg>`,
  CHECK: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
  ZOOM_IN: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`,
  ZOOM_OUT: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`,
  FIT_VIEW: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 9v6a9 9 0 0 1-9 9M3 15V9a9 9 0 0 1 9-9"/></svg>`,
  PAUSE: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
  PLAY: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  SOUND_ON: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
  SOUND_OFF: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`,
  STATS: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9v12M12 4v17M18 13v8"/><path d="M4 21h16"/></svg>`,
  DAILY: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>`,
  SETTINGS: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  HELP: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  SHARE: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
  CLOSE: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  ERASE: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>`,
  TROPHY: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2"/><path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>`
};
