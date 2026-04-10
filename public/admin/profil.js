import {
      krevInnlogging,
      loggUt,
      oppdaterBruker,
      initialFra,
      initScrollReveal,
      initVarselBjelle,
      slettMinKonto,
      escHtml
    } from '../app.js';

    const bruker = await krevInnlogging('admin');
    if (!bruker) throw new Error('redirect');

    document.getElementById('nav-navn').textContent = bruker.navn || '';
    document.getElementById('profil-navn').textContent = bruker.navn || '—';
    document.getElementById('profil-epost').textContent = bruker.epost || '—';
    document.getElementById('edit-navn').value = bruker.navn || '';
    document.getElementById('profil-avatar').textContent = initialFra(bruker.navn);

    document.getElementById('logg-ut-btn').addEventListener('click', () => {
      if (confirm('Er du sikker på at du vil logge ut?')) loggUt();
    });

    // ===== LAGRE NAVN =====
    document.getElementById('lagre-navn-btn').addEventListener('click', async () => {
      const btn = document.getElementById('lagre-navn-btn');
      const varselEl = document.getElementById('profil-varsel');
      const nyttNavn = document.getElementById('edit-navn').value.trim();

      if (!nyttNavn) {
        varselEl.className = 'varsel varsel-feil';
        varselEl.textContent = 'Navn kan ikke være tomt.';
        varselEl.classList.remove('skjult');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Lagrer…';
      varselEl.classList.add('skjult');

      try {
        await oppdaterBruker({ navn: nyttNavn });
        document.getElementById('profil-navn').textContent = nyttNavn;
        document.getElementById('nav-navn').textContent = nyttNavn;
        document.getElementById('profil-avatar').textContent = initialFra(nyttNavn);
        varselEl.className = 'varsel varsel-suksess';
        varselEl.textContent = 'Navn er oppdatert!';
        varselEl.classList.remove('skjult');
      } catch (err) {
        console.error('Feil ved lagring av navn:', err);
        varselEl.className = 'varsel varsel-feil';
        varselEl.textContent = err.message || 'Kunne ikke lagre navn. Prøv igjen.';
        varselEl.classList.remove('skjult');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Lagre navn';
      }
    });

    // ===== SLETT KONTO =====
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
        console.error('Feil ved sletting av konto:', err);
        feilEl.className = 'varsel varsel-feil';
        feilEl.textContent = err.message || 'Kunne ikke slette kontoen din. Prøv igjen.';
        feilEl.classList.remove('skjult');
        btn.disabled = false;
        btn.textContent = 'Ja, slett kontoen min';
      }
    });

    // ===== INIT =====
    initScrollReveal();
    initVarselBjelle();
