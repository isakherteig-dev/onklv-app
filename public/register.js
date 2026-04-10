import { visFeilmelding, oversettFirebaseFeil } from './app.js';
import { auth } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

const params = new URLSearchParams(window.location.search);
let rolle = 'laerling';

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

const returnTo = sanitiserInternSti(params.get('returnTo') || '');

function byggInnloggingsLenke() {
  const url = new URL('/login.html', window.location.origin);
  if (returnTo) {
    url.searchParams.set('returnTo', returnTo);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

function oppdaterInnloggingsLenker() {
  const innloggingLenke = byggInnloggingsLenke();
  ['nav-login-lenke', 'start-login-lenke', 'suksess-login-lenke', 'bunn-login-lenke'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.href = innloggingLenke;
  });
}

oppdaterInnloggingsLenker();

function oppdaterSkjema() {
  document.getElementById('laerling-felt').classList.toggle('skjult', rolle !== 'laerling');
  document.getElementById('bedrift-felt').classList.toggle('skjult', rolle !== 'bedrift');
  document.getElementById('side-tittel').textContent = rolle === 'laerling' ? 'Registrer som lærling' : 'Registrer bedrift';
  document.getElementById('side-ingress').textContent = rolle === 'laerling'
    ? 'Lag profil, last opp CV og bli matchet med riktig bedrift.'
    : 'Registrer bedriften din og motta søknader fra kvalifiserte lærlinger.';
}

function byttTilSteg2(nyRolle) {
  rolle = nyRolle;
  oppdaterSkjema();

  const steg1 = document.getElementById('steg-1');
  const steg2 = document.getElementById('steg-2');
  steg1.style.display = 'none';
  steg2.style.display = 'block';
  steg2.style.animation = 'none';
  steg2.offsetHeight;
  steg2.style.animation = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function byttTilSteg1() {
  const steg1 = document.getElementById('steg-1');
  const steg2 = document.getElementById('steg-2');
  steg2.style.display = 'none';
  steg1.style.display = 'block';
  steg1.style.animation = 'none';
  steg1.offsetHeight;
  steg1.style.animation = '';
  document.getElementById('varsel').classList.add('skjult');
}

// Rolle-knapper
document.querySelectorAll('.rolle-kort[data-rolle]').forEach(btn => {
  btn.addEventListener('click', () => byttTilSteg2(btn.dataset.rolle));
});

// Tilbake-knapp
document.getElementById('tilbake-btn').addEventListener('click', byttTilSteg1);

// Pre-fyll fra URL-params og hopp til steg 2 om rolle er satt
const fraGoogle = !!params.get('uid');
let googleResultat = null;

if (params.get('rolle')) {
  rolle = params.get('rolle') === 'bedrift' ? 'bedrift' : 'laerling';
  oppdaterSkjema();
  document.getElementById('steg-1').style.display = 'none';
  document.getElementById('steg-2').style.display = 'block';
}

if (params.get('navn'))  document.getElementById('navn').value  = params.get('navn');
if (params.get('epost')) {
  document.getElementById('epost').value    = params.get('epost');
  document.getElementById('epost').readOnly = fraGoogle;
}

if (fraGoogle) {
  document.getElementById('passord-seksjon').classList.add('skjult');
  document.getElementById('reg-btn').classList.add('skjult');

  const banner = document.createElement('div');
  banner.className = 'varsel';
  banner.style.cssText = 'margin-bottom:1.25rem;background:#eff6ff;border-color:var(--olkv-blue-light);color:var(--olkv-dark);font-size:0.9rem;';
  banner.innerHTML = '<strong>Google-konto koblet!</strong> Velg rolle, fyll ut feltene nedenfor og klikk <strong>«Registrer med Google»</strong> for å fullføre registreringen.';
  document.getElementById('reg-form').insertBefore(banner, document.getElementById('reg-form').firstChild);
}

function aktiverGoogleFullforMode() {
  document.getElementById('google-btn').classList.add('skjult');
  document.getElementById('passord-seksjon').classList.add('skjult');

  document.getElementById('navn').value = googleResultat.navn;
  document.getElementById('epost').value = googleResultat.epost;
  document.getElementById('epost').readOnly = true;

  document.getElementById('eller-skillelinje').classList.add('skjult');

  const banner = document.createElement('div');
  banner.id = 'google-banner';
  banner.className = 'varsel';
  banner.style.cssText = 'margin-bottom:1.25rem;background:#eff6ff;border-color:var(--olkv-blue-light);color:var(--olkv-dark);font-size:0.9rem;';
  banner.innerHTML = '<strong>Google-konto koblet!</strong> Fyll ut de resterende feltene og klikk <strong>«Fullfør registrering»</strong>.';
  document.getElementById('reg-form').insertBefore(banner, document.getElementById('reg-form').firstChild);

  document.getElementById('reg-btn').textContent = 'Fullfør registrering →';
}

document.getElementById('passord').addEventListener('input', function() {
  const v = this.value;
  let styrke = 0;
  if (v.length >= 8)  styrke++;
  if (/[A-Z]/.test(v)) styrke++;
  if (/[0-9]/.test(v)) styrke++;
  if (/[^A-Za-z0-9]/.test(v)) styrke++;
  const farger = ['', '#ef4444', '#f97316', '#eab308', '#22c55e'];
  const fyll = document.getElementById('passord-styrke-fyll');
  fyll.style.width = `${styrke * 25}%`;
  fyll.style.background = farger[styrke] || '';
});

async function registrer(uid, epost, navn, token) {
  const body = {
    uid, epost, navn, rolle, samtykkeVersjon: '1.0',
    ...(rolle === 'laerling' ? {
      utdanningsprogram: document.getElementById('utdanningsprogram').value,
      skole: document.getElementById('skole').value
    } : {
      orgNr: document.getElementById('orgnr').value.trim(),
      bransje: document.getElementById('bransje').value
    })
  };

  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.feil || 'Registrering feilet');
  return data;
}

function visBekreftelse(venterGodkjenning) {
  document.getElementById('reg-form').classList.add('skjult');
  document.getElementById('suksess-boks').classList.remove('skjult');
  document.getElementById('suksess-tekst').textContent = venterGodkjenning
    ? 'Bedriften din er registrert og venter godkjenning fra Opplæringskontoret i Vestland. Du vil motta e-post når kontoen er klar.'
    : 'Sjekk e-posten din for en verifiseringslenke. Du kan logge inn etter at e-posten er bekreftet.';
}

document.getElementById('reg-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  if (googleResultat) {
    const samtykke = document.getElementById('samtykke').checked;
    if (!samtykke) {
      visFeilmelding('Du må godta personvernerklæringen for å registrere deg'); return;
    }
    if (rolle === 'laerling' && !document.getElementById('utdanningsprogram').value) {
      visFeilmelding('Velg utdanningsprogram'); return;
    }
    if (rolle === 'bedrift') {
      const orgnr = document.getElementById('orgnr').value.trim();
      if (!orgnr || !/^\d{9}$/.test(orgnr)) {
        visFeilmelding('Fyll inn et gyldig organisasjonsnummer (9 siffer)'); return;
      }
      if (!document.getElementById('bransje').value) {
        visFeilmelding('Velg bransje'); return;
      }
    }

    const btn = document.getElementById('reg-btn');
    btn.disabled = true;
    btn.textContent = 'Fullfører registrering…';

    try {
      const data = await registrer(googleResultat.uid, googleResultat.epost, googleResultat.navn, googleResultat.token);
      visBekreftelse(data.venterGodkjenning);
    } catch (err) {
      visFeilmelding(oversettFirebaseFeil(err.code) || err.message);
      btn.disabled = false;
      btn.textContent = 'Fullfør registrering →';
    }
    return;
  }

  const navn    = document.getElementById('navn').value.trim();
  const epost   = document.getElementById('epost').value.trim();
  const passord = document.getElementById('passord').value;
  const passord2 = document.getElementById('passord2').value;
  const samtykke = document.getElementById('samtykke').checked;

  if (!navn || !epost || !passord) {
    visFeilmelding('Fyll ut alle påkrevde felter'); return;
  }
  if (passord.length < 8) {
    visFeilmelding('Passordet må være minst 8 tegn'); return;
  }
  if (passord !== passord2) {
    visFeilmelding('Passordene stemmer ikke overens'); return;
  }
  if (!samtykke) {
    visFeilmelding('Du må godta personvernerklæringen for å registrere deg'); return;
  }
  if (rolle === 'laerling' && !document.getElementById('utdanningsprogram').value) {
    visFeilmelding('Velg utdanningsprogram'); return;
  }
  if (rolle === 'bedrift') {
    if (!document.getElementById('orgnr').value.trim()) {
      visFeilmelding('Fyll inn organisasjonsnummer'); return;
    }
    if (!document.getElementById('bransje').value) {
      visFeilmelding('Velg bransje'); return;
    }
  }

  const btn = document.getElementById('reg-btn');
  btn.disabled = true;
  btn.textContent = 'Oppretter konto…';

  try {
    const result = await createUserWithEmailAndPassword(auth, epost, passord);
    const token  = await result.user.getIdToken();

    const data = await registrer(result.user.uid, epost, navn, token);

    try {
      await fetch('/api/auth/send-verifisering', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      });
    } catch (epostErr) {
      console.error('send-verifisering feilet:', epostErr);
    }

    if (data.venterGodkjenning) {
      visBekreftelse(true);
    } else {
      sessionStorage.setItem('olkv-verif-token', token);
      const verifiserParams = new URLSearchParams({ epost, uid: result.user.uid });
      if (returnTo) verifiserParams.set('returnTo', returnTo);
      window.location.href = `/verifiser-epost.html?${verifiserParams.toString()}`;
    }
  } catch (err) {
    visFeilmelding(oversettFirebaseFeil(err.code) || err.message);
    btn.disabled = false;
    btn.textContent = 'Opprett konto →';
  }
});

document.getElementById('google-btn').addEventListener('click', async () => {
  try {
    const provider = new GoogleAuthProvider();
    const result   = await signInWithPopup(auth, provider);
    const token    = await result.user.getIdToken();

    googleResultat = {
      uid:   result.user.uid,
      epost: result.user.email,
      navn:  result.user.displayName || document.getElementById('navn').value.trim() || 'Ukjent navn',
      token
    };

    aktiverGoogleFullforMode();
  } catch (err) {
    visFeilmelding(oversettFirebaseFeil(err.code) || err.message);
  }
});
