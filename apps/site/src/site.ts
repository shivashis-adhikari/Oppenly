import './site.css';

// A border under the navigation once the page scrolls.
const nav = document.querySelector<HTMLElement>('.nav');
const onScroll = () => nav?.setAttribute('data-scrolled', String(window.scrollY > 8));
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Copy buttons on code blocks.
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
  button.addEventListener('click', async () => {
    const code = button.parentElement?.querySelector('code')?.textContent ?? '';
    try {
      await navigator.clipboard.writeText(code);
      button.textContent = 'Copied';
    } catch {
      button.textContent = 'Press Ctrl+C';
    }
    setTimeout(() => {
      button.textContent = 'Copy';
    }, 1600);
  });
}
