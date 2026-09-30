// Render the documented GitBook source blocks without changing the publishing source.
module.exports = function createRenderer(marked, esc) {
  const {renderInline} = require('./preview-icons.cjs');
  let sequence = 0;
  function render(source) {
    const blocks = [];
    const hold = html => `\n\n<gb-preview-block data-slot="${blocks.push(html)-1}"></gb-preview-block>\n\n`;
    let md = source.replace(/{% tabs %}([\s\S]*?){% endtabs %}/g, (_, body) => {
      const id = `tabs-${sequence++}`;
      const tabs = [...body.matchAll(/{% tab title="([^"]+)" %}([\s\S]*?){% endtab %}/g)];
      if (!tabs.length) throw Error('Empty GitBook tabs');
      return hold(`<div class="content-tabs" data-tabs><div class="tab-buttons" role="tablist" aria-label="내용 분류">${tabs.map((t,i)=>`<button type="button" role="tab" id="${id}-tab-${i}" aria-controls="${id}-panel-${i}" aria-selected="${i===0}" tabindex="${i===0?0:-1}">${esc(t[1])}</button>`).join('')}</div>${tabs.map((t,i)=>`<section role="tabpanel" id="${id}-panel-${i}" aria-labelledby="${id}-tab-${i}" tabindex="0"><p class="tab-fallback-title">${esc(t[1])}</p>${render(t[2])}</section>`).join('')}</div>`);
    });
    md = md.replace(/{% stepper %}([\s\S]*?){% endstepper %}/g, (_, body) => {
      const steps = [...body.matchAll(/{% step %}([\s\S]*?){% endstep %}/g)];
      return hold(`<ol class="guide-steps">${steps.map(s=>`<li>${render(s[1])}</li>`).join('')}</ol>`);
    });
    md = md.replace(/{% hint style="(info|success|warning|danger)" %}([\s\S]*?){% endhint %}/g, (_, style, body) => {
      const labels = {info:'안내',success:'도움말',warning:'주의',danger:'중요'};
      return hold(`<div class="hint ${style}" role="note" aria-label="${labels[style]}"><span class="hint-label">${labels[style]}</span><div>${render(body)}</div></div>`);
    });
    md = md.replace(/<table data-view="cards">([\s\S]*?)<\/table>/g, (_, table) => {
      const headers = [...(table.match(/<thead>([\s\S]*?)<\/thead>/)?.[1] || '').matchAll(/<th\b([^>]*)>[\s\S]*?<\/th>/g)].map(h=>h[1]);
      const targetIndex = headers.findIndex(h=>/\bdata-card-target\b/.test(h));
      const coverIndex = headers.findIndex(h=>/\bdata-card-cover(?:\s|$)/.test(h));
      const body = table.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] || '';
      const cards = [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(row => {
        const cells = [...row[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map(c=>c[1]);
        const target = cells[targetIndex]?.match(/href="([^"]+)"/)?.[1];
        const coverLink = cells[coverIndex]?.match(/<a href="([^"]+)">([^<]*)<\/a>/);
        const cover = coverLink ? `<img class="card-cover" src="${coverLink[1]}" alt="${esc(coverLink[2])}">` : '';
        return target ? `<a class="info-card" href="${target}">${cover}<span class="card-title">${cells[0]}</span><span class="card-description">${cells[1]}</span><span class="card-action" aria-hidden="true">자세히 보기 ↗</span></a>` : `<div class="info-card">${cover}<span class="card-title">${cells[0]}</span><span class="card-description">${cells[1]}</span></div>`;
      });
      return hold(`<div class="card-grid">${cards.join('')}</div>`);
    });
    return renderInline(marked.parse(md).replace(/<gb-preview-block data-slot="(\d+)"><\/gb-preview-block>/g, (_, n)=>blocks[Number(n)]));
  }
  return render;
};
