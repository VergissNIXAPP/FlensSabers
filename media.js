/* FlensSabers Media Gallery
   Uses window.FLENS_MEDIA when supplied. Falls back to the included photography. */
(function(){
  const grid = document.getElementById('mediaGrid');
  const lightbox = document.getElementById('lightbox');
  const stage = document.getElementById('lightboxStage');
  const meta = document.getElementById('lightboxMeta');
  if(!grid || !lightbox || !stage) return;

  const fallbackItems = [
    { type:'image', src:'media/team.webp', fallback:'media/team.png', alt:'FlensSabers Team beim Laserschwerttraining', label:'Team' },
    { type:'image', src:'media/gruppe.webp', fallback:'media/gruppe.png', alt:'FlensSabers Gruppe beim Training', label:'Training' },
    { type:'image', src:'media/portrait.webp', fallback:'media/portrait.png', alt:'FlensSabers bei einem Auftritt', label:'Event' }
  ];

  const supplied = Array.isArray(window.FLENS_MEDIA) ? window.FLENS_MEDIA : [];
  const items = (supplied.length ? supplied : fallbackItems).map((item, index) => ({
    id:item.id || `media-${index + 1}`,
    type:item.type === 'video' ? 'video' : 'image',
    src:item.src || '',
    fallback:item.fallback || '',
    poster:item.poster || '',
    alt:item.alt || item.title || 'FlensSabers Media',
    label:item.label || (item.type === 'video' ? 'Clip' : 'Foto'),
    title:item.title || ''
  })).filter(item => item.src);

  let current = 0;

  function escapeHtml(value){
    return String(value || '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function tileMarkup(item, index){
    if(item.type === 'video'){
      return `
        <button class="media-tile" type="button" data-media-index="${index}" aria-label="${escapeHtml(item.alt)} öffnen">
          <span class="media-tile__badge">${escapeHtml(item.label)}</span>
          <video class="media-tile__media" src="${escapeHtml(item.src)}" ${item.poster ? `poster="${escapeHtml(item.poster)}"` : ''} muted playsinline preload="metadata"></video>
          <span class="media-tile__name">${escapeHtml(item.title || item.alt)}</span>
        </button>`;
    }

    return `
      <button class="media-tile" type="button" data-media-index="${index}" aria-label="${escapeHtml(item.alt)} öffnen">
        <span class="media-tile__badge">${escapeHtml(item.label)}</span>
        <img class="media-tile__media" src="${escapeHtml(item.src)}" ${item.fallback ? `data-fallback="${escapeHtml(item.fallback)}"` : ''} alt="${escapeHtml(item.alt)}" loading="lazy" decoding="async"/>
        <span class="media-tile__name">${escapeHtml(item.title || item.alt)}</span>
      </button>`;
  }

  function render(){
    if(!items.length){
      grid.innerHTML = '<div class="media-wall__loading">Aktuell sind noch keine Medien hinterlegt.</div>';
      return;
    }
    grid.innerHTML = items.map(tileMarkup).join('');
    grid.querySelectorAll('img[data-fallback]').forEach((img) => {
      img.addEventListener('error', () => {
        const fallback = img.dataset.fallback;
        if(fallback && img.src.indexOf(fallback) === -1) img.src = fallback;
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
          if(img.src.indexOf(item.fallback) === -1) img.src = item.fallback;
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

  render();
})();
