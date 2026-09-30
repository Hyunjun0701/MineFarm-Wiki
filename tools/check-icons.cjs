const assert = require('node:assert/strict');
const {pageSource, icon, renderInline} = require('./preview-icons.cjs');

// Native source stays plain text; only the preview creates decorative SVG.
assert.deepEqual(pageSource('# 제목\n\n본문'), {body:'# 제목\n\n본문', icon:null});
assert.deepEqual(pageSource('---\nicon: book-open\n---\n\n# 제목'), {body:'\n# 제목', icon:'book-open'});
assert.deepEqual(pageSource('---\r\nicon: "map"\r\n---\r\n본문'), {body:'본문', icon:'map'});
assert.deepEqual(pageSource('---\ndescription: "값: 유지"\n---\n# 제목'), {body:'# 제목', icon:null});
assert.match(icon('leaf'), /aria-hidden="true" focusable="false"/);
assert.match(icon('leaf','nav'), /wiki-icon--nav/);
assert.equal(renderInline('일반 본문과 :leaf: 문자열'), '일반 본문과 :leaf: 문자열');
assert.match(renderInline('<strong><i class="fa-leaf">:leaf:</i> 생산</strong>'), /^<strong><svg/);
assert.throws(()=>renderInline('<i class="fa-leaf">:map:</i>'), /mismatch/);
assert.throws(()=>icon('unknown-glyph'), /Missing preview glyph/);
assert.throws(()=>pageSource('---\nicon: unknown-glyph\n---\n본문'), /Missing preview glyph/);
assert.throws(()=>icon('leaf','unexpected'), /Unknown icon context/);
for(const context of ['inline','page','nav'])assert.match(icon('leaf',context), /width="24" height="24" viewBox="0 0 24 24"/, context+': safe intrinsic size without CSS');
console.log('15 icon source/render checks passed');
