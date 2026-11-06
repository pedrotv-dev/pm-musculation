/**
 * PM Musculation — catalogue des machines (data/machines.json) partage par tous les ecrans.
 * Les images sont facultatives : assets/machines/<id>.png ; l'ecran affiche un repere si elles sont absentes.
 */
let loading = null;

/** @returns {Promise<{list: object[], byId: Map<string, object>, strength: object[]}>} (jamais de rejet) */
export function loadCatalog() {
  if (!loading) {
    loading = fetch(new URL('../data/machines.json', import.meta.url).href)
      .then(r => { if (!r.ok) throw new Error('catalogue indisponible'); return r.json(); })
      .then(data => {
        const list = Array.isArray(data.machines) ? data.machines : [];
        return { list, byId: new Map(list.map(m => [m.id, m])), strength: list.filter(m => m.kind === 'strength') };
      })
      .then(async catalog => {
        // assets/machines/index.json liste les photos reellement presentes : aucune requete vers un fichier absent
        try {
          const r = await fetch(new URL('../assets/machines/index.json', import.meta.url).href);
          const j = r.ok ? await r.json() : { available: [] };
          catalog.images = new Set(Array.isArray(j.available) ? j.available : []);
        } catch (_) { catalog.images = new Set(); }
        return catalog;
      })
      .catch(() => { loading = null; return { list: [], byId: new Map(), strength: [], images: new Set() }; });
  }
  return loading;
}
const machineImageUrl = id => new URL('../assets/machines/' + encodeURIComponent(id) + '.png', import.meta.url).href;

/** <img> avec repli visuel si le fichier n'existe pas (`available` : ensemble des ids ayant une photo, catalog.images). */
export function machineImage(id, alt = '', available = null) {
  const wrap = document.createElement('div');
  wrap.className = 'pm-machine-image';
  if (available && !available.has(id)) { wrap.classList.add('pm-no-image'); wrap.dataset.fallback = '▣'; return wrap; }
  const img = document.createElement('img');
  img.alt = alt; img.loading = 'lazy'; img.decoding = 'async';
  img.addEventListener('error', () => { wrap.classList.add('pm-no-image'); img.remove(); wrap.dataset.fallback = '▣'; }, { once: true });
  img.src = machineImageUrl(id);
  wrap.append(img);
  return wrap;
}
