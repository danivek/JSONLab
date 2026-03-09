/**
 * App - Main application controller
 */
const App = {
  editors: [],
  activeEditor: null,
  compareManager: null,
  queryManager: null,
  schemaManager: null,

  /**
   * Initialize the application
   */
  async init() {
    this.compareManager = new CompareController(this);
    this.queryManager = new QueryController(this);
    this.schemaManager = new SchemaController(this);

    await TextEditor.load();
    Theme.init();

    const container = document.getElementById('editors-container');
    container.innerHTML = '';
    await this.createEditors(container);

    // Initial check for shared snippet
    this.handleShareHash();

    console.log('JSON Lab initialized');
  },

  /**
   * Create main workspace editors
   */
  async createEditors(container) {
    // Left Editor
    const leftContainer = DomUtils.createElement('div', {
      className: 'editor-wrapper',
      id: 'editor-wrapper-left',
      style: { flex: '1', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--color-border)', minWidth: '0' }
    });
    container.appendChild(leftContainer);

    const leftEditor = new JsonEditor(leftContainer, 'left', 'text');
    this.editors.push(leftEditor);

    // Right Editor
    const rightContainer = DomUtils.createElement('div', {
      className: 'editor-wrapper',
      id: 'editor-wrapper-right',
      style: { flex: '1', display: 'none', flexDirection: 'column', minWidth: '0' }
    });
    container.appendChild(rightContainer);

    const rightEditor = new JsonEditor(rightContainer, 'right', 'text');
    this.editors.push(rightEditor);

    await Promise.all([leftEditor.ready, rightEditor.ready]);

    // Splitter (hidden by default)
    const splitter = DomUtils.createElement('div', { className: 'editor-splitter', id: 'editors-splitter' });
    container.insertBefore(splitter, rightContainer);

    this.setActiveEditor(leftEditor);
    await this.loadInitialContent(leftEditor, rightEditor);
    this.setupInterEditorActions(leftEditor, rightEditor);

    const savedGlobalMode = StorageUtils.load(StorageUtils.KEYS.GLOBAL_VIEW_MODE, 'normal');
    await this.switchGlobalMode(savedGlobalMode);
    this.initSplitResizer();
  },

  async loadInitialContent(left, right) {
    const leftSaved = await StorageUtils.loadFromIndexedDB(StorageUtils.KEYS.WORKSPACE_CONTENT + 'left');
    if (!leftSaved) {
      left.setValue(TextEditor.getDefaultJson());
      const rightSaved = await StorageUtils.loadFromIndexedDB(StorageUtils.KEYS.WORKSPACE_CONTENT + 'right');
      if (!rightSaved) right.setValue(left.getValue());
    }
  },

  setupInterEditorActions(left, right) {
    this.copyToRightBtn = left.addPrimaryButton({
      icon: 'arrow-right',
      title: 'Copy content to Right Editor',
      className: 'btn-copy-right',
      position: 'right',
      onClick: () => {
        right.setValue(left.getValue());
        this.showToast('Copied to Right Editor', 'success');
      },
    });

    right.addPrimaryButton({
      icon: 'arrow-left',
      title: 'Copy content to Left Editor',
      position: 'left',
      onClick: () => {
        left.setValue(right.getValue());
        this.showToast('Copied to Left Editor', 'success');
      },
    });
  },

  setActiveEditor(editor) {
    this.activeEditor = editor;
    document.querySelectorAll('.editor-wrapper').forEach((el) => el.classList.remove('active-wrapper'));
    editor.wrapper.parentNode.classList.add('active-wrapper');
  },

  // --- Global Action Proxies --- //
  format() { this.activeEditor?.format(); },
  compact() { this.activeEditor?.compact(); },
  validate() { this.activeEditor?.validate(); },
  repair() { this.activeEditor?.repair(); },
  undo() { this.activeEditor?.undo(); },
  redo() { this.activeEditor?.redo(); },
  copyToClipboard() { this.activeEditor?.copyToClipboard(); },
  clear() { this.activeEditor?.confirmClear(); },
  switchMode(mode) { this.activeEditor?.switchMode(mode); },

  /**
   * Update theme for all editors.
   * Monaco editor now stays dark even when app is light.
   */
  updateTheme() {
    if (!window.monaco) return;
    const monacoTheme = Theme.getMonacoTheme();
    monaco.editor.setTheme(monacoTheme);

    // Refresh layout for all potential editor instances
    this.editors.forEach((ed) => {
      if (ed.editor) ed.editor.layout();
    });

    // Handle specialized editors in active managers
    if (this.compareManager?.diffEditor) this.compareManager.diffEditor.layout();
    if (this.compareManager?.patchEditor) this.compareManager.patchEditor.layout();
    if (this.queryManager?.queryInputEditor) this.queryManager.queryInputEditor.layout();
    if (this.queryManager?.queryOutputEditor) this.queryManager.queryOutputEditor.layout();
    if (this.schemaManager?.payloadEditor?.editor) this.schemaManager.payloadEditor.editor.layout();
    if (this.schemaManager?.schemaEditor?.editor) this.schemaManager.schemaEditor.editor.layout();
  },

  bindHeaderEvents() {
    this.pendingImportTarget = null;

    document.getElementById('btn-url-cancel')?.addEventListener('click', () => {
      Modal.hide('url-modal');
      this.pendingImportTarget = null;
    });

    document.getElementById('btn-url-load')?.addEventListener('click', () => {
      const url = document.getElementById('url-input').value;
      if (url) {
        this.importFromUrl(url, this.pendingImportTarget);
        Modal.hide('url-modal');
        this.pendingImportTarget = null;
      }
    });

    document.getElementById('btn-theme')?.addEventListener('click', () => Theme.toggle());

    document.getElementById('btn-share-global')?.addEventListener('click', async () => {
      try {
        const state = this.getWorkspaceState();
        const url = await ShareUtils.generateShareUrl(JSON.stringify(state));
        await navigator.clipboard.writeText(url);
        this.showToast('Workspace URL copied to clipboard!', 'success');
      } catch (e) {
        this.showToast('Error creating snippet: ' + e.message, 'error');
      }
    });

    this.bindKeyboardShortcuts();
    this.bindModeSwitches();
    this.initShortcutsPopover();
  },

  bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      const isCmd = e.ctrlKey || e.metaKey;
      if (isCmd && e.shiftKey && e.key === 'F') { e.preventDefault(); this.format(); }
      if (isCmd && e.key === 'd') { e.preventDefault(); Theme.toggle(); }
      if (isCmd && !e.shiftKey && e.key === 'z') { e.preventDefault(); this.undo(); }
      if ((isCmd && e.shiftKey && e.key === 'z') || (isCmd && e.key === 'y')) { e.preventDefault(); this.redo(); }
    });
  },

  bindModeSwitches() {
    const modes = ['normal', 'split', 'compare', 'query', 'schema'];
    modes.forEach(mode => {
      document.getElementById(`btn-mode-${mode}`)?.addEventListener('click', () => this.switchGlobalMode(mode));
    });
  },

  initShortcutsPopover() {
    const btn = document.getElementById('btn-shortcuts');
    const popover = document.getElementById('shortcuts-popover');
    if (!btn || !popover) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      popover.classList.toggle('hidden');
      if (window.lucide && !popover.classList.contains('hidden')) lucide.createIcons({ root: popover });
    });

    document.addEventListener('click', (e) => {
      if (!popover.classList.contains('hidden') && !popover.contains(e.target) && e.target !== btn) {
        popover.classList.add('hidden');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !popover.classList.contains('hidden')) popover.classList.add('hidden');
    });
  },

  async switchGlobalMode(mode) {
    document.querySelectorAll('.header-actions .btn').forEach((btn) => btn.classList.remove('active'));
    document.getElementById(`btn-mode-${mode}`)?.classList.add('active');
    StorageUtils.save(StorageUtils.KEYS.GLOBAL_VIEW_MODE, mode);

    // Reset visibility
    const editorsContainer = document.getElementById('editors-container');
    const comparePanel = document.getElementById('compare-panel');
    const queryPanel = document.getElementById('query-panel');
    const schemaPanel = document.getElementById('schema-panel');
    const splitter = document.getElementById('editors-splitter');
    const leftWrapper = document.getElementById('editor-wrapper-left');
    const rightWrapper = document.getElementById('editor-wrapper-right');

    [editorsContainer, comparePanel, queryPanel, schemaPanel, splitter].forEach(el => { if (el) el.style.display = 'none'; });
    if (leftWrapper) leftWrapper.style.display = 'flex';
    if (rightWrapper) rightWrapper.style.display = 'flex';

    switch (mode) {
      case 'normal':
        editorsContainer.style.display = 'flex';
        if (rightWrapper) rightWrapper.style.display = 'none';
        if (leftWrapper) leftWrapper.style.borderRight = 'none';
        if (this.copyToRightBtn) this.copyToRightBtn.style.display = 'none';
        break;
      case 'split':
        editorsContainer.style.display = 'flex';
        if (leftWrapper) leftWrapper.style.borderRight = '1px solid var(--color-border)';
        if (splitter) splitter.style.display = 'flex';
        if (this.copyToRightBtn) this.copyToRightBtn.style.display = 'inline-flex';
        break;
      case 'compare':
        comparePanel.style.display = 'flex';
        this.compareManager.init();
        break;
      case 'query':
        queryPanel.style.display = 'flex';
        this.queryManager.init();
        break;
      case 'schema':
        schemaPanel.style.display = 'flex';
        await this.schemaManager.init();
        break;
    }
  },

  initSplitResizer() {
    const handle = document.getElementById('editors-splitter');
    const container = document.getElementById('editors-container');
    const left = document.getElementById('editor-wrapper-left');
    const right = document.getElementById('editor-wrapper-right');

    if (!handle || !container || !left || !right) return;

    DomUtils.setupResizer(handle, (e) => {
      const containerRect = container.getBoundingClientRect();
      const percentage = Math.min(Math.max(10, ((e.clientX - containerRect.left) / containerRect.width) * 100), 90);
      left.style.flex = `0 0 ${percentage}%`;
      right.style.flex = `1 1 0`;
      this.editors.forEach(ed => ed.editor?.layout());
    });
  },

  async handleShareHash() {
    if (window.location.hash.startsWith('#share=')) {
      try {
        const payload = window.location.hash.substring(7);
        const stateStr = await ShareUtils.decompress(payload);
        this.loadWorkspaceState(JSON.parse(stateStr));
        this.showToast('Shared workspace loaded!', 'success');
        history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch {
        this.showToast('Failed to load shared workspace', 'error');
      }
    }
  },

  async importFromUrl(url, target) {
    try {
      const response = await fetch(url);
      const content = await response.text();
      const editor = target || this.activeEditor || this.editors[0];
      editor.handleImportContent(content, url.endsWith('.csv'));
    } catch (e) {
      this.showToast('Failed to load URL: ' + e.message, 'error');
    }
  },

  showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = DomUtils.createElement('div', { className: `toast ${type}` }, [message]);
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  },

  getWorkspaceState() {
    const state = {
      m: document.querySelector('.header-actions .btn.active')?.id.replace('btn-mode-', '') || 'normal'
    };

    if (state.m === 'schema' && this.schemaManager) {
      state.s = { p: this.schemaManager.payloadEditor.getValue(), s: this.schemaManager.schemaEditor.getValue() };
    } else {
      state.l = { c: this.editors[0].getValue(), m: this.editors[0].mode };
      state.r = { c: this.editors[1].getValue(), m: this.editors[1].mode };

      if (state.m === 'query' && this.queryManager) {
        const engine = document.querySelector('input[name="query-engine"]:checked');
        state.q = { i: document.getElementById('query-input')?.value, e: engine?.value || 'jsonpath' };
      }
    }

    return state;
  },

  loadWorkspaceState(state) {
    if (!state) return;
    
    if (state.m) this.switchGlobalMode(state.m);

    if (state.m === 'schema' && state.s) {
      if (this.schemaManager.payloadEditor) this.schemaManager.payloadEditor.setValue(state.s.p || '{}');
      if (this.schemaManager.schemaEditor) this.schemaManager.schemaEditor.setValue(state.s.s || '{}');
    } else {
      if (state.l) {
        this.editors[0].setValue(state.l.c || '{}');
        if (state.l.m) this.editors[0].switchMode(state.l.m);
      }
      if (state.r) {
        this.editors[1].setValue(state.r.c || '{}');
        if (state.r.m) this.editors[1].switchMode(state.r.m);
      }
      
      if (state.m === 'query' && state.q) {
        const queryInput = document.getElementById('query-input');
        if (queryInput) queryInput.value = state.q.i || '';
        const engineRadio = document.querySelector(`input[name="query-engine"][value="${state.q.e}"]`);
        if (engineRadio) engineRadio.checked = true;
        setTimeout(() => this.queryManager.runQuery(), 100);
      }
    }
  },
};

document.addEventListener('DOMContentLoaded', () => {
  App.bindHeaderEvents();
  App.init();
});

window.App = App;
export default App;
