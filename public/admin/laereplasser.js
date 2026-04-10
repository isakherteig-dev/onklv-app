import {
      krevInnlogging, loggUt, hentAlleLaereplasser, hentAlleBrukere,
      lagreAnnonseUtvidet, formaterDato, initScrollReveal, fagomraader, initVarselBjelle, escHtml
    } from '../app.js';

    let bruker = null;
    bruker = await krevInnlogging('admin');
    if (!bruker) { window.location.href = '/login.html'; }

    document.getElementById('nav-navn').textContent = bruker.navn || '';
    document.getElementById('logg-ut-btn').addEventListener('click', async () => { await loggUt(); });

    // Fyll fagomraade filtere
    const fagomraadeFilter = document.getElementById('fagomraade-filter');
    const fagomraadeForm = document.getElementById('a-fagomraade');
    fagomraader.forEach(f => {
      [fagomraadeFilter, fagomraadeForm].forEach(sel => {
        const opt = document.createElement('option');
        opt.value = f; opt.textContent = f;
        sel.appendChild(opt);
      });
    });

    // Hent bedrifter for form
    async function lastBedrifter() {
      const bedrifter = await hentAlleBrukere('bedrift');
      const sel = document.getElementById('a-bedrift');
      sel.innerHTML = '<option value="">Velg bedrift…</option>';
      bedrifter.filter(b => b.godkjent).forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.uid;
        opt.dataset.navn = b.navn;
        opt.textContent = b.navn;
        sel.appendChild(opt);
      });
    }

    async function lastLaereplasser() {
      const params = {};
      const status = document.getElementById('status-filter').value;
      const fag = document.getElementById('fagomraade-filter').value;
      const sok = document.getElementById('sok-input').value.trim();
      if (status) params.status = status;
      if (fag) params.fagomraade = fag;
      if (sok) params.sok = sok;

      const plasser = await hentAlleLaereplasser(params);
      document.getElementById('antall-tekst').textContent = `${plasser.length} læreplasser`;

      const tbody = document.getElementById('laereplasser-tbody');
      if (!plasser.length) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="tom-tilstand"><div class="tom-tilstand-ikon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg></div><h3>Ingen læreplasser funnet</h3></div></td></tr>`;
        return;
      }
      tbody.innerHTML = plasser.map(p => `
        <tr>
          <td><strong>${escHtml(p.tittel)}</strong></td>
          <td>${escHtml(p.bedrift_navn || p.bedrift_naam || '—')}</td>
          <td>${escHtml(p.fagomraade || p.bransje || '—')}</td>
          <td>${escHtml(p.sted || '—')}</td>
          <td>${formaterDato(p.frist)}</td>
          <td><span class="badge badge-blaa">${p.antall_soknader || 0}</span></td>
          <td><span class="badge ${p.aktiv ? 'badge-godkjent' : 'badge-graa'}">${p.aktiv ? 'Aktiv' : 'Inaktiv'}</span></td>
          <td>
            <button class="btn-mini btn-mini-roed" onclick="slettLaereplassklikk(${p.id})">Slett</button>
          </td>
        </tr>`).join('');
    }

    window.slettLaereplassklikk = async function(id) {
      if (!confirm('Er du sikker på at du vil slette denne læreplassen? Alle søknader knyttet til den vil også slettes.')) return;
      try {
        const { getToken } = await import('../app.js');
        const token = await getToken();
        const res = await fetch(`/api/admin/laereplasser/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) { const j = await res.json(); throw new Error(j.feil); }
        await lastLaereplasser();
      } catch (err) { alert(err.message); }
    };

    document.getElementById('ny-annonse-btn').addEventListener('click', async () => {
      await lastBedrifter();
      document.getElementById('annonse-form').reset();
      document.getElementById('annonse-varsel').classList.add('skjult');
      document.getElementById('annonse-modal').classList.remove('skjult');
    });

    document.getElementById('annonse-lukk').addEventListener('click', () => document.getElementById('annonse-modal').classList.add('skjult'));
    document.getElementById('annonse-modal').addEventListener('click', (e) => { if (e.target === e.currentTarget) document.getElementById('annonse-modal').classList.add('skjult'); });

    document.getElementById('annonse-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('annonse-send-btn');
      btn.disabled = true; btn.textContent = 'Publiserer…';

      try {
        const bedriftSel = document.getElementById('a-bedrift');
        const valgtOpt = bedriftSel.options[bedriftSel.selectedIndex];
        await lagreAnnonseUtvidet({
          tittel: document.getElementById('a-tittel').value.trim(),
          fagomraade: document.getElementById('a-fagomraade').value,
          sted: document.getElementById('a-sted').value.trim(),
          beskrivelse: document.getElementById('a-beskrivelse').value.trim(),
          frist: document.getElementById('a-frist').value,
          antall_plasser: parseInt(document.getElementById('a-antall').value) || 1,
          bedrift_user_id: bedriftSel.value,
          bedrift_navn: valgtOpt?.dataset.navn || ''
        });
        document.getElementById('annonse-modal').classList.add('skjult');
        await lastLaereplasser();
        const toast = document.createElement('div');
        toast.className = 'toast'; toast.textContent = 'Læreplass publisert!';
        document.body.appendChild(toast); setTimeout(() => toast.remove(), 4000);
      } catch (err) {
        document.getElementById('annonse-varsel').className = 'varsel varsel-feil';
        document.getElementById('annonse-varsel').textContent = err.message;
        document.getElementById('annonse-varsel').classList.remove('skjult');
      } finally { btn.disabled = false; btn.textContent = 'Publiser'; }
    });

    let debounce;
    document.getElementById('sok-input').addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(lastLaereplasser, 300); });
    document.getElementById('status-filter').addEventListener('change', lastLaereplasser);
    document.getElementById('fagomraade-filter').addEventListener('change', lastLaereplasser);

    await lastLaereplasser();
    initScrollReveal();
    initVarselBjelle();
