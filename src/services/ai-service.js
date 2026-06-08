// ==========================================
// AI SERVICE - Real Implementation
// ==========================================
export const AIService = {
  provider: 'gemini',
  apiKey: '',
  model: 'gemini-1.5-flash',
  history: [],

  setApiKey(key, provider = 'gemini') {
    this.apiKey = key;
    this.provider = provider;
    localStorage.setItem('cp_ai_key', key);
    localStorage.setItem('cp_ai_provider', provider);
    return { ok: true, message: `✅ ${provider} API key saved` };
  },

  loadApiKey() {
    this.apiKey = localStorage.getItem('cp_ai_key') || '';
    this.provider = localStorage.getItem('cp_ai_provider') || 'gemini';
    return this.apiKey;
  },

  async chat(userMessage, codeContext = '') {
    this.loadApiKey();
    if (!this.apiKey) return { ok: false, error: '⚠️ No API key set. Add in Settings → AI.' };

    const systemPrompt = `You are CodePocket AI, an expert coding assistant embedded in a mobile code editor.
Be concise, practical, and always provide working code examples.
Current file context:\n${codeContext ? '```\n' + codeContext.slice(0, 2000) + '\n```' : 'No file open'}`;

    try {
      if (this.provider === 'gemini') {
        return await this._callGemini(userMessage, systemPrompt);
      } else if (this.provider === 'openai') {
        return await this._callOpenAI(userMessage, systemPrompt);
      } else if (this.provider === 'openrouter') {
        return await this._callOpenRouter(userMessage, systemPrompt);
      }
      return { ok: false, error: 'Unknown provider' };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },

  async _callGemini(message, systemPrompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const body = {
      contents: [
        ...this.history,
        { role: 'user', parts: [{ text: systemPrompt + '\n\nUser: ' + message }] }
      ],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';

    this.history.push({ role: 'user', parts: [{ text: message }] });
    this.history.push({ role: 'model', parts: [{ text: reply }] });
    if (this.history.length > 20) this.history = this.history.slice(-20);

    return { ok: true, reply };
  },

  async _callOpenAI(message, systemPrompt) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...this.history.map(h => ({ role: h.role === 'model' ? 'assistant' : h.role, content: h.content })),
          { role: 'user', content: message }
        ],
        max_tokens: 2048
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const reply = data.choices?.[0]?.message?.content || 'No response';
    this.history.push({ role: 'user', content: message });
    this.history.push({ role: 'assistant', content: reply });
    if (this.history.length > 20) this.history = this.history.slice(-20);
    return { ok: true, reply };
  },

  async _callOpenRouter(message, systemPrompt) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://codepocket.app',
        'X-Title': 'CodePocket'
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-7b-instruct:free',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ]
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    const reply = data.choices?.[0]?.message?.content || 'No response';
    return { ok: true, reply };
  },

  async complete(code, filename = '') {
    const ext = filename.split('.').pop();
    const prompt = `Complete this ${ext} code. Reply with ONLY the completed code, no explanations:\n\`\`\`\n${code}\n\`\`\``;
    return await this.chat(prompt, code);
  },

  async explain(code) {
    return await this.chat(`Explain this code briefly:\n\`\`\`\n${code}\n\`\`\``, code);
  },

  async fix(code, error = '') {
    const prompt = error
      ? `Fix this code. Error: "${error}"\n\`\`\`\n${code}\n\`\`\`\nReply with fixed code only.`
      : `Find and fix bugs in this code:\n\`\`\`\n${code}\n\`\`\``;
    return await this.chat(prompt, code);
  },

  async generateCode(description, language = 'javascript') {
    return await this.chat(`Write ${language} code for: ${description}\nReply with code only, no explanations.`);
  },

  clearHistory() {
    this.history = [];
    return { ok: true, message: 'Chat history cleared' };
  }
};
