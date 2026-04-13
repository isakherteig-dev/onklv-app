import {
      krevInnlogging,
      loggUt,
      formaterDato,
      statusTekst,
      statusBadgeKlasse,
      hentAdminStatistikk,
      hentAllesoknader,
      hentAlleBrukere,
      hentAlleLaereplasser,
      godkjennBedrift as apiBedriftGodkjenn,
      avvisBedrift as apiBedriftAvvis,
      initScrollReveal,
      initVarselBjelle,
      escHtml
    } from '../app.js';

    // ===== AUTH GUARD =====
    const bruker = await krevInnlogging('admin');
    if (!bruker) throw new Error('redirect');

    document.getElementById('nav-navn').textContent = bruker.navn;
    document.getElementById('logg-ut-btn').addEventListener('click', () => {
      if (confirm('Er du sikker på at du vil logge ut?')) loggUt();
    });

    window.scrollTil = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // ===== COUNTING ANIMATION =====
    function animerTall(el, maal, varighet = 600) {
      const start = performance.now();
      function steg(ts) {
        const fremgang = Math.min((ts - start) / varighet, 1);
        const eased = 1 - Math.pow(1 - fremgang, 3);
        el.textContent = Math.round(eased * maal);
        if (fremgang < 1) requestAnimationFrame(steg);
      }
      requestAnimationFrame(steg);
    }

    // ===== STATS =====
    async function lastStats() {
      try {
        const s = await hentAdminStatistikk();
        const rad = document.getElementById('stats-rad');
        const venter = s.antallBedrifterVenter || 0;
        rad.innerHTML = `
          <div class="stat-boks">
            <div class="stat-tall" id="st-soknader">0</div>
            <div class="stat-etikett">Totale søknader</div>
          </div>
          <div class="stat-boks" style="${venter > 0 ? 'border-color:#fde68a;' : ''}">
            <div class="stat-tall" id="st-venter" style="${venter > 0 ? 'color:var(--farge-advarsel);' : ''}">0</div>
            <div class="stat-etikett">Bedrifter til godkjenning</div>
          </div>
          <div class="stat-boks">
            <div class="stat-tall" id="st-laerlinger">0</div>
            <div class="stat-etikett">Registrerte lærlinger</div>
          </div>
          <div class="stat-boks">
            <div class="stat-tall" id="st-laereplasser">0</div>
            <div class="stat-etikett">Aktive læreplasser</div>
          </div>
        `;
        animerTall(document.getElementById('st-soknader'), s.soknaderTotalt || 0);
        animerTall(document.getElementById('st-venter'), venter);
        animerTall(document.getElementById('st-laerlinger'), s.antallLaerlinger || 0);
        animerTall(document.getElementById('st-laereplasser'), s.aktiveLaereplasser || 0);
      } catch (e) { console.error('Feil ved henting av statistikk:', e); }
    }

    // ===== BEDRIFTER =====
    async function lastBedrifter() {
      const container = document.getElementById('bedrifter-liste');
      try {
        const alle = await hentAlleBrukere('bedrift');
        const venter = alle.filter(b => !b.godkjent);
        document.getElementById('antall-venter').textContent = `${venter.length} venter`;

        if (venter.length === 0) {
          container.innerHTML = `<div class="varsel varsel-suksess">Ingen bedrifter venter godkjenning akkurat nå.</div>`;
          return;
        }

        container.innerHTML = `
          <div class="tabell-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Bedrift</th><th>Org.nr</th><th>Bransje</th><th>E-post</th><th>Registrert</th><th>Handling</th>
                </tr>
              </thead>
              <tbody>
                ${venter.map(b => `
                  <tr>
                    <td><strong>${escHtml(b.navn || '—')}</strong></td>
                    <td style="font-family:monospace;font-size:0.85rem;">${escHtml(b.orgNr || '—')}</td>
                    <td>${escHtml(b.bransje || '—')}</td>
                    <td style="font-size:0.85rem;">${escHtml(b.epost || '—')}</td>
                    <td style="font-size:0.85rem;color:var(--farge-tekst-sekundaer);">${formaterDato(b.opprettet?.toDate ? b.opprettet.toDate().toISOString().split('T')[0] : (b.opprettet || ''))}</td>
                    <td>
                      <div class="rad" style="gap:0.5rem;flex-wrap:nowrap;">
                        <button class="btn-mini btn-mini-gronn" data-action="godkjennKlikk" data-uid="${escHtml(b.uid)}" data-navn="${escHtml(b.navn || '')}">Godkjenn</button>
                        <button class="btn-mini btn-mini-roed" data-action="avvisKlikk" data-uid="${escHtml(b.uid)}" data-navn="${escHtml(b.navn || '')}">Avvis</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      } catch (e) {
        container.innerHTML = `<div class="varsel varsel-feil">Kunne ikke laste bedrifter: ${e.message}</div>`;
      }
    }

    async function godkjennKlikk(uid, navn) {
      if (!confirm(`Godkjenn ${navn}?`)) return;
      try {
        await apiBedriftGodkjenn(uid);
        const toast = document.createElement('div'); toast.className = 'toast'; toast.textContent = `${navn} er godkjent!`;
        document.body.appendChild(toast); setTimeout(() => toast.remove(), 3000);
        await lastBedrifter();
        await lastStats();
      } catch (e) { alert(e.message); }
    }

    async function avvisKlikk(uid, navn) {
      if (!confirm(`Avvis ${navn}? Bedriften vil bli deaktivert.`)) return;
      try {
        await apiBedriftAvvis(uid);
        await lastBedrifter();
        await lastStats();
      } catch (e) { alert(e.message); }
    }

    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      if (el.dataset.action === 'godkjennKlikk') godkjennKlikk(el.dataset.uid, el.dataset.navn);
      if (el.dataset.action === 'avvisKlikk') avvisKlikk(el.dataset.uid, el.dataset.navn);
    });

    // ===== SØKNADER =====
    let soknaderCache = [];

    async function lastSoknader() {
      const tbody = document.getElementById('soknader-tabell');
      tbody.innerHTML = `<tr><td colspan="6" class="skeleton" style="height:100px;"></td></tr>`;
      try {
        soknaderCache = await hentAllesoknader();
        visSoknaderTabell(document.getElementById('status-filter').value);
      } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--farge-tekst-sekundaer);">Kunne ikke laste søknader.</td></tr>`;
      }
    }

    function visSoknaderTabell(filter) {
      const soknader = filter ? soknaderCache.filter(s => s.status === filter) : soknaderCache;
      const tbody = document.getElementById('soknader-tabell');
      if (soknader.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--farge-tekst-sekundaer);padding:2rem;">Ingen søknader${filter ? ` med status «${statusTekst(filter)}»` : ''}.</td></tr>`;
        return;
      }
      tbody.innerHTML = soknader.map(s => `
        <tr>
          <td><strong>${escHtml(s.laerling_navn || '—')}</strong><br><span style="font-size:0.8rem;color:var(--farge-tekst-sekundaer);">${escHtml(s.laerling_epost || '')}</span></td>
          <td style="font-size:0.85rem;">${escHtml(s.utdanningsprogram || s.vg1 || '—')}</td>
          <td>${escHtml(s.laerling_tittel || s.tittel || '—')}</td>
          <td>${escHtml(s.bedrift_naam || s.bedrift_navn || '—')}</td>
          <td style="font-size:0.85rem;color:var(--farge-tekst-sekundaer);">${formaterDato(s.opprettet || s.dato)}</td>
          <td><span class="badge ${statusBadgeKlasse(s.status)}">${statusTekst(s.status)}</span></td>
        </tr>
      `).join('');
    }

    document.getElementById('status-filter').addEventListener('change', e => visSoknaderTabell(e.target.value));

    // ===== STATISTIKK =====
    async function lastStatistikk() {
      try {
        const [soknader, laereplasser] = await Promise.all([
          hentAllesoknader(),
          hentAlleLaereplasser()
        ]);
        const total = soknader.length;
        const statuser = ['sendt', 'under_behandling', 'godkjent', 'avslatt', 'trukket'];
        const farger = { godkjent: 'var(--farge-suksess)', avslatt: 'var(--farge-feil)', under_behandling: 'var(--farge-advarsel)', sendt: 'var(--farge-hoved)', trukket: '#999' };

        document.getElementById('status-fordeling').innerHTML = statuser.map(s => {
          const antall = soknader.filter(x => x.status === s).length;
          const prosent = total > 0 ? Math.round((antall / total) * 100) : 0;
          return `
            <div>
              <div class="rad" style="justify-content:space-between;margin-bottom:0.25rem;">
                <span style="font-size:0.875rem;">${statusTekst(s)}</span>
                <span style="font-size:0.875rem;font-weight:600;">${antall} (${prosent}%)</span>
              </div>
              <div class="fremgang-linje">
                <div class="fremgang-fyll" style="width:${prosent}%;background-color:${farger[s] || 'var(--farge-hoved)'};"></div>
              </div>
            </div>`;
        }).join('');

        const fagomraader = {};
        laereplasser.forEach(p => {
          const f = p.fagomraade || p.bransje || 'Annet';
          fagomraader[f] = (fagomraader[f] || 0) + 1;
        });
        document.getElementById('bransje-fordeling').innerHTML = Object.entries(fagomraader).length
          ? Object.entries(fagomraader).sort((a, b) => b[1] - a[1]).map(([navn, antall]) => `
              <div class="rad" style="justify-content:space-between;">
                <span style="font-size:0.875rem;">${escHtml(navn)}</span>
                <span class="badge badge-blaa">${antall}</span>
              </div>`).join('')
          : '<p style="color:var(--farge-tekst-sekundaer);font-size:0.875rem;">Ingen læreplasser ennå.</p>';
      } catch (e) { console.error('Feil ved statistikk:', e); }
    }

    // ===== INIT =====
    initScrollReveal();
    initVarselBjelle();

    await Promise.all([lastStats(), lastBedrifter(), lastSoknader(), lastStatistikk()]);

document.querySelectorAll('[data-scroll-til]').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTil(el.dataset.scrollTil);
  });
});
