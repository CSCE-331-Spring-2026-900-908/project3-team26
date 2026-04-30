// AccessibilityWidget: floating button + panel offering three tools:
//   1) Translation (loads Google Translate's element script and sets its language cookie)
//   2) Magnifier (renders a circular lens that follows the cursor and shows a scaled clone of the page)
//   3) Contrast (writes data-contrast on <body> so CSS can swap color schemes)
// User preferences persist in localStorage so the choices survive page reloads.
import { useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'bubble-tea-accessibility';
const ACCESSIBILITY_CHANGE_EVENT = 'bubble-tea-accessibility-change';
const GOOGLE_SCRIPT_ID = 'google-translate-script';
const GOOGLE_HOST_ID = 'google_translate_element';
const LENS_SIZE = 200;
const LENS_RADIUS = LENS_SIZE / 2;
const LENS_EDGE_MARGIN = 2;
const MAGNIFIER_OFFSET = {
  default: { x: 0, y: 0 },
  modal: { x: 0, y: 0 },
};

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

  const targetValue = options[targetIndex].value;
  if (select.value === targetValue) {
    return true;
  }

  select.selectedIndex = targetIndex;
  select.value = targetValue;
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

// Google Translate's <select> sometimes mounts after we try to drive it, so we retry
// on a backoff for a few seconds until it sticks. Returns a cleanup that cancels timers.
function forceGoogleTranslate(language) {
  // Try until the hidden Google select exists, then stop so it does not re-translate repeatedly.
  let applied = false;
  const delays = [0, 120, 360, 800, 1500, 2500];
  const timers = delays.map((ms) =>
    window.setTimeout(() => {
      if (applied) {
        return;
      }

      applied = applyGoogleTranslate(language);
    }, ms),
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
  const cloneRootRef = useRef(null);
  const clonePairsRef = useRef([]);
  const mutationObserverRef = useRef(null);
  const isDraggingRef = useRef(false);
  const appShellRectRef = useRef({ left: 0, top: 0 });

  const updateAppShellRect = () => {
    const appShell = document.querySelector('.app-shell');
    if (appShell) {
      appShellRectRef.current = appShell.getBoundingClientRect();
    }
    return appShell;
  };

  const getMagnifierSourceRoots = () =>
    [
      document.querySelector('.app-shell'),
      document.querySelector('.accessibility-widget'),
      document.querySelector('.chat-widget'),
      document.querySelector('.on-screen-keyboard'),
    ].filter(Boolean);

  const syncCloneScrollPositions = (sourceRoot, cloneRoot) => {
    if (!sourceRoot || !cloneRoot) {
      return;
    }

    const sourceElements = [sourceRoot, ...sourceRoot.querySelectorAll('*')];
    const cloneElements = [cloneRoot, ...cloneRoot.querySelectorAll('*')];

    sourceElements.forEach((sourceElement, index) => {
      const cloneElement = cloneElements[index];
      if (!cloneElement) {
        return;
      }

      cloneElement.scrollLeft = sourceElement.scrollLeft;
      cloneElement.scrollTop = sourceElement.scrollTop;
    });
  };

  const syncFixedClonePositions = (sourceRoot, cloneRoot, rootRect = sourceRoot?.getBoundingClientRect()) => {
    if (!sourceRoot || !cloneRoot) {
      return;
    }

    const sourceElements = [sourceRoot, ...sourceRoot.querySelectorAll('*')];
    const cloneElements = [cloneRoot, ...cloneRoot.querySelectorAll('*')];

    sourceElements.forEach((sourceElement, index) => {
      if (window.getComputedStyle(sourceElement).position !== 'fixed') {
        return;
      }

      const cloneElement = cloneElements[index];
      if (!cloneElement) {
        return;
      }

      const rect = sourceElement.getBoundingClientRect();
      Object.assign(cloneElement.style, {
        position: 'absolute',
        left: `${rect.left - rootRect.left}px`,
        top: `${rect.top - rootRect.top}px`,
        right: 'auto',
        bottom: 'auto',
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: '0',
      });
    });
  };

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
      return;
    }

    setGoogleTranslateCookie(nextLanguage);
  };

  // Mirrors the contrast choice onto <body data-contrast="..."> so our CSS can react,
  // and persists all three preferences to localStorage on every change.
  useEffect(() => {
    document.body.dataset.contrast = contrast;
    document.documentElement.lang = language;

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ language, scale, contrast }),
      );
    } catch {
      // Ignore storage failures so the panel still works in restricted browsers.
    }

    window.dispatchEvent(
      new CustomEvent(ACCESSIBILITY_CHANGE_EVENT, {
        detail: { language, scale, contrast },
      }),
    );
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
      cloneRootRef.current = null;
      clonePairsRef.current = [];
      return undefined;
    }

    const syncClone = () => {
      const appShell = document.querySelector('.app-shell');
      const lensContent = lensContentRef.current;
      const sourceRoots = getMagnifierSourceRoots();

      if (!appShell || !lensContent) {
        return;
      }

      appShellRectRef.current = appShell.getBoundingClientRect();
      lensContent.innerHTML = '';
      const clone = document.createElement('div');
      clone.classList.add('magnifier-clone');
      clone.setAttribute('aria-hidden', 'true');
      const clonePairs = sourceRoots.map((sourceRoot) => {
        const clonedRoot = sourceRoot.cloneNode(true);
        clone.appendChild(clonedRoot);
        return { sourceRoot, clonedRoot };
      });
      lensContent.appendChild(clone);
      cloneRootRef.current = clone;
      clonePairsRef.current = clonePairs;
      clonePairs.forEach(({ sourceRoot, clonedRoot }) => {
        syncCloneScrollPositions(sourceRoot, clonedRoot);
        syncFixedClonePositions(sourceRoot, clonedRoot, appShellRectRef.current);
      });
      window.requestAnimationFrame(() => {
        clonePairsRef.current.forEach(({ sourceRoot, clonedRoot }) => {
          syncCloneScrollPositions(sourceRoot, clonedRoot);
          syncFixedClonePositions(sourceRoot, clonedRoot, appShellRectRef.current);
        });
      });
    };

    syncClone();

    const appRoot = document.getElementById('root') || document.body;
    if (appRoot) {
      mutationObserverRef.current = new MutationObserver((mutations) => {
        const onlyMagnifierChanged = mutations.every((mutation) => {
          const target =
            mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
          return Boolean(target?.closest('.magnifier-lens'));
        });
        if (onlyMagnifierChanged) {
          return;
        }

        window.requestAnimationFrame(syncClone);
      });

      mutationObserverRef.current.observe(appRoot, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
      });
    }

    const syncLivePosition = () => {
      const appShell = updateAppShellRect();
      if (appShell && cloneRootRef.current) {
        clonePairsRef.current.forEach(({ sourceRoot, clonedRoot }) => {
          if (!document.body.contains(sourceRoot)) {
            return;
          }

          syncCloneScrollPositions(sourceRoot, clonedRoot);
          syncFixedClonePositions(sourceRoot, clonedRoot, appShellRectRef.current);
        });
      }
    };

    let refreshFrameId = null;
    const handleScrollOrResize = () => {
      if (refreshFrameId) {
        window.cancelAnimationFrame(refreshFrameId);
      }

      refreshFrameId = window.requestAnimationFrame(() => {
        refreshFrameId = null;
        syncLivePosition();
        setPointerPosition((current) => ({ ...current }));
      });
    };

    const handleMouseMove = (event) => {
      syncLivePosition();
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
      syncLivePosition();
      setPointerPosition({ x: touch.clientX, y: touch.clientY });
      setLensVisible(true);
      isDraggingRef.current = true;
    };

    const handleTouchStart = (event) => {
      const touch = event.touches[0];
      if (!touch) {
        return;
      }
      syncLivePosition();
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
    window.addEventListener('scroll', handleScrollOrResize, true);
    document.addEventListener('scroll', handleScrollOrResize, true);
    document.addEventListener('wheel', handleScrollOrResize, true);
    document.addEventListener('touchmove', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    appShell?.addEventListener('scroll', syncLivePosition, true);

    return () => {
      if (mutationObserverRef.current) {
        mutationObserverRef.current.disconnect();
        mutationObserverRef.current = null;
      }
      if (refreshFrameId) {
        window.cancelAnimationFrame(refreshFrameId);
      }
      cloneRootRef.current = null;
      clonePairsRef.current = [];
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      document.removeEventListener('scroll', handleScrollOrResize, true);
      document.removeEventListener('wheel', handleScrollOrResize, true);
      document.removeEventListener('touchmove', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      appShell?.removeEventListener('scroll', syncLivePosition, true);
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
    Math.max(pointerPosition.x, LENS_RADIUS + LENS_EDGE_MARGIN),
    window.innerWidth - LENS_RADIUS - LENS_EDGE_MARGIN,
  );
  const lensCenterY = Math.min(
    Math.max(pointerPosition.y, LENS_RADIUS + LENS_EDGE_MARGIN),
    window.innerHeight - LENS_RADIUS - LENS_EDGE_MARGIN,
  );
  const pointerOffsetX = pointerPosition.x - lensCenterX;
  const pointerOffsetY = pointerPosition.y - lensCenterY;
  const pointerOffsetDistance = Math.hypot(pointerOffsetX, pointerOffsetY);
  const pointerMarkerMaxOffset = LENS_RADIUS - 18;
  const pointerMarkerScale =
    pointerOffsetDistance > pointerMarkerMaxOffset && pointerOffsetDistance > 0
      ? pointerMarkerMaxOffset / pointerOffsetDistance
      : 1;
  const pointerMarkerX = LENS_RADIUS + pointerOffsetX * pointerMarkerScale;
  const pointerMarkerY = LENS_RADIUS + pointerOffsetY * pointerMarkerScale;
  const magnifiedSourceX = pointerPosition.x - appShellRectRef.current.left;
  const magnifiedSourceY = pointerPosition.y - appShellRectRef.current.top;
  const isPointingAtModal = Boolean(
    document
      .elementFromPoint(pointerPosition.x, pointerPosition.y)
      ?.closest('.kiosk-modal, .cashier-modal')
  );
  const magnifierOffset = isPointingAtModal ? MAGNIFIER_OFFSET.modal : MAGNIFIER_OFFSET.default;

  return (
    <>
      <div className="google-translate-host" id={GOOGLE_HOST_ID} aria-hidden="true" />

      {scale !== '1' ? (
        <div
          className={lensVisible ? 'magnifier-lens active' : 'magnifier-lens'}
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
                transform: `translate(${pointerMarkerX}px, ${pointerMarkerY}px) scale(${scale}) translate(${-magnifiedSourceX + magnifierOffset.x}px, ${-magnifiedSourceY + magnifierOffset.y}px)`,
              }}
            />
          </div>
          <div
            className="magnifier-pointer"
            style={{
              left: `${pointerMarkerX}px`,
              top: `${pointerMarkerY}px`,
            }}
          />
        </div>
      ) : null}

      <div className="accessibility-widget">
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
