import { createAnalytics } from './analytics-core.mjs';

const privacy = document.getElementById('site-privacy');
if (privacy) {
  const controller = createAnalytics({ window, document });
  const render = () => {
    const state = controller.status();
    document.getElementById('analytics-status').textContent = state.writeFailed
      ? 'Your preference could not be saved. Optional measurement remains off.'
      : !state.storageAvailable ? 'Your browser preference cannot be read. Optional measurement remains off.'
      : state.excluded ? 'This browser is excluded. Optional measurement is off.'
      : 'Optional measurement is off.';
    privacy.querySelector('[data-analytics-action="exclude"]').hidden = state.excluded;
    privacy.querySelector('[data-analytics-action="include"]').hidden = !state.excluded;
  };
  privacy.querySelectorAll('[data-analytics-action]').forEach(button => {
    button.hidden = false;
    button.addEventListener('click', () => { controller[button.dataset.analyticsAction](); render(); });
  });
  window.addEventListener('storage', render);
  window.addEventListener('pageshow', render);
  render();
}
