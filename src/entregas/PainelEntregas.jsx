import { useMemo, useState } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts';
import {
  Package, Warehouse, Bike, CheckCircle2, Clock, AlertTriangle, Wallet,
  TrendingUp, ChevronRight, Store, ArrowRight, Info,
} from 'lucide-react';
import { Vazio, Aviso, fmtBRL, fmtData } from './ui';
import {
  getConfigEntregas, periodosDoMes, indicadoresOperacao, resultadoOperacao,
  dentroDoPeriodo, statusConciliacao, qtdCobravelColeta, cobrancaDoLojista, totalInformado,
  repasseDoMotoboy, somaPagamentos, saldoRepasse,
} from './engine';

// ============================================================
//   PAINEL DA OPERAÇÃO
// ------------------------------------------------------------
//   Visão do dia a dia da operação de entregas. NÃO é o painel
//   financeiro da empresa: aqui só entra o que a operação gera.
//
//   O card "Resultado da operação" mostra receita dos lojistas
//   menos repasse aos motoboys. Isso é MARGEM OPERACIONAL, não
//   lucro — combustível, aluguel, impostos e salários continuam
//   no Financeiro Empresa. A tela diz isso em texto, porque é o
//   tipo de número que o dono confunde com lucro e toma decisão
//   errada em cima.
// ============================================================

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const CORES_STATUS = ['#1D4ED8', '#7C3AED', '#CA8A04', '#047857', '#B91C1C'];

export default function PainelEntregas({ data, setData, onIrPara }) {
  const cfg = getConfigEntregas(data?.entConfig).comercial;
  const coletas = Array.isArray(data?.entColetas) ? data.entColetas : [];
  const rotas = Array.isArray(data?.entRotas) ? data.entRotas : [];
  const lojistas = Array.isArray(data?.entLojistas) ? data.entLojistas : [];
  const motoboys = Array.isArray(data?.entMotoboys) ? data.entMotoboys : [];
  const pagamentos = Array.isArray(data?.entPagamentos) ? data.entPagamentos : [];
  const tarifas = Array.isArray(data?.entTarifas) ? data.entTarifas : [];

  const hoje = new Date();
  const [{ ano, mes }] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 });
  const periodos = useMemo(() => periodosDoMes(ano, mes, cfg), [ano, mes, cfg]);
  const idxAtual = Math.max(0, periodos.findIndex((p) =>
    dentroDoPeriodo(hoje.toISOString().slice(0, 10), p)));
  const [periodoIdx, setPeriodoIdx] = useState(idxAtual);
  const periodo = periodos[Math.min(periodoIdx, periodos.length - 1)] || periodos[0];

  const ind = useMemo(
    () => indicadoresOperacao({ coletas, rotas, periodo, cfgComercial: cfg }),
    [coletas, rotas, periodo, cfg]
  );
  const res = useMemo(
    () => resultadoOperacao({ coletas, rotas, periodo, cfgComercial: cfg, entTarifas: tarifas }),
    [coletas, rotas, periodo, cfg, tarifas]
  );

  // Repasses em aberto no período
  const repasses = useMemo(() => {
    let devido = 0, pago = 0, pendentes = 0;
    motoboys.forEach((m) => {
      const cs = coletas.filter((c) => c.motoboyId === m.id && dentroDoPeriodo(c.data, periodo));
      const rs = rotas.filter((r) => r.motoboyId === m.id && dentroDoPeriodo(r.data, periodo));
      const calc = repasseDoMotoboy({ coletas: cs, rotas: rs, cfgComercial: cfg });
      if (calc.total <= 0) return;
      const p = somaPagamentos(pagamentos.filter(
        (x) => x.motoboyId === m.id && x.periodoChave === periodo?.chave));
      devido += calc.total;
      pago += p;
      if (saldoRepasse(calc.total, p) > 0) pendentes += 1;
    });
    return { devido, pago, saldo: devido - pago, pendentes };
  }, [motoboys, coletas, rotas, pagamentos, periodo, cfg]);

  const topLojistas = useMemo(() => {
    const mapa = new Map();
    coletas.filter((c) => dentroDoPeriodo(c.data, periodo)).forEach((c) => {
      const atual = mapa.get(c.lojistaId) || { id: c.lojistaId, volumes: 0, itens: [] };
      atual.volumes += qtdCobravelColeta(c, cfg);
      atual.itens.push(c);
      mapa.set(c.lojistaId, atual);
    });
    return [...mapa.values()]
      .map((x) => ({
        ...x,
        nome: lojistas.find((l) => l.id === x.id)?.nome || 'Lojista',
        valor: cobrancaDoLojista(x.itens, cfg, tarifas).total,
      }))
      .sort((a, b) => b.volumes - a.volumes)
      .slice(0, 5);
  }, [coletas, lojistas, periodo, cfg, tarifas]);

  const topMotoboys = useMemo(() => {
    const mapa = new Map();
    rotas.filter((r) => dentroDoPeriodo(r.data, periodo)).forEach((r) => {
      const atual = mapa.get(r.motoboyId) || { id: r.motoboyId, entregues: 0, atribuidos: 0 };
      atual.entregues += Number(r.qtdConcluida) || 0;
      atual.atribuidos += Number(r.qtdAtribuida) || 0;
      mapa.set(r.motoboyId, atual);
    });
    return [...mapa.values()]
      .map((x) => ({ ...x, nome: motoboys.find((m) => m.id === x.id)?.nome || 'Motoboy' }))
      .sort((a, b) => b.entregues - a.entregues)
      .slice(0, 5);
  }, [rotas, motoboys, periodo]);

  // Volumes por dia (barras)
  const porDia = useMemo(() => {
    if (!periodo) return [];
    const mapa = new Map();
    coletas.filter((c) => dentroDoPeriodo(c.data, periodo)).forEach((c) => {
      const k = c.data;
      mapa.set(k, (mapa.get(k) || 0) + totalInformado(c));
    });
    return [...mapa.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([d, v]) => ({ dia: d.slice(8), volumes: v }));
  }, [coletas, periodo]);

  const donut = [
    { nome: 'Coletados', valor: ind.coletados },
    { nome: 'Na base', valor: ind.recebidos },
    { nome: 'Atribuídos', valor: ind.atribuidos },
    { nome: 'Entregues', valor: ind.entregues },
    { nome: 'Ocorrências', valor: ind.ocorrencias },
  ].filter((x) => x.valor > 0);

  const semDados = !coletas.length && !rotas.length;

  if (semDados) {
    return (
      <div className="card p-4">
        <Vazio icon={Package} titulo="A operação ainda não começou"
          sub="Cadastre bases e lojistas, e registre a primeira coleta para os números aparecerem aqui." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <style>{PN_CSS}</style>

      <div className="card p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
              Painel da operação
            </h2>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {MESES[mes - 1]} {ano} · {periodo?.label}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {periodos.map((p, i) => (
              <button key={p.chave} className={`ent-tab${i === periodoIdx ? ' on' : ''}`}
                onClick={() => setPeriodoIdx(i)} style={{ padding: '6px 12px', fontSize: 12 }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Alertas ---- */}
      {ind.conciliacoesPendentes > 0 && (
        <div className="pn-alerta" onClick={() => onIrPara?.('coletas')}>
          <Clock size={16} />
          <span>
            <b>{ind.conciliacoesPendentes} coleta(s)</b> aguardando conferência com o lojista.
            Elas não entram na cobrança enquanto não forem confirmadas.
          </span>
          <ChevronRight size={16} />
        </div>
      )}
      {ind.divergencias > 0 && (
        <Aviso tipo="erro">
          {ind.divergencias} coleta(s) com divergência entre o informado pelo motoboy e o
          confirmado pelo lojista.
        </Aviso>
      )}

      {/* ---- KPIs ---- */}
      <div className="pn-kpis">
        <Kpi icon={Package} cor="#1D4ED8" valor={ind.coletados} label="Coletados" />
        <Kpi icon={Warehouse} cor="#7C3AED" valor={ind.recebidos} label="Na base" />
        <Kpi icon={Bike} cor="#EA580C" valor={ind.atribuidos} label="Atribuídos" />
        <Kpi icon={CheckCircle2} cor="#047857" valor={ind.entregues} label="Entregues" />
        <Kpi icon={Clock} cor="#CA8A04" valor={ind.pendentes} label="Pendentes" />
        <Kpi icon={AlertTriangle} cor="#B91C1C" valor={ind.ocorrencias} label="Ocorrências" />
      </div>

      {/* ---- Resultado da operação ---- */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={16} style={{ color: 'var(--color-primary)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            Resultado da operação
          </h3>
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
          O que a operação de entregas gerou no período
        </p>

        <div className="pn-res">
          <div className="pn-res-c">
            <small>Receita dos lojistas</small>
            <b style={{ color: '#047857' }}>{fmtBRL(res.receita)}</b>
          </div>
          <div className="pn-res-c">
            <small>Repasse aos motoboys</small>
            <b style={{ color: '#B91C1C' }}>{fmtBRL(res.repasse)}</b>
          </div>
          <div className="pn-res-c destaque">
            <small>Margem operacional</small>
            <b>{fmtBRL(res.margem)}</b>
            {res.receita > 0 && <span className="pn-pct">{res.margemPct.toFixed(1)}%</span>}
          </div>
        </div>

        <p className="ent-nota" style={{ marginTop: 12 }}>
          <Info size={12} style={{ display: 'inline', marginRight: 4 }} />
          Isto é <b>margem da operação</b>, não lucro da empresa. Combustível, aluguel, impostos,
          manutenção e salários entram no cálculo do lucro real, no <b>Financeiro Empresa</b>.
        </p>
      </div>

      {/* ---- Card de repasses, clicável ---- */}
      <button className="pn-repasses" onClick={() => onIrPara?.('repasses')}>
        <div className="pn-rp-h">
          <Wallet size={17} />
          <span>Repasses do período</span>
          <ChevronRight size={17} style={{ marginLeft: 'auto' }} />
        </div>
        <div className="pn-rp-g">
          <div><small>A pagar</small><b>{fmtBRL(repasses.devido)}</b></div>
          <div><small>Pago</small><b style={{ color: '#047857' }}>{fmtBRL(repasses.pago)}</b></div>
          <div><small>Saldo</small><b style={{ color: repasses.saldo > 0 ? '#B91C1C' : '#047857' }}>
            {fmtBRL(repasses.saldo)}</b></div>
          <div><small>Motoboys pendentes</small><b>{repasses.pendentes}</b></div>
        </div>
      </button>

      {/* ---- Gráficos ---- */}
      <div className="pn-graficos">
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
            Volumes por etapa
          </h3>
          <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Taxa de sucesso das entregas: <b>{ind.taxaSucesso.toFixed(1)}%</b>
          </p>
          {!donut.length ? (
            <p className="text-xs" style={{ color: '#9CA3AF' }}>Sem volumes no período.</p>
          ) : (
            <div style={{ width: '100%', height: 210 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={donut} dataKey="valor" nameKey="nome" innerRadius={52} outerRadius={82}
                    paddingAngle={2}>
                    {donut.map((_, i) => <Cell key={i} fill={CORES_STATUS[i % CORES_STATUS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v} volumes`, n]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="pn-legenda">
            {donut.map((d, i) => (
              <span key={d.nome}>
                <i style={{ background: CORES_STATUS[i % CORES_STATUS.length] }} />
                {d.nome} <b>{d.valor}</b>
              </span>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
            Coletas por dia
          </h3>
          <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Volumes retirados nos lojistas
          </p>
          {!porDia.length ? (
            <p className="text-xs" style={{ color: '#9CA3AF' }}>Sem coletas no período.</p>
          ) : (
            <div style={{ width: '100%', height: 210 }}>
              <ResponsiveContainer>
                <BarChart data={porDia} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F2F4" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => [`${v} volumes`, 'Coletados']}
                    labelFormatter={(l) => `Dia ${l}`} />
                  <Bar dataKey="volumes" fill="var(--color-accent, #1D4ED8)" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ---- Rankings ---- */}
      <div className="pn-graficos">
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
            Top lojistas
          </h3>
          {!topLojistas.length ? (
            <p className="text-xs" style={{ color: '#9CA3AF' }}>Sem coletas no período.</p>
          ) : topLojistas.map((l, i) => (
            <div key={l.id} className="pn-rank">
              <span className="pn-pos">{i + 1}</span>
              <Store size={14} style={{ color: '#9CA3AF' }} />
              <span className="pn-nome">{l.nome}</span>
              <span className="pn-val">{l.volumes} vol.</span>
              <span className="pn-val forte">{fmtBRL(l.valor)}</span>
            </div>
          ))}
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
            Top motoboys
          </h3>
          {!topMotoboys.length ? (
            <p className="text-xs" style={{ color: '#9CA3AF' }}>Sem rotas no período.</p>
          ) : topMotoboys.map((m, i) => (
            <div key={m.id} className="pn-rank">
              <span className="pn-pos">{i + 1}</span>
              <Bike size={14} style={{ color: '#9CA3AF' }} />
              <span className="pn-nome">{m.nome}</span>
              <span className="pn-val">{m.entregues}/{m.atribuidos}</span>
              <span className="pn-val forte">
                {m.atribuidos > 0 ? `${Math.round((m.entregues / m.atribuidos) * 100)}%` : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ---- Fluxo ---- */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
          Fluxo da operação
        </h3>
        <div className="pn-fluxo">
          {[
            { i: Store, t: 'Lojista', s: 'Gera os pacotes', ir: 'lojistas' },
            { i: Package, t: 'Coleta', s: 'Motoboy retira', ir: 'coletas' },
            { i: Warehouse, t: 'Base', s: 'Recebe e tria', ir: 'triagem' },
            { i: Bike, t: 'Entrega', s: 'Rota do motoboy', ir: 'triagem' },
            { i: Wallet, t: 'Fechamento', s: 'Cobra e repassa', ir: 'fechamentos' },
          ].map((e, i, arr) => (
            <div key={e.t} className="pn-fl-w">
              <button className="pn-fl" onClick={() => onIrPara?.(e.ir)}>
                <e.i size={18} />
                <strong>{e.t}</strong>
                <small>{e.s}</small>
              </button>
              {i < arr.length - 1 && <ArrowRight size={15} className="pn-fl-seta" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, cor, valor, label }) {
  return (
    <div className="pn-kpi">
      <span className="pn-kpi-ic" style={{ background: `${cor}15`, color: cor }}><Icon size={16} /></span>
      <span className="pn-kpi-v">{valor}</span>
      <span className="pn-kpi-l">{label}</span>
    </div>
  );
}

const PN_CSS = `
.pn-kpis{ display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:10px; }
.pn-kpi{ background:#fff; border:1px solid #E5E7EB; border-radius:14px; padding:13px 14px; }
.pn-kpi-ic{ display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:9px; margin-bottom:8px; }
.pn-kpi-v{ display:block; font-size:25px; font-weight:700; letter-spacing:-.02em; line-height:1.1; color:#0B1324; }
.pn-kpi-l{ font-size:11.5px; color:#6B7280; }

.pn-res{ display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:10px; }
.pn-res-c{ background:#F9FAFB; border:1px solid #F1F2F4; border-radius:12px; padding:13px 14px; }
.pn-res-c.destaque{ background:var(--color-primary,#0B1533); border-color:var(--color-primary,#0B1533); }
.pn-res-c.destaque small, .pn-res-c.destaque b, .pn-res-c.destaque .pn-pct{ color:#fff; }
.pn-res-c small{ display:block; font-size:11px; color:#6B7280; margin-bottom:3px; }
.pn-res-c b{ font-size:20px; letter-spacing:-.02em; color:#0B1324; }
.pn-pct{ font-size:12px; margin-left:6px; opacity:.85; }

.pn-alerta{ display:flex; align-items:center; gap:9px; background:#FEF3C7; border:1px solid #FDE68A; color:#92400E; padding:12px 14px; border-radius:12px; font-size:13px; cursor:pointer; }
.pn-alerta:hover{ background:#FDE68A; }

.pn-repasses{ width:100%; text-align:left; background:#fff; border:1px solid #E5E7EB; border-radius:15px; padding:15px 16px; cursor:pointer; font-family:inherit; }
.pn-repasses:hover{ border-color:var(--color-primary,#0B1533); }
.pn-rp-h{ display:flex; align-items:center; gap:8px; font-size:13.5px; font-weight:650; color:var(--color-primary,#0B1533); margin-bottom:12px; }
.pn-rp-g{ display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:10px; }
.pn-rp-g small{ display:block; font-size:10.5px; text-transform:uppercase; letter-spacing:.04em; color:#9CA3AF; margin-bottom:2px; }
.pn-rp-g b{ font-size:17px; letter-spacing:-.01em; color:#0B1324; }

.pn-graficos{ display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:12px; }
.pn-legenda{ display:flex; flex-wrap:wrap; gap:10px; margin-top:8px; }
.pn-legenda span{ display:inline-flex; align-items:center; gap:5px; font-size:11.5px; color:#6B7280; }
.pn-legenda i{ width:9px; height:9px; border-radius:3px; display:inline-block; }
.pn-legenda b{ color:#0B1324; }

.pn-rank{ display:flex; align-items:center; gap:9px; padding:9px 0; border-bottom:1px solid #F6F7F8; font-size:13px; }
.pn-rank:last-child{ border-bottom:0; }
.pn-pos{ width:20px; height:20px; border-radius:6px; background:#F3F4F6; color:#6B7280; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.pn-nome{ flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pn-val{ font-size:12px; color:#6B7280; white-space:nowrap; }
.pn-val.forte{ color:#0B1324; font-weight:600; }

.pn-fluxo{ display:flex; align-items:stretch; gap:6px; overflow-x:auto; padding-bottom:4px; }
.pn-fl-w{ display:flex; align-items:center; gap:6px; }
.pn-fl{ display:flex; flex-direction:column; align-items:center; gap:2px; min-width:104px; padding:13px 10px; border:1px solid #E5E7EB; border-radius:13px; background:#fff; cursor:pointer; font-family:inherit; color:var(--color-primary,#0B1533); }
.pn-fl:hover{ background:#F9FAFB; border-color:var(--color-primary,#0B1533); }
.pn-fl strong{ font-size:13px; margin-top:4px; }
.pn-fl small{ font-size:10.5px; color:#9CA3AF; text-align:center; }
.pn-fl-seta{ color:#D1D5DB; flex-shrink:0; }
`;
