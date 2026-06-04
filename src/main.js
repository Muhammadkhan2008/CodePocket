import { EditorView, basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { Compartment, EditorState } from "@codemirror/state";
import { autocompletion, closeBrackets, acceptCompletion } from "@codemirror/autocomplete";
import * as prettier from "prettier/standalone";
import prettierPluginBabel from "prettier/plugins/babel";
import prettierPluginHtml from "prettier/plugins/html";
import prettierPluginCss from "prettier/plugins/postcss";
import prettierEstree from "prettier/plugins/estree";
import { lintGutter } from "@codemirror/lint";
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';

// ====== NEW: Enhanced Language Support ======
import { java } from "@codemirror/lang-java";
import { rust } from "@codemirror/lang-rust";
import { go } from "@codemirror/lang-go";
import { php } from "@codemirror/lang-php";
import { sql } from "@codemirror/lang-sql";
import { yaml } from "@codemirror/lang-yaml";
import { vue } from "@codemirror/lang-vue";

// ====== NEW: AI Services Import ======
import { AIService } from './services/ai-service.js';
import { GitService } from './services/git-service.js';
import { DebugService } from './services/debug-service.js';

// Language map for runtime switching
const LANGUAGE_MAP = {
  js: () => javascript(),
  ts: () => javascript({ typescript: true }),
  jsx: () => javascript({ jsx: true }),
  tsx: () => javascript({ jsx: true, typescript: true }),
  html: () => html(),
  css: () => css(),
  cpp: () => cpp(),
  c: () => cpp(),
  py: () => python(),
  python: () => python(),
  json: () => json(),
  md: () => markdown(),
  markdown: () => markdown(),
  
  // ====== NEW: Enhanced Language Support ======
  java: () => java(),
  rust: () => rust(),
  rs: () => rust(),
  go: () => go(),
  php: () => php(),
  sql: () => sql(),
  yaml: () => yaml(),
  yml: () => yaml(),
  vue: () => vue(),
};

// Detect language from filename extension
function detectLanguage(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return LANGUAGE_MAP[ext] ? LANGUAGE_MAP[ext]() : javascript();
}

// Global compartments for hot-swapping
const languageCompartment = new Compartment();
const wrapCompartment = new Compartment();

const PRootPlugin = registerPlugin('PRootPlugin');

// ==========================================
// 1. GLOBAL CODEPOCKET API (For Plugins)
// ==========================================
window.CodePocketAPI = {
  version: "2.0",
  customRunHandler: null,
  
  // ====== NEW: Enhanced API Features ======
  ai: AIService,
  git: GitService,
  debug: DebugService,
  
  onRun(handlerFunction) {
    this.customRunHandler = handlerFunction;
    console.log("Plugin injected custom run handler!");
  },
  
  getCode() { return FileManager.getCurrentContent(); },
  setCode(text) { EditorManager.setContent(text, FileManager.activeFile); },
  print(text, type="system") { TerminalManager.print(text, type); },

  UI: {
    setTheme(colors) {
      for (const [key, value] of Object.entries(colors)) {
        document.documentElement.style.setProperty(key, value);
      }
    },
    addSidebarPanel(id, title, icon, htmlContent) {
      const nav = document.querySelector(".activity-top");
      const btn = document.createElement("button");
      btn.className = "activity-icon plugin-icon";
      btn.setAttribute("data-panel", id);
      btn.title = title;
      btn.innerHTML = icon;
      nav.appendChild(btn);

      const aside = document.getElementById("secondary-panel");
      const panel = document.createElement("div");
      panel.id = `panel-${id}`;
      panel.className = "side-panel hidden";
      panel.innerHTML = `<div class="panel-header"><span>${title.toUpperCase()}</span></div><div class="panel-content">${htmlContent}</div>`;
      aside.appendChild(panel);

      btn.addEventListener("click", () => {
        document.querySelectorAll(".activity-icon").forEach(i => i.classList.remove("active"));
        btn.classList.add("active");
        document.querySelectorAll(".side-panel").forEach(p => p.classList.add("hidden"));
        panel.classList.remove("hidden");
      });
    },
    setHeaderWidget(html) {
      const headerLeft = document.querySelector(".header-left");
      const div = document.createElement("div");
      div.innerHTML = html;
      div.style.marginLeft = "10px";
      headerLeft.appendChild(div);
    }
  },

  Commands: {
    register(id, title, callback) {
      UIManager.customCommands = UIManager.customCommands || {};
      UIManager.customCommands[id] = callback;
      const results = document.getElementById("palette-results");
      const li = document.createElement("li");
      li.setAttribute("data-cmd", id);
      li.innerHTML = `🔌 ${title}`;
      results.appendChild(li);
    }
  }
};

// ==========================================
// 2. FILE SYSTEM MANAGER
// ==========================================
const FileManager = {
  files: {},
  activeFile: "",
  
  init() {
    let saved = localStorage.getItem('codepocket_files');
    if (saved) this.files = JSON.parse(saved);
    if (Object.keys(this.files).length === 0) {
      this.files = {
        "index.html": `<!DOCTYPE html>\n<html>\n<body>\n  <h1>CodePocket WebView</h1>\n  <script>console.log("JS executing natively!");</script>\n</body>\n</html>`,
        "main.cpp": `#include <iostream>\nusing namespace std;\n\nint main() {\n  cout << "Hello World!";\n  return 0;\n}`
      };
    }
    this.activeFile = Object.keys(this.files)[0];
    this.renderSidebar();
    
    document.getElementById("action-new-file").addEventListener("click", () => this.promptNewFile());
    document.getElementById("welcome-new-file").addEventListener("click", () => this.promptNewFile());
    const welcomeOpenFolder = document.getElementById("welcome-open-folder");
    if (welcomeOpenFolder) {
      welcomeOpenFolder.addEventListener("click", () => {
        document.getElementById("native-folder-picker").click();
      });
    }
    document.getElementById("action-save").addEventListener("click", () => this.save());
    document.getElementById("action-close").addEventListener("click", () => this.closeFile());
    
    const actionPalette = document.getElementById("action-palette");
    if(actionPalette) {
      actionPalette.addEventListener("click", () => {
        document.getElementById("dots-dropdown").classList.add("hidden");
        const palette = document.getElementById("command-palette");
        palette.classList.toggle("hidden");
        if (!palette.classList.contains("hidden")) document.getElementById("palette-input").focus();
      });
    }
    
    document.getElementById("action-open-folder").addEventListener("click", () => {
      document.getElementById("native-folder-picker").click();
      document.getElementById("dots-dropdown").classList.add("hidden");
    });
    
    document.getElementById("native-folder-picker").addEventListener("change", (e) => {
      const selectedFiles = e.target.files;
      if(selectedFiles.length > 0) {
        TerminalManager.print(`Imported ${selectedFiles.length} files from folder.`);
        for(let i=0; i<selectedFiles.length; i++) {
          const file = selectedFiles[i];
          const reader = new FileReader();
          reader.onload = (ev) => {
            this.files[file.name] = ev.target.result;
            this.renderSidebar();
            if(i === 0) this.openFile(file.name);
          };
          reader.readAsText(file);
        }
      }
    });

    document.getElementById("action-find-file").addEventListener("click", () => {
      document.querySelector('[data-panel="search"]').click();
      document.getElementById("dots-dropdown").classList.add("hidden");
    });

    document.getElementById("action-settings-menu").addEventListener("click", () => {
      document.querySelector('[data-panel="settings"]').click();
      document.getElementById("dots-dropdown").classList.add("hidden");
    });

    document.getElementById("action-exit").addEventListener("click", () => {
      if(window.navigator.app) {
        navigator.app.exitApp();
      } else {
        TerminalManager.print("Exit App is only supported in Native Android/iOS build.", "error");
      }
      document.getElementById("dots-dropdown").classList.add("hidden");
    });
  },

  async save() {
    localStorage.setItem('codepocket_files', JSON.stringify(this.files));

    if (!this.activeFile) {
      TerminalManager.print("No file active to save.", "error");
      return;
    }

    const content = this.files[this.activeFile] || "";

    if (Capacitor.isNativePlatform()) {
      try {
        await Filesystem.writeFile({
          path: this.activeFile,
          data: content,
          directory: Directory.Documents,
          recursive: true,
        });
        TerminalManager.print(`Saved ${this.activeFile} to device storage.`, "success");
        return;
      } catch (error) {
        TerminalManager.print(`Native save failed, exporting instead: ${error.message}`, "error");
      }
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = this.activeFile;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    TerminalManager.print(`Exporting ${this.activeFile}...`);
  },

  renderSidebar() {
    const list = document.getElementById("file-list");
    list.innerHTML = "";
    for (let name in this.files) {
      const el = document.createElement("div");
      el.className = "file-item" + (name === this.activeFile ? " active" : "");
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "space-between";

      const nameSpan = document.createElement("span");
      nameSpan.textContent = `📄 ${name}`;
      nameSpan.style.flex = "1";
      nameSpan.style.overflow = "hidden";
      nameSpan.style.textOverflow = "ellipsis";
      nameSpan.style.whiteSpace = "nowrap";
      nameSpan.addEventListener("click", () => this.openFile(name));

      const delBtn = document.createElement("button");
      delBtn.textContent = "🗑️";
      delBtn.title = "Delete file";
      delBtn.style.cssText = "background:none;border:none;cursor:pointer;padding:0 4px;font-size:12px;opacity:0.5;flex-shrink:0;";
      delBtn.addEventListener("mouseenter", () => delBtn.style.opacity = "1");
      delBtn.addEventListener("mouseleave", () => delBtn.style.opacity = "0.5");
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`Delete ${name}? This cannot be undone.`)) {
          delete this.files[name];
          if (this.fileStates) delete this.fileStates[name];
          if (this.activeFile === name) {
            const remaining = Object.keys(this.files);
            this.activeFile = remaining.length ? remaining[0] : "";
            if (this.activeFile) {
              EditorManager.setContent(this.files[this.activeFile], this.activeFile);
            } else {
              EditorManager.setContent("", "");
              document.getElementById("welcome-screen").classList.remove("hidden");
            }
          }
          localStorage.setItem("codepocket_files", JSON.stringify(this.files));
          this.renderSidebar();
          TerminalManager.print(`Deleted ${name}`, "success");
        }
      });

      el.appendChild(nameSpan);
      el.appendChild(delBtn);
      list.appendChild(el);
    }
    document.getElementById("active-file-name").textContent = this.activeFile ? `- ${this.activeFile}` : "";
    
    if (this.activeFile) {
      document.getElementById("welcome-screen").classList.add("hidden");
    } else {
      document.getElementById("welcome-screen").classList.remove("hidden");
    }
  },

  openFile(name) {
    if (this.files[name] === undefined) return;
    // Save current file's editor state before switching
    if (this.activeFile && EditorManager.view) {
      this.fileStates = this.fileStates || {};
      this.fileStates[this.activeFile] = EditorManager.view.state;
    }
    this.activeFile = name;
    this.renderSidebar();
    // Restore saved EditorState for this file, or load fresh content
    const savedState = (this.fileStates || {})[name];
    if (savedState) {
      EditorManager.view.setState(savedState);
    } else {
      EditorManager.setContent(this.files[name], name);
    }
  },

  promptNewFile() {
    const name = prompt("File name (e.g. script.js):");
    if (name) {
      this.files[name] = "// New file";
      this.openFile(name);
      this.save();
    }
    document.getElementById("dots-dropdown").classList.add("hidden");
  },

  closeFile() {
    this.activeFile = "";
    this.renderSidebar();
    EditorManager.setContent("", "");
    document.getElementById("welcome-screen").classList.remove("hidden");
    document.getElementById("dots-dropdown").classList.add("hidden");
  },

  saveTimeout: null,

  updateCurrentContent(content) {
    if(this.activeFile) {
      this.files[this.activeFile] = content;
      
      // Debounced auto-save (saves 1 second after you stop typing to prevent lag)
      if (this.saveTimeout) clearTimeout(this.saveTimeout);
      this.saveTimeout = setTimeout(() => {
        localStorage.setItem('codepocket_files', JSON.stringify(this.files));
      }, 1000);
    }
  },

  getCurrentContent() {
    return this.activeFile ? this.files[this.activeFile] : "";
  }
};

// ==========================================
// 3. EDITOR MANAGER (CodeMirror 6)
// ==========================================
const EditorManager = {
  view: null,
  
  init() {
    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        FileManager.updateCurrentContent(update.state.doc.toString());
      }
    });

    this.view = new EditorView({
      doc: "",
      extensions: [
        basicSetup,
        wrapCompartment.of([]),
        updateListener,
        languageCompartment.of(javascript()),
        autocompletion({ activateOnTyping: true, maxRenderedOptions: 10 }),
        closeBrackets(),
        lintGutter(),
        oneDark
      ],
      parent: document.getElementById("editor-container")
    });
    
    this.bindPencilTools();
  },

  setContent(content, filename) {
    const lang = filename ? detectLanguage(filename) : javascript();
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: content },
      effects: languageCompartment.reconfigure(lang)
    });
  },

  insertText(text) {
    const tx = this.view.state.update({
      changes: { from: this.view.state.selection.main.head, insert: text }
    });
    this.view.dispatch(tx);
    this.view.focus();
  },

  bindPencilTools() {
    const dropdown = document.getElementById("pencil-dropdown");
    dropdown.addEventListener("click", (e) => {
      if(e.target.tagName !== "BUTTON") return;
      const action = e.target.getAttribute("data-action");
      
      switch(action) {
        case "syntax": {
          const langKey = prompt("Enter language (js, ts, html, css, cpp, py, json, md):", "js");
          if (langKey && LANGUAGE_MAP[langKey.toLowerCase()]) {
            const newLang = LANGUAGE_MAP[langKey.toLowerCase()]();
            EditorManager.view.dispatch({ effects: languageCompartment.reconfigure(newLang) });
            TerminalManager.print(`✅ Syntax switched to ${langKey}`, "success");
          } else if (langKey) {
            TerminalManager.print(`Unknown language: ${langKey}. Try: js, ts, html, css, cpp, py, json, md`, "error");
          }
          break;
        }
        case "rename": {
          const newName = prompt("Rename file to:", FileManager.activeFile);
          if(newName && newName !== FileManager.activeFile) {
            FileManager.files[newName] = FileManager.files[FileManager.activeFile];
            delete FileManager.files[FileManager.activeFile];
            FileManager.openFile(newName);
          }
          break;
        }
        case "newline":
          this.insertText("\n");
          break;
        case "wordwrap": {
          const isWrapped = EditorManager.wordWrapOn || false;
          EditorManager.wordWrapOn = !isWrapped;
          EditorManager.view.dispatch({
            effects: wrapCompartment.reconfigure(
              EditorManager.wordWrapOn ? EditorView.lineWrapping : []
            )
          });
          TerminalManager.print(`Word Wrap ${EditorManager.wordWrapOn ? "ON ✅" : "OFF"}`);
          break;
        }
        case "format": {
          const active = FileManager.activeFile;
          const code = EditorManager.view.state.doc.toString();
          const ext = active ? active.split('.').pop().toLowerCase() : 'js';
          const parserMap = { js: 'babel', jsx: 'babel', ts: 'babel', tsx: 'babel', html: 'html', css: 'css', scss: 'css', less: 'css', json: 'json' };
          const parser = parserMap[ext];
          if (!parser) {
            TerminalManager.print(`Format not supported for .${ext} files`, "error");
            break;
          }
          const pluginMap = {
            babel: [prettierPluginBabel, prettierEstree],
            html: [prettierPluginHtml],
            css: [prettierPluginCss],
            json: [prettierPluginBabel, prettierEstree],
          };
          prettier.format(code, { parser, plugins: pluginMap[parser] || [prettierPluginBabel, prettierEstree], tabWidth: 2, semi: true, singleQuote: true })
            .then(formatted => {
              EditorManager.view.dispatch({
                changes: { from: 0, to: EditorManager.view.state.doc.length, insert: formatted }
              });
              TerminalManager.print("Code formatted successfully!", "success");
            })
            .catch(err => {
              TerminalManager.print(`Format error: ${err.message}`, "error");
            });
          break;
        }
        case "color":
          document.getElementById("native-color-picker").click();
          break;
        case "cut":
          document.execCommand("cut");
          TerminalManager.print("Cut executed.");
          break;
        case "copy": {
          const selection = this.view.state.sliceDoc(this.view.state.selection.main.from, this.view.state.selection.main.to);
          if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(selection);
          } else {
            const textArea = document.createElement("textarea");
            textArea.value = selection;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
          }
          TerminalManager.print("Copied to clipboard.");
          break;
        }
        case "paste":
          navigator.clipboard.readText().then(text => this.insertText(text));
          break;
        case "selectall":
          this.view.dispatch({ selection: { anchor: 0, head: this.view.state.doc.length }});
          break;
      }
      dropdown.classList.add("hidden");
    });
    
    document.getElementById("native-color-picker").addEventListener("input", (e) => {
      this.insertText(e.target.value);
    });
  }
};

// ==========================================
// 4. TERMINAL MANAGER (xterm.js)
// ==========================================
const TerminalManager = {
  panel: document.getElementById("terminal-panel"),
  container: document.getElementById("terminal-output"),
  tabsContainer: document.getElementById("terminal-tabs"),
  terminals: {},
  activeSessionId: null,
  sessionCounter: 0,
  globalListenerAdded: false,
  
  async init() {
    this.container.innerHTML = "";
    this.container.style.overflow = "hidden"; // xterm needs this
    this.container.style.padding = "0px";
    
    if (!this.globalListenerAdded && window.Capacitor?.isNativePlatform()) {
      PRootPlugin.addListener('terminal_output', (info) => {
        if (this.terminals[info.sessionId]) {
           this.terminals[info.sessionId].term.write(info.data);
        }
      });
      
      try {
        await PRootPlugin.initEnvironment();
      } catch (e) {
        console.error("Failed to init Alpine:", e);
      }
      this.globalListenerAdded = true;
    }
    
    // Create first terminal
    this.createTerminal();
    
    document.getElementById("add-terminal-btn").addEventListener("click", () => {
      this.createTerminal();
    });
  },
  
  async createTerminal() {
    this.sessionCounter++;
    const sessionId = `term_${this.sessionCounter}`;
    
    // Create Tab UI
    const tabEl = document.createElement("button");
    tabEl.className = "terminal-tab";
    tabEl.innerText = `Term ${this.sessionCounter}`;
    tabEl.style.padding = "5px 10px";
    tabEl.style.border = "none";
    tabEl.style.background = "transparent";
    tabEl.style.color = "var(--text-secondary)";
    tabEl.style.cursor = "pointer";
    tabEl.style.outline = "none";
    
    // Create Container
    const termContainer = document.createElement("div");
    termContainer.style.width = "100%";
    termContainer.style.height = "100%";
    termContainer.style.padding = "5px";
    termContainer.style.display = "none";
    
    this.tabsContainer.appendChild(tabEl);
    this.container.appendChild(termContainer);
    
    const term = new Terminal({
      theme: { background: '#111', foreground: '#fff' },
      fontSize: 14,
      fontFamily: 'Fira Code, monospace',
      cursorBlink: true
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(termContainer);
    
    term.onData(data => {
      if (window.Capacitor?.isNativePlatform()) {
        PRootPlugin.writeData({ sessionId, data });
      } else {
        term.write(data);
      }
    });
    
    this.terminals[sessionId] = { term, fitAddon, tabEl, termContainer };
    
    tabEl.addEventListener("click", () => this.switchTerminal(sessionId));
    this.switchTerminal(sessionId);
    
    if (window.Capacitor?.isNativePlatform()) {
      try {
        await PRootPlugin.startSession({ sessionId });
      } catch (e) {
        term.write(`\x1b[31mError starting session: ${e.message}\x1b[0m\r\n`);
      }
    } else {
      term.write("\x1b[31mWeb Browser Mode: PRoot not available.\x1b[0m\r\n");
    }
  },
  
  switchTerminal(sessionId) {
    this.activeSessionId = sessionId;
    Object.keys(this.terminals).forEach(id => {
      const t = this.terminals[id];
      if (id === sessionId) {
        t.tabEl.style.color = "var(--accent)";
        t.tabEl.style.borderBottom = "2px solid var(--accent)";
        t.termContainer.style.display = "block";
        setTimeout(() => {
          t.fitAddon.fit();
          t.term.focus();
          // Notify native layer of new terminal dimensions
          if (window.Capacitor?.isNativePlatform()) {
            const dims = t.fitAddon.proposeDimensions();
            if (dims) {
              PRootPlugin.resizeTerminal({
                sessionId: id,
                cols: dims.cols,
                rows: dims.rows
              }).catch(() => {});
            }
          }
        }, 50);
      } else {
        t.tabEl.style.color = "var(--text-secondary)";
        t.tabEl.style.borderBottom = "none";
        t.termContainer.style.display = "none";
      }
    });
  },
  
  print(msg, type="system") {
    if (!this.activeSessionId || !this.terminals[this.activeSessionId]) return;
    const term = this.terminals[this.activeSessionId].term;
    let color = "\x1b[36m";
    if(type === "error") color = "\x1b[31m";
    else if(type === "success") color = "\x1b[32m";
    term.writeln(`${color}[IDE]\x1b[0m ${msg}`);
    this.show();
  },
  
  hide() {
    this.panel.classList.add("hidden");
  },
  show() {
    this.panel.classList.remove("hidden");
    if (this.activeSessionId) {
      setTimeout(() => {
        this.terminals[this.activeSessionId].fitAddon.fit();
        this.terminals[this.activeSessionId].term.focus();
      }, 50);
    }
  }
};

document.getElementById("action-terminal").addEventListener("click", () => {
  if (TerminalManager.panel.classList.contains("hidden")) {
    TerminalManager.show();
  } else {
    TerminalManager.hide();
  }
  document.getElementById("dots-dropdown").classList.add("hidden");
});
document.getElementById("close-terminal-btn").addEventListener("click", () => TerminalManager.hide());

// Webview Logic
const webviewModal = document.getElementById("webview-modal");
const webviewFrame = document.getElementById("webview-frame");

document.getElementById("run-btn").addEventListener("click", () => {
  if (window.CodePocketAPI.customRunHandler) {
    window.CodePocketAPI.customRunHandler(FileManager.getCurrentContent());
    return;
  }

  const active = FileManager.activeFile;
  if (active.endsWith(".html") || active.endsWith(".js") || active.endsWith(".css")) {
    const consoleInterceptor = `
      <script>
        const originalLog = console.log;
        console.log = function(...args) {
          window.parent.postMessage({ type: 'console', log: args.join(' ') }, '*');
          originalLog.apply(console, args);
        };
        window.onerror = function(msg, url, line) {
          window.parent.postMessage({ type: 'error', log: msg + ' at line ' + line }, '*');
        };
      <\/script>
    `;
    let htmlContent = FileManager.getCurrentContent();
    if(active.endsWith(".html")) {
      htmlContent = htmlContent.replace("<head>", "<head>" + consoleInterceptor);
      if(!htmlContent.includes("<head>")) htmlContent = consoleInterceptor + htmlContent;
      webviewFrame.srcdoc = htmlContent;
      webviewModal.classList.remove("hidden");
    } else if (active.endsWith(".js")) {
      htmlContent = `${consoleInterceptor}<script>${htmlContent}<\/script>`;
      webviewFrame.srcdoc = htmlContent;
      TerminalManager.print(`Running ${active}...`);
    }
  } else if (active.endsWith(".py") || active.endsWith(".cpp")) {
    TerminalManager.print(`Sending ${active} to Native Compiler...`);
    // Instead of one-shot, we can pipe this into the active PRoot session
    if(Capacitor.isNativePlatform()) {
      const content = FileManager.getCurrentContent();
      const safeContent = content.replace(/'/g, "'\\''");
      // Write file into alpine root using echo
      PRootPlugin.writeData({ sessionId: TerminalManager.activeSessionId, data: `cat << 'EOF' > /root/${active}\n${content}\nEOF\n` });
      
      // Run it
      let cmd = active.endsWith(".py") ? `python3 /root/${active}\n` : `g++ /root/${active} && ./a.out\n`;
      setTimeout(() => {
        PRootPlugin.writeData({ sessionId: TerminalManager.activeSessionId, data: cmd });
        TerminalManager.show();
      }, 500);
    } else {
      TerminalManager.print("Compiler not connected in Browser mode.", "error");
    }
  } else {
    TerminalManager.print(`Cannot run ${active}. Unknown format.`, "error");
  }
});

document.getElementById("close-webview-btn").addEventListener("click", () => webviewModal.classList.add("hidden"));

window.addEventListener("message", (e) => {
  if (e.data && e.data.type === 'console') {
    TerminalManager.print(`[Browser] ${e.data.log}`);
  }
  if (e.data && e.data.type === 'error') {
    TerminalManager.print(`[Browser Error] ${e.data.log}`, "error");
  }
});


// ==========================================
// 5. SETTINGS MANAGER
// ==========================================
const SettingsManager = {
  DEFAULTS: {
    editorFontSize: 14,
    termFontSize: 14,
    theme: 'dark',
    wordWrap: false,
    tabSize: 2,
  },
  load() {
    try {
      const saved = localStorage.getItem('codepocket_settings');
      return saved ? { ...this.DEFAULTS, ...JSON.parse(saved) } : { ...this.DEFAULTS };
    } catch(e) { return { ...this.DEFAULTS }; }
  },
  save(settings) {
    try { localStorage.setItem('codepocket_settings', JSON.stringify(settings)); }
    catch(e) { console.error('Failed to save settings:', e); }
  },
  saveSetting(key, value) {
    const s = this.load(); s[key] = value; this.save(s);
  },
  get(key) { return this.load()[key]; }
};

// ==========================================
// 6. UI MANAGER & KEYBOARD FIXES
// ==========================================
const UIManager = {
  init() {
    const icons = document.querySelectorAll(".activity-icon");
    const panels = document.querySelectorAll(".side-panel");
    
    icons.forEach(icon => {
      icon.addEventListener("click", () => {
        const target = icon.getAttribute("data-panel");
        icons.forEach(i => i.classList.remove("active"));
        icon.classList.add("active");
        
        panels.forEach(p => p.classList.add("hidden"));
        document.getElementById(`panel-${target}`).classList.remove("hidden");
      });
    });

    const toggleDropdown = (btnId, dropId) => {
      const btn = document.getElementById(btnId);
      const drop = document.getElementById(dropId);
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll(".dropdown-menu").forEach(d => {
          if(d !== drop) d.classList.add("hidden");
        });
        drop.classList.toggle("hidden");
      });
    };
    toggleDropdown("pencil-btn", "pencil-dropdown");
    toggleDropdown("dots-btn", "dots-dropdown");
    
    document.addEventListener("click", () => {
      document.querySelectorAll(".dropdown-menu").forEach(d => d.classList.add("hidden"));
    });

    document.getElementById("install-plugin-btn").addEventListener("click", async () => {
      const url = document.getElementById("plugin-url").value;
      if (url) {
        try {
          TerminalManager.print(`Fetching plugin from ${url}...`);
          const res = await fetch(url);
          if(!res.ok) throw new Error(`HTTP Error ${res.status}`);
          const code = await res.text();
          
          const script = document.createElement("script");
          script.textContent = code;
          document.body.appendChild(script);

          const list = document.getElementById("plugin-list");
          const li = document.createElement("li");
          li.textContent = "✅ " + url.split("/").pop();
          list.appendChild(li);
          TerminalManager.print(`Plugin injected successfully!`, "success");
          document.getElementById("plugin-url").value = "";
        } catch(e) {
          TerminalManager.print(`Plugin Error: ${e.message}`, "error");
        }
      }
    });

    const hamburgerBtn = document.getElementById("hamburger-btn");
    const leftSidebar = document.getElementById("left-sidebar");
    if(hamburgerBtn && leftSidebar) {
      hamburgerBtn.addEventListener("click", () => {
        leftSidebar.classList.toggle("hidden-mobile");
      });
    }

    this.setupSettings();
    this.setupSearchPanel();
    this.setupCommandPalette();
    this.setupMobileKeyboardFixes();
  },

  setupCommandPalette() {
    const palette = document.getElementById("command-palette");
    const input = document.getElementById("palette-input");
    const results = document.getElementById("palette-results");
    const closeBtn = document.getElementById("close-palette-btn");

    if (closeBtn) closeBtn.addEventListener("click", () => palette.classList.add("hidden"));
    
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        palette.classList.toggle("hidden");
        if (!palette.classList.contains("hidden")) input.focus();
      }
      if (e.key === "Escape") palette.classList.add("hidden");
    });

    results.addEventListener("click", (e) => {
      if(e.target.tagName === "LI") {
        const cmd = e.target.getAttribute("data-cmd");
        if(cmd === "save") FileManager.save();
        else if(cmd === "format") TerminalManager.print("Code Formatted");
        else if(cmd === "settings") document.querySelector('[data-panel="settings"]').click();
        else if(UIManager.customCommands && UIManager.customCommands[cmd]) {
          UIManager.customCommands[cmd]();
        }
        palette.classList.add("hidden");
      }
    });
  },

  setupSettings() {
    const savedSettings = SettingsManager.load();
    const fontSlider = document.getElementById("setting-font-size");
    const fontVal = document.getElementById("font-size-val");
    if (!fontSlider || !fontVal) return;
    fontSlider.addEventListener("input", (e) => {
      const fs = parseInt(e.target.value);
      fontVal.innerText = fs;
      document.documentElement.style.setProperty("--font-code", fs + "px");
      const editor = document.querySelector(".cm-editor");
      if (editor) editor.style.fontSize = fs + "px";
      SettingsManager.saveSetting('editorFontSize', fs);
    });

    const termSlider = document.getElementById("setting-term-font");
    const termVal = document.getElementById("term-font-val");
    if (termSlider && termVal) {
      termSlider.addEventListener("input", (e) => {
        termVal.innerText = e.target.value;
        const newFontSize = parseInt(e.target.value);
        Object.values(TerminalManager.terminals).forEach(({ term, fitAddon }) => {
          term.options.fontSize = newFontSize;
          if (fitAddon) fitAddon.fit();
        });
        SettingsManager.saveSetting('termFontSize', newFontSize);
      });
    }

    const themeBtn = document.getElementById("setting-theme-btn");
    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        window.CodePocketAPI.UI.setTheme({
          '--bg-base': '#000',
          '--bg-editor': '#000',
          '--bg-panel': '#111',
          '--text-primary': '#fff',
          '--accent': '#ffcc00',
          '--border': '#333'
        });
        SettingsManager.saveSetting('theme', 'high-contrast');
        TerminalManager.print("High Contrast Theme Applied!", "success");
      });
    }

    const editorFontEl = document.getElementById("setting-font-size");
    const termFontEl = document.getElementById("setting-term-font");
    if (editorFontEl) {
      editorFontEl.value = savedSettings.editorFontSize;
      fontVal.innerText = savedSettings.editorFontSize;
      const editorContainer = document.getElementById("editor-container");
      if (editorContainer) editorContainer.style.fontSize = savedSettings.editorFontSize + "px";
    }
    if (termFontEl && termVal) {
      termFontEl.value = savedSettings.termFontSize;
      termVal.innerText = savedSettings.termFontSize;
    }
    if (savedSettings.wordWrap) {
      EditorManager.wordWrapOn = true;
      EditorManager.view.dispatch({
        effects: wrapCompartment.reconfigure(EditorView.lineWrapping)
      });
    }
  },

  setupSearchPanel() {
    const searchInput = document.getElementById("search-query");
    const searchBtn = document.getElementById("search-btn");
    const searchResults = document.getElementById("search-results");
    const replaceInput = document.getElementById("replace-query");
    const replaceAllBtn = document.getElementById("replace-all-btn");
    if (!searchInput || !searchBtn || !searchResults) return;

    searchBtn.addEventListener("click", () => {
      const query = searchInput.value.trim();
      if (!query) {
        searchResults.innerHTML = "<p style='color:var(--text-secondary);padding:8px'>Enter a search term above</p>";
        return;
      }
      const isRegex = document.getElementById("search-regex")?.checked || false;
      const isCaseSensitive = document.getElementById("search-case")?.checked || false;
      let regex;
      try {
        regex = new RegExp(isRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), isCaseSensitive ? "g" : "gi");
      } catch (e) {
        searchResults.innerHTML = `<p style='color:var(--error)'>Invalid regex: ${e.message}</p>`;
        return;
      }

      let totalMatches = 0;
      let html = "";
      for (const [filename, fileContent] of Object.entries(FileManager.files)) {
        const lines = fileContent.split("\n");
        const fileMatches = [];
        lines.forEach((line, lineIdx) => {
          regex.lastIndex = 0;
          if (regex.test(line)) {
            const highlighted = line.replace(regex, m => `<mark style='background:#ff0;color:#000'>${m}</mark>`);
            fileMatches.push({ lineNum: lineIdx + 1, text: highlighted });
            totalMatches++;
          }
        });
        if (fileMatches.length > 0) {
          html += `<div class=\"search-file-group\" style=\"margin-bottom:8px\">`;
          html += `<div style=\"color:var(--accent);font-weight:bold;padding:4px 0;cursor:pointer\" onclick=\"FileManager.openFile('${filename}')\">📄 ${filename} (${fileMatches.length} match${fileMatches.length>1?'es':''})</div>`;
          fileMatches.forEach(m => {
            html += `<div class=\"search-result\" style=\"padding:2px 0 2px 12px;font-size:12px;cursor:pointer;border-left:2px solid var(--border)\" onclick=\"FileManager.openFile('${filename}')\" title=\"Line ${m.lineNum}: click to open\"><span style='color:var(--text-secondary)'>${m.lineNum}:</span> <code>${m.text}</code></div>`;
          });
          html += `</div>`;
        }
      }

      if (totalMatches === 0) {
        searchResults.innerHTML = `<p style='color:var(--text-secondary);padding:8px'>No results for "${query}"</p>`;
      } else {
        searchResults.innerHTML = `<p style='color:var(--text-secondary);padding:4px 0 8px'>${totalMatches} match${totalMatches>1?'es':''} in ${Object.keys(FileManager.files).length} files</p>` + html;
      }
    });

    searchInput.addEventListener("keydown", e => { if (e.key === "Enter") searchBtn.click(); });

    if (replaceAllBtn && replaceInput) {
      replaceAllBtn.addEventListener("click", () => {
        const query = searchInput.value.trim();
        const replacement = replaceInput.value;
        if (!query) return;
        let totalReplaced = 0;
        for (const filename of Object.keys(FileManager.files)) {
          const before = FileManager.files[filename];
          const after = before.split(query).join(replacement);
          if (before !== after) {
            totalReplaced += (before.split(query).length - 1);
            FileManager.files[filename] = after;
            if (FileManager.activeFile === filename) {
              EditorManager.setContent(after, filename);
            }
          }
        }
        localStorage.setItem("codepocket_files", JSON.stringify(FileManager.files));
        TerminalManager.print(`Replaced ${totalReplaced} occurrence${totalReplaced!==1?'s':''} of "${query}" with "${replacement}"`, totalReplaced ? "success" : "error");
      });
    }
  },

  setupMobileKeyboardFixes() {
    const symbolBar = document.getElementById("symbol-bar-container");
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", () => {
        const offset = window.innerHeight - window.visualViewport.height;
        if(offset > 0) symbolBar.style.bottom = offset + "px";
        else symbolBar.style.bottom = "0px";
      });
    }

    const toggleBtn = document.getElementById("symbol-toggle-btn");
    toggleBtn.addEventListener("click", () => {
      symbolBar.classList.toggle("collapsed");
      toggleBtn.textContent = symbolBar.classList.contains("collapsed") ? "⌃" : "⌄";
    });

    let modifiers = { ctrl: false, alt: false, shift: false, esc: false };

    document.querySelectorAll(".symbol-btn").forEach(btn => {
      btn.addEventListener("touchstart", (e) => e.preventDefault(), {passive: false});
      btn.addEventListener("mousedown", (e) => e.preventDefault());

      btn.addEventListener("click", (e) => {
        if (btn.classList.contains("modifier")) {
          const mod = btn.getAttribute("data-mod");
          
          if (mod === "esc") {
             // Immediate Escape key press
             if (!TerminalManager.panel.classList.contains("hidden")) {
               if (Capacitor.isNativePlatform()) PRootPlugin.writeData({ sessionId: TerminalManager.activeSessionId, data: "\x1B" });
             } else {
               EditorManager.view.contentDOM.blur();
             }
             return;
          }

          modifiers[mod] = !modifiers[mod];
          btn.classList.toggle("sticky-active", modifiers[mod]);
          return;
        }
        
        let char = btn.textContent;

        // If Terminal is focused, route the symbol/char to Terminal directly
        if (!TerminalManager.panel.classList.contains("hidden")) {
            let code = char;
            if (modifiers.ctrl && char.toLowerCase() === 'c') code = "\x03";
            if (Capacitor.isNativePlatform()) PRootPlugin.writeData({ sessionId: TerminalManager.activeSessionId, data: code });
        } else {
            EditorManager.insertText(char);
        }
      });
    });

    // Handle physical keyboard or virtual keyboard typing for sticky Ctrl
    document.addEventListener("keydown", (e) => {
      if (modifiers.ctrl) {
        if (e.key.toLowerCase() === 'c') {
          if (!TerminalManager.panel.classList.contains("hidden")) {
            e.preventDefault();
            if (Capacitor.isNativePlatform()) PRootPlugin.writeData({ sessionId: TerminalManager.activeSessionId, data: "\x03" });
            modifiers.ctrl = false;
            document.querySelector('[data-mod="ctrl"]').classList.remove("sticky-active");
          }
        }
      }
    });
  }
};


// ==========================================
// SEARCH-IN-FILES IMPLEMENTATION
// ==========================================
function initSearchPanel() {
  const searchInput = document.getElementById("search-query");
  const searchBtn = document.getElementById("search-btn");
  const searchResults = document.getElementById("search-results");
  const replaceInput = document.getElementById("replace-query");
  const replaceAllBtn = document.getElementById("replace-all-btn");

  if (!searchBtn || !searchInput) return;

  function doSearch() {
    const query = searchInput.value.trim();
    if (!query) {
      searchResults.innerHTML = "<p style='color:var(--text-secondary);padding:8px'>Enter a search term above</p>";
      return;
    }
    const isRegex = document.getElementById("search-regex")?.checked || false;
    const isCaseSensitive = document.getElementById("search-case")?.checked || false;
    let regex;
    try {
      regex = new RegExp(isRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        isCaseSensitive ? "g" : "gi");
    } catch(e) {
      searchResults.innerHTML = `<p style='color:var(--error)'>Invalid regex: ${e.message}</p>`;
      return;
    }

    let totalMatches = 0;
    let html = "";
    for (const [filename, fileContent] of Object.entries(FileManager.files)) {
      const lines = fileContent.split("\n");
      const fileMatches = [];
      lines.forEach((line, lineIdx) => {
        regex.lastIndex = 0;
        if (regex.test(line)) {
          const highlighted = line.replace(regex, m => `<mark style='background:#ff0;color:#000'>${m}</mark>`);
          fileMatches.push({ lineNum: lineIdx + 1, text: highlighted });
          totalMatches++;
        }
      });
      if (fileMatches.length > 0) {
        html += `<div class="search-file-group" style="margin-bottom:8px">`;
        html += `<div style="color:var(--accent);font-weight:bold;padding:4px 0;cursor:pointer" onclick="FileManager.openFile('${filename}')">📄 ${filename} (${fileMatches.length} match${fileMatches.length>1?'es':''})</div>`;
        fileMatches.forEach(m => {
          html += `<div class="search-result" style="padding:2px 0 2px 12px;font-size:12px;cursor:pointer;border-left:2px solid var(--border)"
            onclick="FileManager.openFile('${filename}')"
            title="Line ${m.lineNum}: click to open">
            <span style='color:var(--text-secondary)'>${m.lineNum}:</span> <code>${m.text}</code>
          </div>`;
        });
        html += `</div>`;
      }
    }
    if (totalMatches === 0) {
      searchResults.innerHTML = `<p style='color:var(--text-secondary);padding:8px'>No results for "${query}"</p>`;
    } else {
      searchResults.innerHTML = `<p style='color:var(--text-secondary);padding:4px 0 8px'>${totalMatches} match${totalMatches>1?'es':''} in ${Object.keys(FileManager.files).length} files</p>` + html;
    }
  }

  searchBtn.addEventListener("click", doSearch);
  searchInput.addEventListener("keydown", e => { if (e.key === "Enter") doSearch(); });

  if (replaceAllBtn && replaceInput) {
    replaceAllBtn.addEventListener("click", () => {
      const query = searchInput.value.trim();
      const replacement = replaceInput.value;
      if (!query) return;
      let totalReplaced = 0;
      for (const filename of Object.keys(FileManager.files)) {
        const before = FileManager.files[filename];
        const after = before.split(query).join(replacement);
        if (before !== after) {
          totalReplaced += (before.split(query).length - 1);
          FileManager.files[filename] = after;
          if (FileManager.activeFile === filename) {
            EditorManager.setContent(after, filename);
          }
        }
      }
      localStorage.setItem("codepocket_files", JSON.stringify(FileManager.files));
      TerminalManager.print(`Replaced ${totalReplaced} occurrence${totalReplaced!==1?'s':''} of "${query}" with "${replacement}"`, totalReplaced ? "success" : "error");
      doSearch();
    });
  }
}

// ==========================================
// 6. BOOTSTRAP APP
// ==========================================
FileManager.init();
EditorManager.init();
TerminalManager.init();
UIManager.init();
initSearchPanel();
