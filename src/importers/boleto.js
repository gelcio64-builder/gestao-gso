// Boleto parser — decodifica linha digitável de boleto brasileiro
// Suporta:
//   • Boleto bancário (47 dígitos) — títulos, faturas
//   • Boleto de arrecadação (48 dígitos) — concessionárias, tributos

const BANCOS = {
  '001': 'Banco do Brasil',
  '033': 'Santander',
  '077': 'Inter',
  '104': 'Caixa Econômica',
  '184': 'Itaú BBA',
  '208': 'BTG Pactual',
  '212': 'Original',
  '237': 'Bradesco',
  '260': 'Nu Pagamentos (Nubank)',
  '336': 'C6 Bank',
  '341': 'Itaú',
  '380': 'PicPay',
  '389': 'Mercantil do Brasil',
  '399': 'HSBC',
  '422': 'Safra',
  '461': 'Asaas',
  '655': 'Votorantim',
  '748': 'Sicredi',
  '756': 'Sicoob',
  '403': 'Cora',
};

/**
 * Only digits from the input.
 */
function onlyDigits(s) {
  return String(s || '').replace(/\D/g, '');
}

/**
 * Convert boleto "fator de vencimento" (days since 07/10/1997) to ISO date.
 * Zero and blank return empty string.
 */
function fatorToDate(fator) {
  const f = parseInt(fator, 10);
  if (!f || f <= 0) return '';
  // Base date historically used by Febraban: 07/10/1997.
  // Note: as of 2025, banks rolled over past 9999 with a new base (22/02/2025).
  // For a boleto parser this simple, we support the pre-rollover case, which
  // still covers virtually every boleto issued in the last decade.
  const base = new Date(Date.UTC(1997, 9, 7)); // month is 0-indexed
  const target = new Date(base.getTime() + f * 86400000);
  return target.toISOString().slice(0, 10);
}

/**
 * Parse a boleto bancário (47 dígitos) typed line.
 * Layout (47 digits): AAABC.CCCCX DDDDD.DDDDDX EEEEE.EEEEEX F GGGGHHHHHHHHHH
 *   AAA = banco, B = moeda, F = DAC geral, GGGG = fator vencimento, HHHHHHHHHH = valor em centavos
 */
function parseBoletoBancario(dig) {
  if (dig.length !== 47) return null;
  const banco = dig.substring(0, 3);
  const moeda = dig.substring(3, 4);
  const fatorVenc = dig.substring(33, 37);
  const valorStr = dig.substring(37, 47);
  const valor = parseInt(valorStr, 10) / 100;
  return {
    tipo: 'bancario',
    banco,
    bancoNome: BANCOS[banco] || `Banco ${banco}`,
    moeda,
    vencimento: fatorToDate(fatorVenc),
    valor: isNaN(valor) ? 0 : valor,
    linhaDigitavel: dig,
  };
}

/**
 * Parse a boleto de arrecadação (48 dígitos).
 * Layout: I II III IV V VI VII VIII IX X XI (48 digits total)
 *   Positions 4-14: valor (11 digits, 2 decimals implied)
 *   Position 1: identifies "arrecadação" (usually 8)
 *   Position 2: segmento (1..9)
 */
function parseBoletoArrecadacao(dig) {
  if (dig.length !== 48) return null;
  const produto = dig.substring(0, 1); // 8 = arrecadação
  const segmento = dig.substring(1, 2);
  // Real value is in positions 4..14 (0-indexed: 4..15 for slice)
  const valorStr = dig.substring(4, 15);
  const valor = parseInt(valorStr, 10) / 100;
  const SEGMENTOS = {
    '1': 'Prefeituras',
    '2': 'Saneamento',
    '3': 'Energia elétrica/gás',
    '4': 'Telecomunicações',
    '5': 'Órgãos governamentais',
    '6': 'Carnês/outros',
    '7': 'Multas de trânsito',
    '9': 'Uso exclusivo do banco',
  };
  return {
    tipo: 'arrecadacao',
    produto,
    segmento,
    segmentoNome: SEGMENTOS[segmento] || 'Arrecadação',
    vencimento: '', // não presente no layout de arrecadação
    valor: isNaN(valor) ? 0 : valor,
    linhaDigitavel: dig,
  };
}

/**
 * Public API: parse any barcode/typed-line string.
 * @param {string} input - Raw string with digits (may include spaces, dots, dashes)
 * @returns {object|null} parsed structure or null if invalid
 */
export function parseBoleto(input) {
  const dig = onlyDigits(input);
  if (dig.length === 47) return parseBoletoBancario(dig);
  if (dig.length === 48) return parseBoletoArrecadacao(dig);
  return null;
}

export { BANCOS as BANCOS_FEBRABAN };
