/**
 * JSON Utilities - Core operations for JSON manipulation
 */

const JsonUtils = {
  /**
   * Format/beautify JSON with proper indentation
   */
  format(jsonString, spaces = 2) {
    try {
      const parsed = JSON.parse(jsonString);
      return JSON.stringify(parsed, null, spaces);
    } catch (e) {
      throw new Error(`Format error: ${e.message}`);
    }
  },

  /**
   * Compact JSON by removing whitespace
   */
  compact(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      return JSON.stringify(parsed);
    } catch (e) {
      throw new Error(`Compact error: ${e.message}`);
    }
  },

  /**
   * Validate JSON and return validation result
   */
  validate(jsonString) {
    try {
      JSON.parse(jsonString);
      return { valid: true, error: null };
    } catch (e) {
      // Try to extract line number from error
      const match = e.message.match(/position (\d+)/);
      let line = null;
      if (match) {
        const pos = parseInt(match[1]);
        line = jsonString.substring(0, pos).split('\n').length;
      }
      return {
        valid: false,
        error: e.message,
        line: line,
      };
    }
  },

  /**
   * Repair common JSON issues using jsonrepair library
   * @see https://github.com/josdejong/jsonrepair
   */
  repair(jsonString) {
    try {
      // Use the jsonrepair library (loaded from CDN)
      // Global is exposed as JSONRepair.jsonrepair
      return JSONRepair.jsonrepair(jsonString);
    } catch (e) {
      throw new Error(`Could not repair JSON: ${e.message}`);
    }
  },

  /**
   * Parse JSON safely, returning null on error
   */
  safeParse(jsonString) {
    try {
      return JSON.parse(jsonString);
    } catch {
      return null;
    }
  },

  /**
   * Get type of JSON value
   */
  getType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  },

  /**
   * Get size info for JSON
   */
  getSize(jsonString) {
    const bytes = new Blob([jsonString]).size;
    const lines = jsonString.split('\n').length;

    let sizeStr;
    if (bytes < 1024) {
      sizeStr = `${bytes} bytes`;
    } else if (bytes < 1024 * 1024) {
      sizeStr = `${(bytes / 1024).toFixed(1)} KB`;
    } else {
      sizeStr = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    return { bytes, lines, sizeStr };
  },

  /**
   * Deep clone a JSON object
   */
  clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },


  /**
   * Get JSON path at the specific character offset (for Monaco cursor position).
   */
  getPathAtOffset(jsonString, offset) {
    if (!jsonString || offset < 0) return null;
    if (offset >= jsonString.length) offset = jsonString.length - 1;

    // Simple tokenizer state machine
    let pos = 0;
    let path = []; // Array of keys/indices
    let inString = false;
    let stringStart = -1;
    let isKey = false; // Next string is a key?
    let stack = []; // Stack of contexts: { type: 'object'|'array', count: 0 }
    let lastKey = null;

    // Helper to check if we are at target offset
    const checkOffset = () => pos >= offset;

    while (pos < jsonString.length) {
      const char = jsonString[pos];

      if (inString) {
        if (char === '"') {
          // Count preceding backslashes to handle escaped quotes properly (e.g., \\" is a literal quote, but \\\\" is an escaped backslash followed by a literal quote?) 
          // Actually in JSON, \" is escaped quote. \\ is escaped backslash.
          // So we need to know if the quote is preceded by an ODD number of backslashes.
          let backslashes = 0;
          let p = pos - 1;
          while (p >= 0 && jsonString[p] === '\\') {
            backslashes++;
            p--;
          }

          if (backslashes % 2 === 0) {
            inString = false;
            const val = jsonString.substring(stringStart + 1, pos);

            if (isKey) {
              lastKey = val;
              isKey = false;
            }

            if (checkOffset()) {
              break;
            }
          }
        }
      } else {
        if (checkOffset()) break;

        if (char === '"') {
          inString = true;
          stringStart = pos;
        } else if (char === '{') {
          // Start object
          if (stack.length > 0) {
            const parent = stack[stack.length - 1];
            if (parent.type === 'array') {
              path.push(parent.count);
            } else if (parent.type === 'object' && lastKey !== null) {
              path.push(lastKey);
              lastKey = null;
            }
          }
          stack.push({ type: 'object', count: 0 });
          isKey = true; // Expect key next
        } else if (char === '[') {
          // Start array
          if (stack.length > 0) {
            const parent = stack[stack.length - 1];
            if (parent.type === 'array') {
              path.push(parent.count);
            } else if (parent.type === 'object' && lastKey !== null) {
              path.push(lastKey);
              lastKey = null;
            }
          }
          stack.push({ type: 'array', count: 0 });
        } else if (char === '}') {
          // End object
          if (stack.length > 0) {
            stack.pop();
            path.pop(); // Pop the key that led to this object
          }
        } else if (char === ']') {
          // End array
          if (stack.length > 0) {
            stack.pop();
            path.pop(); // Pop the index that led to this array
          }
        } else if (char === ':') {
          // Colon: key just finished
          // isKey was true, but set to false by string end
        } else if (char === ',') {
          // Comma: next item
          if (stack.length > 0) {
            const current = stack[stack.length - 1];
            if (current.type === 'array') {
              current.count++;
            } else if (current.type === 'object') {
              isKey = true; // Next string is key
              lastKey = null;
            }
          }
        }
      }
      pos++;
    }

    // Finalize path based on current state at break
    if (stack.length > 0) {
      const current = stack[stack.length - 1];
      if (current.type === 'array') {
        path.push(current.count);
      } else if (current.type === 'object') {
        if (lastKey !== null) {
          path.push(lastKey);
        }
      }
    }

    return path;
  },

  /**
   * Sort object keys alphabetically (deep)
   */
  sortKeys(obj, descending = false) {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.sortKeys(item, descending));
    }

    if (typeof obj === 'object' && obj !== null) {
      const sorted = {};
      Object.keys(obj)
        .sort((a, b) => {
          if (descending) {
            return b.localeCompare(a);
          }
          return a.localeCompare(b);
        })
        .forEach((key) => {
          sorted[key] = this.sortKeys(obj[key], descending);
        });
      return sorted;
    }

    return obj;
  },
};

// Export for use in other modules
window.JsonUtils = JsonUtils;
