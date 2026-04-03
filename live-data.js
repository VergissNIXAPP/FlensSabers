
(function(){
  const STORAGE_KEY = 'fs_live_state_v1';
  const DOC_COLLECTION = 'flenssabers_live';
  const DOC_ID = 'public_content';
  const LOCAL_CHANGE_EVENT = 'fs-live-local-changed';

  const DEFAULT_STATE = {
    version: 1,
    ticker: [
      {
        id: 'welcome',
        text: 'Willkommen im Mitgliederbereich der FlensSabers.',
        priority: 'normal',
        active: true,
        updatedAt: new Date().toISOString()
      }
    ],
    events: [
      {
        id: 'training-rudeschule-default',
        title: 'Training – Rudeschule',
        start: '2026-04-07T20:00:00',
        end: '2026-04-07T22:00:00',
        allDay: false,
        place: 'Rudeschule · Flensburg',
        note: 'Bitte 10 Minuten vorher da sein.'
      },
      {
        id: 'training-west-default',
        title: 'Training – Gemeinschaftsschule West',
        start: '2026-04-10T18:00:00',
        end: '2026-04-10T21:00:00',
        allDay: false,
        place: 'Gemeinschaftsschule West · Flensburg',
        note: 'Bitte 10 Minuten vorher da sein.'
      }
    ]
  };

  let currentState = normalizeState(DEFAULT_STATE);
  let adapter = null;
  let storeMeta = { mode: 'local', isShared: false, status: 'Bereit' };

  function clone(value){
    return JSON.parse(JSON.stringify(value));
  }

  function sortTicker(items){
    const rank = { high: 0, normal: 1, low: 2 };
    return (items || []).slice().sort((a, b) => {
      const activeDiff = Number(Boolean(b.active)) - Number(Boolean(a.active));
      if(activeDiff) return activeDiff;
      const prioDiff = (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9);
      if(prioDiff) return prioDiff;
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    });
  }

  function sortEvents(items){
    return (items || []).slice().sort((a, b) => new Date(a.start) - new Date(b.start));
  }

  function normalizeTicker(items){
    return sortTicker((items || []).map((item, idx) => ({
      id: item.id || `ticker-${Date.now()}-${idx}`,
      text: String(item.text || '').trim(),
      priority: ['high','normal','low'].includes(item.priority) ? item.priority : 'normal',
      active: item.active !== false,
      updatedAt: item.updatedAt || new Date().toISOString()
    })).filter(item => item.text));
  }

  function normalizeEvents(items){
    return sortEvents((items || []).map((item, idx) => ({
      id: item.id || `event-${Date.now()}-${idx}`,
      title: String(item.title || '').trim() || 'Termin',
      start: item.start,
      end: item.end || '',
      allDay: Boolean(item.allDay),
      place: String(item.place || '').trim(),
      note: String(item.note || '').trim()
    })).filter(item => item.start));
  }

  function normalizeState(raw){
    const next = raw && typeof raw === 'object' ? raw : {};
    return {
      version: 1,
      ticker: normalizeTicker(next.ticker && Array.isArray(next.ticker) ? next.ticker : DEFAULT_STATE.ticker),
      events: normalizeEvents(next.events && Array.isArray(next.events) ? next.events : DEFAULT_STATE.events)
    };
  }

  function readLocal(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return normalizeState(DEFAULT_STATE);
      return normalizeState(JSON.parse(raw));
    }catch(_){
      return normalizeState(DEFAULT_STATE);
    }
  }

  function writeLocal(state){
    currentState = normalizeState(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
    return clone(currentState);
  }

  function getFirebaseConfig(){
    const cfg = window.FLENS_REMOTE_CONFIG || {};
    const fb = cfg.firebase || {};
    if(cfg.mode !== 'firebase') return null;
    if(!fb.apiKey || !fb.projectId || !fb.appId) return null;
    return fb;
  }

  function createLocalAdapter(){
    return {
      mode: 'local',
      isShared: false,
      async init(){
        currentState = readLocal();
        return clone(currentState);
      },
      async save(state){
        const next = writeLocal(state);
        try{
          window.dispatchEvent(new CustomEvent(LOCAL_CHANGE_EVENT, { detail: clone(next) }));
        }catch(_){ }
        return next;
      },
      subscribe(onChange){
        const storageHandler = (e) => {
          if(e.key !== STORAGE_KEY) return;
          currentState = readLocal();
          onChange(clone(currentState));
        };
        const localHandler = (e) => {
          currentState = normalizeState(e.detail || readLocal());
          onChange(clone(currentState));
        };
        window.addEventListener('storage', storageHandler);
        window.addEventListener(LOCAL_CHANGE_EVENT, localHandler);
        return () => {
          window.removeEventListener('storage', storageHandler);
          window.removeEventListener(LOCAL_CHANGE_EVENT, localHandler);
        };
      }
    };
  }

  async function createFirebaseAdapter(config){
    if(!window.firebase || !window.firebase.firestore){
      throw new Error('Firebase SDK wurde nicht geladen.');
    }

    const appName = 'flenssabers-live-app';
    let app = window.firebase.apps.find((entry) => entry.name === appName);
    if(!app){
      app = window.firebase.initializeApp(config, appName);
    }

    const db = window.firebase.firestore(app);
    const docRef = db.collection(DOC_COLLECTION).doc(DOC_ID);

    return {
      mode: 'firebase',
      isShared: true,
      async init(){
        const snap = await docRef.get();
        if(!snap.exists){
          await docRef.set(DEFAULT_STATE, { merge: false });
          currentState = normalizeState(DEFAULT_STATE);
          return clone(currentState);
        }
        currentState = normalizeState(snap.data());
        return clone(currentState);
      },
      async save(state){
        currentState = normalizeState(state);
        await docRef.set(currentState, { merge: false });
        return clone(currentState);
      },
      subscribe(onChange){
        return docRef.onSnapshot((snap) => {
          if(snap.exists){
            currentState = normalizeState(snap.data());
          } else {
            currentState = normalizeState(DEFAULT_STATE);
          }
          onChange(clone(currentState));
        });
      }
    };
  }

  async function init(){
    if(adapter) return { state: clone(currentState), meta: clone(storeMeta) };

    const firebaseConfig = getFirebaseConfig();

    if(firebaseConfig){
      try{
        adapter = await createFirebaseAdapter(firebaseConfig);
        currentState = await adapter.init();
        storeMeta = {
          mode: 'firebase',
          isShared: true,
          status: 'Online-Synchronisierung aktiv'
        };
        return { state: clone(currentState), meta: clone(storeMeta) };
      }catch(err){
        console.warn('[FlensLiveData] Firebase fallback -> local', err);
      }
    }

    adapter = createLocalAdapter();
    currentState = await adapter.init();
    storeMeta = {
      mode: 'local',
      isShared: false,
      status: 'Lokaler Demo-Modus aktiv'
    };
    return { state: clone(currentState), meta: clone(storeMeta) };
  }

  async function saveState(nextState){
    if(!adapter) await init();
    currentState = await adapter.save(normalizeState(nextState));
    return clone(currentState);
  }

  async function update(mutator){
    if(!adapter) await init();
    const draft = clone(currentState);
    const result = mutator(clone(draft)) || draft;
    return saveState(result);
  }

  async function upsertTicker(item){
    const nextItem = {
      id: item.id || `ticker-${Date.now()}`,
      text: String(item.text || '').trim(),
      priority: ['high','normal','low'].includes(item.priority) ? item.priority : 'normal',
      active: item.active !== false,
      updatedAt: new Date().toISOString()
    };

    return update((state) => {
      const items = state.ticker.filter(entry => entry.id !== nextItem.id);
      items.push(nextItem);
      state.ticker = items;
      return state;
    });
  }

  async function deleteTicker(id){
    return update((state) => {
      state.ticker = state.ticker.filter(item => item.id !== id);
      return state;
    });
  }

  async function upsertEvent(item){
    const nextItem = {
      id: item.id || `event-${Date.now()}`,
      title: String(item.title || '').trim() || 'Termin',
      start: item.start,
      end: item.end || '',
      allDay: Boolean(item.allDay),
      place: String(item.place || '').trim(),
      note: String(item.note || '').trim()
    };

    return update((state) => {
      const items = state.events.filter(entry => entry.id !== nextItem.id);
      items.push(nextItem);
      state.events = items;
      return state;
    });
  }

  async function deleteEvent(id){
    return update((state) => {
      state.events = state.events.filter(item => item.id !== id);
      return state;
    });
  }

  async function resetToDefaults(){
    return saveState(DEFAULT_STATE);
  }

  async function getState(){
    if(!adapter) await init();
    return clone(currentState);
  }

  async function subscribe(onChange){
    if(!adapter) await init();
    onChange(clone(currentState), clone(storeMeta));
    return adapter.subscribe((state) => onChange(clone(state), clone(storeMeta)));
  }

  window.FlensLiveData = {
    init,
    getState,
    saveState,
    subscribe,
    upsertTicker,
    deleteTicker,
    upsertEvent,
    deleteEvent,
    resetToDefaults,
    getMeta(){ return clone(storeMeta); }
  };
})();
