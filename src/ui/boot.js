/**
 * Loaded in the <head> of each extension page, before the first paint: what
 * must be in place before anything shows, so that nothing switches once the
 * page has opened. The theme chosen in the settings (shared/theme.js), and
 * the embedded mode of the options page in the popup (shared/embed.js).
 */
import { isEmbedded } from './shared/embed.js';
import { bootTheme } from './shared/theme.js';

bootTheme(document, window.localStorage);
if (isEmbedded(window.location)) document.documentElement.setAttribute('data-embedded', '');
