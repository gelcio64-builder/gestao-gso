// ============================================================
// MOTOR FISCAL — regimes tributários e cálculos
// ============================================================
// Regra de ouro deste módulo: NENHUM valor fiscal fica fixo no código como
// verdade absoluta. Os números abaixo são apenas SUGESTÕES iniciais — a empresa
// confirma e ajusta tudo em Configurações → Fiscal.
// Motivo: limites, alíquotas e valores de DAS mudam por lei todo ano.
//
// Este módulo não consulta a Receita Federal nem emite guias — ele apenas
// interpreta os dados que já existem no sistema (lançamentos do Financeiro).

export const REGIMES = [
  {
    id: 'mei',
    nome: 'MEI',
    descricao: 'Microempreendedor Individual',
    // valores SUGERIDOS — confirmar com o contador
    limiteAnual: 81000,
    valorImposto: 76.90,       // DAS mensal (varia com o salário mínimo)
    nomeImposto: 'DAS',
    diaVencimento: 20,
    declaracaoAnual: 'DASN-SIMEI',
    prazoDeclaracao: '05-31',  // MM-DD
  },
  {
    id: 'mei-caminhoneiro',
    nome: 'MEI Caminhoneiro',
    descricao: 'MEI Transportador Autônomo de Carga',
    limiteAnual: 251600,
    valorImposto: 182.16,      // DAS do MEI caminhoneiro (maior que o MEI comum)
    nomeImposto: 'DAS',
    diaVencimento: 20,
    declaracaoAnual: 'DASN-SIMEI',
    prazoDeclaracao: '05-31',
  },
  {
    id: 'simples',
    nome: 'Simples Nacional',
    descricao: 'Microempresa / Empresa de Pequeno Porte',
    limiteAnual: 4800000,
    valorImposto: 0,           // varia por faixa de faturamento
    nomeImposto: 'DAS',
    diaVencimento: 20,
    declaracaoAnual: 'DEFIS',
    prazoDeclaracao: '03-31',
  },
  {
    id: 'presumido',
    nome: 'Lucro Presumido',
    descricao: 'Tributação sobre lucro estimado',
    limiteAnual: 78000000,
    valorImposto: 0,
    nomeImposto: 'Impostos',
    diaVencimento: 20,
    declaracaoAnual: 'ECF',
    prazoDeclaracao: '07-31',
  },
  {
    id: 'real',
    nome: 'Lucro Real',
    descricao: 'Tributação sobre lucro efetivo',
    limiteAnual: 0,            // sem limite
    valorImposto: 0,
    nomeImposto: 'Impostos',
    diaVencimento: 20,
    declaracaoAnual: 'ECF',
    prazoDeclaracao: '07-31',
  },
];

export const getRegime = (id) => REGIMES.find(r => r.id === id) || REGIMES[0];

// Parâmetros fiscais efetivos: o que a empresa configurou, com fallback no regime
export function getParamsFiscais(config = {}) {
  const f = config.fiscal || {};
  const regime = getRegime(f.regimeId || 'mei-caminhoneiro');
  return {
    ativo: f.ativo !== false,             // painel ligado por padrão
    regimeId: regime.id,
    regimeNome: regime.nome,
    nomeImposto: f.nomeImposto || regime.nomeImposto,
    limiteAnual: num(f.limiteAnual, regime.limiteAnual),
    valorImposto: num(f.valorImposto, regime.valorImposto),
    diaVencimento: num(f.diaVencimento, regime.diaVencimento),
    declaracaoAnual: f.declaracaoAnual || regime.declaracaoAnual,
    prazoDeclaracao: f.prazoDeclaracao || regime.prazoDeclaracao,
    // controle manual: quais competências já foram pagas/entregues
    impostosPagos: f.impostosPagos || {},   // { '2026-07': true }
    declaracoesEntregues: f.declaracoesEntregues || {}, // { '2026': true }
    // categorias do Financeiro que representam imposto (pra detectar pagamento)
    categoriaImposto: f.categoriaImposto || 'Impostos',
  };
}
const num = (v, fb) => (v === undefined || v === null || v === '' || isNaN(Number(v))) ? fb : Number(v);

// ---------- Faixas de risco do limite anual ----------
export const FAIXAS_LIMITE = [
  { max: 60,  nivel: 'regular',  label: 'Regular',            cor: '#16A34A' },
  { max: 80,  nivel: 'atencao',  label: 'Atenção',            cor: '#EAB308' },
  { max: 95,  nivel: 'proximo',  label: 'Próximo do limite',  cor: '#EA580C' },
  { max: 1e9, nivel: 'risco',    label: 'Risco fiscal',       cor: '#DC2626' },
];
export const faixaDoPercentual = (pct) => FAIXAS_LIMITE.find(f => pct <= f.max) || FAIXAS_LIMITE[3];

const MESES_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

/**
 * Calcula toda a situação fiscal a partir dos lançamentos que já existem.
 * PURO: não altera nada, não consulta nada externo.
 *
 * @param {array} finEmpresa - lançamentos do Financeiro Empresa
 * @param {object} params    - saída de getParamsFiscais()
 * @param {Date}   hoje      - data de referência (injetável para testes)
 */
export function calcularFiscal(finEmpresa = [], params, hoje = new Date()) {
  const ano = hoje.getFullYear();
  const mesAtual = hoje.getMonth(); // 0-11

  // --- Faturamento acumulado no ano (só entradas efetivamente recebidas) ---
  const recebidasAno = finEmpresa.filter(x =>
    x.tipo === 'entrada' &&
    x.status === 'pago' &&
    String(x.data || '').startsWith(String(ano))
  );
  const faturamentoAno = recebidasAno.reduce((a, b) => a + (Number(b.valor) || 0), 0);

  // --- Faturamento mês a mês (para o gráfico e a projeção) ---
  const porMes = Array.from({ length: 12 }, (_, i) => {
    const chave = `${ano}-${String(i + 1).padStart(2, '0')}`;
    const valor = recebidasAno
      .filter(x => String(x.data).startsWith(chave))
      .reduce((a, b) => a + (Number(b.valor) || 0), 0);
    return { mes: i, chave, label: MESES_PT[i].slice(0, 3), valor };
  });

  // --- Percentual do limite ---
  const temLimite = params.limiteAnual > 0;
  const pctLimite = temLimite ? (faturamentoAno / params.limiteAnual) * 100 : 0;
  const faixa = temLimite ? faixaDoPercentual(pctLimite) : FAIXAS_LIMITE[0];
  const restante = temLimite ? Math.max(0, params.limiteAnual - faturamentoAno) : 0;

  // --- Projeção: em que mês o limite seria atingido no ritmo atual ---
  const mesesComDados = porMes.filter((m, i) => i <= mesAtual && m.valor > 0).length;
  const mediaMensal = mesesComDados > 0 ? faturamentoAno / mesesComDados : 0;
  let mesEstouro = null;   // 0-11 ou null
  let projecaoAnual = 0;
  if (temLimite && mediaMensal > 0) {
    projecaoAnual = mediaMensal * 12;
    let acumulado = faturamentoAno;
    for (let i = mesAtual + 1; i < 12; i++) {
      acumulado += mediaMensal;
      if (acumulado > params.limiteAnual) { mesEstouro = i; break; }
    }
    // já estourou
    if (faturamentoAno > params.limiteAnual) mesEstouro = mesAtual;
  }

  // --- Imposto do mês (DAS) ---
  const chaveMes = `${ano}-${String(mesAtual + 1).padStart(2, '0')}`;
  const vencDAS = new Date(ano, mesAtual, params.diaVencimento);
  // marcado manualmente OU detectado por lançamento de imposto no mês
  const pagoManual = !!params.impostosPagos[chaveMes];
  const pagoDetectado = finEmpresa.some(x =>
    x.tipo === 'saida' &&
    x.categoria === params.categoriaImposto &&
    String(x.data || '').startsWith(chaveMes) &&
    x.status === 'pago'
  );
  const dasPago = pagoManual || pagoDetectado;
  const diasParaDAS = Math.ceil((vencDAS - hoje) / 86400000);
  const dasStatus = dasPago ? 'pago' : (diasParaDAS < 0 ? 'atrasado' : 'pendente');

  // --- Declaração anual ---
  const [mesDec, diaDec] = String(params.prazoDeclaracao || '05-31').split('-').map(Number);
  // a declaração entregue no ano X refere-se ao ano X-1
  const anoRef = ano - 1;
  const prazoDec = new Date(ano, (mesDec || 5) - 1, diaDec || 31);
  const decEntregue = !!params.declaracoesEntregues[String(anoRef)];
  const diasParaDec = Math.ceil((prazoDec - hoje) / 86400000);
  const decStatus = decEntregue ? 'entregue' : (diasParaDec < 0 ? 'atrasada' : 'pendente');

  // --- Comparativo com o ano anterior ---
  const anoPassado = ano - 1;
  const fatAnoPassado = finEmpresa
    .filter(x => x.tipo === 'entrada' && x.status === 'pago' && String(x.data || '').startsWith(String(anoPassado)))
    .reduce((a, b) => a + (Number(b.valor) || 0), 0);
  const crescimento = fatAnoPassado > 0
    ? ((faturamentoAno - fatAnoPassado) / fatAnoPassado) * 100
    : (faturamentoAno > 0 ? 100 : 0);

  // --- Status geral do painel ---
  let statusGeral = faixa; // baseado no limite
  if (dasStatus === 'atrasado' || decStatus === 'atrasada') {
    statusGeral = { nivel: 'risco', label: 'Risco fiscal', cor: '#DC2626' };
  }

  return {
    ano, mesAtual, temLimite,
    faturamentoAno, limiteAnual: params.limiteAnual, pctLimite, restante, faixa,
    porMes, mediaMensal, projecaoAnual,
    mesEstouro, mesEstouroNome: mesEstouro !== null ? MESES_PT[mesEstouro] : null,
    das: {
      valor: params.valorImposto, nome: params.nomeImposto,
      vencimento: vencDAS, diasRestantes: diasParaDAS,
      status: dasStatus, chaveMes, pagoDetectado,
    },
    declaracao: {
      nome: params.declaracaoAnual, anoRef,
      prazo: prazoDec, diasRestantes: diasParaDec, status: decStatus,
    },
    comparativo: { anoAtual: faturamentoAno, anoAnterior: fatAnoPassado, crescimento },
    statusGeral,
  };
}

/**
 * Alertas inteligentes — só o que é relevante, sem poluir.
 * Regras determinísticas (nada de IA externa).
 */
export function alertasFiscais(fiscal, finEmpresa = []) {
  const out = [];

  // limite
  if (fiscal.temLimite) {
    if (fiscal.pctLimite >= 100) {
      out.push({ nivel: 'critico', txt: `Você ultrapassou o limite anual do ${fiscal.faixa.label === 'Risco fiscal' ? 'regime' : 'regime'}. Procure seu contador com urgência para regularizar o enquadramento.` });
    } else if (fiscal.pctLimite >= 80) {
      out.push({ nivel: 'alerta', txt: `Você já utilizou ${fiscal.pctLimite.toFixed(0)}% do limite anual de faturamento.` });
    } else if (fiscal.pctLimite >= 60) {
      out.push({ nivel: 'info', txt: `Você utilizou ${fiscal.pctLimite.toFixed(0)}% do limite anual — acompanhe de perto.` });
    }
  }

  // projeção de desenquadramento
  if (fiscal.mesEstouroNome && fiscal.pctLimite < 100) {
    out.push({ nivel: 'alerta', txt: `No ritmo atual, sua empresa atinge o limite em ${fiscal.mesEstouroNome}. Vale conversar com o contador sobre a mudança de regime.` });
  }

  // DAS
  if (fiscal.das.status === 'atrasado') {
    out.push({ nivel: 'critico', txt: `O ${fiscal.das.nome} deste mês está atrasado (venceu em ${fiscal.das.vencimento.toLocaleDateString('pt-BR')}). Juros e multa incidem sobre o valor.` });
  } else if (fiscal.das.status === 'pendente' && fiscal.das.diasRestantes <= 10) {
    out.push({ nivel: 'alerta', txt: `Faltam ${fiscal.das.diasRestantes} dia(s) para o vencimento do ${fiscal.das.nome}.` });
  }

  // declaração
  if (fiscal.declaracao.status === 'atrasada') {
    out.push({ nivel: 'critico', txt: `A ${fiscal.declaracao.nome} do ano ${fiscal.declaracao.anoRef} está atrasada. Há multa por atraso na entrega.` });
  } else if (fiscal.declaracao.status === 'pendente' && fiscal.declaracao.diasRestantes <= 60) {
    out.push({ nivel: 'alerta', txt: `Faltam ${fiscal.declaracao.diasRestantes} dia(s) para entregar a ${fiscal.declaracao.nome} referente a ${fiscal.declaracao.anoRef}.` });
  }

  // crescimento
  if (Math.abs(fiscal.comparativo.crescimento) >= 20 && fiscal.comparativo.anoAnterior > 0) {
    const c = fiscal.comparativo.crescimento;
    out.push({
      nivel: c > 0 ? 'info' : 'alerta',
      txt: `Seu faturamento ${c > 0 ? 'cresceu' : 'caiu'} ${Math.abs(c).toFixed(0)}% em relação ao mesmo período do ano passado.`,
    });
  }

  // recebimentos pendentes altos
  const aReceber = finEmpresa
    .filter(x => x.tipo === 'entrada' && (x.status === 'pendente' || x.status === 'vencido'))
    .reduce((a, b) => a + (Number(b.valor) || 0), 0);
  if (aReceber > 0 && fiscal.faturamentoAno > 0 && aReceber / fiscal.faturamentoAno > 0.25) {
    out.push({ nivel: 'alerta', txt: `Você tem um volume alto a receber em aberto. Ao entrar no caixa, isso também conta para o limite anual.` });
  }

  return out;
}

/**
 * Checklist fiscal — visão rápida de conformidade.
 */
export function checklistFiscal(fiscal) {
  return [
    { ok: fiscal.das.status === 'pago',            txt: `${fiscal.das.nome} do mês pago`,        pend: `${fiscal.das.nome} do mês ${fiscal.das.status === 'atrasado' ? 'atrasado' : 'pendente'}` },
    { ok: fiscal.declaracao.status === 'entregue', txt: `${fiscal.declaracao.nome} entregue`,     pend: `${fiscal.declaracao.nome} ${fiscal.declaracao.status === 'atrasada' ? 'atrasada' : 'pendente'}` },
    { ok: !fiscal.temLimite || fiscal.pctLimite < 80, txt: 'Limite de faturamento saudável',      pend: `Limite em ${fiscal.pctLimite.toFixed(0)}% — atenção` },
    { ok: !fiscal.mesEstouroNome,                  txt: 'Sem risco de desenquadramento',          pend: `Projeção indica estouro em ${fiscal.mesEstouroNome}` },
  ];
}

/**
 * Calendário fiscal — próximas obrigações em ordem cronológica.
 */
export function calendarioFiscal(fiscal, hoje = new Date()) {
  const itens = [];

  // DAS do mês atual (se ainda não pago)
  if (fiscal.das.status !== 'pago') {
    itens.push({
      id: 'das-atual',
      titulo: `Pagamento ${fiscal.das.nome}`,
      sub: `Competência ${fiscal.das.chaveMes}`,
      data: fiscal.das.vencimento,
      dias: fiscal.das.diasRestantes,
      status: fiscal.das.status,
      valor: fiscal.das.valor,
    });
  }
  // DAS dos próximos 3 meses
  for (let i = 1; i <= 3; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, fiscal.das.vencimento.getDate());
    itens.push({
      id: `das-${i}`,
      titulo: `Pagamento ${fiscal.das.nome}`,
      sub: `Competência ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      data: d,
      dias: Math.ceil((d - hoje) / 86400000),
      status: 'futuro',
      valor: fiscal.das.valor,
    });
  }
  // Declaração anual
  if (fiscal.declaracao.status !== 'entregue') {
    itens.push({
      id: 'declaracao',
      titulo: `Entrega da ${fiscal.declaracao.nome}`,
      sub: `Referente ao ano ${fiscal.declaracao.anoRef}`,
      data: fiscal.declaracao.prazo,
      dias: fiscal.declaracao.diasRestantes,
      status: fiscal.declaracao.status,
    });
  }

  return itens.sort((a, b) => a.data - b.data);
}
