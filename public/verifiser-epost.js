import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

const params  = new URLSearchParams(window.location.search);

function sanitiserInternSti(sti) {
  if (!sti || typeof sti !== 'string' || !sti.startsWith('/') || sti.startsWith('//')) {
    return '';
  }
  try {
    const url = new URL(sti, window.location.origin);
    if (url.origin !== window.location.origin) return '';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '';
  }
}

const epost   = params.get('epost') || '';
const uid     = params.get('uid')   || '';
const returnTo = sanitiserInternSti(params.get('returnTo') || '');

document.getElementById('epost-visning').textContent = epost || 'e-postadressen din';

const felter      = Array.from(document.querySelectorAll('.pin-felt'));
const varselEl    = document.getElementById('varsel');
const bekreftBtn  = document.getElementById('bekreft-btn');
const sendPaaNytt = document.getElementById('send-paa-nytt-btn');

let cachetToken = sessionStorage.getItem('olkv-verif-token') || null;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    cachetToken = await user.getIdToken();
    sessionStorage.setItem('olkv-verif-token', cachetToken);
  }
});

async function hentToken() {
  if (auth.currentUser) {
    return auth.currentUser.getIdToken();
  }
  return cachetToken;
}

felter.forEach((felt, i) => {
  felt.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace') {
      if (felt.value) {
        felt.value = '';
      } else if (i > 0) {
        felter[i - 1].focus();
        felter[i - 1].value = '';
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && i > 0) {
      felter[i - 1].focus();
    } else if (e.key === 'ArrowRight' && i < felter.length - 1) {
      felter[i + 1].focus();
    }
  });

  felt.addEventListener('input', (e) => {
    const val = e.target.value.replace(/\D/g, '');
    if (!val) { felt.value = ''; return; }
    felt.value = val[0];
    felter.forEach(f => f.classList.remove('feil'));
    skjulVarsel();
    if (i < felter.length - 1) {
      felter[i + 1].focus();
    } else {
      const kode = felter.map(f => f.value).join('');
      if (kode.length === 6) sendKode(kode);
    }
  });

  felt.addEventListener('paste', (e) => {
    e.preventDefault();
    const tekst = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
    if (tekst.length >= 6) {
      felter.forEach((f, idx) => { f.value = tekst[idx] || ''; });
      felter[5].focus();
      sendKode(tekst.slice(0, 6));
    }
  });
});

felter[0].focus();

function visVarsel(tekst, type = 'feil') {
  varselEl.className = type === 'suksess' ? 'varsel varsel-suksess' : 'varsel varsel-feil';
  varselEl.textContent = tekst;
  varselEl.classList.remove('skjult');
}
function skjulVarsel() {
  varselEl.classList.add('skjult');
}
function markerFeil() {
  felter.forEach(f => f.classList.add('feil'));
}
function nullstillFelter() {
  felter.forEach(f => { f.value = ''; f.classList.remove('feil'); });
  felter[0].focus();
}

async function sendKode(kode) {
  if (!uid) {
    visVarsel('Mangler bruker-ID. Prøv å registrere deg på nytt.');
    return;
  }

  bekreftBtn.disabled = true;
  bekreftBtn.textContent = 'Sjekker…';

  try {
    const res  = await fetch('/api/auth/verifiser-kode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, kode })
    });
    const data = await res.json();

    if (!res.ok) {
      markerFeil();
      visVarsel(data.feil || 'Feil kode. Prøv igjen.');
      bekreftBtn.disabled = false;
      bekreftBtn.textContent = 'Bekreft kode →';
      if (data.feil?.includes('utløpt') || data.feil?.includes('Be om en ny kode')) {
        nullstillFelter();
      }
      return;
    }

    sessionStorage.removeItem('olkv-verif-token');
    visVarsel('E-posten din er bekreftet!', 'suksess');
    bekreftBtn.textContent = 'Sender deg videre…';

    setTimeout(async () => {
      try {
        const token = await hentToken();
        const megRes = await fetch('/api/auth/meg', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const meg = megRes.ok ? await megRes.json() : null;
        const rolle = meg?.rolle;
        if (rolle === 'bedrift') {
          window.location.href = '/bedrift/dashboard.html';
        } else if (rolle === 'laerling') {
          window.location.href = returnTo || '/laerling/dashboard.html';
        } else {
          window.location.href = '/login.html';
        }
      } catch {
        window.location.href = '/login.html';
      }
    }, 2000);
  } catch {
    visVarsel('Noe gikk galt. Prøv igjen om litt.');
    bekreftBtn.disabled = false;
    bekreftBtn.textContent = 'Bekreft kode →';
  }
}

bekreftBtn.addEventListener('click', () => {
  const kode = felter.map(f => f.value).join('');
  if (kode.length < 6) {
    visVarsel('Fyll inn alle 6 sifrene.');
    return;
  }
  sendKode(kode);
});

sendPaaNytt.addEventListener('click', async () => {
  const token = await hentToken();
  if (!token) {
    visVarsel('Du må logge inn igjen for å sende ny kode. Gå til innlogging.');
    return;
  }

  sendPaaNytt.disabled = true;
  sendPaaNytt.textContent = 'Sender…';

  try {
    const res  = await fetch('/api/auth/send-verifisering', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (!res.ok) {
      visVarsel(data.feil || 'Kunne ikke sende kode. Prøv igjen.');
    } else {
      nullstillFelter();
      visVarsel('Ny kode er sendt! Sjekk innboksen din.', 'suksess');
    }
  } catch {
    visVarsel('Noe gikk galt. Prøv igjen om litt.');
  } finally {
    sendPaaNytt.disabled = false;
    sendPaaNytt.textContent = 'Send koden på nytt';
  }
});
