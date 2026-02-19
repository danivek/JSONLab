/**
 * Toolbar - Button handlers for toolbar actions
 */

const Toolbar = {
  /**
   * Initialize toolbar event listeners
   */
  init() {
    // Format button
    document.getElementById('btn-format')?.addEventListener('click', () => {
      App.format();
    });

    // Compact button
    document.getElementById('btn-compact')?.addEventListener('click', () => {
      App.compact();
    });

    // Validate button
    document.getElementById('btn-validate')?.addEventListener('click', () => {
      App.validate();
    });

    // Repair button
    document.getElementById('btn-repair')?.addEventListener('click', () => {
      App.repair();
    });

    // Undo button
    document.getElementById('btn-undo')?.addEventListener('click', () => {
      App.undo();
    });

    // Redo button
    document.getElementById('btn-redo')?.addEventListener('click', () => {
      App.redo();
    });

    // Copy button
    document.getElementById('btn-copy')?.addEventListener('click', () => {
      App.copyToClipboard();
    });

    // Clear button
    document.getElementById('btn-clear')?.addEventListener('click', () => {
      App.clear();
    });

    // Compare button
    document.getElementById('btn-compare')?.addEventListener('click', () => {
      App.toggleCompareMode();
    });

    // Query button
    document.getElementById('btn-query')?.addEventListener('click', () => {
      App.toggleQueryMode();
    });

    // Import button
    document.getElementById('btn-import')?.addEventListener('click', () => {
      document.getElementById('file-input').click();
    });

    // File input change
    document.getElementById('file-input')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        App.importFile(file);
      }
      e.target.value = ''; // Reset for same file selection
    });

    // Import from URL button
    document.getElementById('btn-import-url')?.addEventListener('click', () => {
      Modal.show('url-modal');
    });

    // URL modal buttons
    document.getElementById('btn-url-cancel')?.addEventListener('click', () => {
      Modal.hide('url-modal');
    });

    document.getElementById('btn-url-load')?.addEventListener('click', () => {
      const url = document.getElementById('url-input').value;
      if (url) {
        App.importFromUrl(url);
        Modal.hide('url-modal');
      }
    });

    // Export button
    document.getElementById('btn-export')?.addEventListener('click', () => {
      App.export();
    });

    // Theme toggle
    document.getElementById('btn-theme')?.addEventListener('click', () => {
      Theme.toggle();
    });

    // Mode tabs
    document.querySelectorAll('.mode-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const mode = tab.dataset.mode;
        App.switchMode(mode);
      });
    });

    // Query panel
    document.getElementById('btn-run-query')?.addEventListener('click', () => {
      App.runQuery();
    });

    document.getElementById('query-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        App.runQuery();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Shift + F = Format
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        App.format();
      }

      // Ctrl/Cmd + S = Export/Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        App.export();
      }

      // Ctrl/Cmd + O = Import
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        document.getElementById('file-input').click();
      }

      // Ctrl/Cmd + D = Toggle dark mode
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        Theme.toggle();
      }
    });

    // Drag and drop
    this.setupDragDrop();

    // Initialize Lucide icons
    if (window.lucide) {
      lucide.createIcons();
    }
  },

  /**
   * Set up drag and drop for file import
   */
  setupDragDrop() {
    const app = document.getElementById('app');

    // Create drop overlay
    const overlay = document.createElement('div');
    overlay.className = 'drop-overlay hidden';
    overlay.innerHTML = '<div class="drop-overlay-text">Drop JSON file here</div>';
    document.body.appendChild(overlay);

    let dragCounter = 0;

    app.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      overlay.classList.remove('hidden');
    });

    app.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) {
        overlay.classList.add('hidden');
      }
    });

    app.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    app.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      overlay.classList.add('hidden');

      const file = e.dataTransfer.files[0];
      if (file) {
        App.importFile(file);
      }
    });
  },
};

// Export for use in other modules
window.Toolbar = Toolbar;
