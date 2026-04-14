import { krevInnlogging, getToken, escHtml, formaterDato } from './app.js';

const bruker = await krevInnlogging();
if (!bruker) { window.location.href = '/login.html'; }

const params = new URLSearchParams(window.location.search);
const uid = params.get('uid');

if (!uid) {
  document.getElementById('profil-innhold').innerHTML =
    '<p class="bp-laster">Ingen bedrift valgt.</p>';
} else {
  try {
    const token = await getToken();
    const res = await fetch(`/api/auth/bedriftprofil-offentlig/${encodeURIComponent(uid)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      document.getElementById('profil-innhold').innerHTML =
        '<p class="bp-laster">Fant ikke bedriftsprofilen.</p>';
    } else {
      const data = await res.json();
      visProfilData(data);
    }
  } catch (err) {
    console.error('Feil ved henting av bedriftsprofil:', err);
    document.getElementById('profil-innhold').innerHTML =
      '<p class="bp-laster">Noe gikk galt. Prøv igjen.</p>';
  }
}

function visProfilData(data) {
  const antallLaereplasser = data.laereplasser?.length || 0;

  // Tilbake-lenke
  const tilbakeWrapper = document.getElementById('bp-tilbake-wrapper');
  tilbakeWrapper.innerHTML = `
    <a class="bp-tilbake" id="tilbake-lenke">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
      Tilbake
    </a>`;
  document.getElementById('tilbake-lenke').addEventListener('click', () => history.back());

  // Banner
  const bannerWrapper = document.getElementById('bp-banner-wrapper');
  const badgeMeta = [
    data.sted ? `<span class="bp-badge">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      ${escHtml(data.sted)}</span>` : '',
    data.bransje ? `<span class="bp-badge">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
      ${escHtml(data.bransje)}</span>` : '',
    antallLaereplasser > 0 ? `<span class="bp-badge bp-badge-laereplasser">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      ${antallLaereplasser} aktiv${antallLaereplasser === 1 ? '' : 'e'} læreplasser</span>` : '',
  ].filter(Boolean).join('');

  bannerWrapper.innerHTML = `
    <div class="bp-banner">
      <div class="bp-banner-innhold">
        <h1>${escHtml(data.navn)}</h1>
        ${badgeMeta ? `<div class="bp-banner-meta">${badgeMeta}</div>` : ''}
      </div>
    </div>`;

  // Seksjoner
  const innhold = document.getElementById('profil-innhold');
  let html = '<div class="bp-seksjoner">';

  if (data.videoUrl) {
    html += `
    <div class="bp-kort">
      <h2 class="bp-seksjon-tittel">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
        Bedriftsvideo
      </h2>
      <video class="bp-video" src="${escHtml(data.videoUrl)}" controls preload="metadata"></video>
    </div>`;
  }

  if (data.beskrivelse) {
    html += `
    <div class="bp-kort">
      <h2 class="bp-seksjon-tittel">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        Om oss
      </h2>
      <p class="bp-tekst">${escHtml(data.beskrivelse)}</p>
    </div>`;
  }

  if (data.verdier) {
    html += `
    <div class="bp-kort">
      <h2 class="bp-seksjon-tittel">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        Våre verdier
      </h2>
      <p class="bp-tekst">${escHtml(data.verdier)}</p>
    </div>`;
  }

  if (data.hvaViTilbyr) {
    html += `
    <div class="bp-kort">
      <h2 class="bp-seksjon-tittel">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        Hva vi tilbyr lærlinger
      </h2>
      <p class="bp-tekst">${escHtml(data.hvaViTilbyr)}</p>
    </div>`;
  }

  if (data.nettside) {
    let url = data.nettside;
    if (!url.startsWith('http')) url = 'https://' + url;
    html += `
    <div class="bp-kort">
      <h2 class="bp-seksjon-tittel">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        Nettside
      </h2>
      <a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer" class="bp-nettside">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        ${escHtml(data.nettside)}
      </a>
    </div>`;
  }

  if (antallLaereplasser > 0) {
    const plassRader = data.laereplasser.map(lp => `
      <a href="/laerling/laereplasser.html" class="bp-plass-rad">
        <span class="bp-plass-tittel">${escHtml(lp.tittel)}</span>
        <span class="bp-plass-meta">${lp.frist ? 'Frist: ' + formaterDato(lp.frist) : ''}${lp.sted ? (lp.frist ? ' · ' : '') + escHtml(lp.sted) : ''}</span>
      </a>`).join('');

    html += `
    <div class="bp-kort">
      <h2 class="bp-seksjon-tittel">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        Aktive læreplasser
      </h2>
      <div class="bp-plasser">${plassRader}</div>
    </div>`;
  }

  html += '</div>';
  innhold.innerHTML = html;
}
