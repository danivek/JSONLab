/**
 * JsonEditor - Encapsulates a single editor instance (Toolbar + Editor + StatusBar)
 */
class JsonEditor {
  constructor(container, id, initialMode = 'text') {
    this.container = container;
    this.id = id;

    // Load saved mode or use initial
    const savedMode = window.StorageUtils ? StorageUtils.load(StorageUtils.KEYS.WORKSPACE_MODE + this.id, initialMode) : initialMode;
    this.mode = savedMode; // 'text', 'tree', 'table'
    this.editor = null; // Monaco editor instance
    this.history = [];
    this.historyIndex = -1;
    this.maxHistory = 50;

    this.wrapper = document.createElement('div');
    this.wrapper.className = 'editor-instance';
    this.container.appendChild(this.wrapper);

    this.init();
  }

  async init() {
    // 1. Primary Toolbar (Import/Export) - Above Editor Toolbar
    this.createPrimaryToolbar();

    // 2. Editor Toolbar (Format/etc)
    this.toolbarContainer = document.createElement('div');
    this.wrapper.appendChild(this.toolbarContainer);
    this.toolbar = new EditorToolbar(this.toolbarContainer, this);

    // 3. Main Content Area (Stack of panels)
    this.mainContent = document.createElement('div');
    this.mainContent.className = 'editor-main-content';
    this.mainContent.style.flex = '1';
    this.mainContent.style.position = 'relative';
    this.mainContent.style.overflow = 'hidden';
    this.wrapper.appendChild(this.mainContent);

    // Panels
    this.createPanels();

    // 4. Status Bar
    this.createStatusBar();

    // 5. Initialize Monaco (Text Editor) logic
    await this.initMonaco();

    // 6. Set initial mode
    this.switchMode(this.mode);

    // 7. Save initial state
    this.saveToHistory();
  }

  createPrimaryToolbar() {
    this.primaryToolbar = document.createElement('div');
    this.primaryToolbar.className = 'toolbar primary-toolbar';
    this.primaryToolbar.innerHTML = `
            <div class="toolbar-group toolbar-group-left">
                <button class="btn btn-secondary btn-sm btn-new" title="New / Clear Editor">
                    <i data-lucide="file-plus" class="icon"></i> New
                </button>
                <button class="btn btn-secondary btn-sm btn-import-file" title="Import File">
                    <i data-lucide="folder-open" class="icon"></i> Import
                </button>
                <button class="btn btn-secondary btn-sm btn-import-url" title="Import from URL">
                    <i data-lucide="link" class="icon"></i> URL
                </button>
                <button class="btn btn-secondary btn-sm btn-export" title="Export File">
                    <i data-lucide="save" class="icon"></i> Export
                </button>
            </div>
            <div class="toolbar-group toolbar-group-right"></div>
             <input type="file" class="hidden-file-input" accept=".json,.csv,.txt" hidden>
        `;
    this.wrapper.appendChild(this.primaryToolbar);

    // Bind Events
    const fileInput = this.primaryToolbar.querySelector('.hidden-file-input');

    this.primaryToolbar.querySelector('.btn-new').addEventListener('click', () => {
      this.clear();
    });

    this.primaryToolbar.querySelector('.btn-import-file').addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) this.importFile(e.target.files[0]);
      e.target.value = '';
    });

    this.primaryToolbar.querySelector('.btn-import-url').addEventListener('click', () => {
      if (window.Modal) {
        if (window.App) {
          window.App.pendingImportTarget = this;
          Modal.show('url-modal');
        }
      }
    });

    this.primaryToolbar.querySelector('.btn-export').addEventListener('click', () => {
      this.exportFile();
    });

    if (window.lucide) {
      lucide.createIcons({ root: this.primaryToolbar });
    }
  }

  importFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      this.handleImportContent(content, file.name.endsWith('.csv'));
    };
    reader.readAsText(file);
  }

  handleImportContent(content, isCsv) {
    let valueToSet = content;
    if (isCsv && window.CsvUtils) {
      try {
        const delimiter = CsvUtils.detectDelimiter(content);
        const jsonData = CsvUtils.csvToJson(content, delimiter);
        valueToSet = JSON.stringify(jsonData, null, 2);
      } catch (e) {
        console.error('CSV Import Error', e);
        if (window.App) App.showToast('CSV Error: ' + e.message, 'error');
        return;
      }
    } else {
      if (window.JsonUtils) {
        try {
          valueToSet = JsonUtils.format(content);
        } catch {
          // Ignore formatting error on import
        }
      }
    }

    this.setValue(valueToSet);
    if (window.App) App.showToast('File loaded', 'success');

    if (this.id === 'left' && window.App) {
      // Find right editor
      const right = App.editors.find((e) => e.id === 'right');
      if (right) right.setValue(valueToSet);
    }
  }

  exportFile() {
    const content = this.getValue();
    if (!content) return;

    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data-${this.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Add a custom button to the Primary Toolbar
   * config: { icon, title, label, onClick, position? }
   */
  addPrimaryButton(config) {
    if (!this.primaryToolbar) return;

    const position = config.position || 'right';

    let group;
    if (position === 'left') {
      group = this.primaryToolbar.querySelector('.toolbar-group-left');
    } else {
      group = this.primaryToolbar.querySelector('.toolbar-group-right');
    }

    if (!group) return;

    const btn = document.createElement('button');
    btn.className = `btn btn-secondary btn-sm ${config.className || ''}`;
    btn.title = config.title;
    btn.innerHTML = `<i data-lucide="${config.icon}" class="icon"></i> ${config.label || ''}`;

    btn.addEventListener('click', () => {
      if (config.onClick) config.onClick();
    });

    // Positioning logic
    if (position === 'left') {
      // Extreme left -> Prepend
      group.insertBefore(btn, group.firstChild);
    } else {
      // Extreme right -> Append (default for right group)
      group.appendChild(btn);
    }

    // Refresh icons
    if (window.lucide) {
      lucide.createIcons({ root: btn });
    }

    return btn;
  }

  createPanels() {
    // Text Panel
    this.textPanel = document.createElement('div');
    this.textPanel.className = 'editor-panel';
    this.textPanel.id = `text-panel-${this.id}`;
    this.textPanel.innerHTML = `<div class="monaco-container" id="monaco-${this.id}"></div>`;
    this.mainContent.appendChild(this.textPanel);

    // Tree Panel
    this.treePanel = document.createElement('div');
    this.treePanel.className = 'editor-panel';
    this.treePanel.id = `tree-panel-${this.id}`;
    this.treePanel.innerHTML = `<div class="tree-container" id="tree-view-${this.id}"></div>`;
    this.mainContent.appendChild(this.treePanel);

    // Table Panel
    this.tablePanel = document.createElement('div');
    this.tablePanel.className = 'editor-panel';
    this.tablePanel.id = `table-panel-${this.id}`;
    this.tablePanel.innerHTML = `
            <div class="table-container" id="table-view-${this.id}">
                 <p class="table-placeholder">Table view works best with arrays of objects</p>
            </div>`;
    this.mainContent.appendChild(this.tablePanel);
  }

  createStatusBar() {
    this.statusBar = document.createElement('footer');
    this.statusBar.className = 'status-bar';
    this.statusBar.innerHTML = `
            <div class="status-left">
                <span class="status-validation">Ready</span>
                <span class="status-path"></span>
            </div>
            <div class="status-right">
                <span class="status-size">0 bytes</span>
                <span class="status-lines">0 lines</span>
            </div>
        `;
    this.wrapper.appendChild(this.statusBar);
  }

  async initMonaco() {
    // Wait for monaco to be loaded (assuming loader is already present)
    if (!window.monaco) {
      // Primitive wait if not ready
      await new Promise((r) => setTimeout(r, 100)); // Should be ready by App.init
    }

    const container = this.textPanel.querySelector('.monaco-container');

    // Load content from IndexedDB (async)
    let initialValue = '{}';
    if (window.StorageUtils) {
      initialValue = await StorageUtils.loadFromIndexedDB(StorageUtils.KEYS.WORKSPACE_CONTENT + this.id, '{}');
    }

    this.editor = monaco.editor.create(container, {
      language: 'json',
      theme:
        document.documentElement.getAttribute('data-theme') === 'dark' ? 'json-dark' : 'json-light',
      value: initialValue,
      automaticLayout: true,
      folding: true,
      wordWrap: 'on',
      tabSize: 2,
      minimap: { enabled: false },
      lineNumbers: 'on',
      formatOnPaste: true,
      formatOnType: true,
    });

    this.editor.onDidChangeModelContent(() => {
      this.onContentChange();
    });

    this.editor.onDidFocusEditorWidget(() => {
      if (window.App) window.App.setActiveEditor(this);
    });

    // Track cursor position for path display
    this.editor.onDidChangeCursorPosition((e) => {
      this.onCursorChange(e);
    });
  }

  onCursorChange(e) {
    if (!window.JsonUtils || !window.TreeView) return;

    try {
      const model = this.editor.getModel();
      const offset = model.getOffsetAt(e.position);
      const text = model.getValue();

      // Get path at current offset
      const pathArray = JsonUtils.getPathAtOffset(text, offset);

      let jsPath = '';
      let jsonPointer = '';

      if (pathArray) {
        // Copying logic for stability and avoiding unnecessary instantiation
        jsPath = this.getJsPath(pathArray);
        jsonPointer = this.getJsonPointer(pathArray);
      }

      // Update Status Bar
      this.updatePathDisplay(jsPath, jsonPointer);
    } catch (err) {
      console.error('Error calculating path:', err);
      this.updatePathDisplay('', '');
    }
  }

  getJsPath(pathArray) {
    let path = '';
    pathArray.forEach((key) => {
      if (typeof key === 'number') {
        path += `[${key}]`;
      } else if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
        path += `.${key}`;
      } else {
        path += `["${String(key).replace(/"/g, '\\"')}"]`;
      }
    });
    return path;
  }

  getJsonPointer(pathArray) {
    if (!pathArray || pathArray.length === 0) return '/';
    return (
      '/' + pathArray.map((key) => String(key).replace(/~/g, '~0').replace(/\//g, '~1')).join('/')
    );
  }

  updatePathDisplay(jsPath, jsonPointer) {
    const pathEl = this.statusBar.querySelector('.status-path');
    if (!pathEl) return;

    if (!jsPath && !jsonPointer) {
      pathEl.innerHTML = '';
      return;
    }

    pathEl.innerHTML = `
            <span class="path-separator"> | </span>
            <span class="path-display" title="Click to copy JS Path">JS: <code>${jsPath}</code></span>
            <span class="path-separator"> | </span>
            <span class="path-display" title="Click to copy JSONPointer">JSONPointer: <code>${jsonPointer}</code></span>
        `;

    // Add copy listeners
    pathEl.querySelectorAll('.path-display').forEach((el) => {
      el.onclick = () => {
        const code = el.querySelector('code').textContent;
        navigator.clipboard.writeText(code);
        if (window.App) App.showToast('Path copied', 'success');
      };
    });
  }

  updateTheme() {
    if (this.editor) {
      const theme =
        document.documentElement.getAttribute('data-theme') === 'dark' ? 'json-dark' : 'json-light';
      monaco.editor.setTheme(theme);
    }
  }

  switchMode(mode) {
    this.mode = mode;

    // Persist local mode
    if (window.StorageUtils) {
      StorageUtils.save(StorageUtils.KEYS.WORKSPACE_MODE + this.id, mode);
    }

    // Hide all
    [this.textPanel, this.treePanel, this.tablePanel].forEach((p) => p.classList.remove('active'));

    const content = this.getValue();

    switch (mode) {
      case 'text':
        this.textPanel.classList.add('active');
        break;
      case 'tree':
        this.treePanel.classList.add('active');
        if (!this.treeView) {
          this.treeView = new TreeView(this.treePanel.querySelector('.tree-container'));
        }
        this.treeView.render(content);
        break;
      case 'table':
        this.tablePanel.classList.add('active');
        if (!this.tableView && window.TableView) {
          this.tableView = new TableView(this.tablePanel.querySelector('.table-container'));
        }
        if (this.tableView) {
          this.tableView.render(content);
        }
        break;
    }
  }

  getValue() {
    return this.editor ? this.editor.getValue() : '';
  }

  setValue(value) {
    if (this.editor) {
      this.editor.setValue(value);
      // If in other modes, update them too if active
      if (this.mode !== 'text') this.switchMode(this.mode);
    }
  }

  onContentChange() {
    this.updateStatusBar();
    this.saveToHistory();

    // Persist content to IndexedDB (Async)
    if (window.StorageUtils) {
       StorageUtils.saveToIndexedDB(StorageUtils.KEYS.WORKSPACE_CONTENT + this.id, this.getValue());
    }
  }

  updateStatusBar() {
    const content = this.getValue();
    // Use global JsonUtils
    const sizeInfo = window.JsonUtils ? JsonUtils.getSize(content) : { sizeStr: '0 B', lines: 0 };

    this.statusBar.querySelector('.status-size').textContent = sizeInfo.sizeStr;
    this.statusBar.querySelector('.status-lines').textContent = `${sizeInfo.lines} lines`;

    const validation = window.JsonUtils ? JsonUtils.validate(content) : { valid: true };
    const statusEl = this.statusBar.querySelector('.status-validation');

    if (validation.valid) {
      statusEl.textContent = 'Valid JSON';
      statusEl.className = 'status-validation success';
    } else {
      // Show error
      statusEl.className = 'status-validation error';
      statusEl.innerHTML = `<span>Error: ${validation.error}</span>`;

      // Check if repair is possible before showing button
      let canRepair = false;
      if (window.JsonUtils) {
        try {
          const repaired = JsonUtils.repair(content);
          // Verify repair produced different, valid JSON
          if (repaired !== content) {
            const repairedValidation = JsonUtils.validate(repaired);
            canRepair = repairedValidation.valid;
          }
        } catch {
          // Repair failed, don't show button
          canRepair = false;
        }
      }

      // Only show Auto Repair button if repair is possible
      if (canRepair) {
        const repairBtn = document.createElement('button');
        repairBtn.className = 'btn btn-primary btn-repair-status';
        repairBtn.innerHTML =
          '<i data-lucide="wrench" style="width:12px;height:12px;vertical-align:middle;margin-right:4px;"></i>Auto Repair';
        repairBtn.title = 'Attempt to fix common JSON errors';
        repairBtn.onclick = () => this.repair();

        statusEl.appendChild(repairBtn);
        if (window.lucide) lucide.createIcons({ root: repairBtn });
      }
    }

    this.toolbar.updateUndoRedo(this.historyIndex > 0, this.historyIndex < this.history.length - 1);
  }

  // Actions
  format() {
    const content = this.getValue();
    if (window.JsonUtils) {
      try {
        this.setValue(JsonUtils.format(content));
      } catch (e) {
        console.error(e);
      }
    }
  }

  compact() {
    const content = this.getValue();
    if (window.JsonUtils) {
      try {
        this.setValue(JsonUtils.compact(content));
      } catch (e) {
        console.error(e);
      }
    }
  }

  validate() {
    // Visual feedback handled in status bar, maybe toast?
    if (window.App) App.showToast(this.statusBar.querySelector('.status-validation').textContent);
  }

  repair() {
    const content = this.getValue();
    if (window.JsonUtils) {
      try {
        this.setValue(JsonUtils.repair(content));
      } catch (e) {
        console.error(e);
      }
    }
  }

  expandAll() {
    if (this.mode === 'text' && this.editor) {
      this.editor.trigger('anyString', 'editor.unfoldAll');
    } else if (this.mode === 'tree' && this.treeView) {
      this.treeView.expandAll();
    }
  }

  collapseAll() {
    if (this.mode === 'text' && this.editor) {
      this.editor.trigger('anyString', 'editor.foldAll');
    } else if (this.mode === 'tree' && this.treeView) {
      this.treeView.collapseAll();
    }
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.setValue(this.history[this.historyIndex]);
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.setValue(this.history[this.historyIndex]);
    }
  }

  saveToHistory() {
    const content = this.getValue();
    if (this.history[this.historyIndex] === content) return;

    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(content);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }

  async copyToClipboard() {
    try {
      await navigator.clipboard.writeText(this.getValue());
      if (window.App) App.showToast('Copied to clipboard', 'success');
    } catch (e) {
      if (window.App) App.showToast('Failed to copy: ' + e.message, 'error');
    }
  }

  clear() {
    this.setValue('');
  }
}

window.JsonEditor = JsonEditor;
