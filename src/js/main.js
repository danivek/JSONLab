// Single entry point — imports all modules in dependency order.
// Each module registers itself on window.* so they can reference each other.
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
