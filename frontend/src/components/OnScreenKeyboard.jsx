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

export default function OnScreenKeyboard({ onKey, onBackspace, onSpace, onSend, onClose }) {
  const [mode, setMode] = useState('alpha');
  const [shifted, setShifted] = useState(false);

  const rows = mode === 'alpha' ? ALPHA_ROWS : NUM_ROWS;

  // onPointerDown + preventDefault: prevents the event from focusing/blurring the
  // textarea, which would re-trigger the native OS keyboard on touch devices.
  function tap(e, action) {
    e.preventDefault();
    action();
  }

  // Applies shift casing and auto-releases Shift after one letter (one-shot shift).
  function pressAlpha(char) {
    onKey(shifted ? char.toUpperCase() : char);
    if (shifted) setShifted(false);
  }

  function pressNum(char) {
    onKey(char);
  }

  const pressKey = mode === 'alpha' ? pressAlpha : pressNum;

  return (
    <div style={S.overlay} aria-label="On-screen keyboard">

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
          aria-label="Close keyboard"
        >
          ✕ Close Keyboard
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
              {mode === 'alpha' && shifted ? char.toUpperCase() : char}
            </button>
          ))}

          {/* Backspace at the end of row 0 */}
          {rowIndex === 0 && (
            <button
              style={{ ...S.key, ...S.backspace }}
              onPointerDown={(e) => tap(e, onBackspace)}
              aria-label="Backspace"
            >
              ⌫
            </button>
          )}
        </div>
      ))}

      {/* ── Bottom action row ─────────────────────────────────────── */}
      <div style={S.row}>

        {mode === 'alpha' && (
          <button
            style={{ ...S.key, ...(shifted ? S.shiftActive : S.shift) }}
            onPointerDown={(e) => { e.preventDefault(); setShifted((s) => !s); }}
            aria-label={shifted ? 'Shift active' : 'Shift'}
          >
            ⇧ Shift
          </button>
        )}

        <button
          style={{ ...S.key, ...S.modeSwitch }}
          onPointerDown={(e) => {
            e.preventDefault();
            setMode((m) => (m === 'alpha' ? 'num' : 'alpha'));
            setShifted(false);
          }}
          aria-label={mode === 'alpha' ? 'Switch to numbers' : 'Switch to letters'}
        >
          {mode === 'alpha' ? '123' : 'ABC'}
        </button>

        <button
          style={{ ...S.key, ...S.space }}
          onPointerDown={(e) => tap(e, onSpace)}
          aria-label="Space"
        >
          SPACE
        </button>

        <button
          style={{ ...S.key, ...S.send }}
          onPointerDown={(e) => tap(e, onSend)}
          aria-label="Send message"
        >
          Send ↵
        </button>

      </div>
    </div>
  );
}
