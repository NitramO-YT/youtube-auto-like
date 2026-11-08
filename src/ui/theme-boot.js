/**
 * Loaded in the <head> of each extension page, before the first paint: opens
 * the page in the theme chosen in the settings (see shared/theme.js).
 */
import { bootTheme } from './shared/theme.js';

bootTheme(document, window.localStorage);
