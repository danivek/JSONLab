/**
 * SchemaUtils - JSON Schema Generation
 */
export const SchemaUtils = {
  /**
   * Generates a basic JSON Schema (Draft 7) from a JSON object
   */
  generateSchema(jsonObj) {
    if (jsonObj === null) {
      return { type: 'null' };
    }
    
    if (Array.isArray(jsonObj)) {
      if (jsonObj.length === 0) {
        return { type: 'array', items: {} };
      }
      
      // Look at first item for type, or merge types of all items conceptually
      // We'll keep it simple and just use the first item to infer items schema
      return {
        type: 'array',
        items: this.generateSchema(jsonObj[0])
      };
    }
    
    if (typeof jsonObj === 'object') {
      const properties = {};
      const required = [];
      
      for (const key in jsonObj) {
        properties[key] = this.generateSchema(jsonObj[key]);
        required.push(key);
      }
      
      const schema = {
        type: 'object',
        properties
      };
      
      if (required.length > 0) {
        schema.required = required;
      }
      
      return schema;
    }
    
    if (typeof jsonObj === 'number') {
      return { type: Number.isInteger(jsonObj) ? 'integer' : 'number' };
    }
    
    if (typeof jsonObj === 'boolean') {
      return { type: 'boolean' };
    }
    
    if (typeof jsonObj === 'string') {
      return { type: 'string' };
    }
    
    return {};
  }
};

window.SchemaUtils = SchemaUtils;
