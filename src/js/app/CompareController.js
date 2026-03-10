export default class CompareController {
  constructor(app) {
    this.app = app;
    this.diffEditor = null;
    this.patchEditor = null;
    this.currentDiffView = 'summary';
    this.isApplyingPatch = false;
    this.compareAbortController = null;
  }

  init() {
    const leftContent = this.app.editors[0].getValue();
    const rightContent = this.app.editors[1].getValue();

    if (!this.diffEditor) {
      const container = document.getElementById('monaco-diff-container');
      if (container) {
        this.diffEditor = monaco.editor.createDiffEditor(container, {
          theme: Theme.getMonacoTheme(),
          automaticLayout: true,
          originalEditable: true,
          readOnly: false,
        });

        this.diffEditor.onDidUpdateDiff(() => {
          this.updateDiffSummary();
        });

        // Sync Labels and Toolbars with Splitter
        const syncSplitterLayout = () => {
          const originalEl = container.querySelector('.editor.original');
          const labelOriginal = document.getElementById('label-original');
          const toolbarOriginal = document.getElementById('diff-original-toolbar');
          if (originalEl && labelOriginal && toolbarOriginal) {
            const width = originalEl.offsetWidth;
            labelOriginal.style.width = `${width}px`;
            labelOriginal.style.flex = 'none';
            toolbarOriginal.style.width = `${width}px`;
            toolbarOriginal.style.flex = 'none';
          }
        };

        const observer = new ResizeObserver(() => syncSplitterLayout());
        setTimeout(() => {
          const originalEl = container.querySelector('.editor.original');
          if (originalEl) observer.observe(originalEl);
          syncSplitterLayout();
        }, 100);

        this.initDiffPanelToolbars();
      }
    }

    if (this.diffEditor) {
      const prevModel = this.diffEditor.getModel();
      if (prevModel) {
        prevModel.original?.dispose();
        prevModel.modified?.dispose();
      }

      const originalModel = monaco.editor.createModel(leftContent, 'json');
      const modifiedModel = monaco.editor.createModel(rightContent, 'json');
      
      originalModel.onDidChangeContent(() => {
        const val = originalModel.getValue();
        if (this.app.editors[0] && this.app.editors[0].getValue() !== val) {
          this.app.editors[0].setValue(val);
        }
      });

      modifiedModel.onDidChangeContent(() => {
        const val = modifiedModel.getValue();
        if (this.app.editors[1] && this.app.editors[1].getValue() !== val) {
          this.app.editors[1].setValue(val);
        }
      });

      this.diffEditor.setModel({
        original: originalModel,
        modified: modifiedModel,
      });
      monaco.editor.setTheme(Theme.getMonacoTheme());
      this.updateDiffSummary();
    }

    // Setup Resizer
    const handle = document.getElementById('diff-resize-handle');
    const summaryWrapper = document.getElementById('diff-summary-wrapper');
    const comparePanel = document.getElementById('compare-panel');
    
    if (this.compareAbortController) this.compareAbortController.abort();
    this.compareAbortController = new AbortController();
    const { signal } = this.compareAbortController;

    if (handle && summaryWrapper && comparePanel && window.DomUtils) {
      DomUtils.setupResizer(
        handle,
        (e, initial) => {
          const delta = initial.startY - e.clientY;
          const panelHeight = comparePanel.offsetHeight;
          const newHeight = Math.min(
            Math.max(40, initial.startHeight + delta),
            Math.floor(panelHeight * 0.8)
          );
          comparePanel.style.setProperty('--diff-summary-height', `${newHeight}px`);
          if (this.currentDiffView === 'patch' && this.patchEditor) {
            this.patchEditor.layout();
          }
        },
        (mousedownEvent) => ({
          startY: mousedownEvent.clientY,
          startHeight: summaryWrapper.offsetHeight,
        }),
        signal
      );
    }

    this.initPatchEditor(signal);
    this.bindEvents(signal);
  }

  initPatchEditor() {
    if (this.patchEditor) return;

    const patchContainer = document.getElementById('diff-patch-editor');
    if (!patchContainer) return;

    this.patchEditor = monaco.editor.create(patchContainer, {
      language: 'json',
      theme: Theme.getMonacoTheme(),
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      formatOnType: true,
      automaticLayout: true,
    });

    this.patchEditor.onDidChangeModelContent(() => {
      if (this.isApplyingPatch) return;
      try {
        const patchStr = this.patchEditor.getValue();
        const patchArray = JSON.parse(patchStr || '[]');
        const originalModel = this.diffEditor.getModel().original;
        const originalJson = JSON.parse(originalModel.getValue() || '{}');

        if (window.jsonpatch) {
          const result = window.jsonpatch.applyPatch(originalJson, patchArray, true, false);
          const newDoc = result.newDocument;
          const modifiedModel = this.diffEditor.getModel().modified;
          const modifiedVal = JSON.stringify(newDoc, null, 2);

          if (modifiedModel.getValue() !== modifiedVal) {
            try {
              this.isApplyingPatch = true;
              modifiedModel.setValue(modifiedVal);
              if (this.app.editors[1]) this.app.editors[1].setValue(modifiedVal);
            } finally {
              this.isApplyingPatch = false;
            }
          }
        }
      } catch {
        // Silent catch during typing
      }
    });
  }

  bindEvents(signal) {
    const viewRadios = document.querySelectorAll('input[name="diff-view"]');
    viewRadios.forEach((radio) => {
      radio.addEventListener('change', (e) => {
        this.currentDiffView = e.target.value;
        const summaryEl = document.getElementById('diff-summary');
        const patchEl = document.getElementById('diff-patch-editor');
        const patchToolbar = document.getElementById('diff-patch-toolbar');
        
        if (this.currentDiffView === 'summary') {
          summaryEl?.classList.remove('hidden');
          patchEl?.classList.add('hidden');
          patchToolbar?.classList.add('hidden');
        } else {
          summaryEl?.classList.add('hidden');
          patchEl?.classList.remove('hidden');
          patchToolbar?.classList.remove('hidden');
          if (this.patchEditor) setTimeout(() => this.patchEditor.layout(), 10);
        }
      }, { signal });
    });

    const btnActions = {
      'btn-patch-format': () => this.patchEditor?.getAction('editor.action.formatDocument').run(),
      'btn-patch-copy': async () => {
        if (this.patchEditor) {
          await navigator.clipboard.writeText(this.patchEditor.getValue());
          this.app.showToast('Patches copied to clipboard', 'success');
        }
      },
      'btn-patch-undo': () => this.patchEditor?.trigger('keyboard', 'undo', null),
      'btn-patch-redo': () => this.patchEditor?.trigger('keyboard', 'redo', null),
      'btn-patch-clear': () => {
        if (this.patchEditor) {
          this.patchEditor.setValue('[]');
          this.app.showToast('Patch cleared (Right side reset)', 'info');
        }
      }
    };

    Object.entries(btnActions).forEach(([id, action]) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', action, { signal });
        if (id.includes('undo') || id.includes('redo')) btn.disabled = false;
      }
    });

    if (window.lucide) lucide.createIcons();
  }

  initDiffPanelToolbars() {
    if (!this.diffEditor || !window.EditorToolbar) return;
    this.setupDiffPanelToolbar(
      document.getElementById('diff-original-toolbar'),
      this.diffEditor.getOriginalEditor(),
      'original'
    );
    this.setupDiffPanelToolbar(
      document.getElementById('diff-modified-toolbar'),
      this.diffEditor.getModifiedEditor(),
      'modified'
    );
  }

  setupDiffPanelToolbar(container, monacoEditor, id) {
    if (!container || container.dataset.wired === 'true') return;
    container.dataset.wired = 'true';

    const wrapper = this.createMonacoWrapper(monacoEditor, id);
    const toolbar = new EditorToolbar(container, wrapper);

    // Hide unwanted UI elements
    const selectorsToRemove = ['.mode-tabs-group', '.btn-expand', '.btn-compact', '.btn-autoformat'];
    selectorsToRemove.forEach(sel => toolbar.element.querySelector(sel)?.parentElement?.remove() || toolbar.element.querySelector(sel)?.remove());

    toolbar.element.querySelectorAll('.toolbar-divider').forEach((d) => {
      if (!d.nextElementSibling || d.nextElementSibling.classList.contains('toolbar-divider')) d.remove();
    });
  }

  createMonacoWrapper(monacoEditor, id) {
    return {
      id,
      editor: monacoEditor,
      format: () => monacoEditor.getAction('editor.action.formatDocument').run(),
      compact: () => {
        try {
          const val = monacoEditor.getValue();
          monacoEditor.setValue(JSON.stringify(JSON.parse(val)));
        } catch {
          this.app.showToast('Invalid JSON', 'error');
        }
      },
      undo: () => monacoEditor.trigger('keyboard', 'undo', null),
      redo: () => monacoEditor.trigger('keyboard', 'redo', null),
      copyToClipboard: async () => {
        await navigator.clipboard.writeText(monacoEditor.getValue());
        this.app.showToast('Copied to clipboard', 'success');
      },
      confirmClear: () => monacoEditor.setValue('{}'),
      switchMode: () => {},
      expandAll: () => monacoEditor.trigger('anyString', 'editor.unfoldAll'),
      collapseAll: () => monacoEditor.trigger('anyString', 'editor.foldAll'),
      toggleAutoFormat: () => {},
      updateUndoRedo: () => {},
      validate: () => {},
    };
  }

  updateDiffSummary() {
    if (!this.diffEditor) return;
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
    if (summaryContainer) summaryContainer.innerHTML = diffHtml;

    if (this.patchEditor && !this.isApplyingPatch) {
      try {
        const obj1 = JSON.parse(original);
        const obj2 = JSON.parse(modified);
        if (window.DiffUtils) {
          const patch = DiffUtils.generateJsonPatch(obj1, obj2);
          const patchStr = JSON.stringify(patch, null, 2);
          if (this.patchEditor.getValue() !== patchStr && !this.patchEditor.hasWidgetFocus()) {
            this.isApplyingPatch = true;
            this.patchEditor.setValue(patchStr);
            this.isApplyingPatch = false;
          }
        }
      } catch { /* ignore parsing errors during sync */ }
    }
  }
}

window.CompareController = CompareController;
