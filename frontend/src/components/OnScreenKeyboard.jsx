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

// ── Inline styles (self-contained — no external CSS required) ─────────────────

const S = {
  overlay: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
    background: 'linear-gradient(to bottom, #1e1e2e, #12121c)',
    borderTop: '2px solid #444466',
    padding: '10px 8px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
    boxShadow: '0 -6px 32px rgba(0,0,0,0.55)',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
  row: {
    display: 'flex',
    justifyContent: 'center',
    gap: '5px',
  },
  key: {
    height: '52px',
    minWidth: '44px',
    padding: '0 8px',
    fontSize: '17px',
    fontWeight: '700',
    color: '#f0f0f8',
    background: '#2e2e4a',
    border: '1px solid #555577',
    borderBottom: '3px solid #333355',
    borderRadius: '9px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    touchAction: 'manipulation',
    flexShrink: 0,
    transition: 'filter 0.08s',
    WebkitTapHighlightColor: 'transparent',
  },
  backspace: {
    minWidth: '68px',
    background: '#3a2030',
    borderColor: '#664455',
    borderBottomColor: '#442233',
    color: '#ffaaaa',
    fontSize: '20px',
  },
  shift: {
    minWidth: '72px',
    background: '#222244',
    fontSize: '15px',
  },
  shiftActive: {
    minWidth: '72px',
    background: '#4a4a88',
    borderColor: '#8888cc',
    fontSize: '15px',
  },
  modeSwitch: {
    minWidth: '68px',
    background: '#252540',
    fontSize: '14px',
    color: '#aaaadd',
  },
  space: {
    flex: 1,
    maxWidth: '320px',
    background: '#252540',
    fontSize: '13px',
    color: '#8888aa',
    letterSpacing: '2px',
  },
  send: {
    minWidth: '96px',
    background: 'linear-gradient(135deg, #1a7a45, #0f5c32)',
    border: '1px solid #2aaa66',
    borderBottomColor: '#0a4025',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '800',
    letterSpacing: '0.5px',
  },
};

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
      style={{ ...S.overlay, direction: layout.direction || 'ltr' }}
      aria-label="On-screen keyboard"
      lang={layout.lang}
    >

      {/* ── NEW: Close bar — always visible at the top of the keyboard ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginBottom: '2px',
      }}>
        <button
          style={{
            background: '#3a2020',
            border: '1px solid #664444',
            borderRadius: '8px',
            color: '#ffaaaa',
            fontSize: '13px',
            fontWeight: '700',
            padding: '4px 14px',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
          }}
          onPointerDown={(e) => { e.preventDefault(); onClose(); }}
          aria-label={labels.close}
        >
          × {labels.close}
        </button>
      </div>

      {/* ── Letter / number rows ──────────────────────────────────── */}
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} style={S.row}>

          {/* Stagger middle rows for QWERTY look */}
          {mode === 'alpha' && rowIndex === 1 && (
            <div style={{ width: '24px', flexShrink: 0 }} />
          )}
          {mode === 'alpha' && rowIndex === 2 && (
            <div style={{ width: '48px', flexShrink: 0 }} />
          )}

          {row.map((char) => (
            <button
              key={char}
              style={S.key}
              onPointerDown={(e) => tap(e, () => pressKey(char))}
              aria-label={char}
            >
              {mode === 'alpha' && shifted && canShift ? char.toLocaleUpperCase(layout.lang) : char}
            </button>
          ))}

          {/* Backspace at the end of row 0 */}
          {rowIndex === 0 && (
            <button
              style={{ ...S.key, ...S.backspace }}
              onPointerDown={(e) => tap(e, onBackspace)}
              aria-label={labels.backspace}
            >
              ⌫
            </button>
          )}
        </div>
      ))}

      {/* ── Bottom action row ─────────────────────────────────────── */}
      <div style={S.row}>

        {mode === 'alpha' && canShift && (
          <button
            style={{ ...S.key, ...(shifted ? S.shiftActive : S.shift) }}
            onPointerDown={(e) => { e.preventDefault(); setShifted((s) => !s); }}
            aria-label={shifted ? labels.shiftActive : labels.shift}
          >
            ⇧ {labels.shift}
          </button>
        )}

        <button
          style={{ ...S.key, ...S.modeSwitch }}
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
          style={{ ...S.key, ...S.space }}
          onPointerDown={(e) => tap(e, onSpace)}
          aria-label={labels.space}
        >
          {labels.space}
        </button>

        <button
          style={{ ...S.key, ...S.send }}
          onPointerDown={(e) => tap(e, onSend)}
          aria-label={labels.send}
        >
          {labels.send}
        </button>

      </div>
    </div>
  );
}
