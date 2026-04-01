// Single entry point — imports all modules in dependency order.
// Each module registers itself on window.* so they can reference each other.

// External libraries — replaces CDN script tags

// Monaco: use ESM entry point to tree-shake — only editor core + JSON language
// (avoids bundling TS/HTML/CSS workers which add ~9MB)
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') return new JsonWorker();
    return new EditorWorker();
  },
};
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/language/json/monaco.contribution';
import { createIcons, icons } from 'lucide';
import { jsonrepair } from 'jsonrepair';
import jmespath from 'jmespath';
import { JSONPath } from 'jsonpath-plus';
import { jsonquery } from '@jsonquerylang/jsonquery';
import * as jsonpatch from 'fast-json-patch';

window.monaco = monaco;
window.lucide = { createIcons: (opts = {}) => createIcons({ icons, ...opts }) };
window.JSONRepair = { jsonrepair };
window.jmespath = jmespath;
window.JSONPath = { JSONPath };
window.jsonquery = jsonquery;
window.jsonpatch = jsonpatch;
import './utils/storageUtils.js';
import './utils/domUtils.js';
import './utils/jsonUtils.js';
import './utils/csvUtils.js';
import './utils/diffUtils.js';
import './utils/queryUtils.js';
import './utils/shareUtils.js';
import './utils/schemaUtils.js';
import './app/CompareController.js';
import './app/QueryController.js';
import './app/SchemaController.js';
import './editor/textEditor.js';
import './editor/treeView.js';
import './editor/tableView.js';
import './ui/theme.js';
import './ui/modal.js';
import './ui/editorToolbar.js';
import './editor/jsonEditor.js';
import './app.js';
