/**
 * EditorToolbar - Manages toolbar actions for a specific editor instance
 */
class EditorToolbar {
  constructor(container, editorInstance) {
    this.container = container;
    this.editor = editorInstance;
    this.element = null;
    this.render();
    this.bindEvents();
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'toolbar';
    this.element.innerHTML = `
            <div class="toolbar-group mode-tabs-group">
                <button class="mode-tab active" data-mode="text" title="Text Mode">
                    <i data-lucide="file-text" class="icon"></i> Text
                </button>
                <button class="mode-tab" data-mode="tree" title="Tree Mode">
                    <i data-lucide="list-tree" class="icon"></i> Tree
                </button>
                <button class="mode-tab" data-mode="table" title="Table Mode">
                    <i data-lucide="table" class="icon"></i> Table
                </button>
            </div>

            <div class="toolbar-divider"></div>
            
            <div class="toolbar-group">
                <button class="btn btn-secondary btn-icon btn-expand" title="Expand All">
                    <i data-lucide="list-chevrons-up-down" class="icon"></i>
                </button>
                <button class="btn btn-secondary btn-icon btn-collapse" title="Collapse All">
                    <i data-lucide="list-chevrons-down-up" class="icon"></i>
                </button>
            </div>
            
            <div class="toolbar-divider"></div>
            
            <div class="toolbar-group">
                <button class="btn btn-secondary btn-icon btn-format" title="Format JSON (Ctrl+Shift+F)">
                    <i data-lucide="align-left" class="icon"></i>
                </button>
                <button class="btn btn-secondary btn-icon btn-compact" title="Compact JSON">
                    <i data-lucide="fold-vertical" class="icon"></i>
                </button>
            <div class="toolbar-divider"></div>
               
            </div>
            <div class="toolbar-group">
                <button class="btn btn-secondary btn-icon btn-undo" title="Undo (Ctrl+Z)" disabled>
                    <i data-lucide="undo" class="icon"></i>
                </button>
                <button class="btn btn-secondary btn-icon btn-redo" title="Redo (Ctrl+Y)" disabled>
                    <i data-lucide="redo" class="icon"></i>
                </button>
            </div>
            <div class="toolbar-group">
                <button class="btn btn-secondary btn-icon btn-copy" title="Copy to clipboard">
                    <i data-lucide="copy" class="icon"></i>
                </button>
                <button class="btn btn-secondary btn-icon btn-clear" title="Clear editor">
                    <i data-lucide="trash-2" class="icon"></i>
                </button>
            </div>
            <div class="toolbar-group toolbar-group-right">
                 <!-- Global app actions or specific editor actions can go here -->
            </div>
        `;
    this.container.appendChild(this.element);

    // Initialize icons
    if (window.lucide) {
      lucide.createIcons({ root: this.element });
    }
  }

  bindEvents() {
    // Helper to add listener
    const on = (selector, action) => {
      const el = this.element.querySelector(selector);
      if (el) el.addEventListener('click', action);
    };

    on('.btn-format', () => this.editor.format());
    on('.btn-compact', () => this.editor.compact());
    on('.btn-validate', () => this.editor.validate());
    on('.btn-repair', () => this.editor.repair());
    on('.btn-expand', () => this.editor.expandAll());
    on('.btn-collapse', () => this.editor.collapseAll());
    on('.btn-undo', () => this.editor.undo());
    on('.btn-redo', () => this.editor.redo());
    on('.btn-copy', () => this.editor.copyToClipboard());
    on('.btn-clear', () => this.editor.clear());

    // Mode tabs
    this.element.querySelectorAll('.mode-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const mode = tab.dataset.mode;
        this.editor.switchMode(mode);

        // Update active tab UI
        this.element.querySelectorAll('.mode-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
      });
    });
  }

  updateUndoRedo(canUndo, canRedo) {
    const btnUndo = this.element.querySelector('.btn-undo');
    const btnRedo = this.element.querySelector('.btn-redo');

    if (btnUndo) btnUndo.disabled = !canUndo;
    if (btnRedo) btnRedo.disabled = !canRedo;
  }

  /**
   * Add a custom button
   * config: { icon, title, className, onClick, position: 'left'|'right' }
   */
  addButton(config) {
    const position = config.position || 'right';
    let group;

    if (position === 'left') {
      // Check if we have a left custom group, if not create one at the start
      group = this.element.querySelector('.toolbar-group-custom-left');
      if (!group) {
        group = document.createElement('div');
        group.className = 'toolbar-group toolbar-group-custom-left';
        const firstChild = this.element.firstChild;
        this.element.insertBefore(group, firstChild);
        // Add divider after
        const divider = document.createElement('div');
        divider.className = 'toolbar-divider';
        this.element.insertBefore(divider, firstChild.nextSibling);
      }
    } else {
      group = this.element.querySelector('.toolbar-group-right');
    }

    if (!group) return;

    const btn = document.createElement('button');
    btn.className = `btn btn-secondary ${config.className || ''}`;
    btn.title = config.title;
    btn.innerHTML = `<i data-lucide="${config.icon}" class="icon"></i> ${config.label || ''}`;

    btn.addEventListener('click', () => {
      if (config.onClick) config.onClick();
    });

    // For right group, prepend (so it's leftmost of right group)
    // For left group, append (so it's rightmost of left group? or simple append)
    if (position === 'right') {
      group.insertBefore(btn, group.firstChild);
    } else {
      group.appendChild(btn);
    }

    // Refresh icons for this new button
    if (window.lucide) {
      lucide.createIcons({ root: btn });
    }

    return btn;
  }
}

window.EditorToolbar = EditorToolbar;
