/**
 * JsonEditor - Encapsulates a single editor instance (Toolbar + Editor + StatusBar)
 */
export default class JsonEditor {
  constructor(container, id, initialMode = 'text') {
    this.container = container;
    this.id = id;

    // Load saved state
    this.mode = StorageUtils.load(StorageUtils.KEYS.WORKSPACE_MODE + this.id, initialMode);
    this.autoFormatEnabled = StorageUtils.load(StorageUtils.KEYS.WORKSPACE_AUTOFORMAT + this.id, 'false') === 'true';
    
    this.isFormatting = false;
    this.autoFormatTimer = null;
    this.editor = null; // Monaco instance
    this.history = [];
    this.historyIndex = -1;
    this.maxHistory = 50;

    this.wrapper = DomUtils.createElement('div', { className: 'editor-instance' });
    this.container.appendChild(this.wrapper);

    this.ready = this.init();
  }

  async init() {
    this.createPrimaryToolbar();

    this.toolbarContainer = DomUtils.createElement('div');
    this.wrapper.appendChild(this.toolbarContainer);
    this.toolbar = new EditorToolbar(this.toolbarContainer, this);
    this.toolbar.updateAutoFormatState?.(this.autoFormatEnabled);

    this.mainContent = DomUtils.createElement('div', {
      className: 'editor-main-content',
      style: { flex: '1', position: 'relative', overflow: 'hidden' }
    });
    this.wrapper.appendChild(this.mainContent);

    this.createPanels();
    this.createStatusBar();

    await this.initMonaco();
    this.switchMode(this.mode);
    this.saveToHistory();
  }

  createPrimaryToolbar() {
    this.primaryToolbar = DomUtils.createElement('div', { className: 'toolbar primary-toolbar' });
    this.primaryToolbar.innerHTML = `
      <div class="toolbar-group toolbar-group-left">
        <button class="btn btn-secondary btn-new" title="New / Clear Editor"><i data-lucide="file-plus" class="icon"></i> New</button>
        <button class="btn btn-secondary btn-import-file" title="Import File"><i data-lucide="folder-open" class="icon"></i> Import</button>
        <button class="btn btn-secondary btn-import-url" title="Import from URL"><i data-lucide="link" class="icon"></i> URL</button>
        <button class="btn btn-secondary btn-export" title="Export File"><i data-lucide="save" class="icon"></i> Export</button>
        <button class="btn btn-secondary btn-example" title="Load Example JSON"><i data-lucide="file-up" class="icon"></i> Load Example</button>
      </div>
      <div class="toolbar-group toolbar-group-right"></div>
      <input type="file" class="hidden-file-input" accept=".json,.csv,.txt" hidden>
    `;
    this.wrapper.appendChild(this.primaryToolbar);

    const fileInput = this.primaryToolbar.querySelector('.hidden-file-input');
    const on = (sel, fn) => this.primaryToolbar.querySelector(sel).addEventListener('click', fn);

    on('.btn-new', () => this.clear());
    on('.btn-import-file', () => fileInput.click());
    on('.btn-import-url', () => {
      App.pendingImportTarget = this;
      Modal.show('url-modal');
    });
    on('.btn-export', () => this.exportFile());
    on('.btn-example', () => {
      this.setValue(TextEditor.getDefaultJson());
      App.showToast('Example JSON loaded', 'success');
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) this.importFile(e.target.files[0]);
      e.target.value = '';
    });

    if (window.lucide) lucide.createIcons({ root: this.primaryToolbar });
  }

  importFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => this.handleImportContent(e.target.result, file.name.endsWith('.csv'));
    reader.readAsText(file);
  }

  handleImportContent(content, isCsv) {
    let valueToSet = content;
    if (isCsv && window.CsvUtils) {
      try {
        const delimiter = CsvUtils.detectDelimiter(content);
        valueToSet = JSON.stringify(CsvUtils.csvToJson(content, delimiter), null, 2);
      } catch (e) {
        App.showToast('CSV Error: ' + e.message, 'error');
        return;
      }
    } else if (window.JsonUtils) {
      try { valueToSet = JsonUtils.format(content); } catch { /* ignore format error */ }
    }

    this.setValue(valueToSet);
    App.showToast('File loaded', 'success');
  }

  exportFile() {
    const content = this.getValue();
    if (!content) return;
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = DomUtils.createElement('a', { href: url, download: `data-${this.id}.json` });
    a.click();
    URL.revokeObjectURL(url);
  }

  addPrimaryButton(config) {
    if (!this.primaryToolbar) return;
    const group = this.primaryToolbar.querySelector(config.position === 'left' ? '.toolbar-group-left' : '.toolbar-group-right');
    if (!group) return;

    const btn = DomUtils.createElement('button', {
      className: `btn btn-secondary btn-sm ${config.className || ''}`,
      title: config.title
    });
    btn.innerHTML = `<i data-lucide="${config.icon}" class="icon"></i> ${config.label || ''}`;
    btn.onclick = config.onClick;

    if (config.position === 'left') group.insertBefore(btn, group.firstChild);
    else group.appendChild(btn);

    if (window.lucide) lucide.createIcons({ root: btn });
    return btn;
  }

  createPanels() {
    const createPanel = (id, classNm, inner) => {
      const p = DomUtils.createElement('div', { className: 'editor-panel', id: `${id}-${this.id}` });
      p.innerHTML = inner;
      this.mainContent.appendChild(p);
      return p;
    };

    this.textPanel = createPanel('text-panel', '', `<div class="monaco-container" id="monaco-${this.id}"></div>`);
    this.treePanel = createPanel('tree-panel', '', `<div class="tree-container" id="tree-view-${this.id}"></div>`);
    this.tablePanel = createPanel('table-panel', '', `<div class="table-container" id="table-view-${this.id}"><p class="table-placeholder">Table view works best with arrays of objects</p></div>`);
  }

  createStatusBar() {
    this.statusBar = DomUtils.createElement('footer', { className: 'status-bar' });
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
    const container = this.textPanel.querySelector('.monaco-container');
    const initialValue = await StorageUtils.loadFromIndexedDB(StorageUtils.KEYS.WORKSPACE_CONTENT + this.id, '{}');

    this.editor = monaco.editor.create(container, {
      language: 'json',
      theme: Theme.getMonacoTheme(),
      value: initialValue,
      automaticLayout: true,
      folding: true,
      wordWrap: 'on',
      tabSize: 2,
      minimap: { enabled: false },
      formatOnPaste: true,
      formatOnType: true,
    });

    this.editor.onDidChangeModelContent(() => this.onContentChange());
    this.editor.onDidFocusEditorWidget(() => App.setActiveEditor(this));
    this.editor.onDidChangeCursorPosition((e) => this.onCursorChange(e));
  }

  onCursorChange(e) {
    if (!window.JsonUtils) return;
    try {
      const model = this.editor.getModel();
      const pathArray = JsonUtils.getPathAtOffset(model.getValue(), model.getOffsetAt(e.position));
      this.updatePathDisplay(pathArray ? this.getJsPath(pathArray) : '', pathArray ? this.getJsonPointer(pathArray) : '');
    } catch {
      this.updatePathDisplay('', '');
    }
  }

  getJsPath(pathArray) {
    return pathArray.map(key => typeof key === 'number' ? `[${key}]` : (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? `.${key}` : `["${String(key).replace(/"/g, '\\"')}"]`)).join('').replace(/^\./, '');
  }

  getJsonPointer(pathArray) {
    return pathArray.length === 0 ? '/' : '/' + pathArray.map(key => String(key).replace(/~/g, '~0').replace(/\//g, '~1')).join('/');
  }

  updatePathDisplay(jsPath, jsonPointer) {
    const pathEl = this.statusBar.querySelector('.status-path');
    if (!pathEl) return;
    if (!jsPath && !jsonPointer) { pathEl.innerHTML = ''; return; }

    pathEl.innerHTML = `
      <span class="path-separator"> | </span>
      <span class="path-display" title="Click to copy JS Path">JS: <code>${jsPath}</code></span>
      <span class="path-separator"> | </span>
      <span class="path-display" title="Click to copy JSONPointer">JSONPointer: <code>${jsonPointer}</code></span>
    `;

    pathEl.querySelectorAll('.path-display').forEach(el => {
      el.onclick = () => {
        navigator.clipboard.writeText(el.querySelector('code').textContent);
        App.showToast('Path copied', 'success');
      };
    });
  }

  switchMode(mode) {
    this.mode = mode;
    StorageUtils.save(StorageUtils.KEYS.WORKSPACE_MODE + this.id, mode);
    this.toolbar?.setActiveTab?.(mode);

    [this.textPanel, this.treePanel, this.tablePanel].forEach(p => p.classList.remove('active'));
    
    const content = this.getValue();
    switch (mode) {
      case 'text': this.textPanel.classList.add('active'); break;
      case 'tree':
        this.treePanel.classList.add('active');
        if (!this.treeView) this.treeView = new TreeView(this.treePanel.querySelector('.tree-container'));
        this.treeView.render(content);
        break;
      case 'table':
        this.tablePanel.classList.add('active');
        if (!this.tableView && window.TableView) this.tableView = new TableView(this.tablePanel.querySelector('.table-container'));
        this.tableView?.render(content);
        break;
    }
  }

  getValue() { return this.editor?.getValue() || ''; }
  setValue(value) {
    if (this.editor) {
      this.editor.setValue(value);
      if (this.mode !== 'text') this.switchMode(this.mode);
    }
  }

  onContentChange() {
    if (this.isFormatting) return;
    this.saveToHistory();
    this.updateStatusBar();
    StorageUtils.saveToIndexedDB(StorageUtils.KEYS.WORKSPACE_CONTENT + this.id, this.getValue());

    if (this.autoFormatEnabled && this.mode === 'text' && this.editor) {
      if (JsonUtils.validate(this.getValue()).valid) {
        clearTimeout(this.autoFormatTimer);
        this.autoFormatTimer = setTimeout(() => {
          this.isFormatting = true;
          this.editor.getAction('editor.action.formatDocument').run().finally(() => this.isFormatting = false);
        }, 800);
      }
    }
  }

  updateStatusBar() {
    const content = this.getValue();
    const sizeInfo = JsonUtils.getSize(content);
    this.statusBar.querySelector('.status-size').textContent = sizeInfo.sizeStr;
    this.statusBar.querySelector('.status-lines').textContent = `${sizeInfo.lines} lines`;

    const validation = JsonUtils.validate(content);
    const statusEl = this.statusBar.querySelector('.status-validation');
    statusEl.className = `status-validation ${validation.valid ? 'success' : 'error'}`;
    statusEl.innerHTML = validation.valid ? 'Valid JSON' : `<span>Error: ${validation.error}</span>`;

    if (!validation.valid && window.JsonUtils) {
      try {
        const repaired = JsonUtils.repair(content);
        if (repaired !== content && JsonUtils.validate(repaired).valid) {
          const btn = DomUtils.createElement('button', { className: 'btn btn-primary btn-repair-status', title: 'Attempt to fix common JSON errors' });
          btn.innerHTML = '<i data-lucide="wrench" style="width:12px;height:12px;vertical-align:middle;margin-right:4px;"></i>Auto Repair';
          btn.onclick = () => this.repair();
          statusEl.appendChild(btn);
          if (window.lucide) lucide.createIcons({ root: btn });
        }
      } catch { /* ignore repair failure */ }
    }
    this.toolbar?.updateUndoRedo(this.historyIndex > 0, this.historyIndex < this.history.length - 1);
  }

  toggleAutoFormat() {
    this.autoFormatEnabled = !this.autoFormatEnabled;
    StorageUtils.save(StorageUtils.KEYS.WORKSPACE_AUTOFORMAT + this.id, String(this.autoFormatEnabled));
    this.toolbar?.updateAutoFormatState?.(this.autoFormatEnabled);
    if (this.autoFormatEnabled) this.format();
    App.showToast(`Autoformat ${this.autoFormatEnabled ? 'enabled' : 'disabled'}`, this.autoFormatEnabled ? 'success' : 'info');
  }

  format() { try { this.setValue(JsonUtils.format(this.getValue())); } catch (e) { console.error(e); } }
  compact() { try { this.setValue(JsonUtils.compact(this.getValue())); } catch (e) { console.error(e); } }
  validate() { App.showToast(this.statusBar.querySelector('.status-validation').textContent); }
  repair() { try { this.setValue(JsonUtils.repair(this.getValue())); } catch (e) { console.error(e); } }
  
  sort(descending = false) {
    try {
      const sorted = JsonUtils.sortKeys(JSON.parse(this.getValue()), descending);
      this.setValue(JSON.stringify(sorted, null, 2));
      App.showToast(`JSON keys sorted ${descending ? 'descending' : 'alphabetically'}`, 'success');
    } catch (e) {
      App.showToast('Cannot sort: ' + e.message, 'error');
    }
  }

  expandAll() {
    if (this.mode === 'text') this.editor?.trigger('anyString', 'editor.unfoldAll');
    else if (this.mode === 'tree') this.treeView?.expandAll();
  }

  collapseAll() {
    if (this.mode === 'text') this.editor?.trigger('anyString', 'editor.foldAll');
    else if (this.mode === 'tree') this.treeView?.collapseAll();
  }

  undo() { if (this.historyIndex > 0) { this.historyIndex--; this.setValue(this.history[this.historyIndex]); } }
  redo() { if (this.historyIndex < this.history.length - 1) { this.historyIndex++; this.setValue(this.history[this.historyIndex]); } }

  saveToHistory() {
    const content = this.getValue();
    if (this.history[this.historyIndex] === content) return;
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(content);
    if (this.history.length > this.maxHistory) this.history.shift();
    this.historyIndex = this.history.length - 1;
  }

  async copyToClipboard() {
    try {
      await navigator.clipboard.writeText(this.getValue());
      App.showToast('Copied to clipboard', 'success');
    } catch (e) {
      App.showToast('Failed to copy: ' + e.message, 'error');
    }
  }

  async confirmClear() {
    const content = this.getValue().trim();
    if (!content || content === '{}' || content === '[]') { this.clear(); return; }
    if (await Modal.confirm('Are you sure you want to clear the editor? This action cannot be undone.', 'Clear Editor')) this.clear();
  }

  clear() { this.setValue('{}'); }
}

window.JsonEditor = JsonEditor;
