// GitBook-native icon metadata is the publishing source; these small original
// outline glyphs are a local preview only, not a replacement for GitBook's font.
// Source syntax: https://gitbook.com/docs/create-content/formatting/inline
// Frontmatter: https://gitbook.com/docs/skill/write-docs
const shapes = {
  'book-open': '<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
  'magnifying-glass': '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  leaf: '<path d="M20 3c1 8-2 15-9 16-6 1-9-6-5-10 3-3 9-2 14-6Z"/><path d="M4 21 16 9"/>',
  seedling: '<path d="M12 21V10M12 14C5 14 3 11 3 5c6 0 9 3 9 9Zm0-4c0-5 3-7 9-7 0 6-3 9-9 9"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M3 12c5 3 13 3 18 0M12 12v4"/>',
  house: '<path d="m3 11 9-8 9 8M5 9v12h14V9M9 21v-8h6v8"/>',
  store: '<path d="M4 9v12h16V9M3 9l2-6h14l2 6M3 9c0 4 5 4 5 0 0 4 8 4 8 0 0 4 5 4 5 0M9 21v-7h6v7"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M16 5a3 3 0 0 1 0 6M18 14c3 1 4 3 4 7"/>',
  comments: '<path d="M3 4h14v10H8l-5 4V4ZM10 18h6l5 3V9"/>',
  'circle-question': '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17h.01"/>',
  bullhorn: '<path d="m4 9 16-6v18L4 15V9ZM7 16l2 5h3l-1-4M3 9v6M16 5v14"/>',
  'layer-group': '<path d="m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5"/>',
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5ZM9 3v16M15 5v16"/>',
  route: '<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h10a4 4 0 0 1 0 8H7a3 3 0 0 0 0 6h10"/>',
  'box-archive': '<rect x="3" y="3" width="18" height="5" rx="1"/><path d="M5 8v13h14V8M9 12h6"/>',
  envelope: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 7 9-7"/>',
  paw: '<ellipse cx="5" cy="10" rx="2" ry="3"/><ellipse cx="10" cy="5" rx="2" ry="3"/><ellipse cx="16" cy="5" rx="2" ry="3"/><ellipse cx="21" cy="10" rx="2" ry="3"/><path d="M6 18c0-3 3-6 6-6s6 3 6 6-3 3-6 2c-3 1-6 1-6-2Z"/>',
  terminal: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m6 8 4 4-4 4M13 16h5"/>',
  gem: '<path d="m3 8 4-5h10l4 5-9 13L3 8Zm0 0h18M7 3l5 18 5-18"/>',
  utensils: '<path d="M5 3v7a3 3 0 0 0 6 0V3M8 3v18M18 3c-3 3-3 8 0 9h2M20 3v18"/>',
  'screwdriver-wrench': '<path d="m4 3 4 1 8 8-4 4-8-8-1-4 1-1ZM15 15l6 6M3 21l6-6M15 8a5 5 0 0 1 6-6l-3 3 1 2 3-3a5 5 0 0 1-5 6"/>'
};

function icon(name, context = 'inline') {
  if (!shapes[name]) throw Error('Missing preview glyph for GitBook icon: '+name);
  if (!['inline', 'page', 'nav'].includes(context)) throw Error('Unknown icon context');
  return `<svg class="wiki-icon wiki-icon--${context}" data-icon="${name}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shapes[name]}</svg>`;
}

function pageSource(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return {body: source, icon: null};
  const name = match[1].match(/^icon:\s*['"]?([a-z0-9-]+)['"]?\s*$/m)?.[1] || null;
  if (name && !shapes[name]) throw Error('Missing preview glyph for GitBook page icon: '+name);
  return {body: source.slice(match[0].length), icon: name};
}

function renderInline(html) {
  return html.replace(/<i class="fa-([a-z0-9-]+)">:([a-z0-9-]+):<\/i>/g, (_, name, token) => {
    if (name !== token) throw Error('GitBook icon class/token mismatch: '+name+'/'+token);
    return icon(name);
  });
}

module.exports = {icon, pageSource, renderInline};
