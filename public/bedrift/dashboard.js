import {
      krevInnlogging,
      hentMineAnnonser,
      hentSoknaderBedrift,
      lagreAnnonse,
      slettAnnonse,
      formaterDato,
      statusTekst,
      statusBadgeKlasse,
      visBekreftelse,
      visFeilmelding,
      loggUt,
      initScrollReveal,
      initVarselBjelle,
      slettMinKonto,
      oppdaterSoknadStatus,
      hentUlesteChatMeldinger,
      escHtml
    } from '../app.js';
    initScrollReveal();

    // ===== AUTH GUARD =====
    const bruker = await krevInnlogging('bedrift');
    if (!bruker) throw new Error('redirect');

    document.getElementById('nav-navn').textContent = bruker.navn;
    document.getElementById('hilsen').textContent = `Hei, ${bruker.navn}!`;
    document.getElementById('konto-epost').textContent = bruker.epost || 'Ingen e-post registrert';

    window.scrollTil = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    let alleSoknader = [];
    let alleAnnonser = [];

    // ===== STATS =====
    function visStats() {
      const aktive = alleAnnonser.filter(a => a.aktiv).length;
      const innkomne = alleSoknader.length;
      const underVurdering = alleSoknader.filter(s => s.status === 'under_behandling').length;
      const aksepterte = alleSoknader.filter(s => s.status === 'godkjent').length;

      document.getElementById('stats-rad').innerHTML = `
        <div class="stat-boks"><div class="stat-tall">${aktive}</div><div class="stat-etikett">Aktive annonser</div></div>
        <div class="stat-boks"><div class="stat-tall">${innkomne}</div><div class="stat-etikett">Innkomne søknader</div></div>
        <div class="stat-boks"><div class="stat-tall">${underVurdering}</div><div class="stat-etikett">Under vurdering</div></div>
        <div class="stat-boks"><div class="stat-tall">${aksepterte}</div><div class="stat-etikett">Akseptert</div></div>
      `;
    }

    // ===== ANNONSER =====
    async function lastAnnonser() {
      alleAnnonser = await hentMineAnnonser();
      const container = document.getElementById('annonser-liste');

      if (alleAnnonser.length === 0) {
        container.innerHTML = `
          <div class="kort" style="grid-column: 1 / -1; text-align: center; padding: 2.5rem;">
            <h3 style="margin-bottom: 0.5rem;">Ingen annonser ennå</h3>
            <p style="margin-bottom: 1.5rem;">Legg ut din første læreplassannonse for å motta søknader.</p>
            <button class="btn btn-primary" onclick="document.getElementById('ny-annonse-btn').click()">+ Ny annonse</button>
          </div>
        `;
        return;
      }

      container.innerHTML = alleAnnonser.map(a => `
        <div class="kort">
          <div class="kort-header">
            <div>
              <div class="kort-tittel">${escHtml(a.tittel)}</div>
              <div class="kort-undertittel">Frist: ${formaterDato(a.frist)}</div>
            </div>
            <span class="badge ${a.aktiv ? 'badge-gronn' : 'badge-graa'}">${a.aktiv ? 'Aktiv' : 'Inaktiv'}</span>
          </div>
          <div style="display: flex; gap: 1.5rem; font-size: 0.875rem; color: var(--farge-tekst-sekundaer); margin-bottom: 1rem; flex-wrap: wrap;">
            <span>${a.antall_plasser} plass${a.antall_plasser !== 1 ? 'er' : ''}</span>
            <span>${a.antall_soknader} søknad${a.antall_soknader !== 1 ? 'er' : ''}</span>
          </div>
          <div class="rad" style="gap: 0.5rem;">
            <button class="btn btn-ghost btn-liten slett-annonse-btn" data-id="${escHtml(String(a.id))}" style="color: var(--farge-feil);">Slett</button>
          </div>
        </div>
      `).join('');
    }

    async function slettAnnonseMed(id) {
      const annonse = alleAnnonser.find(a => a.id === id);
      if (!annonse) return;
      if (!confirm(`Slett annonsen «${annonse.tittel}»?`)) return;
      alleAnnonser = await slettAnnonse(id);
      visBekreftelse(`Annonsen «${annonse.tittel}» er slettet.`);
      await lastAnnonser();
      visStats();
    }

    // ===== SØKNADER =====
    async function lastSoknader(filter = '') {
      try {
        alleSoknader = await hentSoknaderBedrift();
      } catch (err) {
        console.error('Kunne ikke hente søknader:', err.message);
        alleSoknader = [];
        document.getElementById('soknader-liste').innerHTML = `<div class="kort" style="text-align:center;padding:2rem;"><p style="color:#dc2626;">${err.message}</p></div>`;
        return;
      }
      const soknader = filter ? alleSoknader.filter(s => s.status === filter) : alleSoknader;
      const container = document.getElementById('soknader-liste');

      if (soknader.length === 0) {
        container.innerHTML = `<div class="kort" style="text-align: center; padding: 2rem;"><p>Ingen søknader${filter ? ` med status «${statusTekst(filter)}»` : ''} ennå.</p></div>`;
        return;
      }

      container.innerHTML = soknader.map(s => {
        const soknadId = String(s.id);
        const chatParams = new URLSearchParams({ chat: soknadId });
        if (s.laerplass_id) {
          chatParams.set('laerplass_id', String(s.laerplass_id));
        }

        return `
        <div class="kort" style="margin-bottom: 1rem;">
          <div class="kort-header">
            <div class="rad" style="gap: 0.75rem; align-items: center;">
              <div class="avatar">${((s.laerling_navn || s.laerling_naam) || '?').trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2)}</div>
              <div>
                <div class="kort-tittel">${escHtml(s.laerling_navn || s.laerling_naam || '—')}</div>
                <div class="kort-undertittel">${[s.utdanningsprogram, s.skole].filter(Boolean).map(escHtml).join(' · ') || '—'}</div>
              </div>
            </div>
            <span class="${statusBadgeKlasse(s.status)}">${statusTekst(s.status)}</span>
          </div>
          <p style="font-size: 0.875rem; background: #f8fafc; padding: 0.75rem 1rem; border-radius: var(--radius); margin-bottom: 1rem; border-left: 3px solid var(--farge-kant); font-style: italic;">
            "${escHtml(s.melding)}"
          </p>
          <div class="kort-footer">
            <span style="font-size: 0.8rem; color: var(--farge-tekst-sekundaer);">Sendt ${formaterDato(s.sendt_dato)}</span>
            <div class="rad" style="gap: 0.5rem;">
              <a class="btn btn-ghost btn-liten" href="/laerling/profil.html?uid=${encodeURIComponent(s.laerling_user_id)}">Se profil</a>
              <a class="btn btn-ghost btn-liten" href="/bedrift/soknader.html?${chatParams.toString()}" style="display:inline-flex;align-items:center;gap:0.4rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Meldinger <span id="dashboard-chat-badge-${soknadId}" class="chat-fane-badge skjult">0</span>
              </a>
              <button class="btn btn-suksess btn-liten oppdater-status-btn" data-id="${escHtml(String(s.id))}" data-status="godkjent" ${s.status === 'godkjent' ? 'disabled' : ''}>Aksepter</button>
              <button class="btn btn-feil btn-liten oppdater-status-btn" data-id="${escHtml(String(s.id))}" data-status="avslatt" ${s.status === 'avslatt' ? 'disabled' : ''}>Avvis</button>
            </div>
          </div>
        </div>
      `;
      }).join('');

      await oppdaterDashboardChatBadges(soknader);
    }

    async function oppdaterDashboardChatBadges(soknader) {
      await Promise.all(soknader.map(async (s) => {
        try {
          const soknadId = String(s.id);
          const { antall } = await hentUlesteChatMeldinger(soknadId);
          const badge = document.getElementById(`dashboard-chat-badge-${soknadId}`);
          if (!badge) return;
          if (antall > 0) {
            badge.textContent = antall > 9 ? '9+' : antall;
            badge.classList.remove('skjult');
            return;
          }
          badge.classList.add('skjult');
        } catch {
          // Ignorer badge-feil på dashbordet.
        }
      }));
    }

    async function oppdaterStatus(id, nyStatus) {
      try {
        await oppdaterSoknadStatus(id, nyStatus);
        await lastSoknader(document.getElementById('status-filter').value);
        visStats();
        visBekreftelse(`Status oppdatert til «${statusTekst(nyStatus)}»`);
      } catch (err) {
        visFeilmelding(err.message || 'Kunne ikke oppdatere status');
      }
    }

    document.addEventListener('click', (e) => {
      const slettBtn = e.target.closest('.slett-annonse-btn');
      if (slettBtn) {
        slettAnnonseMed(slettBtn.dataset.id);
        return;
      }
      const statusBtn = e.target.closest('.oppdater-status-btn');
      if (statusBtn) {
        oppdaterStatus(statusBtn.dataset.id, statusBtn.dataset.status);
      }
    });

    document.getElementById('status-filter').addEventListener('change', (e) => {
      lastSoknader(e.target.value);
    });

    // ===== NY ANNONSE MODAL =====
    document.getElementById('ny-annonse-btn').addEventListener('click', () => {
      document.getElementById('annonse-modal').classList.remove('skjult');
      // Sett min. dato til i dag
      document.getElementById('ann-frist').min = new Date().toISOString().split('T')[0];
    });

    function lukkAnnonseModal() {
      document.getElementById('annonse-modal').classList.add('skjult');
      document.getElementById('annonse-form').reset();
    }

    document.getElementById('annonse-modal-lukk').addEventListener('click', lukkAnnonseModal);
    document.getElementById('annonse-modal-avbryt').addEventListener('click', lukkAnnonseModal);
    document.getElementById('annonse-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) lukkAnnonseModal();
    });

    document.getElementById('annonse-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const tittel = document.getElementById('ann-tittel').value.trim();
      const antall_plasser = parseInt(document.getElementById('ann-plasser').value);
      const frist = document.getElementById('ann-frist').value;
      const beskrivelse = document.getElementById('ann-beskrivelse').value.trim();

      if (!tittel || !frist || !beskrivelse) {
        visFeilmelding('Fyll ut alle påkrevde felter', 'varsel');
        lukkAnnonseModal();
        return;
      }

      await lagreAnnonse({ tittel, antall_plasser, frist, beskrivelse });
      lukkAnnonseModal();
      visBekreftelse(`Annonsen «${tittel}» er publisert!`);
      await lastAnnonser();
      visStats();
    });

    function apneSlettKontoModal() {
      document.getElementById('slett-konto-feil').classList.add('skjult');
      document.getElementById('slett-konto-modal').classList.remove('skjult');
    }

    function lukkSlettKontoModal() {
      document.getElementById('slett-konto-modal').classList.add('skjult');
    }

    document.getElementById('slett-konto-btn').addEventListener('click', apneSlettKontoModal);
    document.getElementById('slett-konto-lukk').addEventListener('click', lukkSlettKontoModal);
    document.getElementById('slett-konto-avbryt').addEventListener('click', lukkSlettKontoModal);
    document.getElementById('slett-konto-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) lukkSlettKontoModal();
    });

    document.getElementById('slett-konto-bekreft').addEventListener('click', async () => {
      const btn = document.getElementById('slett-konto-bekreft');
      const feilEl = document.getElementById('slett-konto-feil');
      btn.disabled = true;
      btn.textContent = 'Sletter…';

      try {
        await slettMinKonto();
      } catch (err) {
        feilEl.className = 'varsel varsel-feil';
        feilEl.textContent = err.message || 'Kunne ikke slette kontoen din. Prøv igjen.';
        feilEl.classList.remove('skjult');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Ja, slett kontoen min';
      }
    });

    // ===== LOGG UT =====
    document.getElementById('logg-ut-btn').addEventListener('click', () => {
      if (confirm('Er du sikker på at du vil logge ut?')) loggUt();
    });

    // ===== INIT =====
    async function init() {
      await Promise.all([lastAnnonser(), lastSoknader()]);
      visStats();
    }
    init();
    initVarselBjelle();
