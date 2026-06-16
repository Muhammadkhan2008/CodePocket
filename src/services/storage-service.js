// ==========================================
// STORAGE SERVICE - localStorage + IndexedDB
// ==========================================

export const StorageService = {
  backend: 'localStorage',
  db: null,

  async init() {
    // Try IndexedDB first
    try {
      await this._initIDB();
      this.backend = 'indexeddb';
    } catch(e) {
      this.backend = 'localStorage';
    }
    // Migrate from localStorage if needed
    await this._migrate();
    return { ok: true, backend: this.backend };
  },

  async _initIDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('CodePocketDB', 2);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => { this.db = req.result; resolve(); };
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'path' });
        }
      };
    });
  },

  async _migrate() {
    // If there are files in localStorage, move to IndexedDB
    try {
      const lsData = localStorage.getItem('codepocket_files');
      if (lsData && this.backend === 'indexeddb') {
        const files = JSON.parse(lsData);
        for (const [path, content] of Object.entries(files)) {
          await this._idbPut({ path, content, modified: Date.now() });
        }
      }
    } catch(e) {}
  },

  async saveFile(path, content) {
    try {
      if (this.backend === 'indexeddb' && this.db) {
        await this._idbPut({ path, content, modified: Date.now() });
        // Also keep localStorage in sync as backup
        const files = this._lsGet();
        files[path] = content;
        localStorage.setItem('codepocket_files', JSON.stringify(files));
        return { ok: true };
      }
      // localStorage fallback
      const files = this._lsGet();
      files[path] = content;
      localStorage.setItem('codepocket_files', JSON.stringify(files));
      return { ok: true };
    } catch(e) {
      return { ok: false, error: e.message };
    }
  },

  async readFile(path) {
    try {
      if (this.backend === 'indexeddb' && this.db) {
        const r = await this._idbGet(path);
        if (r) return { ok: true, content: r.content };
      }
      const files = this._lsGet();
      return path in files ? { ok: true, content: files[path] } : { ok: false, error: 'Not found' };
    } catch(e) {
      return { ok: false, error: e.message };
    }
  },

  async deleteFile(path) {
    try {
      if (this.backend === 'indexeddb' && this.db) {
        await this._idbDelete(path);
      }
      const files = this._lsGet();
      delete files[path];
      localStorage.setItem('codepocket_files', JSON.stringify(files));
      return { ok: true };
    } catch(e) {
      return { ok: false, error: e.message };
    }
  },

  async getAllFiles() {
    try {
      if (this.backend === 'indexeddb' && this.db) {
        const records = await this._idbGetAll();
        if (records.length > 0) {
          const files = {};
          records.forEach(r => { files[r.path] = r.content; });
          return { ok: true, files };
        }
      }
      return { ok: true, files: this._lsGet() };
    } catch(e) {
      return { ok: true, files: this._lsGet() };
    }
  },

  async exportProject(name = 'codepocket-export') {
    const { files } = await this.getAllFiles();
    const content = Object.entries(files)
      .map(([p, c]) => `\n${'='.repeat(50)}\nFILE: ${p}\n${'='.repeat(50)}\n${c}`)
      .join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name + '.txt';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    return { ok: true, message: '✅ Exported ' + Object.keys(files).length + ' files' };
  },

  _lsGet() {
    try { return JSON.parse(localStorage.getItem('codepocket_files') || '{}'); }
    catch { return {}; }
  },

  _idbPut(val) {
    return new Promise((res, rej) => {
      const tx = this.db.transaction('files', 'readwrite');
      const r = tx.objectStore('files').put(val);
      r.onsuccess = () => res(); r.onerror = () => rej(r.error);
    });
  },
  _idbGet(key) {
    return new Promise((res, rej) => {
      const tx = this.db.transaction('files', 'readonly');
      const r = tx.objectStore('files').get(key);
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  },
  _idbDelete(key) {
    return new Promise((res, rej) => {
      const tx = this.db.transaction('files', 'readwrite');
      const r = tx.objectStore('files').delete(key);
      r.onsuccess = () => res(); r.onerror = () => rej(r.error);
    });
  },
  _idbGetAll() {
    return new Promise((res, rej) => {
      const tx = this.db.transaction('files', 'readonly');
      const r = tx.objectStore('files').getAll();
      r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error);
    });
  }
};
