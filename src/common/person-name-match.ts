export interface PersonKey {
  chineseName: string;
  suffix: string;
  tail4: string;
}

export interface SanitizePersonNameOptions {
  allowTrailingPinyin?: boolean;
}

function stripAllWhitespace(raw: string): string {
  return raw.replace(/[\s\u3000]+/g, '');
}

export function sanitizePersonName(
  raw: unknown,
  options: SanitizePersonNameOptions = {},
): string {
  if (raw === undefined || raw === null) return '';
  const compact = stripAllWhitespace(String(raw));
  if (!compact) return '';

  let out = '';
  let hasChineseLead = false;
  let i = 0;
  while (i < compact.length) {
    const ch = compact[i];
    if (/[\u4e00-\u9fff]/.test(ch)) {
      out += ch;
      hasChineseLead = true;
      i += 1;
    } else if (hasChineseLead && /[0-9]/.test(ch)) {
      out += ch;
      i += 1;
    } else if (hasChineseLead && (ch === 'x' || ch === 'X')) {
      out += 'X';
      i += 1;
    } else {
      break;
    }
  }

  const tail = compact.slice(i);
  if (options.allowTrailingPinyin && /^[a-zA-Z]*$/.test(tail)) {
    return out + tail;
  }
  return out;
}

export function extractChinesePrefix(name: string): string {
  const sanitized = sanitizePersonName(name);
  const m = sanitized.match(/^[\u4e00-\u9fff]+/);
  return m ? m[0] : sanitized;
}

export function parsePersonKey(name: string): PersonKey | null {
  const sanitized = sanitizePersonName(name);
  if (!sanitized) return null;
  const m = sanitized.match(/^([\u4e00-\u9fff]+)([0-9X]+)$/);
  if (!m) return null;
  const suffix = m[2];
  return {
    chineseName: m[1],
    suffix,
    tail4: suffix.slice(-4),
  };
}

function trimCompare(a: string, b: string): boolean {
  return a.trim() === b.trim();
}

export function isSamePerson(a: string, b: string): boolean {
  const ka = parsePersonKey(a);
  const kb = parsePersonKey(b);
  if (!ka || !kb) {
    return trimCompare(sanitizePersonName(a), sanitizePersonName(b));
  }
  return ka.chineseName === kb.chineseName && ka.tail4 === kb.tail4;
}
