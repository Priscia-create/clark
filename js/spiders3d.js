/**
 * Spiders module disabled per user request.
 * Moving spiders completely removed.
 */

export class Spiders3D {
  constructor(containerId = 'stephaneverse-spiders-container') {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = '';
  }

  init() {}
  onResize() {}
  destroy() {
    const el = document.getElementById('stephaneverse-spiders-container');
    if (el) el.innerHTML = '';
  }
}
