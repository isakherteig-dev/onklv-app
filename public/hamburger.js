const hamburgerBtn = document.getElementById('hamburger-btn');
const mobilMeny = document.getElementById('mobil-meny');
const mobilMenyOverlay = document.getElementById('mobil-meny-overlay');
const mobilMenyLukk = document.getElementById('mobil-meny-lukk');

function apneMobilMeny() {
  mobilMeny.classList.remove('skjult');
  mobilMenyOverlay.classList.remove('skjult');
  document.body.style.overflow = 'hidden';
}
function lukkMobilMeny() {
  mobilMeny.classList.add('skjult');
  mobilMenyOverlay.classList.add('skjult');
  document.body.style.overflow = '';
}
hamburgerBtn?.addEventListener('click', apneMobilMeny);
mobilMenyLukk?.addEventListener('click', lukkMobilMeny);
mobilMenyOverlay?.addEventListener('click', lukkMobilMeny);
