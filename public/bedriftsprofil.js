import { krevInnlogging, getToken, escHtml, formaterDato } from './app.js';

const bruker = await krevInnlogging();
if (!bruker) { window.location.href = '/login.html'; }

const params = new URLSearchParams(window.location.search);
const uid = params.get('uid');

if (!uid) {
  document.getElementById('profil-innhold').innerHTML =
    '<p style="text-align:center;color:var(--olkv-gray);padding:4rem 1rem;">Ingen bedrift valgt.</p>';
} else {
  try {
    const token = await getToken();
    const res = await fetch(`/api/auth/bedriftprofil-offentlig/${encodeURIComponent(uid)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      document.getElementById('profil-innhold').innerHTML =
        '<p style="text-align:center;color:var(--olkv-gray);padding:4rem 1rem;">Fant ikke bedriftsprofilen.</p>';
    } else {
      const data = await res.json();
      visProfilData(data);
    }
  } catch (err) {
    console.error('Feil ved henting av bedriftsprofil:', err);
    document.getElementById('profil-innhold').innerHTML =
      '<p style="text-align:center;color:var(--olkv-gray);padding:4rem 1rem;">Noe gikk galt. Prøv igjen.</p>';
  }
}

function visProfilData(data) {
  const innhold = document.getElementById('profil-innhold');

  let html = `
    <a class="profil-tilbake" id="tilbake-lenke">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
      Tilbake
    </a>

    <div class="profil-header">
      <h1>${escHtml(data.navn)}</h1>
      <div class="meta">
        ${data.sted ? `<span>${escHtml(data.sted)}</span>` : ''}
        ${data.bransje ? `<span>${escHtml(data.bransje)}</span>` : ''}
      </div>
    </div>`;

  if (data.videoUrl) {
    html += `
    <div class="profil-seksjon">
      <h2>Bedriftsvideo</h2>
      <video class="profil-video" src="${escHtml(data.videoUrl)}" controls preload="metadata"></video>
    </div>`;
  }

  if (data.beskrivelse) {
    html += `
    <div class="profil-seksjon">
      <h2>Om oss</h2>
      <p>${escHtml(data.beskrivelse)}</p>
    </div>`;
  }

  if (data.verdier) {
    html += `
    <div class="profil-seksjon">
      <h2>Våre verdier</h2>
      <p>${escHtml(data.verdier)}</p>
    </div>`;
  }

  if (data.hvaViTilbyr) {
    html += `
    <div class="profil-seksjon">
      <h2>Hva vi tilbyr lærlinger</h2>
      <p>${escHtml(data.hvaViTilbyr)}</p>
    </div>`;
  }

  if (data.nettside) {
    let url = data.nettside;
    if (!url.startsWith('http')) url = 'https://' + url;
    html += `
    <div class="profil-seksjon">
      <a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer" class="profil-nettside">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        ${escHtml(data.nettside)}
      </a>
    </div>`;
  }

  if (data.laereplasser && data.laereplasser.length > 0) {
    html += `
    <div class="profil-seksjon">
      <h2>Aktive læreplasser (${data.laereplasser.length})</h2>
      <div class="profil-plasser">
        ${data.laereplasser.map(lp => `
          <div class="profil-plass-kort">
            <a href="/laerling/laereplasser.html" class="profil-plass-kortlenke">${escHtml(lp.tittel)}</a>
            <span class="profil-plass-frist">${lp.frist ? 'Frist: ' + formaterDato(lp.frist) : ''}${lp.sted ? ' · ' + escHtml(lp.sted) : ''}</span>
          </div>
        `).join('')}
      </div>
    </div>`;
  }

  innhold.innerHTML = html;

  document.getElementById('tilbake-lenke').addEventListener('click', () => {
    history.back();
  });
}
