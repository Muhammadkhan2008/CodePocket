// ==========================================
// GIT SERVICE - GitHub API Integration
// ==========================================
export const GitService = {
  token: '',
  owner: '',
  repo: '',
  branch: 'main',
  connected: false,

  init(token, owner, repo, branch = 'main') {
    this.token = token; this.owner = owner;
    this.repo = repo; this.branch = branch;
    this.connected = !!(token && owner && repo);
    if (this.connected) {
      localStorage.setItem('cp_git_config', JSON.stringify({ owner, repo, branch }));
      localStorage.setItem('cp_git_token', token);
    }
    return { ok: this.connected, message: this.connected ? `✅ Git: ${owner}/${repo}` : 'Missing config' };
  },

  load() {
    try {
      const config = JSON.parse(localStorage.getItem('cp_git_config') || '{}');
      const token = localStorage.getItem('cp_git_token') || '';
      if (config.owner && config.repo && token) {
        this.token = token; this.owner = config.owner;
        this.repo = config.repo; this.branch = config.branch || 'main';
        this.connected = true;
      }
    } catch(e) {}
    return this.connected;
  },

  async _api(method, endpoint, body = null) {
    const opts = {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'CodePocket'
      }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`https://api.github.com${endpoint}`, opts);
    const data = await res.json();
    if (data.message && !res.ok) throw new Error(data.message);
    return data;
  },

  async status() {
    if (!this.connected) return { ok: false, error: 'Not configured. Set token in Settings → Git' };
    try {
      const repo = await this._api('GET', `/repos/${this.owner}/${this.repo}`);
      const branch = await this._api('GET', `/repos/${this.owner}/${this.repo}/branches/${this.branch}`);
      return {
        ok: true,
        repo: repo.full_name,
        branch: branch.name,
        lastCommit: branch.commit?.commit?.message || '',
        private: repo.private,
        stars: repo.stargazers_count
      };
    } catch (e) { return { ok: false, error: e.message }; }
  },

  async listFiles(path = '') {
    if (!this.connected) return { ok: false, error: 'Not configured', files: [] };
    try {
      const endpoint = `/repos/${this.owner}/${this.repo}/contents/${path}?ref=${this.branch}`;
      const data = await this._api('GET', endpoint);
      const files = Array.isArray(data) ? data.map(f => ({
        name: f.name, type: f.type, size: f.size,
        path: f.path, sha: f.sha, download_url: f.download_url
      })) : [];
      return { ok: true, files, path };
    } catch (e) { return { ok: false, error: e.message, files: [] }; }
  },

  async readFile(path) {
    if (!this.connected) return { ok: false, error: 'Not configured' };
    try {
      const data = await this._api('GET', `/repos/${this.owner}/${this.repo}/contents/${path}?ref=${this.branch}`);
      const content = atob(data.content.replace(/\n/g, ''));
      return { ok: true, content, sha: data.sha, path };
    } catch (e) { return { ok: false, error: e.message }; }
  },

  async writeFile(path, content, message = '') {
    if (!this.connected) return { ok: false, error: 'Not configured' };
    try {
      let sha = undefined;
      try {
        const existing = await this._api('GET', `/repos/${this.owner}/${this.repo}/contents/${path}?ref=${this.branch}`);
        sha = existing.sha;
      } catch(e) {}

      const commitMsg = message || `✏️ Update ${path} via CodePocket`;
      const body = {
        message: commitMsg,
        content: btoa(unescape(encodeURIComponent(content))),
        branch: this.branch
      };
      if (sha) body.sha = sha;

      const result = await this._api('PUT', `/repos/${this.owner}/${this.repo}/contents/${path}`, body);
      return { ok: true, message: `✅ Committed: ${commitMsg}`, sha: result.content?.sha };
    } catch (e) { return { ok: false, error: e.message }; }
  },

  async deleteFile(path, message = '') {
    if (!this.connected) return { ok: false, error: 'Not configured' };
    try {
      const existing = await this._api('GET', `/repos/${this.owner}/${this.repo}/contents/${path}?ref=${this.branch}`);
      await this._api('DELETE', `/repos/${this.owner}/${this.repo}/contents/${path}`, {
        message: message || `🗑️ Delete ${path} via CodePocket`,
        sha: existing.sha,
        branch: this.branch
      });
      return { ok: true, message: `Deleted ${path}` };
    } catch (e) { return { ok: false, error: e.message }; }
  },

  async getCommits(limit = 10) {
    if (!this.connected) return { ok: false, error: 'Not configured', commits: [] };
    try {
      const data = await this._api('GET', `/repos/${this.owner}/${this.repo}/commits?sha=${this.branch}&per_page=${limit}`);
      const commits = data.map(c => ({
        sha: c.sha.slice(0, 7),
        message: c.commit.message.split('\n')[0],
        author: c.commit.author.name,
        date: new Date(c.commit.author.date).toLocaleDateString()
      }));
      return { ok: true, commits };
    } catch (e) { return { ok: false, error: e.message, commits: [] }; }
  },

  async createRepo(name, isPrivate = false, description = '') {
    if (!this.token) return { ok: false, error: 'No token' };
    try {
      const data = await this._api('POST', '/user/repos', {
        name, private: isPrivate, description,
        auto_init: true
      });
      return { ok: true, url: data.html_url, message: `✅ Repo created: ${data.full_name}` };
    } catch (e) { return { ok: false, error: e.message }; }
  },

  disconnect() {
    this.connected = false; this.token = '';
    localStorage.removeItem('cp_git_token');
    localStorage.removeItem('cp_git_config');
    return { ok: true, message: 'Git disconnected' };
  }
};
