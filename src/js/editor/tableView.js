/**
 * Table View - Spreadsheet-style view for arrays of objects
 */

const TableView = {
  container: null,
  data: null,

  /**
   * Initialize table view
   */
  init() {
    this.container = document.getElementById('table-view');
  },

  /**
   * Render JSON data as table
   */
  render(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      this.data = data;

      // Check if data is suitable for table view
      if (!Array.isArray(data)) {
        // If it's an object, check if any property is an array
        if (typeof data === 'object' && data !== null) {
          const arrayProp = Object.entries(data).find(([, v]) => Array.isArray(v) && v.length > 0);
          if (arrayProp) {
            this.renderTable(arrayProp[1], arrayProp[0]);
            return;
          }
        }
        this.container.innerHTML =
          '<p class="table-placeholder">Table view works best with arrays of objects. Switch to Tree view for this data.</p>';
        return;
      }

      if (data.length === 0) {
        this.container.innerHTML = '<p class="table-placeholder">Empty array</p>';
        return;
      }

      this.renderTable(data);
    } catch (e) {
      this.container.innerHTML = `<p class="error" style="color: var(--color-error);">Invalid JSON: ${e.message}</p>`;
    }
  },

  /**
   * Render array as HTML table
   */
  renderTable(data, title = null) {
    // Get all unique keys from all objects
    const allKeys = new Set();
    data.forEach((item) => {
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        Object.keys(item).forEach((key) => allKeys.add(key));
      }
    });

    const keys = Array.from(allKeys);

    if (keys.length === 0) {
      // Array of primitives
      this.renderPrimitiveArray(data);
      return;
    }

    let html = '';

    if (title) {
      html += `<h3 style="margin-bottom: var(--space-md); color: var(--color-text-secondary);">${title}</h3>`;
    }

    html += '<table class="json-table">';

    // Header row
    html += '<thead><tr>';
    html += '<th>#</th>';
    keys.forEach((key) => {
      html += `<th>${this.escapeHtml(key)}</th>`;
    });
    html += '</tr></thead>';

    // Data rows
    html += '<tbody>';
    data.forEach((item, index) => {
      html += '<tr>';
      html += `<td>${index}</td>`;
      keys.forEach((key) => {
        const value = item && item[key];
        html += `<td title="${this.escapeHtml(this.formatTooltip(value))}">${this.formatCell(value)}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';

    this.container.innerHTML = html;
  },

  /**
   * Render array of primitives
   */
  renderPrimitiveArray(data) {
    let html = '<table class="json-table">';
    html += '<thead><tr><th>#</th><th>Value</th></tr></thead>';
    html += '<tbody>';

    data.forEach((item, index) => {
      html += `<tr><td>${index}</td><td>${this.formatCell(item)}</td></tr>`;
    });

    html += '</tbody></table>';
    this.container.innerHTML = html;
  },

  /**
   * Format cell value for display
   */
  formatCell(value) {
    if (value === null) {
      return '<span style="color: var(--json-null); font-style: italic;">null</span>';
    }
    if (value === undefined) {
      return '<span style="color: var(--color-text-muted);">-</span>';
    }

    const type = typeof value;

    if (type === 'boolean') {
      return `<span style="color: var(--json-boolean);">${value}</span>`;
    }
    if (type === 'number') {
      return `<span style="color: var(--json-number);">${value}</span>`;
    }
    if (type === 'string') {
      const escaped = this.escapeHtml(value);
      if (value.length > 50) {
        return `<span style="color: var(--json-string);">"${escaped.substring(0, 50)}..."</span>`;
      }
      return `<span style="color: var(--json-string);">"${escaped}"</span>`;
    }
    if (Array.isArray(value)) {
      return `<span style="color: var(--color-text-muted);">Array[${value.length}]</span>`;
    }
    if (type === 'object') {
      return `<span style="color: var(--color-text-muted);">Object{${Object.keys(value).length}}</span>`;
    }

    return this.escapeHtml(String(value));
  },

  /**
   * Format tooltip for cell
   */
  formatTooltip(value) {
    if (value === null || value === undefined) {
      return String(value);
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  },

  /**
   * Escape HTML special characters
   */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  },

  /**
   * Clear the table view
   */
  clear() {
    this.data = null;
    this.container.innerHTML =
      '<p class="table-placeholder">Table view works best with arrays of objects</p>';
  },
};

// Export for use in other modules
window.TableView = TableView;
