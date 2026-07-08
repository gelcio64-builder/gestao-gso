// XML parser — Nota Fiscal Eletrônica (NF-e) e Conhecimento de Transporte (CT-e).
//
// Suporta ambos os envelopes:
//   • Standalone: <NFe>...</NFe> ou <CTe>...</CTe>
//   • Com envelope de proc: <nfeProc>...</nfeProc> ou <cteProc>...</cteProc>
//
// Também aceita prefixos de namespace (`nfe:emit`, etc).
//
// A direção do documento (entrada vs saída) é inferida a partir do CNPJ
// da empresa cadastrado nas Configurações:
//   • Se o CNPJ do emitente == CNPJ da empresa → foi ELA quem emitiu (entrada / receita)
//   • Caso contrário → documento RECEBIDO de terceiro (saída / despesa)

/**
 * Extract the first occurrence of `<tag>...</tag>` from `scope`.
 * Handles optional namespace prefix (e.g. `<nfe:emit>`).
 */
function tagText(scope, tag) {
  if (!scope) return '';
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`, 'i');
  const m = scope.match(re);
  return m ? m[1].trim() : '';
}

function firstNonEmpty(...arr) {
  return arr.find(v => v !== undefined && v !== null && String(v).trim() !== '') || '';
}

function toFloat(s) {
  const n = parseFloat(String(s || '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

function onlyDigits(s) {
  return String(s || '').replace(/\D/g, '');
}

/**
 * Parse a single NFe or CTe XML string.
 * @param {string} text - Raw XML content
 * @param {string} banco - Optional metadata
 * @param {string} empresaCnpj - The user's own company CNPJ (from settings) for direction inference
 * @returns {Array<Object>} 0 or 1 record (returns array for consistency with other parsers)
 */
export function parseXML(text, banco = '', empresaCnpj = '') {
  if (!text || typeof text !== 'string') return [];
  const isCTe = /<(?:[\w-]+:)?(?:cteProc|CTe)\b/.test(text);
  const isNFe = !isCTe && /<(?:[\w-]+:)?(?:nfeProc|NFe)\b/.test(text);
  if (!isCTe && !isNFe) return [];

  const tipoDoc = isCTe ? 'cte' : 'nfe';

  // Extract main sections
  const ideBlock = tagText(text, 'ide');
  const emitBlock = tagText(text, 'emit');
  const destBlock = tagText(text, 'dest');
  const totalBlock = tagText(text, 'total');
  const vPrestBlock = tagText(text, 'vPrest');

  // Common identifiers
  const numero = firstNonEmpty(
    tagText(ideBlock, 'nNF'),
    tagText(ideBlock, 'nCT'),
    tagText(text, 'nNF'),
    tagText(text, 'nCT'),
  );
  const dhEmi = firstNonEmpty(
    tagText(ideBlock, 'dhEmi'),
    tagText(ideBlock, 'dEmi'),
    tagText(text, 'dhEmi'),
  );
  const data = dhEmi ? dhEmi.slice(0, 10) : '';
  const natOp = firstNonEmpty(tagText(ideBlock, 'natOp'), tagText(text, 'natOp'));

  // Parties
  const emitCnpj = firstNonEmpty(tagText(emitBlock, 'CNPJ'), tagText(emitBlock, 'CPF'));
  const emitNome = firstNonEmpty(tagText(emitBlock, 'xNome'), tagText(emitBlock, 'xFant'));
  const destCnpj = firstNonEmpty(tagText(destBlock, 'CNPJ'), tagText(destBlock, 'CPF'));
  const destNome = tagText(destBlock, 'xNome');

  // Value
  let valor = 0;
  if (isCTe) {
    valor = toFloat(firstNonEmpty(
      tagText(vPrestBlock, 'vTPrest'),
      tagText(text, 'vTPrest'),
      tagText(vPrestBlock, 'vRec'),
      tagText(text, 'vRec'),
    ));
  } else {
    valor = toFloat(firstNonEmpty(
      tagText(totalBlock, 'vNF'),
      tagText(text, 'vNF'),
    ));
  }
  if (valor === 0) return [];

  // Infer direction
  const empCnpj = onlyDigits(empresaCnpj);
  const emitCnpjClean = onlyDigits(emitCnpj);
  const isEmittedByUs = !!empCnpj && !!emitCnpjClean && empCnpj === emitCnpjClean;
  const tipo = isEmittedByUs ? 'entrada' : 'saida';

  const cliente = isEmittedByUs ? destNome : emitNome;
  const categoria = isCTe
    ? (isEmittedByUs ? 'Prestação de frete' : 'Frete pago')
    : (isEmittedByUs ? 'Venda' : 'Compra / Fornecedor');
  const descricao = isCTe
    ? `CT-e ${numero || ''}${natOp ? ' · ' + natOp : ''}`.trim()
    : `NF-e ${numero || ''}${natOp ? ' · ' + natOp : ''}`.trim();

  return [{
    data,
    descricao,
    valor,
    tipo,
    categoria,
    cliente: cliente || '',
    banco,
    fitid: '',
    numero,
    tipoDoc,
    emitNome,
    emitCnpj: emitCnpjClean,
    destNome,
    destCnpj: onlyDigits(destCnpj),
    isEmittedByUs,
  }];
}
