import { hentLaereplasser, formaterDato, initScrollReveal, loggUt } from './app.js';
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

let aktivBruker = null;

onAuthStateChanged(auth, async (user) => {
  const navAuth = document.getElementById('nav-auth');
  if (!user) {
    visLaereplasser();
    return;
  }
  try {
    const token = await user.getIdToken();
    const res = await fetch('/api/auth/meg', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const bruker = await res.json();
      aktivBruker = bruker;
      if (navAuth) {
        const sider = { laerling: '/laerling/dashboard.html', bedrift: '/bedrift/dashboard.html', admin: '/admin/dashboard.html' };
        const navn = bruker.navn || user.displayName || 'Min side';
        navAuth.innerHTML = `
          <a href="${sider[bruker.rolle] || '/'}" class="btn btn-ghost btn-liten" style="font-weight:600;">${navn}</a>
          <button class="btn btn-primary btn-liten" id="nav-logg-ut">Logg ut</button>
        `;
        document.getElementById('nav-logg-ut').addEventListener('click', async () => {
          await loggUt();
          window.location.reload();
        });
      }
    }
  } catch { /* brukeren er ikke innlogget */ }
  visLaereplasser();
});

if (sessionStorage.getItem('olkv-konto-slettet') === 'true') {
  sessionStorage.removeItem('olkv-konto-slettet');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = 'Kontoen din er slettet.';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

initScrollReveal();

async function visLaereplasser() {
  const plasser = await hentLaereplasser();
  const container = document.getElementById('laereplasser-liste');
  if (!container) return;

  container.innerHTML = plasser.slice(0, 4).map(p => `
    <div class="kort">
      <div class="kort-header">
        <div>
          <div class="kort-tittel">${p.tittel}</div>
          <div class="kort-undertittel">${p.bedrift_navn}</div>
        </div>
        <span class="badge badge-gronn">${p.bransje}</span>
      </div>
      <p style="font-size: 0.9rem; margin-bottom: 1rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${p.beskrivelse}</p>
      <div class="kort-footer">
        <div style="font-size: 0.85rem; color: var(--farge-tekst-sekundaer);">
          ${p.sted} &nbsp;·&nbsp; Frist: ${formaterDato(p.frist)}
        </div>
        ${(() => {
          const maal = `/laerling/laereplasser.html?sok=${encodeURIComponent(p.id)}`;
          if (!aktivBruker) {
            return `<a href="/login.html?returnTo=${encodeURIComponent(maal)}" class="btn btn-primary btn-liten">Søk nå</a>`;
          }
          if (aktivBruker.rolle === 'laerling') {
            return `<a href="${maal}" class="btn btn-primary btn-liten">Søk nå</a>`;
          }
          return '';
        })()}
      </div>
    </div>
  `).join('');
}

// Hent ekte statistikk fra API
fetch('/api/statistikk')
  .then(r => r.ok ? r.json() : null)
  .then(data => {
    if (!data) return;
    const laerlingerEl    = document.getElementById('stat-laerlinger');
    const bedrifterEl     = document.getElementById('stat-bedrifter');
    const laereplasserEl  = document.getElementById('stat-laereplasser');
    if (laerlingerEl)   laerlingerEl.textContent   = data.antallLaerlinger   ?? '—';
    if (bedrifterEl)    bedrifterEl.textContent    = data.antallBedrifter    ?? '—';
    if (laereplasserEl) laereplasserEl.textContent = data.antallLaereplasser ?? '—';
  })
  .catch(() => { /* statistikk forblir — ved nettverksfeil */ });
