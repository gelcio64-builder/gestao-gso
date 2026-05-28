import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard, Wallet, Truck, Car, Fuel, Wrench, Users,
  FileSignature, FolderOpen, BarChart3, Settings, Plus, Pencil,
  Trash2, X, Menu as MenuIcon, TrendingUp, TrendingDown,
  AlertTriangle, MapPin, Route, ArrowUpRight, ArrowDownRight,
  Activity, Clock, Coins, Receipt, ChevronRight, ChevronDown, CircleAlert, Sun, Phone,
  Trophy, Flame, Lightbulb, Percent, Calendar,
  Home, ShoppingCart, CreditCard, Heart, GraduationCap, Target, PiggyBank, Gauge, Sparkles
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart, LineChart, Line, PieChart, Pie, Cell
} from 'recharts';

/* ============================================================
   GESTÃO GSO — v2.1
   IMPORTANTE: cores via CSS real (variáveis + classes), pois o
   artifact não tem compilador Tailwind p/ valores arbitrários.
   Layout usa apenas utilitários core do Tailwind. Lógica preservada.
   ============================================================ */

// ---------- Constants ----------
const CAT_FIN_EMPRESA = {
  entrada: ['Pagamento Prefeitura', 'Frete', 'Carreto', 'Serviço Avulso', 'Venda de Materiais', 'Contrato', 'Outros'],
  saida: ['Combustível', 'Manutenção', 'Pneus', 'Seguro', 'IPVA/Documentação', 'Parcela', 'Salário/Motorista', 'Pedágio', 'Impostos', 'Compra de Materiais', 'Outros'],
};
const FORMAS_PGTO = ['Dinheiro', 'PIX', 'Transferência', 'Cartão Débito', 'Cartão Crédito', 'Boleto'];
const TIPOS_LINHA = ['Linha Fixa', 'Carreto', 'Frete Avulso', 'Licitação', 'Contrato'];
const CAT_MANUT = ['Troca de Óleo', 'Pneus', 'Suspensão', 'Alinhamento', 'Balanceamento', 'Freios', 'Motor', 'Elétrica', 'Seguro', 'IPVA', 'Documentação', 'Outros'];
const CAT_CNH = ['A', 'B', 'AB', 'C', 'D', 'E'];
const VINCULO_TIPOS = ['Funcionário', 'Autônomo', 'Parceiro', 'Sócio'];
const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const STATUS_MOTORISTA = ['ativo', 'inativo', 'afastado'];
const MODELOS_COBRANCA = ['Por km', 'Valor fixo mensal', 'Valor fechado', 'Por pedido', 'Por frete'];
const TIPOS_CONTRATO = ['Prefeitura', 'Licitação', 'Cliente privado', 'Vigor Laticínios', 'Frete recorrente', 'Serviço avulso', 'Compra/portal', 'Outros'];
const STATUS_CONTRATO = ['ativo', 'pausado', 'finalizado', 'vencido', 'cancelado'];
const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ---------- DB abstraction (localStorage; swap to Firestore later) ----------
const db = {
  async get(key, fallback = null) {
    try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
    catch { return fallback; }
  },
  async set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  },
};

// ---------- Seed data ----------
const seed = () => ({
  config: { nomeEmpresa: 'GSO Soluções', precoCombustivel: 5.89, consumoPadrao: 10 },
  veiculos: [
    { id: 'v1', placa: 'GVO-1A23', modelo: 'Mercedes-Benz Atego', ano: 2018, combustivel: 'Diesel', consumo: 7, km: 168420, status: 'ativo', seguro: '2026-08-15', ipva: '2027-04-30', licenciamento: '2026-09-30' },
    { id: 'v2', placa: 'HKL-2B45', modelo: 'Chevrolet Onix', ano: 2016, combustivel: 'Flex', consumo: 10, km: 98200, status: 'ativo', seguro: '2026-07-10', ipva: '2027-03-20', licenciamento: '2026-08-05' },
  ],
  motoristas: [
    { id: 'm1', nome: 'Gilcélio Sales', apelido: 'Gilcélio', telefone: '(32) 99977-9133', whatsapp: '(32) 98416-1510', cpf: '', cnh: '', categoriaCnh: 'D', vencCnh: '2027-02-12', endereco: '', cidade: 'Sta. Rita do Ibitipoca', estado: 'MG', admissao: '2023-01-10', vinculo: 'Sócio', veiculoId: 'v1', obs: '', status: 'ativo' },
    { id: 'm2', nome: 'João Pereira', apelido: 'João', telefone: '(32) 99100-2200', whatsapp: '', cpf: '', cnh: '', categoriaCnh: 'C', vencCnh: '2026-06-18', endereco: '', cidade: 'Lima Duarte', estado: 'MG', admissao: '2024-03-01', vinculo: 'Funcionário', veiculoId: 'v2', obs: '', status: 'ativo' },
    { id: 'm3', nome: 'Carlos Mendes', apelido: 'Carlos', telefone: '', whatsapp: '', cpf: '', cnh: '', categoriaCnh: 'E', vencCnh: '2026-05-20', endereco: '', cidade: '', estado: 'MG', admissao: '', vinculo: 'Autônomo', veiculoId: '', obs: 'Motorista parceiro para fretes avulsos.', status: 'ativo' },
  ],
  linhas: [
    { id: 'l1', nome: 'Prefeitura Sta. Rita do Ibitipoca', cliente: 'Prefeitura Municipal', origem: 'Sta. Rita do Ibitipoca', destino: 'Diversos', tipo: 'Contrato', kmViagem: 200, kmMensal: 4000, valorKm: 2.12, dias: 'Seg–Sex', veiculoId: 'v2', motoristaId: 'm1', status: 'ativo' },
    { id: 'l2', nome: 'Vigor Laticínios', cliente: 'Vigor Laticínios', origem: 'Sta. Rita do Ibitipoca', destino: 'Lima Duarte', tipo: 'Contrato', kmViagem: 80, kmMensal: 1920, valorKm: 1.85, dias: 'Seg–Sáb', veiculoId: 'v1', motoristaId: 'm1', status: 'ativo' },
    { id: 'l3', nome: 'Entrega Materiais – São Paulo', cliente: 'Indústrias diversas', origem: 'Sta. Rita do Ibitipoca', destino: 'São Paulo', tipo: 'Frete Avulso', kmViagem: 480, kmMensal: 960, valorKm: 2.50, dias: 'Sex/Dom', veiculoId: 'v1', motoristaId: 'm1', status: 'ativo' },
  ],
  combustivel: gerarAbastecimentos(),
  manutencao: [
    { id: 'mn1', data: '2026-04-22', veiculoId: 'v1', categoria: 'Troca de Óleo', descricao: 'Óleo + filtro', oficina: 'Oficina Central', valor: 680, km: 165200, proxKm: 175200, proxData: '2026-10-22', status: 'realizada' },
    { id: 'mn2', data: '2026-03-10', veiculoId: 'v2', categoria: 'Pneus', descricao: 'Dianteiros novos', oficina: 'Pneus Lima', valor: 1280, km: 95400, proxKm: 125400, proxData: '2027-09-10', status: 'realizada' },
    { id: 'mn3', data: '2026-06-15', veiculoId: 'v1', categoria: 'Freios', descricao: 'Pastilhas dianteiras', oficina: '', valor: 0, km: 0, proxKm: 0, proxData: '2026-06-15', status: 'agendada' },
  ],
  finEmpresa: gerarFinanceiro(),
  finPessoal: [
    { id: 'p-sal', data: '2026-05-05', tipo: 'entrada', categoria: 'Salário', descricao: 'Pró-labore GSO', valor: 4500, conta: 'Conta Corrente', forma: 'Transferência', status: 'pago', dataPagamento: '2026-05-05' },
    { id: 'p-mor', data: '2026-05-08', tipo: 'saida', categoria: 'Moradia', descricao: 'Aluguel', valor: 1400, conta: 'Conta Corrente', forma: 'Boleto', status: 'pago' },
    { id: 'p-ali', data: '2026-05-12', tipo: 'saida', categoria: 'Alimentação', descricao: 'Supermercado do mês', valor: 850, conta: 'Nubank', forma: 'Cartão Crédito', status: 'pago' },
    { id: 'p-saude', data: '2026-05-15', tipo: 'saida', categoria: 'Saúde', descricao: 'Plano de saúde', valor: 420, conta: 'Conta Corrente', forma: 'Boleto', status: 'pago' },
    { id: 'p-lazer', data: '2026-05-18', tipo: 'saida', categoria: 'Lazer', descricao: 'Cinema e jantar', valor: 180, conta: 'Nubank', forma: 'Cartão Crédito', status: 'pago' },
    { id: 'p-cart', data: '2026-05-20', tipo: 'saida', categoria: 'Cartão de Crédito', descricao: 'Fatura Nubank', valor: 1200, conta: 'Nubank', forma: 'Boleto', status: 'pendente', vencimento: '2026-06-05' },
    { id: 'p-emp', data: '2026-05-03', tipo: 'saida', categoria: 'Empréstimos', descricao: 'Parcela empréstimo', valor: 680, conta: 'Conta Corrente', forma: 'Boleto', status: 'vencido', vencimento: '2026-05-20' },
  ],
  contratos: [
    { id: 'c1', nome: 'Contrato Prefeitura SRI', cliente: 'Prefeitura Sta. Rita do Ibitipoca', tipo: 'Licitação', status: 'ativo', inicio: '2025-01-01', fim: '2026-12-31', modelo: 'Por km', valorKm: 2.12, kmContratado: 80000, valorMensal: 0, valorTotal: 0, linhaIds: ['l1'], veiculoId: 'v2', motoristaId: 'm1', obs: '' },
    { id: 'c2', nome: 'Operações Vigor Laticínios', cliente: 'Vigor Laticínios', tipo: 'Vigor Laticínios', status: 'ativo', inicio: '2025-06-01', fim: '2026-12-31', modelo: 'Por frete', valorKm: 0, kmContratado: 0, valorMensal: 0, valorTotal: 48000, linhaIds: ['l2'], veiculoId: 'v1', motoristaId: 'm2', obs: 'Compras e entregas via portal Vigor.' },
  ],
  metasPessoais: [
    { id: 'meta1', nome: 'Reserva de emergência', atual: 2300, alvo: 5000, icone: 'reserva' },
    { id: 'meta2', nome: 'Quitar cartão de crédito', atual: 1800, alvo: 4200, icone: 'cartao' },
    { id: 'meta3', nome: 'Entrada do carro', atual: 6000, alvo: 20000, icone: 'carro' },
  ],
});

function gerarAbastecimentos() {
  const out = []; let km = 168420;
  for (let i = 0; i < 18; i++) {
    const d = new Date(2026, 4, 27 - i * 4);
    const litros = 32 + Math.random() * 8;
    out.push({
      id: 'ab' + i, data: d.toISOString().slice(0, 10), veiculoId: i % 2 === 0 ? 'v1' : 'v2', motoristaId: 'm1',
      posto: ['Posto Ipiranga', 'Shell Lima Duarte', 'BR Sta. Rita'][i % 3], tipo: i % 2 === 0 ? 'Diesel' : 'Gasolina',
      litros: +litros.toFixed(2), valorLitro: i % 2 === 0 ? 6.19 : 5.89, valor: +(litros * (i % 2 === 0 ? 6.19 : 5.89)).toFixed(2),
      kmVeiculo: km, linhaId: ['l1', 'l2', 'l3'][i % 3],
    });
    km -= Math.round(litros * 9);
  }
  return out;
}

function gerarFinanceiro() {
  const out = []; const hoje = new Date(2026, 4, 27);
  const P = 'pago', X = 'pendente';
  for (let i = 0; i < 6; i++) {
    const mes = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const mStr = mes.toISOString().slice(0, 7);
    out.push({ id: `r-pref-${i}`, data: `${mStr}-05`, tipo: 'entrada', categoria: 'Pagamento Prefeitura', descricao: 'Mensalidade contrato', valor: 8480, cliente: 'Prefeitura SRI', forma: 'Transferência', veiculoId: 'v2', linhaId: 'l1', contratoId: 'c1', status: P, recorrente: true });
    out.push({ id: `r-vig-${i}`, data: `${mStr}-10`, tipo: 'entrada', categoria: 'Contrato', descricao: 'Vigor mensal', valor: 3552, cliente: 'Vigor', forma: 'PIX', veiculoId: 'v1', linhaId: 'l2', contratoId: 'c2', status: P, recorrente: true });
    out.push({ id: `r-mat-${i}`, data: `${mStr}-18`, tipo: 'entrada', categoria: 'Venda de Materiais', descricao: 'Peças e equipamentos', valor: 6200 + Math.round(Math.random() * 3000), cliente: 'Clientes diversos', forma: 'PIX', status: P });
    if (i < 4) out.push({ id: `r-sp-${i}`, data: `${mStr}-22`, tipo: 'entrada', categoria: 'Frete', descricao: 'Frete São Paulo', valor: 2400, cliente: 'Indústria', forma: 'PIX', veiculoId: 'v1', linhaId: 'l3', status: P });
    out.push({ id: `s-comb-${i}`, data: `${mStr}-15`, tipo: 'saida', categoria: 'Combustível', descricao: 'Abastecimentos do mês', valor: 3400 + Math.round(Math.random() * 400), cliente: '', forma: 'Cartão Débito', veiculoId: 'v1', linhaId: 'l2', contratoId: 'c2', status: P });
    out.push({ id: `s-ped-${i}`, data: `${mStr}-20`, tipo: 'saida', categoria: 'Pedágio', descricao: 'Pedágios', valor: 280 + Math.round(Math.random() * 80), cliente: '', forma: 'Dinheiro', veiculoId: 'v1', linhaId: 'l3', status: P });
    out.push({ id: `s-mat-${i}`, data: `${mStr}-08`, tipo: 'saida', categoria: 'Compra de Materiais', descricao: 'Estoque de peças', valor: 3100 + Math.round(Math.random() * 1500), cliente: 'Fornecedores', forma: 'Boleto', status: P });
    if (i === 1) out.push({ id: `s-mnt-${i}`, data: `${mStr}-22`, tipo: 'saida', categoria: 'Manutenção', descricao: 'Óleo + filtro', valor: 680, cliente: 'Oficina Central', forma: 'Dinheiro', veiculoId: 'v1', status: P });
    if (i === 2) out.push({ id: `s-pn-${i}`, data: `${mStr}-10`, tipo: 'saida', categoria: 'Pneus', descricao: 'Pneus dianteiros', valor: 1280, cliente: 'Pneus Lima', forma: 'Cartão Crédito', veiculoId: 'v2', status: P });
  }
  // Em aberto (alimenta Contas a pagar / receber)
  out.push({ id: 'r-open-1', data: '2026-05-22', tipo: 'entrada', categoria: 'Venda de Materiais', descricao: 'Pedido peças — Laticínio Bela Vista', valor: 7400, cliente: 'Laticínio Bela Vista', forma: 'Boleto', status: X, vencimento: '2026-06-10' });
  out.push({ id: 'r-open-2', data: '2026-05-25', tipo: 'entrada', categoria: 'Frete', descricao: 'Frete a faturar', valor: 2400, cliente: 'Indústria', forma: 'PIX', status: X, vencimento: '2026-06-05' });
  out.push({ id: 's-open-1', data: '2026-05-20', tipo: 'saida', categoria: 'Parcela', descricao: 'Parcela financiamento Atego', valor: 3180, cliente: 'Banco', forma: 'Boleto', veiculoId: 'v1', status: X, vencimento: '2026-06-08' });
  out.push({ id: 's-open-2', data: '2026-05-24', tipo: 'saida', categoria: 'Compra de Materiais', descricao: 'Fornecedor de peças', valor: 2650, cliente: 'Fornecedores', forma: 'Boleto', status: X, vencimento: '2026-06-12' });
  // Vencidos (destaque visual) e cancelado
  out.push({ id: 'r-venc-1', data: '2026-05-02', tipo: 'entrada', categoria: 'Venda de Materiais', descricao: 'Cliente em atraso — peças inox', valor: 1890, cliente: 'Laticínio São João', forma: 'Boleto', status: X, vencimento: '2026-05-15' });
  out.push({ id: 's-venc-1', data: '2026-05-01', tipo: 'saida', categoria: 'Impostos', descricao: 'Guia em atraso', valor: 740, cliente: 'Receita', forma: 'Boleto', status: 'vencido', vencimento: '2026-05-12' });
  out.push({ id: 's-canc-1', data: '2026-05-09', tipo: 'saida', categoria: 'Outros', descricao: 'Pedido cancelado', valor: 500, cliente: '', forma: 'PIX', status: 'cancelado' });
  return out;
}

// ---------- Utilities ----------
const fmtBRL = (v) => `R$ ${(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtNum = (v) => (v ?? 0).toLocaleString('pt-BR');
const fmtDate = (s) => { if (!s) return '—'; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
const uid = () => Math.random().toString(36).slice(2, 9);
const monthKey = (s) => s ? s.slice(0, 7) : '';
const currentMonth = () => new Date().toISOString().slice(0, 7);
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
const monthName = () => { const d = new Date(); return `${['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][d.getMonth()]} de ${d.getFullYear()}`; };

// ---------- Persisted state ----------
function usePersistedState(key, initial) {
  const [value, setValue] = useState(initial);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    (async () => {
      const stored = await db.get(key);
      if (stored) setValue(stored);
      else { setValue(initial); db.set(key, initial); }
      setLoaded(true);
    })();
  }, [key]);
  const update = (newValue) => {
    const resolved = typeof newValue === 'function' ? newValue(value) : newValue;
    setValue(resolved); db.set(key, resolved);
  };
  return [value, update, loaded];
}

// ---------- Primitives ----------
function StatCard({ icon: Icon, label, value, delta, deltaPositive, accent = 'ink', big, kpi }) {
  return (
    <div className={`card p-4 sm:p-5 min-w-0 ${kpi ? 'kpi' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className={`chip chip-${accent}`}><Icon size={17} strokeWidth={2} /></div>
        {delta !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-semibold ${deltaPositive ? 't-green' : 't-red'}`}>
            {deltaPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{delta}
          </div>
        )}
      </div>
      <div className="mt-3 sm:mt-4 min-w-0">
        <div className="label truncate">{label}</div>
        <div className={`display t-ink mt-1 ${big ? 'stat-lg' : 'stat-md'}`}>{value}</div>
      </div>
    </div>
  );
}

function useCountUp(target, dur = 1400) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf; const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 4);
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick); else setVal(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return val;
}
function CountUp({ value, format }) {
  const v = useCountUp(value || 0);
  return <>{format ? format(v) : Math.round(v)}</>;
}
function HeroMoney({ value }) {
  const v = useCountUp(value || 0);
  return <span className="hero-money"><span className="hero-cur">R$</span><span>{v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>;
}

function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className={`modal ${wide ? 'modal-wide' : 'modal-md'}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head flex items-center justify-between px-5 sm:px-6 py-4">
          <h2 className="display h-card t-ink">{title}</h2>
          <button onClick={onClose} className="ibtn"><X size={18} /></button>
        </div>
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, span = 1 }) {
  return (
    <label className={`block ${span === 2 ? 'col-span-2' : ''}`}>
      <span className="block label mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function NewButton({ onClick, children }) {
  return <button onClick={onClick} className="btn btn-primary w-full sm:w-auto"><Plus size={17} /> {children}</button>;
}

function EmptyState({ icon: Icon, title }) {
  return (
    <div className="text-center py-14 px-4">
      <div className="empty-ico"><Icon size={26} /></div>
      <p className="t-soft text-sm mt-4">{title}</p>
    </div>
  );
}

function Badge({ children, tone = 'slate' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

// ============================================================
// SIDEBAR
// ============================================================
const NAV = [
  { key: 'dashboard', label: 'Painel', icon: LayoutDashboard },
  { key: 'finEmpresa', label: 'Financeiro Empresa', icon: Wallet },
  { key: 'finPessoal', label: 'Financeiro Pessoal', icon: Coins },
  { key: 'linhas', label: 'Fretes & Linhas', icon: Route },
  { key: 'veiculos', label: 'Veículos', icon: Car },
  { key: 'combustivel', label: 'Combustível', icon: Fuel },
  { key: 'manutencao', label: 'Manutenção', icon: Wrench },
  { key: 'motoristas', label: 'Motoristas', icon: Users },
  { key: 'contratos', label: 'Contratos', icon: FileSignature },
  { key: 'documentos', label: 'Documentos', icon: FolderOpen },
  { key: 'relatorios', label: 'Relatórios', icon: BarChart3 },
  { key: 'config', label: 'Configurações', icon: Settings },
];

function Sidebar({ current, onNav, open, onClose, nomeEmpresa }) {
  return (
    <>
      {open && <div className="sb-overlay" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sb-header">
          <div className="flex items-center gap-3">
            <div className="sb-logo"><Truck size={19} /></div>
            <div className="min-w-0">
              <div className="sb-name display">{nomeEmpresa}</div>
              <div className="sb-sub">Gestão &amp; Logística</div>
            </div>
          </div>
        </div>
        <nav className="sb-nav">
          {NAV.map((item) => {
            const Icon = item.icon; const active = current === item.key;
            return (
              <button key={item.key} onClick={() => { onNav(item.key); onClose(); }} className={`sb-item ${active ? 'on' : ''}`}>
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                <span className="flex-1 text-left">{item.label}</span>
                {active && <ChevronRight size={15} />}
              </button>
            );
          })}
        </nav>
        <div className="sb-foot">v2.1 · {new Date().getFullYear()}</div>
      </aside>
    </>
  );
}

// ============================================================
// TOP BAR
// ============================================================
function TopBar({ title, subtitle, onMenu }) {
  return (
    <div className="topbar">
      <div className="flex items-center gap-3 px-4 sm:px-7 py-3">
        <button onClick={onMenu} className="menu-btn lg:hidden"><MenuIcon size={20} /></button>
        <div className="min-w-0">
          <h1 className="display h-page t-ink truncate">{title}</h1>
          {subtitle && <p className="text-xs t-soft mt-0.5 truncate">{subtitle}</p>}
        </div>
        <div className="brand-chip">
          <div className="brand-mark">GSO</div>
          <span className="brand-name hide-sm">GSO Soluções</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DASHBOARD
// ============================================================
function Dashboard({ data }) {
  const mes = currentMonth();
  const { finEmpresa, combustivel, veiculos, linhas, manutencao, config } = data;

  const stats = useMemo(() => {
    const mesEntr = finEmpresa.filter(x => x.tipo === 'entrada' && monthKey(x.data) === mes).reduce((a, b) => a + b.valor, 0);
    const mesSaid = finEmpresa.filter(x => x.tipo === 'saida' && monthKey(x.data) === mes).reduce((a, b) => a + b.valor, 0);
    const mesComb = combustivel.filter(x => monthKey(x.data) === mes).reduce((a, b) => a + b.valor, 0);
    const kmMes = linhas.filter(l => l.status === 'ativo').reduce((a, b) => a + (b.kmMensal || 0), 0);
    return {
      faturamento: mesEntr, lucro: mesEntr - mesSaid,
      margem: mesEntr ? ((mesEntr - mesSaid) / mesEntr * 100).toFixed(1) : 0,
      combustivel: mesComb, kmMes, linhasAtivas: linhas.filter(l => l.status === 'ativo').length,
      veiculos: veiculos.length, manutPend: manutencao.filter(m => m.status !== 'realizada').length,
    };
  }, [finEmpresa, combustivel, veiculos, linhas, manutencao, mes]);

  const serie = useMemo(() => {
    const map = new Map();
    for (let i = 5; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i); const k = d.toISOString().slice(0, 7); map.set(k, { mes: MONTHS_PT[d.getMonth()], entradas: 0, saidas: 0 }); }
    finEmpresa.forEach(x => { const k = monthKey(x.data); if (map.has(k)) { const r = map.get(k); if (x.tipo === 'entrada') r.entradas += x.valor; else r.saidas += x.valor; } });
    return Array.from(map.values());
  }, [finEmpresa]);

  const porLinha = useMemo(() => linhas.filter(l => l.status === 'ativo').map(l => {
    const veic = veiculos.find(v => v.id === l.veiculoId); const cons = veic?.consumo || 10;
    const receita = (l.kmMensal || 0) * l.valorKm; const comb = (l.kmMensal || 0) / cons * (config?.precoCombustivel || 5.89);
    const lucro = Math.round(receita - comb);
    return { nome: l.nome, lucro, margem: receita ? Math.round(lucro / receita * 100) : 0 };
  }).sort((a, b) => b.lucro - a.lucro), [linhas, veiculos, config]);

  const alertas = useMemo(() => {
    const arr = []; const hoje = new Date();
    veiculos.forEach(v => ['seguro', 'ipva', 'licenciamento'].forEach(field => {
      if (v[field]) { const d = new Date(v[field]); const diff = (d - hoje) / 86400000; if (diff < 60) arr.push({ tipo: field, veiculo: v.placa, data: v[field], dias: Math.round(diff) }); }
    }));
    manutencao.filter(m => m.status !== 'realizada').forEach(m => { const v = veiculos.find(x => x.id === m.veiculoId); arr.push({ tipo: 'manutencao', veiculo: v?.placa, descricao: `${m.categoria} – ${m.descricao}`, data: m.proxData }); });
    return arr.slice(0, 5);
  }, [veiculos, manutencao]);

  return (
    <div className="dash p-4 sm:p-7 space-y-5">
      {/* HERO */}
      <div className="hero">
        <div className="hero-ico"><Truck size={132} /></div>
        <div className="hero-body">
          <div className="hero-greet"><LayoutDashboard size={13} /> Visão geral</div>
          <h2 className="display hero-title">Resumo de {monthName()}</h2>
          <div className="grid grid-cols-3 gap-3 hero-stats">
            <div className="hero-stat min-w-0"><div className="hero-lbl">Receita</div><div className="mono hero-val"><HeroMoney value={stats.faturamento} /></div></div>
            <div className="hero-stat min-w-0"><div className="hero-lbl">Lucro</div><div className="mono hero-val hero-teal"><HeroMoney value={stats.lucro} /></div></div>
            <div className="hero-stat min-w-0"><div className="hero-lbl">Margem</div><div className="mono hero-val"><CountUp value={parseFloat(stats.margem)} format={(v) => `${v.toFixed(1)}%`} /></div></div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={TrendingUp} label="Faturamento (mês)" value={fmtBRL(stats.faturamento)} accent="ink" kpi />
        <StatCard icon={Activity} label="Lucro líquido" value={fmtBRL(stats.lucro)} accent={stats.lucro >= 0 ? 'green' : 'red'} delta={`${stats.margem}%`} deltaPositive={stats.lucro >= 0} kpi />
        <StatCard icon={Route} label="KM rodados (mês)" value={`${fmtNum(stats.kmMes)} km`} accent="ink" kpi />
        <StatCard icon={Fuel} label="Combustível (mês)" value={fmtBRL(stats.combustivel)} accent="orange" kpi />
      </div>

      {/* mini KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { l: 'Linhas ativas', v: stats.linhasAtivas, c: 't-ink', Ico: Route, accent: 'ink' },
          { l: 'Veículos', v: stats.veiculos, c: 't-ink', Ico: Truck, accent: 'ink' },
          { l: 'Manut. pendentes', v: stats.manutPend, c: stats.manutPend > 0 ? 't-orange' : 't-ink', Ico: Wrench, accent: 'orange' },
          { l: 'Margem do mês', v: `${stats.margem}%`, c: 't-green', Ico: Percent, accent: 'green' },
        ].map((m, i) => (
          <div key={i} className="card kpi p-4 sm:p-5 min-w-0">
            <div className={`chip chip-${m.accent}`}><m.Ico size={16} /></div>
            <div className="label truncate mt-3">{m.l}</div>
            <div className={`display stat-lg mt-1 ${m.c}`}>{m.v}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2 p-4 sm:p-5">
          <div className="mb-3"><h3 className="display h-card t-ink">Entradas × Saídas</h3><p className="text-xs t-soft">Últimos 6 meses</p></div>
          <div style={{ height: 'clamp(170px, 42vw, 230px)' }}>
            <ResponsiveContainer>
              <AreaChart data={serie} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10A37F" stopOpacity={0.24} /><stop offset="100%" stopColor="#10A37F" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#E06A85" stopOpacity={0.2} /><stop offset="100%" stopColor="#E06A85" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke="#F1F2F4" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#9AA1AC' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9AA1AC' }} axisLine={false} tickLine={false} width={42} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => fmtBRL(v)} contentStyle={{ borderRadius: 12, border: '1px solid #EEF0F3', fontSize: 11, padding: '6px 10px', boxShadow: '0 6px 20px rgba(11,19,36,.08)' }} wrapperStyle={{ zIndex: 30 }} />
                <Area type="monotone" dataKey="entradas" stroke="#10A37F" strokeWidth={2.5} fill="url(#gE)" dot={false} activeDot={{ r: 3, strokeWidth: 0 }} animationDuration={800} />
                <Area type="monotone" dataKey="saidas" stroke="#E06A85" strokeWidth={2.5} fill="url(#gS)" dot={false} activeDot={{ r: 3, strokeWidth: 0 }} animationDuration={800} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4 sm:p-5">
          <div className="mb-3"><h3 className="display h-card t-ink">Lucro por Linha</h3><p className="text-xs t-soft">Estimativa mensal</p></div>
          {porLinha.length === 0 ? <p className="text-sm t-soft py-2">Sem linhas ativas.</p> : (
            <div className="space-y-3">
              {porLinha.map((l, i) => (
                <div key={i} className="lp-row">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium t-ink truncate">{l.nome}</span>
                    <span className={`mono text-sm font-semibold ${l.lucro >= 0 ? 't-ink' : 't-red'}`} style={{ flexShrink: 0 }}>{fmtBRL(l.lucro)}</span>
                  </div>
                  <div className="bar-track mt-1.5"><div className="bar-fill" style={{ width: `${Math.max(Math.min(l.margem, 100), 2)}%`, background: 'linear-gradient(90deg,#16284B,#1E3A66)' }} /></div>
                  <div className="text-xs t-soft mt-1">Margem {l.margem}%</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alertas */}
      <div className="card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div><h3 className="display h-card t-ink">Alertas e Vencimentos</h3><p className="text-xs t-soft">Próximos 60 dias</p></div>
          <AlertTriangle size={18} className="t-orange" />
        </div>
        {alertas.length === 0 ? <p className="text-sm t-soft py-3">Tudo em ordem por aqui.</p> : (
          <div className="space-y-2">
            {alertas.map((a, i) => {
              const isManut = a.tipo === 'manutencao';
              const critico = a.dias !== undefined && a.dias < 15;
              const AIco = isManut ? Wrench : FileSignature;
              return (
                <div key={i} className="alert-row">
                  <div className={`alert-ico ${isManut ? 'ai-orange' : critico ? 'ai-red' : 'ai-blue'}`}><AIco size={15} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium t-ink truncate">{isManut ? a.descricao : `${a.tipo.charAt(0).toUpperCase() + a.tipo.slice(1)} – ${a.veiculo}`}</div>
                    <div className="text-xs t-soft">{fmtDate(a.data)}{a.dias !== undefined && ` · em ${a.dias} dia(s)`}</div>
                  </div>
                  <Badge tone={critico ? 'red' : isManut ? 'orange' : 'blue'}>{isManut ? 'Manutenção' : 'Documento'}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// FINANCEIRO EMPRESA
// ============================================================
const PERIODOS = [{ k: 'hoje', label: 'Hoje' }, { k: '7d', label: '7 dias' }, { k: '30d', label: '30 dias' }, { k: 'mes', label: 'Mês' }, { k: 'ano', label: 'Ano' }];

function periodRange(period) {
  const end = new Date(); end.setHours(23, 59, 59, 999);
  let start = new Date(); start.setHours(0, 0, 0, 0);
  if (period === '7d') start.setDate(start.getDate() - 6);
  else if (period === '30d') start.setDate(start.getDate() - 29);
  else if (period === 'mes') start = new Date(start.getFullYear(), start.getMonth(), 1);
  else if (period === 'ano') start = new Date(start.getFullYear(), 0, 1);
  const span = end - start;
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(start.getTime() - span - 1);
  return { start, end, prevStart, prevEnd };
}
const pctChange = (cur, prev) => (!prev ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100);

const STATUS_LANC = [
  { k: 'pago', label: 'Pago / Recebido' },
  { k: 'pendente', label: 'Pendente' },
  { k: 'vencido', label: 'Vencido' },
  { k: 'cancelado', label: 'Cancelado' },
];
const todayISO = () => new Date().toISOString().slice(0, 10);
// Status efetivo: pendente com vencimento no passado vira "vencido" automaticamente
function effStatus(x) {
  if (x.status === 'cancelado') return 'cancelado';
  if (x.status === 'pago') return 'pago';
  if (x.status === 'vencido') return 'vencido';
  if (x.status === 'pendente') return (x.vencimento && x.vencimento < todayISO()) ? 'vencido' : 'pendente';
  return 'pago'; // legado sem status
}
function statusBadge(x) {
  const s = effStatus(x);
  if (s === 'pago') return { label: x.tipo === 'entrada' ? 'Recebido' : 'Pago', tone: 'green' };
  if (s === 'pendente') return { label: 'Pendente', tone: 'orange' };
  if (s === 'vencido') return { label: 'Vencido', tone: 'red' };
  return { label: 'Cancelado', tone: 'slate' };
}

// Resultado REAL de uma linha/frete a partir dos lançamentos financeiros vinculados.
// Base para relatórios: lucro/custo/receita/margem por linha e ranking de lucratividade.
function realPorLinha(finEmpresa, linhaId) {
  const vinc = finEmpresa.filter(x => x.linhaId === linhaId && effStatus(x) !== 'cancelado');
  const receita = vinc.filter(x => x.tipo === 'entrada').reduce((a, b) => a + b.valor, 0);
  const custo = vinc.filter(x => x.tipo === 'saida').reduce((a, b) => a + b.valor, 0);
  const lucro = receita - custo;
  return { receita, custo, lucro, margem: receita ? (lucro / receita * 100) : 0, count: vinc.length };
}

function FinStatCard({ accent, icon: Icon, title, value, deltaPct, sub, spark, sparkColor }) {
  const up = (deltaPct ?? 0) >= 0;
  return (
    <div className={`fin-card fin-${accent}`}>
      <div className="flex items-center justify-between">
        <div className={`fin-ico fin-ico-${accent}`}><Icon size={16} /></div>
        {deltaPct !== undefined && deltaPct !== null && (
          <span className={`fin-delta ${up ? 'up' : 'down'}`}>{up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(deltaPct).toFixed(0)}%</span>
        )}
      </div>
      <div className="label" style={{ marginTop: 14 }}>{title}</div>
      <div className="fin-val">{value}</div>
      {sub && <div className="fin-sub">{sub}</div>}
      {spark && spark.length > 1 && (
        <div className="fin-spark">
          <ResponsiveContainer>
            <AreaChart data={spark.map((v, i) => ({ i, v }))} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
              <defs>
                <linearGradient id={`sg-${accent}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sparkColor || '#10A37F'} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={sparkColor || '#10A37F'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={sparkColor || '#10A37F'} strokeWidth={2.5} fill={`url(#sg-${accent})`} dot={false} activeDot={{ r: 2.5, strokeWidth: 0 }} animationDuration={650} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }) {
  return (
    <div className="mini-stat">
      <div className="mini-label">{label}</div>
      <div className={`mono mini-val ${tone || 't-ink'}`}>{value}</div>
    </div>
  );
}

// Helpers genéricos de CRUD (toast + confirmação) reutilizados por todos os módulos
function useToast() {
  const [toast, setToast] = useState('');
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2500); return () => clearTimeout(t); }, [toast]);
  return [toast, setToast];
}
function Toast({ msg }) { return msg ? <div className="toast"><CircleAlert size={15} /> {msg}</div> : null; }
function ConfirmModal({ item, title, message, onCancel, onConfirm }) {
  return (
    <Modal open={!!item} onClose={onCancel} title={title || 'Excluir registro'}>
      {item && (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="chip chip-red" style={{ flexShrink: 0 }}><Trash2 size={16} /></div>
            <div className="min-w-0">
              <p className="text-sm t-ink">{message || 'Tem certeza que deseja excluir este registro?'}</p>
              <p className="text-xs t-mute mt-1">Esta ação não pode ser desfeita.</p>
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <button onClick={onCancel} className="btn btn-ghost">Cancelar</button>
            <button onClick={onConfirm} className="btn btn-danger">Excluir</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function FinanceiroEmpresa({ data, setData }) {
  const { finEmpresa, veiculos, linhas, contratos } = data;
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [periodo, setPeriodo] = useState('mes');
  const [expandTx, setExpandTx] = useState(false);
  const [delTarget, setDelTarget] = useState(null);
  const [toast, setToast] = useState('');
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2500); return () => clearTimeout(t); }, [toast]);

  const inRange = (s, a, b) => { const d = new Date(s); return d >= a && d <= b; };

  const sparks = useMemo(() => {
    const s = reportSeries(finEmpresa.filter(x => effStatus(x) !== 'cancelado'), periodo);
    return { receita: s.map(b => b.receita), lucro: s.map(b => b.lucro), custo: s.map(b => b.custo) };
  }, [finEmpresa, periodo]);

  const m = useMemo(() => {
    const { start, end, prevStart, prevEnd } = periodRange(periodo);
    const cur = finEmpresa.filter(x => inRange(x.data, start, end));
    const prev = finEmpresa.filter(x => inRange(x.data, prevStart, prevEnd));
    const sum = (arr, tipo) => arr.filter(x => x.tipo === tipo).reduce((a, b) => a + b.valor, 0);
    const curEnt = sum(cur, 'entrada'), curSai = sum(cur, 'saida');
    const catMap = {};
    cur.filter(x => x.tipo === 'saida').forEach(x => { catMap[x.categoria] = (catMap[x.categoria] || 0) + x.valor; });
    const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
    return {
      receita: curEnt, custo: curSai, lucro: curEnt - curSai,
      margem: curEnt ? ((curEnt - curSai) / curEnt * 100) : 0,
      gRec: pctChange(curEnt, sum(prev, 'entrada')), gCusto: pctChange(curSai, sum(prev, 'saida')),
      topCat: topCat ? { nome: topCat[0], share: curSai ? (topCat[1] / curSai * 100) : 0 } : null,
    };
  }, [finEmpresa, periodo]);

  const resumo = useMemo(() => {
    const ativos = finEmpresa.filter(x => effStatus(x) !== 'cancelado');
    const isPago = x => effStatus(x) === 'pago';
    const emAberto = x => { const s = effStatus(x); return s === 'pendente' || s === 'vencido'; };
    const soma = arr => arr.reduce((a, b) => a + b.valor, 0);

    const saldo = soma(ativos.filter(x => x.tipo === 'entrada' && isPago(x))) - soma(ativos.filter(x => x.tipo === 'saida' && isPago(x)));
    const aReceber = soma(ativos.filter(x => x.tipo === 'entrada' && emAberto(x)));
    const aPagar = soma(ativos.filter(x => x.tipo === 'saida' && emAberto(x)));
    const mes = currentMonth();
    const despMes = soma(ativos.filter(x => x.tipo === 'saida' && monthKey(x.data) === mes));

    // Receita recorrente: entradas vinculadas a contratos ou linhas fixas ativas (mês atual)
    const linhasRec = new Set(linhas.filter(l => l.status === 'ativo' && (l.tipo === 'Contrato' || l.tipo === 'Linha Fixa')).map(l => l.id));
    const recorrente = soma(ativos.filter(x => x.tipo === 'entrada' && monthKey(x.data) === mes && (
      x.recorrente || linhasRec.has(x.linhaId) || x.categoria === 'Contrato' || x.categoria === 'Pagamento Prefeitura'
    )));
    return { saldo, aReceber, aPagar, despMes, recorrente };
  }, [finEmpresa, linhas]);

  const filtered = useMemo(() => {
    const { start, end } = periodRange(periodo);
    return finEmpresa
      .filter(x => filtroTipo === 'todos' || x.tipo === filtroTipo)
      .filter(x => inRange(x.data, start, end) || effStatus(x) === 'pendente' || effStatus(x) === 'vencido')
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [finEmpresa, filtroTipo, periodo]);

  const handleSave = (item) => { const msg = editing ? 'Lançamento atualizado com sucesso' : 'Lançamento salvo com sucesso'; setData(d => ({ ...d, finEmpresa: editing ? d.finEmpresa.map(x => x.id === editing.id ? { ...item, id: editing.id } : x) : [...d.finEmpresa, { ...item, id: uid() }] })); setOpenForm(false); setEditing(null); setToast(msg); };
  const handleDelete = (id) => { const item = finEmpresa.find(x => x.id === id); if (item) setDelTarget(item); };
  const confirmDelete = () => { if (delTarget) { setData(d => ({ ...d, finEmpresa: d.finEmpresa.filter(x => x.id !== delTarget.id) })); setToast('Lançamento excluído com sucesso'); setDelTarget(null); } };

  return (
    <div className="p-4 sm:p-7 space-y-5">
      {/* Período — controla todos os dados da tela */}
      <div className="period-bar">
        {PERIODOS.map(p => <button key={p.k} onClick={() => setPeriodo(p.k)} className={`period-pill ${periodo === p.k ? 'on' : ''}`}>{p.label}</button>)}
      </div>

      {/* Cards premium */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <FinStatCard accent="green" icon={TrendingUp} title="Receita Bruta" value={fmtBRL(m.receita)} deltaPct={m.gRec} sub={`${m.gRec >= 0 ? '+' : ''}${m.gRec.toFixed(0)}% vs. período anterior`} spark={sparks.receita} sparkColor="#10A37F" />
        <FinStatCard accent="blue" icon={Activity} title="Lucro Líquido" value={fmtBRL(m.lucro)} sub={`Margem de ${m.margem.toFixed(0)}%`} spark={sparks.lucro} sparkColor="#1D4ED8" />
        <FinStatCard accent="red" icon={TrendingDown} title="Custos" value={fmtBRL(m.custo)} deltaPct={m.gCusto} sub={m.topCat ? `Maior: ${m.topCat.nome} · ${m.topCat.share.toFixed(0)}%` : 'Sem custos no período'} spark={sparks.custo} sparkColor="#E06A85" />
      </div>

      {/* Resumo inteligente */}
      <div>
        <div className="flex items-center gap-2 mb-3"><Wallet size={15} className="t-soft" /><h3 className="display h-card t-ink">Resumo Financeiro</h3></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
          <div className="card pf-tile">
            <div className="pf-tile-head"><span className="label">Saldo atual</span></div>
            <div className={`pf-tile-val mono ${resumo.saldo >= 0 ? 't-ink' : 't-red'}`}>{fmtBRL(resumo.saldo)}</div>
          </div>
          <div className="card pf-tile">
            <div className="pf-tile-head"><span className="label">A receber</span></div>
            <div className="pf-tile-val mono t-green">{fmtBRL(resumo.aReceber)}</div>
          </div>
          <div className="card pf-tile">
            <div className="pf-tile-head"><span className="label">A pagar</span></div>
            <div className="pf-tile-val mono t-red">{fmtBRL(resumo.aPagar)}</div>
          </div>
          <div className="card pf-tile">
            <div className="pf-tile-head"><span className="label">Despesas do mês</span></div>
            <div className="pf-tile-val mono t-red">{fmtBRL(resumo.despMes)}</div>
          </div>
          <div className="card pf-tile">
            <div className="pf-tile-head"><span className="label">Receita recorrente</span></div>
            <div className="pf-tile-val mono t-green">{fmtBRL(resumo.recorrente)}</div>
          </div>
          <div className="card pf-tile">
            <div className="pf-tile-head"><span className="label">Margem líquida</span></div>
            <div className={`pf-tile-val mono ${m.margem >= 0 ? 't-ink' : 't-red'}`}>{m.margem.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="card">
        <div className="p-4 list-head">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="display h-card t-ink">Lançamentos</h3>
            <span className="count-pill">{filtered.length} {filtered.length === 1 ? 'lançamento' : 'lançamentos'}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="seg w-full sm:w-auto">
              {['todos', 'entrada', 'saida'].map(t => <button key={t} onClick={() => setFiltroTipo(t)} className={`seg-btn ${filtroTipo === t ? 'on' : ''}`}>{t === 'todos' ? 'Todos' : t === 'entrada' ? 'Entradas' : 'Saídas'}</button>)}
            </div>
            <button onClick={() => { setEditing(null); setOpenForm(true); }} className="btn btn-primary fin-new sm:ml-auto"><Plus size={16} /> Novo Lançamento</button>
          </div>
        </div>

        {filtered.length === 0 ? <EmptyState icon={Receipt} title="Sem lançamentos no período." /> : (
          <div className="tx-list">
            {(expandTx ? filtered : filtered.slice(0, 4)).map((x, i) => {
              const isE = x.tipo === 'entrada';
              const eff = effStatus(x); const sb = statusBadge(x);
              const ov = eff === 'vencido'; const canc = eff === 'cancelado';
              const linha = linhas.find(l => l.id === x.linhaId);
              return (
                <div key={x.id} className={`tx-item ${ov ? 'tx-overdue' : ''} ${i >= 4 ? 'tx-reveal' : ''}`}>
                  <div className={`pill ${isE ? 'pill-green' : 'pill-red'}`}>{isE ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}</div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${canc ? 'tx-canc' : 't-ink'}`}>{x.descricao}</div>
                    <div className="text-xs t-soft mt-0.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone={sb.tone}>{sb.label}</Badge>
                      <Badge tone="slate">{x.categoria}</Badge>
                      <span>{fmtDate(x.data)}</span>
                      {(eff === 'pendente' || ov) && x.vencimento && <span className="hide-sm">· vence {fmtDate(x.vencimento)}</span>}
                      {linha && <span className="lnk-linha"><Route size={11} /> {linha.nome}</span>}
                      {x.cliente && <span className="hide-sm">· {x.cliente}</span>}
                    </div>
                  </div>
                  <div className={`mono text-sm font-semibold text-right ${canc ? 't-mute' : isE ? 't-green' : 't-red'}`} style={{ flexShrink: 0, textDecoration: canc ? 'line-through' : 'none' }}>{isE ? '+ ' : '− '}{fmtBRL(x.valor)}</div>
                  <div className="row-actions flex">
                    <button onClick={() => { setEditing(x); setOpenForm(true); }} className="ibtn"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(x.id)} className="ibtn ibtn-del"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
            {filtered.length > 4 && (
              <button onClick={() => setExpandTx(v => !v)} className="tx-toggle">
                {expandTx ? 'Ocultar lançamentos' : `Mostrar mais ${filtered.length - 4} lançamento(s)`}
                <ChevronDown size={15} className={`tx-chev ${expandTx ? 'up' : ''}`} />
              </button>
            )}
          </div>
        )}
      </div>

      <Modal open={!!delTarget} onClose={() => setDelTarget(null)} title="Excluir lançamento">
        {delTarget && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="chip chip-red" style={{ flexShrink: 0 }}><Trash2 size={16} /></div>
              <div className="min-w-0">
                <p className="text-sm t-ink">Tem certeza que deseja excluir este lançamento?</p>
                <div className="text-xs t-soft mt-1 truncate">{delTarget.descricao} · <span className="mono">{fmtBRL(delTarget.valor)}</span></div>
                <p className="text-xs t-mute mt-1">Vínculos com linhas e contratos serão recalculados.</p>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button onClick={() => setDelTarget(null)} className="btn btn-ghost">Cancelar</button>
              <button onClick={confirmDelete} className="btn btn-danger">Excluir</button>
            </div>
          </div>
        )}
      </Modal>

      {toast && <div className="toast"><CircleAlert size={15} /> {toast}</div>}

      <Modal open={openForm} onClose={() => { setOpenForm(false); setEditing(null); }} title={editing ? 'Editar lançamento' : 'Novo lançamento'} wide>
        <LancamentoForm item={editing} veiculos={veiculos} linhas={linhas} contratos={contratos} onSave={handleSave} onCancel={() => { setOpenForm(false); setEditing(null); }} />
      </Modal>
    </div>
  );
}

function LancamentoForm({ item, veiculos, linhas, contratos, onSave, onCancel }) {
  const [f, setF] = useState({
    data: item?.data || new Date().toISOString().slice(0, 10), tipo: item?.tipo || 'entrada',
    categoria: item?.categoria || CAT_FIN_EMPRESA.entrada[0], descricao: item?.descricao || '',
    valor: item?.valor || '', cliente: item?.cliente || '', forma: item?.forma || 'PIX',
    veiculoId: item?.veiculoId || '', linhaId: item?.linhaId || '', contratoId: item?.contratoId || '', obs: item?.obs || '',
    status: item?.status || 'pago', vencimento: item?.vencimento || '', dataPagamento: item?.dataPagamento || '', recorrente: item?.recorrente || false,
  });
  const cats = CAT_FIN_EMPRESA[f.tipo];
  const submitForm = () => { onSave({ ...f, valor: parseFloat(f.valor) || 0 }); };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo"><select className="inp" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value, categoria: CAT_FIN_EMPRESA[e.target.value][0] })}><option value="entrada">Entrada</option><option value="saida">Saída</option></select></Field>
        <Field label="Data"><input type="date" className="inp" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} required /></Field>
        <Field label="Categoria"><select className="inp" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>{cats.map(c => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Valor (R$)"><input type="number" step="0.01" className="inp" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} required /></Field>
        <Field label="Descrição" span={2}><input className="inp" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} required /></Field>
        <Field label="Situação"><select className="inp" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{STATUS_LANC.map(s => <option key={s.k} value={s.k}>{s.label}</option>)}</select></Field>
        <Field label={f.status === 'pago' ? 'Data de pagamento/recebimento' : 'Data de vencimento'}>
          {f.status === 'pago'
            ? <input type="date" className="inp" value={f.dataPagamento} onChange={(e) => setF({ ...f, dataPagamento: e.target.value })} />
            : <input type="date" className="inp" value={f.vencimento} onChange={(e) => setF({ ...f, vencimento: e.target.value })} />}
        </Field>
        <Field label="Cliente / Fornecedor"><input className="inp" value={f.cliente} onChange={(e) => setF({ ...f, cliente: e.target.value })} /></Field>
        <Field label="Forma de Pagamento"><select className="inp" value={f.forma} onChange={(e) => setF({ ...f, forma: e.target.value })}>{FORMAS_PGTO.map(p => <option key={p}>{p}</option>)}</select></Field>
        <Field label="Veículo"><select className="inp" value={f.veiculoId} onChange={(e) => setF({ ...f, veiculoId: e.target.value })}><option value="">—</option>{veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} · {v.modelo}</option>)}</select></Field>
        <Field label="Linha/Frete Vinculado"><select className="inp" value={f.linhaId} onChange={(e) => setF({ ...f, linhaId: e.target.value })}><option value="">Nenhum</option>{linhas.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}</select></Field>
        <Field label="Contrato Vinculado"><select className="inp" value={f.contratoId} onChange={(e) => setF({ ...f, contratoId: e.target.value })}><option value="">Nenhum</option>{(contratos || []).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Field>
        {f.tipo === 'entrada' && (
          <label className="col-span-2 flex items-center gap-2.5 cursor-pointer" style={{ padding: '4px 2px' }}>
            <input type="checkbox" checked={f.recorrente} onChange={(e) => setF({ ...f, recorrente: e.target.checked })} style={{ width: 16, height: 16, accentColor: '#0B1533' }} />
            <span className="text-sm t-ink">Receita recorrente (mensal)</span>
          </label>
        )}
        <Field label="Observações" span={2}><textarea className="inp" rows={2} value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} /></Field>
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 form-foot">
        <button type="button" onClick={onCancel} className="btn btn-ghost">Cancelar</button>
        <button type="button" onClick={submitForm} className="btn btn-primary">Salvar</button>
      </div>
    </div>
  );
}

// ============================================================
// FINANCEIRO PESSOAL
// ============================================================
const CAT_FIN_PESSOAL = {
  entrada: ['Salário', 'Pró-labore', 'Rendimentos', 'Reembolso', 'Freelance', 'Outros'],
  saida: ['Moradia', 'Alimentação', 'Transporte', 'Cartão de Crédito', 'Empréstimos', 'Dívidas', 'Lazer', 'Saúde', 'Educação', 'Outros'],
};
const CAT_DIVIDA = ['Cartão de Crédito', 'Empréstimos', 'Dívidas'];
const CAT_COLORS_PESSOAL = {
  'Moradia': '#1D4ED8', 'Alimentação': '#087F5B', 'Transporte': '#D97706', 'Cartão de Crédito': '#B4234B',
  'Empréstimos': '#7C3AED', 'Dívidas': '#BE123C', 'Lazer': '#0891B2', 'Saúde': '#DB2777', 'Educação': '#4F46E5', 'Outros': '#6B7280',
};
function catIconPessoal(cat) {
  const map = { 'Moradia': Home, 'Alimentação': ShoppingCart, 'Transporte': Car, 'Cartão de Crédito': CreditCard, 'Empréstimos': Receipt, 'Dívidas': Receipt, 'Lazer': Sparkles, 'Saúde': Heart, 'Educação': GraduationCap, 'Salário': Wallet, 'Pró-labore': Wallet, 'Rendimentos': TrendingUp, 'Reembolso': Coins, 'Freelance': Coins };
  return map[cat] || Receipt;
}
function metaIconPessoal(icone) {
  return { reserva: PiggyBank, cartao: CreditCard, carro: Car, guardar: PiggyBank }[icone] || Target;
}
const TONE_HEX = { green: '#087F5B', blue: '#1D4ED8', orange: '#D97706', red: '#B4234B', slate: '#6B7280' };
function prazoTxt(d) {
  if (d === null || d === undefined) return '';
  if (d <= 0) return 'vence hoje';
  if (d === 1) return 'vence amanhã';
  return `vence em ${d} dias`;
}
function pessoalSeries(arr, periodo) {
  const { start, end } = periodRange(periodo);
  const mode = periodo === 'ano' ? 'month' : (periodo === '30d' || periodo === 'mes') ? 'week' : 'day';
  const keyLabel = (d) => {
    if (mode === 'month') return { k: d.toISOString().slice(0, 7), label: MONTHS_PT[d.getMonth()] };
    if (mode === 'week') {
      const wk = Math.floor((d - start) / 86400000 / 7);
      const ws = new Date(start); ws.setDate(ws.getDate() + wk * 7);
      return { k: 'w' + wk, label: `${String(ws.getDate()).padStart(2, '0')}/${String(ws.getMonth() + 1).padStart(2, '0')}` };
    }
    return { k: d.toISOString().slice(0, 10), label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` };
  };
  const buckets = new Map(); const order = [];
  const cursor = new Date(start); cursor.setHours(0, 0, 0, 0);
  const step = () => mode === 'month' ? cursor.setMonth(cursor.getMonth() + 1) : cursor.setDate(cursor.getDate() + 1);
  if (mode === 'month') cursor.setDate(1);
  while (cursor <= end) { const { k, label } = keyLabel(cursor); if (!buckets.has(k)) { buckets.set(k, { label, receita: 0, despesa: 0 }); order.push(k); } step(); }
  arr.forEach(x => {
    const d = new Date(x.data); if (d < start || d > end) return;
    const { k } = keyLabel(d); const b = buckets.get(k); if (!b) return;
    if (x.tipo === 'entrada') b.receita += x.valor; else b.despesa += x.valor;
  });
  return order.map(k => buckets.get(k));
}

function FinanceiroPessoal({ data, setData }) {
  const { finPessoal } = data;
  const metas = data.metasPessoais || [];
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [periodo, setPeriodo] = useState('mes');
  const [metaForm, setMetaForm] = useState(false);
  const [metaEdit, setMetaEdit] = useState(null);
  const [aporteMeta, setAporteMeta] = useState(null);
  const [aporteVal, setAporteVal] = useState('');
  const [expandTx, setExpandTx] = useState(false);
  const [delTarget, setDelTarget] = useState(null);
  const [metaDel, setMetaDel] = useState(null);
  const [toast, setToast] = useState('');
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2500); return () => clearTimeout(t); }, [toast]);
  const inRange = (s, a, b) => { const d = new Date(s); return d >= a && d <= b; };

  const m = useMemo(() => {
    const { start, end, prevStart, prevEnd } = periodRange(periodo);
    const cur = finPessoal.filter(x => inRange(x.data, start, end) && effStatus(x) !== 'cancelado');
    const prev = finPessoal.filter(x => inRange(x.data, prevStart, prevEnd) && effStatus(x) !== 'cancelado');
    const sum = (arr, tipo) => arr.filter(x => x.tipo === tipo).reduce((a, b) => a + b.valor, 0);
    const curEnt = sum(cur, 'entrada'), curSai = sum(cur, 'saida');
    const prevEnt = sum(prev, 'entrada'), prevSai = sum(prev, 'saida');
    const catMap = {};
    cur.filter(x => x.tipo === 'saida').forEach(x => { catMap[x.categoria] = (catMap[x.categoria] || 0) + x.valor; });
    const cats = Object.entries(catMap).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
    const topCat = cats[0];
    const economia = curEnt ? ((curEnt - curSai) / curEnt * 100) : 0;
    const prevEcon = prevEnt ? ((prevEnt - prevSai) / prevEnt * 100) : 0;
    return {
      receita: curEnt, despesa: curSai, saldo: curEnt - curSai,
      margem: economia, economia, gEcon: economia - prevEcon,
      gRec: pctChange(curEnt, prevEnt), gDesp: pctChange(curSai, prevSai),
      topCat: topCat ? { nome: topCat.nome, share: curSai ? (topCat.valor / curSai * 100) : 0 } : null,
      cats,
    };
  }, [finPessoal, periodo]);

  const serie = useMemo(() => pessoalSeries(finPessoal.filter(x => effStatus(x) !== 'cancelado'), periodo), [finPessoal, periodo]);

  const resumo = useMemo(() => {
    const ativos = finPessoal.filter(x => effStatus(x) !== 'cancelado');
    const isPago = x => effStatus(x) === 'pago';
    const emAberto = x => { const s = effStatus(x); return s === 'pendente' || s === 'vencido'; };
    const soma = arr => arr.reduce((a, b) => a + b.valor, 0);
    const mes = currentMonth();
    const saldo = soma(ativos.filter(x => x.tipo === 'entrada' && isPago(x))) - soma(ativos.filter(x => x.tipo === 'saida' && isPago(x)));
    const receitasMes = soma(ativos.filter(x => x.tipo === 'entrada' && monthKey(x.data) === mes));
    const despesasMes = soma(ativos.filter(x => x.tipo === 'saida' && monthKey(x.data) === mes));
    const aVencer = soma(ativos.filter(x => x.tipo === 'saida' && effStatus(x) === 'pendente'));
    const vencidas = soma(ativos.filter(x => x.tipo === 'saida' && effStatus(x) === 'vencido'));
    const dividas = soma(ativos.filter(x => x.tipo === 'saida' && emAberto(x) && CAT_DIVIDA.includes(x.categoria)));
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const pendSaida = ativos.filter(x => x.tipo === 'saida' && effStatus(x) === 'pendente' && x.vencimento);
    const vencemSemana = pendSaida.filter(x => { const diff = (new Date(x.vencimento) - hoje) / 86400000; return diff >= 0 && diff <= 7; }).length;
    const prox = pendSaida.map(x => ({ x, d: new Date(x.vencimento) })).filter(o => o.d >= hoje).sort((a, b) => a.d - b.d)[0];
    const vencidasCount = ativos.filter(x => x.tipo === 'saida' && effStatus(x) === 'vencido').length;
    return { saldo, receitasMes, despesasMes, aVencer, vencidas, dividas, vencemSemana, vencidasCount, aVencerCount: pendSaida.length, proxima: prox ? prox.x : null, proximaDias: prox ? Math.round((prox.d - hoje) / 86400000) : null };
  }, [finPessoal]);

  const saude = useMemo(() => {
    let score = 100;
    const ratio = m.receita > 0 ? m.despesa / m.receita : (m.despesa > 0 ? 1.5 : 0);
    if (ratio > 0.6) score -= Math.min(55, (ratio - 0.6) * 110);
    if (resumo.vencidas > 0) score -= 20;
    if (resumo.dividas > 0 && m.receita > 0) score -= Math.min(20, resumo.dividas / m.receita * 40);
    score = Math.max(0, Math.min(100, Math.round(score)));
    let label, tone;
    if (score >= 80) { label = 'Excelente'; tone = 'green'; }
    else if (score >= 60) { label = 'Boa'; tone = 'blue'; }
    else if (score >= 40) { label = 'Atenção'; tone = 'orange'; }
    else { label = 'Crítica'; tone = 'red'; }
    let insight;
    if (ratio > 1) insight = `Você gastou ${(ratio * 100).toFixed(0)}% da renda no período.`;
    else if (resumo.vencidas > 0) insight = `Há contas vencidas em aberto (${fmtBRL(resumo.vencidas)}).`;
    else if (ratio <= 0.7 && m.receita > 0) insight = 'Suas contas estão equilibradas.';
    else if (m.receita > 0) insight = `Você comprometeu ${(ratio * 100).toFixed(0)}% da renda.`;
    else insight = 'Sem receitas registradas no período.';
    return { score, label, tone, insight };
  }, [m, resumo]);

  const dica = useMemo(() => {
    const ratio = m.receita > 0 ? m.despesa / m.receita : 0;
    if (m.receita > 0 && ratio > 1) return `Suas despesas ultrapassaram sua renda em ${((ratio - 1) * 100).toFixed(0)}% no período.`;
    if (resumo.vencidas > 0) return `Você tem ${fmtBRL(resumo.vencidas)} em contas vencidas para regularizar.`;
    if (m.topCat) return `Você gastou mais com ${m.topCat.nome} (${m.topCat.share.toFixed(0)}% das despesas).`;
    if (m.economia > 0) return `Você economizou ${m.economia.toFixed(0)}% da sua renda no período.`;
    return 'Registre lançamentos para receber dicas inteligentes.';
  }, [m, resumo]);

  const donut = useMemo(() => {
    const total = m.despesa;
    if (!total || !m.cats.length) return [];
    const top = m.cats.slice(0, 6);
    const restVal = m.cats.slice(6).reduce((a, b) => a + b.valor, 0);
    const arr = top.map(c => ({ name: c.nome, value: c.valor, color: CAT_COLORS_PESSOAL[c.nome] || '#9AA1AC', pct: Math.round(c.valor / total * 100) }));
    if (restVal > 0) arr.push({ name: 'Outros', value: restVal, color: '#C3C8D0', pct: Math.round(restVal / total * 100) });
    return arr;
  }, [m]);

  const filtered = useMemo(() => {
    const { start, end } = periodRange(periodo);
    return finPessoal
      .filter(x => filtroTipo === 'todos' || x.tipo === filtroTipo)
      .filter(x => inRange(x.data, start, end) || effStatus(x) === 'pendente' || effStatus(x) === 'vencido')
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [finPessoal, filtroTipo, periodo]);

  const handleSave = (item) => { const msg = editing ? 'Lançamento atualizado com sucesso' : 'Lançamento salvo com sucesso'; setData(d => ({ ...d, finPessoal: editing ? d.finPessoal.map(x => x.id === editing.id ? { ...item, id: editing.id } : x) : [...d.finPessoal, { ...item, id: uid() }] })); setOpenForm(false); setEditing(null); setToast(msg); };
  const handleDelete = (id) => { const item = finPessoal.find(x => x.id === id); if (item) setDelTarget(item); };
  const confirmDelete = () => { if (delTarget) { setData(d => ({ ...d, finPessoal: d.finPessoal.filter(x => x.id !== delTarget.id) })); setToast('Lançamento excluído com sucesso'); setDelTarget(null); } };
  const saveMeta = (item) => { const msg = metaEdit ? 'Meta atualizada com sucesso' : 'Meta criada com sucesso'; setData(d => ({ ...d, metasPessoais: metaEdit ? (d.metasPessoais || []).map(x => x.id === metaEdit.id ? { ...item, id: metaEdit.id } : x) : [...(d.metasPessoais || []), { ...item, id: 'meta' + uid() }] })); setMetaForm(false); setMetaEdit(null); setToast(msg); };
  const delMeta = (id) => { const item = (data.metasPessoais || []).find(x => x.id === id); if (item) setMetaDel(item); };
  const confirmMetaDel = () => { if (metaDel) { setData(d => ({ ...d, metasPessoais: (d.metasPessoais || []).filter(x => x.id !== metaDel.id) })); setToast('Meta excluída com sucesso'); setMetaDel(null); } };
  const confirmAporte = () => { const v = parseFloat(aporteVal) || 0; if (v > 0 && aporteMeta) setData(d => ({ ...d, metasPessoais: (d.metasPessoais || []).map(x => x.id === aporteMeta.id ? { ...x, atual: (x.atual || 0) + v } : x) })); setAporteMeta(null); setAporteVal(''); };

  return (
    <div className="p-4 sm:p-7 space-y-6">
      {/* 1. Filtros (header vem do TopBar) */}
      <div className="period-bar">
        {PERIODOS.map(p => <button key={p.k} onClick={() => setPeriodo(p.k)} className={`period-pill ${periodo === p.k ? 'on' : ''}`}>{p.label}</button>)}
      </div>

      {/* 2. Gráfico principal */}
      <div className="card p-4 sm:p-5">
        <div className="mb-3"><h3 className="display h-card t-ink">Entradas e Saídas</h3><p className="text-xs t-soft">Comparativo de receitas e despesas no período</p></div>
        <div style={{ height: 'clamp(180px, 46vw, 250px)' }}>
          <ResponsiveContainer>
            <BarChart data={serie} margin={{ top: 6, right: 4, left: -18, bottom: 0 }} barGap={3} barCategoryGap="24%">
              <CartesianGrid stroke="#F1F2F4" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9AA1AC' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={12} />
              <YAxis tick={{ fontSize: 10, fill: '#9AA1AC' }} axisLine={false} tickLine={false} width={40} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip cursor={{ fill: 'rgba(11,19,36,.04)' }} formatter={v => fmtBRL(v)} contentStyle={{ borderRadius: 12, border: '1px solid #EEF0F3', fontSize: 11, padding: '6px 10px', boxShadow: '0 6px 20px rgba(11,19,36,.08)' }} wrapperStyle={{ zIndex: 30 }} />
              <Bar dataKey="receita" name="Receitas" fill="#10A37F" radius={[5, 5, 0, 0]} maxBarSize={26} animationDuration={650} />
              <Bar dataKey="despesa" name="Despesas" fill="#E06A85" radius={[5, 5, 0, 0]} maxBarSize={26} animationDuration={650} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          <span className="leg"><i style={{ background: '#10A37F' }} /> Receitas</span>
          <span className="leg"><i style={{ background: '#E06A85' }} /> Despesas</span>
        </div>
      </div>

      {/* 3. Cards resumo */}
      <div className="sum-grid">
        <div className="card sum-card">
          <div className="sum-card-top">
            <span className="sum-ico" style={{ background: '#E7F6F0', color: '#0B815E' }}><ArrowUpRight size={16} /></span>
            <span className={`sum-trend ${m.gRec >= 0 ? 'sum-trend-up' : 'sum-trend-down'}`}>{m.gRec >= 0 ? '+' : ''}{m.gRec.toFixed(0)}%</span>
          </div>
          <div className="sum-title">Receitas</div>
          <div className="sum-val mono t-green">{fmtBRL(m.receita)}</div>
          <div className="sum-sub">vs. período anterior</div>
        </div>
        <div className="card sum-card">
          <div className="sum-card-top">
            <span className="sum-ico" style={{ background: '#FBEAEF', color: '#C0395A' }}><ArrowDownRight size={16} /></span>
            <span className={`sum-trend ${m.gDesp > 0 ? 'sum-trend-down' : 'sum-trend-up'}`}>{m.gDesp >= 0 ? '+' : ''}{m.gDesp.toFixed(0)}%</span>
          </div>
          <div className="sum-title">Despesas</div>
          <div className="sum-val mono t-red">{fmtBRL(m.despesa)}</div>
          <div className="sum-sub truncate">{m.topCat ? `Maior: ${m.topCat.nome}` : 'Sem despesas'}</div>
        </div>
        <div className="card sum-card">
          <div className="sum-card-top">
            <span className="sum-ico" style={{ background: '#EEF2FF', color: '#1D4ED8' }}><Wallet size={16} /></span>
          </div>
          <div className="sum-title">Saldo</div>
          <div className={`sum-val mono ${m.saldo >= 0 ? 't-ink' : 't-red'}`}>{fmtBRL(m.saldo)}</div>
          <div className="sum-sub">{m.economia >= 0 ? `Sobra de ${m.economia.toFixed(0)}% da renda` : 'Acima da renda'}</div>
        </div>
        <div className="card sum-card">
          <div className="sum-card-top">
            <span className="sum-ico" style={{ background: m.economia >= 0 ? '#E7F6F0' : '#FBEAEF', color: m.economia >= 0 ? '#0B815E' : '#C0395A' }}><PiggyBank size={16} /></span>
            <span className={`sum-trend ${m.gEcon >= 0 ? 'sum-trend-up' : 'sum-trend-down'}`}>{m.gEcon >= 0 ? '+' : ''}{m.gEcon.toFixed(0)}pp</span>
          </div>
          <div className="sum-title">Economia</div>
          <div className={`sum-val mono ${m.economia >= 0 ? 't-green' : 't-red'}`}>{m.economia.toFixed(0)}%</div>
          <div className="sum-sub">da renda no período</div>
        </div>
      </div>

      {/* 3b. Tiles secundários */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="card pf-tile">
          <div className="pf-tile-head"><span className="label">A vencer</span></div>
          <div className="pf-tile-val mono t-orange">{fmtBRL(resumo.aVencer)}</div>
          <div className="pf-tile-sub">{resumo.proxima ? prazoTxt(resumo.proximaDias) : `${resumo.aVencerCount} pendente(s)`}</div>
        </div>
        <div className="card pf-tile">
          <div className="pf-tile-head"><span className="label">Vencidas</span>{resumo.vencidasCount > 0 && <span className="dot-pulse" />}</div>
          <div className="pf-tile-val mono t-red">{fmtBRL(resumo.vencidas)}</div>
          <div className="pf-tile-sub">{resumo.vencidasCount} em atraso</div>
        </div>
        <div className="card pf-tile">
          <div className="pf-tile-head"><span className="label">Dívidas</span></div>
          <div className="pf-tile-val mono t-ink">{fmtBRL(resumo.dividas)}</div>
          <div className="pf-tile-sub">cartão e empréstimos</div>
        </div>
        <div className="card pf-tile pf-tile-dica">
          <div className="pf-tile-head"><span className="label flex items-center gap-1"><Lightbulb size={12} className="t-orange" /> Dica</span></div>
          <div className="text-xs t-ink" style={{ marginTop: 4, lineHeight: 1.35 }}>{dica}</div>
        </div>
      </div>

      {/* 4. Saúde financeira */}
      <div className="card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2"><Gauge size={15} className="t-soft" /><h3 className="display h-card t-ink">Saúde Financeira</h3></div>
          <span className="health-badge" style={{ color: TONE_HEX[saude.tone], background: TONE_HEX[saude.tone] + '18' }}>{saude.label}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="health-track flex-1"><div className="health-fill" style={{ width: `${saude.score}%`, background: TONE_HEX[saude.tone] }} /></div>
          <span className="mono text-sm font-semibold t-ink" style={{ flexShrink: 0 }}>{saude.score}<span className="t-mute text-xs">/100</span></span>
        </div>
        <p className="text-xs t-soft mt-2">{saude.insight}</p>
      </div>

      {/* 5. Gastos por categoria (donut) */}
      <div className="card p-4 sm:p-5">
        <h3 className="display h-card t-ink mb-1">Para onde seu dinheiro está indo</h3>
        {donut.length === 0 ? <p className="text-sm t-soft py-2">Sem despesas no período.</p> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 items-center">
            <div className="donut-wrap">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={donut} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="92%" paddingAngle={2} stroke="none" startAngle={90} endAngle={-270} animationDuration={700}>
                    {donut.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [fmtBRL(v), n]} contentStyle={{ borderRadius: 12, border: '1px solid #EEF0F3', fontSize: 11, padding: '6px 10px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center"><span className="label">Total</span><span className="mono font-semibold t-ink">{fmtBRL(m.despesa)}</span></div>
            </div>
            <div className="space-y-2.5">
              {donut.map(c => (
                <div key={c.name} className="flex items-center gap-2.5">
                  <span className="cat-dot" style={{ background: c.color }} />
                  <span className="text-sm t-ink flex-1 truncate">{c.name}</span>
                  <span className="mono text-sm font-semibold t-ink" style={{ flexShrink: 0 }}>{c.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 9. Metas financeiras */}
      <div className="card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2"><Target size={16} className="t-soft" /><h3 className="display h-card t-ink">Metas Pessoais</h3></div>
          <button onClick={() => { setMetaEdit(null); setMetaForm(true); }} className="btn btn-ghost btn-sm"><Plus size={15} /> Nova meta</button>
        </div>
        {metas.length === 0 ? <EmptyState icon={Target} title="Nenhuma meta cadastrada ainda." /> : (
          <div className="space-y-3.5">
            {metas.map(meta => {
              const pct = meta.alvo ? Math.min(100, meta.atual / meta.alvo * 100) : 0;
              const done = pct >= 100;
              const Ico = metaIconPessoal(meta.icone);
              return (
                <div key={meta.id}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="flex items-center gap-2 text-sm font-medium t-ink min-w-0"><span className="meta-ico"><Ico size={14} /></span><span className="truncate">{meta.nome}</span></span>
                    <div className="row-actions flex items-center" style={{ flexShrink: 0 }}>
                      <button onClick={() => { setAporteMeta(meta); setAporteVal(''); }} className="ibtn" title="Registrar aporte"><Plus size={14} /></button>
                      <button onClick={() => { setMetaEdit(meta); setMetaForm(true); }} className="ibtn"><Pencil size={14} /></button>
                      <button onClick={() => delMeta(meta.id)} className="ibtn ibtn-del"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%`, background: done ? '#087F5B' : '#1D4ED8' }} /></div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className={`text-xs ${done ? 't-green' : 't-soft'}`}>{done ? 'Meta concluída' : `${pct.toFixed(0)}% concluído`}</span>
                    <span className="mono text-xs t-soft">{fmtBRL(meta.atual)} / {fmtBRL(meta.alvo)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 10. Lançamentos */}
      <div className="card">
        <div className="p-4 list-head">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="display h-card t-ink">Lançamentos</h3>
            <span className="count-pill">{filtered.length} {filtered.length === 1 ? 'lançamento' : 'lançamentos'}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="seg w-full sm:w-auto">
              {['todos', 'entrada', 'saida'].map(t => <button key={t} onClick={() => setFiltroTipo(t)} className={`seg-btn ${filtroTipo === t ? 'on' : ''}`}>{t === 'todos' ? 'Todos' : t === 'entrada' ? 'Entradas' : 'Saídas'}</button>)}
            </div>
            <button onClick={() => { setEditing(null); setOpenForm(true); }} className="btn btn-primary fin-new sm:ml-auto"><Plus size={16} /> Novo Lançamento</button>
          </div>
        </div>

        {filtered.length === 0 ? <EmptyState icon={Coins} title="Sem lançamentos pessoais ainda." /> : (
          <div className="tx-list">
            {(expandTx ? filtered : filtered.slice(0, 4)).map((x, i) => {
              const isE = x.tipo === 'entrada'; const eff = effStatus(x); const sb = statusBadge(x);
              const ov = eff === 'vencido'; const canc = eff === 'cancelado';
              const Ico = catIconPessoal(x.categoria);
              return (
                <div key={x.id} className={`tx-item ${ov ? 'tx-overdue' : ''} ${i >= 4 ? 'tx-reveal' : ''}`}>
                  <div className={`cat-ico ${isE ? 'cat-ico-in' : 'cat-ico-out'}`}><Ico size={14} /></div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${canc ? 'tx-canc' : 't-ink'}`}>{x.descricao}</div>
                    <div className="text-xs t-soft mt-0.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone={sb.tone}>{sb.label}</Badge>
                      <Badge tone="slate">{x.categoria}</Badge>
                      <span>{fmtDate(x.data)}</span>
                      {(eff === 'pendente' || ov) && x.vencimento && <span className="hide-sm">· vence {fmtDate(x.vencimento)}</span>}
                      {x.conta && <span className="hide-sm">· {x.conta}</span>}
                    </div>
                  </div>
                  <div className={`mono text-sm font-semibold text-right ${canc ? 't-mute' : isE ? 't-green' : 't-red'}`} style={{ flexShrink: 0, textDecoration: canc ? 'line-through' : 'none' }}>{isE ? '+ ' : '− '}{fmtBRL(x.valor)}</div>
                  <div className="row-actions flex">
                    <button onClick={() => { setEditing(x); setOpenForm(true); }} className="ibtn"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(x.id)} className="ibtn ibtn-del"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
            {filtered.length > 4 && (
              <button onClick={() => setExpandTx(v => !v)} className="tx-toggle">
                {expandTx ? 'Ocultar lista' : `Mostrar mais ${filtered.length - 4} lançamento(s)`}
                <ChevronDown size={15} className={`tx-chev ${expandTx ? 'up' : ''}`} />
              </button>
            )}
          </div>
        )}
      </div>

      <Modal open={openForm} onClose={() => { setOpenForm(false); setEditing(null); }} title={editing ? 'Editar lançamento' : 'Novo lançamento pessoal'} wide>
        <LancamentoPessoalForm item={editing} onSave={handleSave} onCancel={() => { setOpenForm(false); setEditing(null); }} />
      </Modal>

      <Modal open={metaForm} onClose={() => { setMetaForm(false); setMetaEdit(null); }} title={metaEdit ? 'Editar meta' : 'Nova meta'}>
        <MetaForm item={metaEdit} onSave={saveMeta} onCancel={() => { setMetaForm(false); setMetaEdit(null); }} />
      </Modal>

      <Modal open={!!aporteMeta} onClose={() => { setAporteMeta(null); setAporteVal(''); }} title="Registrar aporte">
        {aporteMeta && (
          <div className="space-y-4">
            <div>
              <div className="label">Meta</div>
              <div className="text-base font-medium t-ink mt-0.5">{aporteMeta.nome}</div>
              <div className="text-xs t-soft mt-1">Atual: {fmtBRL(aporteMeta.atual)} de {fmtBRL(aporteMeta.alvo)}</div>
            </div>
            <Field label="Valor do aporte (R$)"><input type="number" step="0.01" className="inp" value={aporteVal} onChange={(e) => setAporteVal(e.target.value)} autoFocus /></Field>
            {parseFloat(aporteVal) > 0 && <div className="metric-box flex items-center justify-between gap-3"><span className="label">Novo total</span><span className="display t-ink total-val">{fmtBRL((aporteMeta.atual || 0) + parseFloat(aporteVal))}</span></div>}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button onClick={() => { setAporteMeta(null); setAporteVal(''); }} className="btn btn-ghost">Cancelar</button>
              <button onClick={confirmAporte} className="btn btn-primary">Adicionar aporte</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!delTarget} onClose={() => setDelTarget(null)} title="Excluir lançamento">
        {delTarget && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="chip chip-red" style={{ flexShrink: 0 }}><Trash2 size={16} /></div>
              <div className="min-w-0">
                <p className="text-sm t-ink">Tem certeza que deseja excluir este lançamento?</p>
                <div className="text-xs t-soft mt-1 truncate">{delTarget.descricao} · <span className="mono">{fmtBRL(delTarget.valor)}</span></div>
                <p className="text-xs t-mute mt-1">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button onClick={() => setDelTarget(null)} className="btn btn-ghost">Cancelar</button>
              <button onClick={confirmDelete} className="btn btn-danger">Excluir</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal item={metaDel} title="Excluir meta" message="Tem certeza que deseja excluir esta meta?" onCancel={() => setMetaDel(null)} onConfirm={confirmMetaDel} />

      {toast && <div className="toast"><CircleAlert size={15} /> {toast}</div>}
    </div>
  );
}

function LancamentoPessoalForm({ item, onSave, onCancel }) {
  const [f, setF] = useState({
    data: item?.data || new Date().toISOString().slice(0, 10), tipo: item?.tipo || 'saida',
    categoria: item?.categoria || CAT_FIN_PESSOAL.saida[0], descricao: item?.descricao || '',
    valor: item?.valor || '', conta: item?.conta || '', forma: item?.forma || 'PIX',
    status: item?.status || 'pago', vencimento: item?.vencimento || '', dataPagamento: item?.dataPagamento || '', obs: item?.obs || '',
  });
  const cats = CAT_FIN_PESSOAL[f.tipo];
  const submitForm = () => { onSave({ ...f, valor: parseFloat(f.valor) || 0 }); };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo"><select className="inp" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value, categoria: CAT_FIN_PESSOAL[e.target.value][0] })}><option value="entrada">Entrada</option><option value="saida">Saída</option></select></Field>
        <Field label="Data"><input type="date" className="inp" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} required /></Field>
        <Field label="Categoria"><select className="inp" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>{cats.map(c => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Valor (R$)"><input type="number" step="0.01" className="inp" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} required /></Field>
        <Field label="Descrição" span={2}><input className="inp" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} required /></Field>
        <Field label="Situação"><select className="inp" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{STATUS_LANC.map(s => <option key={s.k} value={s.k}>{s.label}</option>)}</select></Field>
        <Field label={f.status === 'pago' ? 'Data de pagamento/recebimento' : 'Data de vencimento'}>
          {f.status === 'pago'
            ? <input type="date" className="inp" value={f.dataPagamento} onChange={(e) => setF({ ...f, dataPagamento: e.target.value })} />
            : <input type="date" className="inp" value={f.vencimento} onChange={(e) => setF({ ...f, vencimento: e.target.value })} />}
        </Field>
        <Field label="Conta / Cartão"><input className="inp" value={f.conta} onChange={(e) => setF({ ...f, conta: e.target.value })} placeholder="Ex: Conta Corrente, Nubank" /></Field>
        <Field label="Forma de Pagamento"><select className="inp" value={f.forma} onChange={(e) => setF({ ...f, forma: e.target.value })}>{FORMAS_PGTO.map(p => <option key={p}>{p}</option>)}</select></Field>
        <Field label="Observações" span={2}><textarea className="inp" rows={2} value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} /></Field>
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 form-foot">
        <button type="button" onClick={onCancel} className="btn btn-ghost">Cancelar</button>
        <button type="button" onClick={submitForm} className="btn btn-primary">Salvar</button>
      </div>
    </div>
  );
}

function MetaForm({ item, onSave, onCancel }) {
  const ICONES = [{ k: 'reserva', label: 'Reserva / Poupança' }, { k: 'cartao', label: 'Cartão / Dívida' }, { k: 'carro', label: 'Veículo' }, { k: 'guardar', label: 'Objetivo geral' }];
  const [f, setF] = useState({ nome: item?.nome || '', alvo: item?.alvo || '', atual: item?.atual || '', icone: item?.icone || 'reserva' });
  const submitForm = () => { onSave({ ...f, alvo: parseFloat(f.alvo) || 0, atual: parseFloat(f.atual) || 0 }); };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome da meta" span={2}><input className="inp" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required placeholder="Ex: Reserva de emergência" /></Field>
        <Field label="Valor alvo (R$)"><input type="number" step="0.01" className="inp" value={f.alvo} onChange={(e) => setF({ ...f, alvo: e.target.value })} required /></Field>
        <Field label="Valor atual (R$)"><input type="number" step="0.01" className="inp" value={f.atual} onChange={(e) => setF({ ...f, atual: e.target.value })} /></Field>
        <Field label="Ícone / Tipo" span={2}><select className="inp" value={f.icone} onChange={(e) => setF({ ...f, icone: e.target.value })}>{ICONES.map(i => <option key={i.k} value={i.k}>{i.label}</option>)}</select></Field>
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1 form-foot">
        <button type="button" onClick={onCancel} className="btn btn-ghost">Cancelar</button>
        <button type="button" onClick={submitForm} className="btn btn-primary">Salvar meta</button>
      </div>
    </div>
  );
}

// ============================================================
// FRETES / LINHAS
// ============================================================
function Linhas({ data, setData }) {
  const { linhas, veiculos, motoristas, config, finEmpresa, contratos } = data;
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const enriched = useMemo(() => linhas.map(l => {
    const veic = veiculos.find(v => v.id === l.veiculoId); const cons = veic?.consumo || config?.consumoPadrao || 10; const preco = config?.precoCombustivel || 5.89;
    const receita = (l.kmMensal || 0) * l.valorKm; const comb = (l.kmMensal || 0) / cons * preco; const lucro = receita - comb;
    const real = realPorLinha(finEmpresa, l.id);
    const contrato = (contratos || []).find(c => (c.linhaIds || []).includes(l.id));
    return { ...l, receita, comb, lucro, margem: receita ? (lucro / receita * 100) : 0, real, contrato };
  }), [linhas, veiculos, config, finEmpresa, contratos]);

  const [toast, setToast] = useToast();
  const [delTarget, setDelTarget] = useState(null);
  const handleSave = (item) => { const msg = editing ? 'Linha atualizada com sucesso' : 'Linha salva com sucesso'; setData(d => ({ ...d, linhas: editing ? d.linhas.map(x => x.id === editing.id ? { ...item, id: editing.id } : x) : [...d.linhas, { ...item, id: uid() }] })); setOpenForm(false); setEditing(null); setToast(msg); };
  const handleDelete = (id) => { const item = linhas.find(x => x.id === id); if (item) setDelTarget(item); };
  const confirmDelete = () => { if (delTarget) { setData(d => ({ ...d, linhas: d.linhas.filter(x => x.id !== delTarget.id) })); setToast('Linha excluída com sucesso'); setDelTarget(null); } };

  return (
    <div className="p-4 sm:p-7 space-y-5">
      <NewButton onClick={() => { setEditing(null); setOpenForm(true); }}>Nova Linha / Frete</NewButton>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {enriched.length === 0 ? <div className="col-span-full"><div className="card"><EmptyState icon={Route} title="Nenhuma linha cadastrada ainda." /></div></div> : enriched.map(l => (
          <div key={l.id} className="card card-hover p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <Badge tone="blue">{l.tipo}</Badge>
                <Badge tone={l.status === 'ativo' ? 'green' : 'slate'}>{l.status}</Badge>
                {l.contrato && <span className="lnk-linha"><FileSignature size={11} /> {l.contrato.nome}</span>}
              </div>
              <div className="row-actions flex">
                <button onClick={() => { setEditing(l); setOpenForm(true); }} className="ibtn"><Pencil size={14} /></button>
                <button onClick={() => handleDelete(l.id)} className="ibtn ibtn-del"><Trash2 size={14} /></button>
              </div>
            </div>

            <h3 className="display t-ink leading-tight card-title">{l.nome}</h3>
            <p className="text-xs t-soft mt-1">{l.cliente}</p>
            <div className="flex items-center gap-1.5 text-xs t-soft mt-2.5">
              <MapPin size={13} className="t-mute flex-shrink-0" />
              <span className="truncate">{l.origem} → {l.destino}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 card-divide">
              <div className="min-w-0"><div className="label truncate">KM/mês</div><div className="mono text-sm font-semibold t-ink mt-1">{fmtNum(l.kmMensal)}</div></div>
              <div className="min-w-0"><div className="label truncate">R$/km</div><div className="mono text-sm font-semibold t-ink mt-1">{l.valorKm.toFixed(2)}</div></div>
              <div className="min-w-0"><div className="label truncate">Receita est.</div><div className="mono text-sm font-semibold t-ink mt-1">{fmtBRL(l.receita)}</div></div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mt-3">
              <div className="metric-box min-w-0">
                <div className="label truncate">Lucro estimado</div>
                <div className={`mono font-semibold mt-1 metric-val ${l.lucro >= 0 ? 't-green' : 't-red'}`}>{fmtBRL(l.lucro)}</div>
                <div className="text-xs t-soft mt-0.5">Margem {l.margem.toFixed(0)}%</div>
              </div>
              <div className="metric-box min-w-0" style={l.real.count ? { background: '#F2FBF7', borderColor: '#D7EFE4' } : undefined}>
                <div className="label truncate">Lucro real</div>
                {l.real.count ? (<>
                  <div className={`mono font-semibold mt-1 metric-val ${l.real.lucro >= 0 ? 't-green' : 't-red'}`}>{fmtBRL(l.real.lucro)}</div>
                  <div className="text-xs t-soft mt-0.5">Margem {l.real.margem.toFixed(0)}%</div>
                </>) : (<>
                  <div className="mono font-semibold mt-1 metric-val t-mute">—</div>
                  <div className="text-xs t-mute mt-0.5">Sem lançamentos</div>
                </>)}
              </div>
            </div>

            {l.real.count > 0 && (
              <div className="flex items-center justify-between gap-2 mt-2.5 text-xs">
                <span className="t-soft">Receita real <b className="t-green">{fmtBRL(l.real.receita)}</b></span>
                <span className="t-soft">Custo real <b className="t-red">{fmtBRL(l.real.custo)}</b></span>
              </div>
            )}
          </div>
        ))}
      </div>

      <Modal open={openForm} onClose={() => { setOpenForm(false); setEditing(null); }} title={editing ? 'Editar linha' : 'Nova linha / frete'} wide>
        <LinhaForm item={editing} veiculos={veiculos} motoristas={motoristas} onSave={handleSave} onCancel={() => { setOpenForm(false); setEditing(null); }} />
      </Modal>
      <ConfirmModal item={delTarget} title="Excluir linha" message="Tem certeza que deseja excluir esta linha/frete?" onCancel={() => setDelTarget(null)} onConfirm={confirmDelete} />
      <Toast msg={toast} />
    </div>
  );
}

function LinhaForm({ item, veiculos, motoristas, onSave, onCancel }) {
  const [f, setF] = useState({
    nome: item?.nome || '', cliente: item?.cliente || '', origem: item?.origem || '', destino: item?.destino || '',
    tipo: item?.tipo || TIPOS_LINHA[0], kmViagem: item?.kmViagem || '', kmMensal: item?.kmMensal || '', valorKm: item?.valorKm || '',
    dias: item?.dias || '', veiculoId: item?.veiculoId || '', motoristaId: item?.motoristaId || '', status: item?.status || 'ativo',
  });
  const submitForm = () => { onSave({ ...f, kmViagem: +f.kmViagem || 0, kmMensal: +f.kmMensal || 0, valorKm: +f.valorKm || 0 }); };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome" span={2}><input className="inp" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required /></Field>
        <Field label="Cliente"><input className="inp" value={f.cliente} onChange={(e) => setF({ ...f, cliente: e.target.value })} /></Field>
        <Field label="Tipo"><select className="inp" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>{TIPOS_LINHA.map(t => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Origem"><input className="inp" value={f.origem} onChange={(e) => setF({ ...f, origem: e.target.value })} /></Field>
        <Field label="Destino"><input className="inp" value={f.destino} onChange={(e) => setF({ ...f, destino: e.target.value })} /></Field>
        <Field label="KM por viagem"><input type="number" className="inp" value={f.kmViagem} onChange={(e) => setF({ ...f, kmViagem: e.target.value })} /></Field>
        <Field label="KM mensal"><input type="number" className="inp" value={f.kmMensal} onChange={(e) => setF({ ...f, kmMensal: e.target.value })} /></Field>
        <Field label="Valor por KM"><input type="number" step="0.01" className="inp" value={f.valorKm} onChange={(e) => setF({ ...f, valorKm: e.target.value })} /></Field>
        <Field label="Dias"><input className="inp" placeholder="Seg–Sex" value={f.dias} onChange={(e) => setF({ ...f, dias: e.target.value })} /></Field>
        <Field label="Veículo"><select className="inp" value={f.veiculoId} onChange={(e) => setF({ ...f, veiculoId: e.target.value })}><option value="">—</option>{veiculos.map(v => <option key={v.id} value={v.id}>{v.placa}</option>)}</select></Field>
        <Field label="Motorista"><MotoristaSelect motoristas={motoristas} value={f.motoristaId} onChange={(val) => setF({ ...f, motoristaId: val })} /></Field>
        <Field label="Status"><select className="inp" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="ativo">Ativo</option><option value="pausado">Pausado</option><option value="finalizado">Finalizado</option></select></Field>
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 form-foot">
        <button type="button" onClick={onCancel} className="btn btn-ghost">Cancelar</button>
        <button type="button" onClick={submitForm} className="btn btn-primary">Salvar</button>
      </div>
    </div>
  );
}

// ============================================================
// VEÍCULOS
// ============================================================
function Veiculos({ data, setData }) {
  const { veiculos, combustivel, manutencao } = data;
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const [toast, setToast] = useToast();
  const [delTarget, setDelTarget] = useState(null);
  const handleSave = (item) => { const msg = editing ? 'Veículo atualizado com sucesso' : 'Veículo salvo com sucesso'; setData(d => ({ ...d, veiculos: editing ? d.veiculos.map(x => x.id === editing.id ? { ...item, id: editing.id } : x) : [...d.veiculos, { ...item, id: 'v' + uid() }] })); setOpenForm(false); setEditing(null); setToast(msg); };
  const handleDelete = (id) => { const item = veiculos.find(x => x.id === id); if (item) setDelTarget(item); };
  const confirmDelete = () => { if (delTarget) { setData(d => ({ ...d, veiculos: d.veiculos.filter(x => x.id !== delTarget.id) })); setToast('Veículo excluído com sucesso'); setDelTarget(null); } };

  return (
    <div className="p-4 sm:p-7 space-y-5">
      <NewButton onClick={() => { setEditing(null); setOpenForm(true); }}>Novo Veículo</NewButton>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {veiculos.length === 0 ? <div className="col-span-full"><div className="card"><EmptyState icon={Car} title="Nenhum veículo cadastrado." /></div></div> : veiculos.map(v => {
          const ab = combustivel.filter(c => c.veiculoId === v.id);
          const litros = ab.reduce((a, b) => a + b.litros, 0);
          const gastoComb = ab.reduce((a, b) => a + b.valor, 0);
          const gastoMnt = manutencao.filter(m => m.veiculoId === v.id && m.status === 'realizada').reduce((a, b) => a + b.valor, 0);
          const kmRodado = ab.length > 1 ? (Math.max(...ab.map(x => x.kmVeiculo)) - Math.min(...ab.map(x => x.kmVeiculo))) : 0;
          const consumoReal = litros > 0 && kmRodado > 0 ? (kmRodado / litros) : v.consumo;
          return (
            <div key={v.id} className="card card-hover p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Badge tone={v.status === 'ativo' ? 'green' : v.status === 'manutencao' ? 'orange' : 'slate'}>{v.status}</Badge>
                  <h3 className="display t-ink leading-tight veh-title">{v.modelo}</h3>
                  <div className="mono text-sm t-soft mt-0.5">{v.placa} · {v.ano}</div>
                </div>
                <div className="row-actions flex" style={{ flexShrink: 0 }}>
                  <button onClick={() => { setEditing(v); setOpenForm(true); }} className="ibtn"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(v.id)} className="ibtn ibtn-del"><Trash2 size={14} /></button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 mt-4">
                {[
                  { l: 'KM atual', v: `${fmtNum(v.km)} km`, red: false },
                  { l: 'Consumo real', v: `${consumoReal.toFixed(1)} km/l`, red: false },
                  { l: 'Gasto combustível', v: fmtBRL(gastoComb), red: true },
                  { l: 'Gasto manutenção', v: fmtBRL(gastoMnt), red: true },
                ].map((it, i) => (
                  <div key={i} className="metric-box min-w-0">
                    <div className="label truncate">{it.l}</div>
                    <div className={`mono font-semibold mt-1 veh-val ${it.red ? 't-red' : 't-ink'}`}>{it.v}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 card-divide grid grid-cols-3 gap-2">
                <div className="min-w-0"><div className="t-soft text-xs">Seguro</div><div className="font-medium t-ink truncate text-xs">{fmtDate(v.seguro)}</div></div>
                <div className="min-w-0"><div className="t-soft text-xs">IPVA</div><div className="font-medium t-ink truncate text-xs">{fmtDate(v.ipva)}</div></div>
                <div className="min-w-0"><div className="t-soft text-xs">Licenc.</div><div className="font-medium t-ink truncate text-xs">{fmtDate(v.licenciamento)}</div></div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={openForm} onClose={() => { setOpenForm(false); setEditing(null); }} title={editing ? 'Editar veículo' : 'Novo veículo'} wide>
        <VeiculoForm item={editing} onSave={handleSave} onCancel={() => { setOpenForm(false); setEditing(null); }} />
      </Modal>
      <ConfirmModal item={delTarget} title="Excluir veículo" message="Tem certeza que deseja excluir este veículo?" onCancel={() => setDelTarget(null)} onConfirm={confirmDelete} />
      <Toast msg={toast} />
    </div>
  );
}

function VeiculoForm({ item, onSave, onCancel }) {
  const [f, setF] = useState({
    placa: item?.placa || '', modelo: item?.modelo || '', ano: item?.ano || new Date().getFullYear(),
    combustivel: item?.combustivel || 'Flex', consumo: item?.consumo || 10, km: item?.km || 0,
    status: item?.status || 'ativo', seguro: item?.seguro || '', ipva: item?.ipva || '', licenciamento: item?.licenciamento || '',
  });
  const submitForm = () => { onSave({ ...f, ano: +f.ano, consumo: +f.consumo, km: +f.km }); };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Placa"><input className="inp" value={f.placa} onChange={(e) => setF({ ...f, placa: e.target.value.toUpperCase() })} required /></Field>
        <Field label="Modelo"><input className="inp" value={f.modelo} onChange={(e) => setF({ ...f, modelo: e.target.value })} required /></Field>
        <Field label="Ano"><input type="number" className="inp" value={f.ano} onChange={(e) => setF({ ...f, ano: e.target.value })} /></Field>
        <Field label="Combustível"><select className="inp" value={f.combustivel} onChange={(e) => setF({ ...f, combustivel: e.target.value })}>{['Flex', 'Gasolina', 'Etanol', 'Diesel', 'GNV'].map(c => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Consumo (km/l)"><input type="number" step="0.1" className="inp" value={f.consumo} onChange={(e) => setF({ ...f, consumo: e.target.value })} /></Field>
        <Field label="KM atual"><input type="number" className="inp" value={f.km} onChange={(e) => setF({ ...f, km: e.target.value })} /></Field>
        <Field label="Status"><select className="inp" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="ativo">Ativo</option><option value="manutencao">Manutenção</option><option value="parado">Parado</option></select></Field>
        <Field label="Seguro (venc.)"><input type="date" className="inp" value={f.seguro} onChange={(e) => setF({ ...f, seguro: e.target.value })} /></Field>
        <Field label="IPVA (venc.)"><input type="date" className="inp" value={f.ipva} onChange={(e) => setF({ ...f, ipva: e.target.value })} /></Field>
        <Field label="Licenciamento (venc.)"><input type="date" className="inp" value={f.licenciamento} onChange={(e) => setF({ ...f, licenciamento: e.target.value })} /></Field>
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 form-foot">
        <button type="button" onClick={onCancel} className="btn btn-ghost">Cancelar</button>
        <button type="button" onClick={submitForm} className="btn btn-primary">Salvar</button>
      </div>
    </div>
  );
}

// ============================================================
// COMBUSTÍVEL
// ============================================================
function Combustivel({ data, setData }) {
  const { combustivel, veiculos, linhas, motoristas, manutencao, finEmpresa } = data;
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expand, setExpand] = useState(false);

  const sorted = useMemo(() => [...combustivel].sort((a, b) => b.data.localeCompare(a.data)), [combustivel]);
  const stats = useMemo(() => {
    const mes = currentMonth();
    const pd = new Date(); pd.setMonth(pd.getMonth() - 1); const mesPrev = pd.toISOString().slice(0, 7);
    const noMes = combustivel.filter(c => monthKey(c.data) === mes);
    const noPrev = combustivel.filter(c => monthKey(c.data) === mesPrev);
    const totalMes = noMes.reduce((a, b) => a + b.valor, 0); const litrosMes = noMes.reduce((a, b) => a + b.litros, 0);
    const totalPrev = noPrev.reduce((a, b) => a + b.valor, 0); const litrosPrev = noPrev.reduce((a, b) => a + b.litros, 0);
    const manutMes = manutencao.filter(m => m.status === 'realizada' && monthKey(m.data) === mes).reduce((a, b) => a + (b.valor || 0), 0);
    const outras = finEmpresa.filter(e => e.tipo === 'saida' && monthKey(e.data) === mes && e.status !== 'cancelado' && e.categoria !== 'Combustível' && e.categoria !== 'Manutenção').reduce((a, b) => a + b.valor, 0);
    const totalCustos = totalMes + manutMes + outras;
    return {
      totalMes, litrosMes, precoMedio: litrosMes > 0 ? totalMes / litrosMes : 0,
      litrosPrev, precoPrev: litrosPrev > 0 ? totalPrev / litrosPrev : 0,
      totalCustos, pctComb: totalCustos > 0 ? (totalMes / totalCustos) * 100 : 0,
    };
  }, [combustivel, manutencao, finEmpresa]);
  const litrosDelta = stats.litrosPrev > 0 ? pctChange(stats.litrosMes, stats.litrosPrev) : 0;
  const litrosFill = Math.max(stats.litrosMes / Math.max(stats.litrosMes, stats.litrosPrev, 1) * 100, 4);
  const precoDelta = stats.precoPrev > 0 ? pctChange(stats.precoMedio, stats.precoPrev) : 0;
  const donutData = [
    { name: 'Combustível', value: stats.totalMes, color: '#D97706' },
    { name: 'Outros', value: Math.max(stats.totalCustos - stats.totalMes, 0), color: '#EDEFF3' },
  ];
  const porMes = useMemo(() => {
    const map = new Map();
    for (let i = 5; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i); const k = d.toISOString().slice(0, 7); map.set(k, { mes: MONTHS_PT[d.getMonth()], valor: 0 }); }
    combustivel.forEach(c => { if (map.has(monthKey(c.data))) map.get(monthKey(c.data)).valor += c.valor; });
    return Array.from(map.values());
  }, [combustivel]);

  const handleSave = (item) => { const msg = editing ? 'Abastecimento atualizado com sucesso' : 'Abastecimento salvo com sucesso'; setData(d => ({ ...d, combustivel: editing ? d.combustivel.map(x => x.id === editing.id ? { ...item, id: editing.id } : x) : [...d.combustivel, { ...item, id: uid() }] })); setOpenForm(false); setEditing(null); setToast(msg); };
  const [toast, setToast] = useToast();
  const [delTarget, setDelTarget] = useState(null);
  const handleDelete = (id) => { const item = combustivel.find(c => c.id === id); if (item) setDelTarget(item); };
  const confirmDelete = () => { if (delTarget) { setData(d => ({ ...d, combustivel: d.combustivel.filter(c => c.id !== delTarget.id) })); setToast('Abastecimento excluído com sucesso'); setDelTarget(null); } };

  return (
    <div className="p-4 sm:p-7 space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="card card-hover p-4 sm:p-5" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="label">Gasto no mês</div>
              <div className="display t-ink mono stat-lg" style={{ lineHeight: 1.1 }}>{fmtBRL(stats.totalMes)}</div>
            </div>
            <span className="pill pill-orange" style={{ flexShrink: 0 }}><Fuel size={16} /></span>
          </div>
          <div className="flex items-center gap-3 mt-auto pt-3">
            <div style={{ position: 'relative', width: 78, height: 78, flexShrink: 0 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={donutData} dataKey="value" innerRadius={24} outerRadius={37} startAngle={90} endAngle={-270} paddingAngle={1.5} stroke="none">
                    {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <span className="t-mute" style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>Comb.</span>
                <span className="mono font-semibold t-orange" style={{ fontSize: 14, lineHeight: 1 }}>{stats.pctComb.toFixed(0)}%</span>
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold t-ink">{stats.pctComb.toFixed(0)}% dos custos</div>
              <div className="text-xs t-mute truncate">de {fmtBRL(stats.totalCustos)} no mês</div>
            </div>
          </div>
        </div>

        <div className="card card-hover p-4 sm:p-5" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="label">Litros no mês</div>
              <div className="display t-ink mono stat-lg" style={{ lineHeight: 1.1 }}>{stats.litrosMes.toFixed(1)} L</div>
            </div>
            <span className="pill" style={{ flexShrink: 0, background: '#EEF2FF', color: '#1D4ED8' }}><Activity size={16} /></span>
          </div>
          <div className="mt-auto pt-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="t-soft">vs. mês anterior</span>
              <span className={litrosDelta > 0 ? 't-red' : 't-green'} style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                {litrosDelta > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(litrosDelta).toFixed(0)}%
              </span>
            </div>
            <div className="bar-track"><div className="bar-fill" style={{ width: `${litrosFill}%`, background: 'linear-gradient(90deg,#1D4ED8,#3B82F6)' }} /></div>
            <div className="text-xs t-mute mt-1.5">Anterior: {stats.litrosPrev.toFixed(1)} L</div>
          </div>
        </div>

        <div className="card card-hover p-4 sm:p-5" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="label">Preço médio</div>
              <div className="display t-ink mono stat-lg" style={{ lineHeight: 1.1 }}>{fmtBRL(stats.precoMedio)}<span className="text-sm t-soft"> /L</span></div>
            </div>
            <span className="pill" style={{ flexShrink: 0, background: '#EEF2FF', color: '#1D4ED8' }}><Coins size={16} /></span>
          </div>
          <div className="mt-auto pt-4">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, padding: '4px 9px', borderRadius: 999, background: precoDelta > 0 ? '#FBEAEF' : '#E7F6F0', color: precoDelta > 0 ? '#C0395A' : '#0B815E' }}>
              {precoDelta > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{Math.abs(precoDelta).toFixed(1)}%
              <span style={{ fontWeight: 500 }}>{precoDelta > 0 ? 'mais caro' : 'mais barato'}</span>
            </span>
            <div className="text-xs t-mute mt-2">Período anterior: {fmtBRL(stats.precoPrev)}/L</div>
          </div>
        </div>
      </div>

      <div className="card p-4 sm:p-5">
        <h3 className="display h-card t-ink mb-3">Gasto por mês</h3>
        <div style={{ height: 'clamp(150px, 38vw, 190px)' }}>
          <ResponsiveContainer>
            <BarChart data={porMes} margin={{ top: 6, right: 6, left: -16, bottom: 0 }} barCategoryGap="28%">
              <defs>
                <linearGradient id="gFuel" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F59E0B" /><stop offset="100%" stopColor="#D97706" /></linearGradient>
              </defs>
              <CartesianGrid stroke="#EEF0F3" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip formatter={(v) => [fmtBRL(v), 'Gasto']} cursor={{ fill: 'rgba(217,119,6,.07)', radius: 6 }} contentStyle={{ borderRadius: 12, border: '1px solid #EEF0F3', fontSize: 11, padding: '7px 11px', boxShadow: '0 8px 24px rgba(11,19,36,.10)' }} wrapperStyle={{ zIndex: 30 }} />
              <Bar dataKey="valor" fill="url(#gFuel)" radius={[7, 7, 0, 0]} maxBarSize={46} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 list-head">
          <h3 className="display h-card t-ink">Abastecimentos</h3>
          <div className="sm:ml-auto"><NewButton onClick={() => { setEditing(null); setOpenForm(true); }}>Novo Abastecimento</NewButton></div>
        </div>
        {sorted.length === 0 ? <EmptyState icon={Fuel} title="Sem abastecimentos." /> : (
          <>
            <div className="divide">
              {(expand ? sorted : sorted.slice(0, 4)).map((c, i) => {
                const v = veiculos.find(x => x.id === c.veiculoId); const linha = linhas.find(l => l.id === c.linhaId);
                return (
                  <div key={c.id} className={`row flex items-center gap-3 ${i >= 4 ? 'tx-reveal' : ''}`} style={{ padding: '12px 16px' }}>
                    <div className="pill pill-orange" style={{ flexShrink: 0 }}><Fuel size={15} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium t-ink truncate">{c.posto || 'Abastecimento'} · {c.litros.toFixed(1)} L</div>
                      <div className="text-xs t-soft flex flex-wrap gap-1.5"><span>{fmtDate(c.data)}</span><span>·</span><span className="mono">{v?.placa}</span>{linha && <span className="hide-sm">· {linha.nome}</span>}</div>
                    </div>
                    <div className="text-right" style={{ flexShrink: 0 }}><div className="mono text-sm font-semibold t-ink">{fmtBRL(c.valor)}</div><div className="text-xs t-soft mono">{fmtBRL(c.valorLitro)}/L</div></div>
                    <div className="row-actions flex">
                      <button onClick={() => { setEditing(c); setOpenForm(true); }} className="ibtn"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(c.id)} className="ibtn ibtn-del"><Trash2 size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
            {sorted.length > 4 && (
              <div className="px-4 pb-2">
                <button onClick={() => setExpand(v => !v)} className="tx-toggle">
                  {expand ? 'Ocultar abastecimentos' : `Mostrar mais (${sorted.length - 4})`}
                  <ChevronDown size={15} className={`tx-chev ${expand ? 'up' : ''}`} />
                </button>
                <div className="text-xs t-mute text-center" style={{ marginTop: -2 }}>Mostrando {expand ? sorted.length : Math.min(4, sorted.length)} de {sorted.length}</div>
              </div>
            )}
          </>
        )}
      </div>

      <Modal open={openForm} onClose={() => { setOpenForm(false); setEditing(null); }} title={editing ? 'Editar abastecimento' : 'Novo abastecimento'} wide>
        <AbastecimentoForm item={editing} veiculos={veiculos} linhas={linhas} motoristas={motoristas} onSave={handleSave} onCancel={() => { setOpenForm(false); setEditing(null); }} />
      </Modal>
      <ConfirmModal item={delTarget} title="Excluir abastecimento" message="Tem certeza que deseja excluir este abastecimento?" onCancel={() => setDelTarget(null)} onConfirm={confirmDelete} />
      <Toast msg={toast} />
    </div>
  );
}

function AbastecimentoForm({ item, veiculos, linhas, motoristas, onSave, onCancel }) {
  const [f, setF] = useState({
    data: item?.data || new Date().toISOString().slice(0, 10), veiculoId: item?.veiculoId || veiculos[0]?.id || '',
    posto: item?.posto || '', tipo: item?.tipo || 'Gasolina', litros: item?.litros || '', valorLitro: item?.valorLitro || '',
    kmVeiculo: item?.kmVeiculo || '', linhaId: item?.linhaId || '', motoristaId: item?.motoristaId || '',
  });
  const valorTotal = (+f.litros || 0) * (+f.valorLitro || 0);
  const submitForm = () => { onSave({ ...f, litros: +f.litros, valorLitro: +f.valorLitro, valor: valorTotal, kmVeiculo: +f.kmVeiculo }); };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data"><input type="date" className="inp" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} required /></Field>
        <Field label="Veículo"><select className="inp" value={f.veiculoId} onChange={(e) => setF({ ...f, veiculoId: e.target.value })} required>{veiculos.map(v => <option key={v.id} value={v.id}>{v.placa}</option>)}</select></Field>
        <Field label="Motorista"><MotoristaSelect motoristas={motoristas} value={f.motoristaId} onChange={(val) => setF({ ...f, motoristaId: val })} /></Field>
        <Field label="Posto"><input className="inp" value={f.posto} onChange={(e) => setF({ ...f, posto: e.target.value })} /></Field>
        <Field label="Tipo"><select className="inp" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>{['Gasolina', 'Etanol', 'Diesel', 'GNV'].map(t => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Litros"><input type="number" step="0.01" className="inp" value={f.litros} onChange={(e) => setF({ ...f, litros: e.target.value })} required /></Field>
        <Field label="Valor por litro"><input type="number" step="0.001" className="inp" value={f.valorLitro} onChange={(e) => setF({ ...f, valorLitro: e.target.value })} required /></Field>
        <Field label="KM do veículo"><input type="number" className="inp" value={f.kmVeiculo} onChange={(e) => setF({ ...f, kmVeiculo: e.target.value })} /></Field>
        <Field label="Linha / Frete"><select className="inp" value={f.linhaId} onChange={(e) => setF({ ...f, linhaId: e.target.value })}><option value="">—</option>{linhas.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}</select></Field>
        <div className="col-span-2 metric-box flex items-center justify-between gap-3">
          <span className="label">Total</span>
          <span className="display t-ink total-val">{fmtBRL(valorTotal)}</span>
        </div>
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 form-foot">
        <button type="button" onClick={onCancel} className="btn btn-ghost">Cancelar</button>
        <button type="button" onClick={submitForm} className="btn btn-primary">Salvar</button>
      </div>
    </div>
  );
}

// ============================================================
// MANUTENÇÃO
// ============================================================
function Manutencao({ data, setData }) {
  const { manutencao, veiculos, motoristas } = data;
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const sorted = useMemo(() => [...manutencao].sort((a, b) => (b.data || '').localeCompare(a.data || '')), [manutencao]);

  const handleSave = (item) => { const msg = editing ? 'Manutenção atualizada com sucesso' : 'Manutenção salva com sucesso'; setData(d => ({ ...d, manutencao: editing ? d.manutencao.map(x => x.id === editing.id ? { ...item, id: editing.id } : x) : [...d.manutencao, { ...item, id: 'mn' + uid() }] })); setOpenForm(false); setEditing(null); setToast(msg); };
  const [toast, setToast] = useToast();
  const [delTarget, setDelTarget] = useState(null);
  const handleDelete = (id) => { const item = manutencao.find(x => x.id === id); if (item) setDelTarget(item); };
  const confirmDelete = () => { if (delTarget) { setData(d => ({ ...d, manutencao: d.manutencao.filter(x => x.id !== delTarget.id) })); setToast('Registro excluído com sucesso'); setDelTarget(null); } };

  return (
    <div className="p-4 sm:p-7 space-y-5">
      <NewButton onClick={() => { setEditing(null); setOpenForm(true); }}>Nova Manutenção</NewButton>
      <div className="card">
        {sorted.length === 0 ? <EmptyState icon={Wrench} title="Sem manutenções registradas." /> : (
          <div className="divide">
            {sorted.map(m => {
              const v = veiculos.find(x => x.id === m.veiculoId);
              const tone = m.status === 'realizada' ? 'green' : m.status === 'agendada' ? 'blue' : 'orange';
              return (
                <div key={m.id} className="row p-4 flex items-center gap-3">
                  <div className={`pill ${m.status === 'realizada' ? 'pill-green' : 'pill-orange'}`}><Wrench size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap"><span className="text-sm font-medium t-ink">{m.categoria}</span><Badge tone={tone}>{m.status}</Badge></div>
                    <div className="text-xs t-soft mt-0.5 truncate">{m.descricao && <span>{m.descricao} · </span>}{v?.placa} · {fmtDate(m.data)}{m.oficina && <span> · {m.oficina}</span>}</div>
                    {m.proxData && m.status !== 'realizada' && <div className="text-xs t-orange mt-1 flex items-center gap-1"><Clock size={11} /> Próxima: {fmtDate(m.proxData)}</div>}
                  </div>
                  <div className="mono text-sm font-semibold t-ink" style={{ flexShrink: 0 }}>{m.valor ? fmtBRL(m.valor) : '—'}</div>
                  <div className="row-actions flex">
                    <button onClick={() => { setEditing(m); setOpenForm(true); }} className="ibtn"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(m.id)} className="ibtn ibtn-del"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={openForm} onClose={() => { setOpenForm(false); setEditing(null); }} title={editing ? 'Editar manutenção' : 'Nova manutenção'} wide>
        <ManutForm item={editing} veiculos={veiculos} motoristas={motoristas} onSave={handleSave} onCancel={() => { setOpenForm(false); setEditing(null); }} />
      </Modal>
      <ConfirmModal item={delTarget} title="Excluir manutenção" message="Tem certeza que deseja excluir este registro de manutenção?" onCancel={() => setDelTarget(null)} onConfirm={confirmDelete} />
      <Toast msg={toast} />
    </div>
  );
}

function ManutForm({ item, veiculos, motoristas, onSave, onCancel }) {
  const [f, setF] = useState({
    data: item?.data || new Date().toISOString().slice(0, 10), veiculoId: item?.veiculoId || veiculos[0]?.id || '',
    categoria: item?.categoria || CAT_MANUT[0], descricao: item?.descricao || '', oficina: item?.oficina || '',
    valor: item?.valor || '', km: item?.km || '', proxKm: item?.proxKm || '', proxData: item?.proxData || '', status: item?.status || 'realizada',
    motoristaId: item?.motoristaId || '',
  });
  const submitForm = () => { onSave({ ...f, valor: +f.valor || 0, km: +f.km || 0, proxKm: +f.proxKm || 0 }); };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data"><input type="date" className="inp" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} required /></Field>
        <Field label="Veículo"><select className="inp" value={f.veiculoId} onChange={(e) => setF({ ...f, veiculoId: e.target.value })} required>{veiculos.map(v => <option key={v.id} value={v.id}>{v.placa}</option>)}</select></Field>
        <Field label="Categoria"><select className="inp" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>{CAT_MANUT.map(c => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Status"><select className="inp" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="realizada">Realizada</option><option value="pendente">Pendente</option><option value="agendada">Agendada</option></select></Field>
        <Field label="Motorista" span={2}><MotoristaSelect motoristas={motoristas} value={f.motoristaId} onChange={(val) => setF({ ...f, motoristaId: val })} /></Field>
        <Field label="Descrição" span={2}><input className="inp" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Field>
        <Field label="Oficina"><input className="inp" value={f.oficina} onChange={(e) => setF({ ...f, oficina: e.target.value })} /></Field>
        <Field label="Valor (R$)"><input type="number" step="0.01" className="inp" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} /></Field>
        <Field label="KM do veículo"><input type="number" className="inp" value={f.km} onChange={(e) => setF({ ...f, km: e.target.value })} /></Field>
        <Field label="Próx. em KM"><input type="number" className="inp" value={f.proxKm} onChange={(e) => setF({ ...f, proxKm: e.target.value })} /></Field>
        <Field label="Próxima data" span={2}><input type="date" className="inp" value={f.proxData} onChange={(e) => setF({ ...f, proxData: e.target.value })} /></Field>
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 form-foot">
        <button type="button" onClick={onCancel} className="btn btn-ghost">Cancelar</button>
        <button type="button" onClick={submitForm} className="btn btn-primary">Salvar</button>
      </div>
    </div>
  );
}

// ============================================================
// MOTORISTAS
// ============================================================
function MotoristaSelect({ motoristas = [], value, onChange }) {
  return (
    <select className="inp" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Selecione um motorista</option>
      {motoristas.map(m => <option key={m.id} value={m.id}>{m.apelido || m.nome}</option>)}
    </select>
  );
}

function cnhStatus(vencCnh) {
  if (!vencCnh) return null;
  const dias = Math.round((new Date(vencCnh) - new Date()) / 86400000);
  if (dias < 0) return { tone: 'red', label: 'CNH vencida' };
  if (dias <= 30) return { tone: 'orange', label: `CNH vence em ${dias}d` };
  return null;
}

function Motoristas({ data, setData }) {
  const { motoristas, veiculos, linhas, combustivel, manutencao } = data;
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const handleSave = (item) => { const msg = editing ? 'Motorista atualizado com sucesso' : 'Motorista salvo com sucesso'; setData(d => ({ ...d, motoristas: editing ? d.motoristas.map(x => x.id === editing.id ? { ...item, id: editing.id } : x) : [...d.motoristas, { ...item, id: 'm' + uid() }] })); setOpenForm(false); setEditing(null); setToast(msg); };
  const [toast, setToast] = useToast();
  const [delTarget, setDelTarget] = useState(null);
  const handleDelete = (id) => { const item = motoristas.find(x => x.id === id); if (item) setDelTarget(item); };
  const confirmDelete = () => { if (delTarget) { setData(d => ({ ...d, motoristas: d.motoristas.filter(x => x.id !== delTarget.id) })); setToast('Motorista excluído com sucesso'); setDelTarget(null); } };

  const alertas = useMemo(() => {
    const arr = [];
    motoristas.forEach(m => {
      const nome = m.apelido || m.nome;
      const cs = cnhStatus(m.vencCnh);
      if (cs) arr.push({ nome, tipo: cs.label, tone: cs.tone });
      if (m.status === 'inativo') arr.push({ nome, tipo: 'Inativo', tone: 'slate' });
      if (m.status === 'afastado') arr.push({ nome, tipo: 'Afastado', tone: 'orange' });
      if (!m.veiculoId) arr.push({ nome, tipo: 'Sem veículo', tone: 'orange' });
    });
    return arr;
  }, [motoristas]);

  return (
    <div className="p-4 sm:p-7 space-y-5">
      <NewButton onClick={() => { setEditing(null); setOpenForm(true); }}>Novo Motorista</NewButton>

      {alertas.length > 0 && (
        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="display h-card t-ink">Alertas de Motoristas</h3>
            <AlertTriangle size={18} className="t-orange" />
          </div>
          <div className="flex flex-wrap gap-2">
            {alertas.map((a, i) => (
              <div key={i} className="alert-chip"><Badge tone={a.tone}>{a.tipo}</Badge><span className="text-xs t-soft">{a.nome}</span></div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {motoristas.length === 0 ? <div className="col-span-full"><div className="card"><EmptyState icon={Users} title="Nenhum motorista cadastrado." /></div></div> : motoristas.map(m => {
          const veic = veiculos.find(v => v.id === m.veiculoId);
          const nFretes = linhas.filter(l => l.motoristaId === m.id).length;
          const nAbast = combustivel.filter(c => c.motoristaId === m.id).length;
          const nManut = manutencao.filter(x => x.motoristaId === m.id).length;
          const receita = linhas.filter(l => l.motoristaId === m.id).reduce((a, l) => a + (l.kmMensal || 0) * (l.valorKm || 0), 0);
          const cs = cnhStatus(m.vencCnh);
          const statusTone = m.status === 'ativo' ? 'green' : m.status === 'afastado' ? 'orange' : 'slate';
          return (
            <div key={m.id} className="card card-hover p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="avatar">{(m.apelido || m.nome || '?').slice(0, 1).toUpperCase()}</div>
                  <div className="min-w-0">
                    <h3 className="display t-ink leading-tight" style={{ fontSize: 'clamp(1.05rem,3.6vw,1.25rem)' }}>{m.apelido || m.nome}</h3>
                    <div className="text-xs t-soft truncate">{m.nome}</div>
                  </div>
                </div>
                <div className="row-actions flex">
                  <button onClick={() => { setEditing(m); setOpenForm(true); }} className="ibtn"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(m.id)} className="ibtn ibtn-del"><Trash2 size={14} /></button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap mt-3">
                <Badge tone={statusTone}>{m.status}</Badge>
                {m.vinculo && <Badge tone="blue">{m.vinculo}</Badge>}
                {m.categoriaCnh && <Badge tone="slate">CNH {m.categoriaCnh}</Badge>}
                {cs && <Badge tone={cs.tone}>{cs.label}</Badge>}
              </div>

              <div className="mt-3 space-y-1 text-xs t-soft">
                {m.telefone && <div className="flex items-center gap-1.5"><Phone size={12} className="t-mute" /> {m.telefone}</div>}
                {(m.cidade || m.estado) && <div className="flex items-center gap-1.5"><MapPin size={12} className="t-mute" /> {[m.cidade, m.estado].filter(Boolean).join(' · ')}</div>}
                <div className="flex items-center gap-1.5"><Car size={12} className="t-mute" /> {veic ? `${veic.placa} · ${veic.modelo}` : 'Sem veículo vinculado'}</div>
              </div>

              <div className="grid grid-cols-4 gap-2 mt-4 pt-4 card-divide">
                <div className="text-center min-w-0"><div className="mono font-semibold t-ink drv-stat">{nFretes}</div><div className="drv-lbl">Fretes</div></div>
                <div className="text-center min-w-0"><div className="mono font-semibold t-ink drv-stat">{nAbast}</div><div className="drv-lbl">Abast.</div></div>
                <div className="text-center min-w-0"><div className="mono font-semibold t-ink drv-stat">{nManut}</div><div className="drv-lbl">Manut.</div></div>
                <div className="text-center min-w-0"><div className="mono font-semibold t-green drv-stat">{receita > 0 ? `${(receita / 1000).toFixed(1)}k` : '—'}</div><div className="drv-lbl">Receita</div></div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={openForm} onClose={() => { setOpenForm(false); setEditing(null); }} title={editing ? 'Editar motorista' : 'Novo motorista'} wide>
        <MotoristaForm item={editing} veiculos={veiculos} onSave={handleSave} onCancel={() => { setOpenForm(false); setEditing(null); }} />
      </Modal>
      <ConfirmModal item={delTarget} title="Excluir motorista" message="Tem certeza que deseja excluir este motorista?" onCancel={() => setDelTarget(null)} onConfirm={confirmDelete} />
      <Toast msg={toast} />
    </div>
  );
}

function MotoristaForm({ item, veiculos, onSave, onCancel }) {
  const [f, setF] = useState({
    nome: item?.nome || '', apelido: item?.apelido || '', telefone: item?.telefone || '', whatsapp: item?.whatsapp || '',
    cpf: item?.cpf || '', cnh: item?.cnh || '', categoriaCnh: item?.categoriaCnh || 'B', vencCnh: item?.vencCnh || '',
    endereco: item?.endereco || '', cidade: item?.cidade || '', estado: item?.estado || 'MG', admissao: item?.admissao || '',
    vinculo: item?.vinculo || VINCULO_TIPOS[0], veiculoId: item?.veiculoId || '', obs: item?.obs || '', status: item?.status || 'ativo',
  });
  const submitForm = () => { onSave(f); };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome completo" span={2}><input className="inp" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required /></Field>
        <Field label="Apelido / nome curto"><input className="inp" value={f.apelido} onChange={(e) => setF({ ...f, apelido: e.target.value })} /></Field>
        <Field label="Status"><select className="inp" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{STATUS_MOTORISTA.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}</select></Field>
        <Field label="Telefone"><input className="inp" value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} /></Field>
        <Field label="WhatsApp"><input className="inp" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} /></Field>
        <Field label="CPF"><input className="inp" value={f.cpf} onChange={(e) => setF({ ...f, cpf: e.target.value })} /></Field>
        <Field label="CNH"><input className="inp" value={f.cnh} onChange={(e) => setF({ ...f, cnh: e.target.value })} /></Field>
        <Field label="Categoria CNH"><select className="inp" value={f.categoriaCnh} onChange={(e) => setF({ ...f, categoriaCnh: e.target.value })}>{CAT_CNH.map(c => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Validade da CNH"><input type="date" className="inp" value={f.vencCnh} onChange={(e) => setF({ ...f, vencCnh: e.target.value })} /></Field>
        <Field label="Endereço" span={2}><input className="inp" value={f.endereco} onChange={(e) => setF({ ...f, endereco: e.target.value })} /></Field>
        <Field label="Cidade"><input className="inp" value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value })} /></Field>
        <Field label="Estado"><select className="inp" value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}>{UFS.map(u => <option key={u}>{u}</option>)}</select></Field>
        <Field label="Data de admissão"><input type="date" className="inp" value={f.admissao} onChange={(e) => setF({ ...f, admissao: e.target.value })} /></Field>
        <Field label="Tipo de vínculo"><select className="inp" value={f.vinculo} onChange={(e) => setF({ ...f, vinculo: e.target.value })}>{VINCULO_TIPOS.map(v => <option key={v}>{v}</option>)}</select></Field>
        <Field label="Veículo principal" span={2}><select className="inp" value={f.veiculoId} onChange={(e) => setF({ ...f, veiculoId: e.target.value })}><option value="">— Nenhum —</option>{veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} · {v.modelo}</option>)}</select></Field>
        <Field label="Observações" span={2}><textarea className="inp" rows={2} value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} /></Field>
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 form-foot">
        <button type="button" onClick={onCancel} className="btn btn-ghost">Cancelar</button>
        <button type="button" onClick={submitForm} className="btn btn-primary">Salvar</button>
      </div>
    </div>
  );
}

// ============================================================
// RELATÓRIOS
// ============================================================
function groupByCat(arr) {
  const map = {};
  arr.forEach(x => { map[x.categoria] = (map[x.categoria] || 0) + x.valor; });
  return Object.entries(map).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
}

function reportSeries(base, periodo) {
  const { start, end } = periodRange(periodo);
  const byMonth = periodo === 'ano';
  const buckets = new Map();
  const cursor = new Date(start); cursor.setHours(0, 0, 0, 0);
  if (byMonth) {
    cursor.setDate(1);
    while (cursor <= end) { buckets.set(cursor.toISOString().slice(0, 7), { label: MONTHS_PT[cursor.getMonth()], receita: 0, custo: 0, lucro: 0 }); cursor.setMonth(cursor.getMonth() + 1); }
  } else {
    while (cursor <= end) { buckets.set(cursor.toISOString().slice(0, 10), { label: `${String(cursor.getDate()).padStart(2, '0')}/${String(cursor.getMonth() + 1).padStart(2, '0')}`, receita: 0, custo: 0, lucro: 0 }); cursor.setDate(cursor.getDate() + 1); }
  }
  base.forEach(x => {
    const d = new Date(x.data); const k = byMonth ? d.toISOString().slice(0, 7) : d.toISOString().slice(0, 10);
    const b = buckets.get(k); if (!b) return;
    if (x.tipo === 'entrada') b.receita += x.valor; else b.custo += x.valor;
  });
  const arr = Array.from(buckets.values()); arr.forEach(b => b.lucro = b.receita - b.custo);
  return arr;
}

function CatBars({ items, color, empty }) {
  if (!items.length) return <p className="text-sm t-soft py-2">{empty}</p>;
  const max = Math.max(...items.map(i => i.valor), 1);
  return (
    <div className="space-y-2.5">
      {items.map(it => (
        <div key={it.nome}>
          <div className="flex items-center justify-between text-xs mb-1 gap-2">
            <span className="t-ink font-medium truncate">{it.nome}</span>
            <span className="mono t-soft" style={{ flexShrink: 0 }}>{fmtBRL(it.valor)}</span>
          </div>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(it.valor / max * 100, 2)}%`, background: color }} /></div>
        </div>
      ))}
    </div>
  );
}

function Relatorios({ data }) {
  const { finEmpresa, linhas } = data;
  const [periodo, setPeriodo] = useState('mes');
  const [fLinha, setFLinha] = useState('todas');
  const [fCategoria, setFCategoria] = useState('todas');
  const [fTipo, setFTipo] = useState('todos');
  const [fStatus, setFStatus] = useState('todos');

  const matchFilters = (x) => effStatus(x) !== 'cancelado'
    && (fLinha === 'todas' || x.linhaId === fLinha)
    && (fCategoria === 'todas' || x.categoria === fCategoria)
    && (fTipo === 'todos' || x.tipo === fTipo)
    && (fStatus === 'todos' || effStatus(x) === fStatus);

  const base = useMemo(() => {
    const { start, end } = periodRange(periodo);
    return finEmpresa.filter(x => { const d = new Date(x.data); return d >= start && d <= end && matchFilters(x); });
  }, [finEmpresa, periodo, fLinha, fCategoria, fTipo, fStatus]);

  const resumo = useMemo(() => {
    const { prevStart, prevEnd } = periodRange(periodo);
    const prev = finEmpresa.filter(x => { const d = new Date(x.data); return d >= prevStart && d <= prevEnd && matchFilters(x); });
    const sumT = (arr, t) => arr.filter(x => x.tipo === t).reduce((a, b) => a + b.valor, 0);
    const receita = sumT(base, 'entrada'), custo = sumT(base, 'saida'); const lucro = receita - custo;
    const pRec = sumT(prev, 'entrada'), pCus = sumT(prev, 'saida');
    return { receita, custo, lucro, margem: receita ? lucro / receita * 100 : 0, gRec: pctChange(receita, pRec), gCus: pctChange(custo, pCus), gLuc: pctChange(lucro, pRec - pCus) };
  }, [base, finEmpresa, periodo, fLinha, fCategoria, fTipo, fStatus]);

  const ranking = useMemo(() => linhas.map(l => {
    const vinc = base.filter(x => x.linhaId === l.id);
    const receita = vinc.filter(x => x.tipo === 'entrada').reduce((a, b) => a + b.valor, 0);
    const custo = vinc.filter(x => x.tipo === 'saida').reduce((a, b) => a + b.valor, 0);
    return { id: l.id, nome: l.nome, receita, custo, lucro: receita - custo, margem: receita ? (receita - custo) / receita * 100 : 0, count: vinc.length };
  }).filter(r => r.count > 0), [linhas, base]);

  const topLucro = useMemo(() => [...ranking].sort((a, b) => b.lucro - a.lucro), [ranking]);
  const topCusto = useMemo(() => [...ranking].sort((a, b) => b.custo - a.custo), [ranking]);
  const melhor = topLucro[0]; const maisCara = topCusto[0];

  const recCat = useMemo(() => groupByCat(base.filter(x => x.tipo === 'entrada')), [base]);
  const cusCat = useMemo(() => groupByCat(base.filter(x => x.tipo === 'saida')), [base]);
  const serie = useMemo(() => reportSeries(base, periodo), [base, periodo]);

  const pctComb = resumo.receita ? ((cusCat.find(c => c.nome === 'Combustível')?.valor || 0) / resumo.receita * 100) : 0;
  const pctManut = resumo.custo ? ((cusCat.find(c => c.nome === 'Manutenção')?.valor || 0) / resumo.custo * 100) : 0;

  const insights = useMemo(() => {
    const out = [];
    if (melhor) out.push({ tone: 'green', icon: Trophy, txt: `${melhor.nome} é a operação mais lucrativa do período (${fmtBRL(melhor.lucro)}, margem ${melhor.margem.toFixed(0)}%).` });
    const combVal = cusCat.find(c => c.nome === 'Combustível')?.valor || 0;
    if (resumo.custo > 0 && combVal > 0) out.push({ tone: 'orange', icon: Fuel, txt: `Combustível representa ${(combVal / resumo.custo * 100).toFixed(0)}% dos custos do período.` });
    if (maisCara && maisCara.custo > 0) out.push({ tone: 'red', icon: Flame, txt: `${maisCara.nome} é a operação com maior custo (${fmtBRL(maisCara.custo)}).` });
    if (Math.abs(resumo.gRec) >= 1) out.push({ tone: resumo.gRec >= 0 ? 'green' : 'red', icon: resumo.gRec >= 0 ? TrendingUp : TrendingDown, txt: `Receita ${resumo.gRec >= 0 ? 'cresceu' : 'caiu'} ${Math.abs(resumo.gRec).toFixed(0)}% vs. período anterior.` });
    if (cusCat[0]) out.push({ tone: 'blue', icon: Lightbulb, txt: `Maior categoria de custo: ${cusCat[0].nome} (${fmtBRL(cusCat[0].valor)}).` });
    out.push({ tone: resumo.margem >= 20 ? 'green' : resumo.margem >= 0 ? 'orange' : 'red', icon: Percent, txt: `Margem geral do período: ${resumo.margem.toFixed(1)}%.` });
    return out;
  }, [melhor, maisCara, cusCat, resumo]);

  const catOptions = useMemo(() => [...new Set([...CAT_FIN_EMPRESA.entrada, ...CAT_FIN_EMPRESA.saida])], []);

  return (
    <div className="p-4 sm:p-7 space-y-5">
      {/* SEÇÃO 5 — Filtros */}
      <div className="period-bar">{PERIODOS.map(p => <button key={p.k} onClick={() => setPeriodo(p.k)} className={`period-pill ${periodo === p.k ? 'on' : ''}`}>{p.label}</button>)}</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <select className="inp" value={fLinha} onChange={e => setFLinha(e.target.value)}><option value="todas">Todas as linhas</option>{linhas.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}</select>
        <select className="inp" value={fCategoria} onChange={e => setFCategoria(e.target.value)}><option value="todas">Todas categorias</option>{catOptions.map(c => <option key={c}>{c}</option>)}</select>
        <select className="inp" value={fTipo} onChange={e => setFTipo(e.target.value)}><option value="todos">Entrada e saída</option><option value="entrada">Entradas</option><option value="saida">Saídas</option></select>
        <select className="inp" value={fStatus} onChange={e => setFStatus(e.target.value)}><option value="todos">Todos status</option><option value="pago">Pago/Recebido</option><option value="pendente">Pendente</option><option value="vencido">Vencido</option></select>
      </div>

      {/* SEÇÃO 1 — Resumo geral */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <FinStatCard accent="green" icon={TrendingUp} title="Receita Total" value={fmtBRL(resumo.receita)} deltaPct={resumo.gRec} sub={`${resumo.gRec >= 0 ? '+' : ''}${resumo.gRec.toFixed(0)}% vs. anterior`} />
        <FinStatCard accent="red" icon={TrendingDown} title="Custo Total" value={fmtBRL(resumo.custo)} deltaPct={resumo.gCus} sub={`${resumo.gCus >= 0 ? '+' : ''}${resumo.gCus.toFixed(0)}% vs. anterior`} />
        <FinStatCard accent="blue" icon={Activity} title="Lucro Líquido Real" value={fmtBRL(resumo.lucro)} deltaPct={resumo.gLuc} sub={`${resumo.gLuc >= 0 ? '+' : ''}${resumo.gLuc.toFixed(0)}% vs. anterior`} />
        <FinStatCard accent={resumo.margem >= 0 ? 'green' : 'red'} icon={Percent} title="Margem Geral" value={`${resumo.margem.toFixed(1)}%`} sub="lucro ÷ receita" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="card p-4 sm:p-5 flex items-center gap-3">
          <div className="chip chip-green"><Trophy size={18} /></div>
          <div className="min-w-0">
            <div className="label">Melhor linha</div>
            <div className="display t-ink truncate" style={{ fontSize: 'clamp(1rem,3.5vw,1.2rem)' }}>{melhor ? melhor.nome : '—'}</div>
            {melhor && <div className="text-xs t-green mono mt-0.5">{fmtBRL(melhor.lucro)} de lucro · margem {melhor.margem.toFixed(0)}%</div>}
          </div>
        </div>
        <div className="card p-4 sm:p-5 flex items-center gap-3">
          <div className="chip chip-red"><Flame size={18} /></div>
          <div className="min-w-0">
            <div className="label">Linha mais cara</div>
            <div className="display t-ink truncate" style={{ fontSize: 'clamp(1rem,3.5vw,1.2rem)' }}>{maisCara ? maisCara.nome : '—'}</div>
            {maisCara && <div className="text-xs t-red mono mt-0.5">{fmtBRL(maisCara.custo)} de custo</div>}
          </div>
        </div>
      </div>

      {/* SEÇÃO 2 — Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3"><Trophy size={15} className="t-soft" /><h3 className="display h-card t-ink">Linhas mais lucrativas</h3></div>
          {topLucro.length === 0 ? <p className="text-sm t-soft py-2">Sem dados no período.</p> : (
            <div className="space-y-2">
              {topLucro.slice(0, 6).map((r, i) => (
                <div key={r.id} className="rank-row">
                  <div className="rank-pos">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium t-ink truncate">{r.nome}</div>
                    <div className="text-xs t-soft truncate">Rec {fmtBRL(r.receita)} · Custo {fmtBRL(r.custo)}</div>
                  </div>
                  <div className="text-right" style={{ flexShrink: 0 }}>
                    <div className={`mono text-sm font-semibold ${r.lucro >= 0 ? 't-green' : 't-red'}`}>{fmtBRL(r.lucro)}</div>
                    <Badge tone={r.margem >= 20 ? 'green' : r.margem >= 0 ? 'orange' : 'red'}>{r.margem.toFixed(0)}%</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3"><Flame size={15} className="t-soft" /><h3 className="display h-card t-ink">Linhas com maior custo</h3></div>
          {topCusto.length === 0 ? <p className="text-sm t-soft py-2">Sem dados no período.</p> : (
            <div className="space-y-2">
              {topCusto.slice(0, 6).map((r, i) => (
                <div key={r.id} className="rank-row">
                  <div className="rank-pos rank-pos-red">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium t-ink truncate">{r.nome}</div>
                    <div className="text-xs t-soft truncate">Lucro {fmtBRL(r.lucro)}</div>
                  </div>
                  <div className="mono text-sm font-semibold t-red" style={{ flexShrink: 0 }}>{fmtBRL(r.custo)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SEÇÃO 3 — Análise operacional */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4 sm:p-5">
          <h3 className="display h-card t-ink mb-3">Receita por categoria</h3>
          <CatBars items={recCat} color="#087F5B" empty="Sem receitas no período." />
        </div>
        <div className="card p-4 sm:p-5">
          <h3 className="display h-card t-ink mb-3">Custos por categoria</h3>
          <CatBars items={cusCat} color="#B4234B" empty="Sem custos no período." />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <FinStatCard accent="orange" icon={Fuel} title="Combustível / Faturamento" value={`${pctComb.toFixed(1)}%`} sub="do total de receita" />
        <FinStatCard accent="blue" icon={Wrench} title="Manutenção / Custos" value={`${pctManut.toFixed(1)}%`} sub="do total de custos" />
      </div>

      {/* SEÇÃO 4 — Evolução financeira */}
      <div className="card p-4 sm:p-5">
        <div className="mb-3"><h3 className="display h-card t-ink">Evolução financeira</h3><p className="text-xs t-soft">Receita, custo e lucro no período</p></div>
        <div style={{ height: 'clamp(200px, 50vw, 280px)' }}>
          <ResponsiveContainer>
            <LineChart data={serie} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} width={42} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => fmtBRL(v)} contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 11, padding: '6px 10px' }} wrapperStyle={{ zIndex: 30 }} />
              <Line type="monotone" dataKey="receita" name="Receita" stroke="#087F5B" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="custo" name="Custo" stroke="#B4234B" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="lucro" name="Lucro" stroke="#0B1533" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          <span className="leg"><i style={{ background: '#087F5B' }} /> Receita</span>
          <span className="leg"><i style={{ background: '#B4234B' }} /> Custo</span>
          <span className="leg"><i style={{ background: '#0B1533' }} /> Lucro</span>
        </div>
      </div>

      {/* SEÇÃO 6 — Insights automáticos */}
      <div className="card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3"><Lightbulb size={16} className="t-orange" /><h3 className="display h-card t-ink">Insights da Operação</h3></div>
        <div className="space-y-2">
          {insights.map((it, i) => {
            const Ico = it.icon;
            return (
              <div key={i} className="insight-row">
                <div className={`pill pill-${it.tone}`}><Ico size={15} /></div>
                <span className="text-sm t-ink">{it.txt}</span>
              </div>
            );
          })}
        </div>
        <p className="text-xs t-mute mt-4">Em breve: relatórios por motorista, veículo e cliente · exportação PDF e Excel.</p>
      </div>
    </div>
  );
}

// ============================================================
// CONTRATOS
// ============================================================
function mesesEntre(inicio, fim) {
  if (!inicio || !fim) return 1;
  const a = new Date(inicio), b = new Date(fim);
  return Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1);
}
function receitaPrevista(c, finEmpresa) {
  switch (c.modelo) {
    case 'Por km': return (c.kmContratado || 0) * (c.valorKm || 0);
    case 'Valor fixo mensal': return (c.valorMensal || 0) * mesesEntre(c.inicio, c.fim);
    case 'Valor fechado': return c.valorTotal || 0;
    case 'Por pedido':
    case 'Por frete': {
      const vinc = finEmpresa.filter(x => x.contratoId === c.id && x.tipo === 'entrada' && effStatus(x) !== 'cancelado').reduce((a, b) => a + b.valor, 0);
      return vinc || c.valorTotal || 0;
    }
    default: return c.valorTotal || 0;
  }
}
function realPorContrato(finEmpresa, contratoId) {
  const vinc = finEmpresa.filter(x => x.contratoId === contratoId && effStatus(x) !== 'cancelado');
  const recebida = vinc.filter(x => x.tipo === 'entrada' && effStatus(x) === 'pago').reduce((a, b) => a + b.valor, 0);
  const custo = vinc.filter(x => x.tipo === 'saida').reduce((a, b) => a + b.valor, 0);
  const lucro = recebida - custo;
  return { recebida, custo, lucro, margem: recebida ? lucro / recebida * 100 : 0, count: vinc.length };
}
function effContratoStatus(c) {
  if (['cancelado', 'finalizado', 'pausado', 'vencido'].includes(c.status)) return c.status;
  if (c.fim && c.fim < todayISO()) return 'vencido';
  return c.status || 'ativo';
}
const contratoTone = (s) => s === 'ativo' ? 'green' : s === 'vencido' ? 'red' : s === 'pausado' ? 'orange' : s === 'finalizado' ? 'blue' : 'slate';

function Contratos({ data, setData }) {
  const { contratos, finEmpresa, linhas, veiculos, motoristas } = data;
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const rows = useMemo(() => contratos.map(c => {
    const prevista = receitaPrevista(c, finEmpresa);
    const real = realPorContrato(finEmpresa, c.id);
    const eff = effContratoStatus(c);
    return { ...c, prevista, real, saldo: prevista - real.recebida, eff };
  }), [contratos, finEmpresa]);

  const agg = useMemo(() => {
    const naoCanc = rows.filter(r => r.eff !== 'cancelado');
    const recebido = rows.reduce((a, r) => a + r.real.recebida, 0);
    const custo = rows.reduce((a, r) => a + r.real.custo, 0);
    const lucro = recebido - custo;
    return {
      ativos: rows.filter(r => r.eff === 'ativo').length,
      prevTotal: naoCanc.reduce((a, r) => a + r.prevista, 0),
      recebido, custo, lucro,
      saldo: naoCanc.reduce((a, r) => a + Math.max(r.saldo, 0), 0),
      margem: recebido ? lucro / recebido * 100 : 0,
      vencendo: rows.filter(r => { if (r.eff !== 'ativo' || !r.fim) return false; const d = (new Date(r.fim) - new Date()) / 86400000; return d >= 0 && d <= 30; }).length,
    };
  }, [rows]);

  const alertas = useMemo(() => {
    const out = [];
    rows.forEach(r => {
      const dias = r.fim ? Math.round((new Date(r.fim) - new Date()) / 86400000) : null;
      if (r.eff === 'vencido') out.push({ tone: 'red', txt: `${r.nome}: contrato vencido` });
      else if (dias !== null && dias >= 0 && dias <= 30 && r.eff === 'ativo') out.push({ tone: 'orange', txt: `${r.nome}: vence em ${dias} dia(s)` });
      if (r.real.count > 0 && r.real.lucro < 0) out.push({ tone: 'red', txt: `${r.nome}: margem negativa` });
      if (r.eff !== 'cancelado' && r.saldo > 10000) out.push({ tone: 'orange', txt: `${r.nome}: saldo a receber alto (${fmtBRL(r.saldo)})` });
      if (!(r.linhaIds && r.linhaIds.length)) out.push({ tone: 'slate', txt: `${r.nome}: sem linha vinculada` });
      if (r.real.count === 0) out.push({ tone: 'slate', txt: `${r.nome}: sem lançamentos financeiros` });
    });
    return out;
  }, [rows]);

  const handleSave = (item) => { const msg = editing ? 'Contrato atualizado com sucesso' : 'Contrato salvo com sucesso'; setData(d => ({ ...d, contratos: editing ? d.contratos.map(x => x.id === editing.id ? { ...item, id: editing.id } : x) : [...d.contratos, { ...item, id: 'c' + uid() }] })); setOpenForm(false); setEditing(null); setToast(msg); };
  const [toast, setToast] = useToast();
  const [delTarget, setDelTarget] = useState(null);
  const handleDelete = (id) => { const item = contratos.find(x => x.id === id); if (item) setDelTarget(item); };
  const confirmDelete = () => { if (delTarget) { setData(d => ({ ...d, contratos: d.contratos.filter(x => x.id !== delTarget.id) })); setToast('Contrato excluído com sucesso'); setDelTarget(null); } };

  return (
    <div className="p-4 sm:p-7 space-y-5">
      <NewButton onClick={() => { setEditing(null); setOpenForm(true); }}>Novo Contrato</NewButton>

      {/* Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <FinStatCard accent="blue" icon={FileSignature} title="Receita Prevista" value={fmtBRL(agg.prevTotal)} sub={`${agg.ativos} contrato(s) ativo(s)`} />
        <FinStatCard accent="green" icon={TrendingUp} title="Já Recebido" value={fmtBRL(agg.recebido)} sub="entradas pagas vinculadas" />
        <FinStatCard accent="orange" icon={Clock} title="Saldo a Receber" value={fmtBRL(agg.saldo)} sub="previsto − recebido" />
        <FinStatCard accent={agg.lucro >= 0 ? 'green' : 'red'} icon={Activity} title="Lucro Real" value={fmtBRL(agg.lucro)} sub={`Margem ${agg.margem.toFixed(0)}%`} />
      </div>
      <div className="card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3"><FileSignature size={15} className="t-soft" /><h3 className="display h-card t-ink">Resumo de Contratos</h3></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <MiniStat label="Contratos ativos" value={agg.ativos} tone="t-ink" />
          <MiniStat label="Custo real vinculado" value={fmtBRL(agg.custo)} tone="t-red" />
          <MiniStat label="Margem média" value={`${agg.margem.toFixed(1)}%`} tone={agg.margem >= 0 ? 't-green' : 't-red'} />
          <MiniStat label="Vencendo (30 dias)" value={agg.vencendo} tone="t-orange" />
        </div>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3"><h3 className="display h-card t-ink">Alertas de Contratos</h3><AlertTriangle size={18} className="t-orange" /></div>
          <div className="flex flex-wrap gap-2">
            {alertas.map((a, i) => <Badge key={i} tone={a.tone}>{a.txt}</Badge>)}
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {rows.length === 0 ? <div className="col-span-full"><div className="card"><EmptyState icon={FileSignature} title="Nenhum contrato cadastrado." /></div></div> : rows.map(c => {
          const veic = veiculos.find(v => v.id === c.veiculoId);
          const mot = motoristas.find(mm => mm.id === c.motoristaId);
          const linhasVinc = (c.linhaIds || []).map(id => linhas.find(l => l.id === id)).filter(Boolean);
          return (
            <div key={c.id} className="card card-hover p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <Badge tone="blue">{c.tipo}</Badge>
                  <Badge tone={contratoTone(c.eff)}>{c.eff}</Badge>
                  <Badge tone="slate">{c.modelo}</Badge>
                </div>
                <div className="row-actions flex">
                  <button onClick={() => { setEditing(c); setOpenForm(true); }} className="ibtn"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(c.id)} className="ibtn ibtn-del"><Trash2 size={14} /></button>
                </div>
              </div>

              <h3 className="display t-ink leading-tight card-title">{c.nome}</h3>
              <p className="text-xs t-soft mt-1">{c.cliente}</p>
              <div className="flex items-center gap-1.5 text-xs t-soft mt-2">
                <Calendar size={12} className="t-mute flex-shrink-0" /> <span>{fmtDate(c.inicio)} → {fmtDate(c.fim)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 mt-4 pt-4 card-divide">
                <div className="metric-box min-w-0"><div className="label truncate">Receita prevista</div><div className="mono font-semibold mt-1 metric-val t-ink">{fmtBRL(c.prevista)}</div></div>
                <div className="metric-box min-w-0"><div className="label truncate">Recebido</div><div className="mono font-semibold mt-1 metric-val t-green">{fmtBRL(c.real.recebida)}</div></div>
                <div className="metric-box min-w-0"><div className="label truncate">Saldo a receber</div><div className="mono font-semibold mt-1 metric-val t-orange">{fmtBRL(c.saldo)}</div></div>
                <div className="metric-box min-w-0" style={c.real.count ? { background: '#F2FBF7', borderColor: '#D7EFE4' } : undefined}>
                  <div className="label truncate">Lucro real</div>
                  <div className={`mono font-semibold mt-1 metric-val ${c.real.lucro >= 0 ? 't-green' : 't-red'}`}>{c.real.count ? fmtBRL(c.real.lucro) : '—'}</div>
                  <div className="text-xs t-soft mt-0.5">{c.real.count ? `Margem ${c.real.margem.toFixed(0)}%` : 'Sem lançamentos'}</div>
                </div>
              </div>

              {linhasVinc.length > 0 && (
                <div className="mt-3">
                  <div className="label mb-1.5">Linhas vinculadas</div>
                  <div className="space-y-1.5">
                    {linhasVinc.map(l => {
                      const rl = realPorLinha(finEmpresa, l.id);
                      return (
                        <div key={l.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="t-ink truncate flex items-center gap-1 min-w-0"><Route size={11} className="t-mute flex-shrink-0" /> {l.nome}</span>
                          <span className="mono t-soft" style={{ flexShrink: 0 }}>Lucro <b className={rl.lucro >= 0 ? 't-green' : 't-red'}>{fmtBRL(rl.lucro)}</b></span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-3 pt-3 card-divide flex flex-wrap gap-x-4 gap-y-1 text-xs t-soft">
                {veic && <span className="flex items-center gap-1"><Car size={12} className="t-mute" /> {veic.placa}</span>}
                {mot && <span className="flex items-center gap-1"><Users size={12} className="t-mute" /> {mot.apelido || mot.nome}</span>}
                {!linhasVinc.length && <span className="t-mute">Sem linha vinculada</span>}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={openForm} onClose={() => { setOpenForm(false); setEditing(null); }} title={editing ? 'Editar contrato' : 'Novo contrato'} wide>
        <ContratoForm item={editing} linhas={linhas} veiculos={veiculos} motoristas={motoristas} finEmpresa={finEmpresa} onSave={handleSave} onCancel={() => { setOpenForm(false); setEditing(null); }} />
      </Modal>
      <ConfirmModal item={delTarget} title="Excluir contrato" message="Tem certeza que deseja excluir este contrato?" onCancel={() => setDelTarget(null)} onConfirm={confirmDelete} />
      <Toast msg={toast} />
    </div>
  );
}

function ContratoForm({ item, linhas, veiculos, motoristas, finEmpresa, onSave, onCancel }) {
  const [f, setF] = useState({
    nome: item?.nome || '', cliente: item?.cliente || '', tipo: item?.tipo || TIPOS_CONTRATO[0], status: item?.status || 'ativo',
    inicio: item?.inicio || '', fim: item?.fim || '', modelo: item?.modelo || MODELOS_COBRANCA[0],
    valorKm: item?.valorKm || '', kmContratado: item?.kmContratado || '', valorMensal: item?.valorMensal || '', valorTotal: item?.valorTotal || '',
    linhaIds: item?.linhaIds || [], veiculoId: item?.veiculoId || '', motoristaId: item?.motoristaId || '', obs: item?.obs || '',
  });
  const toggleLinha = (id) => setF(s => ({ ...s, linhaIds: s.linhaIds.includes(id) ? s.linhaIds.filter(x => x !== id) : [...s.linhaIds, id] }));
  const num = (v) => parseFloat(v) || 0;
  const prevista = receitaPrevista({ ...f, valorKm: num(f.valorKm), kmContratado: num(f.kmContratado), valorMensal: num(f.valorMensal), valorTotal: num(f.valorTotal) }, finEmpresa);

  const submitForm = () => { onSave({ ...f, valorKm: num(f.valorKm), kmContratado: num(f.kmContratado), valorMensal: num(f.valorMensal), valorTotal: num(f.valorTotal) }); };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome do contrato" span={2}><input className="inp" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required /></Field>
        <Field label="Cliente / Contratante" span={2}><input className="inp" value={f.cliente} onChange={(e) => setF({ ...f, cliente: e.target.value })} /></Field>
        <Field label="Tipo"><select className="inp" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>{TIPOS_CONTRATO.map(t => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Status"><select className="inp" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{STATUS_CONTRATO.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}</select></Field>
        <Field label="Data de início"><input type="date" className="inp" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} /></Field>
        <Field label="Data de término"><input type="date" className="inp" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} /></Field>
        <Field label="Modelo de cobrança" span={2}><select className="inp" value={f.modelo} onChange={(e) => setF({ ...f, modelo: e.target.value })}>{MODELOS_COBRANCA.map(mo => <option key={mo}>{mo}</option>)}</select></Field>
        {f.modelo === 'Por km' && <>
          <Field label="Valor por KM (R$)"><input type="number" step="0.01" className="inp" value={f.valorKm} onChange={(e) => setF({ ...f, valorKm: e.target.value })} /></Field>
          <Field label="KM contratado"><input type="number" className="inp" value={f.kmContratado} onChange={(e) => setF({ ...f, kmContratado: e.target.value })} /></Field>
        </>}
        {f.modelo === 'Valor fixo mensal' && <Field label="Valor fixo mensal (R$)" span={2}><input type="number" step="0.01" className="inp" value={f.valorMensal} onChange={(e) => setF({ ...f, valorMensal: e.target.value })} /></Field>}
        {(f.modelo === 'Valor fechado' || f.modelo === 'Por pedido' || f.modelo === 'Por frete') && <Field label={f.modelo === 'Valor fechado' ? 'Valor total (R$)' : 'Valor estimado (R$)'} span={2}><input type="number" step="0.01" className="inp" value={f.valorTotal} onChange={(e) => setF({ ...f, valorTotal: e.target.value })} /></Field>}
        <div className="col-span-2 metric-box flex items-center justify-between gap-3">
          <span className="label">Receita prevista</span>
          <span className="display t-ink total-val">{fmtBRL(prevista)}</span>
        </div>
        <Field label="Linhas / Fretes vinculados" span={2}>
          <div className="chk-grid">
            {linhas.length === 0 ? <span className="text-xs t-mute">Nenhuma linha cadastrada</span> : linhas.map(l => (
              <label key={l.id} className={`chk ${f.linhaIds.includes(l.id) ? 'on' : ''}`}>
                <input type="checkbox" checked={f.linhaIds.includes(l.id)} onChange={() => toggleLinha(l.id)} />
                <span className="truncate">{l.nome}</span>
              </label>
            ))}
          </div>
        </Field>
        <Field label="Veículo"><select className="inp" value={f.veiculoId} onChange={(e) => setF({ ...f, veiculoId: e.target.value })}><option value="">—</option>{veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} · {v.modelo}</option>)}</select></Field>
        <Field label="Motorista"><MotoristaSelect motoristas={motoristas} value={f.motoristaId} onChange={(val) => setF({ ...f, motoristaId: val })} /></Field>
        <Field label="Observações" span={2}><textarea className="inp" rows={2} value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} /></Field>
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 form-foot">
        <button type="button" onClick={onCancel} className="btn btn-ghost">Cancelar</button>
        <button type="button" onClick={submitForm} className="btn btn-primary">Salvar</button>
      </div>
    </div>
  );
}

// ============================================================
// PLACEHOLDER
// ============================================================
function ComingSoon({ titulo, descricao }) {
  return (
    <div className="p-4 sm:p-7">
      <div className="card p-8 sm:p-12 text-center">
        <div className="cs-ico"><Clock size={26} /></div>
        <h2 className="display t-ink cs-title">{titulo}</h2>
        <p className="t-soft text-sm cs-desc">{descricao}</p>
        <p className="label cs-tag">Próxima entrega</p>
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [data, setData, loaded] = usePersistedState('gso_data_v28', seed());
  const [route, setRoute] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap';
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch {} };
  }, []);

  const titles = {
    dashboard: { t: 'Painel', s: 'Visão geral do mês' },
    finEmpresa: { t: 'Financeiro Empresa', s: 'Entradas, saídas e lucratividade' },
    finPessoal: { t: 'Financeiro Pessoal', s: 'Controle pessoal separado do empresarial' },
    linhas: { t: 'Fretes & Linhas', s: 'Rotas, contratos e rentabilidade' },
    veiculos: { t: 'Veículos', s: 'Frota e indicadores por veículo' },
    combustivel: { t: 'Combustível', s: 'Abastecimentos e consumo' },
    manutencao: { t: 'Manutenção', s: 'Preventiva, corretiva e agendamentos' },
    motoristas: { t: 'Motoristas', s: 'Cadastro e documentação' },
    contratos: { t: 'Contratos & Licitações', s: 'Acompanhamento de contratos' },
    documentos: { t: 'Documentos', s: 'Organização e vencimentos' },
    relatorios: { t: 'Relatórios', s: 'Análises detalhadas com filtros' },
    config: { t: 'Configurações', s: 'Empresa, preços médios, categorias' },
  };
  const cur = titles[route];

  return (
    <div className="app-root">
      <style>{`
        .app-root{ display:flex; min-height:100vh; background:#F3F4F6; font-family:'Geist',system-ui,-apple-system,sans-serif; color:#0B1324; }
        *{ -webkit-tap-highlight-color:transparent; box-sizing:border-box; }

        .display{ font-family:'Fraunces',Georgia,serif; }
        .mono{ font-family:'Geist Mono',ui-monospace,monospace; font-variant-numeric:tabular-nums; }

        /* text colors */
        .t-ink{ color:#0B1324; } .t-soft{ color:#6B7280; } .t-mute{ color:#9CA3AF; }
        .t-green{ color:#087F5B; } .t-red{ color:#B4234B; } .t-orange{ color:#D97706; }

        /* typography scale */
        .h-page{ font-size:clamp(1.2rem,4.5vw,1.55rem); line-height:1.15; font-weight:600; letter-spacing:-.01em; }
        .h-card{ font-size:clamp(1rem,3vw,1.125rem); line-height:1.2; font-weight:600; }
        .stat-md{ font-size:clamp(1rem,4vw,1.4rem); line-height:1.1; font-weight:600; letter-spacing:-.01em; word-break:break-word; }
        .stat-lg{ font-size:clamp(1.15rem,5.2vw,1.7rem); line-height:1.1; font-weight:600; letter-spacing:-.015em; word-break:break-word; }
        .label{ font-size:clamp(.62rem,1.9vw,.7rem); letter-spacing:.07em; text-transform:uppercase; font-weight:500; color:#6B7280; }
        .card-title{ font-size:clamp(1.05rem,3.6vw,1.2rem); margin-top:12px; }
        .veh-title{ font-size:clamp(1.1rem,4vw,1.35rem); margin-top:8px; }
        .veh-val{ font-size:clamp(.85rem,3.2vw,1rem); word-break:break-word; }
        .metric-val{ font-size:clamp(.95rem,3.6vw,1.1rem); word-break:break-word; }
        .total-val{ font-size:clamp(1.1rem,4vw,1.4rem); }

        /* cards */
        .card{ background:#fff; border:1px solid #E5E7EB; border-radius:16px; box-shadow:0 1px 2px rgba(11,19,36,.04),0 8px 24px rgba(11,19,36,.05); }
        .metric-box{ background:#F4F6F8; border-radius:12px; padding:13px; }
        .card-divide{ border-top:1px solid #F1F2F4; }
        .list-head{ border-bottom:1px solid #F1F2F4; }
        .form-foot{ border-top:1px solid #E5E7EB; }
        .divide > * + *{ border-top:1px solid #F1F2F4; }

        /* chips (accent icon) */
        .chip{ display:inline-flex; padding:9px; border-radius:12px; color:#fff; flex-shrink:0; }
        .chip-ink{ background:#0B1324; } .chip-green{ background:#087F5B; } .chip-orange{ background:#D97706; } .chip-red{ background:#B4234B; }

        /* pills (light icon bg) */
        .pill{ display:inline-flex; padding:8px; border-radius:10px; flex-shrink:0; }
        .pill-green{ background:#ECFDF5; color:#087F5B; } .pill-red{ background:#FFF1F2; color:#B4234B; } .pill-orange{ background:#FFFBEB; color:#D97706; }

        /* badges */
        .badge{ display:inline-flex; align-items:center; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:500; white-space:nowrap; border:1px solid transparent; }
        .badge-slate{ background:#F4F6F8; color:#374151; border-color:#E5E7EB; }
        .badge-green{ background:#ECFDF5; color:#087F5B; border-color:#A7F3D0; }
        .badge-orange{ background:#FFFBEB; color:#B45309; border-color:#FDE68A; }
        .badge-red{ background:#FFF1F2; color:#B4234B; border-color:#FECDD3; }
        .badge-blue{ background:#EFF6FF; color:#1D4ED8; border-color:#BFDBFE; }

        /* buttons */
        .btn{ display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:11px 16px; border-radius:12px; font-size:14px; font-weight:500; transition:.15s; cursor:pointer; border:none; }
        .btn-primary{ background:#0B1324; color:#fff; box-shadow:0 1px 2px rgba(11,19,36,.15); }
        .btn-primary:hover{ background:#15233F; } .btn-primary:active{ transform:scale(.98); }
        .btn-ghost{ background:transparent; color:#0B1324; } .btn-ghost:hover{ background:#E5E7EB; }

        /* icon buttons */
        .ibtn{ display:inline-flex; padding:7px; border-radius:9px; transition:.15s; color:#6B7280; background:transparent; border:none; cursor:pointer; }
        .ibtn:hover{ background:#E5E7EB; color:#0B1324; }
        .ibtn-del:hover{ background:#FFF1F2; color:#B4234B; }
        .row-actions{ opacity:.55; transition:.15s; }
        .row:hover .row-actions{ opacity:1; }
        @media(min-width:640px){ .row-actions{ opacity:0; } }

        /* inputs */
        .inp{ width:100%; padding:10px 12px; background:#fff; border:1px solid #D1D5DB; border-radius:12px; font-size:14px; color:#0B1324; transition:.15s; }
        .inp:focus{ outline:none; border-color:rgba(11,19,36,.4); box-shadow:0 0 0 2px rgba(11,19,36,.12); }

        /* rows + helpers */
        .row{ transition:background .12s; } .row:hover{ background:#F9FAFB; }
        .hide-sm{ display:none; } @media(min-width:640px){ .hide-sm{ display:inline; } }
        .empty-ico{ display:inline-flex; padding:16px; border-radius:16px; background:#F4F6F8; color:#9CA3AF; }

        /* segmented control */
        .seg{ display:flex; background:#F4F6F8; border-radius:12px; padding:4px; }
        .seg-btn{ flex:1; padding:8px 12px; font-size:12px; font-weight:500; border-radius:9px; color:#6B7280; transition:.15s; background:transparent; border:none; cursor:pointer; white-space:nowrap; }
        .seg-btn.on{ background:#fff; color:#0B1324; box-shadow:0 1px 2px rgba(0,0,0,.06); }

        /* ===== SIDEBAR ===== */
        .sidebar{ position:fixed; top:0; left:0; height:100vh; width:270px; background:#0B1533; z-index:50; display:flex; flex-direction:column; transform:translateX(-100%); transition:transform .28s cubic-bezier(.4,0,.2,1); box-shadow:2px 0 28px rgba(0,0,0,.28); }
        .sidebar.open{ transform:translateX(0); }
        .sb-overlay{ position:fixed; inset:0; z-index:40; background:rgba(0,0,0,.35); -webkit-backdrop-filter:blur(2px); backdrop-filter:blur(2px); }
        .sb-header{ padding:20px; border-bottom:1px solid rgba(255,255,255,.08); }
        .sb-logo{ width:38px; height:38px; border-radius:11px; background:rgba(255,255,255,.1); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#fff; }
        .sb-name{ color:#fff; font-size:1.05rem; font-weight:600; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .sb-sub{ color:#7C89A3; font-size:11px; letter-spacing:.03em; margin-top:2px; }
        .sb-nav{ flex:1; overflow-y:auto; padding:16px 12px; display:flex; flex-direction:column; gap:4px; }
        .sb-item{ display:flex; align-items:center; gap:12px; width:100%; padding:11px 12px; border-radius:11px; font-size:14px; color:#CBD5E1; transition:.15s; text-align:left; background:transparent; border:none; cursor:pointer; }
        .sb-item:hover{ background:rgba(255,255,255,.08); color:#fff; }
        .sb-item.on{ background:#fff; color:#0B1324; font-weight:600; }
        .sb-foot{ padding:16px 20px; border-top:1px solid rgba(255,255,255,.08); color:#5B6781; font-size:11px; }
        @media(min-width:1024px){
          .sidebar{ position:sticky; transform:translateX(0); box-shadow:none; }
          .sb-overlay{ display:none; }
        }

        /* topbar */
        .topbar{ position:sticky; top:0; z-index:20; background:rgba(243,244,246,.9); -webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px); border-bottom:1px solid #E5E7EB; }
        .brand-chip{ margin-left:auto; display:inline-flex; align-items:center; gap:8px; flex-shrink:0; }
        .brand-mark{ width:30px; height:30px; border-radius:8px; background:#0B1533; color:#fff; display:flex; align-items:center; justify-content:center; font-family:'Fraunces',Georgia,serif; font-weight:600; font-size:12px; letter-spacing:.02em; }
        .brand-name{ font-size:13px; font-weight:600; color:#0B1324; }

        /* financeiro premium */
        .period-bar{ display:inline-flex; gap:5px; background:#fff; border:1px solid #E5E7EB; border-radius:12px; padding:5px; box-shadow:0 1px 2px rgba(11,19,36,.04); overflow-x:auto; -ms-overflow-style:none; scrollbar-width:none; }
        .period-bar::-webkit-scrollbar{ display:none; }
        .period-pill{ padding:7px 14px; border-radius:8px; font-size:13px; font-weight:500; color:#6B7280; background:transparent; border:none; cursor:pointer; white-space:nowrap; transition:.15s; }
        .period-pill.on{ background:#0B1533; color:#fff; }
        .period-pill:not(.on):hover{ background:#F3F4F6; color:#0B1324; }
        .fin-new{ width:100%; } @media(min-width:640px){ .fin-new{ width:auto; } }
        .count-pill{ display:inline-flex; align-items:center; padding:2px 10px; border-radius:999px; background:#F3F4F6; border:1px solid #E5E7EB; font-size:12px; font-weight:500; color:#6B7280; white-space:nowrap; }
        .lnk-linha{ display:inline-flex; align-items:center; gap:3px; padding:1px 7px; border-radius:6px; background:#EFF4FF; color:#1D4ED8; font-size:11px; font-weight:500; max-width:100%; }
        .lnk-linha svg{ flex-shrink:0; }
        /* relatórios */
        .bar-track{ height:8px; background:#F3F4F6; border-radius:999px; overflow:hidden; }
        .bar-fill{ height:100%; border-radius:999px; transition:width .6s cubic-bezier(.4,0,.2,1); }
        .rank-row{ display:flex; align-items:center; gap:10px; padding:8px; border-radius:10px; transition:background .12s; }
        .rank-row:hover{ background:#F9FAFB; }
        .rank-pos{ width:24px; height:24px; border-radius:7px; background:#0B1533; color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:600; flex-shrink:0; }
        .rank-pos-red{ background:#B4234B; }
        .insight-row{ display:flex; align-items:center; gap:10px; padding:10px; border:1px solid #EFF0F2; border-radius:12px; background:#fff; transition:.15s; }
        .insight-row:hover{ border-color:#E5E7EB; box-shadow:0 2px 10px rgba(11,19,36,.05); }
        .pill-blue{ background:#EFF4FF; color:#1D4ED8; }
        .leg{ display:inline-flex; align-items:center; gap:6px; font-size:12px; color:#6B7280; }
        .leg i{ width:14px; height:3px; border-radius:2px; display:inline-block; }
        /* financeiro pessoal */
        .pf-logo{ width:40px; height:40px; border-radius:12px; background:#0B1533; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; letter-spacing:.5px; flex-shrink:0; }
        .pf-mini{ padding:14px !important; }
        .pf-mini-top{ display:flex; align-items:center; justify-content:space-between; min-height:30px; }
        .pf-trend{ font-size:12px; font-weight:600; font-variant-numeric:tabular-nums; }
        .pf-sub{ font-size:11px; color:#6B7280; margin-top:3px; }
        .health-track{ height:6px; background:#EEF0F3; border-radius:999px; overflow:hidden; }
        .health-fill{ height:100%; border-radius:999px; transition:width .5s ease; }
        .health-badge{ font-size:11px; font-weight:600; padding:3px 9px; border-radius:999px; white-space:nowrap; }
        .pf-alert{ padding:14px !important; }
        .pf-alert-red{ background:#FEF5F7 !important; border-color:#F3C9D4 !important; }
        .pf-alert-orange{ background:#FFFAF2 !important; border-color:#FAE2C4 !important; }
        .pf-alert-strong{ box-shadow:0 6px 22px rgba(11,19,36,.09) !important; border-color:#D1D5DB !important; }
        .dot-pulse{ width:9px; height:9px; border-radius:50%; background:#B4234B; flex-shrink:0; animation:dotpulse 1.6s infinite; }
        @keyframes dotpulse{ 0%{ box-shadow:0 0 0 0 rgba(180,35,75,.45); } 70%{ box-shadow:0 0 0 7px rgba(180,35,75,0); } 100%{ box-shadow:0 0 0 0 rgba(180,35,75,0); } }
        .cat-ico{ width:30px; height:30px; border-radius:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .cat-ico-in{ background:#EAF7F1; color:#087F5B; }
        .cat-ico-out{ background:#FBEAEF; color:#B4234B; }
        .meta-ico{ width:26px; height:26px; border-radius:8px; background:#EFF4FF; color:#1D4ED8; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .btn-sm{ padding:6px 12px !important; font-size:13px !important; }
        .pf-tile{ padding:13px 14px !important; min-height:84px; display:flex; flex-direction:column; transition:transform .25s ease, box-shadow .25s ease; will-change:transform; }
        .pf-tile:hover{ transform:translateY(-4px); box-shadow:0 8px 16px rgba(11,19,36,.07),0 22px 50px rgba(11,19,36,.10); }
        .pf-tile:active{ transform:scale(.985); }
        .pf-tile-head{ display:flex; align-items:center; justify-content:space-between; gap:6px; min-height:18px; }
        .pf-tile-val{ font-size:clamp(.98rem,3.6vw,1.18rem); font-weight:600; letter-spacing:-.01em; line-height:1.1; margin-top:6px; word-break:break-word; }
        .pf-tile-sub{ font-size:10.5px; color:#9AA1AC; margin-top:3px; }
        .pf-tile-dica{ background:#FBFAF6 !important; border-color:#F0EBDE !important; }
        .donut-wrap{ position:relative; height:190px; }
        @media(max-width:640px){ .donut-wrap{ height:168px; } }
        .donut-center{ position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events:none; gap:1px; }
        .cat-dot{ width:10px; height:10px; border-radius:3px; flex-shrink:0; }
        .tx-reveal{ animation:txreveal .28s ease both; }
        @keyframes txreveal{ from{ opacity:0; transform:translateY(-4px); } to{ opacity:1; transform:none; } }
        .tx-toggle{ display:flex; align-items:center; justify-content:center; gap:6px; width:100%; padding:9px; margin-top:2px; border:none; background:transparent; color:#1D4ED8; font-size:13px; font-weight:600; cursor:pointer; border-radius:10px; transition:background .15s; }
        .tx-toggle:hover{ background:#F5F7FB; }
        .tx-chev{ transition:transform .25s ease; }
        .tx-chev.up{ transform:rotate(180deg); }
        .sum-grid{ display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
        @media(min-width:1024px){ .sum-grid{ grid-template-columns:repeat(4,1fr); } }
        @media(max-width:359px){ .sum-grid{ grid-template-columns:1fr; } }
        .sum-card{ padding:14px !important; display:flex; flex-direction:column; min-height:108px; transition:transform .25s ease, box-shadow .25s ease; will-change:transform; }
        .sum-card:hover{ transform:translateY(-4px); box-shadow:0 8px 16px rgba(11,19,36,.07),0 22px 50px rgba(11,19,36,.10); }
        .sum-card:active{ transform:scale(.985); }
        .sum-card-top{ display:flex; align-items:center; justify-content:space-between; gap:8px; min-height:30px; }
        .sum-ico{ width:30px; height:30px; border-radius:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .sum-title{ font-size:10.5px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:#9AA1AC; margin-top:10px; }
        .sum-val{ font-size:clamp(1.05rem,4.2vw,1.35rem); font-weight:650; letter-spacing:-.02em; line-height:1.1; margin-top:3px; word-break:break-word; }
        .sum-sub{ font-size:11px; color:#9AA1AC; margin-top:3px; }
        .sum-trend{ font-size:11.5px; font-weight:600; padding:2px 8px; border-radius:999px; white-space:nowrap; }
        .sum-trend-up{ background:#E7F6F0; color:#0B815E; }
        .sum-trend-down{ background:#FBEAEF; color:#C0395A; }
        .btn-danger{ background:#B4234B; color:#fff; border:none; }
        .btn-danger:hover{ background:#9c1d40; }
        .toast{ position:fixed; left:50%; bottom:24px; transform:translate(-50%,0); display:flex; align-items:center; gap:8px; background:#0B1324; color:#fff; font-size:13px; font-weight:500; padding:10px 16px; border-radius:12px; box-shadow:0 10px 34px rgba(11,19,36,.28); z-index:200; animation:toastin .25s ease; }
        @keyframes toastin{ from{ opacity:0; transform:translate(-50%,10px); } to{ opacity:1; transform:translate(-50%,0); } }
        /* contratos */
        .chk-grid{ display:grid; grid-template-columns:1fr; gap:6px; }
        @media(min-width:480px){ .chk-grid{ grid-template-columns:1fr 1fr; } }
        .chk{ display:flex; align-items:center; gap:8px; padding:8px 10px; border:1px solid #D1D5DB; border-radius:10px; font-size:13px; color:#0B1324; cursor:pointer; transition:.15s; min-width:0; }
        .chk:hover{ background:#F9FAFB; }
        .chk.on{ border-color:#0B1533; background:#EFF4FF; }
        .chk input{ width:15px; height:15px; accent-color:#0B1533; flex-shrink:0; }
        .fin-card{ position:relative; background:#fff; border:1px solid #E5E7EB; border-radius:16px; padding:18px; box-shadow:0 1px 2px rgba(11,19,36,.04),0 10px 30px rgba(11,19,36,.05); overflow:hidden; transition:transform .2s,box-shadow .2s; min-width:0; }
        .fin-card::before{ content:''; position:absolute; top:0; left:0; right:0; height:3px; }
        .fin-green::before{ background:linear-gradient(90deg,#087F5B,#34D399); }
        .fin-red::before{ background:linear-gradient(90deg,#B4234B,#FB7185); }
        .fin-blue::before{ background:linear-gradient(90deg,#0B1533,#3B82F6); }
        .fin-card:hover{ transform:translateY(-2px); box-shadow:0 6px 12px rgba(11,19,36,.07),0 18px 44px rgba(11,19,36,.09); }
        .fin-spark{ height:52px; margin-top:10px; }
        .fin-ico{ display:inline-flex; padding:8px; border-radius:10px; }
        .fin-ico-green{ background:#ECFDF5; color:#087F5B; }
        .fin-ico-red{ background:#FFF1F2; color:#B4234B; }
        .fin-ico-blue{ background:#EFF4FF; color:#1D4ED8; }
        .fin-delta{ display:inline-flex; align-items:center; gap:2px; font-size:12px; font-weight:600; padding:3px 8px; border-radius:8px; }
        .fin-delta.up{ color:#087F5B; background:#ECFDF5; }
        .fin-delta.down{ color:#B4234B; background:#FFF1F2; }
        .fin-val{ font-family:'Fraunces',Georgia,serif; font-size:clamp(1.3rem,5.5vw,1.7rem); font-weight:600; letter-spacing:-.015em; line-height:1.1; margin-top:2px; color:#0B1324; word-break:break-word; }
        .fin-sub{ font-size:12px; color:#6B7280; margin-top:7px; }
        .mini-stat{ background:#F3F4F6; border:1px solid #EBEDF0; border-radius:12px; padding:12px; min-width:0; }
        .mini-label{ font-size:clamp(.6rem,1.8vw,.68rem); letter-spacing:.04em; text-transform:uppercase; font-weight:500; color:#6B7280; line-height:1.2; }
        .mini-val{ font-size:clamp(.85rem,3vw,1.05rem); font-weight:600; margin-top:5px; word-break:break-word; line-height:1.1; }
        .tx-list{ display:flex; flex-direction:column; gap:6px; padding:10px; }
        .tx-item{ display:flex; align-items:center; gap:11px; padding:9px 11px; border:1px solid #EFF0F2; border-radius:11px; background:#fff; transition:transform .15s,box-shadow .15s,border-color .15s; }
        .tx-item:hover{ border-color:#E5E7EB; box-shadow:0 4px 16px rgba(11,19,36,.07); transform:translateY(-1px); }
        .tx-overdue{ border-color:#FECDD3; background:linear-gradient(0deg,#FFF5F6,#fff); box-shadow:inset 3px 0 0 #B4234B; }
        .tx-overdue:hover{ border-color:#FDA4AF; box-shadow:inset 3px 0 0 #B4234B,0 4px 16px rgba(180,35,75,.12); }
        .tx-canc{ text-decoration:line-through; color:#9CA3AF; }
        .menu-btn{ display:inline-flex; padding:8px; margin-left:-6px; border-radius:10px; color:#0B1324; background:transparent; border:none; cursor:pointer; transition:.15s; }
        .menu-btn:hover{ background:#E5E7EB; } .menu-btn:active{ transform:scale(.95); }
        .lg\\:hidden{ display:inline-flex; } @media(min-width:1024px){ .lg\\:hidden{ display:none; } }

        /* hero */
        .hero{ position:relative; overflow:hidden; border-radius:18px; background:linear-gradient(135deg,#0B1533 0%,#16284B 55%,#1E3A66 100%); box-shadow:0 12px 34px rgba(11,19,36,.24); }
        .hero::before{ content:''; position:absolute; inset:0; background:radial-gradient(120% 120% at 88% -10%, rgba(94,234,212,.16), transparent 55%); pointer-events:none; }
        .hero::after{ content:''; position:absolute; top:-40%; left:-25%; width:55%; height:180%; background:linear-gradient(105deg, rgba(255,255,255,.10), transparent 60%); transform:rotate(8deg); pointer-events:none; }
        .hero-ico{ position:absolute; right:-30px; top:-30px; opacity:.045; color:#fff; pointer-events:none; }
        .hero-body{ position:relative; padding:clamp(22px,5vw,30px); color:#fff; }
        .hero-greet{ display:inline-flex; align-items:center; gap:6px; color:#9FB2D4; font-size:11px; font-weight:500; text-transform:uppercase; letter-spacing:.08em; background:rgba(255,255,255,.07); padding:4px 10px; border-radius:999px; }
        .hero-title{ font-size:clamp(1.4rem,5vw,2.05rem); line-height:1.1; font-weight:600; margin-top:10px; }
        .hero-stats{ margin-top:16px; }
        .hero-stat{ min-width:0; }
        .hero-stat + .hero-stat{ border-left:1px solid rgba(255,255,255,.12); padding-left:clamp(8px,2.6vw,18px); }
        .hero-lbl{ color:#93A4C4; font-size:10px; text-transform:uppercase; letter-spacing:.06em; font-weight:500; }
        .hero-val{ font-size:clamp(.84rem,3.5vw,1.5rem); font-weight:700; margin-top:5px; white-space:nowrap; letter-spacing:-.01em; }
        .hero-money{ display:inline-flex; align-items:baseline; gap:4px; }
        .hero-cur{ font-size:.58em; font-weight:600; opacity:.62; letter-spacing:0; }
        .hero-teal{ color:#5EEAD4; }
        .kpi{ transition:transform .25s ease, box-shadow .25s ease; will-change:transform; }
        .card-hover{ transition:transform .25s ease, box-shadow .25s ease; will-change:transform; }
        .card-hover:hover{ transform:translateY(-4px); box-shadow:0 8px 16px rgba(11,19,36,.07),0 22px 50px rgba(11,19,36,.10); }
        .card-hover:active{ transform:scale(.99); }
        .kpi:hover{ transform:translateY(-4px); box-shadow:0 8px 16px rgba(11,19,36,.07),0 22px 50px rgba(11,19,36,.10); }
        .kpi:active{ transform:scale(.985); }
        .dash > *{ animation:dashfade .45s ease both; }
        .dash > *:nth-child(2){ animation-delay:.06s; }
        .dash > *:nth-child(3){ animation-delay:.12s; }
        .dash > *:nth-child(4){ animation-delay:.18s; }
        .dash > *:nth-child(5){ animation-delay:.24s; }
        @keyframes dashfade{ from{ opacity:0; transform:translateY(10px); } to{ opacity:1; transform:none; } }
        .lp-row{ padding:2px 0; }
        .alert-row{ display:flex; align-items:center; gap:11px; padding:9px; border:1px solid #EFF0F2; border-radius:11px; background:#fff; transition:border-color .15s, box-shadow .15s; cursor:default; }
        .alert-row:hover{ border-color:#E5E7EB; box-shadow:0 2px 10px rgba(11,19,36,.05); }
        .alert-ico{ width:30px; height:30px; border-radius:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ai-orange{ background:#FFF4E6; color:#D97706; }
        .ai-blue{ background:#EFF4FF; color:#1D4ED8; }
        .ai-red{ background:#FBEAEF; color:#B4234B; }

        /* motoristas */
        .avatar{ width:42px; height:42px; border-radius:12px; background:#0B1324; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:1.05rem; flex-shrink:0; font-family:'Fraunces',Georgia,serif; }
        .alert-chip{ display:inline-flex; align-items:center; gap:8px; background:#F4F6F8; border:1px solid #E5E7EB; border-radius:10px; padding:6px 10px; }
        .drv-stat{ font-size:clamp(.95rem,3.4vw,1.1rem); }
        .drv-lbl{ font-size:.58rem; letter-spacing:.06em; text-transform:uppercase; font-weight:500; color:#6B7280; margin-top:2px; }

        /* coming soon */
        .cs-ico{ display:inline-flex; padding:16px; border-radius:16px; background:#0B1324; color:#fff; }
        .cs-title{ font-size:clamp(1.25rem,5vw,1.75rem); margin-top:16px; margin-bottom:8px; }
        .cs-desc{ max-width:28rem; margin:0 auto; }
        .cs-tag{ margin-top:24px; }

        /* modal */
        .modal-bg{ position:fixed; inset:0; z-index:60; display:flex; align-items:flex-end; justify-content:center; background:rgba(11,19,36,.45); -webkit-backdrop-filter:blur(3px); backdrop-filter:blur(3px); }
        @media(min-width:640px){ .modal-bg{ align-items:center; padding:16px; } }
        .modal{ background:#F4F6F8; width:100%; max-height:92vh; overflow-y:auto; border-radius:24px 24px 0 0; box-shadow:0 -8px 40px rgba(0,0,0,.2); }
        @media(min-width:640px){ .modal{ border-radius:16px; box-shadow:0 20px 60px rgba(0,0,0,.25); } }
        .modal-md{ max-width:460px; } .modal-wide{ max-width:640px; }
        .modal-head{ position:sticky; top:0; z-index:10; background:#F4F6F8; border-bottom:1px solid #E5E7EB; }
      `}</style>

      <Sidebar current={route} onNav={setRoute} open={sidebarOpen} onClose={() => setSidebarOpen(false)} nomeEmpresa={data.config?.nomeEmpresa || 'Empresa'} />

      <main className="flex-1 min-w-0">
        <TopBar title={cur.t} subtitle={cur.s} onMenu={() => setSidebarOpen(true)} />
        {!loaded ? <div className="p-10 t-soft text-sm">Carregando…</div> : <>
          {route === 'dashboard' && <Dashboard data={data} />}
          {route === 'finEmpresa' && <FinanceiroEmpresa data={data} setData={setData} />}
          {route === 'linhas' && <Linhas data={data} setData={setData} />}
          {route === 'veiculos' && <Veiculos data={data} setData={setData} />}
          {route === 'combustivel' && <Combustivel data={data} setData={setData} />}
          {route === 'manutencao' && <Manutencao data={data} setData={setData} />}
          {route === 'finPessoal' && <FinanceiroPessoal data={data} setData={setData} />}
          {route === 'motoristas' && <Motoristas data={data} setData={setData} />}
          {route === 'contratos' && <Contratos data={data} setData={setData} />}
          {route === 'documentos' && <ComingSoon titulo="Documentos" descricao="Upload e organização de CRLV, seguros, NFs e recibos com alertas de vencimento." />}
          {route === 'relatorios' && <Relatorios data={data} />}
          {route === 'config' && <ComingSoon titulo="Configurações" descricao="Nome da empresa, preço médio do combustível, categorias e backup." />}
        </>}
      </main>
    </div>
  );
}
