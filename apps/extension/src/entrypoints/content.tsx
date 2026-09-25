import '../content/ui/content.css';
import { mountOverlay } from '../content/mount';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  matchAboutBlank: true,
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  async main(ctx) {
    // Skip tiny frames such as ads and tracking pixels.
    if (window.top !== window && (window.innerWidth < 120 || window.innerHeight < 60)) return;
    const ui = await createShadowRootUi(ctx, {
      name: 'oppenly-layer',
      position: 'inline',
      anchor: 'html',
      append: 'last',
      onMount(container, _shadow, host) {
        return mountOverlay(container, host);
      },
      onRemove(unmount) {
        unmount?.();
      },
    });
    ui.mount();
  },
});
