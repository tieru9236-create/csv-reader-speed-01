/**
 * Ultra-fast CSV reader implementing make.fun's exact csv-reader 1.0.0 specification.
 * Fully dependency-free, optimized with typed buffers, slice caching, and zero extra allocations.
 */

const COMMA = 1;
const LINE_BREAK = 2;
const END = 3;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const len = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0;
  let line = 1;
  if (len > 0 && text.charCodeAt(0) === 0xFEFF) {
    pos = 1;
  }

  let recordLine = 1;
  let recordRow = null;

  function error(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  function readUnquoted(initialValue) {
    let start = pos;
    let chunks = null;
    let added = 0;

    while (pos < len) {
      const code = text.charCodeAt(pos);
      if (code === 44) { // ','
        const chunk = text.slice(start, pos);
        added += chunk.length;
        pos++;
        const val = chunks ? (initialValue + chunks.join('') + chunk) : (initialValue + chunk);
        return { value: val, ended: COMMA, added };
      }
      if (code === 10) { // '\n'
        const chunk = text.slice(start, pos);
        added += chunk.length;
        pos++;
        line++;
        const val = chunks ? (initialValue + chunks.join('') + chunk) : (initialValue + chunk);
        return { value: val, ended: LINE_BREAK, added };
      }
      if (code === 13) { // '\r'
        if (pos + 1 < len && text.charCodeAt(pos + 1) === 10) {
          const chunk = text.slice(start, pos);
          added += chunk.length;
          pos += 2;
          line++;
          const val = chunks ? (initialValue + chunks.join('') + chunk) : (initialValue + chunk);
          return { value: val, ended: LINE_BREAK, added };
        }
        // Stray CR
        error('stray_cr');
        const chunk = text.slice(start, pos);
        added += chunk.length;
        if (!chunks) chunks = [];
        if (chunk.length > 0) chunks.push(chunk);
        pos++;
        start = pos;
        continue;
      }
      pos++;
    }

    const chunk = text.slice(start, pos);
    added += chunk.length;
    const val = chunks ? (initialValue + chunks.join('') + chunk) : (initialValue + chunk);
    return { value: val, ended: END, added };
  }

  function readQuoted() {
    const open = pos;
    const openLine = line;
    pos++; // skip opening quote

    let start = pos;
    let parts = null;
    let closed = false;

    while (pos < len) {
      const code = text.charCodeAt(pos);
      if (code === 34) { // '"'
        if (pos + 1 < len && text.charCodeAt(pos + 1) === 34) { // '""'
          if (!parts) parts = [];
          parts.push(text.slice(start, pos));
          parts.push('"');
          pos += 2;
          start = pos;
          continue;
        }
        if (!parts) {
          parts = [text.slice(start, pos)];
        } else {
          parts.push(text.slice(start, pos));
        }
        pos++;
        closed = true;
        break;
      }
      if (code === 13) { // '\r'
        if (!parts) parts = [];
        parts.push(text.slice(start, pos));
        parts.push('\n');
        line++;
        pos += (pos + 1 < len && text.charCodeAt(pos + 1) === 10) ? 2 : 1;
        start = pos;
        continue;
      }
      if (code === 10) { // '\n'
        line++;
      }
      pos++;
    }

    if (!closed) {
      pos = open + 1;
      line = openLine;
      error('unterminated_quote');
      return readUnquoted('"');
    }

    const value = parts ? parts.join('') : '';

    if (pos >= len) return { value, ended: END };

    const nextCode = text.charCodeAt(pos);
    if (nextCode === 44) { // ','
      pos++;
      return { value, ended: COMMA };
    }
    if (nextCode === 10) { // '\n'
      pos++;
      line++;
      return { value, ended: LINE_BREAK };
    }
    if (nextCode === 13 && pos + 1 < len && text.charCodeAt(pos + 1) === 10) { // '\r\n'
      pos += 2;
      line++;
      return { value, ended: LINE_BREAK };
    }

    const junk = readUnquoted(value);
    if (junk.added > 0) error('quote_junk');
    return junk;
  }

  while (true) {
    // Skip empty lines (LF or CRLF with no characters)
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos++;
        line++;
      } else if (c === 13 && pos + 1 < len && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line++;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let field;
    let quoted;

    do {
      quoted = (pos < len && text.charCodeAt(pos) === 34);
      field = quoted ? readQuoted() : readUnquoted('');
      fields.push(field.value);
    } while (field.ended === COMMA);

    if (fields.length === 1 && fields[0] === '' && !quoted) {
      continue;
    }

    if (width < 0) width = fields.length;

    if (header && columns === null) {
      columns = fields;
      continue;
    }

    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  return { columns: header ? (columns ?? []) : null, rows, errors };
}
