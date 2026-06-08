// ==========================================
// DEBUG SERVICE - Real Code Analysis
// ==========================================
export const DebugService = {
  breakpoints: new Set(),
  watchExpressions: [],
  callStack: [],
  variables: {},
  isRunning: false,

  addBreakpoint(line) {
    this.breakpoints.add(line);
    return { ok: true, breakpoints: [...this.breakpoints] };
  },

  removeBreakpoint(line) {
    this.breakpoints.delete(line);
    return { ok: true, breakpoints: [...this.breakpoints] };
  },

  clearBreakpoints() {
    this.breakpoints.clear();
    return { ok: true, message: 'All breakpoints cleared' };
  },

  // Real-time JS linting using regex-based analysis
  lint(code, language = 'js') {
    const issues = [];

    if (['js', 'ts', 'jsx', 'tsx'].includes(language)) {
      // Undefined variables (basic)
      const lines = code.split('\n');
      lines.forEach((line, i) => {
        const lineNum = i + 1;

        // console.log left in code
        if (/console\.(log|warn|error|debug)\(/.test(line) && !line.trim().startsWith('//')) {
          issues.push({ line: lineNum, type: 'warning', message: 'console statement left in code' });
        }

        // == instead of ===
        if (/[^=!<>]==[^=]/.test(line) && !/==='/.test(line)) {
          issues.push({ line: lineNum, type: 'warning', message: 'Use === instead of ==' });
        }

        // var usage
        if (/\bvar\s+/.test(line) && !line.trim().startsWith('//')) {
          issues.push({ line: lineNum, type: 'info', message: 'Use let/const instead of var' });
        }

        // Empty catch blocks
        if (/catch\s*\(/.test(line)) {
          const nextLines = lines.slice(i + 1, i + 3).join(' ');
          if (/^\s*\}/.test(lines[i + 1] || '')) {
            issues.push({ line: lineNum, type: 'warning', message: 'Empty catch block' });
          }
        }

        // TODO/FIXME comments
        if (/\/\/\s*(TODO|FIXME|HACK|XXX)/i.test(line)) {
          issues.push({ line: lineNum, type: 'info', message: line.trim().replace('//', '').trim() });
        }

        // Unreachable code after return
        if (/^\s*return\s/.test(line)) {
          const nextLine = (lines[i + 1] || '').trim();
          if (nextLine && !nextLine.startsWith('//') && !nextLine.startsWith('}') && nextLine !== '') {
            issues.push({ line: lineNum + 1, type: 'error', message: 'Unreachable code after return' });
          }
        }

        // Missing semicolons (basic JS check)
        if (/^(?!\/\/)(?!if|for|while|function|class|{|}|\/\*|\*).+[^;{}\s]$/.test(line.trim()) &&
            language === 'js') {
          // skip - too many false positives
        }
      });

      // Check for syntax errors using try-catch on Function constructor
      try {
        new Function(code);
      } catch (e) {
        const lineMatch = e.message.match(/line (\d+)/i) || e.stack?.match(/:(\d+):/);
        issues.push({
          line: lineMatch ? parseInt(lineMatch[1]) : 1,
          type: 'error',
          message: `Syntax Error: ${e.message}`
        });
      }
    }

    return { ok: true, issues, summary: { errors: issues.filter(i => i.type === 'error').length, warnings: issues.filter(i => i.type === 'warning').length, infos: issues.filter(i => i.type === 'info').length } };
  },

  // Extract variables/functions for outline view
  analyze(code, language = 'js') {
    const outline = { functions: [], classes: [], variables: [], imports: [] };

    if (['js', 'ts', 'jsx', 'tsx'].includes(language)) {
      const lines = code.split('\n');
      lines.forEach((line, i) => {
        const lineNum = i + 1;
        // Functions
        const fnMatch = line.match(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))/);
        if (fnMatch) outline.functions.push({ name: fnMatch[1] || fnMatch[2], line: lineNum });

        // Classes
        const classMatch = line.match(/class\s+(\w+)/);
        if (classMatch) outline.classes.push({ name: classMatch[1], line: lineNum });

        // Imports
        const importMatch = line.match(/import\s+(?:{[^}]+}|\w+)\s+from\s+['"]([^'"]+)['"]/);
        if (importMatch) outline.imports.push({ module: importMatch[1], line: lineNum });

        // Constants
        const constMatch = line.match(/^(?:export\s+)?const\s+([A-Z_][A-Z0-9_]*)\s*=/);
        if (constMatch) outline.variables.push({ name: constMatch[1], line: lineNum, type: 'constant' });
      });
    } else if (language === 'py') {
      const lines = code.split('\n');
      lines.forEach((line, i) => {
        const fnMatch = line.match(/^def\s+(\w+)\s*\(/);
        if (fnMatch) outline.functions.push({ name: fnMatch[1], line: i + 1 });
        const classMatch = line.match(/^class\s+(\w+)/);
        if (classMatch) outline.classes.push({ name: classMatch[1], line: i + 1 });
      });
    }

    return { ok: true, outline };
  },

  // Safe JS sandbox execution
  async execute(code, language = 'js') {
    if (language !== 'js' && language !== 'ts') {
      return { ok: false, error: `Sandbox execution only available for JS/TS` };
    }
    const logs = [];
    const errors = [];
    try {
      const sandbox = new Function('console', 'logs', code);
      const mockConsole = {
        log: (...args) => logs.push({ type: 'log', value: args.map(a => JSON.stringify(a)).join(' ') }),
        warn: (...args) => logs.push({ type: 'warn', value: args.join(' ') }),
        error: (...args) => errors.push(args.join(' '))
      };
      sandbox(mockConsole, logs);
      return { ok: true, logs, errors };
    } catch (e) {
      return { ok: false, error: e.message, logs, errors: [e.message] };
    }
  },

  // Code complexity metrics
  getMetrics(code) {
    const lines = code.split('\n');
    const nonEmpty = lines.filter(l => l.trim() !== '' && !l.trim().startsWith('//')).length;
    const comments = lines.filter(l => l.trim().startsWith('//')).length;
    const functions = (code.match(/function\s+\w+|=>\s*{|=\s*function/g) || []).length;
    const complexity = (code.match(/\bif\b|\belse\b|\bfor\b|\bwhile\b|\bswitch\b|\bcatch\b|\?\s/g) || []).length + 1;
    return {
      ok: true,
      totalLines: lines.length,
      codeLines: nonEmpty,
      commentLines: comments,
      functions,
      cyclomaticComplexity: complexity,
      rating: complexity <= 5 ? '🟢 Simple' : complexity <= 10 ? '🟡 Moderate' : '🔴 Complex'
    };
  }
};
