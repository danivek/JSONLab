/**
 * App - Main application controller
 */

const App = {
  editors: [],
  activeEditor: null,

  /**
   * Initialize the application
   */
  async init() {
    // Initialize theme first
    Theme.init();

    // Load Monaco Library (without creating instance)
    await TextEditor.load();

    // Prepare container
    const container = document.getElementById('editors-container');
    container.innerHTML = '';

    // Create Editors (Default)
    this.createEditors(container);

    // Initialize other components (Global listeners if any)

    console.log('JSON Editor initialized');
  },

  /**
   * Create Editors (Init logic)
   */
  createEditors(container) {
    // Left Editor
    const leftContainer = document.createElement('div');
    leftContainer.className = 'editor-wrapper';
    leftContainer.id = 'editor-wrapper-left';
    leftContainer.style.flex = '1';
    leftContainer.style.display = 'flex';
    leftContainer.style.flexDirection = 'column';
    leftContainer.style.borderRight = '1px solid var(--color-border)';
    leftContainer.style.minWidth = '0';
    container.appendChild(leftContainer);

    const leftEditor = new JsonEditor(leftContainer, 'left', 'text');
    this.editors.push(leftEditor);

    // Right Editor
    const rightContainer = document.createElement('div');
    rightContainer.className = 'editor-wrapper';
    rightContainer.id = 'editor-wrapper-right';
    rightContainer.style.flex = '1';
    rightContainer.style.display = 'flex';
    rightContainer.style.flexDirection = 'column';
    rightContainer.style.minWidth = '0';
    container.appendChild(rightContainer);

    const rightEditor = new JsonEditor(rightContainer, 'right', 'text');
    this.editors.push(rightEditor);

    // Add Splitter between them (hidden by default)
    const splitter = document.createElement('div');
    splitter.className = 'editor-splitter';
    splitter.id = 'editors-splitter';
    container.insertBefore(splitter, rightContainer);

    // Set active editor to left by default
    this.setActiveEditor(leftEditor);

    // Setup default content (optional)
    leftEditor.setValue(TextEditor.getDefaultJson());
    // Sync to right
    rightEditor.setValue(leftEditor.getValue());

    // --- Custom Features --- //

    // Add "Copy to Right" arrow to Left Editor Primary Toolbar
    // Position: Right (Extreme Right)
    this.copyToRightBtn = leftEditor.addPrimaryButton({
      icon: 'arrow-right',
      title: 'Copy content to Right Editor',
      // label: 'To Right', // Removed label per "keep arrow icons" request
      className: 'btn-copy-right',
      position: 'right', // Goes to right group
      onClick: () => {
        const content = leftEditor.getValue();
        rightEditor.setValue(content);
        this.showToast('Copied to Right Editor', 'success');
      },
    });

    // Add "Copy to Left" arrow to Right Editor Primary Toolbar
    // Position: Left (Extreme Left)
    rightEditor.addPrimaryButton({
      icon: 'arrow-left',
      title: 'Copy content to Left Editor',
      // label: 'To Left',
      position: 'left', // Goes to left group (prepended)
      onClick: () => {
        const content = rightEditor.getValue();
        leftEditor.setValue(content);
        this.showToast('Copied to Left Editor', 'success');
      },
    });

    // Default View: Normal
    this.switchGlobalMode('normal');

    // Initialize Split Resizer
    this.initSplitResizer();
  },

  /**
   * Set active editor
   */
  setActiveEditor(editor) {
    this.activeEditor = editor;
    // Visual feedback? maybe border highlight?
    document
      .querySelectorAll('.editor-wrapper')
      .forEach((el) => el.classList.remove('active-wrapper'));
    editor.wrapper.parentNode.classList.add('active-wrapper');
  },

  // --- Global Action Proxies --- //

  format() {
    this.activeEditor?.format();
  },
  compact() {
    this.activeEditor?.compact();
  },
  validate() {
    this.activeEditor?.validate();
  },
  repair() {
    this.activeEditor?.repair();
  },
  undo() {
    this.activeEditor?.undo();
  },
  redo() {
    this.activeEditor?.redo();
  },
  copyToClipboard() {
    this.activeEditor?.copyToClipboard();
  },
  clear() {
    this.activeEditor?.clear();
  },

  switchMode(mode) {
    this.activeEditor?.switchMode(mode);
  },

  bindHeaderEvents() {
    // Import/Export buttons removed from Header (now in Primary Toolbar)
    // Only Global URL Modal handling needs connection

    // Using a pending target for URL load
    this.pendingImportTarget = null;

    document.getElementById('btn-url-cancel')?.addEventListener('click', () => {
      Modal.hide('url-modal');
      this.pendingImportTarget = null;
    });

    document.getElementById('btn-url-load')?.addEventListener('click', () => {
      const url = document.getElementById('url-input').value;
      if (url) {
        // If we have a pending target (triggered from specific editor), use it
        // If not, use active editor or default
        this.importFromUrl(url, this.pendingImportTarget);
        Modal.hide('url-modal');
        this.pendingImportTarget = null;
      }
    });

    document.getElementById('btn-theme')?.addEventListener('click', () => {
      Theme.toggle();
    });

    // Global Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Shift + F = Format
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        this.format();
      }
      // Ctrl/Cmd + D = Toggle dark mode
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        Theme.toggle();
      }

      // Ctrl/Cmd + Z = Undo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        this.undo();
      }

      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y = Redo
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') ||
        ((e.ctrlKey || e.metaKey) && e.key === 'y')
      ) {
        e.preventDefault();
        this.redo();
      }
    });

    // --- Mode Switching Events --- //
    document
      .getElementById('btn-mode-normal')
      ?.addEventListener('click', () => this.switchGlobalMode('normal'));
    document
      .getElementById('btn-mode-split')
      ?.addEventListener('click', () => this.switchGlobalMode('split'));
    document
      .getElementById('btn-mode-compare')
      ?.addEventListener('click', () => this.switchGlobalMode('compare'));
    document
      .getElementById('btn-mode-query')
      ?.addEventListener('click', () => this.switchGlobalMode('query'));

    // Query Run
    // Auto-run on input with debounce
    const queryInput = document.getElementById('query-input');
    if (queryInput) {
      let debounceTimer;
      queryInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => this.runQuery(), 300);
      });
    }

    document
      .getElementById('btn-query-apply')
      ?.addEventListener('click', () => this.applyQueryResult());
  },

  /**
   * Switch Global App Mode (Normal, Split, Compare, Query)
   */
  switchGlobalMode(mode) {
    // Update UI
    document
      .querySelectorAll('.header-actions .btn')
      .forEach((btn) => btn.classList.remove('active'));
    document.getElementById(`btn-mode-${mode}`)?.classList.add('active');

    // Reset display
    const editorsContainer = document.getElementById('editors-container');
    editorsContainer.style.display = 'none';
    document.getElementById('compare-panel').style.display = 'none';
    document.getElementById('query-panel').style.display = 'none';

    const splitter = document.getElementById('editors-splitter');
    if (splitter) splitter.style.display = 'none';

    const leftWrapper = document.getElementById('editor-wrapper-left');
    const rightWrapper = document.getElementById('editor-wrapper-right');

    if (leftWrapper) leftWrapper.style.display = 'flex'; // Default reset
    if (rightWrapper) rightWrapper.style.display = 'flex'; // Default reset

    if (mode === 'normal') {
      editorsContainer.style.display = 'flex';
      if (rightWrapper) rightWrapper.style.display = 'none'; // Hide right
      if (leftWrapper) leftWrapper.style.borderRight = 'none';
      // Hide Copy to Right button in Normal mode
      if (this.copyToRightBtn) this.copyToRightBtn.style.display = 'none';
    } else if (mode === 'split') {
      editorsContainer.style.display = 'flex';
      if (rightWrapper) rightWrapper.style.display = 'flex'; // Show right
      if (leftWrapper) leftWrapper.style.borderRight = '1px solid var(--color-border)';
      if (splitter) splitter.style.display = 'flex';
      // Show Copy to Right button in Split mode
      if (this.copyToRightBtn) this.copyToRightBtn.style.display = 'inline-flex';
    } else if (mode === 'compare') {
      document.getElementById('compare-panel').style.display = 'flex';
      this.initCompare();
    } else if (mode === 'query') {
      document.getElementById('query-panel').style.display = 'flex';
      this.initQuery();
    }
  },

  /**
   * Initialize Compare Mode
   */
  initCompare() {
    const leftContent = this.editors[0].getValue();
    const rightContent = this.editors[1].getValue();

    if (!this.diffEditor) {
      const container = document.getElementById('monaco-diff-container');
      if (container) {
        this.diffEditor = monaco.editor.createDiffEditor(container, {
          // You can pass options here, e.g. theme
          theme:
            document.documentElement.getAttribute('data-theme') === 'dark'
              ? 'json-dark'
              : 'json-light',
          automaticLayout: true,
          originalEditable: true,
          readOnly: false,
        });

        // Add listener to update summary on change
        this.diffEditor.onDidUpdateDiff(() => {
          this.updateDiffSummary();
        });
      }
    }

    if (this.diffEditor) {
      const originalModel = monaco.editor.createModel(leftContent, 'json');
      const modifiedModel = monaco.editor.createModel(rightContent, 'json');
      this.diffEditor.setModel({
        original: originalModel,
        modified: modifiedModel,
      });
      // Update theme just in case
      const theme =
        document.documentElement.getAttribute('data-theme') === 'dark' ? 'json-dark' : 'json-light';
      monaco.editor.setTheme(theme);

      this.updateDiffSummary();
    }

    // Wire up resize handle (only once)
    const handle = document.getElementById('diff-resize-handle');
    const summary = document.getElementById('diff-summary');
    const comparePanel = document.getElementById('compare-panel');
    if (handle && summary && !handle._resizeWired) {
      handle._resizeWired = true;
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const startY = e.clientY;
        const startHeight = summary.offsetHeight;
        handle.classList.add('dragging');

        const onMouseMove = (e) => {
          // Dragging up = negative delta = increase height
          const delta = startY - e.clientY;
          const panelHeight = comparePanel.offsetHeight;
          const newHeight = Math.min(
            Math.max(40, startHeight + delta),
            Math.floor(panelHeight * 0.8)
          );
          comparePanel.style.setProperty('--diff-summary-height', `${newHeight}px`);
        };

        const onMouseUp = () => {
          handle.classList.remove('dragging');
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    }
  },

  updateDiffSummary() {
    const original = this.diffEditor.getModel().original.getValue();
    const modified = this.diffEditor.getModel().modified.getValue();

    let diffHtml = '<p>No changes detected.</p>';
    try {
      const obj1 = JSON.parse(original);
      const obj2 = JSON.parse(modified);

      if (window.DiffUtils) {
        const diffs = DiffUtils.compare(obj1, obj2);
        diffHtml = DiffUtils.formatDiffsHtml(diffs);
      }
    } catch {
      diffHtml = '<p class="error">Invalid JSON for diff summary.</p>';
    }

    const summaryContainer = document.getElementById('diff-summary');
    if (summaryContainer) {
      summaryContainer.innerHTML = diffHtml;
    }
  },

  /**
   * Initialize Query Mode
   */
  initQuery() {
    document.getElementById('query-input').focus();

    // Initialize Query Editors if not exists
    if (!this.queryInputEditor) {
      const inputContainer = document.getElementById('query-editor-input');
      const outputContainer = document.getElementById('query-editor-output');

      if (inputContainer && outputContainer) {
        const commonOptions = {
          theme:
            document.documentElement.getAttribute('data-theme') === 'dark'
              ? 'json-dark'
              : 'json-light',
          automaticLayout: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          readOnly: true, // Input is read-only reference
          lineNumbers: 'on',
          folding: true,
        };

        this.queryInputEditor = monaco.editor.create(inputContainer, {
          ...commonOptions,
          value: '{}',
          language: 'json',
        });

        this.queryOutputEditor = monaco.editor.create(outputContainer, {
          ...commonOptions,
          value: '',
          language: 'json',
          readOnly: true, // Output starts read-only
        });
      }
    }

    // Populate Input Editor with current active content
    if (this.queryInputEditor) {
      const currentContent = this.activeEditor
        ? this.activeEditor.getValue()
        : this.editors[0].getValue();
      this.queryInputEditor.setValue(currentContent);
      // Also run query if input has value?
      // this.runQuery();
    }
  },

  /**
   * Run Query
   */
  runQuery() {
    const query = document.getElementById('query-input').value;
    const dataStr = this.queryInputEditor ? this.queryInputEditor.getValue() : '{}';

    try {
      const data = JSON.parse(dataStr);
      console.log('Query:', query);

      // Use global QueryUtils
      if (window.QueryUtils) {
        const result = QueryUtils.query(data, query);
        const resultStr = JSON.stringify(result, null, 2);

        if (this.queryOutputEditor) {
          this.queryOutputEditor.setValue(resultStr);
        }
      } else {
        if (this.queryOutputEditor) this.queryOutputEditor.setValue('// QueryUtils not loaded');
      }
    } catch (e) {
      if (this.queryOutputEditor) {
        this.queryOutputEditor.setValue(`// Error: ${e.message}`);
      }
    }
  },

  applyQueryResult() {
    if (!this.queryOutputEditor) return;
    const result = this.queryOutputEditor.getValue();

    // Basic check if it looks like error
    if (result.startsWith('// Error')) {
      this.showToast('Cannot apply error result', 'error');
      return;
    }

    // Apply to main editor
    const target = this.activeEditor || this.editors[0];
    target.setValue(result);

    // Sync if needed (handled by editor logic usually, but let's be safe)
    if (target.id === 'left') {
      const right = this.editors.find((e) => e.id === 'right');
      if (right) right.setValue(result);
    }

    this.showToast('Query result applied', 'success');

    // Switch back to normal or split? User might want to stay.
    // Let's stay in Query mode so they can refine if needed.
  },

  /**
   * Update theme for all editors
   */
  updateTheme() {
    this.editors.forEach((editor) => {
      if (typeof editor.updateTheme === 'function') {
        editor.updateTheme();
      }
    });
  },

  // --- Import / Export Logic with Sync --- //

  importFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      this.handleImportContent(content, file.name.endsWith('.csv'));
    };
    reader.onerror = () => this.showToast('Failed to read file', 'error');
    reader.readAsText(file);
  },

  async importFromUrl(url) {
    try {
      this.showToast('Loading...', 'info');
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const content = await response.text();
      this.handleImportContent(content, false); // Assume JSON for URL for now or check header
    } catch (e) {
      this.showToast(`Failed to load: ${e.message}`, 'error');
    }
  },

  handleImportContent(content, isCsv) {
    let valueToSet = content;

    if (isCsv) {
      try {
        // Assuming CsvUtils is global
        const delimiter = CsvUtils.detectDelimiter(content);
        const jsonData = CsvUtils.csvToJson(content, delimiter);
        valueToSet = JSON.stringify(jsonData, null, 2);
      } catch (err) {
        this.showToast(`CSV import error: ${err.message}`, 'error');
        return;
      }
    } else {
      // Try to format
      try {
        valueToSet = JsonUtils.format(content);
      } catch {
        // ignore, keep original
      }
    }

    // 1. Set to Active Editor
    // If no active editor, default to first (Left)
    const target = this.activeEditor || this.editors[0];
    target.setValue(valueToSet);

    // 2. Sync Logic: If target is Left (Text) and there is a Right (Tree), update Right.
    if (target.id === 'left') {
      const rightEditor = this.editors.find((e) => e.id === 'right');
      if (rightEditor) {
        rightEditor.setValue(valueToSet);
        // Ensure it is in Tree mode? It should be by default config.
        // rightEditor.switchMode('tree');
      }
    }

    this.showToast('Content loaded', 'success');
  },

  export() {
    const content = this.activeEditor ? this.activeEditor.getValue() : '';
    if (!content) return;

    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.json';
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('File downloaded', 'success');
  },

  // --- Utils --- //

  /**
   * Initialize Split View Resizer
   */
  initSplitResizer() {
    const splitter = document.getElementById('editors-splitter');
    const leftWrapper = document.getElementById('editor-wrapper-left');
    const rightWrapper = document.getElementById('editor-wrapper-right');
    const container = document.getElementById('editors-container');

    if (!splitter || !leftWrapper || !rightWrapper || !container) return;

    splitter.addEventListener('mousedown', (e) => {
      e.preventDefault();
      splitter.classList.add('dragging');

      const onMouseMove = (e) => {
        const containerRect = container.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const offset = e.clientX - containerRect.left;

        // Clamp between 10% and 90%
        const percentage = Math.min(Math.max(10, (offset / containerWidth) * 100), 90);

        leftWrapper.style.flex = `0 0 ${percentage}%`;
        rightWrapper.style.flex = `1 1 0`;
      };

      const onMouseUp = () => {
        splitter.classList.remove('dragging');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  },

  updatePathDisplay(jsPath, JSONPointer) {
    // Find existing global or delegate.
    // We removed global status bar from index.html (implied by "independent status bars").
    // But App.js had `updatePathDisplay` targeting `#status-path`.
    // Now each editor has its own status bar.
    // The `JsonEditor.updateStatusBar` handles parsing info.
    // But `TextEditor` and `TreeView` call `App.updatePathDisplay` for the path (cursor/click).
    // Pass this back to the active editor's status bar.

    if (this.activeEditor && this.activeEditor.statusBar) {
      const pathEl = this.activeEditor.statusBar.querySelector('.status-path');
      if (pathEl) {
        if (!jsPath && !JSONPointer) {
          pathEl.innerHTML = '';
          return;
        }
        pathEl.innerHTML = `
                    <span class="path-separator"> | </span>
                    <span class="path-display" title="Click to copy JS Path">JS: <code>${jsPath}</code></span>
                    <span class="path-separator"> | </span>
                    <span class="path-display" title="Click to copy JSONPointer">JSONPointer: <code>${JSONPointer}</code></span>
                `;
        // Add copy listeners... (simplified for brevity, can reuse logic)
        pathEl.querySelectorAll('.path-display').forEach((el) => {
          el.onclick = () => {
            const code = el.querySelector('code').textContent;
            navigator.clipboard.writeText(code);
            this.showToast('Path copied', 'success');
          };
        });
      }
    }
  },

  // We need to implement onContentChange if TextEditor calls it?
  // JsonEditor handles it internally now.
  onContentChange() {
    // No-op or global sync logic if needed
  },

  showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  },
};

document.addEventListener('DOMContentLoaded', () => {
  App.bindHeaderEvents();
  App.init();
});

window.App = App;
