const COOKIE_STORAGE_KEY = 'olkv-cookies-accepted';

function byggCookieBanner() {
  const banner = document.createElement('div');
  banner.id = 'cookie-banner';
  banner.className = 'cookie-banner';
  banner.innerHTML = `
    <div class="cookie-content">
      <p>
        Vi bruker kun nødvendige informasjonskapsler (cookies) for at
        innlogging og appen skal fungere. Vi bruker ingen sporings- eller
        markedsføringscookies.
        <a href="/personvern.html">Les mer om personvern</a>
      </p>
      <button id="cookie-banner-accept" class="btn btn-primary btn-sm">
        OK, jeg forstår
      </button>
    </div>
  `;
  return banner;
}

function acceptCookies() {
  localStorage.setItem(COOKIE_STORAGE_KEY, 'true');
  const banner = document.getElementById('cookie-banner');
  if (!banner) return;

  banner.classList.add('cookie-banner-hide');
  setTimeout(() => banner.remove(), 300);
}

function initCookieBanner() {
  if (localStorage.getItem(COOKIE_STORAGE_KEY)) return;
  if (document.getElementById('cookie-banner')) return;

  const banner = byggCookieBanner();
  document.body.appendChild(banner);
  document.getElementById('cookie-banner-accept')?.addEventListener('click', acceptCookies);
}

window.acceptCookies = acceptCookies;
document.addEventListener('DOMContentLoaded', initCookieBanner);
