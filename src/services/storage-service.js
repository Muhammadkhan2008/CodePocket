// ==========================================
// STORAGE SERVICE - Multi-Backend Storage
// ==========================================
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

export const StorageService = {
  backend: 'localStorage', // 'localStorage' | 'capacitor' | 'indexeddb'
  dbName: 'CodePocketDB',
  db: null,

  async init() {
    if (Capacitor.isNativePlatform()) {
      this.backend = 'capacitor';
    } else {
      // Try IndexedDB for large file support in browser
      try {
        await this._initIndexedDB();
        this.backend = 'indexeddb';
      } catch(e) {
        this.backend = 'localStorage';
      }
    }
    return { ok: true, backend: this.backend };
  },

  async _initIndexedDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => { this.db = req.result; resolve(); };
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'path' });
        }
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'name' });
        }
      };
    });
  },

  async saveFile(path, content) {
    try {
      if (this.backend === 'capacitor') {
        await Filesystem.writeFile({
          path, data: content,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
          recursive: true
        });
        return { ok: true, path, backend: 'capacitor' };
      } else if (this.backend === 'indexeddb' && this.db) {
        await this._idbPut('files', { path, content, modified: Date.now() });
        return { ok: true, path, backend: 'indexeddb' };
      } else {
        const files = this._lsGetFiles();
        files[path] = content;
        localStorage.setItem('codepocket_files', JSON.stringify(files));
        return { ok: true, path, backend: 'localStorage' };
      }
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },

  async readFile(path) {
    try {
      if (this.backend === 'capacitor') {
        const result = await Filesystem.readFile({
          path, directory: Directory.Documents, encoding: Encoding.UTF8
        });
        return { ok: true, content: result.data };
      } else if (this.backend === 'indexeddb' && this.db) {
        const record = await this._idbGet('files', path);
        return record ? { ok: true, content: record.content } : { ok: false, error: 'File not found' };
      } else {
        const files = this._lsGetFiles();
        return path in files ? { ok: true, content: files[path] } : { ok: false, error: 'File not found' };
      }
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },

  async deleteFile(path) {
    try {
      if (this.backend === 'capacitor') {
        await Filesystem.deleteFile({ path, directory: Directory.Documents });
        return { ok: true };
      } else if (this.backend === 'indexeddb' && this.db) {
        await this._idbDelete('files', path);
        return { ok: true };
      } else {
        const files = this._lsGetFiles();
        delete files[path];
        localStorage.setItem('codepocket_files', JSON.stringify(files));
        return { ok: true };
      }
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },

  async getAllFiles() {
    try {
      if (this.backend === 'indexeddb' && this.db) {
        const records = await this._idbGetAll('files');
        const files = {};
        records.forEach(r => { files[r.path] = r.content; });
        return { ok: true, files };
      } else {
        return { ok: true, files: this._lsGetFiles() };
      }
    } catch (e) {
      return { ok: false, files: {}, error: e.message };
    }
  },

  // Export all files as ZIP download
  async exportProject(projectName = 'codepocket-project') {
    const { files } = await this.getAllFiles();
    const lines = [];
    for (const [path, content] of Object.entries(files)) {
      lines.push(`\n=== FILE: ${path} ===\n${content}`);
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${projectName}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return { ok: true, message: `Exported ${Object.keys(files).length} files` };
  },

  // IndexedDB helpers
  _idbPut(store, value) {
    return new Promise((res, rej) => {
      const tx = this.db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).put(value);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  },
  _idbGet(store, key) {
    return new Promise((res, rej) => {
      const tx = this.db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  },
  _idbDelete(store, key) {
    return new Promise((res, rej) => {
      const tx = this.db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).delete(key);
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    });
  },
  _idbGetAll(store) {
    return new Promise((res, rej) => {
      const tx = this.db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    });
  },
  _lsGetFiles() {
    try { return JSON.parse(localStorage.getItem('codepocket_files') || '{}'); }
    catch { return {}; }
  }
};
