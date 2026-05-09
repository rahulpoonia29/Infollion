const CHAT_PATH = /^\/c\/([a-zA-Z0-9-]+)\/?$/;

export function chatIdFromLocation(): string | null {
  const m = window.location.pathname.match(CHAT_PATH);
  return m ? m[1] : null;
}

export function navigateToChat(id: string | null, replace = false): void {
  const target = id ? `/c/${id}` : '/';
  if (window.location.pathname === target) return;
  if (replace) {
    window.history.replaceState({}, '', target);
  } else {
    window.history.pushState({}, '', target);
  }
}

export function onRouteChange(handler: (id: string | null) => void): () => void {
  const listener = () => handler(chatIdFromLocation());
  window.addEventListener('popstate', listener);
  return () => window.removeEventListener('popstate', listener);
}
