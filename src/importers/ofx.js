// OFX parser — extrai transações de arquivos de extrato bancário
// Suporta OFX 1.x (SGML-like) e 2.x (XML puro).

// Detecta linhas que NÃO são transações reais — são apenas informações de
// saldo que alguns bancos jogam no meio do extrato. Essas linhas devem ser
// ignoradas na importação (não são entrada nem saída de dinheiro).
export function isLinhaSaldo(descricao) {
  const d = (descricao || '')
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return (
    /\bSALDO\b/.test(d) ||                       // "SALDO", "SALDO TOTAL", "SALDO DO DIA"
    /\bSDO\b/.test(d) ||                          // abreviação comum "SDO"
    /\bDISPONIVEL\b/.test(d) && /\bDIA\b/.test(d) || // "DISPONIVEL DIA"
    /\bSALDO\s+ANTERIOR\b/.test(d) ||
    /\bSALDO\s+FINAL\b/.test(d) ||
    /\bSALDO\s+BLOQUEADO\b/.test(d) ||
    /\bTOTAL\s+DISPONIVEL\b/.test(d) ||
    /\bLIMITE\s+(DE\s+)?CREDITO\b/.test(d) ||    // linhas de limite, não são movimentação
    /\bS A L D O\b/.test(d)                       // OCR/formatação espaçada
  );
}

function parseOFXDate(s) {
  if (!s) return '';
  const clean = s.replace(/[^\d]/g, '').slice(0, 8);
  if (clean.length !== 8) return '';
  return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
}

function parseAmount(s) {
  if (!s) return 0;
  const clean = String(s).trim().replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

// Simple regex-based field extractor (works for both SGML and XML forms of OFX)
function extractField(block, tag) {
  const re = new RegExp(`<${tag}>([^<\\n\\r]+?)(?=<|\\n|\\r|$)`, 'i');
  const m = block.match(re);
  return m ? m[1].trim() : '';
}

// Guess a category from the transaction memo/description
export function guessCategoria(memo) {
  const m = (memo || '').toUpperCase();
  if (/\b(PIX|TED|DOC)\s+(REC|RECEB)/.test(m) || /\bCREDITO/.test(m)) return { tipo: 'entrada', categoria: 'Recebimento' };
  if (/\bBOLETO.*(REC|RECEB)/.test(m)) return { tipo: 'entrada', categoria: 'Recebimento' };
  if (/\bCOMBUST|POSTO|GASOLINA|DIESEL|ETANOL/.test(m)) return { tipo: 'saida', categoria: 'Combustível' };
  if (/\bPEDAGIO|SEM\s*PARAR|CONECTCAR/.test(m)) return { tipo: 'saida', categoria: 'Pedágio' };
  if (/\bMANUT|OFICINA|MECANIC|PECA/.test(m)) return { tipo: 'saida', categoria: 'Manutenção' };
  if (/\bIPVA|LICEN|DPVAT/.test(m)) return { tipo: 'saida', categoria: 'IPVA/Licenciamento' };
  if (/\bSEGURO/.test(m)) return { tipo: 'saida', categoria: 'Seguro' };
  if (/\bSALARIO|FOLHA|VALE/.test(m)) return { tipo: 'saida', categoria: 'Salário' };
  if (/\bIMPOST|DARF|GPS|GNRE|SIMPLES\s*NACIONAL/.test(m)) return { tipo: 'saida', categoria: 'Impostos' };
  if (/\bENERGIA|LUZ|AGUA|INTERNET|TELEFONE/.test(m)) return { tipo: 'saida', categoria: 'Utilidades' };
  if (/\bALUGUEL|LOCACAO/.test(m)) return { tipo: 'saida', categoria: 'Aluguel' };
  if (/\bTARIFA|IOF|JUROS|MULTA/.test(m)) return { tipo: 'saida', categoria: 'Tarifas bancárias' };
  return null; // caller decides based on sign of value
}

/**
 * Parse OFX content and return an array of transaction objects.
 * @param {string} text - Raw OFX file contents
 * @param {string} banco - Bank name to attach to each row (metadata)
 * @returns {Array<{data:string, descricao:string, valor:number, tipo:'entrada'|'saida', categoria:string, fitid:string, banco:string}>}
 */
export function parseOFX(text, banco = '') {
  if (!text || typeof text !== 'string') return [];
  // Find all STMTTRN blocks (case-insensitive)
  const blockRe = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  const results = [];
  let match;
  while ((match = blockRe.exec(text)) !== null) {
    const block = match[1];
    const dtPosted = extractField(block, 'DTPOSTED');
    const trnAmt = extractField(block, 'TRNAMT');
    const memo = extractField(block, 'MEMO') || extractField(block, 'NAME') || '';
    const fitid = extractField(block, 'FITID');
    const valor = parseAmount(trnAmt);
    if (isLinhaSaldo(memo)) continue; // ignora linhas de saldo, não são transações
    const tipoBase = valor >= 0 ? 'entrada' : 'saida';
    const guess = guessCategoria(memo);
    results.push({
      data: parseOFXDate(dtPosted),
      descricao: memo.trim() || 'Transação sem descrição',
      valor: Math.abs(valor),
      tipo: guess?.tipo || tipoBase,
      categoria: guess?.categoria || (tipoBase === 'entrada' ? 'Recebimento' : 'Outras'),
      fitid: fitid.trim(),
      banco,
    });
  }
  // Fallback: no <STMTTRN> found → also try transactions without closing tag (some banks omit it)
  if (results.length === 0) {
    const openOnly = /<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>|$)/gi;
    while ((match = openOnly.exec(text)) !== null) {
      const block = match[1];
      const dtPosted = extractField(block, 'DTPOSTED');
      const trnAmt = extractField(block, 'TRNAMT');
      const memo = extractField(block, 'MEMO') || extractField(block, 'NAME') || '';
      if (!dtPosted && !trnAmt) continue;
      const valor = parseAmount(trnAmt);
      if (isLinhaSaldo(memo)) continue; // ignora linhas de saldo
      const tipoBase = valor >= 0 ? 'entrada' : 'saida';
      const guess = guessCategoria(memo);
      results.push({
        data: parseOFXDate(dtPosted),
        descricao: memo.trim() || 'Transação sem descrição',
        valor: Math.abs(valor),
        tipo: guess?.tipo || tipoBase,
        categoria: guess?.categoria || (tipoBase === 'entrada' ? 'Recebimento' : 'Outras'),
        fitid: extractField(block, 'FITID').trim(),
        banco,
      });
    }
  }
  return results;
}
