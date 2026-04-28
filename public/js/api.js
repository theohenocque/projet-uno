const Api = {
  async post(path, body) {
    const res = await fetch('/api' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erreur ' + res.status);
    return data;
  },
  async get(path, token) {
    const res = await fetch('/api' + path, {
      headers: token ? { 'Authorization': 'Bearer ' + token } : {}
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erreur ' + res.status);
    return data;
  }
};
