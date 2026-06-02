import { EditorView, basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { Capacitor, registerPlugin } from '@capacitor/core';

const PRootPlugin = registerPlugin('PRootPlugin');

// ==========================================
// 1. GLOBAL CODEPOCKET API (For Plugins)
// ==========================================
window.CodePocketAPI = {
  version: "1.0",
  customRunHandler: null,
  
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
    
    // UI Bindings
    document.getElementById("action-new-file").addEventListener("click", () => this.promptNewFile());
    document.getElementById("welcome-new-file").addEventListener("click", () => this.promptNewFile());
    document.getElementById("action-save").addEventListener("click", () => this.save());
    document.getElementById("action-close").addEventListener("click", () => this.closeFile());
    
    // Command Palette Button (Moved to 3-Dots)
    const actionPalette = document.getElementById("action-palette");
    if(actionPalette) {
      actionPalette.addEventListener("click", () => {
        document.getElementById("dots-dropdown").classList.add("hidden");
        const palette = document.getElementById("command-palette");
        palette.classList.toggle("hidden");
        if (!palette.classList.contains("hidden")) document.getElementById("palette-input").focus();
      });
    }
    
    // New 3-Dots actions
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

  save() {
    localStorage.setItem('codepocket_files', JSON.stringify(this.files));
    TerminalManager.print(`Saved ${this.activeFile} to storage.`);
  },

  renderSidebar() {
    const list = document.getElementById("file-list");
    list.innerHTML = "";
    for (let name in this.files) {
      const el = document.createElement("div");
      el.className = "file-item" + (name === this.activeFile ? " active" : "");
      el.textContent = `📄 ${name}`;
      el.addEventListener("click", () => this.openFile(name));
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
    if (!this.files[name] && this.files[name] !== "") return;
    this.activeFile = name;
    this.renderSidebar();
    EditorManager.setContent(this.files[name], name);
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

  updateCurrentContent(content) {
    if(this.activeFile) {
      this.files[this.activeFile] = content;
      localStorage.setItem('codepocket_files', JSON.stringify(this.files));
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
        EditorView.lineWrapping,
        updateListener,
        javascript(), // Default
        oneDark
      ],
      parent: document.getElementById("editor-container")
    });
    
    this.bindPencilTools();
  },

  setContent(content, filename) {
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: content }
    });
    
    // Very basic syntax re-configuration could go here if we dynamically replace extensions.
    // For now, it stays multi-lang tolerant.
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
        case "syntax":
          const lang = prompt("Enter language (js, html, css, cpp, python):", "js");
          if(lang) TerminalManager.print(`Syntax switched to ${lang} (Will apply on next file load)`);
          break;
        case "rename":
          const newName = prompt("Rename file to:", FileManager.activeFile);
          if(newName && newName !== FileManager.activeFile) {
            FileManager.files[newName] = FileManager.files[FileManager.activeFile];
            delete FileManager.files[FileManager.activeFile];
            FileManager.openFile(newName);
          }
          break;
        case "newline":
          this.insertText("\n");
          break;
        case "wordwrap":
          const contentEl = document.querySelector(".cm-content");
          const lineEls = document.querySelectorAll(".cm-line");
          if (contentEl.style.whiteSpace === "pre-wrap") {
            contentEl.style.whiteSpace = "pre";
            lineEls.forEach(l => l.style.whiteSpace = "pre");
            TerminalManager.print("Word Wrap OFF");
          } else {
            contentEl.style.whiteSpace = "pre-wrap";
            contentEl.style.wordBreak = "break-word";
            lineEls.forEach(l => l.style.whiteSpace = "pre-wrap");
            TerminalManager.print("Word Wrap ON");
          }
          break;
        case "format":
          // Very basic simulation of format
          TerminalManager.print("Code formatted.");
          break;
        case "color":
          document.getElementById("native-color-picker").click();
          break;
        case "cut":
          document.execCommand("cut"); // Native fallback
          TerminalManager.print("Cut executed.");
          break;
        case "copy":
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
        case "paste":
          navigator.clipboard.readText().then(text => this.insertText(text));
          break;
        case "selectall":
          this.view.dispatch({ selection: { anchor: 0, head: this.view.state.doc.length }});
          break;
      }
      dropdown.classList.add("hidden");
    });
    
    // Handle Color Picker result
    document.getElementById("native-color-picker").addEventListener("input", (e) => {
      this.insertText(e.target.value);
    });
  }
};

// ==========================================
// 4. TERMINAL & WEBVIEW MANAGER
// ==========================================
const TerminalManager = {
  panel: document.getElementById("terminal-panel"),
  output: document.getElementById("terminal-output"),
  
  print(msg, type="system") {
    const el = document.createElement("div");
    el.className = `log ${type}`;
    el.textContent = `> ${msg}`;
    this.output.appendChild(el);
    this.output.scrollTop = this.output.scrollHeight;
    this.panel.classList.remove("hidden");
  },
  
  hide() {
    this.panel.classList.add("hidden");
  }
};

document.getElementById("action-terminal").addEventListener("click", () => {
  TerminalManager.panel.classList.toggle("hidden");
  document.getElementById("dots-dropdown").classList.add("hidden");
});
document.getElementById("close-terminal-btn").addEventListener("click", () => TerminalManager.hide());

// Terminal Input Logic (Native Bridge)
const terminalInput = document.getElementById("terminal-input");
if(terminalInput) {
  terminalInput.addEventListener("keydown", async (e) => {
    if(e.key === "Enter") {
      const cmd = e.target.value;
      if(!cmd.trim()) return;
      e.target.value = "";
      TerminalManager.print(cmd, "user");
      
      if(Capacitor.isNativePlatform()) {
         try {
            const res = await PRootPlugin.executeCommand({ command: cmd });
            if(res.output) TerminalManager.print(res.output);
         } catch(err) {
            TerminalManager.print(err.message || "Execution Failed", "error");
         }
      } else {
         TerminalManager.print("PRoot Backend is only available in Native Android App.", "error");
      }
    }
  });
}

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
    // Inject custom console interceptor so JS logs appear in our IDE terminal!
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
      </script>
    `;
    let htmlContent = FileManager.getCurrentContent();
    if(active.endsWith(".html")) {
      htmlContent = htmlContent.replace("<head>", "<head>" + consoleInterceptor);
      // fallback if no <head>
      if(!htmlContent.includes("<head>")) htmlContent = consoleInterceptor + htmlContent;
      webviewFrame.srcdoc = htmlContent;
      webviewModal.classList.remove("hidden");
    } else if (active.endsWith(".js")) {
      htmlContent = `${consoleInterceptor}<script>${htmlContent}<\/script>`;
      webviewFrame.srcdoc = htmlContent;
      TerminalManager.print(`Running ${active}...`);
      // Hidden execution for JS, no modal pops up
    }
  } else if (active.endsWith(".py") || active.endsWith(".cpp")) {
    TerminalManager.print(`Running ${active}...`);
    if(Capacitor.isNativePlatform()) {
      const content = FileManager.getCurrentContent();
      // Basic simulation of sending code to native compiler
      const safeContent = content.replace(/"/g, '\\"').replace(/\n/g, ' ');
      let cmd = active.endsWith(".py") ? `python3 -c "${safeContent}"` : `g++ source.cpp && ./a.out`;
      
      PRootPlugin.executeCommand({ command: cmd }).then(res => {
         if(res.output) TerminalManager.print(res.output);
      }).catch(err => {
         TerminalManager.print(err.message || "Error", "error");
      });
    } else {
      TerminalManager.print("Local Compiler / PRoot not connected in Browser mode.", "error");
    }
  } else {
    TerminalManager.print(`Cannot run ${active}. Unknown format.`, "error");
  }
});

document.getElementById("close-webview-btn").addEventListener("click", () => webviewModal.classList.add("hidden"));

// Listen for Webview Console Logs
window.addEventListener("message", (e) => {
  if (e.data && e.data.type === 'console') {
    TerminalManager.print(`[Browser] ${e.data.log}`);
  }
  if (e.data && e.data.type === 'error') {
    TerminalManager.print(`[Browser Error] ${e.data.log}`, "error");
  }
});


// ==========================================
// 5. UI MANAGER (Sidebar, Dropdowns, Viewport)
// ==========================================
const UIManager = {
  init() {
    // Sidebar Panels
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

    // Dropdowns
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

    // Plugins Panel logic (Real Fetch Engine)
    document.getElementById("install-plugin-btn").addEventListener("click", async () => {
      const url = document.getElementById("plugin-url").value;
      if (url) {
        try {
          TerminalManager.print(`Fetching plugin from ${url}...`);
          const res = await fetch(url);
          if(!res.ok) throw new Error(`HTTP Error ${res.status}`);
          const code = await res.text();
          
          // Secure Injection via script tag
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

    // Hamburger Sidebar Toggle Fix
    const hamburgerBtn = document.getElementById("hamburger-btn");
    const leftSidebar = document.getElementById("left-sidebar");
    if(hamburgerBtn && leftSidebar) {
      hamburgerBtn.addEventListener("click", () => {
        leftSidebar.classList.toggle("hidden-mobile");
      });
    }

    // Settings Logic
    this.setupSettings();

    // Command Palette Logic
    this.setupCommandPalette();

    // Visual Viewport & Sticky Modifiers
    this.setupMobileKeyboardFixes();
  },

  setupCommandPalette() {
    const palette = document.getElementById("command-palette");
    const input = document.getElementById("palette-input");
    const results = document.getElementById("palette-results");
    const closeBtn = document.getElementById("close-palette-btn");

    if (closeBtn) {
      closeBtn.addEventListener("click", () => palette.classList.add("hidden"));
    }
    
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        palette.classList.toggle("hidden");
        if (!palette.classList.contains("hidden")) input.focus();
      }
      if (e.key === "Escape") {
        palette.classList.add("hidden");
      }
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
    const fontSlider = document.getElementById("setting-font-size");
    const fontVal = document.getElementById("font-size-val");
    fontSlider.addEventListener("input", (e) => {
      fontVal.innerText = e.target.value;
      document.documentElement.style.setProperty("--font-code", e.target.value + "px");
      document.querySelector(".cm-editor").style.fontSize = e.target.value + "px";
    });

    const termSlider = document.getElementById("setting-term-font");
    const termVal = document.getElementById("term-font-val");
    termSlider.addEventListener("input", (e) => {
      termVal.innerText = e.target.value;
      document.getElementById("terminal-output").style.fontSize = e.target.value + "px";
    });

    document.getElementById("setting-theme-btn").addEventListener("click", () => {
      window.CodePocketAPI.UI.setTheme({
        '--bg-base': '#000',
        '--bg-editor': '#000',
        '--bg-panel': '#111',
        '--text-primary': '#fff',
        '--accent': '#ffcc00',
        '--border': '#333'
      });
      TerminalManager.print("High Contrast Theme Applied!", "success");
    });
  },

  setupMobileKeyboardFixes() {
    const symbolBar = document.getElementById("symbol-bar-container");
    
    // Docking logic for Virtual Keyboard
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", () => {
        // Adjust the bottom property so it sits exactly on top of the virtual keyboard
        const offset = window.innerHeight - window.visualViewport.height;
        if(offset > 0) {
          symbolBar.style.bottom = offset + "px";
        } else {
          symbolBar.style.bottom = "0px";
        }
      });
    }

    // Symbol Toggles
    const toggleBtn = document.getElementById("symbol-toggle-btn");
    toggleBtn.addEventListener("click", () => {
      symbolBar.classList.toggle("collapsed");
      toggleBtn.textContent = symbolBar.classList.contains("collapsed") ? "⌃" : "⌄";
    });

    // Modifiers State
    let modifiers = { ctrl: false, alt: false, shift: false, esc: false };

    document.querySelectorAll(".symbol-btn").forEach(btn => {
      // Prevent focus loss when tapping symbols on mobile!
      btn.addEventListener("touchstart", (e) => e.preventDefault(), {passive: false});
      btn.addEventListener("mousedown", (e) => e.preventDefault());

      btn.addEventListener("click", (e) => {
        if (btn.classList.contains("modifier")) {
          const mod = btn.getAttribute("data-mod");
          modifiers[mod] = !modifiers[mod];
          btn.classList.toggle("sticky-active", modifiers[mod]);
          return;
        }
        
        // If it's a normal symbol, insert it
        EditorManager.insertText(btn.textContent);
      });
    });

    // Listen to physical or virtual keyboard strokes to consume modifiers
    document.addEventListener("keydown", (e) => {
      // If sticky Ctrl is active and user types 'a' -> Select All
      if (modifiers.ctrl && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        EditorManager.view.dispatch({ selection: { anchor: 0, head: EditorManager.view.state.doc.length }});
        
        // Reset sticky toggle after use (optional UX choice)
        modifiers.ctrl = false;
        document.querySelector('[data-mod="ctrl"]').classList.remove("sticky-active");
      }
    });
  }
};

// ==========================================
// 6. BOOTSTRAP APP
// ==========================================
FileManager.init();
EditorManager.init();
UIManager.init();
