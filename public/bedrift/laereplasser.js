import {
      krevInnlogging, loggUt, hentMineAnnonser, lagreAnnonseUtvidet, oppdaterAnnonse, slettAnnonse,
      formaterDato, initScrollReveal, fagomraader, initVarselBjelle, escHtml
    } from '../app.js';

    let bruker = null;
    let annonser = [];
    let redigererAnnonseId = null;
    bruker = await krevInnlogging('bedrift');
    if (!bruker) { window.location.href = '/login.html'; }

    document.getElementById('nav-navn').textContent = bruker.navn || '';
    document.getElementById('logg-ut-btn').addEventListener('click', async () => { await loggUt(); });

    // Fyll fagomraade-select
    const fagSelect = document.getElementById('a-fagomraade');
    fagomraader.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f; opt.textContent = f;
      fagSelect.appendChild(opt);
    });

    // Sett min-dato for frist
    const fristInput = document.getElementById('a-frist');
    const standardFristMin = new Date().toISOString().split('T')[0];
    fristInput.min = standardFristMin;

    function oppdaterAnnonseModalTekst() {
      document.getElementById('annonse-modal-tittel').textContent = redigererAnnonseId ? 'Rediger læreplass' : 'Legg ut ny læreplass';
      document.getElementById('annonse-send-btn').textContent = redigererAnnonseId ? 'Lagre endringer' : 'Publiser læreplass';
    }

    function fyllAnnonseSkjema(annonse = {}) {
      document.getElementById('a-tittel').value = annonse.tittel || '';
      document.getElementById('a-fagomraade').value = annonse.fagomraade || '';
      document.getElementById('a-sted').value = annonse.sted || '';
      document.getElementById('a-beskrivelse').value = annonse.beskrivelse || '';
      document.getElementById('a-krav').value = annonse.krav || '';
      document.getElementById('a-antall').value = annonse.antall_plasser || 1;
      document.getElementById('a-start').value = annonse.start_dato || '';
      document.getElementById('a-frist').value = annonse.frist || '';
      document.getElementById('a-kontaktperson').value = annonse.kontaktperson || '';
      document.getElementById('a-kontaktepost').value = annonse.kontakt_epost || '';

      if (annonse.frist && annonse.frist < standardFristMin) {
        fristInput.min = annonse.frist;
        return;
      }
      fristInput.min = standardFristMin;
    }

    function apneAnnonseModal(annonse = null) {
      redigererAnnonseId = annonse ? String(annonse.id) : null;
      document.getElementById('annonse-form').reset();
      document.getElementById('annonse-varsel').classList.add('skjult');
      fyllAnnonseSkjema(annonse || {});
      oppdaterAnnonseModalTekst();
      document.getElementById('annonse-modal').classList.remove('skjult');
    }

    function lukkAnnonseModal() {
      redigererAnnonseId = null;
      document.getElementById('annonse-form').reset();
      document.getElementById('annonse-varsel').classList.add('skjult');
      fristInput.min = standardFristMin;
      oppdaterAnnonseModalTekst();
      document.getElementById('annonse-modal').classList.add('skjult');
    }

    async function lastAnnonser() {
      annonser = await hentMineAnnonser();
      document.getElementById('antall-tekst').textContent = `${annonser.length} læreplasser registrert`;

      const container = document.getElementById('annonser-liste');
      if (!annonser.length) {
        container.innerHTML = `
          <div class="tom-tilstand" style="grid-column:1/-1;">
            <div class="tom-tilstand-ikon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
            <h3>Ingen læreplasser ennå</h3>
            <p>Klikk på "Legg ut ny læreplass" for å publisere din første annonse.</p>
          </div>`;
        return;
      }

      container.innerHTML = annonser.map(a => `
        <div class="kort">
          <div class="kort-header">
            <div>
              <div class="kort-tittel">${escHtml(a.tittel)}</div>
              <div class="kort-undertittel">${escHtml(a.fagomraade || a.bransje || '')}</div>
            </div>
            <span class="badge ${a.aktiv ? 'badge-godkjent' : 'badge-graa'}">${a.aktiv ? 'Aktiv' : 'Inaktiv'}</span>
          </div>
          <div style="margin:0.75rem 0;font-size:0.85rem;color:var(--farge-tekst-sekundaer);">
            ${a.sted ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg> ${escHtml(a.sted)} &nbsp;·&nbsp; ` : ''}Frist: ${formaterDato(a.frist)}
          </div>
          <div class="kort-footer">
            <span class="badge badge-blaa">${a.antall_soknader || 0} søknader</span>
            <div class="tabell-handlinger">
              <button class="btn-mini btn-mini-blaa rediger-btn" data-id="${escHtml(String(a.id))}">Rediger</button>
              <button class="btn-mini btn-mini-roed slett-btn" data-id="${escHtml(String(a.id))}">Slett</button>
            </div>
          </div>
        </div>`).join('');
    }

    function redigerKlikk(id) {
      const annonse = annonser.find((a) => String(a.id) === String(id));
      if (!annonse) return;
      apneAnnonseModal(annonse);
    }

    async function slettKlikk(id) {
      if (!confirm('Er du sikker på at du vil slette denne læreplassen?')) return;
      try {
        await slettAnnonse(id);
        await lastAnnonser();
      } catch (err) {
        alert(err.message);
      }
    }

    document.addEventListener('click', (e) => {
      const redigerBtn = e.target.closest('.rediger-btn');
      if (redigerBtn) { redigerKlikk(redigerBtn.dataset.id); return; }

      const slettBtn = e.target.closest('.slett-btn');
      if (slettBtn) { slettKlikk(slettBtn.dataset.id); return; }
    });

    document.getElementById('ny-annonse-btn').addEventListener('click', () => {
      apneAnnonseModal();
    });

    document.getElementById('annonse-lukk-btn').addEventListener('click', () => {
      lukkAnnonseModal();
    });
    document.getElementById('annonse-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) lukkAnnonseModal();
    });

    document.getElementById('annonse-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('annonse-send-btn');
      btn.disabled = true;
      btn.textContent = redigererAnnonseId ? 'Lagrer…' : 'Publiserer…';

      try {
        const annonseData = {
          tittel: document.getElementById('a-tittel').value.trim(),
          fagomraade: document.getElementById('a-fagomraade').value,
          sted: document.getElementById('a-sted').value.trim(),
          beskrivelse: document.getElementById('a-beskrivelse').value.trim(),
          krav: document.getElementById('a-krav').value.trim(),
          antall_plasser: parseInt(document.getElementById('a-antall').value) || 1,
          start_dato: document.getElementById('a-start').value || '',
          frist: document.getElementById('a-frist').value,
          kontaktperson: document.getElementById('a-kontaktperson').value.trim(),
          kontakt_epost: document.getElementById('a-kontaktepost').value.trim()
        };

        if (redigererAnnonseId) {
          await oppdaterAnnonse(redigererAnnonseId, annonseData);
        } else {
          await lagreAnnonseUtvidet(annonseData);
        }

        const varRedigering = !!redigererAnnonseId;
        lukkAnnonseModal();
        await lastAnnonser();
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = varRedigering ? 'Læreplassen er oppdatert!' : 'Læreplassen er publisert!';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
      } catch (err) {
        document.getElementById('annonse-varsel').className = 'varsel varsel-feil';
        document.getElementById('annonse-varsel').textContent = err.message;
        document.getElementById('annonse-varsel').classList.remove('skjult');
      } finally {
        btn.disabled = false;
        oppdaterAnnonseModalTekst();
      }
    });

    await lastAnnonser();
    initScrollReveal();
    initVarselBjelle();
