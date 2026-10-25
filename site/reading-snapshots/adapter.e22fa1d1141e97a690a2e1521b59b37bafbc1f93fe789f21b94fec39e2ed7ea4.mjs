import { mountReading } from './agent-art-sdk/0.1.5-alpha.2/reading-ui.mjs';
import work from './agent-art-reading-work.mjs?v=33aa34d6ae95108ba302bc6fec9ecb5c1ad336f20e209f8cf7d2a1ee0365a622';

const element = document.querySelector('#ask-your-agent');
if (element) {
  mountReading(element, { work, evidence: false });
  // The compact control supplies Copy and its own manual fallback. Keep the
  // original disclosure available when scripts or the SDK cannot load.
  const fallback = document.querySelector('#agent-prompt-disclosure');
  if (fallback) fallback.hidden = true;
}
