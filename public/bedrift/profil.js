import { krevInnlogging, loggUt, getToken, initScrollReveal, initVarselBjelle, oppdaterBruker } from '../app.js';

let bruker = null;
let profil = {};
let editMode = false;
let erEier = true;

const params = new URLSearchParams(location.search);
const visUid = params.get('uid');

bruker = await krevInnlogging();
if (!bruker) { window.location.href = '/login.html'; }

erEier = !visUid || visUid === bruker.uid;
const targetUid = visUid || bruker.uid;

// Hent bedriftsprofil fra backend
try {
  const token = await getToken();
  const res = await fetch(`/api/auth/bedriftprofil?uid=${encodeURIComponent(targetUid)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.ok) profil = await res.json();
} catch (e) {
  console.warn('Ingen bedriftsprofil ennå:', e);
}

document.getElementById('nav-navn').textContent = bruker.navn || '';
document.getElementById('logg-ut-btn').addEventListener('click', () => loggUt());

if (!erEier) {
  document.querySelectorAll('.edit-owner-only').forEach(el => el.classList.add('skjult'));
} else {
  document.getElementById('toggle-edit-btn').addEventListener('click', toggleEdit);
}

renderProfil();
renderVideo();
initScrollReveal();
initVarselBjelle();

function renderProfil() {
  document.getElementById('profil-navn').textContent = profil.navn || '—';
  document.getElementById('edit-bedriftsnavn').value = profil.navn || '';
  document.getElementById('profil-sub').textContent = [profil.bransje, profil.sted, profil.orgNr ? 'Org.nr ' + profil.orgNr : ''].filter(Boolean).join(' · ') || '—';

  setText('beskrivelse-tekst', profil.beskrivelse, 'Ingen beskrivelse lagt til ennå.');
  document.getElementById('beskrivelse-input').value = profil.beskrivelse || '';

  setText('tilbyr-tekst', profil.hvaViTilbyr, 'Ikke oppgitt ennå.');
  document.getElementById('tilbyr-input').value = profil.hvaViTilbyr || '';

  document.getElementById('vis-sted').textContent = profil.sted || 'Ikke oppgitt';
  document.getElementById('vis-antall').textContent = profil.antallAnsatte || 'Ikke oppgitt';
  document.getElementById('edit-sted').value = profil.sted || '';
  document.getElementById('edit-antall').value = profil.antallAnsatte || '';

  document.getElementById('profil-status').classList.toggle('skjult', !profil.godkjent);

  setText('verdier-tekst', profil.verdier, 'Ikke oppgitt ennå.');
  document.getElementById('verdier-input').value = profil.verdier || '';
}

function setText(id, verdi, fallback) {
  const el = document.getElementById(id);
  el.textContent = verdi || fallback;
  el.style.fontStyle = verdi ? 'normal' : 'italic';
  el.style.color = verdi ? 'var(--olkv-dark)' : 'var(--olkv-gray)';
}

function toggleEdit() {
  editMode = !editMode;
  document.querySelectorAll('.edit-only').forEach(el => {
    el.classList.toggle('skjult', !editMode);
  });
  document.getElementById('toggle-edit-btn').textContent = editMode ? 'Ferdig' : 'Rediger profil';
  if (!editMode) renderVideo();
}

async function lagreProfil(data) {
  const token = await getToken();
  const res = await fetch('/api/auth/bedriftprofil', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.feil || 'Kunne ikke lagre');
  }
  Object.assign(profil, data);
}

function visMelding(tekst, suksess) {
  const toast = document.createElement('div');
  toast.className = suksess ? 'toast' : 'toast toast-feil';
  toast.textContent = tekst;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function renderVideo() {
  const harVideo = !!profil.videoURL;
  document.getElementById('video-spiller-wrapper').classList.toggle('skjult', !harVideo);
  document.getElementById('video-tom').classList.toggle('skjult', harVideo || erEier);
  if (harVideo) {
    document.getElementById('video-spiller').src = profil.videoURL;
  } else {
    document.getElementById('video-spiller').removeAttribute('src');
  }

  const videoInput = document.getElementById('videoInput');
  if (videoInput && erEier) {
    videoInput.onchange = (e) => { if (e.target.files[0]) lastOppVideo(e.target.files[0]); };
  }
}

async function lastOppVideo(fil) {
  if (fil.size > 100 * 1024 * 1024) { visMelding('Maks 100 MB.', false); return; }
  document.getElementById('video-opplasting').classList.add('skjult');
  document.getElementById('video-progress').classList.remove('skjult');
  settProgress(0, 'Klargjør...');

  try {
    const token = await getToken();
    const urlRes = await fetch('/api/cv/bedrift-video/signed-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ filnavn: fil.name, contentType: fil.type, size: fil.size })
    });
    if (!urlRes.ok) throw new Error((await urlRes.json().catch(() => ({}))).feil || 'Feil');
    const { signedUrl, storagePath, contentType } = await urlRes.json();
    settProgress(5, 'Laster opp...');

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', signedUrl);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) settProgress(Math.round((e.loaded / e.total) * 90) + 5, 'Laster opp...');
      };
      xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error('Opplasting feilet'));
      xhr.onerror = () => reject(new Error('Nettverksfeil'));
      xhr.send(fil);
    });
    settProgress(95, 'Ferdigstiller...');

    const confirmToken = await getToken();
    const confirmRes = await fetch('/api/cv/bedrift-video/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${confirmToken}` },
      body: JSON.stringify({ storagePath, filnavn: fil.name, contentType: fil.type, size: fil.size })
    });
    if (!confirmRes.ok) throw new Error((await confirmRes.json().catch(() => ({}))).feil || 'Feil');
    const data = await confirmRes.json();
    profil.videoURL = data.videoURL;
    profil.videoFilnavn = data.videoFilnavn;
    settProgress(100, 'Ferdig!');
    setTimeout(() => {
      document.getElementById('video-progress').classList.add('skjult');
      renderVideo();
      visMelding('Video lastet opp!', true);
    }, 600);
  } catch (err) {
    document.getElementById('video-progress').classList.add('skjult');
    document.getElementById('video-opplasting').classList.remove('skjult');
    visMelding(err.message, false);
  }
}

function settProgress(pst, tekst) {
  document.getElementById('video-progress-bar').style.width = pst + '%';
  document.getElementById('video-progress-prosent').textContent = pst + '%';
  document.getElementById('video-progress-tekst').textContent = tekst;
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const actions = {
    lagreBeskrivelse: async () => {
      await lagreProfil({ beskrivelse: document.getElementById('beskrivelse-input').value.trim() });
      renderProfil();
      visMelding('Lagret!', true);
    },
    lagreTilbyr: async () => {
      await lagreProfil({ hvaViTilbyr: document.getElementById('tilbyr-input').value.trim() });
      renderProfil();
      visMelding('Lagret!', true);
    },
    lagreStedOgStorrelse: async () => {
      await lagreProfil({
        sted: document.getElementById('edit-sted').value.trim(),
        antallAnsatte: document.getElementById('edit-antall').value.trim()
      });
      renderProfil();
      visMelding('Lagret!', true);
    },
    lagreVerdier: async () => {
      await lagreProfil({ verdier: document.getElementById('verdier-input').value.trim() });
      renderProfil();
      visMelding('Lagret!', true);
    },
    slettVideo: async () => {
      if (!confirm('Slette videoen?')) return;
      const token = await getToken();
      const res = await fetch('/api/cv/bedrift-video', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).feil || 'Feil');
      profil.videoURL = null;
      profil.videoFilnavn = null;
      renderVideo();
      visMelding('Video slettet.', true);
    },
    lagreBedriftsnavn: async () => {
      const nyttNavn = document.getElementById('edit-bedriftsnavn').value.trim();
      if (!nyttNavn) { visMelding('Bedriftsnavn kan ikke være tomt.', false); return; }
      await oppdaterBruker({ navn: nyttNavn });
      profil.navn = nyttNavn;
      document.getElementById('profil-navn').textContent = nyttNavn;
      document.getElementById('nav-navn').textContent = nyttNavn;
      visMelding('Bedriftsnavn oppdatert!', true);
    },
    apneVideoInput: () => document.getElementById('videoInput')?.click()
  };
  const fn = actions[el.dataset.action];
  if (fn) fn().catch(err => visMelding(err.message || 'Noe gikk galt', false));
});
