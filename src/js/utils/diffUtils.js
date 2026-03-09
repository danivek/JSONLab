/**
 * Diff Utilities - Compare JSON objects and generate diffs
 */

const DiffUtils = {
  /**
   * Compare two JSON objects and return differences
   */
  compare(obj1, obj2) {
    const diffs = [];
    this.compareRecursive(obj1, obj2, '', diffs);
    return diffs;
  },

  /**
   * Generate RFC 6902 JSON Patch array using fast-json-patch
   */
  generateJsonPatch(obj1, obj2) {
    if (window.jsonpatch && window.jsonpatch.compare) {
      return window.jsonpatch.compare(obj1, obj2);
    }
    console.warn('fast-json-patch library not loaded.');
    return [];
  },

  /**
   * Recursive comparison
   */
  compareRecursive(obj1, obj2, path, diffs) {
    // Handle null/undefined
    if (obj1 === null || obj1 === undefined) {
      if (obj2 !== null && obj2 !== undefined) {
        diffs.push({ type: 'added', path, value: obj2 });
      }
      return;
    }

    if (obj2 === null || obj2 === undefined) {
      diffs.push({ type: 'removed', path, value: obj1 });
      return;
    }

    // Different types
    if (typeof obj1 !== typeof obj2) {
      diffs.push({ type: 'modified', path, oldValue: obj1, newValue: obj2 });
      return;
    }

    // Array vs non-array
    if (Array.isArray(obj1) !== Array.isArray(obj2)) {
      diffs.push({ type: 'modified', path, oldValue: obj1, newValue: obj2 });
      return;
    }

    // Primitives
    if (typeof obj1 !== 'object') {
      if (obj1 !== obj2) {
        diffs.push({ type: 'modified', path, oldValue: obj1, newValue: obj2 });
      }
      return;
    }

    // Arrays
    if (Array.isArray(obj1)) {
      const maxLen = Math.max(obj1.length, obj2.length);
      for (let i = 0; i < maxLen; i++) {
        const newPath = path ? `${path}[${i}]` : `[${i}]`;
        if (i >= obj1.length) {
          diffs.push({ type: 'added', path: newPath, value: obj2[i] });
        } else if (i >= obj2.length) {
          diffs.push({ type: 'removed', path: newPath, value: obj1[i] });
        } else {
          this.compareRecursive(obj1[i], obj2[i], newPath, diffs);
        }
      }
      return;
    }

    // Objects
    const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

    for (const key of allKeys) {
      const newPath = path ? `${path}.${key}` : key;

      if (!(key in obj1)) {
        diffs.push({ type: 'added', path: newPath, value: obj2[key] });
      } else if (!(key in obj2)) {
        diffs.push({ type: 'removed', path: newPath, value: obj1[key] });
      } else {
        this.compareRecursive(obj1[key], obj2[key], newPath, diffs);
      }
    }
  },

  /**
   * Format diffs as human-readable text
   */
  formatDiffs(diffs) {
    if (diffs.length === 0) {
      return 'No differences found.';
    }

    return diffs
      .map((diff) => {
        const path = diff.path || '(root)';

        switch (diff.type) {
          case 'added':
            return `+ ${path}: ${this.formatValue(diff.value)}`;
          case 'removed':
            return `- ${path}: ${this.formatValue(diff.value)}`;
          case 'modified':
            return `~ ${path}: ${this.formatValue(diff.oldValue)} → ${this.formatValue(diff.newValue)}`;
          default:
            return '';
        }
      })
      .join('\n');
  },

  /**
   * Format diffs as HTML
   */
  formatDiffsHtml(diffs) {
    if (diffs.length === 0) {
      return '<p style="color: var(--color-success);">✓ No differences found.</p>';
    }

    return diffs
      .map((diff) => {
        const path = this.escapeHtml(diff.path || '(root)');

        switch (diff.type) {
          case 'added':
            return `<div class="diff-added">+ ${path}: ${this.escapeHtml(this.formatValue(diff.value))}</div>`;
          case 'removed':
            return `<div class="diff-removed">- ${path}: ${this.escapeHtml(this.formatValue(diff.value))}</div>`;
          case 'modified':
            return `<div class="diff-modified">~ ${path}: <span class="diff-removed">${this.escapeHtml(this.formatValue(diff.oldValue))}</span> → <span class="diff-added">${this.escapeHtml(this.formatValue(diff.newValue))}</span></div>`;
          default:
            return '';
        }
      })
      .join('\n');
  },

  /**
   * Format a value for display
   */
  formatValue(value) {
    if (typeof value === 'string') {
      return `"${value}"`;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  },

  /**
   * Escape HTML special characters
   */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

};

// Export for use in other modules
window.DiffUtils = DiffUtils;
