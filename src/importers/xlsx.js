// Excel / XLSX parser — le a primeira aba do arquivo e tenta identificar
// automaticamente as colunas data, descrição e valor.
//
// Usa SheetJS Community Edition (xlsx@0.18).
// Requer que o chamador passe um ArrayBuffer do arquivo, não texto.

import * as XLSX from 'xlsx';
import { guessCategoria } from './ofx';

function normalizeHeader(h) {
  return String(h || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function findColumn(headers, candidates) {
  for (let i = 0; i < headers.length; i++) {
    const h = normalizeHeader(headers[i]);
    if (candidates.some(c => h.includes(c))) return i;
  }
  return -1;
}

function parseDate(v) {
  if (v === null || v === undefined || v === '') return '';
  // Excel serial date (SheetJS converts to JS Date if we ask, but here we get raw)
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const t = String(v).trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return '';
}

function parseValue(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  let t = String(v).trim();
  if (!t) return 0;
  // Strip currency symbols and thousands separators
  t = t.replace(/[R$\s]/g, '');
  const hasComma = t.includes(',');
  const hasDot = t.includes('.');
  if (hasComma && hasDot) {
    if (t.lastIndexOf(',') > t.lastIndexOf('.')) t = t.replace(/\./g, '').replace(',', '.');
    else t = t.replace(/,/g, '');
  } else if (hasComma) {
    t = t.replace(',', '.');
  }
  const n = parseFloat(t);
  return isNaN(n) ? 0 : n;
}

/**
 * Parse an Excel/XLSX file (as ArrayBuffer) into transaction records.
 * Auto-detects columns for date, description, and value.
 *
 * @param {ArrayBuffer} buffer - File content
 * @param {string} banco - Bank name to attach to each row (metadata)
 * @returns {Array<{data:string, descricao:string, valor:number, tipo:'entrada'|'saida', categoria:string, banco:string, fitid:string}>}
 */
export function parseXLSX(buffer, banco = '') {
  if (!buffer) return [];
  let wb;
  try {
    wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  } catch (e) {
    console.error('[xlsx] failed to read workbook', e);
    return [];
  }
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: false });
  if (rows.length < 2) return [];

  // Find header row: pick the first row with 3+ non-empty cells.
  let headerIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    if (rows[i].filter(c => String(c || '').trim().length > 0).length >= 3) {
      headerIdx = i; break;
    }
  }
  const headers = rows[headerIdx];
  const idxDate = findColumn(headers, ['data', 'date', 'dt']);
  const idxDesc = findColumn(headers, ['descric', 'historico', 'memo', 'name', 'title', 'observ']);
  const idxValor = findColumn(headers, ['valor', 'amount', 'vlr', 'quantia']);
  const idxCredito = findColumn(headers, ['credito', 'entrada']);
  const idxDebito = findColumn(headers, ['debito', 'saida']);

  if (idxDate === -1 || (idxValor === -1 && idxCredito === -1 && idxDebito === -1)) return [];

  const results = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => String(c || '').trim().length === 0)) continue;
    const data = parseDate(row[idxDate]);
    if (!data) continue;
    const descricao = (idxDesc >= 0 ? String(row[idxDesc] || '') : '').trim() || 'Sem descrição';

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
