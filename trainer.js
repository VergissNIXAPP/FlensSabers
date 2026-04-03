
(function(){
  const gate = document.getElementById('trainerGate');
  const gateForm = document.getElementById('trainerGateForm');
  const gateInput = document.getElementById('trainerPass');
  const gateError = document.getElementById('trainerGateError');
  const app = document.getElementById('trainerApp');
  const statusChip = document.getElementById('trainerStatusChip');
  const statusText = document.getElementById('trainerStatusText');
  const installBar = document.getElementById('trainerInstallBar');
  const installBtn = document.getElementById('installTrainerAppBtn');
  const installHint = document.getElementById('trainerInstallHint');
  const tickerForm = document.getElementById('tickerEditorForm');
  const tickerId = document.getElementById('tickerId');
  const tickerText = document.getElementById('tickerText');
  const tickerPriority = document.getElementById('tickerPriority');
  const tickerActive = document.getElementById('tickerActive');
  const tickerList = document.getElementById('trainerTickerList');
  const tickerResetBtn = document.getElementById('tickerResetBtn');
  const resetAllBtn = document.getElementById('resetAllBtn');
  const eventForm = document.getElementById('eventEditorForm');
  const eventId = document.getElementById('eventId');
  const eventTitle = document.getElementById('eventTitle');
  const eventDate = document.getElementById('eventDate');
  const eventStart = document.getElementById('eventStart');
  const eventEnd = document.getElementById('eventEnd');
  const eventPlace = document.getElementById('eventPlace');
  const eventNote = document.getElementById('eventNote');
  const eventAllDay = document.getElementById('eventAllDay');
  const eventDeleteBtn = document.getElementById('eventDeleteBtn');
  const eventResetBtn = document.getElementById('eventResetBtn');
  const eventInfo = document.getElementById('eventInfo');
  const calendarEl = document.getElementById('trainerCalendar');

  let state = { ticker: [], events: [] };
  let calendar = null;
  let selectedDate = '';
  let deferredInstallPrompt = null;

  if(!window.FlensLiveData) return;

  function escapeHtml(value){
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtDate(value, opts){
    if(!value) return '';
    const date = new Date(value);
    if(Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('de-DE', opts || { dateStyle:'medium', timeStyle:'short' });
  }

  function pad(value){
    return String(value).padStart(2, '0');
  }

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

  async function registerTrainerPwa(){
    if(!('serviceWorker' in navigator)) return;
    try{
      await navigator.serviceWorker.register('trainer-sw.js');
    }catch(err){
      console.warn('[FlensSabers] trainer sw registration failed', err);
    }
  }

  function hasTrainerAccess(){
    try{
      return sessionStorage.getItem('fs_trainer') === '1' || localStorage.getItem('fs_trainer_pwa') === '1';
    }catch(_){
      return false;
    }
  }

  function persistTrainerAccess(){
    try{
      sessionStorage.setItem('fs_trainer', '1');
    }catch(_){ }
    try{
      localStorage.setItem('fs_trainer_pwa', '1');
    }catch(_){ }
  }

  function setupInstallUi(){
    if(isStandaloneMode()){
      hideInstallBar();
      return;
    }

    if(isIosDevice()){
      showInstallBar('In Safari auf Teilen tippen und dann „Zum Home-Bildschirm“ wählen, damit die Trainer-Remote wie eine WebApp installiert wird.', false);
    }

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      showInstallBar('Installiere die Trainer-Remote als WebApp für schnellen Vollbild-Zugriff mit eigenem App-Icon.', true);
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      showInstallBar('Trainer Remote wurde installiert.', false);
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
        showInstallBar('Installation abgebrochen. Über das Browser-Menü kannst du die Trainer-Remote später jederzeit installieren.', false);
      }
    });
  }

  function toLocalDateInput(value){
    if(!value) return '';
    const date = new Date(value);
    if(Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function toLocalTimeInput(value){
    if(!value) return '';
    const date = new Date(value);
    if(Number.isNaN(date.getTime())) return '';
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function unlock(){
    if(gate){
      gate.classList.remove('is-open');
      gate.setAttribute('aria-hidden', 'true');
    }
    if(app){
      app.hidden = false;
    }
  }

  function lock(){
    if(gate){
      gate.classList.add('is-open');
      gate.setAttribute('aria-hidden', 'false');
    }
    if(app){
      app.hidden = true;
    }
  }

  function setStatus(meta){
    if(!statusChip || !statusText || !meta) return;
    statusChip.textContent = meta.isShared ? 'ONLINE' : 'LOKAL';
    statusChip.classList.toggle('is-online', Boolean(meta.isShared));
    statusText.textContent = meta.isShared
      ? 'Änderungen werden live für alle Mitglieder synchronisiert.'
      : 'Gerade lokaler Modus. Für echte Live-Synchronisierung bitte Firebase in remote-config.js eintragen.';
  }

  function renderTickerList(items){
    if(!tickerList) return;
    if(!items || !items.length){
      tickerList.innerHTML = '<div class="ticker-empty">Noch keine Live-Hinweise angelegt.</div>';
      return;
    }

    tickerList.innerHTML = items.map(item => `
      <article class="admin-list-card">
        <div class="admin-list-card__top">
          <span class="admin-priority admin-priority--${escapeHtml(item.priority || 'normal')}">${item.priority === 'high' ? 'Wichtig' : item.priority === 'low' ? 'Info' : 'Live'}</span>
          <span class="admin-list-card__time">${escapeHtml(fmtDate(item.updatedAt, { dateStyle:'medium', timeStyle:'short' }))}</span>
        </div>
        <div class="admin-list-card__text">${escapeHtml(item.text)}</div>
        <div class="admin-list-card__meta">${item.active !== false ? 'Sichtbar auf der Members-Seite' : 'Derzeit ausgeblendet'}</div>
        <div class="admin-list-card__actions">
          <button class="btn btn--ghost" type="button" data-ticker-edit="${escapeHtml(item.id)}">Bearbeiten</button>
          <button class="btn btn--ghost" type="button" data-ticker-toggle="${escapeHtml(item.id)}">${item.active !== false ? 'Ausblenden' : 'Einblenden'}</button>
          <button class="btn btn--ghost" type="button" data-ticker-delete="${escapeHtml(item.id)}">Löschen</button>
        </div>
      </article>
    `).join('');
  }

  function renderCalendar(events){
    if(!calendarEl || !window.FullCalendar) return;
    const entries = (events || []).map(item => ({
      id: item.id,
      title: item.title,
      start: item.start,
      end: item.end || null,
      allDay: Boolean(item.allDay),
      extendedProps: {
        place: item.place || '',
        note: item.note || ''
      }
    }));

    if(!calendar){
      calendar = new window.FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'de',
        firstDay: 1,
        height: 'auto',
        selectable: true,
        headerToolbar: {
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,listMonth'
        },
        dateClick(info){
          selectedDate = info.dateStr;
          fillEventForm({
            id: '',
            title: '',
            date: info.dateStr,
            startTime: '',
            endTime: '',
            place: '',
            note: '',
            allDay: false
          });
          if(eventInfo){
            eventInfo.textContent = `Neuer Eintrag für ${fmtDate(info.dateStr, { dateStyle:'full' })}`;
          }
          eventTitle?.focus();
        },
        eventClick(info){
          const event = info.event;
          const start = event.start ? new Date(event.start) : null;
          const end = event.end ? new Date(event.end) : null;
          fillEventForm({
            id: event.id,
            title: event.title,
            date: start ? toLocalDateInput(start) : '',
            startTime: event.allDay || !start ? '' : toLocalTimeInput(start),
            endTime: event.allDay || !end ? '' : toLocalTimeInput(end),
            place: event.extendedProps?.place || '',
            note: event.extendedProps?.note || '',
            allDay: Boolean(event.allDay)
          });
          if(eventInfo){
            eventInfo.textContent = `Bearbeite: ${event.title}`;
          }
        },
        events: entries
      });
      calendar.render();
      return;
    }

    calendar.removeAllEvents();
    entries.forEach(entry => calendar.addEvent(entry));
  }

  function renderAll(nextState, meta){
    state = nextState;
    renderTickerList(state.ticker || []);
    renderCalendar(state.events || []);
    setStatus(meta);
  }

  function fillTickerForm(item){
    tickerId.value = item?.id || '';
    tickerText.value = item?.text || '';
    tickerPriority.value = item?.priority || 'normal';
    tickerActive.checked = item?.active !== false;
  }

  function fillEventForm(item){
    eventId.value = item?.id || '';
    eventTitle.value = item?.title || '';
    eventDate.value = item?.date || selectedDate || '';
    eventStart.value = item?.startTime || '';
    eventEnd.value = item?.endTime || '';
    eventPlace.value = item?.place || '';
    eventNote.value = item?.note || '';
    eventAllDay.checked = Boolean(item?.allDay);
    eventDeleteBtn.disabled = !Boolean(item?.id);
  }

  function resetEventForm(){
    selectedDate = '';
    fillEventForm({});
    if(eventInfo){
      eventInfo.textContent = 'Tippe im Kalender auf einen Tag oder wähle einen bestehenden Termin aus.';
    }
  }

  async function initData(){
    const initial = await window.FlensLiveData.init();
    renderAll(initial.state, initial.meta);
    await window.FlensLiveData.subscribe((nextState, meta) => renderAll(nextState, meta));
  }

  window.addEventListener('DOMContentLoaded', () => {
    registerTrainerPwa();
    setupInstallUi();

    if(hasTrainerAccess()){
      persistTrainerAccess();
      unlock();
    } else {
      lock();
    }

    if(gateForm){
      gateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const value = (gateInput?.value || '').trim();
        if(value !== 'admin'){
          if(gateError) gateError.textContent = 'Falsches Passwort.';
          gateInput?.focus();
          gateInput?.select();
          return;
        }
        persistTrainerAccess();
        if(gateError) gateError.textContent = '';
        unlock();
        await initData();
      });
    }

    if(app && !app.hidden){
      initData();
    }

    tickerForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = (tickerText.value || '').trim();
      if(!text) return;
      await window.FlensLiveData.upsertTicker({
        id: (tickerId.value || '').trim(),
        text,
        priority: tickerPriority.value,
        active: tickerActive.checked
      });
      fillTickerForm({ priority: 'normal', active: true });
      tickerText.focus();
    });

    tickerResetBtn?.addEventListener('click', () => fillTickerForm({ priority: 'normal', active: true }));

    tickerList?.addEventListener('click', async (e) => {
      const editId = e.target.closest('[data-ticker-edit]')?.getAttribute('data-ticker-edit');
      const toggleId = e.target.closest('[data-ticker-toggle]')?.getAttribute('data-ticker-toggle');
      const deleteId = e.target.closest('[data-ticker-delete]')?.getAttribute('data-ticker-delete');

      if(editId){
        const item = (state.ticker || []).find(entry => entry.id === editId);
        if(item){
          fillTickerForm(item);
          tickerText.focus();
        }
      }

      if(toggleId){
        const item = (state.ticker || []).find(entry => entry.id === toggleId);
        if(item){
          await window.FlensLiveData.upsertTicker({ ...item, active: item.active === false });
        }
      }

      if(deleteId){
        await window.FlensLiveData.deleteTicker(deleteId);
        if(tickerId.value === deleteId){
          fillTickerForm({ priority: 'normal', active: true });
        }
      }
    });

    eventForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = (eventTitle.value || '').trim();
      const date = (eventDate.value || '').trim();
      const allDay = eventAllDay.checked;
      if(!title || !date){
        return;
      }

      let start = date;
      let end = '';
      if(!allDay){
        const startTime = (eventStart.value || '').trim() || '19:00';
        start = `${date}T${startTime}:00`;
        const endTime = (eventEnd.value || '').trim();
        if(endTime) end = `${date}T${endTime}:00`;
      }

      await window.FlensLiveData.upsertEvent({
        id: (eventId.value || '').trim(),
        title,
        start,
        end,
        allDay,
        place: (eventPlace.value || '').trim(),
        note: (eventNote.value || '').trim()
      });

      resetEventForm();
    });

    eventDeleteBtn?.addEventListener('click', async () => {
      const id = (eventId.value || '').trim();
      if(!id) return;
      await window.FlensLiveData.deleteEvent(id);
      resetEventForm();
    });

    eventResetBtn?.addEventListener('click', resetEventForm);

    resetAllBtn?.addEventListener('click', async () => {
      const ok = window.confirm('Soll alles auf die Standarddaten zurückgesetzt werden?');
      if(!ok) return;
      await window.FlensLiveData.resetToDefaults();
      fillTickerForm({ priority: 'normal', active: true });
      resetEventForm();
    });
  });
})();
