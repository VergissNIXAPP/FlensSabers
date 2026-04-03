(function(){
  const installBar = document.getElementById('membersInstallBar');
  const installBtn = document.getElementById('installMembersAppBtn');
  const topInstallBtn = document.getElementById('installMembersTopBtn');
  const installHint = document.getElementById('membersInstallHint');
  const installButtons = [installBtn, topInstallBtn].filter(Boolean);
  let deferredInstallPrompt = null;

  function isStandaloneMode(){
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function isIosDevice(){
    const ua = window.navigator.userAgent || '';
    return /iphone|ipad|ipod/i.test(ua);
  }

  function setInstallButtonState({ hidden = false, disabled = false, label = '📲 App installieren' } = {}){
    installButtons.forEach((button) => {
      button.hidden = hidden;
      button.disabled = disabled;
      button.textContent = label;
    });
  }

  function showInstallBar(message, showButton){
    if(installBar && installHint){
      installBar.hidden = false;
      installHint.textContent = message || '';
    }
    setInstallButtonState({ hidden: !showButton, disabled: false, label: '📲 App installieren' });
  }

  function hideInstallBar(){
    if(installBar) installBar.hidden = true;
    setInstallButtonState({ hidden: true });
  }

  async function registerMembersPwa(){
    if(!('serviceWorker' in navigator)) return;
    try{
      await navigator.serviceWorker.register('members-sw.js');
    }catch(err){
      console.warn('[FlensSabers] members sw registration failed', err);
    }
  }

  function setCookie(name, value, days){
    try{
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      document.cookie = `${name}=${value}; expires=${date.toUTCString()}; path=/; SameSite=Lax`;
    }catch(_){ }
  }

  function persistMemberAccess(){
    try{
      if(sessionStorage.getItem('fs_member') === '1' || localStorage.getItem('fs_member_pwa') === '1'){
        sessionStorage.setItem('fs_member', '1');
        localStorage.setItem('fs_member_pwa', '1');
        setCookie('fs_member', '1', 365);
      }
    }catch(_){
      setCookie('fs_member', '1', 365);
    }
  }

  async function handleInstallClick(){
    if(isStandaloneMode()){
      hideInstallBar();
      return;
    }

    if(deferredInstallPrompt){
      deferredInstallPrompt.prompt();
      const result = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      if(result?.outcome === 'accepted'){
        showInstallBar('Installation gestartet …', false);
      } else {
        showInstallBar('Installation abgebrochen. Über das Browser-Menü kannst du FlensSabers Members später jederzeit installieren.', true);
      }
      return;
    }

    if(isIosDevice()){
      showInstallBar('In Safari auf Teilen tippen und dann „Zum Home-Bildschirm“ wählen, damit FlensSabers Members wie eine WebApp installiert wird.', true);
      return;
    }

    showInstallBar('Falls dein Browser keinen direkten Install-Dialog zeigt, öffne bitte das Browser-Menü und wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“.', true);
  }

  function setupInstallUi(){
    if(isStandaloneMode()){
      hideInstallBar();
      return;
    }

    setInstallButtonState({ hidden: false, disabled: false, label: '📲 App installieren' });

    if(isIosDevice()){
      showInstallBar('In Safari auf Teilen tippen und dann „Zum Home-Bildschirm“ wählen, damit FlensSabers Members wie eine WebApp installiert wird.', true);
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

    installButtons.forEach((button) => {
      button.addEventListener('click', handleInstallClick);
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    persistMemberAccess();
    registerMembersPwa();
    setupInstallUi();
  });
})();
