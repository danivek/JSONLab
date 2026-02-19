/**
 * Query Utilities - JSONPath queries for JSON data
 */

const QueryUtils = {
  /**
   * Execute a query using the specified engine
   */
  query(data, path, engine = 'jsonpath') {
    if (!path || path === '$') {
      return data;
    }

    try {
      switch (engine) {
        case 'jmespath':
          if (window.jmespath) {
            return window.jmespath.search(data, path);
          }
          throw new Error('JMESPath library not loaded');

        case 'jsonpath':
          if (window.JSONPath) {
            // JSONPath Plus 10+ uses .JSONPath, older/other builds might use the global itself
            const jp = window.JSONPath.JSONPath || window.JSONPath;
            if (typeof jp === 'function') {
              return jp({ path, json: data });
            }
          }
          throw new Error('JSONPath Plus library not loaded');

        case 'jql':
          if (window.jsonquery) {
            return window.jsonquery(data, path);
          }
          throw new Error('JQL library not loaded');

        default:
          throw new Error(`Unsupported query engine: ${engine}`);
      }
    } catch (e) {
      throw new Error(`Query error (${engine}): ${e.message}`);
    }
  },
};

// Export for use in other modules
window.QueryUtils = QueryUtils;
