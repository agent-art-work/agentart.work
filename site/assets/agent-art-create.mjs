import { mountReading } from './agent-art-sdk/0.1.5-alpha.2/reading-ui.mjs';
import work from './agent-art-create-work.mjs';

const element = document.querySelector('#create-agent');
if (element) {
  try {
    mountReading(element, { work, label: work.title, evidence: false });
    const fallback = document.querySelector('#create-agent-fallback');
    if (fallback) fallback.hidden = true;
  } catch {
    // Keep the alpha.3 guide link available if the control cannot mount.
    element.dataset.state = 'unavailable';
  }
}
