// Perfect Match — Felles JavaScript (ES Modules)
// Dummy-data brukes til frontend-visning i MVP-fasen

// ===== DUMMY DATA =====

export const LAEREPLASSER = [
  {
    id: 1,
    tittel: "Elektriker-lærling",
    bedrift_navn: "Bergen Elektro AS",
    bransje: "Elektrofag",
    sted: "Bergen",
    frist: "2026-04-15",
    antall_plasser: 2,
    beskrivelse: "Vi søker motiverte lærlinger til elektroarbeid på næringsbygg og boliger i Bergensregionen. Du vil jobbe tett med erfarne fagarbeidere og lære yrket fra bunnen.",
    aktiv: true
  },
  {
    id: 2,
    tittel: "Industrimekaniker-lærling",
    bedrift_navn: "Vestland Industri AS",
    bransje: "Teknikk og industriell produksjon",
    sted: "Øygarden",
    frist: "2026-05-01",
    antall_plasser: 1,
    beskrivelse: "Spennende lærlingplass i maritim industri. Du vil jobbe med vedlikehold og reparasjon av industrielt utstyr i et moderne verksted.",
    aktiv: true
  },
  {
    id: 3,
    tittel: "Rørlegger-lærling",
    bedrift_navn: "VVS-Service Vest AS",
    bransje: "Bygg og anlegg",
    sted: "Stavanger",
    frist: "2026-03-30",
    antall_plasser: 3,
    beskrivelse: "Bli med på spennende VVS-prosjekter i hele regionen. Vi har et godt fagmiljø og legger vekt på god opplæring.",
    aktiv: true
  },
  {
    id: 4,
    tittel: "Kokk-lærling",
    bedrift_navn: "Hotel Bryggen",
    bransje: "Restaurant og matfag",
    sted: "Bergen",
    frist: "2026-04-01",
    antall_plasser: 1,
    beskrivelse: "Lær kokkeyrket på et av Bergens mest kjente hoteller. Du vil jobbe i et profesjonelt kjøkken med fokus på norske råvarer.",
    aktiv: true
  },
  {
    id: 5,
    tittel: "IKT-servicefag lærling",
    bedrift_navn: "Techfirma Bergen AS",
    bransje: "IKT",
    sted: "Bergen",
    frist: "2026-05-15",
    antall_plasser: 2,
    beskrivelse: "Vi søker IT-interesserte lærlinger til drift og support av systemer. Gode muligheter for faglig utvikling.",
    aktiv: true
  }
];

export const SOKNADER_LAERLING = [
  {
    id: 1,
    laerplass_id: 1,
    tittel: "Elektriker-lærling",
    bedrift_navn: "Bergen Elektro AS",
    status: "under_vurdering",
    sendt_dato: "2026-03-10",
    melding: "Jeg er veldig interessert i denne lærlingplassen og har stor motivasjon for elektrofaget."
  },
  {
    id: 2,
    laerplass_id: 3,
    tittel: "Rørlegger-lærling",
    bedrift_navn: "VVS-Service Vest AS",
    status: "sendt",
    sendt_dato: "2026-03-12",
    melding: "Søker herved om lærlingplass som rørlegger."
  },
  {
    id: 3,
    laerplass_id: 5,
    tittel: "IKT-servicefag lærling",
    bedrift_navn: "Techfirma Bergen AS",
    status: "akseptert",
    sendt_dato: "2026-02-20",
    melding: "Har god kjennskap til Windows og Linux og ønsker å lære mer."
  }
];

export const SOKNADER_BEDRIFT = [
  {
    id: 1,
    laerling_navn: "Marius Haugen",
    utdanningsprogram: "Elektrofag",
    laerplass_tittel: "Elektriker-lærling",
    status: "under_vurdering",
    sendt_dato: "2026-03-10",
    melding: "Jeg er veldig interessert i denne lærlingplassen og har stor motivasjon for elektrofaget.",
    skole: "Åsane videregående skole"
  },
  {
    id: 2,
    laerling_navn: "Nora Kristiansen",
    utdanningsprogram: "Elektrofag",
    laerplass_tittel: "Elektriker-lærling",
    status: "sendt",
    sendt_dato: "2026-03-11",
    melding: "Har alltid vært interessert i elektronikk og ønsker å lære elektriker-yrket.",
    skole: "Tertnes videregående skole"
  },
  {
    id: 3,
    laerling_navn: "Tobias Engel",
    utdanningsprogram: "Elektrofag",
    laerplass_tittel: "Elektriker-lærling",
    status: "avvist",
    sendt_dato: "2026-03-05",
    melding: "Søker lærlingplass",
    skole: "Langhaugen videregående skole"
  }
];

export const BEDRIFTER_VENTER = [
  {
    id: 10,
    navn: "Nordnes Rørlegger AS",
    org_nr: "923456789",
    bransje: "Bygg og anlegg",
    epost: "post@nordnesror.no",
    registrert_dato: "2026-03-14"
  },
  {
    id: 11,
    navn: "Fana Mat & Catering",
    org_nr: "934567890",
    bransje: "Restaurant og matfag",
    epost: "kontakt@fanamat.no",
    registrert_dato: "2026-03-15"
  }
];

export const MINE_ANNONSER = [
  {
    id: 1,
    tittel: "Elektriker-lærling",
    antall_plasser: 2,
    antall_soknader: 3,
    frist: "2026-04-15",
    aktiv: true
  },
  {
    id: 6,
    tittel: "Ventilasjonsmontor-lærling",
    antall_plasser: 1,
    antall_soknader: 0,
    frist: "2026-05-01",
    aktiv: true
  }
];

// ===== HJELPE-FUNKSJONER =====

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
  const dato = new Date(datoStreng);
  return dato.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function statusTekst(status) {
  const tekster = {
    sendt: 'Sendt',
    under_vurdering: 'Under vurdering',
    akseptert: 'Akseptert',
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
  return navn.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ===== API-KALL (simulert med dummy-data i MVP) =====

export async function hentLaereplasser() {
  // TODO: erstatt med ekte fetch når backend er klar
  // return fetch('/api/laereplasser').then(r => r.json());
  return Promise.resolve(LAEREPLASSER);
}

export async function hentSoknaderLaerling() {
  return Promise.resolve(SOKNADER_LAERLING);
}

export async function hentSoknaderBedrift() {
  return Promise.resolve(SOKNADER_BEDRIFT);
}

export async function hentMineAnnonser() {
  return Promise.resolve(MINE_ANNONSER);
}

export async function sendSoknad(laerplass_id, melding) {
  // Simulerer en vellykket innsending
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ ok: true, melding: 'Søknaden er sendt!' });
    }, 600);
  });
}

// ===== AUTENTISERING =====

export async function handleLogin(epost, passord) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ epost, passord })
    });

    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error || 'Feil e-post eller passord');
    }

    const { rolle } = await res.json();
    const sider = {
      laerling: '/laerling/dashboard.html',
      bedrift: '/bedrift/dashboard.html',
      admin: '/admin/dashboard.html'
    };
    window.location.href = sider[rolle] || '/';
  } catch (err) {
    // I MVP — redirect direkte (ingen ekte backend ennå)
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      // Simuler innlogging for demo
      window.location.href = '/laerling/dashboard.html';
      return;
    }
    throw err;
  }
}

export async function handleRegister(data, rolle) {
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, rolle })
    });

    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error || 'Noe gikk galt under registrering');
    }

    return await res.json();
  } catch (err) {
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      // I MVP simulerer vi vellykket registrering
      return { ok: true };
    }
    throw err;
  }
}

export function loggUt() {
  fetch('/api/auth/logout', { method: 'POST' })
    .finally(() => {
      window.location.href = '/';
    });
}
