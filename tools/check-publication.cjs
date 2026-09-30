// Static publication guard. Human review still decides what is a spoiler.
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
function audit(root = ROOT) {
  const summary = fs.readFileSync(path.join(root, 'SUMMARY.md'), 'utf8');
  const pages = [...summary.matchAll(/^\s*\* \[[^\]]+\]\(([^)]+\.md)\)/gm)].map(m => m[1]);
  const published = new Set(pages);
  const errors = [];
  const blocked = ['atlas/world-core.md'];
  const rules = [
    [/최초 히든 진행 조건|반복 획득 구조/, 'private progression explanation'],
    [/런타임|LIVE 운영|아이템 식별 체계|제단 위치 설정|\bTODO\b/, 'internal implementation copy'],
    [/[A-Z]:[\\/](?:Users|Soobak)|SERVER_ROOT|RESOURCE_PACK_ROOT/, 'internal filesystem reference'],
    [/world-world_(?:root|core)|atlas\/world-core\.png/, 'unpublished asset reference'],
  ];
  for (const file of pages) {
    if (blocked.includes(file)) errors.push(file + ': excluded page in navigation');
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    if (/^hidden:\s*true\s*$/m.test(source)) errors.push(file + ': hidden page in navigation');
    for (const [pattern, reason] of rules) if (pattern.test(source)) errors.push(file + ': ' + reason);
    const refs = [...source.matchAll(/\]\(([^)]+\.md)(?:#[^)]*)?\)|href="([^"]+\.md)(?:#[^"]*)?"/g)];
    for (const match of refs) {
      const ref = match[1] || match[2];
      if (/^https?:/.test(ref)) continue;
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), ref));
      if (!published.has(target)) errors.push(file + ': link outside public navigation: ' + target);
    }
  }
  // Old direct URLs must not retain a full article just because the sidebar hides them.
  for (const file of blocked) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    if (!/^hidden:\s*true\s*$/m.test(source) || source.length > 300 || /\|/.test(source)) {
      errors.push(file + ': excluded source must remain a neutral notice');
    }
  }
  return { pages: pages.length, errors };
}
if (require.main === module) {
  const result = audit();
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length) process.exitCode = 1;
}
module.exports = { audit };
