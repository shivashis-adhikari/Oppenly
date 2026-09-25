import { signal } from '@preact/signals';

export type Route =
  | { name: 'home' }
  | { name: 'trash' }
  | { name: 'doc'; id: string }
  | { name: 'settings'; section: string };

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'doc' && parts[1]) return { name: 'doc', id: parts[1] };
  if (parts[0] === 'trash') return { name: 'trash' };
  if (parts[0] === 'settings') return { name: 'settings', section: parts[1] ?? 'general' };
  return { name: 'home' };
}

export const route = signal<Route>(parse(location.hash));

window.addEventListener('hashchange', () => {
  route.value = parse(location.hash);
});

export function href(r: Route): string {
  switch (r.name) {
    case 'home':
      return '#/';
    case 'trash':
      return '#/trash';
    case 'doc':
      return `#/doc/${r.id}`;
    case 'settings':
      return `#/settings/${r.section}`;
  }
}

export function go(r: Route): void {
  location.hash = href(r);
}
