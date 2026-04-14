import {
      krevInnlogging, loggUt, hentLaereplasser, sendSoknadFull,
      statusTekst, formaterDato, initScrollReveal, fagomraader,
      visFeilmelding, visBekreftelse, initVarselBjelle, initialFra,
      getToken, escHtml
    } from '../app.js';

    let bruker = null;
    let allePlasser = [];
    let minneSoknaderIds = new Set();
    let filterRenderTimeout = null;
    const MAKS_CV_STORRELSE = 5 * 1024 * 1024;
    const TILLATTE_CV_TYPER = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    const TILLATTE_CV_ENDINGER = ['.pdf', '.docx'];
    const KJENTE_STEDER = ['Bergen', 'Voss', 'Stord', 'Odda', 'Førde', 'Sogndal'];
    const FAGOMRAADE_ALIASER = {
      Elektrofag: 'Elektro og datateknologi',
      Helsefag: 'Helse- og oppvekstfag',
      Byggfag: 'Bygg- og anleggsteknikk',
      Restaurantfag: 'Restaurant- og matfag',
      'Salg og service': 'Salg, service og reiseliv',
      'Teknologi og industrifag': 'Teknologi- og industrifag',
      'IT og medieproduksjon': 'Informasjonsteknologi og medieproduksjon'
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

    // Fyll fagomraade-filter
    const fagSelect = document.getElementById('filter-fagomraade');
    fagomraader.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f; opt.textContent = f;
      fagSelect.appendChild(opt);
    });

    const stedSelect = document.getElementById('filter-sted');
    [...KJENTE_STEDER, 'Annet'].forEach(sted => {
      const opt = document.createElement('option');
      opt.value = sted;
      opt.textContent = sted === 'Annet' ? 'Annet sted' : sted;
      stedSelect.appendChild(opt);
    });

    // Hent mine søknader (for å vise "Allerede søkt"-badge)
    try {
      const { getToken } = await import('../app.js');
      const token = await getToken();
      const res = await fetch('/api/soknader/mine', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const mine = await res.json();
        mine.forEach(s => minneSoknaderIds.add(String(s.laerplass_id)));
      }
    } catch {}

    allePlasser = await hentLaereplasser();
    const bransjeSelect = document.getElementById('filter-bransje');
    [...new Set(allePlasser.map((plass) => (plass.bransje || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'nb'))
      .forEach((bransje) => {
        const opt = document.createElement('option');
        opt.value = bransje;
        opt.textContent = bransje;
        bransjeSelect.appendChild(opt);
      });
    visPlasser(allePlasser);
    oppdaterResultatTekst(allePlasser.length, allePlasser.length);
    haandterSokFraUrl();

    document.getElementById('search-input').addEventListener('input', filterLaereplasser);
    document.getElementById('filter-fagomraade').addEventListener('change', filterLaereplasser);
    document.getElementById('filter-sted').addEventListener('change', filterLaereplasser);
    document.getElementById('filter-bransje').addEventListener('change', filterLaereplasser);
    document.getElementById('reset-filters-btn').addEventListener('click', resetFilters);

    function hentFagtekst(plass) {
      return (plass.fagomraade || plass.bransje || 'Annet').trim();
    }

    function hentStedtekst(plass) {
      return (plass.sted || '').trim();
    }

    function hentFagFilterVerdi(plass) {
      const fagtekst = hentFagtekst(plass);
      return FAGOMRAADE_ALIASER[fagtekst] || fagtekst;
    }

    function normaliserTekst(tekst) {
      return (tekst || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/æ/g, 'ae')
        .replace(/ø/g, 'o')
        .replace(/å/g, 'a');
    }

    function fjernQueryParameter(navn) {
      const url = new URL(window.location.href);
      url.searchParams.delete(navn);
      history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }

    function oppdaterResultatTekst(antall, totalt) {
      const countEl = document.getElementById('result-count');
      if (antall === totalt) {
        countEl.textContent = `Viser alle læreplasser (${antall})`;
        return;
      }
      countEl.textContent = `Viser ${antall} av ${totalt} læreplasser`;
    }

    function animertVisPlasser(plasser) {
      const container = document.getElementById('laereplasser-liste');
      const eksisterendeKort = container.querySelectorAll('.laereplass-kort, .tom-tilstand');

      if (!eksisterendeKort.length) {
        visPlasser(plasser, { animer: true });
        return;
      }

      eksisterendeKort.forEach((kort) => kort.classList.add('kort-filter-ut'));
      clearTimeout(filterRenderTimeout);
      filterRenderTimeout = setTimeout(() => {
        visPlasser(plasser, { animer: true });
      }, 180);
    }

    function filterLaereplasser() {
      const soketekst = normaliserTekst(document.getElementById('search-input').value.trim());
      const fagomraade = document.getElementById('filter-fagomraade').value;
      const sted = document.getElementById('filter-sted').value;
      const bransje = document.getElementById('filter-bransje').value;

      const filtrert = allePlasser.filter((plass) => {
        const fagtekst = hentFagtekst(plass);
        const fagFilterVerdi = hentFagFilterVerdi(plass);
        const stedtekst = hentStedtekst(plass);
        const matcherSok = !soketekst
          || normaliserTekst(plass.tittel).includes(soketekst)
          || normaliserTekst(plass.bedrift_navn).includes(soketekst)
          || normaliserTekst(fagtekst).includes(soketekst)
          || normaliserTekst(fagFilterVerdi).includes(soketekst)
          || normaliserTekst(plass.bransje).includes(soketekst)
          || normaliserTekst(plass.beskrivelse).includes(soketekst);

        const matcherFag = !fagomraade
          || (fagomraade === 'Annet'
            ? !fagomraader.includes(fagFilterVerdi)
            : fagFilterVerdi === fagomraade);

        const matcherSted = !sted
          || (sted === 'Annet'
            ? !!stedtekst && !KJENTE_STEDER.includes(stedtekst)
            : stedtekst === sted);

        const matcherBransje = !bransje || (plass.bransje || '').trim() === bransje;

        return matcherSok && matcherFag && matcherSted && matcherBransje;
      });

      oppdaterResultatTekst(filtrert.length, allePlasser.length);
      animertVisPlasser(filtrert);
    }

    function resetFilters() {
      document.getElementById('search-input').value = '';
      document.getElementById('filter-fagomraade').value = '';
      document.getElementById('filter-sted').value = '';
      document.getElementById('filter-bransje').value = '';
      filterLaereplasser();
    }

    function dagertilFrist(fristStr) {
      if (!fristStr) return null;
      const frist = new Date(fristStr + 'T00:00:00');
      const naa = new Date();
      naa.setHours(0,0,0,0);
      return Math.ceil((frist - naa) / (1000 * 60 * 60 * 24));
    }

    function fristBadge(fristStr) {
      const dager = dagertilFrist(fristStr);
      if (dager === null) return '';
      if (dager < 0) return `<span class="frist-badge utlopt">Utløpt</span>`;
      if (dager === 0) return `<span class="frist-badge kritisk">Frist i dag!</span>`;
      if (dager <= 3) return `<span class="frist-badge kritisk">${dager} ${dager === 1 ? 'dag' : 'dager'} igjen</span>`;
      if (dager <= 7) return `<span class="frist-badge snart">${dager} dager igjen</span>`;
      return `<span class="frist-badge ok">Frist: ${formaterDato(fristStr)}</span>`;
    }

    function hentSorteringForPlass(plass) {
      const dager = dagertilFrist(plass.frist);
      if (dager !== null && dager < 0) {
        return { prioritet: 3, fristTid: Number.POSITIVE_INFINITY };
      }

      if (dager !== null && dager <= 3) {
        return { prioritet: 0, fristTid: new Date(`${plass.frist}T00:00:00`).getTime() };
      }

      if (dager !== null) {
        return { prioritet: 1, fristTid: new Date(`${plass.frist}T00:00:00`).getTime() };
      }

      return { prioritet: 2, fristTid: Number.POSITIVE_INFINITY };
    }

    function sorterPlasser(plasser) {
      return [...plasser].sort((a, b) => {
        const sorteringA = hentSorteringForPlass(a);
        const sorteringB = hentSorteringForPlass(b);

        if (sorteringA.prioritet !== sorteringB.prioritet) {
          return sorteringA.prioritet - sorteringB.prioritet;
        }

        if (sorteringA.fristTid !== sorteringB.fristTid) {
          return sorteringA.fristTid - sorteringB.fristTid;
        }

        return String(a.tittel || '').localeCompare(String(b.tittel || ''), 'nb');
      });
    }

    function visPlasser(plasser, { animer = false } = {}) {
      const container = document.getElementById('laereplasser-liste');
      document.getElementById('antall-tekst').textContent = `${allePlasser.length} læreplasser tilgjengelig`;

      if (!plasser.length) {
        container.innerHTML = `
          <div class="tom-tilstand kort-filter-inn" style="grid-column:1/-1;">
            <div class="tom-tilstand-ikon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
            <h3>Ingen læreplasser matcher søket ditt</h3>
            <p>Prøv å endre søket eller nullstille filtrene.</p>
          </div>`;
        return;
      }

      const dager = (p) => dagertilFrist(p.frist);
      const sortertePlasser = sorterPlasser(plasser);

      container.innerHTML = sortertePlasser.map(p => {
        const plassId = String(p.id);
        const utlopt = dager(p) !== null && dager(p) < 0;
        const harSokt = minneSoknaderIds.has(plassId);
        const fagtekst = hentFagtekst(p);
        const fagBadge = fagtekst ? `<span class="badge badge-blaa">${escHtml(fagtekst)}</span>` : '';
        return `
          <div class="kort laereplass-kort${animer ? ' kort-filter-inn' : ''}${utlopt ? ' opacity-50' : ''}">
            <div class="kort-header">
              <div>
                <div class="kort-tittel">${escHtml(p.tittel)}</div>
                <div class="kort-undertittel">${escHtml(p.bedrift_navn || '—')}</div>
              </div>
              ${fagBadge}
            </div>
            <p style="font-size:0.88rem;margin:0.75rem 0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;color:var(--farge-tekst-sekundaer);">${escHtml(p.beskrivelse || 'Ingen beskrivelse tilgjengelig.')}</p>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;margin-bottom:1rem;">
              ${p.sted ? `<span style="font-size:0.82rem;color:var(--olkv-gray);display:inline-flex;align-items:center;gap:3px;"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>${escHtml(p.sted)}</span>` : ''}
              ${fristBadge(p.frist)}
            </div>
            <div class="kort-footer">
              <div></div>
              <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">
                ${p.bedrift_user_id ? `<a href="/bedrift/profil.html?uid=${encodeURIComponent(p.bedrift_user_id)}" class="btn btn-ghost btn-liten">Se bedrift</a>` : ''}
                ${harSokt
                  ? `<span class="badge badge-godkjent">Allerede søkt</span>`
                  : utlopt
                    ? `<span class="badge badge-trukket">Utløpt</span>`
                    : `<button class="btn btn-primary btn-liten sok-naa-btn" data-id="${escHtml(plassId)}" data-tittel="${escHtml(p.tittel || '')}">Søk nå →</button>`
                }
              </div>
            </div>
          </div>`;
      }).join('');
    }

    function haandterSokFraUrl() {
      const sokId = new URLSearchParams(window.location.search).get('sok');
      if (!sokId) return;

      const plass = allePlasser.find((p) => String(p.id) === sokId);
      if (!plass) return;

      const dagerTilFrist = dagertilFrist(plass.frist);
      const utlopt = dagerTilFrist !== null && dagerTilFrist < 0;
      const harSokt = minneSoknaderIds.has(String(plass.id));
      if (utlopt || harSokt) return;

      apneSoknadModal(String(plass.id), plass.tittel || '');
      fjernQueryParameter('sok');
    }

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

    // Modal
    function apneSoknadModal(id, tittel) {
      document.getElementById('soknad-form').reset();
      document.getElementById('soknad-laerplass-id').value = id;
      document.getElementById('modal-laereplasstitle').textContent = `Søk på: ${tittel}`;
      nullstillCvFelt();
      document.getElementById('motivasjon-tegnteller').textContent = '0 tegn';
      document.getElementById('soknad-varsel').classList.add('skjult');
      if (bruker?.navn) document.getElementById('soknad-navn').value = bruker.navn;
      if (bruker?.telefon) document.getElementById('soknad-telefon').value = bruker.telefon;
      if (bruker?.utdanningsprogram) document.getElementById('soknad-vg1').value = bruker.utdanningsprogram;
      document.getElementById('soknad-modal').classList.remove('skjult');
    };

    document.getElementById('soknad-motivasjon').addEventListener('input', (e) => {
      document.getElementById('motivasjon-tegnteller').textContent = `${e.target.value.length} tegn`;
    });

    document.getElementById('soknad-cv').addEventListener('change', (e) => {
      const fil = e.target.files[0] || null;
      const feil = validerCvFil(fil);
      if (feil) {
        e.target.value = '';
        oppdaterCvTekst(null);
        document.getElementById('soknad-varsel').className = 'varsel varsel-feil';
        document.getElementById('soknad-varsel').textContent = feil;
        document.getElementById('soknad-varsel').classList.remove('skjult');
        return;
      }

      oppdaterCvTekst(fil);
      if (fil) {
        document.getElementById('soknad-varsel').classList.add('skjult');
      }
    });

    document.getElementById('modal-lukk-btn').addEventListener('click', () => {
      document.getElementById('soknad-modal').classList.add('skjult');
    });
    document.getElementById('soknad-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) document.getElementById('soknad-modal').classList.add('skjult');
    });

    document.getElementById('soknad-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('soknad-send-btn');
      const motivasjon = document.getElementById('soknad-motivasjon').value.trim();
      const cvFil = document.getElementById('soknad-cv').files[0] || null;
      if (motivasjon.length < 50) {
        document.getElementById('soknad-varsel').className = 'varsel varsel-feil';
        document.getElementById('soknad-varsel').textContent = 'Motivasjonen må være minst 50 tegn.';
        document.getElementById('soknad-varsel').classList.remove('skjult');
        return;
      }
      const telefon = document.getElementById('soknad-telefon').value.trim();
      if (!telefon || !/^\d{8}$/.test(telefon)) {
        document.getElementById('soknad-varsel').className = 'varsel varsel-feil';
        document.getElementById('soknad-varsel').textContent = 'Fyll inn et gyldig telefonnummer (8 siffer).';
        document.getElementById('soknad-varsel').classList.remove('skjult');
        return;
      }
      const vedleggFeil = validerCvFil(cvFil);
      if (vedleggFeil) {
        document.getElementById('soknad-varsel').className = 'varsel varsel-feil';
        document.getElementById('soknad-varsel').textContent = vedleggFeil;
        document.getElementById('soknad-varsel').classList.remove('skjult');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Sender…';

      try {
        const laerplass_id = document.getElementById('soknad-laerplass-id').value;
        const erfaring = document.getElementById('soknad-erfaring').value.trim();
        const vg1 = document.getElementById('soknad-vg1').value.trim();
        const vg2 = document.getElementById('soknad-vg2').value.trim();
        const telefon = document.getElementById('soknad-telefon').value.trim();

        let payload;
        if (cvFil) {
          const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(cvFil);
          });
          payload = {
            laerplass_id, melding: motivasjon, erfaring, vg1, vg2, telefon,
            vedlegg_base64: base64,
            vedlegg_filnavn: cvFil.name,
            vedlegg_type: cvFil.type
          };
        } else {
          payload = { laerplass_id, melding: motivasjon, erfaring, vg1, vg2, telefon };
        }

        await sendSoknadFull(payload);

        const plassId = String(document.getElementById('soknad-laerplass-id').value);
        minneSoknaderIds.add(plassId);

        document.getElementById('soknad-modal').classList.add('skjult');
        nullstillCvFelt();
        filterLaereplasser();

        // Vis toast
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = cvFil ? 'Søknaden din med CV er sendt!' : 'Søknaden din er sendt!';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);

      } catch (err) {
        document.getElementById('soknad-varsel').className = 'varsel varsel-feil';
        document.getElementById('soknad-varsel').textContent = err.message;
        document.getElementById('soknad-varsel').classList.remove('skjult');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Send søknad';
      }
    });

    async function kjorAiMatch() {
      const btn = document.getElementById('ai-match-btn');
      const panel = document.getElementById('ai-match-panel');
      const liste = document.getElementById('ai-match-liste');

      btn.disabled = true;
      btn.textContent = 'Analyserer profilen din…';
      liste.innerHTML = `
        <div class="skeleton" style="height:56px;border-radius:var(--radius);background:rgba(255,255,255,0.15);margin-bottom:0;"></div>
        <div class="skeleton" style="height:56px;border-radius:var(--radius);background:rgba(255,255,255,0.15);margin-bottom:0;"></div>
        <div class="skeleton" style="height:56px;border-radius:var(--radius);background:rgba(255,255,255,0.15);"></div>`;
      panel.classList.remove('skjult');

      try {
        const token = await getToken();
        const res = await fetch('/api/ai/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.feil || 'Noe gikk galt');

        const resultater = (data.resultater || []).slice(0, 5);
        if (!resultater.length) {
          liste.innerHTML = `<p style="opacity:0.8;margin:0;">Ingen læreplasser å matche mot akkurat nå.</p>`;
        } else {
          liste.innerHTML = resultater.map(r => {
            const plass = allePlasser.find(p => p.id === r.laerplass_id);
            if (!plass) return '';
            const scoreFarge = r.score >= 75 ? '#4ade80' : r.score >= 50 ? '#facc15' : '#fb923c';
            return `
              <div style="display:flex;align-items:center;gap:1rem;background:rgba(255,255,255,0.1);border-radius:var(--radius);padding:0.75rem 1rem;flex-wrap:wrap;">
                <div style="text-align:center;min-width:48px;">
                  <div style="font-size:1.2rem;font-weight:600;color:${scoreFarge};">${r.score}</div>
                  <div style="font-size:0.65rem;opacity:0.7;">match</div>
                </div>
                <div style="flex:1;min-width:180px;">
                  <div style="font-weight:600;font-size:0.9rem;">${escHtml(plass.tittel)}</div>
                  <div style="font-size:0.8rem;opacity:0.75;">${escHtml(plass.bedrift_navn || '')} ${plass.sted ? '· ' + escHtml(plass.sted) : ''}</div>
                  <div style="font-size:0.78rem;opacity:0.7;margin-top:2px;">${escHtml(r.begrunnelse || '')}</div>
                </div>
                ${!minneSoknaderIds.has(String(plass.id))
                  ? `<button class="btn btn-primary btn-liten sok-naa-btn" data-id="${escHtml(String(plass.id))}" data-tittel="${escHtml(plass.tittel || '')}" style="flex-shrink:0;">Søk nå →</button>`
                  : `<span class="badge badge-godkjent" style="flex-shrink:0;">Søkt</span>`
                }
              </div>`;
          }).join('');
        }
      } catch (err) {
        liste.innerHTML = `<p style="opacity:0.8;margin:0;">${err.message}</p>`;
      } finally {
        btn.disabled = false;
        btn.textContent = 'AI-anbefalinger for deg';
      }
    };

    function lukkAiMatch() {
      document.getElementById('ai-match-panel').classList.add('skjult');
    }

    document.getElementById('ai-match-btn').addEventListener('click', kjorAiMatch);
    document.getElementById('lukk-ai-match-btn').addEventListener('click', lukkAiMatch);

    document.addEventListener('click', (e) => {
      const sokBtn = e.target.closest('.sok-naa-btn');
      if (sokBtn) apneSoknadModal(sokBtn.dataset.id, sokBtn.dataset.tittel);
    });

    initScrollReveal();
    initVarselBjelle();
