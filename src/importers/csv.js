// CSV parser — tenta identificar automaticamente as colunas
// data, descrição e valor de um extrato ou planilha em CSV.

import { guessCategoria } from './ofx';

function detectDelimiter(text) {
  const sample = text.split('\n').slice(0, 5).join('\n');
  const counts = { ',': 0, ';': 0, '\t': 0, '|': 0 };
  for (const c of sample) if (c in counts) counts[c]++;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function parseLine(line, delim) {
  // Handles quoted fields with the delimiter inside.
  const result = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === delim && !inQ) {
      result.push(cur.trim()); cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

function normalizeHeader(h) {
  return String(h || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]/g, '');
}

function findColumn(headers, candidates) {
  for (let i = 0; i < headers.length; i++) {
    const h = normalizeHeader(headers[i]);
    if (candidates.some(c => h.includes(c))) return i;
  }
  return -1;
}

function parseDate(s) {
  if (!s) return '';
  const t = String(s).trim();
  // ISO: YYYY-MM-DD
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  // BR: DD/MM/YYYY or DD/MM/YY
  m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return '';
}

function parseValue(s) {
  if (s === null || s === undefined) return 0;
  let t = String(s).trim();
  if (!t) return 0;
  // Handle Brazilian format: "1.234,56" → 1234.56
  // and US format: "1,234.56" → 1234.56
  const hasComma = t.includes(',');
  const hasDot = t.includes('.');
  if (hasComma && hasDot) {
    // The last one is the decimal separator
    if (t.lastIndexOf(',') > t.lastIndexOf('.')) {
      t = t.replace(/\./g, '').replace(',', '.');
    } else {
      t = t.replace(/,/g, '');
    }
  } else if (hasComma) {
    t = t.replace(',', '.');
  }
  const n = parseFloat(t);
  return isNaN(n) ? 0 : n;
}

/**
 * Parse CSV text into transaction records.
 * Tries to auto-detect date/description/value columns.
 */
export function parseCSV(text, banco = '') {
  if (!text || typeof text !== 'string') return [];
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];
  const delim = detectDelimiter(text);
  const headers = parseLine(lines[0], delim);
  const idxDate = findColumn(headers, ['data', 'date', 'dt']);
  const idxDesc = findColumn(headers, ['descric', 'historico', 'memo', 'name', 'title', 'observ']);
  const idxValor = findColumn(headers, ['valor', 'amount', 'vlr', 'quantia']);
  const idxCredito = findColumn(headers, ['credito', 'entrada', 'debit']); // some layouts split
  const idxDebito = findColumn(headers, ['debito', 'saida', 'credit']);

  // If we didn't find at least date + value, we can't parse reliably.
  if (idxDate === -1 || (idxValor === -1 && idxCredito === -1 && idxDebito === -1)) return [];

  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseLine(lines[i], delim);
    if (row.every(c => !c.trim())) continue;
    const data = parseDate(row[idxDate]);
    if (!data) continue;
    const descricao = (idxDesc >= 0 ? row[idxDesc] : '').trim() || 'Sem descrição';

    let valor = 0;
    if (idxValor >= 0) valor = parseValue(row[idxValor]);
    else {
      const cred = idxCredito >= 0 ? parseValue(row[idxCredito]) : 0;
      const deb = idxDebito >= 0 ? parseValue(row[idxDebito]) : 0;
      valor = cred - deb;
    }
    if (valor === 0) continue;

    const tipoBase = valor >= 0 ? 'entrada' : 'saida';
    const guess = guessCategoria(descricao);
    results.push({
      data,
      descricao,
      valor: Math.abs(valor),
      tipo: guess?.tipo || tipoBase,
      categoria: guess?.categoria || (tipoBase === 'entrada' ? 'Recebimento' : 'Outras'),
      banco,
      fitid: '',
    });
  }
  return results;
}
