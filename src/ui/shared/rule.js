/**
 * The settings in one sentence ("Likes videos and Shorts from the channels
 * you subscribe to, as soon as they open."), shown in the popup and on the
 * options page. The parts that come from the settings are emphasized.
 *
 * It describes the same rules as evaluateEligibility and likeTime, from
 * settings returned by normalizeSettings, which never leaves a custom timing
 * without a threshold (the percentage is then enabled).
 */
import { emphasized } from './i18n.js';
import { formatNumber } from './format.js';

function whatKey(settings) {
  if (settings.likeNormalVideos && settings.likeShorts) return 'ruleWhatBoth';
  return settings.likeNormalVideos ? 'ruleWhatVideos' : 'ruleWhatShorts';
}

function channelsKey(settings) {
  if (settings.likeWhat === 'all') return 'ruleChannelsAll';
  if (settings.likeWhat === 'alwaysList') return 'ruleChannelsList';
  return settings.lists.always.length > 0 ? 'ruleChannelsSubscribedAndList' : 'ruleChannelsSubscribed';
}

function whenText({ mode, percent, minutes }, t, lang) {
  if (mode === 'random') return t('ruleWhenRandom');
  if (mode === 'custom') {
    const percentText = formatNumber(percent.value, lang);
    const minutesText = formatNumber(minutes.value, lang);
    if (percent.enabled && minutes.enabled) return t('ruleWhenBoth', [percentText, minutesText]);
    if (percent.enabled) return t('ruleWhenPercent', [percentText]);
    if (minutes.enabled) return t('ruleWhenMinutes', [minutesText]);
  }
  return t('ruleWhenInstant');
}

/** @returns {{ text: string, strong: boolean }[]} */
export function ruleParts(settings, t, lang) {
  if (!settings.likeNormalVideos && !settings.likeShorts) return [{ text: t('ruleNothing'), strong: false }];
  return emphasized(t, 'ruleSentence', [t(whatKey(settings)), t(channelsKey(settings)), whenText(settings.timing, t, lang)]);
}
