// Dark is the default; a saved choice of "light" is applied before first paint.
try {
  if (localStorage.getItem('cc-theme') === 'light') document.documentElement.dataset.theme = 'light';
} catch (e) {
  /* storage unavailable: keep the default */
}
