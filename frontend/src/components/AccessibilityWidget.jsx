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
