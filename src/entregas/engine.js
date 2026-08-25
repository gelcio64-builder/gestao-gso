// ============================================================
// MÓDULO ENTREGAS — Motor de cálculo (funções puras)
// ------------------------------------------------------------
// Mesmo padrão do src/fiscal/engine.js: nada de React aqui, só
// entrada → saída. Facilita testar e evita recálculo escondido
// dentro de componente.
//
// PRINCÍPIO CENTRAL — TARIFA CARIMBADA
// Toda coleta e toda rota guardam a tarifa e o modo de pagamento
// vigentes no momento em que foram criadas (campo `snapshot`).
// Se o dono mudar a tarifa depois, o passado NÃO é recalculado.
// As funções abaixo sempre preferem o snapshot; só caem no valor
// configurado hoje quando o registro é novo (ainda sem snapshot).
// ============================================================

import {
  MODO_PAGAMENTO, BASE_ENTREGA, BASE_COLETA,
  ENT_CONFIG_OPERACIONAL_DEFAULT, ENT_CONFIG_COMERCIAL_DEFAULT,
} from './constants';

// ------------------------------------------------------------
// Helpers básicos
// ------------------------------------------------------------
const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const int = (v) => Math.max(0, Math.round(n(v)));
const r2 = (v) => Math.round(n(v) * 100) / 100;

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Lê os dois docs de config, aplicando defaults. `entConfig` é o array vindo do sync. */
export function getConfigEntregas(entConfig = []) {
  const find = (id) => (entConfig || []).find((c) => c.id === id) || {};
  return {
    operacional: { ...ENT_CONFIG_OPERACIONAL_DEFAULT, ...find('operacional') },
    comercial: { ...ENT_CONFIG_COMERCIAL_DEFAULT, ...find('comercial') },
  };
}

// ------------------------------------------------------------
// Tarifas
// ------------------------------------------------------------
// entTarifas guarda um doc por lojista e um por motoboy:
//   { id, tipo: 'lojista'|'motoboy', refId, ...valores, vigenciaInicio, historico[] }
// Quando não existe doc, vale o padrão da empresa.

/**
 * Tarifa de um lojista para uma plataforma específica.
 *
 * A loja é uma só, mas cada marketplace dentro dela paga um valor diferente:
 * a Alexs Shops pode pagar R$ 10 no Mercado Livre e R$ 8 na Amazon. Por isso
 * a busca é em três degraus:
 *   1. valor daquela plataforma naquele lojista
 *   2. valor geral daquele lojista (plataforma sem preço próprio)
 *   3. padrão da empresa
 */
export function tarifaDoLojista(lojistaId, plataforma, entTarifas = [], cfgComercial = {}) {
  const t = (entTarifas || []).find((x) => x.tipo === 'lojista' && x.refId === lojistaId);
  const porPlat = t?.porPlataforma || {};
  const daPlat = plataforma != null && porPlat[plataforma] != null ? n(porPlat[plataforma]) : null;
  const geral = t && t.valorPacote != null ? n(t.valorPacote) : null;

  return {
    valorPacote: daPlat != null ? daPlat : (geral != null ? geral : n(cfgComercial.tarifaLojistaPadrao)),
    valorMinimo: t && t.valorMinimo != null ? n(t.valorMinimo) : n(cfgComercial.valorMinimoPadrao),
    personalizada: !!t,
    especificaDaPlataforma: daPlat != null,
    porPlataforma: porPlat,
    geral,
  };
}

/**
 * Normaliza os itens de uma coleta.
 *
 * Coletas novas trazem `itens: [{ plataforma, qtd, qtdConfirmada }]` — uma
 * mesma retirada pode ter pacotes de vários marketplaces. Coletas antigas
 * têm um único `plataforma` + `qtdInformada`; aqui elas viram um item só,
 * para que todo o resto do sistema enxergue um formato único.
 */
export function itensColeta(coleta = {}) {
  if (Array.isArray(coleta.itens) && coleta.itens.length) {
    return coleta.itens.map((i) => ({
      plataforma: i.plataforma || '',
      qtd: int(i.qtd),
      qtdConfirmada: i.qtdConfirmada == null ? null : int(i.qtdConfirmada),
      tarifa: i.tarifa == null ? null : n(i.tarifa),
    }));
  }
  return [{
    plataforma: coleta.plataforma || '',
    qtd: int(coleta.qtdInformada),
    qtdConfirmada: coleta.qtdConfirmada == null ? null : int(coleta.qtdConfirmada),
    tarifa: coleta.snapshot?.tarifaLojista == null ? null : n(coleta.snapshot.tarifaLojista),
  }];
}

export function totalInformado(coleta = {}) {
  return itensColeta(coleta).reduce((s, i) => s + i.qtd, 0);
}

export function totalConfirmado(coleta = {}) {
  const itens = itensColeta(coleta);
  if (itens.every((i) => i.qtdConfirmada == null)) return null;
  return itens.reduce((s, i) => s + (i.qtdConfirmada == null ? i.qtd : i.qtdConfirmada), 0);
}

export function tarifaDoMotoboy(motoboyId, entTarifas = [], cfgComercial = {}) {
  const t = (entTarifas || []).find((x) => x.tipo === 'motoboy' && x.refId === motoboyId);
  return {
    valorEntrega: t && t.valorEntrega != null ? n(t.valorEntrega) : n(cfgComercial.tarifaEntregaPadrao),
    valorColeta: t && t.valorColeta != null ? n(t.valorColeta) : n(cfgComercial.tarifaColetaPadrao),
    modoPagamento: t && t.modoPagamento ? t.modoPagamento : (cfgComercial.modoPagamento || MODO_PAGAMENTO.ENTREGA),
    personalizada: !!t,
  };
}

/** Carimbo gravado numa COLETA no instante da criação. */
export function snapshotColeta(coleta, entTarifas, cfgComercial) {
  const lojistaId = coleta?.lojistaId;
  const motoboyId = coleta?.motoboyId;
  const tm = tarifaDoMotoboy(motoboyId, entTarifas, cfgComercial);
  const itens = itensColeta(coleta);

  // Uma tarifa por marketplace, congelada agora.
  const tarifasPorItem = {};
  itens.forEach((i) => {
    tarifasPorItem[i.plataforma || '—'] =
      tarifaDoLojista(lojistaId, i.plataforma, entTarifas, cfgComercial).valorPacote;
  });

  const primeira = tarifaDoLojista(lojistaId, itens[0]?.plataforma, entTarifas, cfgComercial);

  return {
    tarifasPorItem,
    // Mantido para compatibilidade com coletas de plataforma única.
    tarifaLojista: primeira.valorPacote,
    valorMinimoLojista: primeira.valorMinimo,
    tarifaColetaMotoboy: tm.modoPagamento === MODO_PAGAMENTO.COLETA_ENTREGA ? tm.valorColeta : 0,
    modoPagamento: tm.modoPagamento,
    baseColeta: cfgComercial.baseColeta || BASE_COLETA.CONFIRMADA,
    carimbadoEm: new Date().toISOString(),
  };
}

/** Carimbo gravado numa ROTA de entrega no instante da atribuição. */
export function snapshotRota(motoboyId, entTarifas, cfgComercial) {
  const tm = tarifaDoMotoboy(motoboyId, entTarifas, cfgComercial);
  return {
    tarifaEntregaMotoboy: tm.valorEntrega,
    modoPagamento: tm.modoPagamento,
    baseEntrega: cfgComercial.baseEntrega || BASE_ENTREGA.CONCLUIDA,
    carimbadoEm: new Date().toISOString(),
  };
}

// ------------------------------------------------------------
// Quantidades que valem dinheiro
// ------------------------------------------------------------
// A coleta guarda SEMPRE qtdInformada (motoboy) e qtdConfirmada (lojista).
// A rota guarda SEMPRE qtdAtribuida e qtdConcluida.
// Qual das duas vira dinheiro é decisão de configuração — e o snapshot
// preserva a decisão vigente na época.

export function qtdCobravelColeta(coleta = {}, cfgComercial = {}) {
  const base = coleta.snapshot?.baseColeta || cfgComercial.baseColeta || BASE_COLETA.CONFIRMADA;
  const itens = itensColeta(coleta);
  if (base === BASE_COLETA.INFORMADA) return itens.reduce((s, i) => s + i.qtd, 0);
  // Confirmada: enquanto o lojista não confirmar, vale a informada (previsão).
  return itens.reduce((s, i) => s + (i.qtdConfirmada == null ? i.qtd : i.qtdConfirmada), 0);
}

export function qtdPagavelColeta(coleta = {}, cfgComercial = {}) {
  return qtdCobravelColeta(coleta, cfgComercial);
}

export function qtdPagavelRota(rota = {}, cfgComercial = {}) {
  const base = rota.snapshot?.baseEntrega || cfgComercial.baseEntrega || BASE_ENTREGA.CONCLUIDA;
  if (base === BASE_ENTREGA.ATRIBUIDA) return int(rota.qtdAtribuida);
  return int(rota.qtdConcluida);
}

/** Diferença entre o que o motoboy disse e o que o lojista confirmou. */
export function divergenciaColeta(coleta = {}) {
  const conf = totalConfirmado(coleta);
  if (conf == null) return null;
  return conf - totalInformado(coleta);
}

export function statusConciliacao(coleta = {}) {
  if (coleta.conciliacaoStatus === 'corrigida') return 'corrigida';
  if (totalConfirmado(coleta) == null) return 'pendente';
  return divergenciaColeta(coleta) === 0 ? 'conciliada' : 'divergente';
}

// ------------------------------------------------------------
// Cobrança do lojista
// ------------------------------------------------------------
/**
 * Regra do item 6: cobra-se o MAIOR valor entre (qtd × tarifa) e o valor mínimo.
 * O mínimo é por COLETA, não por período — um lojista pequeno e distante não
 * pode sair por R$ 30 só porque mandou 3 pacotes naquele dia.
 */
export function cobrancaDeUmaColeta(coleta = {}, cfgComercial = {}, entTarifas = []) {
  const base = coleta.snapshot?.baseColeta || cfgComercial.baseColeta || BASE_COLETA.CONFIRMADA;
  const usarConfirmada = base !== BASE_COLETA.INFORMADA;
  const snapTar = coleta.snapshot?.tarifasPorItem || null;

  const detalhe = itensColeta(coleta).map((i) => {
    const qtd = usarConfirmada && i.qtdConfirmada != null ? i.qtdConfirmada : i.qtd;
    // Ordem de preferência da tarifa: o que está carimbado no item, o que
    // ficou no snapshot da coleta, e só então a tabela de hoje.
    let tarifa = i.tarifa;
    if (tarifa == null && snapTar && snapTar[i.plataforma || '—'] != null) {
      tarifa = n(snapTar[i.plataforma || '—']);
    }
    if (tarifa == null) {
      tarifa = tarifaDoLojista(coleta.lojistaId, i.plataforma, entTarifas, cfgComercial).valorPacote;
    }
    return { plataforma: i.plataforma, qtd, tarifa: n(tarifa), subtotal: r2(qtd * n(tarifa)) };
  });

  const qtd = detalhe.reduce((s, d) => s + d.qtd, 0);
  const bruto = r2(detalhe.reduce((s, d) => s + d.subtotal, 0));

  const minimo = coleta.snapshot?.valorMinimoLojista != null
    ? n(coleta.snapshot.valorMinimoLojista)
    : n(cfgComercial.valorMinimoPadrao);

  // O mínimo vale por VIAGEM, não por marketplace: 3 pacotes do Mercado Livre
  // mais 2 da Shopee é uma coleta só, e cobra um mínimo só.
  const usouMinimo = minimo > bruto;

  // Tarifa média, usada só para exibição em telas de uma linha por coleta.
  const tarifaMedia = qtd > 0 ? r2(bruto / qtd) : 0;

  return {
    qtd, detalhe, tarifa: tarifaMedia, bruto, minimo,
    total: r2(usouMinimo ? minimo : bruto), usouMinimo,
  };
}

export function cobrancaDoLojista(coletas = [], cfgComercial = {}, entTarifas = []) {
  const linhas = coletas.map((c) => ({
    coletaId: c.id, data: c.data, ...cobrancaDeUmaColeta(c, cfgComercial, entTarifas),
  }));
  return {
    linhas,
    qtdTotal: linhas.reduce((s, l) => s + l.qtd, 0),
    total: r2(linhas.reduce((s, l) => s + l.total, 0)),
    coletasComMinimo: linhas.filter((l) => l.usouMinimo).length,
  };
}

// ------------------------------------------------------------
// Repasse ao motoboy
// ------------------------------------------------------------
/**
 * Dois modos convivem no mesmo app (decisão de produto do Gelcio):
 *   ENTREGA        → paga só a entrega; a coleta está embutida no valor.
 *   COLETA_ENTREGA → paga coleta e entrega separadamente.
 * O modo vem do snapshot de cada registro, então um fechamento antigo
 * continua correto mesmo depois de a empresa trocar de modelo.
 */
export function repasseDoMotoboy({ coletas = [], rotas = [], cfgComercial = {} } = {}) {
  const linhasEntrega = rotas.map((rt) => {
    const qtd = qtdPagavelRota(rt, cfgComercial);
    const tarifa = rt.snapshot?.tarifaEntregaMotoboy != null
      ? n(rt.snapshot.tarifaEntregaMotoboy)
      : n(cfgComercial.tarifaEntregaPadrao);
    return { rotaId: rt.id, data: rt.data, qtd, tarifa, total: r2(qtd * tarifa) };
  });

  const linhasColeta = coletas
    .filter((c) => {
      const modo = c.snapshot?.modoPagamento || cfgComercial.modoPagamento;
      return modo === MODO_PAGAMENTO.COLETA_ENTREGA;
    })
    .map((c) => {
      const qtd = qtdPagavelColeta(c, cfgComercial);
      const tarifa = n(c.snapshot?.tarifaColetaMotoboy ?? cfgComercial.tarifaColetaPadrao);
      return { coletaId: c.id, data: c.data, qtd, tarifa, total: r2(qtd * tarifa) };
    });

  const valorEntregas = r2(linhasEntrega.reduce((s, l) => s + l.total, 0));
  const valorColetas = r2(linhasColeta.reduce((s, l) => s + l.total, 0));

  return {
    linhasEntrega,
    linhasColeta,
    qtdEntregas: linhasEntrega.reduce((s, l) => s + l.qtd, 0),
    qtdColetas: linhasColeta.reduce((s, l) => s + l.qtd, 0),
    valorEntregas,
    valorColetas,
    total: r2(valorEntregas + valorColetas),
  };
}

// ------------------------------------------------------------
// Saldo e status do repasse — o item 17 do prompt
// ------------------------------------------------------------
// REGRA SAGRADA: o valor devido NUNCA é substituído pelo valor pago.
// São dois campos independentes; o saldo é derivado, nunca armazenado
// como verdade única. Assim a auditoria sempre consegue reconstruir.

export function somaPagamentos(pagamentos = [], fechamentoId) {
  return r2(
    (pagamentos || [])
      .filter((p) => !fechamentoId || p.fechamentoId === fechamentoId)
      .reduce((s, p) => s + n(p.valor), 0)
  );
}

export function saldoRepasse(devido, pago) {
  return r2(n(devido) - n(pago));
}

export function statusRepasse(devido, pago, vencimentoISO) {
  const d = r2(devido);
  const p = r2(pago);
  if (d <= 0) return 'pago';
  if (p >= d) return 'pago';
  const vencido = vencimentoISO && vencimentoISO < todayISO();
  if (p <= 0) return vencido ? 'vencido' : 'pendente';
  return vencido ? 'vencido' : 'parcial';
}

// ------------------------------------------------------------
// Períodos de fechamento
// ------------------------------------------------------------
function ultimoDiaDoMes(ano, mes /* 1-12 */) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

const pad = (v) => String(v).padStart(2, '0');

/** Devolve os períodos de um mês conforme o ciclo configurado. */
export function periodosDoMes(ano, mes, cfgComercial = {}) {
  const ciclo = cfgComercial.ciclo || 'quinzenal';
  const fim = ultimoDiaDoMes(ano, mes);
  const iso = (d) => `${ano}-${pad(mes)}-${pad(d)}`;

  if (ciclo === 'mensal') {
    return [{ chave: `${ano}-${pad(mes)}-M`, inicio: iso(1), fim: iso(fim), label: `${pad(mes)}/${ano}` }];
  }
  if (ciclo === 'semanal') {
    const out = [];
    let d = 1;
    while (d <= fim) {
      const ate = Math.min(d + 6, fim);
      out.push({ chave: `${ano}-${pad(mes)}-S${out.length + 1}`, inicio: iso(d), fim: iso(ate), label: `${pad(d)}–${pad(ate)}/${pad(mes)}` });
      d = ate + 1;
    }
    return out;
  }
  return [
    { chave: `${ano}-${pad(mes)}-Q1`, inicio: iso(1), fim: iso(15), label: `01–15/${pad(mes)}` },
    { chave: `${ano}-${pad(mes)}-Q2`, inicio: iso(16), fim: iso(fim), label: `16–${pad(fim)}/${pad(mes)}` },
  ];
}

/** Em qual período cai uma data. */
export function periodoDaData(dataISO, cfgComercial = {}) {
  if (!dataISO) return null;
  const [a, m] = dataISO.split('-').map(Number);
  if (!a || !m) return null;
  return periodosDoMes(a, m, cfgComercial).find((p) => dataISO >= p.inicio && dataISO <= p.fim) || null;
}

export function periodoAtual(cfgComercial = {}) {
  return periodoDaData(todayISO(), cfgComercial);
}

/** Vencimento da cobrança de um fechamento. */
export function vencimentoCobranca(periodo, cfgComercial = {}) {
  if (!periodo) return '';
  const prazo = int(cfgComercial.prazoPagamentoDias);
  const base = new Date(`${periodo.fim}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + prazo);
  return base.toISOString().slice(0, 10);
}

export function dentroDoPeriodo(dataISO, periodo) {
  return !!dataISO && !!periodo && dataISO >= periodo.inicio && dataISO <= periodo.fim;
}

// ------------------------------------------------------------
// Indicadores do painel operacional
// ------------------------------------------------------------
export function indicadoresOperacao({ coletas = [], rotas = [], periodo = null, cfgComercial = {} } = {}) {
  const cs = periodo ? coletas.filter((c) => dentroDoPeriodo(c.data, periodo)) : coletas;
  const rs = periodo ? rotas.filter((r) => dentroDoPeriodo(r.data, periodo)) : rotas;

  const coletados = cs.reduce((s, c) => s + totalInformado(c), 0);
  const recebidos = cs.filter((c) => c.recebidoNaBase).reduce((s, c) => s + qtdCobravelColeta(c, cfgComercial), 0);
  const atribuidos = rs.reduce((s, r) => s + int(r.qtdAtribuida), 0);
  const entregues = rs.reduce((s, r) => s + int(r.qtdConcluida), 0);
  const pendentes = Math.max(0, atribuidos - entregues);
  const ocorrencias = rs.reduce((s, r) => s + int(r.qtdOcorrencia), 0);

  return {
    coletados,
    recebidos,
    atribuidos,
    entregues,
    pendentes,
    ocorrencias,
    rotasAndamento: rs.filter((r) => r.status === 'andamento').length,
    motoboysAtivos: new Set(rs.filter((r) => r.status === 'andamento').map((r) => r.motoboyId)).size,
    taxaSucesso: atribuidos > 0 ? r2((entregues / atribuidos) * 100) : 0,
    divergencias: cs.filter((c) => statusConciliacao(c) === 'divergente').length,
    conciliacoesPendentes: cs.filter((c) => statusConciliacao(c) === 'pendente').length,
  };
}

/**
 * Resultado da operação — receita dos lojistas menos repasse aos motoboys.
 * ATENÇÃO: isto é MARGEM OPERACIONAL, não lucro. Combustível, aluguel,
 * impostos e salários continuam no Financeiro Empresa. A UI precisa deixar
 * isso explícito para o dono não se enganar.
 */
export function resultadoOperacao({ coletas = [], rotas = [], periodo = null, cfgComercial = {}, entTarifas = [] } = {}) {
  const cs = periodo ? coletas.filter((c) => dentroDoPeriodo(c.data, periodo)) : coletas;
  const rs = periodo ? rotas.filter((r) => dentroDoPeriodo(r.data, periodo)) : rotas;
  const receita = cobrancaDoLojista(cs, cfgComercial, entTarifas).total;
  const repasse = repasseDoMotoboy({ coletas: cs, rotas: rs, cfgComercial }).total;
  return {
    receita,
    repasse,
    margem: r2(receita - repasse),
    margemPct: receita > 0 ? r2(((receita - repasse) / receita) * 100) : 0,
  };
}

// ------------------------------------------------------------
// Código de convite do motoboy
// ------------------------------------------------------------
// Sem I, O, 0 e 1 — o dono vai ditar isso no WhatsApp ou no telefone.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function gerarCodigoConvite() {
  const buf = new Uint8Array(6);
  (globalThis.crypto || window.crypto).getRandomValues(buf);
  const corpo = Array.from(buf).map((b) => ALFABETO[b % ALFABETO.length]).join('');
  return `MB-${corpo}`;
}

// ------------------------------------------------------------
// Auditoria
// ------------------------------------------------------------
/** Acrescenta uma entrada ao histórico de um documento, sem apagar nada. */
export function registrarHistorico(doc = {}, { acao, campo, de, para, motivo, uid, nome }) {
  const entrada = {
    acao,
    campo: campo || '',
    de: de === undefined ? null : de,
    para: para === undefined ? null : para,
    motivo: motivo || '',
    uid: uid || '',
    nome: nome || '',
    em: new Date().toISOString(),
  };
  return { ...doc, historico: [...(doc.historico || []), entrada] };
}

// ------------------------------------------------------------
// Conta corrente do LOJISTA
// ------------------------------------------------------------
// Os recebimentos ficam num array dentro do próprio fechamento —
// não numa coleção nova. Assim o valor devido e o que já entrou
// vivem juntos, e continua valendo a regra de ouro: o total do
// fechamento NUNCA é reduzido pelo pagamento. O saldo é derivado.

export function somaRecebimentos(fechamento = {}) {
  return r2((fechamento.recebimentos || []).reduce((s, x) => s + n(x.valor), 0));
}

export function saldoFechamento(fechamento = {}) {
  return r2(n(fechamento.total) - somaRecebimentos(fechamento));
}

export function statusFechamentoLojista(fechamento = {}) {
  if (!fechamento || !fechamento.id) return 'aberto';
  const total = n(fechamento.total);
  const pago = somaRecebimentos(fechamento);
  if (total > 0 && pago >= total - 0.009) return 'quitado';
  const vencido = fechamento.vencimento && fechamento.vencimento < todayISO();
  if (pago > 0) return vencido ? 'vencido' : 'parcial';
  return vencido ? 'vencido' : 'cobrado';
}

/** Data em que o fechamento foi quitado (último recebimento que fechou a conta). */
export function dataQuitacao(fechamento = {}) {
  if (statusFechamentoLojista(fechamento) !== 'quitado') return null;
  const recs = [...(fechamento.recebimentos || [])].sort((a, b) =>
    String(a.data).localeCompare(String(b.data)));
  return recs.length ? recs[recs.length - 1].data : null;
}

/** Linha do tempo de fechamentos de um lojista, do mais recente ao mais antigo. */
export function historicoLojista(lojistaId, entFechamentos = []) {
  return (entFechamentos || [])
    .filter((f) => f.tipo === 'lojista' && f.refId === lojistaId)
    .map((f) => ({
      ...f,
      pago: somaRecebimentos(f),
      saldo: saldoFechamento(f),
      situacao: statusFechamentoLojista(f),
      quitadoEm: dataQuitacao(f),
      // Tarifa média efetivamente aplicada no período, para exibição.
      tarifaMedia: f.qtdTotal > 0 ? r2(n(f.total) / int(f.qtdTotal)) : 0,
    }))
    .sort((a, b) => String(b.inicio).localeCompare(String(a.inicio)));
}

// ------------------------------------------------------------
// Conta corrente do MOTOBOY
// ------------------------------------------------------------
// Não é uma segunda fonte de dados: é a MESMA apuração da aba
// Repasses, recortada por motoboy e estendida por vários meses.
// Qualquer pagamento registrado lá aparece aqui automaticamente.

/**
 * @param {number} mesesParaTras quantos meses retroceder a partir de hoje
 */
export function historicoRepasses({
  motoboyId, coletas = [], rotas = [], pagamentos = [],
  cfgComercial = {}, mesesParaTras = 6,
} = {}) {
  const hoje = new Date();
  const linhas = [];

  for (let k = 0; k < mesesParaTras; k++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - k, 1);
    const ano = d.getFullYear();
    const mes = d.getMonth() + 1;

    periodosDoMes(ano, mes, cfgComercial).forEach((p) => {
      const cs = coletas.filter((c) => c.motoboyId === motoboyId && dentroDoPeriodo(c.data, p));
      const rs = rotas.filter((r) => r.motoboyId === motoboyId && dentroDoPeriodo(r.data, p));
      const calc = repasseDoMotoboy({ coletas: cs, rotas: rs, cfgComercial });
      const pags = pagamentos.filter((x) => x.motoboyId === motoboyId && x.periodoChave === p.chave);
      const pago = somaPagamentos(pags);

      // Períodos sem movimento e sem pagamento não entram na linha do tempo.
      if (calc.total <= 0 && pago <= 0) return;

      const venc = vencimentoCobranca(p, cfgComercial);
      linhas.push({
        periodo: p,
        ano, mes,
        calc,
        rotas: rs,
        coletas: cs,
        pagamentos: pags,
        pago,
        saldo: saldoRepasse(calc.total, pago),
        situacao: statusRepasse(calc.total, pago, venc),
        vencimento: venc,
        // Tarifa efetivamente praticada no período (média ponderada).
        tarifaMedia: calc.qtdEntregas > 0 ? r2(calc.valorEntregas / calc.qtdEntregas) : 0,
      });
    });
  }

  return linhas.sort((a, b) => String(b.periodo.inicio).localeCompare(String(a.periodo.inicio)));
}

/** Linhas do detalhamento do extrato: uma por rota, com a tarifa da época. */
export function detalheRotasExtrato(rotas = [], cfgComercial = {}) {
  return [...rotas]
    .sort((a, b) => String(a.data).localeCompare(String(b.data)))
    .map((r) => {
      const qtd = qtdPagavelRota(r, cfgComercial);
      const tarifa = r.snapshot?.tarifaEntregaMotoboy != null
        ? n(r.snapshot.tarifaEntregaMotoboy)
        : n(cfgComercial.tarifaEntregaPadrao);
      return {
        data: r.data,
        rotaId: r.id,
        codigo: `R-${String(r.id).slice(-4).toUpperCase()}`,
        regiao: r.regiao || '—',
        base: r.baseNome || '',
        qtd,
        tarifa,
        valor: r2(qtd * tarifa),
      };
    });
}

/** Identificador legível de documento, estável para o mesmo período. */
export function idDocumento(prefixo, refId, periodoChave) {
  const base = `${String(refId || '').slice(-4)}${String(periodoChave || '').replace(/-/g, '')}`;
  return `${prefixo}-${base.toUpperCase()}`;
}

/** Período que cobre o mês inteiro, usado como alternativa às quinzenas. */
export function periodoMesInteiro(ano, mes) {
  const fim = ultimoDiaDoMes(ano, mes);
  const iso = (d) => `${ano}-${pad(mes)}-${pad(d)}`;
  return {
    chave: `${ano}-${pad(mes)}-MES`,
    inicio: iso(1),
    fim: iso(fim),
    label: 'Mês inteiro',
    mensal: true,
  };
}

/**
 * Períodos oferecidos na tela, sempre com a opção de mês inteiro no fim.
 * O ciclo configurado continua mandando no padrão; o mês é uma alternativa
 * para quem prefere fechar de uma vez só.
 */
export function periodosComMes(ano, mes, cfgComercial = {}) {
  const base = periodosDoMes(ano, mes, cfgComercial);
  if (base.length === 1 && base[0].inicio.endsWith('-01')) return base; // ciclo já é mensal
  return [...base, periodoMesInteiro(ano, mes)];
}
