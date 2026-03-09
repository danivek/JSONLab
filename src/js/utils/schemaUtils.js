/**
 * SchemaUtils - Utility functions for JSON Schema generation and validation
 */

const SchemaUtils = {
    /**
     * Infer JSON Schema from a plain JSON object or value
     * @param {*} data 
     * @returns {Object} JSON Schema
     */
    generateSchema(data) {
        if (data === null) {
            return { type: "null" };
        }

        const type = typeof data;

        if (type === "string") {
            return { type: "string" };
        }

        if (type === "number") {
            return { type: Number.isInteger(data) ? "integer" : "number" };
        }

        if (type === "boolean") {
            return { type: "boolean" };
        }

        if (Array.isArray(data)) {
            if (data.length === 0) {
                return { type: "array" };
            }
            // Infer type from first element for simplicity, or we could unify types
            // A more advanced generator would merge all item schemas
            const itemSchemas = data.map(item => this.generateSchema(item));
            const unifiedItems = this._unifySchemas(itemSchemas);
            
            return { 
                type: "array", 
                items: unifiedItems || {} 
            };
        }

        if (type === "object") {
            const properties = {};
            const required = [];
            
            for (const key in data) {
                if (Object.prototype.hasOwnProperty.call(data, key)) {
                    properties[key] = this.generateSchema(data[key]);
                    // Mark all inferred properties as required by default, user can edit
                    required.push(key);
                }
            }

            const schema = {
                type: "object",
                properties: properties
            };

            if (required.length > 0) {
                schema.required = required;
            }

            return schema;
        }

        return {};
    },

    /**
     * Unifies an array of schemas into a single schema
     * (Basic implementation: uses the first schema, unless they differ vastly)
     */
    _unifySchemas(schemas) {
        if (!schemas || schemas.length === 0) return {};
        
        // Very simplistic unification: Just return the first one's type
        // A better approach would be to check if all types match, else use `anyOf`
        const first = schemas[0];
        let allSameType = true;
        for (let i = 1; i < schemas.length; i++) {
            if (schemas[i].type !== first.type) {
                allSameType = false;
                break;
            }
        }

        if (allSameType && first.type === "object") {
            // Unify properties
            const mergedProperties = {};
            const requiredCounts = {};
            schemas.forEach(schema => {
                if (schema.properties) {
                    Object.keys(schema.properties).forEach(key => {
                        if (!mergedProperties[key]) {
                            mergedProperties[key] = [];
                        }
                        mergedProperties[key].push(schema.properties[key]);
                        requiredCounts[key] = (requiredCounts[key] || 0) + 1;
                    });
                }
            });

            const finalProperties = {};
            const finalRequired = [];
            Object.keys(mergedProperties).forEach(key => {
                finalProperties[key] = this._unifySchemas(mergedProperties[key]);
                if (requiredCounts[key] === schemas.length) {
                    finalRequired.push(key);
                }
            });
            
            const result = { type: "object", properties: finalProperties };
            if (finalRequired.length > 0) {
                result.required = finalRequired;
            }
            return result;
        }

        if (allSameType) {
            return first;
        }

        // If types differ, use anyOf
        // deduplicate types
        const uniqueSchemas = [];
        const seenTypes = new Set();
        for (const s of schemas) {
            const stringified = JSON.stringify(s);
            if (!seenTypes.has(stringified)) {
                seenTypes.add(stringified);
                uniqueSchemas.push(s);
            }
        }

        return { anyOf: uniqueSchemas };
    }
};

window.SchemaUtils = SchemaUtils;
