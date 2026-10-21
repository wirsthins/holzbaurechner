/* Holzbaurechner als App: Service Worker anmelden und Installation anbieten. */
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }

  const box = document.querySelector('.install');
  if (!box) return;
  const installiert = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (installiert) return;

  const btn = box.querySelector('.install-btn');
  const text = box.querySelector('.install-text');
  let angebot = null;

  // Android, Chrome, Edge: eigener Installieren-Knopf
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    angebot = e;
    btn.hidden = false;
    box.hidden = false;
  });
  btn.addEventListener('click', async () => {
    if (!angebot) return;
    angebot.prompt();
    await angebot.userChoice;
    angebot = null;
    box.hidden = true;
  });
  window.addEventListener('appinstalled', () => { box.hidden = true; });

  // iPhone und iPad: dort gibt es keinen Knopf, nur den Weg über „Teilen“
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) {
    text.textContent = 'Holzbaurechner als App: In Safari auf „Teilen“ tippen, dann „Zum Home-Bildschirm“. Die Rechner laufen dann auch ohne Netz.';
    btn.hidden = true;
    box.hidden = false;
  }
})();
