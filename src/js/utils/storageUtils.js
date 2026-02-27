/**
 * StorageUtils - Helper for localStorage and IndexedDB interaction
 */
const StorageUtils = {
    DB_NAME: 'JSONLab_DB',
    DB_VERSION: 1,
    STORE_NAME: 'workspace_content',
    
    KEYS: {
        WORKSPACE_CONTENT: 'jsonlab_workspace_content_', // + editorId
        WORKSPACE_MODE: 'jsonlab_workspace_mode_', // + editorId
        WORKSPACE_AUTOFORMAT: 'jsonlab_workspace_autoformat_', // + editorId
        GLOBAL_VIEW_MODE: 'jsonlab_global_view_mode',
        APP_THEME: 'jsonlab_theme'
    },

    // --- LocalStorage (Sync) for lightweight settings ---
    save(key, value) {
        try {
            const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
            localStorage.setItem(key, stringValue);
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
        }
    },

    load(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);
            if (value === null) return defaultValue;
            return value;
        } catch (e) {
            console.error('Failed to load from localStorage:', e);
            return defaultValue;
        }
    },

    // --- IndexedDB (Async) for large content ---
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    db.createObjectStore(this.STORE_NAME);
                }
            };
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async saveToIndexedDB(key, value) {
        try {
            const db = await this.initDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.STORE_NAME], 'readwrite');
                const store = transaction.objectStore(this.STORE_NAME);
                const request = store.put(value, key);
                
                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(request.error);
            });
        } catch (e) {
            console.error('Failed to save to IndexedDB:', e);
            return false;
        }
    },

    async loadFromIndexedDB(key, defaultValue = null) {
        try {
            const db = await this.initDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.STORE_NAME], 'readonly');
                const store = transaction.objectStore(this.STORE_NAME);
                const request = store.get(key);
                
                request.onsuccess = () => {
                    const value = request.result;
                    resolve(value !== undefined ? value : defaultValue);
                };
                request.onerror = () => reject(request.error);
            });
        } catch (e) {
            console.error('Failed to load from IndexedDB:', e);
            return defaultValue;
        }
    }
};

window.StorageUtils = StorageUtils;
