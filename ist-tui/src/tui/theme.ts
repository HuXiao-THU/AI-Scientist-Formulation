/** ANSI escape code helpers for terminal styling */

const CSI = "\x1b[";
type SF = (s: string) => string;

function sgr(...codes: number[]): string { return `${CSI}${codes.join(";")}m`; }

const RESET = sgr(0);
const S = (s: string) => s;

export const theme = {
  reset: RESET,

  dim: ((s) => `${sgr(2)}${s}${RESET}`) as SF,
  bold: ((s) => `${sgr(1)}${s}${RESET}`) as SF,
  italic: ((s) => `${sgr(3)}${s}${RESET}`) as SF,

  fg: {
    default: ((s) => s) as SF,
    red: ((s) => `${sgr(31)}${s}${RESET}`) as SF,
    green: ((s) => `${sgr(32)}${s}${RESET}`) as SF,
    yellow: ((s) => `${sgr(33)}${s}${RESET}`) as SF,
    blue: ((s) => `${sgr(34)}${s}${RESET}`) as SF,
    magenta: ((s) => `${sgr(35)}${s}${RESET}`) as SF,
    cyan: ((s) => `${sgr(36)}${s}${RESET}`) as SF,
    white: ((s) => `${sgr(37)}${s}${RESET}`) as SF,
  },

  idea: ((s) => `${sgr(33)}${s}${RESET}`) as SF,
  experiment: ((s) => `${sgr(90)}${s}${RESET}`) as SF,
  running: ((s) => `${sgr(33)}${s}${RESET}`) as SF,
  done: ((s) => `${sgr(32)}${s}${RESET}`) as SF,
  failed: ((s) => `${sgr(31)}${s}${RESET}`) as SF,
  idle: ((s) => `${sgr(90)}${s}${RESET}`) as SF,
  accent: ((s) => `${sgr(36)}${s}${RESET}`) as SF,
  muted: ((s) => `${sgr(90)}${s}${RESET}`) as SF,

  bg: {
    selected: ((s) => `${sgr(48, 5, 236)}${s}${RESET}`) as SF,
  },

  border: ((s) => `${sgr(90)}${s}${RESET}`) as SF,
  borderAccent: ((s) => `${sgr(36)}${s}${RESET}`) as SF,

  badge: {
    idea: ((s) => `${sgr(33)}${sgr(1)}${s}${RESET}`) as SF,
    experiment: ((s) => `${sgr(37)}${sgr(1)}${s}${RESET}`) as SF,
  },
};
