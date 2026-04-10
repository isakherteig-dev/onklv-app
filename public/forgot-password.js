import { visFeilmelding, oversettFirebaseFeil } from './app.js';
import { auth } from './firebase-config.js';
import { sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

async function resetPassword(e) {
  e.preventDefault();
  const epost = document.getElementById('epost').value.trim();
  const varsel = document.getElementById('varsel');
  const sendtBoks = document.getElementById('sendt-boks');
  const btn = document.getElementById('send-btn');

  varsel.classList.add('skjult');
  sendtBoks.classList.add('skjult');

  if (!epost) {
    visFeilmelding('Skriv inn e-postadressen din');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Sender…';

  try {
    await sendPasswordResetEmail(auth, epost);
    document.getElementById('passord-form').classList.add('skjult');
    document.getElementById('sendt-varsel-tekst').textContent = `Tilbakesetningslenke er sendt til ${epost}.`;
    document.getElementById('sendt-detaljer').textContent = `Sjekk innboksen din. Du blir sendt tilbake til innlogging om 5 sekunder.`;
    sendtBoks.classList.remove('skjult');

    setTimeout(() => {
      window.location.href = '/login.html';
    }, 5000);
  } catch (err) {
    visFeilmelding(oversettFirebaseFeil(err.code) || 'Noe gikk galt. Prøv igjen.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send tilbakesetningslenke →';
  }
}

document.getElementById('passord-form').addEventListener('submit', resetPassword);
