const Auth = {
  token: Storage.get('uno_token') || null,
  user: null,
  mode: 'login', // 'login' ou 'register'

  init() {
    // Restaurer user depuis storage
    const userStr = Storage.get('uno_user');
    if (userStr) {
      try { this.user = JSON.parse(userStr); } catch {}
    }

    // Form submit
    $('#auth-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.submit();
    });

    // Tabs
    $$('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.setMode(tab.dataset.mode);
      });
    });

    // Logout
    $('#btn-logout').addEventListener('click', () => this.logout());

    // Update UI
    this.updateHeader();
  },

  onEnterLogin() {
    // Lire query string pour pré-sélectionner mode
    const qs = window.location.search;
    if (qs.includes('mode=register')) {
      this.setMode('register');
    } else {
      this.setMode('login');
    }
    $('#auth-form').reset();
    hide($('#auth-error'));
  },

  setMode(mode) {
    this.mode = mode;
    $$('.auth-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.mode === mode);
    });
    if (mode === 'login') {
      $('#auth-title').textContent = 'Connexion';
      $('#auth-submit').textContent = 'Se connecter';
    } else {
      $('#auth-title').textContent = 'Créer un compte';
      $('#auth-submit').textContent = 'S\'inscrire';
    }
    hide($('#auth-error'));
  },

  showError(msg) {
    const el = $('#auth-error');
    el.textContent = msg;
    show(el);
  },

  async submit() {
    const formData = new FormData($('#auth-form'));
    const username = formData.get('username').trim();
    const password = formData.get('password');
    const submitBtn = $('#auth-submit');
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Veuillez patienter...';
    try {
      const data = await Api.post('/auth/' + this.mode, { username, password });
      this.token = data.token;
      this.user = data.user;
      Storage.set('uno_token', data.token);
      Storage.set('uno_user', JSON.stringify(data.user));
      toast('Bienvenue, ' + this.user.username + ' !', 'success');
      this.updateHeader();
      // Initialiser la connexion socket
      Net.connect();
      Router.navigate('/lobby');
    } catch (e) {
      this.showError(e.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  },

  logout() {
    if (Net.socket) Net.socket.disconnect();
    Storage.remove('uno_token');
    Storage.remove('uno_user');
    this.token = null;
    this.user = null;
    this.updateHeader();
    Router.navigate('/');
    toast('Déconnecté', 'info');
  },

  updateHeader() {
    if (this.user) {
      $('#user-name').textContent = this.user.username;
    }
  }
};
