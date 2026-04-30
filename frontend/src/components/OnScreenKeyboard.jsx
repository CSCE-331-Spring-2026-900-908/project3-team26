// OnScreenKeyboard: a touch-friendly virtual keyboard rendered at the bottom of the
// viewport. Designed for kiosk touchscreens where the native OS keyboard may not
// automatically appear. Supports QWERTY + numeric/symbol mode, Shift, Backspace,
// Space, and a Send key.
//
// Props:
//   onKey(char)   — called with the character string when any letter/number/symbol key is tapped
//   onBackspace() — called when ⌫ is tapped
//   onSpace()     — called when the Space bar is tapped
//   onSend()      — called when the Send ↵ key is tapped
//
// Usage in ChatWidget:
//   <OnScreenKeyboard
//     onKey={(char) => setInput((prev) => prev + char)}
//     onBackspace={() => setInput((prev) => prev.slice(0, -1))}
//     onSpace={() => setInput((prev) => prev + ' ')}
//     onSend={sendMessage}
//   />

import { useState } from 'react';

// ── Keyboard layouts ──────────────────────────────────────────────────────────

const ALPHA_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

const NUM_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['@', '#', '$', '%', '&', '-', '+', '(', ')', '/'],
  ['!', '"', "'", '_', ':', ';', '?', ',', '.'],
];

const DEFAULT_LABELS = {
  close: 'Close Keyboard',
  shift: 'Shift',
  shiftActive: 'Shift active',
  space: 'Space',
  send: 'Send ↵',
  numbers: '123',
  letters: 'ABC',
  backspace: 'Backspace',
};

const KEYBOARD_LAYOUTS = {
  en: {
    lang: 'en',
    canShift: true,
    alphaRows: ALPHA_ROWS,
    labels: DEFAULT_LABELS,
  },
  es: {
    lang: 'es',
    canShift: true,
    alphaRows: [
      ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
      ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ñ'],
      ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
    ],
    labels: {
      ...DEFAULT_LABELS,
      close: 'Cerrar teclado',
      shift: 'Mayús',
      shiftActive: 'Mayús activa',
      space: 'Espacio',
      send: 'Enviar ↵',
    },
  },
  fr: {
    lang: 'fr',
    canShift: true,
    alphaRows: [
      ['a', 'z', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
      ['q', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm'],
      ['w', 'x', 'c', 'v', 'b', 'n', 'é', 'è', 'à'],
    ],
    labels: {
      ...DEFAULT_LABELS,
      close: 'Fermer le clavier',
      shift: 'Maj',
      shiftActive: 'Maj active',
      space: 'Espace',
      send: 'Envoyer ↵',
    },
  },
  de: {
    lang: 'de',
    canShift: true,
    alphaRows: [
      ['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p', 'ü'],
      ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ö', 'ä'],
      ['y', 'x', 'c', 'v', 'b', 'n', 'm', 'ß'],
    ],
    labels: {
      ...DEFAULT_LABELS,
      close: 'Tastatur schließen',
      shift: 'Umschalt',
      shiftActive: 'Umschalt aktiv',
      space: 'Leerzeichen',
      send: 'Senden ↵',
    },
  },
  it: {
    lang: 'it',
    canShift: true,
    alphaRows: [
      ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
      ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ò'],
      ['z', 'x', 'c', 'v', 'b', 'n', 'm', 'à', 'è', 'ù'],
    ],
    labels: {
      ...DEFAULT_LABELS,
      close: 'Chiudi tastiera',
      shift: 'Maiusc',
      shiftActive: 'Maiusc attivo',
      space: 'Spazio',
      send: 'Invia ↵',
    },
  },
  pt: {
    lang: 'pt',
    canShift: true,
    alphaRows: [
      ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
      ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ç'],
      ['z', 'x', 'c', 'v', 'b', 'n', 'm', 'ã', 'õ'],
    ],
    labels: {
      ...DEFAULT_LABELS,
      close: 'Fechar teclado',
      shift: 'Shift',
      shiftActive: 'Shift ativo',
      space: 'Espaço',
      send: 'Enviar ↵',
    },
  },
  'zh-cn': {
    lang: 'zh-CN',
    canShift: false,
    alphaRows: [
      ['你', '好', '我', '要', '喝', '奶', '茶', '珍', '珠', '糖'],
      ['冰', '少', '多', '大', '中', '小', '杯', '芒', '果', '绿'],
      ['请', '谢', '不', '有', '无', '热', '冷', '甜', '点'],
    ],
    labels: {
      ...DEFAULT_LABELS,
      close: '关闭键盘',
      space: '空格',
      send: '发送↵',
      letters: '中文',
      backspace: '退格',
    },
  },
  ja: {
    lang: 'ja',
    canShift: false,
    alphaRows: [
      ['あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く', 'け', 'こ'],
      ['さ', 'し', 'す', 'せ', 'そ', 'た', 'ち', 'つ', 'て', 'と'],
      ['な', 'に', 'ぬ', 'ね', 'の', 'ま', 'み', 'む', 'め', 'も'],
    ],
    labels: {
      ...DEFAULT_LABELS,
      close: 'キーボードを閉じる',
      space: 'スペース',
      send: '送信↵',
      letters: 'かな',
      backspace: '削除',
    },
  },
  ko: {
    lang: 'ko',
    canShift: false,
    alphaRows: [
      ['ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ', 'ㅛ', 'ㅕ', 'ㅑ', 'ㅐ', 'ㅔ'],
      ['ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ', 'ㅗ', 'ㅓ', 'ㅏ', 'ㅣ'],
      ['ㅋ', 'ㅌ', 'ㅊ', 'ㅍ', 'ㅠ', 'ㅜ', 'ㅡ'],
    ],
    labels: {
      ...DEFAULT_LABELS,
      close: '키보드 닫기',
      space: '스페이스',
      send: '보내기↵',
      letters: '한글',
      backspace: '지우기',
    },
  },
  ar: {
    lang: 'ar',
    direction: 'rtl',
    canShift: false,
    alphaRows: [
      ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح'],
      ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك'],
      ['ئ', 'ء', 'ؤ', 'ر', 'ى', 'ة', 'و', 'ز', 'ظ'],
    ],
    labels: {
      ...DEFAULT_LABELS,
      close: 'إغلاق لوحة المفاتيح',
      space: 'مسافة',
      send: 'إرسال↵',
      letters: 'حروف',
      backspace: 'حذف',
    },
  },
};

function getKeyboardLayout(language = 'en') {
  const normalized = language.toLowerCase();
  if (normalized.startsWith('zh')) {
    return KEYBOARD_LAYOUTS['zh-cn'];
  }

  const baseLanguage = normalized.split('-')[0];
  return KEYBOARD_LAYOUTS[baseLanguage] || KEYBOARD_LAYOUTS.en;
}

// ── Keyboard layout helpers ───────────────────────────────────────────────────

const ROW_STAGGERS = ['0px', '24px', '48px'];

// ── Component ─────────────────────────────────────────────────────────────────

export default function OnScreenKeyboard({ onKey, onBackspace, onSpace, onSend, onClose, language = 'en' }) {
  const [mode, setMode] = useState('alpha');
  const [shifted, setShifted] = useState(false);
  const layout = getKeyboardLayout(language);
  const labels = layout.labels;
  const canShift = layout.canShift !== false;

  const rows = mode === 'alpha' ? layout.alphaRows : NUM_ROWS;

  // onPointerDown + preventDefault: prevents the event from focusing/blurring the
  // textarea, which would re-trigger the native OS keyboard on touch devices.
  function tap(e, action) {
    e.preventDefault();
    action();
  }

  // Applies shift casing and auto-releases Shift after one letter (one-shot shift).
  function pressAlpha(char) {
    onKey(shifted && canShift ? char.toLocaleUpperCase(layout.lang) : char);
    if (shifted) setShifted(false);
  }

  function pressNum(char) {
    onKey(char);
  }

  const pressKey = mode === 'alpha' ? pressAlpha : pressNum;

  return (
    <div
      className="on-screen-keyboard notranslate"
      translate="no"
      style={{ direction: layout.direction || 'ltr' }}
      aria-label="On-screen keyboard"
      lang={layout.lang}
    >

      {/* ── NEW: Close bar — always visible at the top of the keyboard ── */}
      <div className="osk-close-row">
        <button
          className="osk-close-button"
          onPointerDown={(e) => { e.preventDefault(); onClose(); }}
          aria-label={labels.close}
        >
          × {labels.close}
        </button>
      </div>

      {/* ── Letter / number rows ──────────────────────────────────── */}
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="osk-row">

          {/* Stagger middle rows for QWERTY look */}
          {mode === 'alpha' && rowIndex > 0 && (
            <div className="osk-row-spacer" style={{ width: ROW_STAGGERS[rowIndex] }} />
          )}

          {row.map((char) => (
            <button
              key={char}
              className="osk-key"
              onPointerDown={(e) => tap(e, () => pressKey(char))}
              aria-label={char}
            >
              {mode === 'alpha' && shifted && canShift ? char.toLocaleUpperCase(layout.lang) : char}
            </button>
          ))}

          {/* Backspace at the end of row 0 */}
          {rowIndex === 0 && (
            <button
              className="osk-key osk-key--backspace"
              onPointerDown={(e) => tap(e, onBackspace)}
              aria-label={labels.backspace}
            >
              ⌫
            </button>
          )}
        </div>
      ))}

      {/* ── Bottom action row ─────────────────────────────────────── */}
      <div className="osk-row">

        {mode === 'alpha' && canShift && (
          <button
            className={shifted ? 'osk-key osk-key--shift osk-key--shift-active' : 'osk-key osk-key--shift'}
            onPointerDown={(e) => { e.preventDefault(); setShifted((s) => !s); }}
            aria-label={shifted ? labels.shiftActive : labels.shift}
          >
            ⇧ {labels.shift}
          </button>
        )}

        <button
          className="osk-key osk-key--mode"
          onPointerDown={(e) => {
            e.preventDefault();
            setMode((m) => (m === 'alpha' ? 'num' : 'alpha'));
            setShifted(false);
          }}
          aria-label={mode === 'alpha' ? labels.numbers : labels.letters}
        >
          {mode === 'alpha' ? labels.numbers : labels.letters}
        </button>

        <button
          className="osk-key osk-key--space"
          onPointerDown={(e) => tap(e, onSpace)}
          aria-label={labels.space}
        >
          {labels.space}
        </button>

        <button
          className="osk-key osk-key--send"
          onPointerDown={(e) => tap(e, onSend)}
          aria-label={labels.send}
        >
          {labels.send}
        </button>

      </div>
    </div>
  );
}
