// Routeur SPA très simple : gère les routes /, /login, /lobby, /game
// Avec contrôle d'accès basé sur l'authentification.

const Router = {
  routes: {
    '/': { page: 'page-home', requireAuth: false },
    '/login': { page: 'page-login', requireAuth: false },
    '/lobby': { page: 'page-lobby', requireAuth: true },
    '/game': { page: 'page-game', requireAuth: true }
  },

  current: '/',

  init() {
    window.addEventListener('popstate', () => this.handle());
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-link]');
      if (link) {
        e.preventDefault();
        this.navigate(link.dataset.link);
      }
    });
    this.handle();
  },

  navigate(path) {
    if (path === this.current) return;
    history.pushState({}, '', path);
    this.handle();
  },

  handle() {
    const path = window.location.pathname;
    // Découper le path principal pour ignorer les query
    const cleanPath = path.split('?')[0] || '/';
    let route = this.routes[cleanPath];

    if (!route) {
      // Route inconnue -> home
      this.navigate('/');
      return;
    }

    const isAuth = !!Auth.token;

    if (route.requireAuth && !isAuth) {
      this.navigate('/login');
      return;
    }

    if (!route.requireAuth && isAuth && (cleanPath === '/' || cleanPath === '/login')) {
      // Si déjà loggé, rediriger vers lobby
      this.navigate('/lobby');
      return;
    }

    this.current = cleanPath;

    // Cacher toutes les pages
    $$('.page').forEach(p => hide(p));

    // Header visible uniquement si connecté
    if (isAuth) {
      show($('#app-header'));
    } else {
      hide($('#app-header'));
    }

    // Afficher la page demandée
    show($('#' + route.page));

    // Hooks d'entrée de page
    if (cleanPath === '/login') Auth.onEnterLogin();
    if (cleanPath === '/lobby') Lobby.onEnterLobby();
    if (cleanPath === '/game') Game.onEnterGame();
  }
};
