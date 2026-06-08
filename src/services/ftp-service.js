// ==========================================
// FTP / SFTP SERVICE - Remote File System
// ==========================================
export const FTPService = {
  connected: false,
  host: '', port: 21, user: '', pass: '', protocol: 'ftp',
  currentPath: '/',
  _baseUrl: '',

  async connect(host, port, user, pass, protocol = 'ftp') {
    this.host = host; this.port = parseInt(port);
    this.user = user; this.pass = pass; this.protocol = protocol;
    this._baseUrl = `${protocol}://${user}:${encodeURIComponent(pass)}@${host}:${port}`;
    this.connected = true;
    return { ok: true, message: `✅ Connected to ${protocol.toUpperCase()} ${host}:${port}` };
  },

  async listFiles(path = '/') {
    if (!this.connected) return { ok: false, error: 'Not connected. Use FTP connect first.' };
    this.currentPath = path;
    try {
      const response = await fetch(`${this._baseUrl}${path}`);
      const text = await response.text();
      return { ok: true, files: this._parseListing(text), path };
    } catch (e) {
      return { ok: false, error: e.message, files: [] };
    }
  },

  async readFile(path) {
    if (!this.connected) return { ok: false, error: 'Not connected' };
    try {
      const response = await fetch(`${this._baseUrl}${path}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const content = await response.text();
      return { ok: true, content };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },

  async writeFile(path, content) {
    if (!this.connected) return { ok: false, error: 'Not connected' };
    try {
      const response = await fetch(`${this._baseUrl}${path}`, {
        method: 'PUT', body: content,
        headers: { 'Content-Type': 'text/plain' }
      });
      return { ok: response.ok, message: response.ok ? `Saved to ${path}` : 'Write failed' };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },

  async deleteFile(path) {
    if (!this.connected) return { ok: false, error: 'Not connected' };
    try {
      const r = await fetch(`${this._baseUrl}${path}`, { method: 'DELETE' });
      return { ok: r.ok };
    } catch (e) { return { ok: false, error: e.message }; }
  },

  disconnect() {
    this.connected = false;
    this.host = ''; this.user = ''; this.pass = ''; this._baseUrl = '';
    return { ok: true, message: 'Disconnected from remote server' };
  },

  _parseListing(raw) {
    const files = [];
    const lines = raw.trim().split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 9) continue;
      const isDir = line.startsWith('d');
      const name = parts.slice(8).join(' ');
      if (name === '.' || name === '..') continue;
      files.push({ name, type: isDir ? 'dir' : 'file', size: parts[4] });
    }
    return files;
  },

  saveProfile(name) {
    const profiles = this.getProfiles();
    profiles[name] = { host: this.host, port: this.port, user: this.user, protocol: this.protocol };
    localStorage.setItem('cp_ftp_profiles', JSON.stringify(profiles));
    return { ok: true, message: `Profile "${name}" saved` };
  },

  getProfiles() {
    try { return JSON.parse(localStorage.getItem('cp_ftp_profiles') || '{}'); }
    catch { return {}; }
  },

  deleteProfile(name) {
    const p = this.getProfiles(); delete p[name];
    localStorage.setItem('cp_ftp_profiles', JSON.stringify(p));
  }
};
