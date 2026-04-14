const sti = window.location.pathname;
    document.querySelectorAll('.bunn-nav-lenke').forEach(a => {
      const side = a.dataset.side;
      if (
        (side === 'dashboard' && sti.includes('dashboard')) ||
        (side === 'laereplasser' && sti.includes('laereplasser')) ||
        (side === 'soknader' && sti.includes('soknader')) ||
        (side === 'profil' && sti.includes('profil'))
      ) a.classList.add('aktiv');
    });
    const btn = document.getElementById('hamburger-btn');
    const overlay = document.getElementById('meny-overlay');
    const meny = document.getElementById('slide-meny');
    const lukk = document.getElementById('meny-lukk');
    const apne = () => { meny.classList.remove('skjult'); overlay.classList.remove('skjult'); document.body.style.overflow = 'hidden'; };
    const lukke = () => { meny.classList.add('skjult'); overlay.classList.add('skjult'); document.body.style.overflow = ''; };
    btn?.addEventListener('click', apne);
    lukk?.addEventListener('click', lukke);
    overlay?.addEventListener('click', lukke);
    document.getElementById('meny-logg-ut')?.addEventListener('click', async () => {
      const { loggUt } = await import('../app.js');
      await loggUt();
    });
