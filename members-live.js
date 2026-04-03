
(function(){
  const tickerRailText = document.getElementById('tickerRailText');
  const tickerRailBadge = document.getElementById('tickerRailBadge');
  const tickerList = document.getElementById('liveTickerList');
  const tickerMeta = document.getElementById('liveTickerMeta');
  const calEl = document.getElementById('fsCalendar');
  const upcomingList = document.getElementById('upcomingList');
  const stateMeta = document.getElementById('liveStateMeta');
  let tickerTimer = null;
  let calendar = null;

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

  function getActiveTicker(items){
    return (items || []).filter(item => item.active !== false && item.text);
  }

  function renderTickerRail(items){
    const activeItems = getActiveTicker(items);
    if(!tickerRailText) return;

    if(tickerTimer){
      clearInterval(tickerTimer);
      tickerTimer = null;
    }

    if(!activeItems.length){
      tickerRailText.textContent = 'Aktuell gibt es keine neuen Hinweise.';
      if(tickerRailBadge) tickerRailBadge.textContent = 'INFO';
      return;
    }

    let index = 0;
    const paint = () => {
      const item = activeItems[index];
      tickerRailText.textContent = item.text;
      if(tickerRailBadge){
        tickerRailBadge.textContent = item.priority === 'high' ? 'WICHTIG' : 'LIVE';
      }
      index = (index + 1) % activeItems.length;
    };

    paint();
    if(activeItems.length > 1){
      tickerTimer = setInterval(paint, 5000);
    }
  }

  function renderTickerList(items){
    if(!tickerList) return;
    const activeItems = getActiveTicker(items);

    if(!activeItems.length){
      tickerList.innerHTML = '<div class="ticker-empty">Aktuell sind keine Live-Infos eingetragen.</div>';
      return;
    }

    tickerList.innerHTML = activeItems.map(item => `
      <article class="ticker-item ticker-item--${escapeHtml(item.priority || 'normal')}">
        <div class="ticker-item__badge">${item.priority === 'high' ? 'Wichtig' : item.priority === 'low' ? 'Info' : 'Live'}</div>
        <div class="ticker-item__text">${escapeHtml(item.text)}</div>
        <div class="ticker-item__time">Zuletzt aktualisiert: ${escapeHtml(fmtDate(item.updatedAt, { dateStyle:'medium', timeStyle:'short' }))}</div>
      </article>
    `).join('');

    if(tickerMeta){
      tickerMeta.textContent = `${activeItems.length} Live-Hinweis${activeItems.length === 1 ? '' : 'e'} aktiv`;
    }
  }

  function renderUpcoming(events){
    if(!upcomingList) return;
    const now = Date.now() - (60 * 60 * 1000);
    const upcoming = (events || [])
      .filter(event => event.start && new Date(event.start).getTime() >= now)
      .sort((a, b) => new Date(a.start) - new Date(b.start))
      .slice(0, 10);

    if(!upcoming.length){
      upcomingList.innerHTML = '<div class="events-empty">Aktuell sind keine Termine eingetragen.</div>';
      return;
    }

    upcomingList.innerHTML = upcoming.map(event => `
      <div class="events-item">
        <div class="events-item__title">${escapeHtml(event.title || 'Termin')}</div>
        <div class="events-item__meta">
          <span>${escapeHtml(event.allDay ? fmtDate(event.start, { dateStyle:'medium' }) : fmtDate(event.start, { dateStyle:'medium', timeStyle:'short' }))}</span>
          ${event.place ? ` • <span>${escapeHtml(event.place)}</span>` : ''}
        </div>
        ${event.note ? `<div class="events-item__note">${escapeHtml(event.note)}</div>` : ''}
      </div>
    `).join('');
  }

  function eventToCalendar(item){
    return {
      id: item.id,
      title: item.title,
      start: item.start,
      end: item.end || null,
      allDay: Boolean(item.allDay),
      extendedProps: {
        place: item.place || '',
        note: item.note || ''
      }
    };
  }

  function renderCalendar(events){
    if(!calEl || !window.FullCalendar) return;

    const entries = (events || []).map(eventToCalendar);

    if(!calendar){
      calendar = new window.FullCalendar.Calendar(calEl, {
        initialView: 'dayGridMonth',
        height: 'auto',
        locale: 'de',
        firstDay: 1,
        headerToolbar: {
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,listMonth'
        },
        events: entries,
        eventClick(info){
          const event = info.event;
          const parts = [
            event.title,
            `Start: ${event.allDay ? fmtDate(event.start, { dateStyle:'medium' }) : fmtDate(event.start, { dateStyle:'medium', timeStyle:'short' })}`
          ];
          if(event.end){
            parts.push(`Ende: ${event.allDay ? fmtDate(event.end, { dateStyle:'medium' }) : fmtDate(event.end, { dateStyle:'medium', timeStyle:'short' })}`);
          }
          if(event.extendedProps && event.extendedProps.place){
            parts.push(`Ort: ${event.extendedProps.place}`);
          }
          if(event.extendedProps && event.extendedProps.note){
            parts.push(`Info: ${event.extendedProps.note}`);
          }
          alert(parts.join('\n'));
        }
      });
      calendar.render();
      return;
    }

    calendar.removeAllEvents();
    entries.forEach(entry => calendar.addEvent(entry));
  }

  function renderState(state, meta){
    renderTickerRail(state.ticker || []);
    renderTickerList(state.ticker || []);
    renderCalendar(state.events || []);
    renderUpcoming(state.events || []);
    if(stateMeta && meta){
      stateMeta.textContent = meta.isShared ? 'Live synchronisiert' : 'Lokaler Modus';
    }
  }

  window.addEventListener('DOMContentLoaded', async () => {
    try{
      const initial = await window.FlensLiveData.init();
      renderState(initial.state, initial.meta);
      await window.FlensLiveData.subscribe((state, meta) => renderState(state, meta));
    }catch(err){
      console.error(err);
      if(tickerList){
        tickerList.innerHTML = '<div class="ticker-empty">Live-Bereich konnte nicht geladen werden.</div>';
      }
    }
  });
})();
