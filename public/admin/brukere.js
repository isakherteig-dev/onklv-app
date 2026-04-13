import {
      krevInnlogging, loggUt, hentAlleBrukere, godkjennBedrift, avvisBedrift,
      formaterDato, initScrollReveal, initVarselBjelle, escHtml
    } from '../app.js';

    let bruker = null;
    let valgtRolle = '';

    bruker = await krevInnlogging('admin');
    if (!bruker) { window.location.href = '/login.html'; }

    document.getElementById('nav-navn').textContent = bruker.navn || '';
    document.getElementById('logg-ut-btn').addEventListener('click', async () => { await loggUt(); });

    document.querySelectorAll('.rolle-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.rolle-tab').forEach(b => b.className = 'btn btn-ghost btn-liten rolle-tab');
        btn.className = 'btn btn-primary btn-liten rolle-tab';
        valgtRolle = btn.dataset.rolle;
        lastBrukere();
      });
    });

    async function lastBrukere() {
      const brukere = await hentAlleBrukere(valgtRolle);
      document.getElementById('antall-tekst').textContent = `${brukere.length} brukere`;

      const tbody = document.getElementById('brukere-tbody');
      if (!brukere.length) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="tom-tilstand"><div class="tom-tilstand-ikon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><h3>Ingen brukere funnet</h3></div></td></tr>`;
        return;
      }

      const rolleBadge = {
        laerling: 'badge-blaa',
        bedrift:  'badge-oransje',
        admin:    'badge-roed'
      };
      const rolleTekst = {
        laerling: 'Lærling',
        bedrift:  'Bedrift',
        admin:    'Admin'
      };

      tbody.innerHTML = brukere.map(b => {
        const info = b.rolle === 'bedrift'
          ? `${b.orgNr ? 'Org.nr: ' + escHtml(b.orgNr) + ' · ' : ''}${escHtml(b.bransje || '')}`
          : escHtml(b.utdanningsprogram || '');

        const status = b.rolle === 'bedrift'
          ? `<span class="badge ${b.godkjent ? 'badge-godkjent' : 'badge-sendt'}">${b.godkjent ? 'Godkjent' : 'Venter'}</span>`
          : '';

        const handlinger = b.rolle === 'bedrift' && !b.godkjent
          ? `<button class="btn-mini btn-mini-gronn" data-action="godkjenn" data-uid="${escHtml(b.uid)}">Godkjenn</button>
             <button class="btn-mini btn-mini-roed" data-action="avvis" data-uid="${escHtml(b.uid)}">Avvis</button>`
          : '';

        return `
          <tr>
            <td><strong>${escHtml(b.navn || '—')}</strong></td>
            <td style="font-size:0.85rem;">${escHtml(b.epost || '—')}</td>
            <td>
              <span class="badge ${rolleBadge[b.rolle] || 'badge-graa'}">${rolleTekst[b.rolle] || b.rolle}</span>
              ${status}
            </td>
            <td style="font-size:0.82rem;color:var(--olkv-gray);">${info}</td>
            <td style="font-size:0.82rem;">${formaterDato(b.opprettet?.toDate ? b.opprettet.toDate().toISOString().split('T')[0] : (b.opprettet || ''))}</td>
            <td><div class="tabell-handlinger">${handlinger}</div></td>
          </tr>`;
      }).join('');
    }

    async function godkjenn(uid) {
      if (!confirm('Godkjenn denne bedriften?')) return;
      try {
        await godkjennBedrift(uid);
        await lastBrukere();
        const toast = document.createElement('div'); toast.className = 'toast'; toast.textContent = 'Bedrift godkjent!';
        document.body.appendChild(toast); setTimeout(() => toast.remove(), 3000);
      } catch (err) { alert(err.message); }
    }

    async function avvis(uid) {
      if (!confirm('Avvis denne bedriften? Den vil bli deaktivert.')) return;
      try {
        await avvisBedrift(uid);
        await lastBrukere();
      } catch (err) { alert(err.message); }
    }

    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const uid = el.dataset.uid;
      if (el.dataset.action === 'godkjenn') godkjenn(uid);
      if (el.dataset.action === 'avvis') avvis(uid);
    });

    await lastBrukere();
    initScrollReveal();
    initVarselBjelle();
