export default class QueryController {
  constructor(app) {
    this.app = app;
    this.queryInputEditor = null;
    this.queryOutputEditor = null;
    this.queryAbortController = null;
  }

  init() {
    const queryInput = document.getElementById('query-input');
    if (!queryInput) return;

    queryInput.focus();

    if (!this.queryInputEditor || !this.queryOutputEditor) {
      const inputContainer = document.getElementById('query-editor-input');
      const outputContainer = document.getElementById('query-editor-output');

      if (inputContainer && outputContainer) {
        this.queryInputEditor = monaco.editor.create(inputContainer, {
          language: 'json',
          theme: Theme.getMonacoTheme(),
          readOnly: true,
          automaticLayout: true,
          minimap: { enabled: false },
        });

        this.queryOutputEditor = monaco.editor.create(outputContainer, {
          language: 'json',
          theme: Theme.getMonacoTheme(),
          readOnly: true,
          automaticLayout: true,
          minimap: { enabled: false },
        });
      }
    }

    // Load initial content from active editor
    if (this.queryInputEditor) {
      this.queryInputEditor.setValue(this.app.editors[0].getValue());
    }

    if (this.queryAbortController) this.queryAbortController.abort();
    this.queryAbortController = new AbortController();
    const { signal } = this.queryAbortController;

    this.bindEvents(signal);
    this.runQuery();
  }

  bindEvents(signal) {
    const queryInput = document.getElementById('query-input');
    const queryEngineRadios = document.getElementsByName('query-engine');
    const btnApply = document.getElementById('btn-query-apply');

    if (queryInput) {
      let debounceTimer;
      queryInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => this.runQuery(), 300);
      }, { signal });
    }

    queryEngineRadios.forEach((radio) => {
      radio.addEventListener('change', () => this.runQuery(), { signal });
    });

    if (btnApply) {
      btnApply.addEventListener('click', () => this.applyQueryResult(), { signal });
    }
  }

  runQuery() {
    const query = document.getElementById('query-input')?.value;
    const engine = document.querySelector('input[name="query-engine"]:checked')?.value || 'jsonpath';
    const inputJson = this.queryInputEditor?.getValue();

    if (!query || !inputJson) {
      this.queryOutputEditor?.setValue('');
      return;
    }

    try {
      const data = JSON.parse(inputJson);
      let result;

      if (window.QueryUtils) {
        result = QueryUtils.query(data, query, engine);
        this.queryOutputEditor?.setValue(JSON.stringify(result, null, 2));
      }
    } catch (e) {
      this.queryOutputEditor?.setValue(`Error: ${e.message}`);
    }
  }

  applyQueryResult() {
    const resultStr = this.queryOutputEditor?.getValue();
    if (!resultStr || resultStr.startsWith('Error:')) {
      this.app.showToast('Invalid query result to apply', 'error');
      return;
    }

    try {
      JSON.parse(resultStr);
      if (this.app.editors[0]) {
        this.app.editors[0].setValue(resultStr);
        this.app.showToast('Query result applied to editor', 'success');
      }
    } catch {
      this.app.showToast('Result is not valid JSON', 'error');
    }
  }
}

window.QueryController = QueryController;
