(function(){
  const installBar = document.getElementById('membersInstallBar');
  const installBtn = document.getElementById('installMembersAppBtn');
  const installHint = document.getElementById('membersInstallHint');
  let deferredInstallPrompt = null;

  function isStandaloneMode(){
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function isIosDevice(){
    const ua = window.navigator.userAgent || '';
    return /iphone|ipad|ipod/i.test(ua);
  }

  function showInstallBar(message, showButton){
    if(!installBar || !installHint) return;
    installBar.hidden = false;
    installHint.textContent = message || '';
    if(installBtn) installBtn.hidden = !showButton;
  }

  function hideInstallBar(){
    if(installBar) installBar.hidden = true;
    if(installBtn) installBtn.hidden = true;
  }

  async function registerMembersPwa(){
    if(!('serviceWorker' in navigator)) return;
    try{
      await navigator.serviceWorker.register('members-sw.js');
    }catch(err){
      console.warn('[FlensSabers] members sw registration failed', err);
    }
  }

  function persistMemberAccess(){
    try{
      if(sessionStorage.getItem('fs_member') === '1'){
        localStorage.setItem('fs_member_pwa', '1');
      }
    }catch(_){ }
  }

  function setupInstallUi(){
    if(isStandaloneMode()){
      hideInstallBar();
      return;
    }

    if(isIosDevice()){
      showInstallBar('In Safari auf Teilen tippen und dann „Zum Home-Bildschirm“ wählen, damit FlensSabers Members wie eine WebApp installiert wird.', false);
    }

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      showInstallBar('Installiere FlensSabers Members als eigene WebApp mit App-Icon und Vollbildansicht.', true);
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      showInstallBar('FlensSabers Members wurde installiert.', false);
      window.setTimeout(hideInstallBar, 2400);
    });

    installBtn?.addEventListener('click', async () => {
      if(!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const result = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      if(result?.outcome === 'accepted'){
        showInstallBar('Installation gestartet …', false);
      } else {
        showInstallBar('Installation abgebrochen. Über das Browser-Menü kannst du FlensSabers Members später jederzeit installieren.', false);
      }
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    persistMemberAccess();
    registerMembersPwa();
    setupInstallUi();
  });
})();
