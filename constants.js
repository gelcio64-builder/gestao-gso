// ============================================================
// MÓDULO ENTREGAS — Constantes
// ------------------------------------------------------------
// Operação de coleta / base / triagem / distribuição / entrega
// para transportadoras que atendem lojistas de marketplace.
//
// NADA de valor comercial fica fixo aqui: os defaults abaixo são
// apenas o ponto de partida de uma empresa nova. Tudo é editável
// em Configurações → Entregas.
// ============================================================

// ---------- Coleções no Firestore ----------
// Separação proposital entre dados OPERACIONAIS (que o motoboy pode ler)
// e dados COMERCIAIS (tarifas, fechamentos, pagamentos — bloqueados p/ ele).
export const ENT_COLS_OPERACIONAL = [
  'entLojistas',    // cadastro do lojista SEM valores
  'entBases',       // bases próprias e parceiras
  'entMotoboys',    // cadastro do motoboy (uid vinculado ao login)
  'entColetas',     // retiradas nos lojistas
  'entRotas',       // atribuições de entrega após a triagem
  'entComprovantes',// fotos/arquivos enviados pelo motoboy
];

export const ENT_COLS_COMERCIAL = [
  'entTarifas',     // tarifas de lojista e de motoboy (+ histórico)
  'entFechamentos', // fechamentos por quinzena
  'entPagamentos',  // repasses efetivamente pagos aos motoboys
];

export const ENT_COLS = [...ENT_COLS_OPERACIONAL, ...ENT_COLS_COMERCIAL, 'entConfig'];

// entConfig tem dois documentos fixos:
//   'operacional' → o motoboy PODE ler (regiões, plataformas, regras)
//   'comercial'   → o motoboy NÃO lê (tarifas padrão, ciclo, prazos)
export const ENT_CONFIG_DOCS = ['operacional', 'comercial'];

// ---------- Papel ----------
export const ROLE_MOTOBOY = 'motoboy';

// ---------- Plataformas (editáveis) ----------
export const PLATAFORMAS_PADRAO = [
  'Mercado Livre — Envios Flex',
  'Shopee — Entrega Direta',
  'Outros',
];

// ---------- Tipos de base ----------
export const BASE_TIPOS = ['propria', 'parceira'];
export const BASE_TIPO_LABEL = { propria: 'Própria', parceira: 'Parceira' };

// ---------- Modo de pagamento ao motoboy ----------
// O João Pedro paga só a entrega (a coleta está embutida no valor).
// Outras operações pagam coleta e entrega separadamente.
export const MODO_PAGAMENTO = {
  ENTREGA: 'entrega',
  COLETA_ENTREGA: 'coleta_entrega',
};
export const MODO_PAGAMENTO_LABEL = {
  [MODO_PAGAMENTO.ENTREGA]: 'Somente por entrega',
  [MODO_PAGAMENTO.COLETA_ENTREGA]: 'Por coleta + por entrega',
};

// ---------- Base de cálculo (as duas perguntas em aberto) ----------
// Gravamos SEMPRE os dois números; o que muda é qual deles vale dinheiro.
export const BASE_ENTREGA = { ATRIBUIDA: 'atribuida', CONCLUIDA: 'concluida' };
export const BASE_ENTREGA_LABEL = {
  [BASE_ENTREGA.ATRIBUIDA]: 'Volumes atribuídos ao motoboy',
  [BASE_ENTREGA.CONCLUIDA]: 'Volumes efetivamente entregues',
};

export const BASE_COLETA = { INFORMADA: 'informada', CONFIRMADA: 'confirmada' };
export const BASE_COLETA_LABEL = {
  [BASE_COLETA.INFORMADA]: 'Quantidade informada pelo motoboy',
  [BASE_COLETA.CONFIRMADA]: 'Quantidade confirmada pelo lojista',
};

// ---------- Status ----------
export const COLETA_STATUS = [
  { k: 'pendente',   label: 'Aguardando conferência', cor: '#CA8A04', bg: '#FEF9C3' },
  { k: 'conciliada', label: 'Conciliada',             cor: '#047857', bg: '#D1FAE5' },
  { k: 'divergente', label: 'Divergente',             cor: '#B91C1C', bg: '#FEE2E2' },
  { k: 'corrigida',  label: 'Corrigida',              cor: '#1D4ED8', bg: '#DBEAFE' },
];

export const ROTA_STATUS = [
  { k: 'atribuida', label: 'Atribuída',    cor: '#CA8A04', bg: '#FEF9C3' },
  { k: 'andamento', label: 'Em andamento', cor: '#1D4ED8', bg: '#DBEAFE' },
  { k: 'concluida', label: 'Concluída',    cor: '#047857', bg: '#D1FAE5' },
  { k: 'cancelada', label: 'Cancelada',    cor: '#6B7280', bg: '#F3F4F6' },
];

export const FECHAMENTO_STATUS = [
  { k: 'aberto',      label: 'Em aberto',           cor: '#CA8A04', bg: '#FEF9C3' },
  { k: 'fechado',     label: 'Fechado',             cor: '#1D4ED8', bg: '#DBEAFE' },
  { k: 'cobrado',     label: 'Cobrado',             cor: '#7C3AED', bg: '#EDE9FE' },
  { k: 'parcial',     label: 'Parcialmente pago',   cor: '#EA580C', bg: '#FFEDD5' },
  { k: 'quitado',     label: 'Quitado',             cor: '#047857', bg: '#D1FAE5' },
  { k: 'vencido',     label: 'Vencido',             cor: '#B91C1C', bg: '#FEE2E2' },
];

export const REPASSE_STATUS = [
  { k: 'pendente', label: 'Pendente',           cor: '#CA8A04', bg: '#FEF9C3' },
  { k: 'parcial',  label: 'Parcialmente pago',  cor: '#EA580C', bg: '#FFEDD5' },
  { k: 'pago',     label: 'Pago',               cor: '#047857', bg: '#D1FAE5' },
  { k: 'vencido',  label: 'Vencido',            cor: '#B91C1C', bg: '#FEE2E2' },
];

export const FORMAS_REPASSE = ['PIX', 'Transferência', 'Dinheiro', 'Outro'];

// ---------- Ciclo de fechamento ----------
export const CICLOS = [
  { k: 'quinzenal', label: 'Quinzenal (01–15 / 16–fim do mês)' },
  { k: 'mensal',    label: 'Mensal (dia 01 ao fim do mês)' },
  { k: 'semanal',   label: 'Semanal (segunda a domingo)' },
];

// ---------- Categorias financeiras do módulo ----------
// Usadas na ponte com o Financeiro Empresa.
export const CAT_RECEITA_ENTREGAS = 'Receita de Entregas';
export const CAT_REPASSE_MOTOBOYS = 'Repasse Motoboys';

// ---------- Defaults de configuração ----------
export const ENT_CONFIG_OPERACIONAL_DEFAULT = {
  plataformas: [...PLATAFORMAS_PADRAO],
  regioes: [],                     // [{ id, nome, descricao, ativo }]
  comprovanteObrigatorio: true,
  permitirColetaSemBase: false,
  ativo: false,                    // o módulo só aparece quando a empresa ativa
};

export const ENT_CONFIG_COMERCIAL_DEFAULT = {
  // Pagamento ao motoboy
  modoPagamento: MODO_PAGAMENTO.ENTREGA,
  tarifaEntregaPadrao: 6.5,
  tarifaColetaPadrao: 0,
  baseEntrega: BASE_ENTREGA.CONCLUIDA,
  baseColeta: BASE_COLETA.CONFIRMADA,

  // Cobrança do lojista
  tarifaLojistaPadrao: 10,
  valorMinimoPadrao: 0,

  // Ciclo
  ciclo: 'quinzenal',
  diaCobranca: 19,
  prazoPagamentoDias: 5,

  // Governança
  permitirTarifaExcepcional: true,
  exigirJustificativaTarifa: true,
  bloquearFechamentoComPendencia: true,
};
