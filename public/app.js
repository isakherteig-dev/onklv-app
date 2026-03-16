// Perfect Match — Felles JavaScript (localStorage-basert auth for MVP)

const PM_BRUKER_KEY = 'pm_bruker';
const PM_SOKNADER_KEY = 'pm_soknader';
const PM_ANNONSER_KEY = 'pm_annonser';

// ===== DEMO-BRUKERE (forhåndsinstallerte testkontoer) =====
const DEMO_BRUKERE = [
  {
    id: 1,
    epost: 'laerling@demo.no',
    passord: 'demo1234',
    rolle: 'laerling',
    navn: 'Marius Haugen',
    utdanningsprogram: 'Elektrofag',
    skole: 'Åsane videregående skole',
    bio: 'Motivert elev fra Bergen som brenner for elektrofaget. Ønsker å lære fra grunnen hos en god bedrift.',
    cv_lastet_opp: false
  },
  {
    id: 2,
    epost: 'bedrift@demo.no',
    passord: 'demo1234',
    rolle: 'bedrift',
    navn: 'Bergen Elektro AS',
    bransje: 'Elektrofag',
    org_nr: '912345678',
    kontakt_navn: 'Kari Andersen',
    godkjent: true
  },
  {
    id: 3,
    epost: 'admin@demo.no',
    passord: 'demo1234',
    rolle: 'admin',
    navn: 'Jimmy Pasali',
    tittel: 'Faglig leder — Opplæringskontoret i Vestland'
  }
];

// ===== AUTENTISERING =====

export function erInnlogget() {
  return !!localStorage.getItem(PM_BRUKER_KEY);
}

export function hentBruker() {
  const data = localStorage.getItem(PM_BRUKER_KEY);
  return data ? JSON.parse(data) : null;
}

export function loggInn(epost, passord) {
  // Sjekk demo-kontoer
  const demo = DEMO_BRUKERE.find(
    b => b.epost.toLowerCase() === epost.toLowerCase() && b.passord === passord
  );
  if (demo) {
    localStorage.setItem(PM_BRUKER_KEY, JSON.stringify(demo));
    return demo;
  }

  // Sjekk registrerte brukere
  const alle = JSON.parse(localStorage.getItem('pm_alle_brukere') || '[]');
  const bruker = alle.find(
    b => b.epost.toLowerCase() === epost.toLowerCase() && b.passord === passord
  );
  if (!bruker) {
    throw new Error('Feil e-post eller passord');
  }
  localStorage.setItem(PM_BRUKER_KEY, JSON.stringify(bruker));
  return bruker;
}

export function registrerLaerling(data) {
  const alle = JSON.parse(localStorage.getItem('pm_alle_brukere') || '[]');

  // Sjekk om e-post allerede er i bruk
  if (alle.find(b => b.epost.toLowerCase() === data.epost.toLowerCase())) {
    throw new Error('Denne e-postadressen er allerede i bruk');
  }

  const bruker = {
    id: Date.now(),
    rolle: 'laerling',
    cv_lastet_opp: false,
    ...data
  };

  alle.push(bruker);
  localStorage.setItem('pm_alle_brukere', JSON.stringify(alle));
  localStorage.setItem(PM_BRUKER_KEY, JSON.stringify(bruker));
  return bruker;
}

export function registrerBedrift(data) {
  const alle = JSON.parse(localStorage.getItem('pm_alle_brukere') || '[]');

  if (alle.find(b => b.epost.toLowerCase() === data.epost.toLowerCase())) {
    throw new Error('Denne e-postadressen er allerede i bruk');
  }

  const bruker = {
    id: Date.now(),
    rolle: 'bedrift',
    godkjent: false,
    ...data
  };

  alle.push(bruker);
  localStorage.setItem('pm_alle_brukere', JSON.stringify(alle));
  // Bedrift logger IKKE inn automatisk — venter på godkjenning
  return bruker;
}

export function oppdaterBruker(oppdateringer) {
  const bruker = hentBruker();
  if (!bruker) return;
  const oppdatert = { ...bruker, ...oppdateringer };
  localStorage.setItem(PM_BRUKER_KEY, JSON.stringify(oppdatert));

  // Oppdater i "alle brukere" også
  const alle = JSON.parse(localStorage.getItem('pm_alle_brukere') || '[]');
  const idx = alle.findIndex(b => b.id === bruker.id);
  if (idx !== -1) {
    alle[idx] = oppdatert;
    localStorage.setItem('pm_alle_brukere', JSON.stringify(alle));
  }
  return oppdatert;
}

export function loggUt() {
  localStorage.removeItem(PM_BRUKER_KEY);
  window.location.href = '/';
}

/** Krev innlogging — omdirigerer til /login.html hvis ikke innlogget */
export function krevInnlogging(rolle) {
  const bruker = hentBruker();
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

// ===== DUMMY DATA =====

export const LAEREPLASSER = [
  {
    id: 1,
    tittel: 'Elektriker-lærling',
    bedrift_navn: 'Bergen Elektro AS',
    bransje: 'Elektrofag',
    sted: 'Bergen',
    frist: '2026-04-15',
    antall_plasser: 2,
    beskrivelse: 'Vi søker motiverte lærlinger til elektroarbeid på næringsbygg og boliger i Bergensregionen. Du vil jobbe tett med erfarne fagarbeidere og lære yrket fra bunnen.',
    aktiv: true
  },
  {
    id: 2,
    tittel: 'Industrimekaniker-lærling',
    bedrift_navn: 'Vestland Industri AS',
    bransje: 'Teknikk og industriell produksjon',
    sted: 'Øygarden',
    frist: '2026-05-01',
    antall_plasser: 1,
    beskrivelse: 'Spennende lærlingplass i maritim industri. Du vil jobbe med vedlikehold og reparasjon av industrielt utstyr i et moderne verksted.',
    aktiv: true
  },
  {
    id: 3,
    tittel: 'Rørlegger-lærling',
    bedrift_navn: 'VVS-Service Vest AS',
    bransje: 'Bygg og anlegg',
    sted: 'Stavanger',
    frist: '2026-03-30',
    antall_plasser: 3,
    beskrivelse: 'Bli med på spennende VVS-prosjekter i hele regionen. Vi har et godt fagmiljø og legger vekt på god opplæring.',
    aktiv: true
  },
  {
    id: 4,
    tittel: 'Kokk-lærling',
    bedrift_navn: 'Hotel Bryggen',
    bransje: 'Restaurant og matfag',
    sted: 'Bergen',
    frist: '2026-04-01',
    antall_plasser: 1,
    beskrivelse: 'Lær kokkeyrket på et av Bergens mest kjente hoteller. Du vil jobbe i et profesjonelt kjøkken med fokus på norske råvarer.',
    aktiv: true
  },
  {
    id: 5,
    tittel: 'IKT-servicefag lærling',
    bedrift_navn: 'Techfirma Bergen AS',
    bransje: 'IKT',
    sted: 'Bergen',
    frist: '2026-05-15',
    antall_plasser: 2,
    beskrivelse: 'Vi søker IT-interesserte lærlinger til drift og support av systemer. Gode muligheter for faglig utvikling.',
    aktiv: true
  }
];

const STANDARD_SOKNADER = [
  {
    id: 1,
    laerplass_id: 1,
    tittel: 'Elektriker-lærling',
    bedrift_navn: 'Bergen Elektro AS',
    status: 'under_vurdering',
    sendt_dato: '2026-03-10',
    melding: 'Jeg er veldig interessert i denne lærlingplassen og har stor motivasjon for elektrofaget.'
  },
  {
    id: 2,
    laerplass_id: 3,
    tittel: 'Rørlegger-lærling',
    bedrift_navn: 'VVS-Service Vest AS',
    status: 'sendt',
    sendt_dato: '2026-03-12',
    melding: 'Søker herved om lærlingplass som rørlegger.'
  },
  {
    id: 3,
    laerplass_id: 5,
    tittel: 'IKT-servicefag lærling',
    bedrift_navn: 'Techfirma Bergen AS',
    status: 'akseptert',
    sendt_dato: '2026-02-20',
    melding: 'Har god kjennskap til Windows og Linux og ønsker å lære mer.'
  }
];

export const SOKNADER_BEDRIFT = [
  {
    id: 1,
    laerling_navn: 'Marius Haugen',
    utdanningsprogram: 'Elektrofag',
    laerplass_tittel: 'Elektriker-lærling',
    status: 'under_vurdering',
    sendt_dato: '2026-03-10',
    melding: 'Jeg er veldig interessert i denne lærlingplassen og har stor motivasjon for elektrofaget.',
    skole: 'Åsane videregående skole'
  },
  {
    id: 2,
    laerling_navn: 'Nora Kristiansen',
    utdanningsprogram: 'Elektrofag',
    laerplass_tittel: 'Elektriker-lærling',
    status: 'sendt',
    sendt_dato: '2026-03-11',
    melding: 'Har alltid vært interessert i elektronikk og ønsker å lære elektriker-yrket.',
    skole: 'Tertnes videregående skole'
  },
  {
    id: 3,
    laerling_navn: 'Tobias Engel',
    utdanningsprogram: 'Elektrofag',
    laerplass_tittel: 'Elektriker-lærling',
    status: 'avvist',
    sendt_dato: '2026-03-05',
    melding: 'Søker lærlingplass',
    skole: 'Langhaugen videregående skole'
  }
];

export const BEDRIFTER_VENTER = [
  {
    id: 10,
    navn: 'Nordnes Rørlegger AS',
    org_nr: '923456789',
    bransje: 'Bygg og anlegg',
    epost: 'post@nordnesror.no',
    registrert_dato: '2026-03-14'
  },
  {
    id: 11,
    navn: 'Fana Mat & Catering',
    org_nr: '934567890',
    bransje: 'Restaurant og matfag',
    epost: 'kontakt@fanamat.no',
    registrert_dato: '2026-03-15'
  }
];

const STANDARD_ANNONSER = [
  {
    id: 1,
    tittel: 'Elektriker-lærling',
    antall_plasser: 2,
    antall_soknader: 3,
    frist: '2026-04-15',
    beskrivelse: 'Vi søker motiverte lærlinger til elektroarbeid på næringsbygg.',
    aktiv: true
  },
  {
    id: 6,
    tittel: 'Ventilasjonsmontor-lærling',
    antall_plasser: 1,
    antall_soknader: 0,
    frist: '2026-05-01',
    beskrivelse: 'Spennende stilling for lærling innen ventilasjonsmontør-faget.',
    aktiv: true
  }
];

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
    sendt: 'Sendt',
    under_vurdering: 'Under vurdering',
    akseptert: 'Akseptert ✓',
    avvist: 'Avvist'
  };
  return tekster[status] || status;
}

export function statusBadgeKlasse(status) {
  const klasser = {
    sendt: 'badge badge-blaa',
    under_vurdering: 'badge badge-oransje',
    akseptert: 'badge badge-gronn',
    avvist: 'badge badge-roed'
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
  if (bruker.cv_lastet_opp) score += 15;
  return score;
}

// ===== DATAFUNKSJONER =====

export async function hentLaereplasser() {
  return Promise.resolve(LAEREPLASSER);
}

export async function hentSoknaderLaerling() {
  const bruker = hentBruker();
  const key = `${PM_SOKNADER_KEY}_${bruker?.id || 'demo'}`;
  const lagrede = localStorage.getItem(key);
  return Promise.resolve(lagrede ? JSON.parse(lagrede) : STANDARD_SOKNADER);
}

export async function hentSoknaderBedrift() {
  const bruker = hentBruker();
  const key = `${PM_SOKNADER_KEY}_bedrift_${bruker?.id || 'demo'}`;
  const lagrede = localStorage.getItem(key);
  return Promise.resolve(lagrede ? JSON.parse(lagrede) : SOKNADER_BEDRIFT);
}

export async function hentMineAnnonser() {
  const bruker = hentBruker();
  const key = `${PM_ANNONSER_KEY}_${bruker?.id || 'demo'}`;
  const lagrede = localStorage.getItem(key);
  return Promise.resolve(lagrede ? JSON.parse(lagrede) : STANDARD_ANNONSER);
}

export async function sendSoknad(laerplass_id, melding) {
  const bruker = hentBruker();
  const laerplass = LAEREPLASSER.find(p => p.id === laerplass_id);
  const key = `${PM_SOKNADER_KEY}_${bruker?.id || 'demo'}`;

  const mine = JSON.parse(localStorage.getItem(key) || 'null') || [...STANDARD_SOKNADER];

  // Hindre dobbelsøknad
  if (mine.find(s => s.laerplass_id === laerplass_id)) {
    throw new Error('Du har allerede søkt på denne lærlingplassen');
  }

  const nySoknad = {
    id: Date.now(),
    laerplass_id,
    tittel: laerplass?.tittel || 'Ukjent',
    bedrift_navn: laerplass?.bedrift_navn || 'Ukjent',
    status: 'sendt',
    sendt_dato: new Date().toISOString().split('T')[0],
    melding
  };

  mine.push(nySoknad);
  localStorage.setItem(key, JSON.stringify(mine));

  return new Promise(resolve => setTimeout(() => resolve({ ok: true }), 400));
}

export async function lagreAnnonse(annonseData) {
  const bruker = hentBruker();
  const key = `${PM_ANNONSER_KEY}_${bruker?.id || 'demo'}`;
  const mine = JSON.parse(localStorage.getItem(key) || 'null') || [...STANDARD_ANNONSER];

  const nyAnnonse = {
    id: Date.now(),
    antall_soknader: 0,
    aktiv: true,
    ...annonseData
  };

  mine.push(nyAnnonse);
  localStorage.setItem(key, JSON.stringify(mine));
  return nyAnnonse;
}

export async function slettAnnonse(id) {
  const bruker = hentBruker();
  const key = `${PM_ANNONSER_KEY}_${bruker?.id || 'demo'}`;
  const mine = JSON.parse(localStorage.getItem(key) || 'null') || [...STANDARD_ANNONSER];
  const oppdatert = mine.filter(a => a.id !== id);
  localStorage.setItem(key, JSON.stringify(oppdatert));
  return oppdatert;
}
