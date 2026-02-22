/*
  FlensSabers Media Loader
  - Lists files in GitHub repo folder /media
  - Shows mixed images + videos in a responsive grid
  - Click/tap to open lightbox with slideshow navigation

  Requirements:
  - Create a folder "media" in the GitHub repo root
  - Upload .png/.jpg/.jpeg/.webp/.gif and .mp4/.webm
*/

(function(){
  const DEFAULT_CFG = {
    owner: 'VergissNIXAPP',
    repo: 'FlensSabers',
    path: 'media',
    // how many items on preview grids (unused on the full media page)
    limit: 12,
    // reshuffle interval (ms). 0 = disabled (clean gallery, no auto reshuffle)
    reshuffleMs: 0,
  };

  const cfg = Object.assign({}, DEFAULT_CFG, (window.FLENS_MEDIA_CONFIG || {}));

  const grid = document.getElementById('mediaGrid');
  const lightbox = document.getElementById('lightbox');
  const stage = document.getElementById('lightboxStage');
  const meta = document.getElementById('lightboxMeta');

  // If the page has no media grid, do nothing.
  if(!grid) return;

  const shuffleBtn = document.querySelector('[data-media-shuffle]');

  const exts = {
    img: new Set(['png','jpg','jpeg','webp','gif']),
    vid: new Set(['mp4','webm'])
  };

  const getExt = (name) => {
    const m = (name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : '';
  };

  const isSupported = (name) => {
    const e = getExt(name);
    return exts.img.has(e) || exts.vid.has(e);
  };

  const typeOf = (name) => {
    const e = getExt(name);
    if(exts.vid.has(e)) return 'video';
    return 'image';
  };

  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${encodeURIComponent(cfg.path)}`;
  const cacheKey = `fs_media_cache_${cfg.owner}_${cfg.repo}_${cfg.path}`;

  function randShuffle(arr){
    const a = arr.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  }

  function setLoading(msg){
    grid.innerHTML = `<div class="media-wall__loading">${msg}</div>`;
  }

  async function fetchMediaList(){
    // 10 min session cache
    try{
      const cached = sessionStorage.getItem(cacheKey);
      if(cached){
        const parsed = JSON.parse(cached);
        if(parsed && Array.isArray(parsed.items) && (Date.now() - parsed.t) < 10*60*1000){
          return parsed.items;
        }
      }
    }catch(_){ }

    const res = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/vnd.github+json'
      }
    });

    if(!res.ok){
      throw new Error(`GitHub API Fehler (${res.status})`);
    }

    const data = await res.json();
    const items = (Array.isArray(data) ? data : [])
      .filter(x => x && x.type === 'file' && isSupported(x.name))
      .map(x => ({
        name: x.name,
        type: typeOf(x.name),
        download_url: x.download_url,
        html_url: x.html_url
      }));

    try{
      sessionStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), items }));
    }catch(_){ }
    return items;
  }

  let MEDIA = [];
  let ORDER = [];
  let currentIndex = 0;
  let timer = null;

  function renderGrid(){
    const isFull = grid.classList.contains('media-wall__grid--full');
    const max = isFull ? ORDER.length : Math.min(cfg.limit, ORDER.length);

    if(!ORDER.length){
      grid.innerHTML = `<div class="media-wall__loading">Noch keine Dateien in <code>/${cfg.path}</code> vorhanden.</div>`;
      return;
    }

    const slice = ORDER.slice(0, max);
    grid.innerHTML = slice.map((m, i) => {
      const idx = MEDIA.indexOf(m);
      const label = m.type === 'video' ? 'Video' : 'Bild';
      const thumb = m.type === 'video'
        ? `<video class="media-tile__media" muted playsinline preload="metadata" src="${m.download_url}#t=0.1"></video><div class="media-tile__badge">▶</div>`
        : `<img class="media-tile__media" src="${m.download_url}" alt="${m.name}" loading="lazy" />`;

      return `
        <button class="media-tile" type="button" data-media-idx="${idx}" aria-label="${label} öffnen: ${m.name}">
          ${thumb}
          
        </button>
      `;
    }).join('');
  }

  function openLightbox(idx){
    if(!lightbox || !stage) return;
    const item = MEDIA[idx];
    if(!item) return;

    currentIndex = idx;
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');

    // Clear stage
    stage.innerHTML = '';
    meta.textContent = '';

    if(item.type === 'video'){
      const v = document.createElement('video');
      v.src = item.download_url;
      v.controls = true;
      v.playsInline = true;
      v.autoplay = true;
      v.preload = 'auto';
      v.className = 'lightbox__video';
      stage.appendChild(v);
    } else {
      const img = document.createElement('img');
      img.src = item.download_url;
      img.alt = item.name || 'Bild';
      img.className = 'lightbox__img';
      stage.appendChild(img);
    }
  }

  function closeLightbox(){
    if(!lightbox) return;
    // stop video if any
    try{
      const v = lightbox.querySelector('video');
      if(v){ v.pause(); v.currentTime = 0; }
    }catch(_){ }
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    stage && (stage.innerHTML = '');
  }

  function prev(){
    if(!MEDIA.length) return;
    const nextIdx = (currentIndex - 1 + MEDIA.length) % MEDIA.length;
    openLightbox(nextIdx);
  }

  function next(){
    if(!MEDIA.length) return;
    const nextIdx = (currentIndex + 1) % MEDIA.length;
    openLightbox(nextIdx);
  }

  function attachLightboxControls(){
    if(!lightbox) return;
    lightbox.querySelectorAll('[data-lightbox-close]').forEach(el => el.addEventListener('click', closeLightbox));
    lightbox.querySelector('[data-lightbox-prev]')?.addEventListener('click', prev);
    lightbox.querySelector('[data-lightbox-next]')?.addEventListener('click', next);

    window.addEventListener('keydown', (e) => {
      if(!lightbox.classList.contains('is-open')) return;
      if(e.key === 'Escape') closeLightbox();
      if(e.key === 'ArrowLeft') prev();
      if(e.key === 'ArrowRight') next();
    });

    // swipe
    let startX = 0;
    let startY = 0;
    let active = false;
    const onStart = (e) => {
      if(!lightbox.classList.contains('is-open')) return;
      const t = e.touches ? e.touches[0] : e;
      startX = t.clientX; startY = t.clientY; active = true;
    };
    const onEnd = (e) => {
      if(!active) return;
      active = false;
      const t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : e;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if(Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)){
        if(dx > 0) prev(); else next();
      }
    };
    stage?.addEventListener('touchstart', onStart, { passive:true });
    stage?.addEventListener('touchend', onEnd, { passive:true });
  }

  function wireGridClicks(){
    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-media-idx]');
      if(!btn) return;
      const idx = Number(btn.getAttribute('data-media-idx'));
      if(Number.isFinite(idx)) openLightbox(idx);
    });
  }

  function reshuffle(){
    ORDER = randShuffle(MEDIA);
    renderGrid();
  }

  async function init(){
    setLoading('Lade Media…');
    attachLightboxControls();
    wireGridClicks();

    try{
      MEDIA = await fetchMediaList();
      ORDER = randShuffle(MEDIA);
      renderGrid();
    }catch(err){
      console.warn(err);
      const msg = `Konnte Media nicht laden. Lege einen Ordner <code>/${cfg.path}</code> im GitHub Repo an und lade Dateien hoch.`;
      setLoading(msg);
      return;
    }

    shuffleBtn?.addEventListener('click', reshuffle);

    if(cfg.reshuffleMs && cfg.reshuffleMs > 0){
      timer = setInterval(reshuffle, cfg.reshuffleMs);
      window.addEventListener('visibilitychange', () => {
        if(document.hidden && timer){ clearInterval(timer); timer = null; }
        if(!document.hidden && !timer){ timer = setInterval(reshuffle, cfg.reshuffleMs); }
      });
    }
  }

  init();
})();
