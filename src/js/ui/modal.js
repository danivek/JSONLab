/**
 * Modal Manager - Handle modal dialogs
 */

const Modal = {
  activeModal: null,

  /**
   * Show a modal by ID
   */
  show(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('hidden');
      this.activeModal = modal;

      // Focus first input
      const input = modal.querySelector('input');
      if (input) {
        setTimeout(() => input.focus(), 100);
      }

      // Close on backdrop click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.hide(modalId);
        }
      });

      // Close on Escape key
      document.addEventListener('keydown', this.escapeHandler);
    }
  },

  /**
   * Hide a modal by ID
   */
  hide(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
      this.activeModal = null;
      document.removeEventListener('keydown', this.escapeHandler);
    }
  },

  /**
   * Escape key handler
   */
  escapeHandler(e) {
    if (e.key === 'Escape' && Modal.activeModal) {
      Modal.hide(Modal.activeModal.id);
    }
  },

  /**
   * Create and show a custom alert/confirm modal
   */
  alert(message, title = 'Alert') {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `
                <div class="modal-content">
                    <h2>${title}</h2>
                    <p>${message}</p>
                    <div class="modal-actions">
                        <button class="btn btn-primary" id="alert-ok">OK</button>
                    </div>
                </div>
            `;
      document.body.appendChild(modal);

      modal.querySelector('#alert-ok').addEventListener('click', () => {
        modal.remove();
        resolve();
      });

      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
          resolve();
        }
      });
    });
  },

  /**
   * Show confirm dialog
   */
  confirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `
                <div class="modal-content">
                    <h2>${title}</h2>
                    <p>${message}</p>
                    <div class="modal-actions">
                        <button class="btn btn-secondary" id="confirm-cancel">Cancel</button>
                        <button class="btn btn-primary" id="confirm-ok">OK</button>
                    </div>
                </div>
            `;
      document.body.appendChild(modal);

      modal.querySelector('#confirm-ok').addEventListener('click', () => {
        modal.remove();
        resolve(true);
      });

      modal.querySelector('#confirm-cancel').addEventListener('click', () => {
        modal.remove();
        resolve(false);
      });

      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
          resolve(false);
        }
      });
    });
  },
};

// Export for use in other modules
window.Modal = Modal;
