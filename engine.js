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

export function tarifaDoLojista(lojistaId, entTarifas = [], cfgComercial = {}) {
  const t = (entTarifas || []).find((x) => x.tipo === 'lojista' && x.refId === lojistaId);
  return {
    valorPacote: t && t.valorPacote != null ? n(t.valorPacote) : n(cfgComercial.tarifaLojistaPadrao),
    valorMinimo: t && t.valorMinimo != null ? n(t.valorMinimo) : n(cfgComercial.valorMinimoPadrao),
    personalizada: !!t,
  };
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
export function snapshotColeta(lojistaId, motoboyId, entTarifas, cfgComercial) {
  const tl = tarifaDoLojista(lojistaId, entTarifas, cfgComercial);
  const tm = tarifaDoMotoboy(motoboyId, entTarifas, cfgComercial);
  return {
    tarifaLojista: tl.valorPacote,
    valorMinimoLojista: tl.valorMinimo,
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
  if (base === BASE_COLETA.INFORMADA) return int(coleta.qtdInformada);
  // Confirmada: enquanto o lojista não confirmar, cai na informada (previsão).
  return coleta.qtdConfirmada == null ? int(coleta.qtdInformada) : int(coleta.qtdConfirmada);
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
  if (coleta.qtdConfirmada == null) return null;
  return int(coleta.qtdConfirmada) - int(coleta.qtdInformada);
}

export function statusConciliacao(coleta = {}) {
  if (coleta.conciliacaoStatus === 'corrigida') return 'corrigida';
  if (coleta.qtdConfirmada == null) return 'pendente';
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
export function cobrancaDeUmaColeta(coleta = {}, cfgComercial = {}) {
  const qtd = qtdCobravelColeta(coleta, cfgComercial);
  const tarifa = coleta.snapshot?.tarifaLojista != null
    ? n(coleta.snapshot.tarifaLojista)
    : n(cfgComercial.tarifaLojistaPadrao);
  const minimo = coleta.snapshot?.valorMinimoLojista != null
    ? n(coleta.snapshot.valorMinimoLojista)
    : n(cfgComercial.valorMinimoPadrao);
  const bruto = r2(qtd * tarifa);
  const usouMinimo = minimo > bruto;
  return { qtd, tarifa, bruto, minimo, total: r2(usouMinimo ? minimo : bruto), usouMinimo };
}

export function cobrancaDoLojista(coletas = [], cfgComercial = {}) {
  const linhas = coletas.map((c) => ({ coletaId: c.id, data: c.data, ...cobrancaDeUmaColeta(c, cfgComercial) }));
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

  const coletados = cs.reduce((s, c) => s + int(c.qtdInformada), 0);
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
export function resultadoOperacao({ coletas = [], rotas = [], periodo = null, cfgComercial = {} } = {}) {
  const cs = periodo ? coletas.filter((c) => dentroDoPeriodo(c.data, periodo)) : coletas;
  const rs = periodo ? rotas.filter((r) => dentroDoPeriodo(r.data, periodo)) : rotas;
  const receita = cobrancaDoLojista(cs, cfgComercial).total;
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
