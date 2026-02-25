/**
 * Tree View - Hierarchical JSON tree visualization
 */

class TreeView {
  constructor(container) {
    this.container = container;
    this.data = null;
    this.expandedPaths = new Set();
    this.init();
  }

  init() {
    this.contextMenu = null;
    document.addEventListener('click', (e) => {
      this.closeContextMenu();
    });
  }

  /**
   * Render JSON data as tree
   */
  render(jsonContent) {
    // If content is passed, parse it. If not, re-render existing data
    if (jsonContent !== undefined) {
      if (typeof jsonContent === 'string') {
        try {
          this.data = JSON.parse(jsonContent);
        } catch (e) {
          this.container.innerHTML = `<p class="error" style="color: var(--color-error);">Invalid JSON: ${e.message}</p>`;
          return;
        }
      } else {
        this.data = jsonContent;
      }
    }

    if (this.data === null || this.data === undefined) {
      // Keep placeholder if empty
      if (!this.container.hasChildNodes()) {
        this.container.innerHTML = '<p class="table-placeholder">No data to display</p>';
      }
      return;
    }

    const isNewData = jsonContent !== undefined;
    if (isNewData && this.expandedPaths.size === 0 && this.data) {
      this.collectAllPaths(this.data, []);
    }

    this.container.innerHTML = '';
    const tree = this.createNode(this.data, '', null);
    this.container.appendChild(tree);
  }

  /**
   * Create a tree node element
   */
  createNode(value, key, parentPathArray) {
    // Path tracking as array of keys
    const currentPathArray = parentPathArray ? [...parentPathArray] : [];
    if (key !== null && key !== undefined && key !== '') {
      // Use strict check
      currentPathArray.push(key);
    }

    const pathString = JSON.stringify(currentPathArray);

    const type = JsonUtils.getType(value);
    const isExpandable = type === 'object' || type === 'array';
    const isExpanded = this.expandedPaths.has(pathString);

    const node = document.createElement('div');
    node.className = 'tree-node';
    node.dataset.path = pathString;

    // Create header
    const header = document.createElement('div');
    header.className = 'tree-node-header';

    // Add click handler for path display
    header.addEventListener('click', (e) => {
      if (e.target.classList.contains('tree-toggle')) return;

      const jsPath = this.getJsPath(currentPathArray);
      const jsonPointer = this.getJsonPointer(currentPathArray);

      // Notify App (Global) or Editor Instance if we had a reference
      // For now, fall back to global App for status bar updates if available
      if (window.App) {
        // Ideally this should call a method on the owning JsonEditor
        // We'll trust App.updatePathDisplay for now or fix this later
        window.App.updatePathDisplay(jsPath, jsonPointer);
      }

      // Highlight selected node
      this.container
        .querySelectorAll('.tree-node-header.selected')
        .forEach((el) => el.classList.remove('selected'));
      header.classList.add('selected');

      e.stopPropagation();
    });

    // Right-click context menu
    header.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const jsPath = this.getJsPath(currentPathArray);
      const jsonPointer = this.getJsonPointer(currentPathArray);
      
      this.showContextMenu(e.clientX, e.clientY, {
        jsPath,
        jsonPointer,
        value,
        key,
        pathArray: currentPathArray
      });
      
      this.container
        .querySelectorAll('.tree-node-header.selected')
        .forEach((el) => el.classList.remove('selected'));
      header.classList.add('selected');
    });

    // Toggle arrow for expandable nodes
    const toggle = document.createElement('span');
    toggle.className = 'tree-toggle' + (isExpanded ? ' expanded' : '');
    toggle.textContent = isExpandable ? '▶' : '';
    if (isExpandable) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleNode(
          pathString,
          toggle,
          node.querySelector('.tree-children'),
          value,
          currentPathArray
        );
      });
    }
    header.appendChild(toggle);

    // Key
    if (key !== null && key !== '') {
      const keySpan = document.createElement('span');
      keySpan.className = 'tree-key';
      keySpan.textContent = key;
      header.appendChild(keySpan);

      const separator = document.createElement('span');
      separator.className = 'tree-separator';
      separator.textContent = ': ';
      header.appendChild(separator);
    }

    // Value or type indicator
    if (isExpandable) {
      const typeSpan = document.createElement('span');
      typeSpan.className = 'tree-type';
      if (type === 'array') {
        typeSpan.textContent = `Array[${value.length}]`;
      } else {
        typeSpan.textContent = `Object{${Object.keys(value).length}}`;
      }
      header.appendChild(typeSpan);
    } else {
      const valueSpan = document.createElement('span');
      valueSpan.className = `tree-value ${type}`;
      valueSpan.textContent = this.formatValue(value, type);
      header.appendChild(valueSpan);
    }

    node.appendChild(header);

    // Children container
    if (isExpandable) {
      const children = document.createElement('div');
      children.className = 'tree-children' + (isExpanded ? ' expanded' : '');

      if (isExpanded) {
        this.populateChildren(children, value, currentPathArray);
      }

      node.appendChild(children);
    }

    return node;
  }

  toggleNode(pathString, toggle, childrenContainer, value, pathArray) {
    if (this.expandedPaths.has(pathString)) {
      this.expandedPaths.delete(pathString);
      toggle.classList.remove('expanded');
      childrenContainer.classList.remove('expanded');
      childrenContainer.innerHTML = '';
    } else {
      this.expandedPaths.add(pathString);
      toggle.classList.add('expanded');
      childrenContainer.classList.add('expanded');
      this.populateChildren(childrenContainer, value, pathArray);
    }
  }

  populateChildren(container, value, parentPathArray) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        const childNode = this.createNode(item, index.toString(), parentPathArray);
        container.appendChild(childNode);
      });
    } else {
      Object.entries(value).forEach(([key, val]) => {
        const childNode = this.createNode(val, key, parentPathArray);
        container.appendChild(childNode);
      });
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

  formatValue(value, type) {
    switch (type) {
      case 'string':
        return `"${value}"`;
      case 'null':
        return 'null';
      case 'boolean':
        return value ? 'true' : 'false';
      default:
        return String(value);
    }
  }

  expandAll() {
    this.expandedPaths.clear();
    if (this.data) this.collectAllPaths(this.data, []);
    this.render();
  }

  collectAllPaths(value, currentPathArray) {
    const type = JsonUtils.getType(value);
    if (type === 'object' || type === 'array') {
      const pathString = JSON.stringify(currentPathArray);
      this.expandedPaths.add(pathString);
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          this.collectAllPaths(item, [...currentPathArray, index.toString()]);
        });
      } else {
        Object.entries(value).forEach(([key, val]) => {
          this.collectAllPaths(val, [...currentPathArray, key]);
        });
      }
    }
  }

  collapseAll() {
    this.expandedPaths.clear();
    this.render();
  }

  showContextMenu(x, y, data) {
    this.closeContextMenu();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const createItem = (label, icon, onClick, isDanger = false) => {
      const item = document.createElement('div');
      item.className = `context-menu-item ${isDanger ? 'danger' : ''}`;
      item.innerHTML = `<i data-lucide="${icon}" style="width: 14px; height: 14px;"></i> <span>${label}</span>`;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeContextMenu();
        onClick();
      });
      return item;
    };

    const createDivider = () => {
      const divider = document.createElement('div');
      divider.className = 'context-menu-divider';
      return divider;
    };

    const copyToClipboard = async (text, successMsg) => {
      try {
        await navigator.clipboard.writeText(text);
        if (window.App) App.showToast(successMsg, 'success');
      } catch (err) {
        if (window.App) App.showToast('Copy failed', 'error');
      }
    };

    // --- Menu Items ---
    
    // 1. Copy Key (if not root)
    if (data.key !== null && data.key !== undefined && data.key !== '') {
      menu.appendChild(createItem('Copy Key', 'copy', () => copyToClipboard(String(data.key), 'Key copied')));
    }
    
    // 2. Copy Value / Content
    const valueString = typeof data.value === 'object' ? JSON.stringify(data.value, null, 2) : String(data.value);
    const valueLabel = typeof data.value === 'object' ? 'Copy Content (JSON)' : 'Copy Value';
    menu.appendChild(createItem(valueLabel, 'copy', () => copyToClipboard(valueString, 'Content copied')));
    
    menu.appendChild(createDivider());

    // 3. Copy Paths
    menu.appendChild(createItem('Copy JS Path', 'code', () => copyToClipboard(data.jsPath, 'JS Path copied')));
    menu.appendChild(createItem('Copy JSON Pointer', 'link', () => copyToClipboard(data.jsonPointer, 'JSON Pointer copied')));

    menu.appendChild(createDivider());

    // 4. Extract (Replace content with extracted JSON)
    if (typeof data.value === 'object') {
      menu.appendChild(createItem('Extract (Replace content)', 'external-link', () => {
        if (window.App && this.container) {
          const editorPanel = this.container.closest('.editor-instance');
          if (editorPanel) {
             const instance = App.editors.find(e => e.wrapper === editorPanel);
             if (instance) {
               instance.setValue(valueString);
               App.showToast('Extracted JSON into editor', 'success');
             }
          }
        } else {
          copyToClipboard(valueString, 'Extracted content copied');
        }
      }));
    }

    // 5. Remove Node
    // Removing requires updating the actual JSON text and causing a re-render.
    // It's safest to mutate the parsed object and text editor if in sync, but here we can just delete from this.data and re-render.
    // However, to sync with Monaco text editor, we need to pass the updated JSON up.
    if (data.pathArray.length > 0) { // Don't remove root
       menu.appendChild(createItem('Remove Element', 'trash-2', () => {
         this.removeNodeAtPath(data.pathArray);
       }, true));
    }

    document.body.appendChild(menu);
    this.contextMenu = menu;

    if (window.lucide) {
      lucide.createIcons({ root: menu });
    }

    // Adjust position if it goes off screen
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = `${window.innerWidth - rect.width - 10}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${window.innerHeight - rect.height - 10}px`;
    }
  }

  closeContextMenu() {
    if (this.contextMenu && this.contextMenu.parentNode) {
      this.contextMenu.parentNode.removeChild(this.contextMenu);
    }
    this.contextMenu = null;
  }

  removeNodeAtPath(pathArray) {
    if (!pathArray || pathArray.length === 0) return;
    
    // Deep clone data to avoid direct mutation issues, or mutate directly
    // Let's mutate directly for simplicity
    let current = this.data;
    for (let i = 0; i < pathArray.length - 1; i++) {
      current = current[pathArray[i]];
    }
    
    const lastKey = pathArray[pathArray.length - 1];
    
    if (Array.isArray(current)) {
      current.splice(Number(lastKey), 1);
    } else {
      delete current[lastKey];
    }
    
    // Re-render tree
    this.render();
    
    // Sync with TextEditor if possible
    // We dispatch a custom event or check for global App
    if (window.App && this.container) {
      // Hacky way to find parent JsonEditor instance to update its text value
      const editorPanel = this.container.closest('.editor-instance');
      if (editorPanel) {
         // App.editors array holds instances
         const instance = App.editors.find(e => e.wrapper === editorPanel);
         if (instance) {
           instance.setValue(JSON.stringify(this.data, null, 2));
         }
      }
    }
  }

  clear() {
    this.data = null;
    this.expandedPaths.clear();
    this.container.innerHTML = '<p class="table-placeholder">No data to display</p>';
  }
}

// Export
window.TreeView = TreeView;
