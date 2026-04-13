import {
      krevInnlogging,
      hentLaereplasser,
      hentSoknaderLaerling,
      sendSoknadFull,
      oppdaterBruker,
      beregnProfilkomplettering,
      formaterDato,
      statusTekst,
      statusBadgeKlasse,
      initialFra,
      visFeilmelding,
      visBekreftelse,
      loggUt,
      initScrollReveal,
      initVarselBjelle,
      getToken,
      slettMinKonto,
      escHtml
    } from '../app.js';
    initScrollReveal();

    // ===== AUTH GUARD =====
    const bruker = await krevInnlogging('laerling');
    if (!bruker) throw new Error('redirect');
    const MAKS_CV_STORRELSE = 5 * 1024 * 1024;
    const TILLATTE_CV_TYPER = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    const TILLATTE_CV_ENDINGER = ['.pdf', '.docx'];

    // ===== PERSONALISERING =====
    document.getElementById('nav-navn').textContent = bruker.navn;
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
    document.getElementById('hilsen').textContent = `Hei, ${bruker.navn.split(' ')[0]}!`;
    document.getElementById('hilsen-tekst').textContent =
      `Her er læreplasser tilpasset ${bruker.utdanningsprogram || 'deg'}.`;
    const profilAv = document.getElementById('profil-avatar');
    if (bruker.avatar_url) {
      profilAv.innerHTML = '';
      profilAv.style.overflow = 'hidden';
      const img = document.createElement('img');
      img.src = bruker.avatar_url;
      img.alt = bruker.navn || '';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
      img.onerror = () => { profilAv.textContent = initialFra(bruker.navn); profilAv.style.overflow = ''; };
      profilAv.appendChild(img);
    } else {
      profilAv.textContent = initialFra(bruker.navn);
    }
    document.getElementById('profil-navn').textContent = bruker.navn;
    document.getElementById('profil-program').textContent =
      (bruker.utdanningsprogram || '—') + (bruker.skole ? ' · ' + bruker.skole : '');
    document.getElementById('program-badge').textContent =
      bruker.utdanningsprogram ? 'Basert på ' + bruker.utdanningsprogram : 'Alle programmer';

    function oppdaterProfildisplay(b) {
      const pst = beregnProfilkomplettering(b);
      document.getElementById('profil-prosent').textContent = pst + '%';
      document.getElementById('profil-fyll').style.width = pst + '%';
      document.getElementById('profil-tips').textContent = b.cv_lastet_opp
        ? (b.bio ? 'Profilen ser bra ut!' : 'Legg til en bio for å skille deg ut')
        : 'Last opp CV for å øke synligheten din overfor bedrifter';
    }
    oppdaterProfildisplay(bruker);

    // ===== SCROLL =====
    window.scrollTil = function(id) {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // ===== LÆREPLASSER =====
    async function lastLaereplasser(aiScorer = {}) {
      const plasser = await hentLaereplasser();
      const container = document.getElementById('laereplasser-liste');

      // Sorter etter AI-score hvis tilgjengelig
      const harScorer = Object.keys(aiScorer).length > 0;
      if (harScorer) {
        plasser.sort((a, b) => (aiScorer[b.id]?.score ?? 0) - (aiScorer[a.id]?.score ?? 0));
      }

      container.innerHTML = plasser.map(p => {
        const ai = aiScorer[p.id];
        const scoreFarge = ai ? (ai.score >= 70 ? '#16a34a' : ai.score >= 40 ? '#d97706' : '#6b7280') : '';
        return `
        <div class="kort">
          <div class="kort-header">
            <div>
              <div class="kort-tittel">${escHtml(p.tittel)}</div>
              <div class="kort-undertittel">${escHtml(p.bedrift_navn)}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.35rem;">
              <span class="badge badge-blaa">${p.antall_plasser} plass${p.antall_plasser !== 1 ? 'er' : ''}</span>
              ${ai ? `<span style="font-size:0.75rem;font-weight:600;color:${scoreFarge};">${ai.score}% match</span>` : ''}
            </div>
          </div>
          ${ai ? `<p style="font-size:0.78rem;color:${scoreFarge};background:#f0fdf4;border-radius:6px;padding:0.4rem 0.6rem;margin-bottom:0.75rem;">${escHtml(ai.begrunnelse)}</p>` : ''}
          <p style="font-size: 0.875rem; color: var(--farge-tekst-sekundaer); margin-bottom: 1rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
            ${escHtml(p.beskrivelse)}
          </p>
          <div style="display: flex; gap: 1rem; font-size: 0.8rem; color: var(--farge-tekst-sekundaer); margin-bottom: 1rem; flex-wrap: wrap;">
            <span>${escHtml(p.sted)}</span>
            <span>Frist: ${formaterDato(p.frist)}</span>
            <span>${escHtml(p.bransje)}</span>
          </div>
          <button
            class="btn btn-primary btn-liten"
            data-action="åpneSøknadModal"
            data-id="${escHtml(String(p.id))}"
            data-tittel="${escHtml(p.tittel)}"
            data-bedrift="${escHtml(p.bedrift_navn)}"
            style="width: 100%;"
          >Søk nå →</button>
        </div>`;
      }).join('');
    }

    // ===== SØKNADER =====
    async function lastSoknader() {
      const soknader = await hentSoknaderLaerling();
      const container = document.getElementById('soknader-liste');
      const antall = document.getElementById('antall-soknader');
      if (!container) return;

      if (antall) antall.textContent = `${soknader.length} søknad${soknader.length !== 1 ? 'er' : ''}`;

      if (soknader.length === 0) {
        container.innerHTML = `
          <div class="kort" style="text-align: center; padding: 2.5rem;">
            <h3 style="margin-bottom: 0.5rem;">Ingen søknader ennå</h3>
            <p>Finn en lærlingplass og send din første søknad!</p>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="tabell-wrapper">
          <table>
            <thead>
              <tr>
                <th>Lærlingplass</th>
                <th>Bedrift</th>
                <th>Sendt</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${soknader.map(s => `
                <tr>
                  <td><strong>${escHtml(s.tittel)}</strong></td>
                  <td>${escHtml(s.bedrift_navn)}</td>
                  <td style="font-size: 0.875rem; color: var(--farge-tekst-sekundaer);">${formaterDato(s.sendt_dato)}</td>
                  <td><span class="${statusBadgeKlasse(s.status)}">${statusTekst(s.status)}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // ===== SØKNAD-MODAL =====
    let valgtLaerplass = null;

    function åpneSøknadModal(id, tittel, bedrift) {
      valgtLaerplass = { id, tittel, bedrift };
      document.getElementById('modal-tittel').textContent = `Søk: ${tittel}`;
      document.getElementById('modal-bedrift').textContent = `Bedrift: ${bedrift}`;
      document.getElementById('varsel-modal').classList.add('skjult');
      document.getElementById('soknad-form').reset();
      nullstillCvFelt();
      document.getElementById('soknad-modal').classList.remove('skjult');
      document.getElementById('soknad-melding').focus();
    };

    function oppdaterCvTekst(fil) {
      document.getElementById('soknad-cv-navn').textContent = fil ? `Valgt fil: ${fil.name}` : 'Ingen fil valgt';
    }

    function nullstillCvFelt() {
      const input = document.getElementById('soknad-cv');
      input.value = '';
      oppdaterCvTekst(null);
    }

    function validerCvFil(fil) {
      if (!fil) return null;

      const filnavn = fil.name || '';
      const ext = filnavn.slice(filnavn.lastIndexOf('.')).toLowerCase();
      const gyldigExt = TILLATTE_CV_ENDINGER.includes(ext);
      const gyldigType = !fil.type || TILLATTE_CV_TYPER.includes(fil.type);

      if (!gyldigExt || !gyldigType) {
        return 'Kun PDF og DOCX-filer er tillatt.';
      }
      if (fil.size > MAKS_CV_STORRELSE) {
        return 'CV-en er for stor. Maks filstørrelse er 5 MB.';
      }

      return null;
    }

    function lukkModal() {
      document.getElementById('soknad-modal').classList.add('skjult');
      valgtLaerplass = null;
    }

    document.getElementById('modal-lukk').addEventListener('click', lukkModal);
    document.getElementById('modal-avbryt').addEventListener('click', lukkModal);
    document.getElementById('soknad-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) lukkModal();
    });

    document.getElementById('soknad-cv').addEventListener('change', (e) => {
      const fil = e.target.files[0] || null;
      const feil = validerCvFil(fil);
      if (feil) {
        e.target.value = '';
        oppdaterCvTekst(null);
        const el = document.getElementById('varsel-modal');
        el.className = 'varsel varsel-feil';
        el.textContent = feil;
        el.classList.remove('skjult');
        return;
      }

      oppdaterCvTekst(fil);
      if (fil) {
        document.getElementById('varsel-modal').classList.add('skjult');
      }
    });

    document.getElementById('soknad-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const melding = document.getElementById('soknad-melding').value.trim();
      const cvFil = document.getElementById('soknad-cv').files[0] || null;
      if (!melding) return;

      const vedleggFeil = validerCvFil(cvFil);
      if (vedleggFeil) {
        const el = document.getElementById('varsel-modal');
        el.className = 'varsel varsel-feil';
        el.textContent = vedleggFeil;
        el.classList.remove('skjult');
        return;
      }

      const btn = document.getElementById('send-soknad-btn');
      btn.disabled = true;
      btn.textContent = 'Sender…';

      try {
        let payload;
        if (cvFil) {
          const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(cvFil);
          });
          payload = {
            laerplass_id: valgtLaerplass.id, melding,
            vedlegg_base64: base64,
            vedlegg_filnavn: cvFil.name,
            vedlegg_type: cvFil.type
          };
        } else {
          payload = { laerplass_id: valgtLaerplass.id, melding };
        }

        await sendSoknadFull(payload);
        const tittel = valgtLaerplass.tittel;
        lukkModal();
        nullstillCvFelt();
        visBekreftelse(`Søknaden din til «${tittel}» er sendt!`);
        await lastSoknader();
      } catch (err) {
        const el = document.getElementById('varsel-modal');
        el.className = 'varsel varsel-feil';
        el.textContent = err.message || 'Noe gikk galt. Prøv igjen.';
        el.classList.remove('skjult');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Send søknad →';
      }
    });

    // ===== REDIGER PROFIL MODAL =====
    function lukkProfilModal() {
      document.getElementById('profil-modal').classList.add('skjult');
    }

    document.getElementById('profil-modal-lukk').addEventListener('click', lukkProfilModal);
    document.getElementById('profil-modal-avbryt').addEventListener('click', lukkProfilModal);
    document.getElementById('profil-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) lukkProfilModal();
    });

    document.getElementById('profil-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const nyttNavn = document.getElementById('edit-navn').value.trim();
      const nyBio = document.getElementById('edit-bio').value.trim();
      const el = document.getElementById('varsel-profil');

      if (!nyttNavn) {
        el.className = 'varsel varsel-feil';
        el.textContent = 'Navn kan ikke være tomt';
        el.classList.remove('skjult');
        return;
      }

      try {
        const oppdatert = await oppdaterBruker({ navn: nyttNavn, bio: nyBio });
        document.getElementById('profil-navn').textContent = oppdatert.navn;
        document.getElementById('nav-navn').textContent = oppdatert.navn;
        document.getElementById('hilsen').textContent = `Hei, ${oppdatert.navn.split(' ')[0]}!`;
        document.getElementById('profil-avatar').textContent = initialFra(oppdatert.navn);
        oppdaterProfildisplay(oppdatert);
        lukkProfilModal();
        visBekreftelse('Profilen er oppdatert!');
      } catch (err) {
        el.className = 'varsel varsel-feil';
        el.textContent = err.message || 'Kunne ikke oppdatere profilen.';
        el.classList.remove('skjult');
      }
    });

    function apneSlettKontoModal() {
      document.getElementById('slett-konto-feil').classList.add('skjult');
      document.getElementById('slett-konto-modal').classList.remove('skjult');
    }

    function lukkSlettKontoModal() {
      document.getElementById('slett-konto-modal').classList.add('skjult');
    }

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

    // ===== VEILEDNING =====
    document.getElementById('veiledning-btn').addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('veiledning-modal').classList.remove('skjult');
    });
    document.getElementById('veiledning-lukk').addEventListener('click', () => {
      document.getElementById('veiledning-modal').classList.add('skjult');
    });
    document.getElementById('veiledning-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) document.getElementById('veiledning-modal').classList.add('skjult');
    });

    // ===== AI: PROFILTIPS =====
    document.getElementById('ai-tips-btn').addEventListener('click', async () => {
      const boks = document.getElementById('ai-tips-boks');
      const innhold = document.getElementById('ai-tips-innhold');
      const btn = document.getElementById('ai-tips-btn');

      boks.style.display = 'block';
      innhold.textContent = 'Analyserer profilen din…';
      btn.disabled = true;

      try {
        const token = await getToken();
        const res = await fetch('/api/ai/tips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.feil || 'AI-tjenesten feilet');
        innhold.innerHTML = data.tips.map((t, i) =>
          `<p style="margin:0 0 0.5rem;"><strong>${i + 1}.</strong> ${escHtml(t)}</p>`
        ).join('');
      } catch (err) {
        innhold.textContent = err.message || 'Noe gikk galt. Prøv igjen.';
      } finally {
        btn.disabled = false;
      }
    });

    // ===== AI: MATCHING =====
    let aiScorer = {};
    document.getElementById('ai-match-btn').addEventListener('click', async () => {
      const btn = document.getElementById('ai-match-btn');
      btn.disabled = true;
      btn.textContent = 'Matcher…';

      try {
        const token = await getToken();
        const res = await fetch('/api/ai/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.feil || 'AI-matching feilet');

        aiScorer = {};
        (data.resultater || []).forEach(r => { aiScorer[r.laerplass_id] = r; });

        await lastLaereplasser(aiScorer);
        btn.textContent = 'AI-match oppdatert';
      } catch (err) {
        visFeilmelding(err.message || 'AI-matching feilet');
        btn.disabled = false;
        btn.textContent = 'Finn AI-match';
      }
    });

    // ===== GODKJENT BANNER =====
    async function visGodkjentBanner() {
      const soknader = await hentSoknaderLaerling();
      const godkjentSoknad = soknader.find(s => s.status === 'godkjent');
      if (!godkjentSoknad) return;
      const varselEl = document.getElementById('varsel');
      varselEl.innerHTML = `<div style="background:#F0FDF4;border:2px solid #16a34a;border-radius:var(--radius);padding:1.5rem;">
  <p style="font-size:1.15rem;font-weight:600;color:#15803d;margin:0 0 0.5rem;">Du har fått læreplassen!</p>
  <p style="margin:0 0 0.75rem;font-size:0.95rem;color:#166534;line-height:1.7;">
    Gratulerer med <strong>${escHtml(godkjentSoknad.tittel || godkjentSoknad.bedrift_navn || 'læreplassen')}</strong>!
    Opplæringskontoret i Vestland tar det herfra — du vil motta en SMS med invitasjon til fagbrev.io på telefonnummeret ditt.
  </p>
  <a href="/laerling/mine-soknader.html" class="btn btn-liten" style="background:#16a34a;color:white;border:none;">Se søknaden din →</a>
</div>`;
      varselEl.classList.remove('skjult');
    }

    // ===== INIT =====
    lastLaereplasser();
    lastSoknader();
    visGodkjentBanner();
    initVarselBjelle();

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action="åpneSøknadModal"]');
  if (el) åpneSøknadModal(el.dataset.id, el.dataset.tittel, el.dataset.bedrift);
});

document.querySelectorAll('[data-scroll-til]').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTil(el.dataset.scrollTil);
  });
});
