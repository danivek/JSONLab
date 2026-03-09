export default class SchemaController {
  constructor(app) {
    this.app = app;
    this.schemaEditorsInitialized = false;
    this.payloadEditor = null;
    this.schemaEditor = null;
    this.schemaAbortController = null;
  }

  async init() {
    if (this.schemaEditorsInitialized) return;

    const inputContainer = document.getElementById('schema-payload-container');
    const outputContainer = document.getElementById('schema-jsonschema-container');

    if (!inputContainer || !outputContainer) return;

    this.payloadEditor = new JsonEditor(inputContainer, 'schema-payload', 'text');
    this.schemaEditor = new JsonEditor(outputContainer, 'schema-jsonschema', 'text');

    await Promise.all([this.payloadEditor.ready, this.schemaEditor.ready]);

    // Remove example button from schema editors
    this.payloadEditor.primaryToolbar?.querySelector('.btn-example')?.remove();
    this.schemaEditor.primaryToolbar?.querySelector('.btn-example')?.remove();

    // Add "Generate" button to right (schema) side
    this.schemaEditor.addPrimaryButton({
      icon: 'wand-2',
      label: 'Generate Schema',
      className: 'btn-schema-generate',
      position: 'left',
      onClick: () => this.generateSchema(),
    });

    this.schemaEditorsInitialized = true;

    if (this.schemaAbortController) this.schemaAbortController.abort();
    this.schemaAbortController = new AbortController();
    const { signal } = this.schemaAbortController;

    this.bindEvents(signal);
    this.validatePayload();
  }

  bindEvents(signal) {
    const validate = () => this.validatePayload();

    this.schemaEditor.editor.onDidChangeModelContent(validate, null, signal);
    this.payloadEditor.editor.onDidChangeModelContent(validate, null, signal);

    // Resize handle for error panel
    const handle = document.getElementById('schema-resize-handle');
    const errorPanel = document.getElementById('schema-errors-container');
    const panel = document.getElementById('schema-panel');

    if (handle && errorPanel && panel && window.DomUtils) {
      DomUtils.setupResizer(
        handle,
        (e, initial) => {
          const delta = initial.startY - e.clientY;
          const panelHeight = panel.offsetHeight;
          const newHeight = Math.min(
            Math.max(40, initial.startHeight + delta),
            Math.floor(panelHeight * 0.8)
          );
          errorPanel.style.height = `${newHeight}px`;
          errorPanel.style.minHeight = `${newHeight}px`;
          this.payloadEditor.editor.layout();
          this.schemaEditor.editor.layout();
        },
        (mousedownEvent) => ({
          startY: mousedownEvent.clientY,
          startHeight: errorPanel.offsetHeight,
        }),
        signal
      );
    }

    // Splitter for schema panes
    const splitter = document.getElementById('schema-splitter');
    const container = document.getElementById('schema-editors-container');
    const inputContainer = document.getElementById('schema-payload-container');
    const outputContainer = document.getElementById('schema-jsonschema-container');

    if (splitter && container && inputContainer && outputContainer && window.DomUtils) {
      DomUtils.setupResizer(
        splitter,
        (e) => {
          const containerRect = container.getBoundingClientRect();
          const containerWidth = containerRect.width;
          const offset = e.clientX - containerRect.left;
          const percentage = Math.min(Math.max(10, (offset / containerWidth) * 100), 90);

          inputContainer.style.flex = `0 0 ${percentage}%`;
          outputContainer.style.flex = `1 1 0`;
          this.payloadEditor.editor.layout();
          this.schemaEditor.editor.layout();
        },
        null,
        signal
      );
    }
  }

  generateSchema() {
    try {
      const val = this.payloadEditor.getValue();
      const json = JSON.parse(val || '{}');
      if (window.SchemaUtils) {
        const schema = SchemaUtils.generateSchema(json);
        this.schemaEditor.setValue(JSON.stringify(schema, null, 2));
        this.app.showToast('Schema generated!', 'success');
      }
    } catch (e) {
      this.app.showToast('Invalid JSON payload: ' + e.message, 'error');
    }
  }

  validatePayload() {
    if (!this.payloadEditor || !this.schemaEditor) return;

    const schemaVal = this.schemaEditor.getValue();
    let schemaObj;
    try {
      schemaObj = JSON.parse(schemaVal || '{"type": "object"}');
    } catch {
      this.showSchemaErrors(['Invalid JSON Schema syntax']);
      return;
    }

    const modelUri = this.payloadEditor.editor.getModel().uri;
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      schemas: [{
        uri: 'http://myserver/schema.json',
        fileMatch: [modelUri.toString()],
        schema: schemaObj,
      }],
    });

    // Get markers after Monaco processes them
    clearTimeout(this.validationTimeout);
    this.validationTimeout = setTimeout(() => {
      const markers = monaco.editor.getModelMarkers({ resource: modelUri });
      this.showSchemaErrors(markers);
    }, 100);
  }

  showSchemaErrors(errors) {
    const errorList = document.getElementById('schema-errors-list');
    if (!errorList) return;

    if (!errors || errors.length === 0) {
      errorList.innerHTML = `<div class="schema-valid-msg"
                            style="color: var(--color-success); display: flex; align-items: center; gap: 8px;">
                            <i data-lucide="check-circle" style="width: 16px; height: 16px;"></i> Document is valid
                            against the schema.
                        </div>`;
      if (window.lucide) lucide.createIcons({ root: errorList });
    } else {
      errorList.innerHTML = '';
      errors.forEach((err) => {
        const isMarker = typeof err !== 'string';
        const div = document.createElement('div');
        div.className = `schema-error-item ${isMarker ? 'clickable' : ''}`;
        const iconName = isMarker ? 'circle-alert' : 'info';
        const message = isMarker ? `Line ${err.startLineNumber}: ${err.message}` : err;

        div.innerHTML = `
          <i data-lucide="${iconName}" class="schema-error-icon"></i>
          <span>${message}</span>
        `;

        if (isMarker) {
          div.onclick = () => {
            this.payloadEditor.editor.revealLineInCenter(err.startLineNumber);
            this.payloadEditor.editor.setPosition({
              lineNumber: err.startLineNumber,
              column: err.startColumn || 1,
            });
            this.payloadEditor.editor.focus();
          };
        }
        errorList.appendChild(div);
      });
      if (window.lucide) lucide.createIcons({ root: errorList });
    }
  }
}

window.SchemaController = SchemaController;
