import { krevInnlogging, loggUt, getToken, oppdaterBruker, initScrollReveal, initialFra, beregnProfilkomplettering, formaterDato, fagomraader, initVarselBjelle } from '../app.js';

let bruker = null;
let targetBruker = null;
let profil = {};
let editMode = false;
let konversasjonsHistorikk = [];

const params = new URLSearchParams(location.search);
const visUid = params.get('uid');
const matchScore = parseInt(params.get('match'));

document.addEventListener('DOMContentLoaded', async () => {
  bruker = await krevInnlogging();
  if (!bruker) return;

  const erEier = !visUid || visUid === bruker.uid;
  const kanSe = erEier || bruker.rolle === 'admin' || bruker.rolle === 'bedrift';

  if (!kanSe) {
    location.href = '/';
    return;
  }

  const targetUid = visUid && visUid !== bruker.uid ? visUid : bruker.uid;
  const token = await getToken();

  if (visUid && visUid !== bruker.uid) {
    // Hent brukerdata for den vi ser på via backend API
    try {
      const res = await fetch(`/api/auth/bruker/${encodeURIComponent(targetUid)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        targetBruker = { uid: targetUid, ...await res.json() };
      } else {
        targetBruker = { uid: targetUid, navn: 'Ukjent lærling', epost: '', utdanningsprogram: '', rolle: 'laerling' };
      }
    } catch (e) {
      console.error('Hent targetBruker feil:', e);
      targetBruker = { uid: targetUid, navn: 'Ukjent lærling', epost: '', utdanningsprogram: '', rolle: 'laerling' };
    }
  } else {
    targetBruker = bruker;
  }

  // Hent profildata via backend-API (Admin SDK — trygt og autentisert)
  try {
    const qs = targetUid !== bruker.uid ? `?uid=${encodeURIComponent(targetUid)}` : '';
    const res = await fetch(`/api/auth/profildata${qs}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    profil = res.ok ? await res.json() : {};
  } catch (e) {
    console.warn('Ingen profildata ennå:', e);
    profil = {};
  }

  document.getElementById('nav-navn').textContent = bruker.navn || '';
  const navAvatar = document.getElementById('nav-avatar');
  if (navAvatar) navAvatar.textContent = initialFra(bruker.navn);

  if (erEier) {
    initVarselBjelle('varsel-bjelle', 'varsel-dropdown');
  } else {
    document.getElementById('varsel-bjelle-wrapper').style.display = 'none';
  }

  if (!erEier) {
    document.querySelectorAll('.edit-owner-only').forEach(el => el.classList.add('skjult'));
  } else {
    document.getElementById('toggleEditBtn').addEventListener('click', toggleEdit);
    document.getElementById('toggleEditBtnMobil').addEventListener('click', toggleEdit);
  }

  renderProfilhode();
  renderBio();
  renderReferanser();
  renderFerdigheter();
  renderPortefolje();
  renderMotiveasjon();
  renderTidslinje();
  renderTilgjengelighet();
  renderCv();
  renderVideo();
  initAiChat();
  setTimeout(() => {
    initSkillBarObserver();
  }, 300);

  if (!isNaN(matchScore) && matchScore >= 1 && matchScore <= 100) {
    const meter = document.getElementById('matchMeter');
    meter.classList.remove('skjult');
    const circumference = 2 * Math.PI * 34;
    const offset = circumference * (1 - matchScore / 100);
    setTimeout(() => {
      document.getElementById('matchCircle').style.strokeDashoffset = offset;
    }, 500);
    document.getElementById('matchText').textContent = matchScore + '%';
  }
});

function renderProfilhode() {
  const tb = targetBruker;

  // Vis avatar — enten bilde fra Firebase Storage eller initialer
  const av = document.getElementById('profil-avatar');
  if (tb.avatar_url) {
    av.innerHTML = '';
    av.style.overflow = 'hidden';
    const img = document.createElement('img');
    img.src = tb.avatar_url;
    img.alt = tb.navn || 'Profilbilde';
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
    img.onerror = () => { av.innerHTML = initialFra(tb.navn || '?'); av.style.overflow = ''; };
    av.appendChild(img);

    const navAv = document.getElementById('nav-avatar');
    if (navAv && tb.avatar_url) {
      navAv.innerHTML = '';
      navAv.style.overflow = 'hidden';
      const navImg = document.createElement('img');
      navImg.src = tb.avatar_url;
      navImg.alt = tb.navn || 'Profilbilde';
      navImg.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
      navImg.onerror = () => { navAv.textContent = initialFra(tb.navn || '?'); navAv.style.overflow = ''; };
      navAv.appendChild(navImg);
    }
  } else {
    av.textContent = initialFra(tb.navn || '?');
  }

  document.getElementById('profil-navn').textContent = tb.navn || '—';

  const delene = [
    tb.utdanningsprogram || '',
    profil.sted || tb.sted || '',
    profil.alder ? profil.alder + ' år' : ''
  ].filter(Boolean);
  document.getElementById('profil-sub').textContent = delene.join(' · ') || '—';

  if (tb.cv_url) {
    ['btn-last-cv', 'btn-last-cv-2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.href = tb.cv_url;
        el.target = '_blank';
        el.classList.remove('skjult');
      }
    });
  }

  const badgeRad = document.getElementById('badge-rad');
  const badges = [];
  badges.push({ tekst: 'HMS-kurs', klasse: 'badge-gronn' });
  if (tb.utdanningsprogram) badges.push({ tekst: tb.utdanningsprogram, klasse: 'badge-blaa' });
  badges.push({ tekst: 'Aktiv søker', klasse: 'badge-roed' });
  const sted = profil.sted || tb.sted;
  if (sted) badges.push({ tekst: sted, klasse: 'badge-graa' });
  if (beregnProfilkomplettering(tb) >= 80) badges.push({ tekst: 'Profil fullført', klasse: 'badge-graa' });
  if (profil.harReferanse) badges.push({ tekst: 'Anbefalt av skole', klasse: 'badge-gronn' });
  badgeRad.innerHTML = badges.map(b => `<span class="badge ${b.klasse}">${b.tekst}</span>`).join('');

  const fagSelect = document.getElementById('edit-fag');
  if (fagSelect && fagomraader) {
    fagomraader.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = f;
      if (f === tb.utdanningsprogram) opt.selected = true;
      fagSelect.appendChild(opt);
    });
  }

  const editNavn = document.getElementById('edit-navn');
  const editSted = document.getElementById('edit-sted');
  const editAlder = document.getElementById('edit-alder');
  if (editNavn) editNavn.value = tb.navn || '';
  if (editSted) editSted.value = profil.sted || tb.sted || '';
  if (editAlder) editAlder.value = profil.alder || '';

  const avatarEditBtn = document.getElementById('avatarEditBtn');
  const avatarInput = document.getElementById('avatarInput');
  if (avatarEditBtn && avatarInput) {
    avatarEditBtn.addEventListener('click', () => avatarInput.click());
    avatarInput.addEventListener('change', async (e) => {
      const fil = e.target.files[0];
      if (!fil) return;

      // Vis forhåndsvisning lokalt mens vi laster opp
      const lokalUrl = URL.createObjectURL(fil);
      const av = document.getElementById('profil-avatar');
      av.innerHTML = '';
      av.style.overflow = 'hidden';
      const img = document.createElement('img');
      img.src = lokalUrl;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
      av.appendChild(img);

      // Last opp til Firebase Storage via backend
      try {
        const token = await getToken();
        const formData = new FormData();
        formData.append('avatar', fil);

        const res = await fetch('/api/cv/avatar', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });

        if (res.ok) {
          const data = await res.json();
          targetBruker.avatar_url = data.avatar_url;

          const navAv = document.getElementById('nav-avatar');
          if (navAv) {
            navAv.innerHTML = '';
            navAv.style.overflow = 'hidden';
            const navImg = document.createElement('img');
            navImg.src = data.avatar_url;
            navImg.alt = targetBruker.navn || 'Profilbilde';
            navImg.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
            navImg.onerror = () => { navAv.textContent = initialFra(targetBruker.navn || '?'); navAv.style.overflow = ''; };
            navAv.appendChild(navImg);
          }

          visMelding('Profilbilde er lagret!', true);
        } else {
          const data = await res.json().catch(() => ({}));
          visMelding(data.feil || 'Kunne ikke laste opp profilbilde.', false);
          // Tilbakestill til initialer ved feil
          av.innerHTML = initialFra(targetBruker.navn || '?');
          av.style.overflow = '';
        }
      } catch (err) {
        console.error('Profilbilde opplasting feil:', err);
        visMelding('Noe gikk galt. Prøv igjen.', false);
      } finally {
        URL.revokeObjectURL(lokalUrl);
      }
    });
  }
}

function renderBio() {
  const bio = targetBruker.bio || '';
  const p = document.getElementById('bio-tekst');
  if (bio) {
    p.textContent = bio;
    p.style.fontStyle = 'normal';
    p.style.color = 'var(--olkv-dark)';
  } else {
    p.textContent = 'Ingen beskrivelse lagt til ennå. Aktiver redigeringsmodus for å skrive om deg selv.';
    p.style.fontStyle = 'italic';
    p.style.color = 'var(--olkv-gray)';
  }
  const input = document.getElementById('bio-input');
  if (input) input.value = bio;
}

window.lagreBio = async function() {
  try {
    const tekst = document.getElementById('bio-input').value.trim();
    await oppdaterBruker({ bio: tekst });
    targetBruker.bio = tekst;
    renderBio();
    visMelding('Bio er lagret!', true);
  } catch (err) {
    console.error('lagreBio feil:', err);
    visMelding(err.message || 'Noe gikk galt. Prøv igjen.', false);
  }
};

window.lagreHode = async function() {
  try {
    const navn = document.getElementById('edit-navn').value.trim();
    const fag = document.getElementById('edit-fag').value;
    const sted = document.getElementById('edit-sted').value.trim();
    const alderStr = document.getElementById('edit-alder').value;
    const alder = parseInt(alderStr) || null;

    if (navn) {
      await oppdaterBruker({ navn, utdanningsprogram: fag });
      targetBruker.navn = navn;
      targetBruker.utdanningsprogram = fag;
    }

    profil.sted = sted;
    if (alder) profil.alder = alder;
    await lagreProfil();

    document.getElementById('profil-navn').textContent = navn || targetBruker.navn;
    // Oppdater avatar kun om ingen avatar-bilde er lastet opp
    const avEl = document.getElementById('profil-avatar');
    if (!targetBruker.avatar_url) {
      avEl.textContent = initialFra(navn || targetBruker.navn);
    }
    const delene = [fag, sted, alder ? alder + ' år' : ''].filter(Boolean);
    document.getElementById('profil-sub').textContent = delene.join(' · ') || '—';
    visMelding('Profilhode lagret!', true);
  } catch (err) {
    console.error('lagreHode feil:', err);
    visMelding(err.message || 'Noe gikk galt. Prøv igjen.', false);
  }
};

function renderReferanser() {
  const liste = document.getElementById('referanser-liste');
  const refs = profil.referanser || [];
  if (refs.length === 0) {
    liste.innerHTML = `<div class="tom-tilstand"><p>Ingen referanser lagt til ennå.<br><small style="color:var(--olkv-gray);">Fyll ut skjemaet nedenfor og trykk «Legg til referanse».</small></p></div>`;
    return;
  }
  liste.innerHTML = refs.map((ref) => `
    <div style="background:var(--olkv-gray-light);border-radius:var(--radius);padding:1.25rem;margin-bottom:1rem;">
      <p style="margin:0 0 0.75rem;font-style:italic;color:var(--olkv-dark);font-size:0.95rem;line-height:1.6;">"${ref.tekst || ''}"</p>
      <div style="display:flex;align-items:center;gap:0.75rem;">
        <div class="avatar" style="width:40px;height:40px;min-width:40px;background:var(--olkv-blue);color:white;font-size:0.85rem;display:flex;align-items:center;justify-content:center;border-radius:50%;">${initialFra(ref.navn || '?')}</div>
        <div style="flex:1;">
          <p style="margin:0;font-weight:700;font-family:'DM Sans',sans-serif;">${ref.navn || '—'}</p>
          <p style="margin:0;font-size:0.85rem;color:var(--olkv-gray);">${ref.rolle || '—'}</p>
        </div>
        ${ref.verifisert ? '<span style="margin-left:auto;font-size:0.8rem;color:#16a34a;font-weight:600;white-space:nowrap;display:inline-flex;align-items:center;gap:3px;"><svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'1.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'20 6 9 17 4 12\'/></svg> Verifisert</span>' : ''}
      </div>
    </div>
  `).join('');
}

window.leggTilReferanse = async function() {
  const tekst = document.getElementById('ref-tekst').value.trim();
  const navn = document.getElementById('ref-navn').value.trim();
  const rolle = document.getElementById('ref-rolle').value.trim();
  if (!tekst || !navn) { visMelding('Fyll ut referansetekst og navn.', false); return; }
  profil.referanser = profil.referanser || [];
  profil.referanser.push({ tekst, navn, rolle, verifisert: false });
  profil.harReferanse = true;
  try {
    await lagreProfil();
    document.getElementById('ref-tekst').value = '';
    document.getElementById('ref-navn').value = '';
    document.getElementById('ref-rolle').value = '';
    renderReferanser();
    visMelding('Referanse lagt til!', true);
  } catch (e) {
    console.error('Legg til referanse feil:', e);
    profil.referanser.pop();
    if (profil.referanser.length === 0) profil.harReferanse = false;
    visMelding('Noe gikk galt. Prøv igjen.', false);
  }
};

function renderFerdigheter() {
  const liste = document.getElementById('ferdigheter-liste');
  const ferdigheter = profil.ferdigheter || [];

  if (ferdigheter.length === 0) {
    liste.innerHTML = `<div class="tom-tilstand"><p>Ingen ferdigheter lagt til ennå.<br><small style="color:var(--olkv-gray);">Aktiver redigeringsmodus for å legge til og justere ferdigheter.</small></p></div>`;
    return;
  }

  liste.innerHTML = ferdigheter.map((f, i) => {
    const antallStjerner = Math.round(f.prosent / 20);
    const stjerner = '★'.repeat(antallStjerner) + '☆'.repeat(5 - antallStjerner);
    return `
      <div style="margin-bottom:1.1rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">
          <span style="font-weight:600;font-family:'DM Sans',sans-serif;">${f.navn}</span>
          <span style="color:#F59E0B;letter-spacing:2px;font-size:1rem;" id="stjerner-${i}">${stjerner}</span>
        </div>
        <div class="fremgang-linje">
          <div class="fremgang-fyll skill-bar" data-pct="${f.prosent}" data-idx="${i}" style="width:0%;background:linear-gradient(90deg,var(--olkv-blue-light),var(--olkv-red));transition:width 0.8s ease;"></div>
        </div>
        <div class="edit-only skjult" style="margin-top:0.5rem;display:flex;align-items:center;gap:0.75rem;">
          <input type="range" min="0" max="100" step="5" value="${f.prosent}" style="flex:1;" oninput="oppdaterFerdighet(${i},this.value)" />
          <span id="ferd-pct-${i}" style="font-size:0.85rem;color:var(--olkv-gray);min-width:38px;">${f.prosent}%</span>
        </div>
      </div>`;
  }).join('');

  if (editMode) {
    liste.querySelectorAll('.edit-only').forEach(el => el.classList.remove('skjult'));
  }
  setTimeout(() => initSkillBarObserver(), 100);
}

window.oppdaterFerdighet = function(index, value) {
  const pct = parseInt(value);
  profil.ferdigheter[index].prosent = pct;
  const bars = document.querySelectorAll('.skill-bar');
  if (bars[index]) bars[index].style.width = pct + '%';
  const pctEl = document.getElementById('ferd-pct-' + index);
  if (pctEl) pctEl.textContent = pct + '%';
  const antallStjerner = Math.round(pct / 20);
  const stjerneEl = document.getElementById('stjerner-' + index);
  if (stjerneEl) stjerneEl.textContent = '★'.repeat(antallStjerner) + '☆'.repeat(5 - antallStjerner);
};

window.lagreFerdigheter = async function() {
  try {
    await lagreProfil();
    visMelding('Ferdigheter lagret!', true);
  } catch (err) {
    console.error('lagreFerdigheter feil:', err);
    visMelding(err.message || 'Noe gikk galt. Prøv igjen.', false);
  }
};

window.leggTilFerdighet = async function() {
  const input = document.getElementById('ny-ferdighet-navn');
  const navn = input.value.trim();
  if (!navn) { visMelding('Fyll inn navn på ferdigheten.', false); return; }
  profil.ferdigheter = profil.ferdigheter || [];
  profil.ferdigheter.push({ navn, prosent: 50 });
  input.value = '';
  await lagreProfil();
  renderFerdigheter();
  visMelding('Ferdighet lagt til!', true);
};

function initSkillBarObserver() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const bar = entry.target;
        bar.style.width = bar.dataset.pct + '%';
        observer.unobserve(bar);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.skill-bar').forEach(bar => observer.observe(bar));
}

function renderPortefolje() {
  const grid = document.getElementById('portefolje-grid');
  const prosjekter = profil.portefolje || [];
  if (prosjekter.length === 0) {
    grid.innerHTML = `<div class="tom-tilstand" style="grid-column:1/-1;"><p>Ingen prosjekter lagt til ennå.</p></div>`;
    return;
  }
  grid.innerHTML = prosjekter.map(p => `
    <div class="kort" style="padding:0;overflow:hidden;cursor:default;">
      <div style="aspect-ratio:4/3;background:var(--olkv-blue-pale);display:flex;align-items:center;justify-content:center;font-size:2.5rem;">${p.ikon || '📁'}</div>
      <div style="padding:0.875rem;">
        <h4 class="kort-tittel" style="font-size:0.95rem;margin:0 0 0.4rem;">${p.tittel || '—'}</h4>
        <p style="font-size:0.85rem;color:var(--olkv-gray);margin:0;">${p.beskrivelse || ''}</p>
      </div>
    </div>
  `).join('');
}

window.leggTilProsjekt = async function() {
  try {
    const ikon = document.getElementById('proj-ikon').value.trim() || '📁';
    const tittel = document.getElementById('proj-tittel').value.trim();
    const beskrivelse = document.getElementById('proj-beskrivelse').value.trim();
    if (!tittel) { visMelding('Fyll inn prosjekttittel.', false); return; }
    profil.portefolje = profil.portefolje || [];
    profil.portefolje.push({ ikon, tittel, beskrivelse });
    await lagreProfil();
    document.getElementById('proj-ikon').value = '';
    document.getElementById('proj-tittel').value = '';
    document.getElementById('proj-beskrivelse').value = '';
    renderPortefolje();
    visMelding('Prosjekt lagt til!', true);
  } catch (err) {
    console.error('leggTilProsjekt feil:', err);
    profil.portefolje?.pop();
    visMelding(err.message || 'Noe gikk galt. Prøv igjen.', false);
  }
};

function renderMotiveasjon() {
  const tekst = profil.motivasjon || '';
  const p = document.getElementById('motivasjon-tekst');
  if (tekst) {
    p.textContent = tekst;
    p.style.fontStyle = 'normal';
  } else {
    p.textContent = 'Ingen motivasjonstekst lagt til ennå.';
    p.style.fontStyle = 'italic';
    p.style.color = 'var(--olkv-gray)';
  }
  const input = document.getElementById('motivasjon-input');
  if (input) {
    input.value = tekst;
    input.addEventListener('input', () => {
      const ord = input.value.trim().split(/\s+/).filter(w => w.length > 0).length;
      const teller = document.getElementById('ordTeller');
      teller.textContent = ord + ' ord';
      teller.style.color = ord > 200 ? 'var(--olkv-red)' : 'var(--olkv-gray)';
    });
  }
}

window.lagreMotiveasjon = async function() {
  try {
    const tekst = document.getElementById('motivasjon-input').value.trim();
    profil.motivasjon = tekst;
    await lagreProfil();
    renderMotiveasjon();
    visMelding('Motivasjonstekst lagret!', true);
  } catch (err) {
    console.error('lagreMotiveasjon feil:', err);
    visMelding(err.message || 'Noe gikk galt. Prøv igjen.', false);
  }
};

function renderTidslinje() {
  const liste = document.getElementById('tidslinje-liste');
  const tidslinje = profil.tidslinje || [];

  if (tidslinje.length === 0) {
    liste.innerHTML = `<div class="tom-tilstand"><p>Ingen erfaring eller utdanning lagt til ennå.<br><small style="color:var(--olkv-gray);">Aktiver redigeringsmodus for å legge til kurs, skole og jobb.</small></p></div>`;
    return;
  }

  liste.innerHTML = tidslinje.map(t => `
    <div style="display:flex;gap:1rem;align-items:flex-start;margin-bottom:1.25rem;position:relative;">
      <div class="avatar" style="width:36px;height:36px;min-width:36px;background:var(--olkv-blue-pale);color:var(--olkv-blue);font-size:1rem;display:flex;align-items:center;justify-content:center;border-radius:50%;border:2px solid white;position:relative;z-index:1;">${t.ikon || '📌'}</div>
      <div style="flex:1;padding-top:0.1rem;">
        <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
          <span style="font-weight:600;font-family:'DM Sans',sans-serif;">${t.tittel || '—'}</span>
          <span class="badge badge-blaa" style="font-size:0.75rem;">${t.dato || ''}</span>
        </div>
        <p style="margin:0.25rem 0 0;font-size:0.875rem;color:var(--olkv-gray);">${t.beskrivelse || ''}</p>
      </div>
    </div>
  `).join('');
}

window.leggTilTidslinjePunkt = async function() {
  try {
    const ikon = document.getElementById('tl-ikon').value.trim() || '📌';
    const tittel = document.getElementById('tl-tittel').value.trim();
    const beskrivelse = document.getElementById('tl-beskrivelse').value.trim();
    const dato = document.getElementById('tl-dato').value.trim();
    const type = document.getElementById('tl-type').value;
    if (!tittel) { visMelding('Fyll inn tittel.', false); return; }
    profil.tidslinje = profil.tidslinje || [];
    profil.tidslinje.unshift({ ikon, tittel, beskrivelse, dato, type });
    await lagreProfil();
    document.getElementById('tl-ikon').value = '';
    document.getElementById('tl-tittel').value = '';
    document.getElementById('tl-beskrivelse').value = '';
    document.getElementById('tl-dato').value = '';
    renderTidslinje();
    visMelding('Lagt til i tidslinjen!', true);
  } catch (err) {
    console.error('leggTilTidslinjePunkt feil:', err);
    profil.tidslinje?.shift();
    visMelding(err.message || 'Noe gikk galt. Prøv igjen.', false);
  }
};

function renderTilgjengelighet() {
  const kanStarte = profil.kanStarte || '';
  const stillingsprosent = profil.stillingsprosent || 'Heltid 100%';
  const tilgjengeligeDager = profil.tilgjengeligeDager || ['Man', 'Tir', 'Ons', 'Tor', 'Fre'];

  const visKanStarte = document.getElementById('vis-kanStarte');
  if (kanStarte) {
    const d = new Date(kanStarte + '-01');
    visKanStarte.textContent = d.toLocaleDateString('nb-NO', { year: 'numeric', month: 'long' });
  } else {
    visKanStarte.textContent = 'Ikke oppgitt';
  }
  document.getElementById('vis-stillingsprosent').textContent = stillingsprosent;

  const editKanStarte = document.getElementById('edit-kanStarte');
  const editStillingsprosent = document.getElementById('edit-stillingsprosent');
  if (editKanStarte) editKanStarte.value = kanStarte;
  if (editStillingsprosent) editStillingsprosent.value = stillingsprosent;

  const dager = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
  const piller = document.getElementById('dager-piller');
  piller.innerHTML = dager.map(d => {
    const aktiv = tilgjengeligeDager.includes(d);
    return `<button class="badge ${aktiv ? 'badge-blaa' : 'badge-graa'} badge-pille" id="dag-${d}" onclick="toggleDag('${d}')">${d}</button>`;
  }).join('');
}

window.toggleDag = function(dag) {
  if (!editMode) return;
  profil.tilgjengeligeDager = profil.tilgjengeligeDager || ['Man', 'Tir', 'Ons', 'Tor', 'Fre'];
  const idx = profil.tilgjengeligeDager.indexOf(dag);
  if (idx >= 0) {
    profil.tilgjengeligeDager.splice(idx, 1);
  } else {
    profil.tilgjengeligeDager.push(dag);
  }
  const btn = document.getElementById('dag-' + dag);
  if (btn) btn.className = `badge ${profil.tilgjengeligeDager.includes(dag) ? 'badge-blaa' : 'badge-graa'} badge-pille`;
};

window.lagreTilgjengelighet = async function() {
  const editKanStarte = document.getElementById('edit-kanStarte');
  const editStillingsprosent = document.getElementById('edit-stillingsprosent');
  if (editKanStarte?.value) profil.kanStarte = editKanStarte.value;
  if (editStillingsprosent?.value) profil.stillingsprosent = editStillingsprosent.value;
  await lagreProfil();
  renderTilgjengelighet();
  visMelding('Tilgjengelighet lagret!', true);
};

function renderVideo() {
  const harVideo = !!profil.videoURL;
  const erEierLokal = !visUid || visUid === bruker.uid;

  const spillerWrapper   = document.getElementById('video-spiller-wrapper');
  const tomVisning       = document.getElementById('video-tom-visning');
  const opplastingWrapper = document.getElementById('video-opplasting-wrapper');
  const sletteKnapp      = document.getElementById('btn-slett-video');
  const filnavnVis       = document.getElementById('video-filnavn-vis');
  const spiller          = document.getElementById('video-spiller');

  // Nullstill alle tilstander
  spillerWrapper.classList.add('skjult');
  tomVisning.classList.add('skjult');

  if (harVideo) {
    spiller.src = profil.videoURL;
    spillerWrapper.classList.remove('skjult');
    filnavnVis.textContent = profil.videoFilnavn || '';
  } else {
    spiller.removeAttribute('src');
    filnavnVis.textContent = '';
    if (!erEierLokal) {
      tomVisning.classList.remove('skjult');
    }
    // For eier: opplastingWrapper styres av .edit-only (toggleEdit)
  }

  // Slett-knapp: vises kun for eier (edit-only håndterer redigeringsmodus-filter)
  if (!erEierLokal) {
    sletteKnapp.classList.add('skjult');
  }

  // Koble fil-input til opplastingsfunksjon
  const videoInput = document.getElementById('videoInput');
  if (videoInput && erEierLokal) {
    videoInput.onchange = (e) => {
      const fil = e.target.files[0];
      if (fil) lastOppVideo(fil);
    };
  }
}

async function lastOppVideo(fil) {
  const TILLATTE_MIME = ['video/mp4', 'video/webm', 'video/quicktime'];
  const TILLATTE_EXT_VIDEO = ['.mp4', '.webm', '.mov'];
  const ext = fil.name.substring(fil.name.lastIndexOf('.')).toLowerCase();

  if (!TILLATTE_MIME.includes(fil.type) && !TILLATTE_EXT_VIDEO.includes(ext)) {
    visMelding('Kun MP4, WebM og MOV er tillatt.', false);
    return;
  }
  if (fil.size > 100 * 1024 * 1024) {
    visMelding('Videoen er for stor. Maks 100 MB er tillatt.', false);
    return;
  }

  // Skjul opplastingsskjema, vis progress
  document.getElementById('video-opplasting-wrapper').classList.add('skjult');
  document.getElementById('video-spiller-wrapper').classList.add('skjult');
  document.getElementById('video-progress-wrapper').classList.remove('skjult');
  settVideoProgress(0, 'Klargjør opplasting...');

  try {
    // 1. Hent signert URL fra backend
    const token = await getToken();
    const urlRes = await fetch('/api/cv/video/signed-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ filnavn: fil.name, contentType: fil.type, size: fil.size })
    });
    if (!urlRes.ok) {
      const data = await urlRes.json().catch(() => ({}));
      throw new Error(data.feil || 'Kunne ikke klargjøre opplasting.');
    }
    const { signedUrl, storagePath, contentType } = await urlRes.json();
    settVideoProgress(5, 'Laster opp video...');

    // 2. Last opp direkte til Firebase Storage via XHR (for progress)
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', signedUrl);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pst = Math.round((e.loaded / e.total) * 90) + 5;
          settVideoProgress(pst, `Laster opp... ${pst}%`);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Opplasting feilet (HTTP ${xhr.status}). Prøv igjen.`));
      };
      xhr.onerror = () => reject(new Error('Nettverksfeil under opplasting. Prøv igjen.'));
      xhr.send(fil);
    });
    settVideoProgress(95, 'Ferdigstiller...');

    // 3. Bekreft til backend
    const confirmToken = await getToken();
    const confirmRes = await fetch('/api/cv/video/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${confirmToken}` },
      body: JSON.stringify({ storagePath, filnavn: fil.name, contentType: fil.type, size: fil.size })
    });
    if (!confirmRes.ok) {
      const data = await confirmRes.json().catch(() => ({}));
      throw new Error(data.feil || 'Kunne ikke lagre videoinformasjon. Prøv igjen.');
    }
    const confirmData = await confirmRes.json();
    settVideoProgress(100, 'Ferdig!');

    // 4. Oppdater lokal profil og render
    profil.videoURL     = confirmData.videoURL;
    profil.videoFilnavn = confirmData.videoFilnavn;
    profil.videoPath    = storagePath;

    setTimeout(() => {
      document.getElementById('video-progress-wrapper').classList.add('skjult');
      renderVideo();
      visMelding('Videopresentasjonen er lastet opp!', true);
    }, 600);

  } catch (err) {
    console.error('Video opplasting feil:', err);
    document.getElementById('video-progress-wrapper').classList.add('skjult');
    document.getElementById('video-opplasting-wrapper').classList.remove('skjult');
    document.getElementById('videoInput').value = '';
    visMelding(err.message || 'Noe gikk galt. Prøv igjen.', false);
  }
}

function settVideoProgress(pst, tekst) {
  document.getElementById('video-progress-bar').style.width = pst + '%';
  document.getElementById('video-progress-prosent').textContent = pst + '%';
  document.getElementById('video-progress-tekst').textContent = tekst;
}

window.slettVideo = async function() {
  if (!confirm('Er du sikker på at du vil slette videopresentasjonen?')) return;
  try {
    const token = await getToken();
    const res = await fetch('/api/cv/video', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      visMelding(data.feil || 'Kunne ikke slette videoen. Prøv igjen.', false);
      return;
    }
    profil.videoURL     = null;
    profil.videoFilnavn = null;
    profil.videoPath    = null;
    // Tøm video-elementet for å frigjøre ressurser
    const spiller = document.getElementById('video-spiller');
    spiller.pause();
    spiller.removeAttribute('src');
    spiller.load();
    renderVideo();
    visMelding('Videopresentasjonen er slettet.', true);
  } catch (err) {
    console.error('Slett video feil:', err);
    visMelding('Noe gikk galt. Prøv igjen.', false);
  }
};

function renderCv() {
  const erEierLokal = !visUid || visUid === bruker.uid;
  const harCv = !!targetBruker.cv_url;

  const harFilEl = document.getElementById('cv-har-fil');
  const ingenEl = document.getElementById('cv-ingen-visning');
  const opplastingEl = document.getElementById('cv-opplasting');

  harFilEl.classList.add('skjult');
  ingenEl.classList.add('skjult');

  if (harCv) {
    document.getElementById('cv-filnavn-vis').textContent = targetBruker.cv_filnavn || 'CV';
    const lenke = document.getElementById('cv-last-ned-lenke');
    lenke.href = targetBruker.cv_url;
    harFilEl.classList.remove('skjult');
    harFilEl.style.display = 'flex';
  } else if (!erEierLokal) {
    ingenEl.classList.remove('skjult');
  }

  // Koble fil-input
  const cvInput = document.getElementById('cv-fil-input');
  if (cvInput && erEierLokal) {
    cvInput.onchange = (e) => {
      const fil = e.target.files[0];
      if (fil) lastOppCv(fil);
    };
  }
}

async function lastOppCv(fil) {
  const MAKS = 10 * 1024 * 1024;
  const TILLATTE = ['.pdf', '.docx', '.doc', '.jpg', '.jpeg', '.png', '.webp'];
  const ext = fil.name.substring(fil.name.lastIndexOf('.')).toLowerCase();

  if (!TILLATTE.includes(ext)) {
    visMelding('Kun PDF, Word eller bilder (JPG, PNG) er tillatt.', false);
    return;
  }
  if (fil.size > MAKS) {
    visMelding('Filen er for stor. Maks 10 MB.', false);
    return;
  }

  const varselEl = document.getElementById('cv-profil-varsel');
  varselEl.className = 'varsel varsel-info';
  varselEl.textContent = 'Laster opp...';
  varselEl.classList.remove('skjult');

  try {
    const token = await getToken();
    const formData = new FormData();
    formData.append('cv', fil);

    const res = await fetch('/api/cv', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.feil || 'Opplasting feilet');

    targetBruker.cv_filnavn = data.cv_filnavn;
    targetBruker.cv_url = data.cv_url || targetBruker.cv_url;
    targetBruker.cv_lastet_opp = true;

    renderCv();
    varselEl.className = 'varsel varsel-suksess';
    varselEl.textContent = `CV lastet opp: ${data.cv_filnavn}`;
  } catch (err) {
    console.error('CV opplasting feil:', err);
    varselEl.className = 'varsel varsel-feil';
    varselEl.textContent = err.message || 'Noe gikk galt. Prøv igjen.';
  } finally {
    document.getElementById('cv-fil-input').value = '';
  }
}

window.slettCv = async function() {
  if (!confirm('Er du sikker på at du vil slette CV-en din?')) return;
  try {
    const token = await getToken();
    const res = await fetch('/api/cv', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.feil || 'Kunne ikke slette CV');
    }
    targetBruker.cv_filnavn = null;
    targetBruker.cv_url = null;
    targetBruker.cv_lastet_opp = false;
    renderCv();
    visMelding('CV er slettet.', true);
  } catch (err) {
    console.error('Slett CV feil:', err);
    visMelding(err.message || 'Noe gikk galt.', false);
  }
};

function initAiChat() {
  leggTilAiBoble('Hei! Jeg er OLKV sin AI-assistent. Jeg kan hjelpe deg å vurdere denne profilen, lage intervjuspørsmål eller svare på spørsmål om lærlingen.');
}

function parseMarkdown(tekst) {
  return tekst
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/(^|\n)(- .+)(\n|$)/g, (_, pre, item, post) => {
      return pre + '<li>' + item.replace(/^- /, '') + '</li>' + post;
    })
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
    .replace(/<\/ul>\s*<ul>/g, '')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

function leggTilAiBoble(tekst) {
  const chat = document.getElementById('ai-chat');
  const boble = document.createElement('div');
  boble.className = 'ai-boble';
  boble.innerHTML = parseMarkdown(tekst);
  chat.appendChild(boble);
  chat.scrollTop = chat.scrollHeight;
  return boble;
}

function leggTilBrukerBoble(tekst) {
  const chat = document.getElementById('ai-chat');
  const boble = document.createElement('div');
  boble.className = 'bruker-boble';
  boble.textContent = tekst;
  chat.appendChild(boble);
  chat.scrollTop = chat.scrollHeight;
}

window.sendAiMessage = async function() {
  const input = document.getElementById('ai-input');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';

  leggTilBrukerBoble(msg);
  konversasjonsHistorikk.push({ role: 'user', content: msg });
    if (konversasjonsHistorikk.length > 20) {
      konversasjonsHistorikk = konversasjonsHistorikk.slice(-20);
    }

  const chat = document.getElementById('ai-chat');
  const skeleton = document.createElement('div');
  skeleton.className = 'skeleton';
  skeleton.style.cssText = 'width:200px;height:40px;border-radius:4px 12px 12px 12px;align-self:flex-start;flex-shrink:0;';
  chat.appendChild(skeleton);
  chat.scrollTop = chat.scrollHeight;

  try {
    const token = await getToken();
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        target_uid: (targetBruker || bruker).uid,
        messages: konversasjonsHistorikk
      })
    });

    let svar;
    if (response.ok) {
      const data = await response.json();
      svar = data.svar || data.content || 'Beklager, prøv igjen.';
    } else {
      svar = 'Beklager, AI-assistenten er ikke tilgjengelig akkurat nå. Prøv igjen senere.';
    }

    konversasjonsHistorikk.push({ role: 'assistant', content: svar });
    if (konversasjonsHistorikk.length > 20) {
      konversasjonsHistorikk = konversasjonsHistorikk.slice(-20);
    }
    chat.removeChild(skeleton);
    leggTilAiBoble(svar);
  } catch (e) {
    console.error('AI chat feil:', e);
    chat.removeChild(skeleton);
    leggTilAiBoble('Beklager, kunne ikke koble til AI-assistenten. Sjekk nettverksforbindelsen og prøv igjen.');
  }
};

function toggleEdit() {
  editMode = !editMode;
  document.querySelectorAll('.edit-only').forEach(el => {
    if (editMode) {
      el.classList.remove('skjult');
    } else {
      el.classList.add('skjult');
    }
  });
  const banner = document.getElementById('editBanner');
  if (editMode) {
    banner.classList.remove('skjult');
  } else {
    banner.classList.add('skjult');
  }
  const btn = document.getElementById('toggleEditBtn');
  btn.textContent = editMode ? 'Ferdig' : 'Rediger profil';
  const btnMobil = document.getElementById('toggleEditBtnMobil');
  if (btnMobil) btnMobil.textContent = editMode ? 'Ferdig' : 'Rediger profil';

  document.querySelectorAll('.badge-pille').forEach(b => {
    b.style.cursor = editMode ? 'pointer' : 'default';
  });

  if (!editMode) {
    initSkillBarObserver();
    renderVideo();
  }
}

async function lagreProfil() {
  const token = await getToken();
  const res = await fetch('/api/auth/profildata', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(profil)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.feil || 'Kunne ikke lagre profil');
  }
}

function visMelding(tekst, suksess) {
  const eksisterende = document.getElementById('toast-melding');
  if (eksisterende) eksisterende.remove();

  const toast = document.createElement('div');
  toast.id = 'toast-melding';
  toast.className = suksess ? 'toast' : 'toast toast-feil';
  toast.textContent = tekst;
  toast.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);z-index:9999;min-width:200px;text-align:center;';
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 3500);
}
