import { useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'bubble-tea-accessibility';
const GOOGLE_SCRIPT_ID = 'google-translate-script';
const GOOGLE_HOST_ID = 'google_translate_element';
const LENS_SIZE = 200;
const LENS_RADIUS = LENS_SIZE / 2;
const LENS_OFFSET_X = 150;
const LENS_OFFSET_Y = -150;
const CURSOR_GAP = 16;
const EDGE_GAP = 6;

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
    } else {
      setGoogleTranslateCookie(nextLanguage);
    }

    // Apply via Google's select element; fall back to polling if not ready.
    if (!applyGoogleTranslate(nextLanguage)) {
      let attempts = 0;
      const interval = window.setInterval(() => {
        attempts += 1;
        if (applyGoogleTranslate(nextLanguage) || attempts > 30) {
          window.clearInterval(interval);
        }
      }, 150);
    }
  };

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

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!translateReady || language === 'en') {
      return undefined;
    }

    const applyNow = () => applyGoogleTranslate(language);
    if (applyNow()) {
      return undefined;
    }

    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts += 1;
      const applied = applyNow();

      if (applied || attempts > 20) {
        window.clearInterval(interval);
      }
    }, 150);

    return () => {
      window.clearInterval(interval);
    };
  }, [language, translateReady]);

  // Lens position: offset diagonally from cursor, clamped to the viewport.
  const lensCenterX = Math.min(
    Math.max(pointerPosition.x + LENS_OFFSET_X, LENS_RADIUS + 12),
    window.innerWidth - LENS_RADIUS - 12,
  );
  const lensCenterY = Math.min(
    Math.max(pointerPosition.y + LENS_OFFSET_Y, LENS_RADIUS + 12),
    window.innerHeight - LENS_RADIUS - 12,
  );

  const handleDx = lensCenterX - pointerPosition.x;
  const handleDy = lensCenterY - pointerPosition.y;
  const centerDistance = Math.sqrt(handleDx * handleDx + handleDy * handleDy) || 1;
  const handleAngleRad = Math.atan2(handleDy, handleDx);
  const handleAngle = handleAngleRad * (180 / Math.PI);

  // Start handle CURSOR_GAP away from cursor; stop EDGE_GAP before lens edge.
  const handleStartX = pointerPosition.x + Math.cos(handleAngleRad) * CURSOR_GAP;
  const handleStartY = pointerPosition.y + Math.sin(handleAngleRad) * CURSOR_GAP;
  const handleLength = Math.max(0, centerDistance - LENS_RADIUS - CURSOR_GAP - EDGE_GAP);

  return (
    <>
      <div className="google-translate-host" id={GOOGLE_HOST_ID} aria-hidden="true" />

      {scale !== '1' && lensVisible ? (
        <>
          <div
            className="magnifier-handle"
            aria-hidden="true"
            style={{
              left: `${handleStartX}px`,
              top: `${handleStartY - 5}px`,
              width: `${handleLength}px`,
              transform: `rotate(${handleAngle}deg)`,
            }}
          >
            <span className="magnifier-handle-grip" />
          </div>
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
              <div className="magnifier-cursor" />
            </div>
          </div>
        </>
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
