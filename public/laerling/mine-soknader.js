import {
      krevInnlogging, loggUt, hentSoknaderLaerling, trekkSoknad,
      statusTekst, statusBadgeKlasse, formaterDato, initScrollReveal, initVarselBjelle, initialFra,
      hentMeldinger, sendChatMelding, hentUlesteChatMeldinger, escHtml
    } from '../app.js';

    let bruker = null;
    let alleSoknader = [];
    let aktivSoknadId = null;
    let chatPollInterval = null;

    function oppdaterChatBadge(antall) {
      const badge = document.getElementById('chat-ulest-badge');
      if (antall > 0) {
        badge.textContent = antall > 9 ? '9+' : antall;
        badge.classList.remove('skjult');
      } else {
        badge.classList.add('skjult');
      }
    }

    async function lastChatMeldinger(soknadId) {
      const { meldinger } = await hentMeldinger(soknadId);
      const container = document.getElementById('chat-meldinger-liste');
      if (!container) return;

      if (!meldinger || meldinger.length === 0) {
        container.innerHTML = '<div class="chat-tom">Ingen meldinger ennå. Send en melding for å starte samtalen.</div>';
        oppdaterChatBadge(0);
        return;
      }

      container.innerHTML = meldinger.map(m => {
        const erMeg = m.avsender_id === bruker.uid;
        const tidspunkt = new Date(m.opprettet).toLocaleString('nb-NO', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
        return `
          <div class="chat-boble-wrapper ${erMeg ? 'meg' : 'dem'}">
            <div class="chat-boble">${escHtml(m.tekst)}</div>
            <div class="chat-meta">${tidspunkt}</div>
          </div>`;
      }).join('');
      container.scrollTop = container.scrollHeight;
      oppdaterChatBadge(0);
    }

    function startChatPolling(soknadId) {
      stoppChatPolling();
      chatPollInterval = setInterval(() => lastChatMeldinger(soknadId), 15000);
    }

    function stoppChatPolling() {
      if (chatPollInterval) { clearInterval(chatPollInterval); chatPollInterval = null; }
    }

    window.byttFane = function(fane) {
      const erChat = fane === 'chat';
      document.getElementById('panel-detaljer').classList.toggle('skjult', erChat);
      document.getElementById('panel-chat').classList.toggle('skjult', !erChat);
      document.getElementById('fane-detaljer').classList.toggle('aktiv', !erChat);
      document.getElementById('fane-chat').classList.toggle('aktiv', erChat);
      if (erChat && aktivSoknadId) {
        lastChatMeldinger(aktivSoknadId);
        startChatPolling(aktivSoknadId);
      } else {
        stoppChatPolling();
      }
    };

    bruker = await krevInnlogging('laerling');
    if (!bruker) { window.location.href = '/login.html'; }

    document.getElementById('nav-navn').textContent = bruker.navn || '';
    const navAvatar = document.getElementById('nav-avatar');
    if (navAvatar) {
      if (bruker.avatar_url) {
        navAvatar.innerHTML = '';
        navAvatar.style.overflow = 'hidden';
        const navImg = document.createElement('img');
        navImg.src = bruker.avatar_url;
        navImg.alt = bruker.navn || '';
        navImg.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
        navImg.onerror = () => { navAvatar.textContent = initialFra(bruker.navn); navAvatar.style.overflow = ''; };
        navAvatar.appendChild(navImg);
      } else {
        navAvatar.textContent = initialFra(bruker.navn);
      }
    }
    document.getElementById('logg-ut-btn').addEventListener('click', async () => { await loggUt(); });

    async function oppdaterTabellChatBadges() {
      await Promise.all(alleSoknader.map(async (s) => {
        try {
          const { antall } = await hentUlesteChatMeldinger(s.id);
          const badge = document.getElementById(`tabell-chat-badge-${s.id}`);
          if (!badge) return;
          if (antall > 0) {
            badge.textContent = antall > 9 ? '9+' : antall;
            badge.classList.remove('skjult');
          } else {
            badge.classList.add('skjult');
          }
        } catch { /* ignorer badge-feil */ }
      }));
    }

    async function lastSoknader() {
      alleSoknader = await hentSoknaderLaerling();
      visSoknader(alleSoknader);
      await oppdaterTabellChatBadges();
    }

    function visSoknader(soknader) {
      const container = document.getElementById('soknader-innhold');
      document.getElementById('antall-tekst').textContent = `${soknader.length} søknader totalt`;

      if (!soknader.length) {
        container.innerHTML = `
          <div class="tom-tilstand">
            <div class="tom-tilstand-ikon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></div>
            <h3>Ingen søknader ennå</h3>
            <p>Du har ikke søkt på noen læreplasser ennå.</p>
            <a href="/laerling/laereplasser.html" class="btn btn-primary" style="margin-top:1rem;">Finn læreplasser →</a>
          </div>`;
        return;
      }

      container.innerHTML = `
        <div class="tabell-wrapper">
          <table class="tabell">
            <thead>
              <tr>
                <th>Læreplass</th>
                <th>Bedrift</th>
                <th>Sendt</th>
                <th>Status</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${soknader.map(s => `
                <tr style="cursor:pointer;" onclick="visDetaljer('${s.id}')">
                  <td><strong>${escHtml(s.tittel || '—')}</strong></td>
                  <td>${escHtml(s.bedrift_navn || '—')}</td>
                  <td>${formaterDato(s.sendt_dato)}</td>
                  <td><span class="${statusBadgeKlasse(s.status)}">${statusTekst(s.status)}</span></td>
                  <td>
                    ${s.status === 'sendt' ? `<button class="btn-mini btn-mini-roed" onclick="event.stopPropagation();trekkSoknadKlikk('${s.id}')">Trekk</button>` : ''}
                  </td>
                  <td>
                    <button class="btn-mini btn-mini-blaa" onclick="event.stopPropagation();visDetaljer('${s.id}', 'chat')" style="display:inline-flex;align-items:center;gap:4px;">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> <span id="tabell-chat-badge-${s.id}" class="chat-fane-badge skjult">0</span>
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
    }

    window.visDetaljer = function(id, startFane = 'detaljer') {
      const s = alleSoknader.find(x => x.id === id);
      if (!s) return;

      document.getElementById('detaljer-tittel').textContent = s.tittel || 'Søknadsdetaljer';
      document.getElementById('detaljer-innhold').innerHTML = `
        <div style="display:grid;gap:0.75rem;">
          <div class="rad" style="gap:1rem;flex-wrap:wrap;">
            <div style="flex:1;min-width:180px;">
              <div style="font-size:0.8rem;color:var(--olkv-gray);margin-bottom:2px;">Bedrift</div>
              <strong>${escHtml(s.bedrift_navn || '—')}</strong>
            </div>
            <div>
              <div style="font-size:0.8rem;color:var(--olkv-gray);margin-bottom:2px;">Status</div>
              <span class="${statusBadgeKlasse(s.status)}">${statusTekst(s.status)}</span>
            </div>
          </div>
          <div class="rad" style="gap:1rem;flex-wrap:wrap;">
            <div>
              <div style="font-size:0.8rem;color:var(--olkv-gray);margin-bottom:2px;">Sendt</div>
              ${formaterDato(s.sendt_dato)}
            </div>
            ${s.sted ? `<div><div style="font-size:0.8rem;color:var(--olkv-gray);margin-bottom:2px;">Sted</div>${escHtml(s.sted)}</div>` : ''}
          </div>
          ${s.melding ? `<div><div style="font-size:0.8rem;color:var(--olkv-gray);margin-bottom:4px;">Motivasjon</div><p style="background:var(--olkv-gray-light);padding:0.75rem;border-radius:var(--radius);font-size:0.9rem;margin:0;">${escHtml(s.melding)}</p></div>` : ''}
          ${s.erfaring ? `<div><div style="font-size:0.8rem;color:var(--olkv-gray);margin-bottom:4px;">Erfaring</div><p style="background:var(--olkv-gray-light);padding:0.75rem;border-radius:var(--radius);font-size:0.9rem;margin:0;">${escHtml(s.erfaring)}</p></div>` : ''}
          ${(s.vg1 || s.vg2) ? `<div class="rad" style="gap:1rem;"><div><div style="font-size:0.8rem;color:var(--olkv-gray);">VG1</div>${escHtml(s.vg1 || '—')}</div><div><div style="font-size:0.8rem;color:var(--olkv-gray);">VG2</div>${escHtml(s.vg2 || '—')}</div></div>` : ''}
          ${s.admin_kommentar ? `<div><div style="font-size:0.8rem;color:var(--olkv-gray);margin-bottom:4px;">Kommentar fra OLKV</div><p style="background:#FEF3E2;padding:0.75rem;border-radius:var(--radius);font-size:0.9rem;margin:0;border-left:3px solid #B7791F;">${escHtml(s.admin_kommentar)}</p></div>` : ''}
          ${s.status === 'godkjent' ? `<div style="background:var(--color-success-bg);border:1px solid #bbf7d0;border-radius:var(--radius);padding:1.25rem;margin-top:1rem;"><p style="font-weight:600;color:#15803d;margin:0 0 0.5rem;">Neste steg</p><p style="margin:0;font-size:0.9rem;color:#166534;line-height:1.6;">Gratulerer! Opplæringskontoret i Vestland vil nå opprette lærekontrakten din. Du vil snart motta en invitasjon til <strong>fagbrev.io</strong>-appen, der du følger opp hele læretiden — dokumentering, vurderingssamtaler og kompetansemål.</p></div>` : ''}
        </div>`;

      document.getElementById('detaljer-handlinger').innerHTML = s.status === 'sendt'
        ? `<button class="btn btn-secondary" onclick="trekkSoknadKlikk(${s.id})">Trekk søknad</button>`
        : '';

      aktivSoknadId = id;
      byttFane('detaljer');
      hentUlesteChatMeldinger(id).then(data => oppdaterChatBadge(data.antall || 0));
      document.getElementById('detaljer-modal').classList.remove('skjult');
      if (startFane === 'chat') byttFane('chat');
    };

    window.trekkSoknadKlikk = async function(id) {
      if (!confirm('Er du sikker på at du vil trekke søknaden? Dette kan ikke angres.')) return;
      try {
        await trekkSoknad(id);
        document.getElementById('detaljer-modal').classList.add('skjult');
        await lastSoknader();
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = 'Søknaden er trukket.';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      } catch (err) {
        alert(err.message);
      }
    };

    document.getElementById('detaljer-lukk-btn').addEventListener('click', () => {
      document.getElementById('detaljer-modal').classList.add('skjult');
      stoppChatPolling();
      oppdaterTabellChatBadges();
    });
    document.getElementById('detaljer-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        document.getElementById('detaljer-modal').classList.add('skjult');
        stoppChatPolling();
        oppdaterTabellChatBadges();
      }
    });

    document.getElementById('chat-send-btn').addEventListener('click', async () => {
      const input = document.getElementById('chat-input');
      const tekst = input.value.trim();
      if (!tekst || !aktivSoknadId) return;
      const btn = document.getElementById('chat-send-btn');
      btn.disabled = true;
      try {
        await sendChatMelding(aktivSoknadId, tekst);
        input.value = '';
        input.style.height = 'auto';
        await lastChatMeldinger(aktivSoknadId);
      } catch (err) {
        alert(err.message);
      } finally {
        btn.disabled = false;
        input.focus();
      }
    });

    document.getElementById('chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('chat-send-btn').click();
      }
    });

    document.getElementById('chat-input').addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    });

    await lastSoknader();

    // Stopp chat-polling når fanen er skjult, start igjen når synlig
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stoppChatPolling();
      } else if (aktivSoknadId && !document.getElementById('panel-chat')?.classList.contains('skjult')) {
        lastChatMeldinger(aktivSoknadId);
        stoppChatPolling();
        chatPollInterval = setInterval(() => lastChatMeldinger(aktivSoknadId), 15000);
      }
    });

    initScrollReveal();
    initVarselBjelle();

document.querySelectorAll('[data-fane]').forEach(btn => {
  btn.addEventListener('click', () => window.byttFane?.(btn.dataset.fane));
});
