// Site chrome shared by every page: theme toggle and mobile menu.

const root = document.documentElement;

document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
  const light = root.dataset.theme !== 'light';
  if (light) root.dataset.theme = 'light';
  else delete root.dataset.theme;
  try {
    localStorage.setItem('cc-theme', light ? 'light' : 'dark');
  } catch {
    /* storage unavailable: the choice lasts for this page only */
  }
  window.dispatchEvent(new CustomEvent('cc-theme'));
});

const menuBtn = document.querySelector<HTMLButtonElement>('.menu-btn');
const nav = document.getElementById('site-nav');
menuBtn?.addEventListener('click', () => {
  const open = !nav?.classList.contains('open');
  nav?.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
});
