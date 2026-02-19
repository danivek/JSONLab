/**
 * CSV Utilities - Convert between JSON and CSV formats
 */

const CsvUtils = {
  /**
   * Convert JSON array to CSV string
   */
  jsonToCsv(jsonData, delimiter = ',') {
    if (!Array.isArray(jsonData)) {
      throw new Error('JSON must be an array to convert to CSV');
    }

    if (jsonData.length === 0) {
      return '';
    }

    // Get all unique keys from all objects
    const allKeys = new Set();
    jsonData.forEach((item) => {
      if (typeof item === 'object' && item !== null) {
        Object.keys(item).forEach((key) => allKeys.add(key));
      }
    });

    const headers = Array.from(allKeys);

    // Create header row
    const headerRow = headers.map((h) => this.escapeCell(h, delimiter)).join(delimiter);

    // Create data rows
    const dataRows = jsonData.map((item) => {
      return headers
        .map((header) => {
          const value = item && item[header];
          return this.escapeCell(this.formatValue(value), delimiter);
        })
        .join(delimiter);
    });

    return [headerRow, ...dataRows].join('\n');
  },

  /**
   * Convert CSV string to JSON array
   */
  csvToJson(csvString, delimiter = ',') {
    const lines = this.parseCSVLines(csvString, delimiter);

    if (lines.length === 0) {
      return [];
    }

    const headers = lines[0];
    const result = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      if (row.length === 0 || (row.length === 1 && row[0] === '')) {
        continue; // Skip empty rows
      }

      const obj = {};
      headers.forEach((header, index) => {
        const value = row[index] || '';
        obj[header] = this.parseValue(value);
      });
      result.push(obj);
    }

    return result;
  },

  /**
   * Parse CSV string into array of arrays, handling quoted values
   */
  parseCSVLines(csvString, delimiter = ',') {
    const lines = [];
    let currentLine = [];
    let currentValue = '';
    let inQuotes = false;

    for (let i = 0; i < csvString.length; i++) {
      const char = csvString[i];
      const nextChar = csvString[i + 1];

      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            // Escaped quote
            currentValue += '"';
            i++;
          } else {
            // End of quoted value
            inQuotes = false;
          }
        } else {
          currentValue += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === delimiter) {
          currentLine.push(currentValue.trim());
          currentValue = '';
        } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
          currentLine.push(currentValue.trim());
          lines.push(currentLine);
          currentLine = [];
          currentValue = '';
          if (char === '\r') i++; // Skip \n in \r\n
        } else if (char !== '\r') {
          currentValue += char;
        }
      }
    }

    // Add last value and line
    if (currentValue || currentLine.length > 0) {
      currentLine.push(currentValue.trim());
      lines.push(currentLine);
    }

    return lines;
  },

  /**
   * Escape a cell value for CSV
   */
  escapeCell(value, delimiter = ',') {
    const str = String(value);

    // Check if escaping is needed
    if (str.includes('"') || str.includes(delimiter) || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }

    return str;
  },

  /**
   * Format a value for CSV output
   */
  formatValue(value) {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  },

  /**
   * Parse a string value to appropriate type
   */
  parseValue(value) {
    const trimmed = value.trim();

    // Empty string
    if (trimmed === '') {
      return '';
    }

    // null
    if (trimmed.toLowerCase() === 'null') {
      return null;
    }

    // Boolean
    if (trimmed.toLowerCase() === 'true') {
      return true;
    }
    if (trimmed.toLowerCase() === 'false') {
      return false;
    }

    // Number
    if (!isNaN(trimmed) && trimmed !== '') {
      const num = Number(trimmed);
      if (!isNaN(num)) {
        return num;
      }
    }

    // Try parsing as JSON (for nested objects/arrays)
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // Not valid JSON, return as string
      }
    }

    return trimmed;
  },

  /**
   * Detect CSV delimiter from content
   */
  detectDelimiter(csvString) {
    const delimiters = [',', ';', '\t', '|'];
    const firstLine = csvString.split('\n')[0];

    let maxCount = 0;
    let detected = ',';

    for (const delimiter of delimiters) {
      const count = (
        firstLine.match(new RegExp(delimiter === '\t' ? '\t' : `\\${delimiter}`, 'g')) || []
      ).length;
      if (count > maxCount) {
        maxCount = count;
        detected = delimiter;
      }
    }

    return detected;
  },
};

// Export for use in other modules
window.CsvUtils = CsvUtils;
