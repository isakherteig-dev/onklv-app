// Perfect Match — app.js
// Bruker Firebase Authentication via CDN-importert Client SDK

import { auth } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

// ===== HJELPEFUNKSJON: HENT TOKEN =====

/** Returnerer Firebase ID-token for innlogget bruker, eller null */
export async function getToken() {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

/** Returnerer Authorization-header for API-kall */
async function authHeaders() {
  const token = await getToken();
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

// ===== AUTENTISERING =====

export function erInnlogget() {
  return auth.currentUser !== null;
}

export async function hentBruker() {
  try {
    const headers = await authHeaders();
    if (!headers.Authorization) return null;
    const res = await fetch('/api/auth/meg', { headers });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Logg inn med e-post + passord via Firebase Auth.
 * Kaller /api/auth/login-update for å oppdatere sist innlogget og hente rolle.
 */
export async function loggInn(epost, passord) {
  const result = await signInWithEmailAndPassword(auth, epost, passord);
  const token = await result.user.getIdToken();

  const res = await fetch('/api/auth/login-update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.feil || 'Innlogging feilet');
  return data.bruker;
}

/**
 * Logg inn med Google via popup.
 * Hvis brukeren ikke finnes i Firestore, sendes de til registreringssiden.
 */
export async function loggInnMedGoogle() {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const token = await result.user.getIdToken();

  const res = await fetch('/api/auth/login-update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  });

  if (res.status === 404) {
    // Ny bruker via Google — send til registrering
    const params = new URLSearchParams({
      uid:   result.user.uid,
      epost: result.user.email || '',
      navn:  result.user.displayName || ''
    });
    window.location.href = `/register.html?${params.toString()}`;
    return null;
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.feil || 'Innlogging feilet');
  return data.bruker;
}

/**
 * Registrer lærling via Firebase Auth + backend Firestore.
 */
export async function registrerLaerling(data) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, rolle: 'laerling' })
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.feil || 'Registrering feilet');
  return json;
}

/**
 * Registrer bedrift via Firebase Auth + backend Firestore.
 */
export async function registrerBedrift(data) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, rolle: 'bedrift' })
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.feil || 'Registrering feilet');
  return json;
}

export async function oppdaterBruker(oppdateringer) {
  const headers = await authHeaders();
  const res = await fetch('/api/auth/profil', {
    method: 'PATCH',
    headers,
    body: JSON.stringify(oppdateringer)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.feil || 'Oppdatering feilet');
  return hentBruker();
}

export async function slettMinKonto() {
  const headers = await authHeaders();
  const res = await fetch('/api/auth/slett-konto', {
    method: 'DELETE',
    headers
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.feil || 'Sletting feilet');

  sessionStorage.setItem('olkv-konto-slettet', 'true');
  await signOut(auth).catch(() => {});
  window.location.href = '/';
  return json;
}

export async function loggUt() {
  await signOut(auth);
  window.location.href = '/';
}

/**
 * Krev innlogging — omdirigerer til /login.html hvis ikke innlogget.
 * Returnerer brukerobjektet ved suksess.
 */
export function krevInnlogging(rolle) {
  return new Promise((resolve) => {
    const avregistrer = onAuthStateChanged(auth, async (firebaseUser) => {
      avregistrer(); // Kjør kun én gang
      if (!firebaseUser) {
        window.location.href = '/login.html';
        resolve(null);
        return;
      }

      const bruker = await hentBruker();
      if (!bruker) {
        window.location.href = '/login.html';
        resolve(null);
        return;
      }

      if (rolle && bruker.rolle !== rolle && bruker.rolle !== 'admin') {
        window.location.href = '/login.html';
        resolve(null);
        return;
      }

      resolve(bruker);
    });
  });
}

// ===== DATAFUNKSJONER =====

export async function hentLaereplasser() {
  const res = await fetch('/api/laereplasser');
  if (!res.ok) return [];
  return res.json();
}

export async function hentMineAnnonser() {
  const headers = await authHeaders();
  const res = await fetch('/api/laereplasser/mine', { headers });
  if (!res.ok) return [];
  return res.json();
}

export async function hentSoknaderLaerling() {
  const headers = await authHeaders();
  const res = await fetch('/api/soknader/mine', { headers });
  if (!res.ok) return [];
  return res.json();
}

export async function hentSoknaderBedrift() {
  const headers = await authHeaders();
  const res = await fetch('/api/soknader/bedrift', { headers });
  if (!res.ok) return [];
  return res.json();
}

export async function sendSoknad(laerplass_id, melding) {
  const headers = await authHeaders();
  const res = await fetch('/api/soknader', {
    method: 'POST',
    headers,
    body: JSON.stringify({ laerplass_id, melding })
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.feil || 'Søknaden feilet');
  return json;
}

export async function lagreAnnonse(annonseData) {
  const headers = await authHeaders();
  const res = await fetch('/api/laereplasser', {
    method: 'POST',
    headers,
    body: JSON.stringify(annonseData)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.feil || 'Kunne ikke lagre annonsen');
  return json;
}

export async function slettAnnonse(id) {
  const headers = await authHeaders();
  const res = await fetch(`/api/laereplasser/${id}`, { method: 'DELETE', headers });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.feil || 'Sletting feilet');
  }
  return hentMineAnnonser();
}

// Admin: hent ventende bedrifter fra Firestore via backend
export async function hentBedrifterVenter() {
  const headers = await authHeaders();
  const res = await fetch('/api/admin/bedrifter-venter', { headers });
  if (!res.ok) return [];
  return res.json();
}

export async function godkjennBedrift(uid) {
  const headers = await authHeaders();
  const res = await fetch(`/api/admin/bedrifter/${uid}/godkjenn`, { method: 'PATCH', headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.feil || 'Godkjenning feilet');
  return json;
}

export async function avvisBedrift(uid) {
  const headers = await authHeaders();
  const res = await fetch(`/api/admin/bedrifter/${uid}/avvis`, { method: 'PATCH', headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.feil || 'Avvisning feilet');
  return json;
}

export async function oppdaterSoknadStatus(id, status) {
  const headers = await authHeaders();
  const res = await fetch(`/api/soknader/${id}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status })
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.feil || 'Statusoppdatering feilet');
  return json;
}

// ===== HJELPEFUNKSJONER =====

export function visFeilmelding(tekst, elementId = 'varsel') {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.className = 'varsel varsel-feil';
  el.textContent = tekst;
  el.classList.remove('skjult');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

export function visBekreftelse(tekst, elementId = 'varsel') {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.className = 'varsel varsel-suksess';
  el.textContent = tekst;
  el.classList.remove('skjult');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

export function skjulVarsel(elementId = 'varsel') {
  const el = document.getElementById(elementId);
  if (el) el.classList.add('skjult');
}

export function formaterDato(datoStreng) {
  if (!datoStreng) return '—';
  const dato = new Date(datoStreng + 'T00:00:00');
  return dato.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function statusTekst(status) {
  const tekster = {
    sendt:             'Sendt',
    under_behandling:  'Under behandling',
    godkjent:          'Godkjent',
    avslatt:           'Avslått',
    trukket:           'Trukket',
    // bakoverkompatibilitet
    under_vurdering:   'Under vurdering',
    akseptert:         'Akseptert',
    avvist:            'Avvist'
  };
  return tekster[status] || status;
}

export function statusBadgeKlasse(status) {
  const klasser = {
    sendt:             'badge badge-sendt',
    under_behandling:  'badge badge-behandling',
    godkjent:          'badge badge-godkjent',
    avslatt:           'badge badge-avslatt',
    trukket:           'badge badge-trukket',
    // bakoverkompatibilitet
    under_vurdering:   'badge badge-behandling',
    akseptert:         'badge badge-godkjent',
    avvist:            'badge badge-avslatt'
  };
  return klasser[status] || 'badge badge-graa';
}

export function initialFra(navn) {
  if (!navn) return '?';
  return navn.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function beregnProfilkomplettering(bruker) {
  let score = 0;
  if (bruker.navn) score += 25;
  if (bruker.epost) score += 20;
  if (bruker.utdanningsprogram) score += 20;
  if (bruker.bio && bruker.bio.length > 20) score += 20;
  if (bruker.cv_filnavn) score += 15;
  return score;
}

/** Oversett Firebase-feilkoder til norsk tekst */
export function oversettFirebaseFeil(kode) {
  const feil = {
    'auth/invalid-email':              'Ugyldig e-postadresse',
    'auth/user-disabled':              'Denne kontoen er deaktivert',
    'auth/user-not-found':             'Ingen konto funnet med denne e-posten',
    'auth/wrong-password':             'Feil passord',
    'auth/invalid-credential':         'Feil e-post eller passord',
    'auth/email-already-in-use':       'Denne e-postadressen er allerede registrert',
    'auth/weak-password':              'Passordet må være minst 6 tegn',
    'auth/too-many-requests':          'For mange forsøk. Prøv igjen om litt.',
    'auth/network-request-failed':     'Nettverksfeil — sjekk internettforbindelsen',
    'auth/popup-closed-by-user':       'Innloggingsvinduet ble lukket',
    'auth/cancelled-popup-request':    'Innloggingsvinduet ble avbrutt',
    'auth/popup-blocked':              'Nettleseren blokkerte innloggingsvinduet — tillat popup for denne siden',
    'auth/operation-not-allowed':      'Denne innloggingsmetoden er ikke aktivert',
    'auth/unauthorized-domain':        'Denne nettsiden er ikke autorisert for Google-innlogging. Sjekk Firebase Console → Authentication → Settings → Authorized domains'
  };
  return feil[kode] || null;
}

// ===== SCROLL REVEAL =====
export function initScrollReveal() {
  const elementer = document.querySelectorAll('.reveal, .reveal-left, .reveal-scale');
  if (!elementer.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  elementer.forEach(el => observer.observe(el));
}

// ===== FAGOMRÅDER =====
export const fagomraader = [
  'Salg, service og reiseliv',
  'Helse- og oppvekstfag',
  'Bygg- og anleggsteknikk',
  'Elektro og datateknologi',
  'Teknologi- og industrifag',
  'Restaurant- og matfag',
  'Naturbruk',
  'Design og håndverk',
  'Informasjonsteknologi og medieproduksjon',
  'Frisør, blomster, interiør og eksponeringsdesign',
  'Transport og logistikk',
  'Kontor og administrasjon',
  'Renhold',
  'Annet'
];

// ===== UTVIDEDE API-FUNKSJONER =====

export async function sendSoknadFull(data) {
  const token = await getToken();
  const erFormData = data instanceof FormData;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  if (!erFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch('/api/soknader', {
    method: 'POST',
    headers,
    body: erFormData ? data : JSON.stringify(data)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.feil || 'Søknaden feilet');
  return json;
}

/**
 * Last opp CV-fil til /api/cv (multipart/form-data).
 * Returnerer { cv_filnavn, melding }.
 */
export async function lastOppCV(fil) {
  const token = await getToken();
  const formData = new FormData();
  formData.append('cv', fil);

  const res = await fetch('/api/cv', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.feil || 'Opplasting feilet');
  return json;
}

/**
 * Slett CV-fil fra /api/cv.
 */
export async function slettCV() {
  const headers = await authHeaders();
  const res = await fetch('/api/cv', { method: 'DELETE', headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.feil || 'Sletting feilet');
  return json;
}

export async function trekkSoknad(id) {
  const headers = await authHeaders();
  const res = await fetch(`/api/soknader/${id}`, { method: 'DELETE', headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.feil || 'Trekking feilet');
  return json;
}

export async function hentLaereplassDetaljer(id) {
  const res = await fetch(`/api/laereplasser/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function lagreAnnonseUtvidet(data) {
  const headers = await authHeaders();
  const res = await fetch('/api/laereplasser', {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.feil || 'Kunne ikke lagre annonsen');
  return json;
}

export async function oppdaterAnnonse(id, data) {
  const headers = await authHeaders();
  const res = await fetch(`/api/laereplasser/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.feil || 'Oppdatering feilet');
  return json;
}

// Varsler
export async function hentVarsler() {
  const headers = await authHeaders();
  const res = await fetch('/api/varsler', { headers });
  if (!res.ok) return [];
  return res.json();
}

export async function hentAntallUlesteVarsler() {
  const headers = await authHeaders();
  const res = await fetch('/api/varsler/antall-uleste', { headers });
  if (!res.ok) return 0;
  const json = await res.json();
  return json.antall || 0;
}

export async function markerVarselLest(id) {
  const headers = await authHeaders();
  await fetch(`/api/varsler/${id}/lest`, { method: 'PATCH', headers });
}

export async function markerAlleVarslerLest() {
  const headers = await authHeaders();
  await fetch('/api/varsler/les-alle', { method: 'PATCH', headers });
}

// Admin utvidet
export async function hentAllesoknader(params = {}) {
  const headers = await authHeaders();
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/admin/alle-soknader${qs ? '?' + qs : ''}`, { headers });
  if (!res.ok) return [];
  return res.json();
}

export async function oppdaterSoknadStatusAdmin(id, status, admin_kommentar = '') {
  const headers = await authHeaders();
  const res = await fetch(`/api/admin/soknader/${id}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status, admin_kommentar })
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.feil || 'Statusoppdatering feilet');
  return json;
}

export async function hentAlleLaereplasser(params = {}) {
  const headers = await authHeaders();
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/admin/alle-laereplasser${qs ? '?' + qs : ''}`, { headers });
  if (!res.ok) return [];
  return res.json();
}

export async function hentAlleBrukere(rolle = '') {
  const headers = await authHeaders();
  const qs = rolle ? `?rolle=${rolle}` : '';
  const res = await fetch(`/api/admin/brukere${qs}`, { headers });
  if (!res.ok) return [];
  return res.json();
}

export async function hentAdminStatistikk() {
  const headers = await authHeaders();
  const res = await fetch('/api/admin/statistikk', { headers });
  if (!res.ok) return {};
  return res.json();
}

export async function hentSoknaderBedriftMed(laerplass_id = '') {
  const headers = await authHeaders();
  const qs = laerplass_id ? `?laerplass_id=${laerplass_id}` : '';
  const res = await fetch(`/api/soknader/bedrift${qs}`, { headers });
  if (!res.ok) return [];
  return res.json();
}

// ===== CHAT =====

export async function hentMeldinger(soknadId) {
  const headers = await authHeaders();
  const res = await fetch(`/api/chat/${soknadId}`, { headers });
  if (!res.ok) return { meldinger: [], soknad: null };
  return res.json();
}

export async function sendChatMelding(soknadId, tekst) {
  const headers = await authHeaders();
  const res = await fetch(`/api/chat/${soknadId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ tekst })
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.feil || 'Sending feilet');
  return json;
}

export async function hentUlesteChatMeldinger(soknadId) {
  const headers = await authHeaders();
  const res = await fetch(`/api/chat/${soknadId}/uleste`, { headers });
  if (!res.ok) return { antall: 0 };
  return res.json();
}

// ===== VARSEL-BJELLE INITIALISERING =====
export async function initVarselBjelle(bjelleId = 'varsel-bjelle', dropdownId = 'varsel-dropdown') {
  const bjelle = document.getElementById(bjelleId);
  const dropdown = document.getElementById(dropdownId);
  if (!bjelle || !dropdown) return;

  async function oppdaterBjelle() {
    const antall = await hentAntallUlesteVarsler();
    const badge = bjelle.querySelector('.varsel-bjelle-badge');
    if (badge) {
      badge.textContent = antall > 0 ? (antall > 9 ? '9+' : antall) : '';
      badge.style.display = antall > 0 ? 'flex' : 'none';
    }
  }

  bjelle.addEventListener('click', async (e) => {
    e.stopPropagation();
    const varsler = await hentVarsler();
    await markerAlleVarslerLest();
    await oppdaterBjelle();

    if (varsler.length === 0) {
      dropdown.innerHTML = '<div style="padding:1rem;color:var(--olkv-gray);text-align:center;">Ingen varsler</div>';
    } else {
      dropdown.innerHTML = '';
      varsler.slice(0, 10).forEach(v => {
        const el = document.createElement('div');
        el.className = `varsel-item ${v.lest ? '' : 'varsel-item-ulest'}`;
        el.addEventListener('click', () => { window.location.href = v.lenke || '#'; });

        const tittel = document.createElement('div');
        tittel.className = 'varsel-item-tittel';
        tittel.textContent = v.tittel;

        const melding = document.createElement('div');
        melding.className = 'varsel-item-melding';
        melding.textContent = v.melding || '';

        const tid = document.createElement('div');
        tid.className = 'varsel-item-tid';
        tid.textContent = formaterDato(v.opprettet?.split('T')[0] || v.opprettet);

        el.append(tittel, melding, tid);
        dropdown.appendChild(el);
      });
    }

    dropdown.classList.toggle('skjult');
  });

  document.addEventListener('click', () => dropdown.classList.add('skjult'));

  await oppdaterBjelle();
}

// ===== DUMMY-DATA (beholdt for bakoverkompatibilitet) =====
export const BEDRIFTER_VENTER = [];
export const LAEREPLASSER = [];
