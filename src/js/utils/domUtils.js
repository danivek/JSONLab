/**
 * DOM Utilities - Reusable DOM manipulation helpers
 */
const DomUtils = {
  /**
   * Universal Resizer Helper
   * @param {HTMLElement} handle - The element to drag
   * @param {Function} onMove - Callback (event, initialData)
   * @param {Function} getInitialData - Callback to capture state on mousedown
   * @param {AbortSignal} signal - Optional signal for cleanup
   */
  setupResizer(handle, onMove, getInitialData, signal) {
    if (!handle) return;

    handle.addEventListener(
      'mousedown',
      (e) => {
        e.preventDefault();
        handle.classList.add('dragging');
        document.body.classList.add('resizing');

        // Allow caller to define what "initial" data they need
        const initial = getInitialData ? getInitialData(e) : { startX: e.clientX, startY: e.clientY };

        const moveHandler = (moveEvent) => {
          onMove(moveEvent, initial);
        };

        const upHandler = () => {
          handle.classList.remove('dragging');
          document.body.classList.remove('resizing');
          document.removeEventListener('mousemove', moveHandler);
          document.removeEventListener('mouseup', upHandler);
        };

        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', upHandler);
      },
      { signal }
    );
  },

  /**
   * Create a DOM element with attributes and children
   * @param {string} tag
   * @param {Object} attrs
   * @param {Array} children
   */
  createElement(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'className') el.className = value;
      else if (key === 'style' && typeof value === 'object') {
        Object.assign(el.style, value);
      } else el.setAttribute(key, value);
    }
    children.forEach((child) => {
      if (typeof child === 'string') el.appendChild(document.createTextNode(child));
      else if (child instanceof HTMLElement) el.appendChild(child);
    });
    return el;
  },
};

window.DomUtils = DomUtils;
export default DomUtils;
