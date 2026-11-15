const BG_KEY = 'ta_bg_pattern';

export const BG_PATTERNS = [
  {
    id: 'none',
    name: 'Polos (Default)',
    desc: 'Latar belakang bersih tanpa pola'
  },
  {
    id: 'kawung',
    name: 'Batik Kawung',
    desc: 'Motif geometris klasik Batik Jawa'
  },
  {
    id: 'whatsapp',
    name: 'Chat Doodle',
    desc: 'Terinspirasi WhatsApp Default Wallpaper'
  },
  {
    id: 'telegram',
    name: 'Topografi Organik',
    desc: 'Terinspirasi Telegram Patterned Wallpaper'
  },
  {
    id: 'dots',
    name: 'Dot Matrix',
    desc: 'Pola titik presisi minimalis'
  }
];

const VALID_IDS = new Set(BG_PATTERNS.map(p => p.id));

export function getBgPattern() {
  try {
    const val = localStorage.getItem(BG_KEY);
    return VALID_IDS.has(val) ? val : 'none';
  } catch {
    return 'none';
  }
}

export function applyBgPattern(id) {
  const safeId = VALID_IDS.has(id) ? id : 'none';
  if (safeId === 'none') {
    document.documentElement.removeAttribute('data-bg');
  } else {
    document.documentElement.setAttribute('data-bg', safeId);
  }
  return safeId;
}

export function saveBgPattern(id) {
  const safeId = applyBgPattern(id);
  try {
    localStorage.setItem(BG_KEY, safeId);
  } catch {}
  return safeId;
}
