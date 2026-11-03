/** 線條圖示（同遊戲 icons.css 風格：方角粗線、無 emoji） */
export const ico = (d: string, sz = 22) =>
  `<svg viewBox="0 0 24 24" width="${sz}" height="${sz}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square" stroke-linejoin="miter" style="vertical-align:-4px">${d}</svg>`;

export const I = {
  shell: '<path d="M4 15c0-6 4-10 8-10s8 4 8 10c-3 2-13 2-16 0z"/><path d="M8 9l1 6M12 7v8M16 9l-1 6"/>',
  throw: '<path d="M9 9c0-4 1.5-6.5 3-7 1.5.5 3 3 3 7v9H9z"/><path d="M8 18h8v4H8zM9 13h6"/>',
  grab: '<path d="M7 11V6a1.5 1.5 0 013 0v4M10 10V4.5a1.5 1.5 0 013 0V10M13 10V5.5a1.5 1.5 0 013 0V12M16 9.5a1.5 1.5 0 013 0V14a7 7 0 01-7 7h-1a6 6 0 01-5-3l-2.5-4a1.5 1.5 0 012.5-1.6L7 14"/>',
  person: '<circle cx="12" cy="7" r="4"/><path d="M4 22a8 8 0 0116 0"/>',
  rotate: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M2 15a10 10 0 0010 7M22 9A10 10 0 0012 2"/><path d="M20 5l2 4-4 1"/>',
  umb: '<path d="M2 12a10 10 0 0120 0z"/><path d="M12 12v7a2 2 0 01-4 0"/><path d="M12 2v2"/>',
  board: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  heart: '<path d="M12 20l-8-8a4.5 4.5 0 016.5-6.3L12 7l1.5-1.3A4.5 4.5 0 0120 12z"/>',
  skull: '<path d="M5 11a7 7 0 0114 0v4h-2v4H7v-4H5z"/><path d="M9 11h.1M15 11h.1"/><path d="M10 19v-2M14 19v-2"/>',
  head: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5"/>',
  shield: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/>',
  x: '<path d="M5 5l14 14M19 5L5 19"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  gun: '<path d="M3 14h11l2-3h3v5h-2"/><path d="M4 14v5h4v-2H8"/><path d="M14 11V8h2v3"/>',
  /** 武器店：夜市攤位（棚頂＋門簾） */
  shop: '<path d="M2 9l2-5h16l2 5H2z"/><path d="M3 9h18v12H3z"/><path d="M10 21v-8h4v8"/><path d="M3 9c1.2 1.6 2.8 1.6 4 0M9 9c1.2 1.6 2.8 1.6 4 0M15 9c1.2 1.6 2.8 1.6 4 0"/>',
  scope: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
};
