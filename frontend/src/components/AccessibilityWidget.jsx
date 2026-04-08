import { useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'bubble-tea-accessibility';
const GOOGLE_SCRIPT_ID = 'google-translate-script';
const GOOGLE_HOST_ID = 'google_translate_element';
const LENS_WIDTH = 240;
const LENS_HEIGHT = 180;
const LENS_VERTICAL_OFFSET = 44;

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt', label: 'Português' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'ar', label: 'العربية' },
];

const MAGNIFIER_OPTIONS = [
  { value: '1', label: 'Off' },
  { value: '1.5', label: '1.5x Lens' },
  { value: '1.8', label: '1.8x Lens' },
  { value: '2.2', label: '2.2x Lens' },
];

const CONTRAST_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'high', label: 'High Contrast' },
  { value: 'soft', label: 'Soft Contrast' },
];

function getStoredPreferences() {
  if (typeof window === 'undefined') {
    return { language: 'en', scale: '1', contrast: 'default' };
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    const cookieLanguage = getLanguageFromGoogleTranslateCookie();
    return {
      language: cookieLanguage ?? parsed.language ?? 'en',
      scale: parsed.scale ?? '1',
      contrast: parsed.contrast ?? 'default',
    };
  } catch {
    return { language: 'en', scale: '1', contrast: 'default' };
  }
}

function setGoogleTranslateCookie(language) {
  const value = language === 'en' ? '/auto/en' : `/auto/${language}`;
  const cookie = `googtrans=${value};path=/`;
  document.cookie = cookie;

  if (window.location.hostname.includes('.')) {
    document.cookie = `${cookie};domain=${window.location.hostname}`;
  }
}

function clearGoogleTranslateCookie() {
  const expired = 'googtrans=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
  document.cookie = expired;

  if (window.location.hostname.includes('.')) {
    document.cookie = `${expired};domain=${window.location.hostname}`;
  }
}

function getGoogleTranslateCookie() {
  const match = document.cookie.match(/(?:^|;\s*)googtrans=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function getLanguageFromGoogleTranslateCookie() {
  const value = getGoogleTranslateCookie();
  if (!value || value === '/auto/en') {
    return null;
  }

  const parts = value.split('/');
  return parts[2] || null;
}

function applyGoogleTranslate(language) {
  const select = document.querySelector('.goog-te-combo');
  if (!select) {
    return false;
  }

  select.value = language === 'en' ? '' : language;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}
