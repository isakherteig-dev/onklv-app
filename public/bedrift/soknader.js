import {
      krevInnlogging, loggUt, hentSoknaderBedriftMed, hentMineAnnonser, oppdaterSoknadStatus,
      statusTekst, statusBadgeKlasse, formaterDato, initScrollReveal, initVarselBjelle,
      hentMeldinger, sendChatMelding, hentUlesteChatMeldinger, escHtml
    } from '../app.js';

    let bruker = null;
    let alleSoknader = [];
    const chatPolls = {};
    const sideParams = new URLSearchParams(window.location.search);
    let autoChatSoknadId = (sideParams.get('chat') || '').trim();
    const forhandsvalgtLaerplassId = (sideParams.get('laerplass_id') || '').trim();

    function stoppChatPolling(id) {
      clearInterval(chatPolls[id]);
      delete chatPolls[id];
    }

    function stoppAllChatPolling() {
      Object.keys(chatPolls).forEach((id) => stoppChatPolling(id));
    }

    function fjernChatFraUrl() {
      const url = new URL(window.location.href);
      url.searchParams.delete('chat');
      history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }

    async function toggleChat(id, { scrollTilPanel = false } = {}) {
      const panel = document.getElementById(`chat-panel-${id}`);
      if (!panel) return;
      const erSkjult = panel.classList.contains('skjult');
      const skalAapne = erSkjult || scrollTilPanel;

      panel.classList.toggle('skjult', !skalAapne);
      if (skalAapne) {
        await lastChatBedrift(id);
        stoppChatPolling(id);
        chatPolls[id] = setInterval(() => lastChatBedrift(id), 15000);
        if (scrollTilPanel) {
          panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } else {
        stoppChatPolling(id);
      }
    };

    async function lastChatBedrift(soknadId) {
      const { meldinger } = await hentMeldinger(soknadId);
      const container = document.getElementById(`chat-liste-${soknadId}`);
      if (!container) return;

      if (!meldinger || meldinger.length === 0) {
        container.innerHTML = '<div class="chat-tom">Ingen meldinger ennå.</div>';
        return;
      }

      container.innerHTML = meldinger.map(m => {
        const erMeg = m.avsender_id === bruker.uid;
        const tid = new Date(m.opprettet).toLocaleString('nb-NO', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
        return `
          <div class="chat-boble-wrapper ${erMeg ? 'meg' : 'dem'}">
            <div class="chat-boble">${escHtml(m.tekst)}</div>
            <div class="chat-meta">${tid}</div>
          </div>`;
      }).join('');
      container.scrollTop = container.scrollHeight;

      const badge = document.getElementById(`chat-badge-${soknadId}`);
      if (badge) badge.classList.add('skjult');
    }

    async function sendBedriftChatMelding(soknadId) {
      const input = document.getElementById(`chat-input-${soknadId}`);
      const tekst = input.value.trim();
      if (!tekst) return;
      const btn = input.nextElementSibling;
      if (btn) btn.disabled = true;
      try {
        await sendChatMelding(soknadId, tekst);
        input.value = '';
        input.style.height = 'auto';
        await lastChatBedrift(soknadId);
      } catch (err) {
        alert(err.message);
      } finally {
        if (btn) btn.disabled = false;
        input.focus();
      }
    };

    function chatInputKeydown(e, soknadId) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBedriftChatMelding(soknadId);
      }
    }

    function chatInputResize(el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 100) + 'px';
    }

    bruker = await krevInnlogging('bedrift');
    if (!bruker) { window.location.href = '/login.html'; }

    document.getElementById('nav-navn').textContent = bruker.navn || '';
    document.getElementById('logg-ut-btn').addEventListener('click', async () => { await loggUt(); });

    // Fyll laerplass-filter
    const annonser = await hentMineAnnonser();
    const laerplassFilter = document.getElementById('laerplass-filter');
    annonser.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id; opt.textContent = a.tittel;
      laerplassFilter.appendChild(opt);
    });
    if (forhandsvalgtLaerplassId) {
      laerplassFilter.value = forhandsvalgtLaerplassId;
    }

    laerplassFilter.addEventListener('change', () => lastSoknader());

    async function lastSoknader() {
      stoppAllChatPolling();
      const laerplass_id = laerplassFilter.value;
      try {
        alleSoknader = await hentSoknaderBedriftMed(laerplass_id);
      } catch (err) {
        console.error('Kunne ikke hente søknader:', err.message);
        alleSoknader = [];
        document.getElementById('soknader-liste').innerHTML = `<div class="kort" style="text-align:center;padding:2rem;"><p style="color:#dc2626;">${err.message}</p></div>`;
        return;
      }
      visSoknader(alleSoknader);
      await oppdaterChatBadges();
      await haandterAutoAapnetChat();
    }

    function visSoknader(soknader) {
      document.getElementById('antall-tekst').textContent = `${soknader.length} søknader`;
      const container = document.getElementById('soknader-liste');

      if (!soknader.length) {
        container.innerHTML = `
          <div class="tom-tilstand">
            <div class="tom-tilstand-ikon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></div>
            <h3>Ingen søknader ennå</h3>
            <p>Det har ikke kommet inn søknader ennå.</p>
          </div>`;
        return;
      }

      container.innerHTML = soknader.map(s => {
        const soknadId = escHtml(String(s.id));
        const profilLenke = s.laerling_user_id
          ? `<a class="btn-mini btn-mini-blaa" href="/laerling/profil.html?uid=${encodeURIComponent(s.laerling_user_id)}">Se profil</a>`
          : '';

        return `
        <div class="kort" style="margin-bottom:1rem;">
          <div class="kort-header">
            <div>
              <div class="kort-tittel">${escHtml(s.laerling_navn || s.laerling_naam || '—')}</div>
              <div class="kort-undertittel">${escHtml(s.laerling_epost || '')} ${s.skole ? '· ' + escHtml(s.skole) : ''}</div>
            </div>
            <span class="${statusBadgeKlasse(s.status)}">${statusTekst(s.status)}</span>
          </div>
          <div style="margin:0.5rem 0;font-size:0.83rem;color:var(--olkv-gray);">
            ${s.utdanningsprogram ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg> ${escHtml(s.utdanningsprogram)}` : ''}
            ${s.vg1 ? ` · VG1: ${escHtml(s.vg1)}` : ''}
            ${s.vg2 ? ` · VG2: ${escHtml(s.vg2)}` : ''}
          </div>
          <div style="margin-bottom:0;font-size:0.85rem;">
            <strong style="font-size:0.8rem;color:var(--olkv-gray);display:block;margin-bottom:3px;">Motivasjon</strong>
            <p style="margin:0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">${escHtml(s.melding || '—')}</p>
          </div>
          ${s.erfaring ? `<div style="margin-top:0.5rem;font-size:0.85rem;"><strong style="font-size:0.8rem;color:var(--olkv-gray);display:block;margin-bottom:3px;">Erfaring</strong><p style="margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escHtml(s.erfaring)}</p></div>` : ''}
          <div class="kort-footer" style="margin-top:1rem;">
            <span style="font-size:0.82rem;color:var(--olkv-gray);">Sendt: ${formaterDato(s.sendt_dato)}</span>
            <div class="tabell-handlinger">
              ${profilLenke}
              ${s.status === 'sendt' ? `<button class="btn-mini btn-mini-blaa oppdater-btn" data-id="${soknadId}" data-status="under_behandling">Under behandling</button>` : ''}
              ${s.status !== 'godkjent' && s.status !== 'avslatt' ? `<button class="btn-mini btn-mini-gronn oppdater-btn" data-id="${soknadId}" data-status="godkjent">Godkjenn</button>` : ''}
              ${s.status !== 'avslatt' ? `<button class="btn-mini btn-mini-roed oppdater-btn" data-id="${soknadId}" data-status="avslatt">Avslå</button>` : ''}
              <button class="btn-mini btn-mini-blaa toggle-chat-btn" data-id="${soknadId}" style="display:inline-flex;align-items:center;gap:4px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Meldinger <span id="chat-badge-${soknadId}" class="chat-fane-badge skjult">0</span></button>
            </div>
          </div>
          <div id="chat-panel-${soknadId}" class="skjult" style="margin-top:0.75rem;">
            <div class="chat-seksjon" style="height:300px;">
              <div class="chat-meldinger" id="chat-liste-${soknadId}">
                <div class="chat-tom">Laster…</div>
              </div>
              <div class="chat-skrivefelt">
                <textarea id="chat-input-${soknadId}" class="chat-input" data-id="${soknadId}" placeholder="Skriv en melding…" rows="1"></textarea>
                <button class="chat-send-btn" data-id="${soknadId}" aria-label="Send melding">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>`;
      }).join('');
    }

    async function oppdaterChatBadges() {
      await Promise.all(alleSoknader.map(async (s) => {
        try {
          const soknadId = String(s.id);
          const { antall } = await hentUlesteChatMeldinger(soknadId);
          const badge = document.getElementById(`chat-badge-${soknadId}`);
          if (!badge) return;
          if (antall > 0) {
            badge.textContent = antall > 9 ? '9+' : antall;
            badge.classList.remove('skjult');
            return;
          }
          badge.classList.add('skjult');
        } catch {
          // Ignorer badge-feil, resten av siden skal fortsatt fungere.
        }
      }));
    }

    async function haandterAutoAapnetChat() {
      if (!autoChatSoknadId) return;
      const finnesISiden = alleSoknader.some((s) => String(s.id) === autoChatSoknadId);
      if (!finnesISiden) return;
      await toggleChat(autoChatSoknadId, { scrollTilPanel: true });
      autoChatSoknadId = '';
      fjernChatFraUrl();
    }

    async function oppdater(id, status) {
      const bekreft = {
        godkjent: 'Er du sikker på at du vil godkjenne denne søknaden?',
        avslatt: 'Er du sikker på at du vil avslå denne søknaden?'
      };
      if (bekreft[status] && !confirm(bekreft[status])) return;

      try {
        await oppdaterSoknadStatus(id, status);
        await lastSoknader();
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = `Status oppdatert til "${statusTekst(status)}"`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      } catch (err) {
        alert(err.message);
      }
    };

    document.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('.toggle-chat-btn');
      if (toggleBtn) { toggleChat(toggleBtn.dataset.id); return; }

      const sendBtn = e.target.closest('.chat-send-btn');
      if (sendBtn) { sendBedriftChatMelding(sendBtn.dataset.id); return; }

      const oppdaterBtn = e.target.closest('.oppdater-btn');
      if (oppdaterBtn) { oppdater(oppdaterBtn.dataset.id, oppdaterBtn.dataset.status); return; }
    });

    document.addEventListener('keydown', (e) => {
      const input = e.target.closest('.chat-input');
      if (input) chatInputKeydown(e, input.dataset.id);
    });

    document.addEventListener('input', (e) => {
      const input = e.target.closest('.chat-input');
      if (input) chatInputResize(input);
    });

    await lastSoknader();

    // Stopp chat-polling når fanen er skjult, start igjen når synlig
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stoppAllChatPolling();
      } else {
        // Gjenstart polling for alle åpne chat-paneler
        alleSoknader.forEach(s => {
          const panel = document.getElementById(`chat-panel-${s.id}`);
          if (panel && !panel.classList.contains('skjult')) {
            lastChatBedrift(s.id);
            stoppChatPolling(s.id);
            chatPolls[s.id] = setInterval(() => lastChatBedrift(s.id), 15000);
          }
        });
      }
    });

    initScrollReveal();
    initVarselBjelle();
