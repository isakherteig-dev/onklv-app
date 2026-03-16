// Perfect Match — app.js (API-versjon)

// ===== AUTENTISERING =====

export function erInnlogget() {
  // Sjekkes server-side via /api/auth/meg — returner true optimistisk,
  // krevInnlogging() gjør den ekte sjekken asynkront
  return document.cookie.includes('pm_token');
}

export async function hentBruker() {
  try {
    const res = await fetch('/api/auth/meg', { credentials: 'include' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function loggInn(epost, passord) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ epost, passord })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.feil || 'Feil e-post eller passord');
  return data;
}

export async function registrerLaerling(data) {
  const res = await fetch('/api/auth/register/laerling', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.feil || 'Registrering feilet');
  return json;
}

export async function registrerBedrift(data) {
  const res = await fetch('/api/auth/register/bedrift', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.feil || 'Registrering feilet');
  return json;
}

export async function oppdaterBruker(oppdateringer) {
  const res = await fetch('/api/auth/profil', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(oppdateringer)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.feil || 'Oppdatering feilet');
  return hentBruker();
}

export async function loggUt() {
  await fetch('/api/auth/logg-ut', { method: 'POST', credentials: 'include' });
  window.location.href = '/';
}

/** Krev innlogging — omdirigerer til /login.html hvis ikke innlogget */
export async function krevInnlogging(rolle) {
  const bruker = await hentBruker();
  if (!bruker) {
    window.location.href = '/login.html';
    return null;
  }
  if (rolle && bruker.rolle !== rolle) {
    window.location.href = '/login.html';
    return null;
  }
  return bruker;
}

// ===== DATAFUNKSJONER =====

export async function hentLaereplasser() {
  const res = await fetch('/api/laereplasser', { credentials: 'include' });
  if (!res.ok) return [];
  return res.json();
}

export async function hentMineAnnonser() {
  const res = await fetch('/api/laereplasser/mine', { credentials: 'include' });
  if (!res.ok) return [];
  return res.json();
}

export async function hentSoknaderLaerling() {
  const res = await fetch('/api/soknader/mine', { credentials: 'include' });
  if (!res.ok) return [];
  return res.json();
}

export async function hentSoknaderBedrift() {
  const res = await fetch('/api/soknader/bedrift', { credentials: 'include' });
  if (!res.ok) return [];
  return res.json();
}

export async function sendSoknad(laerplass_id, melding) {
  const res = await fetch('/api/soknader', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ laerplass_id, melding })
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.feil || 'Søknaden feilet');
  return json;
}

export async function lagreAnnonse(annonseData) {
  const res = await fetch('/api/laereplasser', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(annonseData)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.feil || 'Kunne ikke lagre annonsen');
  return json;
}

export async function slettAnnonse(id) {
  const res = await fetch(`/api/laereplasser/${id}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.feil || 'Sletting feilet');
  }
  return hentMineAnnonser();
}

// ===== DUMMY-DATA (beholdt for admin-dashbordet som ikke har API ennå) =====

export const BEDRIFTER_VENTER = [
  { id: 10, navn: 'Nordnes Rørlegger AS', org_nr: '923456789', bransje: 'Bygg og anlegg', epost: 'post@nordnesror.no', registrert_dato: '2026-03-14' },
  { id: 11, navn: 'Fana Mat & Catering', org_nr: '934567890', bransje: 'Restaurant og matfag', epost: 'kontakt@fanamat.no', registrert_dato: '2026-03-15' }
];

export const LAEREPLASSER = [];

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
  const tekster = { sendt: 'Sendt', under_vurdering: 'Under vurdering', akseptert: 'Akseptert', avvist: 'Avvist' };
  return tekster[status] || status;
}

export function statusBadgeKlasse(status) {
  const klasser = { sendt: 'badge badge-blaa', under_vurdering: 'badge badge-oransje', akseptert: 'badge badge-gronn', avvist: 'badge badge-roed' };
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

// ===== SCROLL REVEAL (IntersectionObserver) =====
export function initScrollReveal() {
  const elementer = document.querySelectorAll('.reveal');
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
