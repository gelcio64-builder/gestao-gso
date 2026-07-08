// Scanner OCR baseado em Tesseract.js (português).
// A biblioteca é carregada sob demanda (lazy import), então o bundle
// inicial do app não fica pesado — o Tesseract só entra na conta quando
// o usuário efetivamente clica em "Escanear".

let tesseractPromise = null;

function loadTesseract() {
  if (!tesseractPromise) {
    tesseractPromise = import('tesseract.js').then(m => m.default || m);
  }
  return tesseractPromise;
}

/**
 * Roda OCR numa imagem e retorna o texto bruto.
 * @param {File|Blob} file - imagem
 * @param {(pct:number)=>void} onProgress - callback com progresso 0..100
 * @returns {Promise<string>}
 */
export async function scanImage(file, onProgress = () => {}) {
  const Tesseract = await loadTesseract();
  const { data } = await Tesseract.recognize(file, 'por', {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });
  return data.text || '';
}

// =========================================================
//   EXTRATORES DE CAMPOS DE INTERESSE
// =========================================================

/**
 * Extrai a linha digitável de um boleto (47 ou 48 dígitos) do texto OCR.
 * Retorna a string só com dígitos ou null se não encontrar.
 */
export function extractBoletoLinha(text) {
  if (!text) return null;
  // Tentativa 1: linha digitável formatada padrão (com pontos e espaços)
  const formatted = text.match(
    /(\d{5}[\.\s]{0,2}\d{5}\s{1,3}\d{5}[\.\s]{0,2}\d{6}\s{1,3}\d{5}[\.\s]{0,2}\d{6}\s{1,3}\d\s{1,3}\d{14})/
  );
  if (formatted) {
    const digits = formatted[1].replace(/\D/g, '');
    if (digits.length === 47) return digits;
  }
  // Tentativa 2: qualquer sequência contínua de 47 ou 48 dígitos
  // no texto limpo (após remover ruído)
  const digitsOnly = text.replace(/\D/g, '');
  const m47 = digitsOnly.match(/\d{47}/);
  if (m47) return m47[0];
  const m48 = digitsOnly.match(/\d{48}/);
  if (m48) return m48[0];
  return null;
}

/**
 * Extrai todas as datas no formato brasileiro (DD/MM/YYYY).
 * Retorna array de strings ISO (YYYY-MM-DD), únicas, ordenadas.
 */
export function extractDates(text) {
  if (!text) return [];
  const re = /(\d{1,2})[\/\-\.\s](\d{1,2})[\/\-\.\s](\d{2,4})/g;
  const seen = new Set();
  const dates = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    let y = m[3];
    if (y.length === 2) y = '20' + y;
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const year = parseInt(y, 10);
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2010 || year > 2050) continue;
    const iso = `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (!seen.has(iso)) {
      const d = new Date(iso + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        seen.add(iso);
        dates.push(iso);
      }
    }
  }
  return dates.sort();
}

/**
 * Escolhe a data mais provável de "vencimento":
 *  - Se houver datas futuras, retorna a mais próxima do hoje.
 *  - Se todas forem passadas, retorna a mais recente.
 *  - Se não houver datas, retorna null.
 */
export function extractVencimentoDate(text) {
  const dates = extractDates(text);
  if (dates.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  const futures = dates.filter(d => d >= today);
  if (futures.length > 0) return futures[0];
  return dates[dates.length - 1];
}

/**
 * Extrai valores monetários no formato brasileiro.
 * "R$ 1.234,56" | "1234,56" | "1.234,56"
 * Retorna array de números.
 */
export function extractValues(text) {
  if (!text) return [];
  const re = /(?:R\$\s*)?(\d{1,3}(?:[\.\s]\d{3})*,\d{2}|\d+,\d{2})/g;
  const seen = new Set();
  const values = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const clean = m[1].replace(/[\.\s]/g, '').replace(',', '.');
    const n = parseFloat(clean);
    if (!isNaN(n) && n > 0 && !seen.has(n)) {
      seen.add(n);
      values.push(n);
    }
  }
  return values.sort((a, b) => b - a); // maior primeiro
}
