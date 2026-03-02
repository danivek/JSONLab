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
    await this.createEditors(container);

    // Check for shared snippet
    if (window.location.hash.startsWith('#share=')) {
        const payload = window.location.hash.substring(7); // Remove '#share='
        if (window.ShareUtils && window.App) {
            try {
                const stateStr = await ShareUtils.decompress(payload);
                const state = JSON.parse(stateStr);
                
                // Directly load the parsed workspace object
                this.loadWorkspaceState(state);
                
                App.showToast('Shared workspace loaded successfully!', 'success');
                // Clean up URL to avoid reloading later
                history.replaceState(null, '', window.location.pathname + window.location.search);
            } catch (e) {
                console.error("Failed to load shared workspace", e);
                App.showToast('Failed to load shared workspace: ' + e.message, 'error');
            }
        }
    }

    console.log('JSON Editor initialized');
  },

  /**
   * Create Editors (Init logic)
   */
  async createEditors(container) {
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
    rightContainer.style.display = 'none'; // hidden until switchGlobalMode sets the correct layout
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

    // Setup default content ONLY if no saved content exists
    if (window.StorageUtils) {
      const leftSaved = await StorageUtils.loadFromIndexedDB(StorageUtils.KEYS.WORKSPACE_CONTENT + 'left');
      if (!leftSaved) {
        leftEditor.setValue(TextEditor.getDefaultJson());
        // Sync to right only if both are empty
        const rightSaved = await StorageUtils.loadFromIndexedDB(StorageUtils.KEYS.WORKSPACE_CONTENT + 'right');
        if (!rightSaved) {
          rightEditor.setValue(leftEditor.getValue());
        }
      }
    }

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

    // Default View: Load from storage or default to normal
    const savedGlobalMode = window.StorageUtils ? StorageUtils.load(StorageUtils.KEYS.GLOBAL_VIEW_MODE, 'normal') : 'normal';
    this.switchGlobalMode(savedGlobalMode);

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
    this.activeEditor?.confirmClear();
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

    document.getElementById('btn-share-global')?.addEventListener('click', async () => {
        if (window.ShareUtils) {
            try {
                const state = this.getWorkspaceState();
                const url = await ShareUtils.generateShareUrl(JSON.stringify(state));
                await navigator.clipboard.writeText(url);
                this.showToast('Workspace URL copied to clipboard!', 'success');
            } catch (e) {
                console.error('Error generating share URL:', e);
                this.showToast('Error creating snippet: ' + e.message, 'error');
            }
        }
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

    const queryEngineRadios = document.getElementsByName('query-engine');
    if (queryEngineRadios.length > 0) {
      queryEngineRadios.forEach((radio) => {
        radio.addEventListener('change', () => this.runQuery());
      });
    }

    // Apply result is now live on input change
    
    // Shortcuts Popover
    this.initShortcutsPopover();
  },

  /**
   * Initialize Shortcuts Popover
   */
  initShortcutsPopover() {
    const btn = document.getElementById('btn-shortcuts');
    const popover = document.getElementById('shortcuts-popover');
    if (!btn || !popover) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      popover.classList.toggle('hidden');
      
      // Re-initialize icons if they haven't been transformed yet or to be safe
      if (window.lucide && !popover.classList.contains('hidden')) {
        lucide.createIcons({ root: popover });
      }
    });

    document.addEventListener('click', (e) => {
      if (!popover.classList.contains('hidden') && !popover.contains(e.target) && e.target !== btn) {
        popover.classList.add('hidden');
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !popover.classList.contains('hidden')) {
        popover.classList.add('hidden');
      }
    });
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

    // Persist global view mode
    if (window.StorageUtils) {
      StorageUtils.save(StorageUtils.KEYS.GLOBAL_VIEW_MODE, mode);
    }

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

        // Use ResizeObserver on the original pane to catch splitter movement
        const observer = new ResizeObserver(() => {
          syncSplitterLayout();
        });

        // Need to wait for Monaco to render its internal parts
        setTimeout(() => {
          const originalEl = container.querySelector('.editor.original');
          if (originalEl) observer.observe(originalEl);
          syncSplitterLayout();
        }, 100);

        // Initialize Panel Toolbars
        this.initDiffPanelToolbars();
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
    const summaryWrapper = document.getElementById('diff-summary-wrapper');
    const comparePanel = document.getElementById('compare-panel');
    if (handle && summaryWrapper && !handle._resizeWired) {
      handle._resizeWired = true;
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const startY = e.clientY;
        const startHeight = summaryWrapper.offsetHeight;
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

          // If patch editor is visible, force layout
          if (this.currentDiffView === 'patch' && this.patchEditor) {
            this.patchEditor.layout();
          }
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

    // Initialize patch view editor if not exist
    if (!this.patchEditor) {
      const patchContainer = document.getElementById('diff-patch-editor');
      if (patchContainer) {
        this.patchEditor = monaco.editor.create(patchContainer, {
          language: 'json',
          theme:
            document.documentElement.getAttribute('data-theme') === 'dark'
              ? 'json-dark'
              : 'json-light',
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          formatOnType: true,
          automaticLayout: true,
        });

        this.patchEditor.onDidChangeModelContent(() => {
          // If the user is manually editing the patch (and not us systematically setting it)
          if (!this.isApplyingPatch) {
            try {
              const patchStr = this.patchEditor.getValue();
              const patchArray = JSON.parse(patchStr || '[]');

              // Try to apply it to original model
              const originalModel = this.diffEditor.getModel().original;
              const originalJson = JSON.parse(originalModel.getValue() || '{}');

              if (window.jsonpatch) {
                // applyPatch mutates by default, we use mutate:false to get newDocument
                const result = window.jsonpatch.applyPatch(originalJson, patchArray, true, false);
                const newDoc = result.newDocument;

                const modifiedModel = this.diffEditor.getModel().modified;
                const modifiedVal = JSON.stringify(newDoc, null, 2);

                if (modifiedModel.getValue() !== modifiedVal) {
                  try {
                    this.isApplyingPatch = true;
                    modifiedModel.setValue(modifiedVal);

                    // Also sync to the underlying modified editor
                    if (this.editors[1]) {
                      this.editors[1].setValue(modifiedVal);
                    }
                  } finally {
                    this.isApplyingPatch = false;
                  }
                }
              }
            } catch (e) {
              // Invalid patch or structure, ignore while typing
            }
          }
        });
      }
    }

    // Wire up radio toggle
    const viewRadios = document.querySelectorAll('input[name="diff-view"]');
    if (viewRadios.length > 0 && !viewRadios[0]._wired) {
      viewRadios.forEach((radio) => {
        radio._wired = true;
        radio.addEventListener('change', (e) => {
          this.currentDiffView = e.target.value;
          const summaryEl = document.getElementById('diff-summary');
          const patchEl = document.getElementById('diff-patch-editor');
          const patchToolbar = document.getElementById('diff-patch-toolbar');
          if (this.currentDiffView === 'pretty') {
            summaryEl.classList.remove('hidden');
            patchEl.classList.add('hidden');
            if (patchToolbar) patchToolbar.classList.add('hidden');
          } else {
            summaryEl.classList.add('hidden');
            patchEl.classList.remove('hidden');
            if (patchToolbar) patchToolbar.classList.remove('hidden');
            if (this.patchEditor) {
              // Force layout update when shown to fix Monaco rendering quirk
              setTimeout(() => this.patchEditor.layout(), 10);
            }
          }
        });
      });
    }

    // Wire up Patch Toolbar Buttons
    const btnFormat = document.getElementById('btn-patch-format');
    if (btnFormat && !btnFormat._wired) {
      btnFormat._wired = true;
      btnFormat.addEventListener('click', () => {
        if (this.patchEditor) {
          this.patchEditor.getAction('editor.action.formatDocument').run();
        }
      });
    }

    const btnCopy = document.getElementById('btn-patch-copy');
    if (btnCopy && !btnCopy._wired) {
      btnCopy._wired = true;
      btnCopy.addEventListener('click', async () => {
        if (this.patchEditor) {
          const val = this.patchEditor.getValue();
          await navigator.clipboard.writeText(val);
          this.showToast('Patches copied to clipboard', 'success');
        }
      });
    }

    const btnUndo = document.getElementById('btn-patch-undo');
    if (btnUndo && !btnUndo._wired) {
      btnUndo._wired = true;
      btnUndo.addEventListener('click', () => {
        if (this.patchEditor) {
          this.patchEditor.trigger('keyboard', 'undo', null);
        }
      });
    }

    const btnRedo = document.getElementById('btn-patch-redo');
    if (btnRedo && !btnRedo._wired) {
      btnRedo._wired = true;
      btnRedo.addEventListener('click', () => {
        if (this.patchEditor) {
          this.patchEditor.trigger('keyboard', 'redo', null);
        }
      });
    }

    const btnClear = document.getElementById('btn-patch-clear');
    if (btnClear && !btnClear._wired) {
      btnClear._wired = true;
      btnClear.addEventListener('click', () => {
        if (this.patchEditor) {
          this.patchEditor.setValue('[]');
          this.showToast('Patch cleared (Right side reset)', 'info');
        }
      });
    }

    // Refresh Lucide icons for the new toolbar
    if (window.lucide) {
      window.lucide.createIcons();
    }

    // Enable undo/redo buttons (they are disabled in HTML by default to match main toolbar style)
    if (btnUndo) btnUndo.disabled = false;
    if (btnRedo) btnRedo.disabled = false;
  },

  /**
   * Initialize toolbars for Original and Modified panes in Compare Mode
   */
  initDiffPanelToolbars() {
    if (!this.diffEditor || !window.EditorToolbar) return;

    const originalToolbarContainer = document.getElementById('diff-original-toolbar');
    const modifiedToolbarContainer = document.getElementById('diff-modified-toolbar');

    if (originalToolbarContainer && !originalToolbarContainer._wired) {
      originalToolbarContainer._wired = true;
      const originalEditor = this.diffEditor.getOriginalEditor();
      const wrapper = this.createMonacoWrapper(originalEditor, 'original');
      const toolbar = new EditorToolbar(originalToolbarContainer, wrapper);

      // Remove unwanted buttons for compare view
      const tabs = toolbar.element.querySelector('.mode-tabs-group');
      if (tabs) tabs.remove();

      const expandGroup = toolbar.element.querySelector('.btn-expand')?.parentElement;
      if (expandGroup) expandGroup.remove();

      const compactBtn = toolbar.element.querySelector('.btn-compact');
      if (compactBtn) compactBtn.remove();

      const autoformatBtn = toolbar.element.querySelector('.btn-autoformat');
      if (autoformatBtn) autoformatBtn.remove();

      // Clean up extra dividers
      toolbar.element.querySelectorAll('.toolbar-divider').forEach((d) => {
        if (!d.nextElementSibling || d.nextElementSibling.classList.contains('toolbar-divider')) {
          d.remove();
        }
      });
    }

    if (modifiedToolbarContainer && !modifiedToolbarContainer._wired) {
      modifiedToolbarContainer._wired = true;
      const modifiedEditor = this.diffEditor.getModifiedEditor();
      const wrapper = this.createMonacoWrapper(modifiedEditor, 'modified');
      const toolbar = new EditorToolbar(modifiedToolbarContainer, wrapper);

      // Remove unwanted buttons for compare view
      const tabs = toolbar.element.querySelector('.mode-tabs-group');
      if (tabs) tabs.remove();

      const expandGroup = toolbar.element.querySelector('.btn-expand')?.parentElement;
      if (expandGroup) expandGroup.remove();

      const compactBtn = toolbar.element.querySelector('.btn-compact');
      if (compactBtn) compactBtn.remove();

      const autoformatBtn = toolbar.element.querySelector('.btn-autoformat');
      if (autoformatBtn) autoformatBtn.remove();

      // Clean up extra dividers
      toolbar.element.querySelectorAll('.toolbar-divider').forEach((d) => {
        if (!d.nextElementSibling || d.nextElementSibling.classList.contains('toolbar-divider')) {
          d.remove();
        }
      });
    }
  },

  /**
   * Create a wrapper that matches EditorToolbar requirements for a raw Monaco editor
   */
  createMonacoWrapper(monacoEditor, id) {
    return {
      id: id,
      editor: monacoEditor,
      format: () => monacoEditor.getAction('editor.action.formatDocument').run(),
      compact: () => {
        try {
          const val = monacoEditor.getValue();
          const json = JSON.parse(val);
          monacoEditor.setValue(JSON.stringify(json));
        } catch (e) {
          this.showToast('Invalid JSON', 'error');
        }
      },
      undo: () => monacoEditor.trigger('keyboard', 'undo', null),
      redo: () => monacoEditor.trigger('keyboard', 'redo', null),
      copyToClipboard: async () => {
        await navigator.clipboard.writeText(monacoEditor.getValue());
        this.showToast('Copied to clipboard', 'success');
      },
      confirmClear: () => monacoEditor.setValue('{}'),
      switchMode: () => {}, // No-op for diff panels
      expandAll: () => monacoEditor.trigger('anyString', 'editor.unfoldAll'),
      collapseAll: () => monacoEditor.trigger('anyString', 'editor.foldAll'),
      toggleAutoFormat: () => {},
      updateUndoRedo: () => {},
      validate: () => {},
    };
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

    // Sync JSON Patch
    if (this.patchEditor && !this.isApplyingPatch) {
      try {
        const obj1 = JSON.parse(original);
        const obj2 = JSON.parse(modified);

        if (window.DiffUtils) {
          const patch = DiffUtils.generateJsonPatch(obj1, obj2);
          const patchStr = JSON.stringify(patch, null, 2);

          // Avoid overwriting while user is typing or if content is same
          if (this.patchEditor.getValue() !== patchStr && !this.patchEditor.hasWidgetFocus()) {
            this.isApplyingPatch = true;
            this.patchEditor.setValue(patchStr);
            this.isApplyingPatch = false;
          }
        }
      } catch (e) {
        // Error parsing JSON, ignore patch sync
      }
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
    const engine =
      document.querySelector('input[name="query-engine"]:checked')?.value || 'jsonpath';
    const dataStr = this.queryInputEditor ? this.queryInputEditor.getValue() : '{}';

    try {
      const data = JSON.parse(dataStr);
      console.log('Query:', query, 'Engine:', engine);

      // Use global QueryUtils
      if (window.QueryUtils) {
        const result = QueryUtils.query(data, query, engine);
        const resultStr = JSON.stringify(result, null, 2);

        if (this.queryOutputEditor) {
          this.queryOutputEditor.setValue(resultStr);

          // Apply to main editor live (without toast)
          const target = this.activeEditor || this.editors[0];
          if (target) {
            target.setValue(resultStr);
          }
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


  onContentChange() {
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

  /**
   * Serialize the entire workspace into a compact state object
   */
  getWorkspaceState() {
    const state = {
      m:
        document.querySelector('.header-actions .btn.active')?.id.replace('btn-mode-', '') ||
        'normal', // global mode
      l: { c: this.editors[0].getValue(), m: this.editors[0].mode },
      r: { c: this.editors[1].getValue(), m: this.editors[1].mode },
    };

    if (state.m === 'query') {
      const queryInput = document.getElementById('query-input');
      const engine = document.querySelector('input[name="query-engine"]:checked');
      if (queryInput) state.q = { i: queryInput.value, e: engine ? engine.value : 'jsonpath' };
    }
    return state;
  },

  /**
   * Restore the workspace from a state object
   */
  loadWorkspaceState(state) {
    if (!state || typeof state !== 'object') return;

    // 1. Restore contents and modes
    if (state.l) {
      this.editors[0].setValue(state.l.c || '{}');
      if (state.l.m) this.editors[0].switchMode(state.l.m);
    }
    if (state.r) {
      this.editors[1].setValue(state.r.c || '{}');
      if (state.r.m) this.editors[1].switchMode(state.r.m);
    }

    // 2. Restore global mode
    if (state.m) {
      this.switchGlobalMode(state.m);
    }

    // 3. Restore query state
    if (state.m === 'query' && state.q) {
      const queryInput = document.getElementById('query-input');
      if (queryInput) queryInput.value = state.q.i || '';

      const engineRadio = document.querySelector(
        `input[name="query-engine"][value="${state.q.e}"]`
      );
      if (engineRadio) engineRadio.checked = true;

      // Populate input editor internally
      if (this.queryInputEditor) {
        this.queryInputEditor.setValue(state.l?.c || '{}');
      }

      // Execute query
      setTimeout(() => this.runQuery(), 100);
    }
  },
};

document.addEventListener('DOMContentLoaded', () => {
  App.bindHeaderEvents();
  App.init();
});

window.App = App;
