/**
 * Theme Manager - Toggle dark/light mode
 */

const Theme = {
  /**
   * Initialize theme from local storage or system preference
   */
  init() {
    const stored = localStorage.getItem('jsonlab-theme');

    if (stored) {
      this.set(stored);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.set(prefersDark ? 'dark' : 'light');
    }

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('jsonlab-theme')) {
        this.set(e.matches ? 'dark' : 'light');
      }
    });
  },

  /**
   * Set theme
   */
  set(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.updateIcon(theme);

    // Update Monaco editor theme
    // Update Monaco editor theme
    if (window.App && typeof window.App.updateTheme === 'function') {
      window.App.updateTheme();
    }
  },

  /**
   * Get current theme
   */
  get() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  },

  /**
   * Toggle between light and dark
   */
  toggle() {
    const current = this.get();
    const newTheme = current === 'dark' ? 'light' : 'dark';
    this.set(newTheme);
    localStorage.setItem('jsonlab-theme', newTheme);
  },

  /**
   * Update theme icon in UI
   */
  updateIcon(theme) {
    const icon = document.getElementById('theme-icon');
    if (icon) {
      const iconName = theme === 'dark' ? 'sun' : 'moon';
      icon.setAttribute('data-lucide', iconName);
      if (window.lucide) {
        lucide.createIcons();
      }
    }
  },
};

// Export for use in other modules
window.Theme = Theme;
