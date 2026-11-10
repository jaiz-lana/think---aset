/**
 * Router berbasis hash untuk PWA statis.
 * Contoh: #/aset/abc123?tab=riwayat
 */
export class Router {
  constructor() {
    this.routes = [];
    this.notFound = null;
    this._started = false;
    this._onHashChange = () => this.resolve();
  }

  add(pattern, handler) {
    this.routes.push({ pattern, handler });
    return this;
  }

  hasRoute(pattern) {
    return this.routes.some(route => route.pattern === pattern);
  }

  setNotFound(handler) { this.notFound = handler; return this; }

  navigate(path) {
    const target = '#' + (path.startsWith('/') ? path : '/' + path);
    if (window.location.hash !== target) window.location.hash = target;
    else this.resolve();
  }

  resolve() {
    const raw = window.location.hash.slice(1) || '/';
    const [path, queryString] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    const query = new URLSearchParams(queryString || '');

    for (const { pattern, handler } of this.routes) {
      const pat = pattern.split('/').filter(Boolean);
      if (pat.length !== parts.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < parts.length; i++) {
        if (pat[i].startsWith(':')) params[pat[i].slice(1)] = decodeURIComponent(parts[i]);
        else if (pat[i] !== parts[i]) { ok = false; break; }
      }
      if (ok) {
        handler({ params, query, path });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }
    if (this.notFound) this.notFound({ path });
  }

  start() {
    if (this._started) {
      this.resolve();
      return;
    }
    this._started = true;
    window.addEventListener('hashchange', this._onHashChange);
    this.resolve();
  }
}