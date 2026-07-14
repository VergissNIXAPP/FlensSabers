/* FlensSabers Media Gallery
   Lädt automatisch alle unterstützten Bilder und Videos aus dem Ordner "media".
   Auf GitHub Pages wird das zugehörige öffentliche Repository automatisch erkannt.

   Optional kann die Quelle vor diesem Script fest vorgegeben werden:
   window.FLENS_MEDIA_CONFIG = {
     githubRepo: 'BENUTZER/REPOSITORY',
     branch: 'main',
     folder: 'media'
   };
*/
(async function(){
  'use strict';

  const grid = document.getElementById('mediaGrid');
  const lightbox = document.getElementById('lightbox');
  const stage = document.getElementById('lightboxStage');
  const meta = document.getElementById('lightboxMeta');
  if(!grid || !lightbox || !stage) return;

  const config = Object.assign({
    githubRepo: '',
    branch: '',
    folder: 'media'
  }, window.FLENS_MEDIA_CONFIG || {});

  const IMAGE_EXTENSIONS = new Set([
    'jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp', 'svg'
  ]);
  const VIDEO_EXTENSIONS = new Set([
    'mp4', 'webm', 'ogg', 'ogv', 'm4v', 'mov'
  ]);
  const SUPPORTED_EXTENSIONS = new Set([
    ...IMAGE_EXTENSIONS,
    ...VIDEO_EXTENSIONS
  ]);

  const fallbackItems = [
    { type:'image', src:'images/team.webp', fallback:'images/team.png', alt:'FlensSabers Team beim Laserschwerttraining', label:'Foto' },
    { type:'image', src:'images/gruppe.webp', fallback:'images/gruppe.png', alt:'FlensSabers Gruppe beim Training', label:'Foto' },
    { type:'image', src:'images/portrait.webp', fallback:'images/portrait.png', alt:'FlensSabers bei einem Auftritt', label:'Foto' }
  ];

  let items = [];
  let current = 0;

  function setLoading(message){
    grid.innerHTML = `<div class="media-wall__loading">${escapeHtml(message)}</div>`;
  }

  function escapeHtml(value){
    return String(value || '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function safeDecode(value){
    try{ return decodeURIComponent(value); }
    catch(_){ return value; }
  }

  function extensionOf(value){
    const clean = String(value || '').split('?')[0].split('#')[0];
    const filename = clean.slice(clean.lastIndexOf('/') + 1);
    const dot = filename.lastIndexOf('.');
    return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : '';
  }

  function isSupported(value){
    return SUPPORTED_EXTENSIONS.has(extensionOf(value));
  }

  function mediaType(value){
    return VIDEO_EXTENSIONS.has(extensionOf(value)) ? 'video' : 'image';
  }

  function humanTitle(value){
    const clean = safeDecode(String(value || '').split('?')[0].split('#')[0]);
    const filename = clean.slice(clean.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');
    const title = filename.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    return title || 'FlensSabers Media';
  }

  function absoluteUrl(value, base){
    try{ return new URL(value, base || document.baseURI).href; }
    catch(_){ return value; }
  }

  function normalizeItem(item, index, base){
    const source = typeof item === 'string' ? { src:item } : (item || {});
    const src = absoluteUrl(source.src || source.path || source.url || '', base);
    if(!src || !isSupported(src)) return null;

    const type = source.type === 'video' || source.type === 'image'
      ? source.type
      : mediaType(src);
    const title = source.title || humanTitle(source.name || src);

    return {
      id: source.id || `media-${index + 1}`,
      type,
      src,
      fallback: source.fallback ? absoluteUrl(source.fallback, base) : '',
      poster: source.poster ? absoluteUrl(source.poster, base) : '',
      alt: source.alt || title,
      label: source.label || (type === 'video' ? 'Video' : 'Foto'),
      title,
      sortName: source.name || title
    };
  }

  function naturalSort(list){
    return list.sort((a, b) => String(a.sortName || a.title || a.src).localeCompare(
      String(b.sortName || b.title || b.src),
      'de',
      { numeric:true, sensitivity:'base' }
    ));
  }

  function normalizeList(list, base){
    const unique = new Map();
    (Array.isArray(list) ? list : []).forEach((entry, index) => {
      const item = normalizeItem(entry, index, base);
      if(item && !unique.has(item.src)) unique.set(item.src, item);
    });
    return naturalSort([...unique.values()]);
  }

  function tileMarkup(item, index){
    if(item.type === 'video'){
      return `
        <button class="media-tile" type="button" data-media-index="${index}" aria-label="${escapeHtml(item.alt)} öffnen">
          <span class="media-tile__badge">${escapeHtml(item.label)}</span>
          <video class="media-tile__media" src="${escapeHtml(item.src)}" ${item.poster ? `poster="${escapeHtml(item.poster)}"` : ''} muted playsinline preload="metadata"></video>
          <span class="media-tile__name">${escapeHtml(item.title)}</span>
        </button>`;
    }

    return `
      <button class="media-tile" type="button" data-media-index="${index}" aria-label="${escapeHtml(item.alt)} öffnen">
        <span class="media-tile__badge">${escapeHtml(item.label)}</span>
        <img class="media-tile__media" src="${escapeHtml(item.src)}" ${item.fallback ? `data-fallback="${escapeHtml(item.fallback)}"` : ''} alt="${escapeHtml(item.alt)}" loading="lazy" decoding="async"/>
        <span class="media-tile__name">${escapeHtml(item.title)}</span>
      </button>`;
  }

  function render(){
    if(!items.length){
      grid.innerHTML = '<div class="media-wall__loading">Aktuell sind noch keine unterstützten Bilder oder Videos im Media-Ordner vorhanden.</div>';
      return;
    }

    grid.innerHTML = items.map(tileMarkup).join('');
    grid.querySelectorAll('img[data-fallback]').forEach((img) => {
      img.addEventListener('error', () => {
        const fallback = img.dataset.fallback;
        if(fallback && img.src !== fallback) img.src = fallback;
      }, { once:true });
    });
  }

  function show(index){
    if(!items.length) return;
    current = (index + items.length) % items.length;
    const item = items[current];

    if(item.type === 'video'){
      stage.innerHTML = `<video class="lightbox__video" src="${escapeHtml(item.src)}" ${item.poster ? `poster="${escapeHtml(item.poster)}"` : ''} controls autoplay playsinline></video>`;
    }else{
      stage.innerHTML = `<img class="lightbox__img" src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt)}"/>`;
      const img = stage.querySelector('img');
      if(img && item.fallback){
        img.addEventListener('error', () => {
          if(img.src !== item.fallback) img.src = item.fallback;
        }, { once:true });
      }
    }

    if(meta) meta.textContent = item.title || item.alt;
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
    lightbox.querySelector('[data-lightbox-close]')?.focus({ preventScroll:true });
  }

  function close(){
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
    stage.innerHTML = '';
  }

  async function fetchJson(url){
    const response = await fetch(url, {
      cache:'no-store',
      headers:{
        'Accept':'application/vnd.github+json, application/json',
        'X-GitHub-Api-Version':'2022-11-28'
      }
    });
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function loadManifest(){
    const base = absoluteUrl(`${String(config.folder || 'media').replace(/^\/+|\/+$/g, '')}/`, document.baseURI);
    const candidates = ['manifest.json', 'index.json', 'media.json'];

    for(const filename of candidates){
      try{
        const response = await fetch(new URL(filename, base), { cache:'no-store' });
        if(!response.ok) continue;
        const data = await response.json();
        const list = Array.isArray(data) ? data : (data.items || data.media || data.files || []);
        const normalized = normalizeList(list, base);
        if(normalized.length) return normalized;
      }catch(_){ }
    }
    return [];
  }

  async function loadDirectoryIndex(){
    const base = absoluteUrl(`${String(config.folder || 'media').replace(/^\/+|\/+$/g, '')}/`, document.baseURI);
    try{
      const response = await fetch(base, { cache:'no-store' });
      if(!response.ok) return [];
      const type = response.headers.get('content-type') || '';
      if(!type.includes('text/html')) return [];

      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const baseUrl = new URL(base);
      const found = [];

      doc.querySelectorAll('a[href]').forEach((anchor) => {
        try{
          const url = new URL(anchor.getAttribute('href'), baseUrl);
          if(url.origin !== baseUrl.origin) return;
          if(!url.pathname.startsWith(baseUrl.pathname)) return;
          if(!isSupported(url.pathname)) return;
          found.push({ src:url.href, name:url.pathname.split('/').pop() });
        }catch(_){ }
      });

      return normalizeList(found, base);
    }catch(_){
      return [];
    }
  }

  function inferGithubRepository(){
    const explicit = String(config.githubRepo || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '');
    if(/^[^/]+\/[^/]+$/.test(explicit)) return explicit;

    const host = location.hostname.toLowerCase();
    if(!host.endsWith('.github.io')) return '';

    const owner = host.slice(0, -'.github.io'.length);
    const firstPathPart = location.pathname.split('/').filter(Boolean)[0] || '';
    const repo = firstPathPart && !/\.html?$/i.test(firstPathPart)
      ? firstPathPart
      : `${owner}.github.io`;
    return `${owner}/${repo}`;
  }

  function encodePath(path){
    return String(path || '').split('/').map(encodeURIComponent).join('/');
  }

  function chooseMediaRoot(tree){
    const folderName = String(config.folder || 'media').replace(/^\/+|\/+$/g, '').toLowerCase();
    const groups = new Map();

    (tree || []).forEach((entry) => {
      if(entry.type !== 'blob' || !isSupported(entry.path)) return;
      const parts = String(entry.path || '').split('/');
      const folderIndex = parts.findIndex(part => part.toLowerCase() === folderName);
      if(folderIndex < 0 || folderIndex === parts.length - 1) return;

      const root = parts.slice(0, folderIndex + 1).join('/');
      if(!groups.has(root)) groups.set(root, []);
      groups.get(root).push(entry);
    });

    const ranked = [...groups.entries()].map(([root, files]) => {
      const lower = root.toLowerCase();
      let priority = files.length;
      if(lower === folderName) priority += 100000;
      else if(lower === `docs/${folderName}`) priority += 90000;
      else if(lower === `public/${folderName}`) priority += 80000;
      else if(lower.endsWith(`/${folderName}`)) priority += 50000;
      return { root, files, priority };
    }).sort((a, b) => b.priority - a.priority);

    return ranked[0] || null;
  }

  async function loadGithubBranch(fullName, branch){
    const [owner, repo] = fullName.split('/');
    const treeUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
    const data = await fetchJson(treeUrl);
    const selected = chooseMediaRoot(data.tree || []);
    if(!selected || !selected.files.length) return [];

    const rawBase = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/`;
    return normalizeList(selected.files.map((entry) => ({
      src: rawBase + encodePath(entry.path),
      name: entry.path.split('/').pop()
    })));
  }

  async function loadGithubRepository(fullName, knownBranch){
    if(!/^[^/]+\/[^/]+$/.test(fullName || '')) return [];

    let defaultBranch = knownBranch || config.branch || '';
    if(!defaultBranch){
      try{
        const info = await fetchJson(`https://api.github.com/repos/${fullName}`);
        defaultBranch = info.default_branch || 'main';
      }catch(_){
        defaultBranch = 'main';
      }
    }

    const branches = [...new Set([config.branch, knownBranch, defaultBranch, 'gh-pages', 'main', 'master'].filter(Boolean))];
    for(const branch of branches){
      try{
        const found = await loadGithubBranch(fullName, branch);
        if(found.length){
          try{ sessionStorage.setItem('flens_media_repo', JSON.stringify({ fullName, branch })); }
          catch(_){ }
          return found;
        }
      }catch(_){ }
    }
    return [];
  }

  async function loadCachedGithubRepository(){
    try{
      const cached = JSON.parse(sessionStorage.getItem('flens_media_repo') || 'null');
      if(cached?.fullName) return loadGithubRepository(cached.fullName, cached.branch || '');
    }catch(_){ }
    return [];
  }

  async function searchGithubRepository(){
    const query = encodeURIComponent('flenssabers in:name,description,readme');
    let result;
    try{
      result = await fetchJson(`https://api.github.com/search/repositories?q=${query}&sort=updated&order=desc&per_page=10`);
    }catch(_){
      return [];
    }

    const candidates = Array.isArray(result.items) ? result.items.slice() : [];
    candidates.sort((a, b) => {
      const score = (repo) => {
        const name = String(repo.name || '').toLowerCase();
        const fullName = String(repo.full_name || '').toLowerCase();
        let value = 0;
        if(name === 'flenssabers') value += 100;
        if(name === 'flenssabers.github.io') value += 95;
        if(fullName.includes('flenssabers')) value += 50;
        if(repo.has_pages) value += 25;
        return value;
      };
      return score(b) - score(a);
    });

    for(const repo of candidates.slice(0, 6)){
      const found = await loadGithubRepository(repo.full_name, repo.default_branch || '');
      if(found.length) return found;
    }
    return [];
  }

  async function discoverMedia(){
    const supplied = normalizeList(window.FLENS_MEDIA || [], document.baseURI);
    if(supplied.length) return supplied;

    const manifest = await loadManifest();
    if(manifest.length) return manifest;

    const directory = await loadDirectoryIndex();
    if(directory.length) return directory;

    const inferredRepo = inferGithubRepository();
    if(inferredRepo){
      const inferred = await loadGithubRepository(inferredRepo, config.branch || '');
      if(inferred.length) return inferred;
    }

    const cached = await loadCachedGithubRepository();
    if(cached.length) return cached;

    const searched = await searchGithubRepository();
    if(searched.length) return searched;

    return [];
  }

  grid.addEventListener('click', (event) => {
    const tile = event.target.closest('[data-media-index]');
    if(!tile) return;
    show(Number(tile.dataset.mediaIndex || 0));
  });

  lightbox.querySelectorAll('[data-lightbox-close]').forEach(el => el.addEventListener('click', close));
  lightbox.querySelector('[data-lightbox-prev]')?.addEventListener('click', () => show(current - 1));
  lightbox.querySelector('[data-lightbox-next]')?.addEventListener('click', () => show(current + 1));

  window.addEventListener('keydown', (event) => {
    if(!lightbox.classList.contains('is-open')) return;
    if(event.key === 'Escape') close();
    if(event.key === 'ArrowLeft') show(current - 1);
    if(event.key === 'ArrowRight') show(current + 1);
  });

  setLoading('Lade alle Dateien aus dem Media-Ordner…');

  try{
    items = await discoverMedia();
  }catch(error){
    console.warn('FlensSabers Media konnte nicht automatisch geladen werden:', error);
    items = [];
  }

  if(!items.length){
    console.warn('Kein automatisch lesbarer Media-Ordner gefunden. Es werden die integrierten Ersatzbilder angezeigt.');
    items = normalizeList(fallbackItems, document.baseURI);
  }

  render();
})();
