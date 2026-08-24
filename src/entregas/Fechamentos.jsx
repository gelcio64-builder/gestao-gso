import { useMemo, useState } from 'react';
import {
  FileText, Download, Send, Check, AlertTriangle, Store, ChevronLeft,
  ChevronRight, Lock, Coins,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ModalBase, Campo, Vazio, Aviso, uidLocal, fmtData, fmtBRL } from './ui';
import {
  getConfigEntregas, periodosDoMes, cobrancaDoLojista, statusConciliacao,
  vencimentoCobranca, dentroDoPeriodo,
} from './engine';
import { CAT_RECEITA_ENTREGAS } from './constants';
import { gerarCobrancaPDF } from '../pdf/cobranca';

// ============================================================
//   FECHAMENTOS DOS LOJISTAS
// ------------------------------------------------------------
//   No fim do ciclo, agrupa as coletas conferidas de cada loja
//   e produz o demonstrativo de cobrança.
//
//   Duas decisões de conteúdo que valem registrar:
//
//   1. O PDF do lojista NÃO mostra o nome do motoboy. Para ele
//      é informação inútil que só gera pergunta ("por que dois
//      motoboys no mesmo dia?"). O painel interno mostra tudo.
//
//   2. A cobrança usa a quantidade CONFIRMADA pela loja. Se o
//      motoboy disse 50 e ela confirmou 48, o PDF traz 48 e
//      pronto — cobrar o que ela mesma confirmou evita discussão.
//      A diferença fica registrada no perfil do motoboy.
//
//   Só coletas já conferidas entram. Pendentes ficam de fora e
//   aparecem como aviso, para não cobrar número não conferido.
// ============================================================

const mesAtual = () => {
  const d = new Date();
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
};

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function Fechamentos({ data, setData }) {
  const auth = useAuth() || {};
  const { company } = auth;

  const cfg = getConfigEntregas(data?.entConfig).comercial;
  const coletas = Array.isArray(data?.entColetas) ? data.entColetas : [];
  const lojistas = Array.isArray(data?.entLojistas) ? data.entLojistas : [];
  const fechamentos = Array.isArray(data?.entFechamentos) ? data.entFechamentos : [];

  const [{ ano, mes }, setMesRef] = useState(mesAtual());
  const [periodoIdx, setPeriodoIdx] = useState(0);
  const [detalhe, setDetalhe] = useState(null);
  const [erro, setErro] = useState('');

  const periodos = useMemo(() => periodosDoMes(ano, mes, cfg), [ano, mes, cfg]);
  const periodo = periodos[Math.min(periodoIdx, periodos.length - 1)] || periodos[0];

  // Agrupa por lojista as coletas conferidas dentro do período.
  const resumo = useMemo(() => {
    if (!periodo) return [];
    const doPeriodo = coletas.filter((c) => dentroDoPeriodo(c.data, periodo));
    const mapa = new Map();

    doPeriodo.forEach((c) => {
      if (!mapa.has(c.lojistaId)) {
        mapa.set(c.lojistaId, { lojistaId: c.lojistaId, conferidas: [], pendentes: 0 });
      }
      const g = mapa.get(c.lojistaId);
      if (statusConciliacao(c) === 'pendente') g.pendentes += 1;
      else g.conferidas.push(c);
    });

    return [...mapa.values()].map((g) => {
      const calc = cobrancaDoLojista(g.conferidas, cfg);
      const fech = fechamentos.find(
        (f) => f.tipo === 'lojista' && f.refId === g.lojistaId && f.periodoChave === periodo.chave
      );
      return {
        ...g,
        lojista: lojistas.find((l) => l.id === g.lojistaId),
        calc,
        fechamento: fech || null,
      };
    }).sort((a, b) => (a.lojista?.nome || '').localeCompare(b.lojista?.nome || ''));
  }, [coletas, lojistas, fechamentos, periodo, cfg]);

  const totalPeriodo = resumo.reduce((s, r) => s + (r.fechamento?.total ?? r.calc.total), 0);
  const pendentesTotal = resumo.reduce((s, r) => s + r.pendentes, 0);

  function mudarMes(delta) {
    let m = mes + delta, a = ano;
    if (m < 1) { m = 12; a -= 1; }
    if (m > 12) { m = 1; a += 1; }
    setMesRef({ ano: a, mes: m });
    setPeriodoIdx(0);
  }

  // ----------------------------------------------------------
  //   Fechar e gerar a cobrança
  // ----------------------------------------------------------
  //   É aqui — e só aqui — que a operação encosta no Financeiro
  //   Empresa. Um lançamento consolidado por fechamento, nunca
  //   um por coleta. A marca `fechamentoId` evita duplicidade e
  //   permite rastrear de volta.
  function fechar(item) {
    setErro('');
    if (!item.calc.qtdTotal) { setErro('Não há coletas conferidas neste período para esse lojista.'); return; }
    if (cfg.bloquearFechamentoComPendencia && item.pendentes > 0) {
      setErro(`${item.lojista?.nome || 'Este lojista'} tem ${item.pendentes} coleta(s) sem conferência. Confira antes de fechar.`);
      return;
    }

    const fechId = uidLocal();
    const venc = vencimentoCobranca(periodo, cfg);
    const nome = item.lojista?.nome || 'Lojista';

    const registro = {
      id: fechId,
      tipo: 'lojista',
      refId: item.lojistaId,
      refNome: nome,
      periodoChave: periodo.chave,
      periodoLabel: periodo.label,
      inicio: periodo.inicio,
      fim: periodo.fim,
      vencimento: venc,
      qtdTotal: item.calc.qtdTotal,
      total: item.calc.total,
      linhas: item.calc.linhas,
      coletaIds: item.conferidas.map((c) => c.id),
      status: 'cobrado',
      numero: `${periodo.chave}-${String(nome).slice(0, 3).toUpperCase()}`,
      criadoEm: new Date().toISOString(),
    };

    // Lançamento consolidado no Financeiro Empresa.
    const lancamento = {
      id: uidLocal(),
      fechamentoId: fechId,
      tipo: 'entrada',
      categoria: CAT_RECEITA_ENTREGAS,
      descricao: `Operação de Entregas — ${nome} (${periodo.label})`,
      valor: item.calc.total,
      data: periodo.fim,
      vencimento: venc,
      status: 'pendente',
      dataPagamento: '',
      cliente: nome,
      forma: '',
      veiculoId: '', linhaId: '', contratoId: '',
      obs: 'Gerado automaticamente pelo módulo Entregas',
      recorrente: false,
      statusConc: 'manual',
      criadoEm: new Date().toISOString(),
    };

    setData((d) => ({
      ...d,
      entFechamentos: [...(d.entFechamentos || []), registro],
      // Carimba as coletas para não entrarem em outro fechamento.
      entColetas: (d.entColetas || []).map((c) =>
        registro.coletaIds.includes(c.id) ? { ...c, fechamentoLojistaId: fechId } : c),
      finEmpresa: [...(d.finEmpresa || []), lancamento],
    }));
  }

  function reabrir(fech) {
    setData((d) => {
      const lanc = (d.finEmpresa || []).find((x) => x.fechamentoId === fech.id);
      // Recebimento já baixado nunca é desfeito automaticamente.
      if (lanc && lanc.status === 'pago') return d;
      return {
        ...d,
        entFechamentos: (d.entFechamentos || []).filter((f) => f.id !== fech.id),
        entColetas: (d.entColetas || []).map((c) =>
          c.fechamentoLojistaId === fech.id ? { ...c, fechamentoLojistaId: null } : c),
        finEmpresa: (d.finEmpresa || []).filter((x) => x.fechamentoId !== fech.id),
      };
    });
  }

  const empresaPDF = () => ({
    nome: data?.config?.nomeEmpresa || company?.nome || 'Gestão GSO',
    logoUrl: data?.config?.logoUrl || '',
    cnpj: data?.config?.cnpj || '',
    telefone: data?.config?.telefone || '',
    endereco: data?.config?.endereco || '',
    cidade: data?.config?.cidade || '',
    uf: data?.config?.uf || '',
    emailContato: data?.config?.emailContato || '',
    corPrimaria: getComputedStyle(document.documentElement)
      .getPropertyValue('--color-primary').trim() || '#0B1533',
    pixCobranca: data?.config?.pixCobranca || '',
  });

  async function baixarPDF(item) {
    const f = item.fechamento || {
      periodoLabel: periodo.label, inicio: periodo.inicio, fim: periodo.fim,
      vencimento: vencimentoCobranca(periodo, cfg),
      qtdTotal: item.calc.qtdTotal, total: item.calc.total, linhas: item.calc.linhas,
    };
    try {
      await gerarCobrancaPDF(f, item.lojista || {}, empresaPDF());
    } catch (e) {
      console.error('[pdf cobranca]', e);
      setErro('Não foi possível gerar o PDF.');
    }
  }

  function enviarWhatsApp(item) {
    const f = item.fechamento;
    const nome = item.lojista?.nome || 'Olá';
    const tel = String(item.lojista?.telefone || '').replace(/\D/g, '');
    const msg =
      `Olá, ${nome}!\n\n` +
      `Segue o demonstrativo de coletas do período ${fmtData(periodo.inicio)} a ${fmtData(periodo.fim)}:\n\n` +
      `Volumes coletados: ${f?.qtdTotal ?? item.calc.qtdTotal}\n` +
      `Total: ${fmtBRL(f?.total ?? item.calc.total)}\n` +
      (f?.vencimento ? `Vencimento: ${fmtData(f.vencimento)}\n` : '') +
      `\nO PDF detalhado segue em anexo.`;
    const url = tel
      ? `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>Fechamentos</h2>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Cobrança dos lojistas por período
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost ent-b-sm" onClick={() => mudarMes(-1)}><ChevronLeft size={15} /></button>
            <span className="text-sm font-semibold" style={{ minWidth: 130, textAlign: 'center' }}>
              {MESES[mes - 1]} {ano}
            </span>
            <button className="btn btn-ghost ent-b-sm" onClick={() => mudarMes(1)}><ChevronRight size={15} /></button>
          </div>
        </div>

        <div className="flex gap-2 mt-3 flex-wrap">
          {periodos.map((p, i) => (
            <button key={p.chave} className={`ent-tab${i === periodoIdx ? ' on' : ''}`}
              onClick={() => setPeriodoIdx(i)}>{p.label}</button>
          ))}
        </div>

        <div className="ent-conf-tot" style={{ marginTop: 14 }}>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total do período</span>
          <strong>{fmtBRL(totalPeriodo)}</strong>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            · {resumo.length} lojista(s)
          </span>
        </div>
      </div>

      {erro && <div className="ent-erro"><AlertTriangle size={14} /> {erro}</div>}

      {pendentesTotal > 0 && (
        <Aviso tipo="alerta">
          {pendentesTotal} coleta(s) ainda sem conferência neste período. Elas não entram na cobrança
          enquanto o lojista não confirmar a quantidade.
        </Aviso>
      )}

      {!resumo.length ? (
        <div className="card p-4">
          <Vazio icon={FileText} titulo="Nenhuma coleta neste período"
            sub="Escolha outro período ou registre coletas para fechar." />
        </div>
      ) : (
        <div className="space-y-3">
          {resumo.map((item) => (
            <CardFechamento key={item.lojistaId} item={item}
              onFechar={() => fechar(item)}
              onReabrir={() => reabrir(item.fechamento)}
              onPDF={() => baixarPDF(item)}
              onWhats={() => enviarWhatsApp(item)}
              onDetalhe={() => setDetalhe(item)} />
          ))}
        </div>
      )}

      {detalhe && (
        <ModalBase largo titulo={`${detalhe.lojista?.nome || 'Lojista'} — ${periodo.label}`}
          onFechar={() => setDetalhe(null)}>
          <div className="ent-scroll">
            <table className="ent-tabela">
              <thead>
                <tr><th>Data</th><th>Volumes</th><th>Unitário</th><th>Subtotal</th></tr>
              </thead>
              <tbody>
                {(detalhe.fechamento?.linhas || detalhe.calc.linhas).map((l, i) => (
                  <tr key={i}>
                    <td>{fmtData(l.data)}</td>
                    <td><b>{l.qtd}</b></td>
                    <td>{fmtBRL(l.tarifa)}</td>
                    <td>
                      {fmtBRL(l.total)}
                      {l.usouMinimo && <span className="ent-tag-pad" style={{ marginLeft: 5 }}>mínimo</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ent-conf-tot" style={{ marginTop: 12 }}>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total</span>
            <strong>{fmtBRL(detalhe.fechamento?.total ?? detalhe.calc.total)}</strong>
          </div>
        </ModalBase>
      )}
    </div>
  );
}

function CardFechamento({ item, onFechar, onReabrir, onPDF, onWhats, onDetalhe }) {
  const f = item.fechamento;
  const fechado = !!f;
  const qtd = f?.qtdTotal ?? item.calc.qtdTotal;
  const total = f?.total ?? item.calc.total;

  return (
    <div className="ent-conf">
      <div className="ent-conf-h">
        <div className="flex items-center gap-2 min-w-0">
          <div className="ent-mb-av" style={{ background: '#1D4ED8', width: 34, height: 34 }}>
            <Store size={15} />
          </div>
          <div className="min-w-0">
            <div className="ent-conf-nome">{item.lojista?.nome || 'Lojista removido'}</div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {item.conferidas.length} coleta(s) conferida(s)
              {item.pendentes > 0 && ` · ${item.pendentes} pendente(s)`}
            </div>
          </div>
        </div>
        {fechado && (
          <span className="ent-status on" style={{ background: '#EDE9FE', color: '#7C3AED' }}>
            <Lock size={10} style={{ display: 'inline', marginRight: 3 }} /> Cobrado
          </span>
        )}
      </div>

      <div className="ent-conf-tot" style={{ marginTop: 12 }}>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{qtd} volumes</span>
        <strong>{fmtBRL(total)}</strong>
        {f?.vencimento && (
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            · vence {fmtData(f.vencimento)}
          </span>
        )}
      </div>

      <div className="ent-mb-acoes" style={{ marginTop: 12 }}>
        {!fechado ? (
          <button className="btn btn-primary ent-b-sm" onClick={onFechar}>
            <Check size={13} /> Fechar e cobrar
          </button>
        ) : (
          <button className="btn btn-ghost ent-b-sm" onClick={onReabrir}>Reabrir</button>
        )}
        <button className="btn btn-ghost ent-b-sm" onClick={onPDF}><Download size={13} /> PDF</button>
        <button className="btn btn-ghost ent-b-sm" onClick={onWhats}><Send size={13} /> WhatsApp</button>
        <button className="btn btn-ghost ent-b-sm" onClick={onDetalhe}>Detalhes</button>
      </div>

      {fechado && (
        <p className="ent-nota" style={{ marginTop: 10 }}>
          <Coins size={12} style={{ display: 'inline', marginRight: 4 }} />
          Conta a receber criada no Financeiro Empresa em <b>{CAT_RECEITA_ENTREGAS}</b>.
          Dê a baixa por lá quando o lojista pagar.
        </p>
      )}
    </div>
  );
}
