import { loggInn, loggInnMedGoogle, visFeilmelding, oversettFirebaseFeil } from './app.js';
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

const params = new URLSearchParams(window.location.search);

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

function byggInternLenke(path, ekstraParams = {}) {
  const url = new URL(path, window.location.origin);
  Object.entries(ekstraParams).forEach(([nokkel, verdi]) => {
    if (verdi) {
      url.searchParams.set(nokkel, verdi);
    }
  });
  if (returnTo) {
    url.searchParams.set('returnTo', returnTo);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

function destinasjonFor(bruker) {
  if (bruker?.rolle === 'laerling' && returnTo) {
    return returnTo;
  }
  const sider = { laerling: '/laerling/dashboard.html', bedrift: '/bedrift/dashboard.html', admin: '/admin/dashboard.html' };
  return sider[bruker?.rolle] || '/';
}

function oppdaterRegisterLenker(rolle = 'laerling') {
  const navRegisterLenke = document.getElementById('nav-register-lenke');
  const startRegisterLenke = document.getElementById('start-register-lenke');
  const regLaerlingLenke = document.getElementById('reg-laerling-lenke');
  const regBedriftLenke = document.getElementById('reg-bedrift-lenke');

  navRegisterLenke.href = byggInternLenke('/register.html');
  startRegisterLenke.href = byggInternLenke('/register.html');
  regLaerlingLenke.href = byggInternLenke('/register.html', { rolle: 'laerling' });
  regBedriftLenke.href = byggInternLenke('/register.html', { rolle: 'bedrift' });
}

// Redirect hvis allerede innlogget (og e-post er verifisert)
auth.authStateReady().then(async () => {
  const user = auth.currentUser;
  if (!user) return;
  const erGoogle = user.providerData?.some(p => p.providerId === 'google.com');
  if (!erGoogle && !user.emailVerified) return;
  try {
    const token = await user.getIdToken();
    const res = await fetch('/api/auth/meg', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const bruker = await res.json();
    window.location.href = destinasjonFor(bruker);
  } catch { /* la brukeren logge inn på nytt */ }
});

let valgtRolle = 'laerling';
oppdaterRegisterLenker(valgtRolle);

function byttTilSteg2(rolle) {
  valgtRolle = rolle;
  document.getElementById('login-tagline').textContent =
    rolle === 'laerling' ? 'Logg inn som lærling' : 'Logg inn som bedrift';
  oppdaterRegisterLenker(rolle === 'laerling' ? 'laerling' : 'bedrift');

  const steg1 = document.getElementById('steg-1');
  const steg2 = document.getElementById('steg-2');
  steg1.style.display = 'none';
  steg2.style.display = 'flex';
  steg2.style.animation = 'none';
  steg2.offsetHeight; // reflow
  steg2.style.animation = '';
}

function byttTilSteg1() {
  const steg1 = document.getElementById('steg-1');
  const steg2 = document.getElementById('steg-2');
  steg2.style.display = 'none';
  steg1.style.display = 'flex';
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

const form = document.getElementById('login-form');
const btn  = document.getElementById('logg-inn-btn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const epost  = document.getElementById('epost').value.trim();
  const passord = document.getElementById('passord').value;

  if (!epost || !passord) {
    visFeilmelding('Fyll ut e-post og passord');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Logger inn…';

  try {
    const bruker = await loggInn(epost, passord);
    window.location.href = destinasjonFor(bruker);
  } catch (err) {
    if (err.message?.includes('verifisere e-posten')) {
      const varselEl = document.getElementById('varsel');
      varselEl.className = 'varsel varsel-feil';
      varselEl.innerHTML = `Du må bekrefte e-posten din før du kan logge inn. <a href="/verifiser-epost.html?epost=${encodeURIComponent(epost)}&uid=" style="color:inherit;font-weight:700;text-decoration:underline;">Gå til verifisering →</a>`;
      varselEl.classList.remove('skjult');
      varselEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      const melding = err.message?.includes('venter godkjenning')
        ? 'Bedriftskontoen din venter godkjenning fra Opplæringskontoret. Du får beskjed på e-post når den er klar.'
        : (oversettFirebaseFeil(err.code) || err.message || 'Feil e-post eller passord');
      visFeilmelding(melding);
    }
    btn.disabled = false;
    btn.textContent = 'Logg inn →';
  }
});

document.getElementById('google-btn').addEventListener('click', async () => {
  try {
    const bruker = await loggInnMedGoogle();
    if (!bruker) return; // Sendt til registrering
    window.location.href = destinasjonFor(bruker);
  } catch (err) {
    const melding = err.message?.includes('venter godkjenning')
      ? 'Bedriftskontoen din venter godkjenning fra Opplæringskontoret. Du får beskjed på e-post når den er klar.'
      : (oversettFirebaseFeil(err.code) || err.message || 'Google-innlogging feilet');
    visFeilmelding(melding);
  }
});
