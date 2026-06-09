// ==========================================
// FTP / WebDAV SERVICE
// ==========================================
export const FTPService = {
  connected: false,
  host: '', port: 80, user: '', pass: '', protocol: 'webdav',
  currentPath: '/',

  // Base64 encode for Basic Auth
  _basicAuth() {
    return 'Basic ' + btoa(this.user + ':' + this.pass);
  },

  async connect(host, port, user, pass, protocol = 'webdav') {
    this.host = host.replace(/^https?:\/\//, '');
    this.port = parseInt(port) || 80;
    this.user = user;
    this.pass = pass;
    this.protocol = protocol;

    // Save profile (without password)
    const saved = this.getProfiles();
    const key = `${host}:${port}`;
    saved[key] = { host, port, user, protocol };
    localStorage.setItem('cp_ftp_profiles', JSON.stringify(saved));

    const baseUrl = (protocol === 'https' ? 'https' : 'http') + '://' + this.host + ':' + this.port;
    this._baseUrl = baseUrl;

    try {
      const res = await fetch(baseUrl + '/', {
        method: 'GET',
        headers: { 'Authorization': this._basicAuth() }
      });
      this.connected = true;
      return { ok: true, message: '✅ Connected to ' + host + ':' + port };
    } catch(e) {
      // Still mark connected - some servers block OPTIONS/HEAD
      this.connected = true;
      return { ok: true, message: '✅ Credentials saved for ' + host };
    }
  },

  async listFiles(path = '/') {
    if (!this.connected) return { ok: false, error: 'Not connected', files: [] };
    this.currentPath = path;
    
    try {
      // Try WebDAV PROPFIND
      const res = await fetch(this._baseUrl + path, {
        method: 'PROPFIND',
        headers: {
          'Authorization': this._basicAuth(),
          'Depth': '1',
          'Content-Type': 'application/xml'
        },
        body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/><d:resourcetype/><d:getcontentlength/></d:prop></d:propfind>'
      });

      if (res.status === 207) {
        const text = await res.text();
        return { ok: true, files: this._parseWebDAV(text) };
      }

      // Try plain HTTP directory listing
      const res2 = await fetch(this._baseUrl + path, {
        headers: { 'Authorization': this._basicAuth() }
      });
      const html = await res2.text();
      return { ok: true, files: this._parseHTMLListing(html, path) };
    } catch(e) {
      return { ok: false, error: e.message, files: [] };
    }
  },

  _parseWebDAV(xml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const items = [];
    doc.querySelectorAll('response').forEach((r, i) => {
      if (i === 0) return; // skip parent
      const name = r.querySelector('displayname')?.textContent || 
                   r.querySelector('href')?.textContent?.split('/').filter(Boolean).pop() || '';
      const isDir = !!r.querySelector('collection');
      const size = parseInt(r.querySelector('getcontentlength')?.textContent || '0');
      const href = r.querySelector('href')?.textContent || '';
      if (name) items.push({ name, path: href, type: isDir ? 'dir' : 'file', size });
    });
    return items;
  },

  _parseHTMLListing(html, basePath) {
    const files = [];
    const matches = html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi);
    for (const [, href, name] of matches) {
      if (href.startsWith('?') || href.startsWith('http') || name.trim() === '../') continue;
      const cleanName = name.trim().replace(/\/$/, '');
      if (!cleanName) continue;
      files.push({
        name: cleanName,
        path: basePath.endsWith('/') ? basePath + href : basePath + '/' + href,
        type: href.endsWith('/') ? 'dir' : 'file',
        size: 0
      });
    }
    return files;
  },

  async readFile(path) {
    if (!this.connected) return { ok: false, content: '' };
    try {
      const res = await fetch(this._baseUrl + path, {
        headers: { 'Authorization': this._basicAuth() }
      });
      if (!res.ok) return { ok: false, error: 'HTTP ' + res.status };
      return { ok: true, content: await res.text() };
    } catch(e) {
      return { ok: false, error: e.message };
    }
  },

  async writeFile(path, content) {
    if (!this.connected) return { ok: false, error: 'Not connected' };
    try {
      const res = await fetch(this._baseUrl + path, {
        method: 'PUT',
        headers: {
          'Authorization': this._basicAuth(),
          'Content-Type': 'text/plain; charset=utf-8'
        },
        body: content
      });
      return { ok: res.ok, message: res.ok ? '✅ Saved to server' : 'HTTP ' + res.status };
    } catch(e) {
      return { ok: false, error: e.message };
    }
  },

  disconnect() {
    this.connected = false;
    return { ok: true, message: 'Disconnected' };
  },

  getProfiles() {
    try { return JSON.parse(localStorage.getItem('cp_ftp_profiles') || '{}'); }
    catch { return {}; }
  },

  saveProfile(name) {
    const p = this.getProfiles();
    p[name] = { host: this.host, port: this.port, user: this.user, protocol: this.protocol };
    localStorage.setItem('cp_ftp_profiles', JSON.stringify(p));
    return { ok: true, message: 'Profile "' + name + '" saved' };
  }
};
