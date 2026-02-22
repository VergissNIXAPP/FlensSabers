/* FlensSabers – Mobile Navigation */
(function(){
  const body = document.body;
  const toggle = document.querySelector('[data-nav-toggle]');
  const nav = document.getElementById('siteNav');
  const dim = document.querySelector('[data-nav-close].nav-dim');

  if(!toggle || !nav) return;

  const setOpen = (open) => {
    body.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if(dim) dim.setAttribute('aria-hidden', open ? 'false' : 'true');
  };

  const isOpen = () => body.classList.contains('nav-open');

  toggle.addEventListener('click', () => setOpen(!isOpen()));

  // close when tapping backdrop
  if(dim){
    dim.addEventListener('click', () => setOpen(false));
  }

  // close when clicking a nav link (mobile UX)
  nav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => setOpen(false));
  });

  // Esc closes on desktop
  window.addEventListener('keydown', (e) => {
    if(e.key === 'Escape' && isOpen()) setOpen(false);
  });

  // safety: close menu when resizing to desktop
  window.addEventListener('resize', () => {
    if(window.innerWidth > 720 && isOpen()) setOpen(false);
  }, { passive:true });
})();
