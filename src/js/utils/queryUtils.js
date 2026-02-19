/**
 * Query Utilities - JSONPath queries for JSON data
 */

const QueryUtils = {
  /**
   * Execute a JSONPath query on JSON data
   * Supports a subset of JSONPath syntax:
   * - $ : root object
   * - .key : child key
   * - [n] : array index
   * - [*] : all array elements
   * - ..key : recursive descent
   * - [start:end] : array slice
   */
  query(data, path) {
    if (!path || path === '$') {
      return [data];
    }

    try {
      const tokens = this.tokenize(path);
      return this.evaluate(data, tokens);
    } catch (e) {
      throw new Error(`Invalid JSONPath: ${e.message}`);
    }
  },

  /**
   * Tokenize JSONPath expression
   */
  tokenize(path) {
    const tokens = [];
    let i = 0;

    // Skip initial $
    if (path[0] === '$') {
      i = 1;
    }

    while (i < path.length) {
      const char = path[i];

      if (char === '.') {
        i++;
        if (path[i] === '.') {
          // Recursive descent
          i++;
          const key = this.readKey(path, i);
          tokens.push({ type: 'recursive', key: key.value });
          i = key.end;
        } else if (path[i] === '*') {
          tokens.push({ type: 'wildcard' });
          i++;
        } else {
          // Regular key
          const key = this.readKey(path, i);
          tokens.push({ type: 'key', key: key.value });
          i = key.end;
        }
      } else if (char === '[') {
        i++;
        const bracket = this.readBracket(path, i);
        tokens.push(bracket.token);
        i = bracket.end;
      } else {
        // Read as key
        const key = this.readKey(path, i);
        if (key.value) {
          tokens.push({ type: 'key', key: key.value });
        }
        i = key.end;
      }
    }

    return tokens;
  },

  /**
   * Read a key from the path
   */
  readKey(path, start) {
    let value = '';
    let i = start;

    while (i < path.length && path[i] !== '.' && path[i] !== '[') {
      value += path[i];
      i++;
    }

    return { value, end: i };
  },

  /**
   * Read bracket expression
   */
  readBracket(path, start) {
    let content = '';
    let i = start;

    while (i < path.length && path[i] !== ']') {
      content += path[i];
      i++;
    }

    i++; // Skip closing bracket

    // Parse bracket content
    if (content === '*') {
      return { token: { type: 'wildcard' }, end: i };
    } else if (content.includes(':')) {
      // Slice
      const parts = content.split(':').map((p) => (p.trim() === '' ? null : parseInt(p)));
      return { token: { type: 'slice', start: parts[0], end: parts[1] }, end: i };
    } else if (content.startsWith("'") || content.startsWith('"')) {
      // Quoted key
      const key = content.slice(1, -1);
      return { token: { type: 'key', key }, end: i };
    } else if (!isNaN(content)) {
      // Index
      return { token: { type: 'index', index: parseInt(content) }, end: i };
    } else {
      // Key
      return { token: { type: 'key', key: content }, end: i };
    }
  },

  /**
   * Evaluate tokens against data
   */
  evaluate(data, tokens) {
    let results = [data];

    for (const token of tokens) {
      const newResults = [];

      for (const item of results) {
        switch (token.type) {
          case 'key':
            if (item && typeof item === 'object' && token.key in item) {
              newResults.push(item[token.key]);
            }
            break;

          case 'index':
            if (Array.isArray(item) && token.index < item.length) {
              const idx = token.index < 0 ? item.length + token.index : token.index;
              if (idx >= 0 && idx < item.length) {
                newResults.push(item[idx]);
              }
            }
            break;

          case 'wildcard':
            if (Array.isArray(item)) {
              newResults.push(...item);
            } else if (item && typeof item === 'object') {
              newResults.push(...Object.values(item));
            }
            break;

          case 'slice':
            if (Array.isArray(item)) {
              const start = token.start ?? 0;
              const end = token.end ?? item.length;
              newResults.push(...item.slice(start, end));
            }
            break;

          case 'recursive':
            newResults.push(...this.recursiveSearch(item, token.key));
            break;
        }
      }

      results = newResults;
    }

    return results;
  },

  /**
   * Recursively search for a key in nested structures
   */
  recursiveSearch(data, key) {
    const results = [];

    const search = (obj) => {
      if (obj && typeof obj === 'object') {
        if (Array.isArray(obj)) {
          for (const item of obj) {
            search(item);
          }
        } else {
          if (key in obj) {
            results.push(obj[key]);
          }
          for (const v of Object.values(obj)) {
            search(v);
          }
        }
      }
    };

    search(data);
    return results;
  },

  /**
   * Get suggestions for JSONPath completion
   */
  getSuggestions(data, partialPath) {
    const suggestions = [];

    try {
      // Get the parent path
      const lastDot = Math.max(partialPath.lastIndexOf('.'), partialPath.lastIndexOf('['));
      const parentPath = lastDot > 0 ? partialPath.substring(0, lastDot) : '$';

      const results = this.query(data, parentPath);

      for (const result of results) {
        if (result && typeof result === 'object') {
          if (Array.isArray(result)) {
            suggestions.push('[0]', '[*]');
          } else {
            for (const key of Object.keys(result)) {
              suggestions.push(`.${key}`);
            }
          }
        }
      }
    } catch {
      // Ignore errors during suggestion
    }

    return [...new Set(suggestions)].slice(0, 20);
  },
};

// Export for use in other modules
window.QueryUtils = QueryUtils;
