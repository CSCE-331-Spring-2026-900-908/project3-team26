// AccessibilityWidget: floating button + panel offering three tools:
//   1) Translation (loads Google Translate's element script and sets its language cookie)
//   2) Magnifier (renders a circular lens that follows the cursor and shows a scaled clone of the page)
//   3) Contrast (writes data-contrast on <body> so CSS can swap color schemes)
// User preferences persist in localStorage so the choices survive page reloads.
import { useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'bubble-tea-accessibility';
const GOOGLE_SCRIPT_ID = 'google-translate-script';
const GOOGLE_HOST_ID = 'google_translate_element';
const LENS_SIZE = 200;
const LENS_RADIUS = LENS_SIZE / 2;

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

// Reads saved preferences from localStorage, falling back to sensible defaults.
// Translation language is cross-checked against the Google Translate cookie so the
// widget stays in sync if the user changed the language outside our UI.
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

// Sets the googtrans cookie so Google Translate picks up the requested language on load.
function setGoogleTranslateCookie(language) {
  const value = language === 'en' ? '/auto/en' : `/auto/${language}`;
  const cookie = `googtrans=${value};path=/`;
  document.cookie = cookie;

  if (window.location.hostname.includes('.')) {
    document.cookie = `${cookie};domain=${window.location.hostname}`;
  }
}

// Expires the googtrans cookie so Google Translate reverts to the original English page.
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

// Drives Google Translate's hidden <select> programmatically so changing the language
// in our panel actually triggers a translation.
function applyGoogleTranslate(language) {
  const select = document.querySelector('.goog-te-combo');
  if (!select) {
    return false;
  }

  const options = Array.from(select.options || []);
  const targetIndex =
    language === 'en'
      ? Math.max(
          options.findIndex((option) => option.value === 'en'),
          0,
        )
      : options.findIndex((option) => option.value === language);

  if (targetIndex < 0 || !options[targetIndex]) {
    return false;
  }

  select.selectedIndex = targetIndex;
  select.value = options[targetIndex].value;
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

// Google Translate's <select> sometimes mounts after we try to drive it, so we retry
// on a backoff for a few seconds until it sticks. Returns a cleanup that cancels timers.
function forceGoogleTranslate(language) {
  // Apply immediately if ready, and keep retrying for a few seconds.
  applyGoogleTranslate(language);
  const delays = [60, 180, 400, 800, 1500, 2500, 4000];
  const timers = delays.map((ms) =>
    window.setTimeout(() => applyGoogleTranslate(language), ms),
  );
  return () => timers.forEach((id) => window.clearTimeout(id));
}

export default function AccessibilityWidget() {
  const defaults = useMemo(() => getStoredPreferences(), []);
  const [isOpen, setIsOpen] = useState(false);
  const [language, setLanguage] = useState(defaults.language);
  const [scale, setScale] = useState(defaults.scale);
  const [contrast, setContrast] = useState(defaults.contrast);
  const [translateReady, setTranslateReady] = useState(false);
  const [pointerPosition, setPointerPosition] = useState({ x: 240, y: 240 });
  const [lensVisible, setLensVisible] = useState(false);
  const lensContentRef = useRef(null);
  const mutationObserverRef = useRef(null);
  const isDraggingRef = useRef(false);

  // Saves the chosen language, sets/clears the Google Translate cookie, and triggers a translation.
  const handleLanguageChange = (nextLanguage) => {
    if (nextLanguage === language) {
      return;
    }

    setLanguage(nextLanguage);

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ language: nextLanguage, scale, contrast }),
      );
    } catch {
      // Ignore storage failures.
    }

    if (nextLanguage === 'en') {
      clearGoogleTranslateCookie();
      if (translateReady) {
        forceGoogleTranslate(nextLanguage);
      }
      return;
    }

    setGoogleTranslateCookie(nextLanguage);
    forceGoogleTranslate(nextLanguage);
  };

  // Mirrors the contrast choice onto <body data-contrast="..."> so our CSS can react,
  // and persists all three preferences to localStorage on every change.
  useEffect(() => {
    document.body.dataset.contrast = contrast;

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ language, scale, contrast }),
      );
    } catch {
      // Ignore storage failures so the panel still works in restricted browsers.
    }
  }, [contrast, language, scale]);

  // Magnifier setup: when scale > 1, clones the app DOM into a circular lens that
  // follows the cursor/touch. A MutationObserver re-clones the DOM whenever the page
  // changes so the lens stays in sync with the live UI. Cleans up on unmount/scale=1.
  useEffect(() => {
    if (scale === '1') {
      setLensVisible(false);
      if (mutationObserverRef.current) {
        mutationObserverRef.current.disconnect();
        mutationObserverRef.current = null;
      }
      if (lensContentRef.current) {
        lensContentRef.current.innerHTML = '';
      }
      return undefined;
    }

    const syncClone = () => {
      const appShell = document.querySelector('.app-shell');
      const lensContent = lensContentRef.current;

      if (!appShell || !lensContent) {
        return;
      }

      lensContent.innerHTML = '';
      const clone = appShell.cloneNode(true);
      clone.classList.add('magnifier-clone');
      clone.setAttribute('aria-hidden', 'true');
      lensContent.appendChild(clone);
    };

    syncClone();

    const appShell = document.querySelector('.app-shell');
    if (appShell) {
      mutationObserverRef.current = new MutationObserver(() => {
        window.requestAnimationFrame(syncClone);
      });

      mutationObserverRef.current.observe(appShell, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
      });
    }

    const handleMouseMove = (event) => {
      setPointerPosition({ x: event.clientX, y: event.clientY });
      setLensVisible(true);
    };

    const handleMouseLeave = () => {
      if (!isDraggingRef.current) {
        setLensVisible(false);
      }
    };

    const handleTouchMove = (event) => {
      const touch = event.touches[0];
      if (!touch) {
        return;
      }
      setPointerPosition({ x: touch.clientX, y: touch.clientY });
      setLensVisible(true);
      isDraggingRef.current = true;
    };

    const handleTouchStart = (event) => {
      const touch = event.touches[0];
      if (!touch) {
        return;
      }
      setPointerPosition({ x: touch.clientX, y: touch.clientY });
      setLensVisible(true);
      isDraggingRef.current = true;
    };

    const handleTouchEnd = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      if (mutationObserverRef.current) {
        mutationObserverRef.current.disconnect();
        mutationObserverRef.current = null;
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [scale]);

  // Lazily loads Google Translate's element script the first time a non-English language
  // is selected. Skips loading on subsequent visits if the global is already present.
  useEffect(() => {
    if (language === 'en') {
      return undefined;
    }

    if (window.google?.translate?.TranslateElement) {
      if (!document.getElementById(GOOGLE_HOST_ID)?.childElementCount) {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            includedLanguages: LANGUAGE_OPTIONS.map((option) => option.value).join(','),
            autoDisplay: false,
          },
          GOOGLE_HOST_ID,
        );
      }

      setTranslateReady(true);
      return undefined;
    }

    window.googleTranslateElementInit = () => {
      const host = document.getElementById(GOOGLE_HOST_ID);
      if (!host || host.childElementCount) {
        setTranslateReady(true);
        return;
      }

      new window.google.translate.TranslateElement(
        {
          pageLanguage: 'en',
          includedLanguages: LANGUAGE_OPTIONS.map((option) => option.value).join(','),
          autoDisplay: false,
        },
        GOOGLE_HOST_ID,
      );

      setTranslateReady(true);
    };

    if (!document.getElementById(GOOGLE_SCRIPT_ID)) {
      const script = document.createElement('script');
      script.id = GOOGLE_SCRIPT_ID;
      script.src =
        'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.body.appendChild(script);
    }

    return () => {
      delete window.googleTranslateElementInit;
    };
  }, [language]);

  useEffect(() => {
    if (!translateReady) {
      return undefined;
    }

    return forceGoogleTranslate(language);
  }, [language, translateReady]);

  // Lens follows the cursor directly, clamped to the viewport.
  const lensCenterX = Math.min(
    Math.max(pointerPosition.x, LENS_RADIUS + 12),
    window.innerWidth - LENS_RADIUS - 12,
  );
  const lensCenterY = Math.min(
    Math.max(pointerPosition.y, LENS_RADIUS + 12),
    window.innerHeight - LENS_RADIUS - 12,
  );

  return (
    <>
      <div className="google-translate-host" id={GOOGLE_HOST_ID} aria-hidden="true" />

      {scale !== '1' && lensVisible ? (
        <div
          className="magnifier-lens active"
          aria-hidden="true"
          style={{
            left: `${lensCenterX - LENS_RADIUS}px`,
            top: `${lensCenterY - LENS_RADIUS}px`,
          }}
        >
          <div className="magnifier-lens-frame">
            <div
              className="magnifier-lens-content"
              ref={lensContentRef}
              style={{
                transform: `translate(${-pointerPosition.x * Number(scale) + LENS_RADIUS}px, ${-pointerPosition.y * Number(scale) + LENS_RADIUS}px) scale(${scale})`,
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="accessibility-widget notranslate" translate="no">
        <button
          type="button"
          className="accessibility-trigger"
          aria-expanded={isOpen}
          aria-controls="accessibility-panel"
          onClick={() => setIsOpen((open) => !open)}
        >
          Accessibility
        </button>

        {isOpen ? (
          <section className="accessibility-panel panel" id="accessibility-panel">
            <div className="accessibility-panel-header">
              <div>
                <strong>Accessibility Tools</strong>
                <p>Translate the page, enlarge the interface, or improve readability.</p>
              </div>
              <button type="button" onClick={() => setIsOpen(false)}>
                Close
              </button>
            </div>

            <label className="accessibility-field">
              <span>Translation</span>
              <select
                className="language-select"
                value={language}
                onChange={(event) => handleLanguageChange(event.target.value)}
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="accessibility-field">
              <span>Magnifier</span>
              <select value={scale} onChange={(event) => setScale(event.target.value)}>
                {MAGNIFIER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="accessibility-field">
              <span>Contrast</span>
              <select value={contrast} onChange={(event) => setContrast(event.target.value)}>
                {CONTRAST_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </section>
        ) : null}
      </div>
    </>
  );
}
