import {
      krevInnlogging, loggUt, hentAllesoknader, oppdaterSoknadStatusAdmin,
      statusTekst, statusBadgeKlasse, formaterDato, initScrollReveal, initVarselBjelle, getToken, escHtml
    } from '../app.js';

    let bruker = null;
    let alleSoknader = [];
    let bekreftCallback = null;

    bruker = await krevInnlogging('admin');
    if (!bruker) { window.location.href = '/login.html'; }

    document.getElementById('nav-navn').textContent = bruker.navn || '';
    document.getElementById('logg-ut-btn').addEventListener('click', async () => { await loggUt(); });

    async function lastSoknader() {
      const status = document.getElementById('status-filter').value;
      const sok = document.getElementById('sok-input').value.trim();
      alleSoknader = await hentAllesoknader({ status, sok });
      visSoknader(alleSoknader);
    }

    function visSoknader(soknader) {
      document.getElementById('antall-tekst').textContent = `${soknader.length} søknader`;
      const tbody = document.getElementById('soknader-tbody');

      if (!soknader.length) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="tom-tilstand"><div class="tom-tilstand-ikon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></div><h3>Ingen søknader funnet</h3></div></td></tr>`;
        return;
      }

      tbody.innerHTML = soknader.map(s => `
        <tr style="cursor:pointer;" data-action="visDetaljer" data-id="${escHtml(String(s.id))}">
          <td>
            <strong>${escHtml(s.laerling_navn || s.laerling_naam || '—')}</strong><br/>
            <span style="font-size:0.8rem;color:var(--olkv-gray);">${escHtml(s.laerling_epost || '')}</span>
          </td>
          <td>${escHtml(s.laerplass_tittel || '—')}</td>
          <td>${escHtml(s.bedrift_navn || '—')}</td>
          <td>${formaterDato(s.sendt_dato)}</td>
          <td><span class="${statusBadgeKlasse(s.status)}">${statusTekst(s.status)}</span></td>
          <td>
            <div class="tabell-handlinger">
              ${s.status !== 'under_behandling' && s.status !== 'godkjent' && s.status !== 'avslatt'
                ? `<button class="btn-mini btn-mini-blaa" data-action="settStatus" data-id="${escHtml(String(s.id))}" data-status="under_behandling" data-tekst="Sett søknad under behandling?">Under behandling</button>` : ''}
              ${s.status !== 'godkjent'
                ? `<button class="btn-mini btn-mini-gronn" data-action="settStatus" data-id="${escHtml(String(s.id))}" data-status="godkjent" data-tekst="Godkjenn denne søknaden?">Godkjenn</button>` : ''}
              ${s.status !== 'avslatt'
                ? `<button class="btn-mini btn-mini-roed" data-action="settStatus" data-id="${escHtml(String(s.id))}" data-status="avslatt" data-tekst="Avslå denne søknaden?">Avslå</button>` : ''}
            </div>
          </td>
        </tr>`).join('');
    }

    function visDetaljer(id) {
      console.log('visDetaljer:', { id, typeofId: typeof id, idsIArray: alleSoknader.slice(0,3).map(s => ({ id: s.id, type: typeof s.id })) });
      const s = alleSoknader.find(x => String(x.id) === String(id));
      if (!s) return;
      document.getElementById('detaljer-tittel').textContent = `${s.laerling_navn || s.laerling_naam || 'Søker'} → ${s.laerplass_tittel || 'Læreplass'}`;
      document.getElementById('detaljer-innhold').innerHTML = `
        <div style="display:grid;gap:1rem;">
          <div class="rad" style="gap:1rem;flex-wrap:wrap;">
            <div style="flex:1;"><div class="hint">Søker</div><strong>${escHtml(s.laerling_navn || s.laerling_naam || '—')}</strong><br/><span style="font-size:0.85rem;">${escHtml(s.laerling_epost || '')}</span></div>
            <div><div class="hint">Status</div><span class="${statusBadgeKlasse(s.status)}">${statusTekst(s.status)}</span></div>
          </div>
          <div class="rad" style="gap:1rem;flex-wrap:wrap;">
            <div style="flex:1;"><div class="hint">Læreplass</div>${escHtml(s.laerplass_tittel || '—')}</div>
            <div style="flex:1;"><div class="hint">Bedrift</div>${escHtml(s.bedrift_navn || '—')}</div>
          </div>
          ${s.utdanningsprogram ? `<div><div class="hint">Utdanningsprogram</div>${escHtml(s.utdanningsprogram)}</div>` : ''}
          ${(s.vg1 || s.vg2) ? `<div class="rad" style="gap:1rem;"><div><div class="hint">VG1</div>${escHtml(s.vg1 || '—')}</div><div><div class="hint">VG2</div>${escHtml(s.vg2 || '—')}</div></div>` : ''}
          ${s.melding ? `<div><div class="hint">Motivasjon</div><p style="background:var(--olkv-gray-light);padding:0.75rem;border-radius:var(--radius);font-size:0.88rem;margin:0.25rem 0 0;">${escHtml(s.melding)}</p></div>` : ''}
          ${s.erfaring ? `<div><div class="hint">Erfaring</div><p style="background:var(--olkv-gray-light);padding:0.75rem;border-radius:var(--radius);font-size:0.88rem;margin:0.25rem 0 0;">${escHtml(s.erfaring)}</p></div>` : ''}
          ${s.vedlegg ? `
            <div>
              <div class="hint">Vedlegg</div>
              <button class="btn btn-liten" style="margin-top:0.35rem;" data-action="lastNedVedlegg" data-id="${escHtml(String(s.id))}">
                Last ned CV${s.vedlegg_originalnavn ? ` (${s.vedlegg_originalnavn})` : ''}
              </button>
            </div>
          ` : ''}
          ${s.admin_kommentar ? `<div><div class="hint">Admin-kommentar</div><p style="background:#FEF3E2;padding:0.75rem;border-radius:var(--radius);font-size:0.88rem;margin:0.25rem 0 0;border-left:3px solid #B7791F;">${escHtml(s.admin_kommentar)}</p></div>` : ''}
          <div class="rad" style="gap:2rem;margin-top:0.5rem;padding-top:0.75rem;border-top:1px solid var(--farge-kant);">
            <div><div class="hint">Sendt</div>${formaterDato(s.sendt_dato)}</div>
            ${s.behandlet_dato ? `<div><div class="hint">Behandlet</div>${formaterDato(s.behandlet_dato)}</div>` : ''}
          </div>
          <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-top:0.5rem;">
            ${s.status !== 'godkjent' ? `<button class="btn btn-liten" style="background:#e8f5e9;color:#1B5E20;border:none;" data-action="settStatus" data-id="${escHtml(String(s.id))}" data-status="godkjent" data-tekst="Godkjenn denne søknaden?">Godkjenn</button>` : ''}
            ${s.status !== 'avslatt' ? `<button class="btn btn-liten" style="background:#FDECEA;color:#922B21;border:none;" data-action="settStatus" data-id="${escHtml(String(s.id))}" data-status="avslatt" data-tekst="Avslå denne søknaden?">Avslå</button>` : ''}
            <button class="btn btn-liten" style="background:#eff6ff;color:var(--olkv-blue);border:none;" id="ai-oppsummer-btn" data-action="aiOppsummer" data-id="${escHtml(String(s.id))}">AI-sammendrag</button>
            ${s.status === 'godkjent' ? `<button class="btn btn-liten" style="background:#E8EFF8;color:var(--olkv-blue);border:none;" data-action="overleveringSammendrag" data-id="${escHtml(String(s.id))}">Overlevering til fagbrev.io</button>` : ''}
          </div>
          <div id="ai-oppsummer-boks" style="display:none;margin-top:0.75rem;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:0.75rem;font-size:0.875rem;">
            <span style="font-size:0.75rem;font-weight:600;color:var(--olkv-blue);display:block;margin-bottom:0.4rem;">AI-sammendrag</span>
            <span id="ai-oppsummer-tekst">Laster…</span>
          </div>
          <div id="overlevering-boks" style="display:none;margin-top:0.75rem;background:#E8EFF8;border:1px solid #bfdbfe;border-radius:8px;padding:0.75rem;font-size:0.875rem;"></div>
        </div>`;
      document.getElementById('detaljer-modal').classList.remove('skjult');
    }

    async function lastNedVedlegg(id) {
      const soknad = alleSoknader.find(x => x.id === id);
      if (!soknad?.vedlegg) return;

      try {
        const token = await getToken();
        const res = await fetch(`/api/soknader/${id}/vedlegg`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.feil || 'Kunne ikke laste ned CV.');
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = soknad.vedlegg_originalnavn || 'cv';
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        alert(err.message || 'Kunne ikke laste ned CV.');
      }
    };

    function settStatus(id, status, tekst) {
      document.getElementById('bekreft-tittel').textContent = statusTekst(status);
      document.getElementById('bekreft-tekst').textContent = tekst;
      document.getElementById('bekreft-kommentar').value = '';
      bekreftCallback = async () => {
        const kommentar = document.getElementById('bekreft-kommentar').value.trim();
        await oppdaterSoknadStatusAdmin(id, status, kommentar);
        document.getElementById('bekreft-modal').classList.add('skjult');
        document.getElementById('detaljer-modal').classList.add('skjult');
        await lastSoknader();
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = `Status satt til "${statusTekst(status)}"`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      };
      document.getElementById('bekreft-modal').classList.remove('skjult');
    };

    async function overleveringSammendrag(soknadId) {
      const boks = document.getElementById('overlevering-boks');
      boks.style.display = 'block';
      boks.innerHTML = '<span style="color:var(--olkv-blue);">Henter overleveringsdata…</span>';

      try {
        const token = await getToken();
        const res = await fetch(`/api/admin/soknader/${soknadId}/overlevering`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.feil || 'Kunne ikke hente overleveringsdata');

        const rad = (label, verdi) => verdi
          ? `<div style="margin-bottom:0.4rem;"><span style="font-weight:600;">${escHtml(label)}:</span> ${escHtml(String(verdi))}</div>`
          : '';
        const ferdigheter = Array.isArray(data.ferdigheter) && data.ferdigheter.length
          ? `<div style="margin-bottom:0.4rem;"><span style="font-weight:600;">Ferdigheter:</span> ${data.ferdigheter.map(f => escHtml(String(f))).join(', ')}</div>`
          : '';

        boks.innerHTML = `
          <span style="font-size:0.75rem;font-weight:600;color:var(--olkv-blue);display:block;margin-bottom:0.6rem;">Overlevering til fagbrev.io</span>
          ${rad('Navn', data.laerling_navn)}
          ${rad('E-post', data.laerling_epost)}
          ${rad('Telefon', data.laerling_telefon)}
          ${rad('Utdanningsprogram', data.utdanningsprogram)}
          ${rad('Skole', data.skole)}
          ${rad('Bedrift', data.bedrift_navn)}
          ${rad('Læreplass', data.laerplass_tittel)}
          ${rad('Fagområde', data.fagomraade)}
          ${rad('Sted', data.sted)}
          ${ferdigheter}
          ${rad('Motivasjon', data.motivasjon)}
          ${rad('Sendt dato', data.sendt_dato ? new Date(data.sendt_dato).toLocaleDateString('nb-NO') : null)}
          ${rad('Godkjent dato', data.godkjent_dato ? new Date(data.godkjent_dato).toLocaleDateString('nb-NO') : null)}`;
      } catch (err) {
        console.error(err);
        boks.innerHTML = `<span style="color:#922B21;">${escHtml(err.message || 'Noe gikk galt.')}</span>`;
      }
    };

    async function aiOppsummer(soknadId) {
      const boks = document.getElementById('ai-oppsummer-boks');
      const tekst = document.getElementById('ai-oppsummer-tekst');
      const btn = document.getElementById('ai-oppsummer-btn');
      boks.style.display = 'block';
      tekst.textContent = 'Analyserer søknaden…';
      if (btn) btn.disabled = true;

      try {
        const token = await getToken();
        const res = await fetch('/api/ai/oppsummer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ soknad_id: soknadId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.feil || 'AI-oppsummering feilet');
        tekst.textContent = data.oppsummering;
      } catch (err) {
        tekst.textContent = err.message || 'Noe gikk galt. Prøv igjen.';
      } finally {
        if (btn) btn.disabled = false;
      }
    };

    document.getElementById('bekreft-ok').addEventListener('click', async () => {
      if (bekreftCallback) { try { await bekreftCallback(); } catch (err) { alert(err.message); } }
    });
    document.getElementById('bekreft-avbryt').addEventListener('click', () => document.getElementById('bekreft-modal').classList.add('skjult'));
    document.getElementById('bekreft-lukk').addEventListener('click', () => document.getElementById('bekreft-modal').classList.add('skjult'));
    document.getElementById('detaljer-lukk').addEventListener('click', () => document.getElementById('detaljer-modal').classList.add('skjult'));
    document.getElementById('detaljer-modal').addEventListener('click', (e) => { if (e.target === e.currentTarget) document.getElementById('detaljer-modal').classList.add('skjult'); });

    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      console.log('KLIKK:', el?.dataset?.action, el?.dataset?.id, el?.tagName);
      if (!el) return;
      const id = el.dataset.id || undefined;
      if (el.dataset.action === 'visDetaljer') visDetaljer(id);
      if (el.dataset.action === 'settStatus') {
        e.stopPropagation();
        settStatus(id, el.dataset.status, el.dataset.tekst);
      }
      if (el.dataset.action === 'aiOppsummer') {
        e.stopPropagation();
        aiOppsummer(id);
      }
      if (el.dataset.action === 'lastNedVedlegg') {
        e.stopPropagation();
        lastNedVedlegg(id);
      }
      if (el.dataset.action === 'overleveringSammendrag') {
        e.stopPropagation();
        overleveringSammendrag(id);
      }
    });

    let debounceTimer;
    document.getElementById('sok-input').addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(lastSoknader, 300);
    });
    document.getElementById('status-filter').addEventListener('change', lastSoknader);

    await lastSoknader();
    initScrollReveal();
    initVarselBjelle();
