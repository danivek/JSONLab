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

  init() {}

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

  clear() {
    this.data = null;
    this.expandedPaths.clear();
    this.container.innerHTML = '<p class="table-placeholder">No data to display</p>';
  }
}

// Export
window.TreeView = TreeView;
