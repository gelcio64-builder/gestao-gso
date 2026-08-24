import { useMemo, useState } from 'react';
import {
  Bike, Wallet, Plus, ChevronLeft, ChevronRight, AlertTriangle, Check,
  History, Lock, Image as ImgIcon,
} from 'lucide-react';
import { ModalBase, Campo, Vazio, Chip, Aviso, uidLocal, fmtData, fmtBRL } from './ui';
import {
  getConfigEntregas, periodosDoMes, repasseDoMotoboy, somaPagamentos,
  saldoRepasse, statusRepasse, dentroDoPeriodo, vencimentoCobranca,
} from './engine';
import { REPASSE_STATUS, FORMAS_REPASSE, CAT_REPASSE_MOTOBOYS } from './constants';

// ============================================================
//   REPASSES AOS MOTOBOYS
// ------------------------------------------------------------
//   REGRA CENTRAL (item 17 do escopo): o valor DEVIDO nunca é
//   substituído pelo valor PAGO. São dois números independentes;
//   o saldo é sempre derivado. Isso é o que permite responder
//   "quanto já paguei pro Gelson este mês" com auditoria.
//
//   PONTE COM O FINANCEIRO
//   O Financeiro Empresa só tem status pago/pendente — não tem
//   "parcialmente pago". Por isso a dívida vive aqui, e cada
//   pagamento registrado vira UMA saída já paga no Financeiro.
//   Três PIX para o Gelson = três saídas reais de caixa. O fluxo
//   de caixa fica correto e não há duplicidade.
// ============================================================

const mesAtual = () => {
  const d = new Date();
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
};
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function Repasses({ data, setData }) {
  const cfg = getConfigEntregas(data?.entConfig).comercial;
  const coletas = Array.isArray(data?.entColetas) ? data.entColetas : [];
  const rotas = Array.isArray(data?.entRotas) ? data.entRotas : [];
  const motoboys = Array.isArray(data?.entMotoboys) ? data.entMotoboys : [];
  const pagamentos = Array.isArray(data?.entPagamentos) ? data.entPagamentos : [];

  const [{ ano, mes }, setMesRef] = useState(mesAtual());
  const [periodoIdx, setPeriodoIdx] = useState(0);
  const [pagando, setPagando] = useState(null);
  const [historico, setHistorico] = useState(null);
  const [erro, setErro] = useState('');

  const periodos = useMemo(() => periodosDoMes(ano, mes, cfg), [ano, mes, cfg]);
  const periodo = periodos[Math.min(periodoIdx, periodos.length - 1)] || periodos[0];

  const linhas = useMemo(() => {
    if (!periodo) return [];
    return motoboys.map((m) => {
      const cs = coletas.filter((c) => c.motoboyId === m.id && dentroDoPeriodo(c.data, periodo));
      const rs = rotas.filter((r) => r.motoboyId === m.id && dentroDoPeriodo(r.data, periodo));
      const calc = repasseDoMotoboy({ coletas: cs, rotas: rs, cfgComercial: cfg });
      const pagos = pagamentos.filter((p) => p.motoboyId === m.id && p.periodoChave === periodo.chave);
      const pago = somaPagamentos(pagos);
      const venc = vencimentoCobranca(periodo, cfg);
      return {
        motoboy: m,
        calc,
        pago,
        saldo: saldoRepasse(calc.total, pago),
        status: statusRepasse(calc.total, pago, venc),
        vencimento: venc,
        pagamentos: pagos,
      };
    }).filter((l) => l.calc.total > 0 || l.pago > 0)
      .sort((a, b) => b.saldo - a.saldo);
  }, [motoboys, coletas, rotas, pagamentos, periodo, cfg]);

  const totais = linhas.reduce((acc, l) => ({
    devido: acc.devido + l.calc.total,
    pago: acc.pago + l.pago,
    saldo: acc.saldo + l.saldo,
    pendentes: acc.pendentes + (l.saldo > 0 ? 1 : 0),
  }), { devido: 0, pago: 0, saldo: 0, pendentes: 0 });

  function mudarMes(delta) {
    let m = mes + delta, a = ano;
    if (m < 1) { m = 12; a -= 1; }
    if (m > 12) { m = 1; a += 1; }
    setMesRef({ ano: a, mes: m });
    setPeriodoIdx(0);
  }

  function registrarPagamento(linha, dados) {
    setErro('');
    const valor = Number(String(dados.valor).replace(',', '.'));
    if (!Number.isFinite(valor) || valor <= 0) { setErro('Informe um valor válido.'); return; }
    if (valor > linha.saldo + 0.009) {
      setErro(`O valor passa do saldo devido (${fmtBRL(linha.saldo)}).`);
      return;
    }

    const pagId = uidLocal();
    const nome = linha.motoboy.nome || 'Motoboy';

    const pagamento = {
      id: pagId,
      motoboyId: linha.motoboy.id,
      motoboyNome: nome,
      periodoChave: periodo.chave,
      periodoLabel: periodo.label,
      valor,
      data: dados.data,
      forma: dados.forma,
      obs: dados.obs || '',
      // Guarda o quanto era devido na hora do pagamento — a auditoria
      // consegue reconstruir a situação mesmo se algo mudar depois.
      devidoNaEpoca: linha.calc.total,
      criadoEm: new Date().toISOString(),
    };

    // Uma saída JÁ PAGA no Financeiro: é dinheiro que saiu de fato.
    const lancamento = {
      id: uidLocal(),
      repasseId: pagId,
      tipo: 'saida',
      categoria: CAT_REPASSE_MOTOBOYS,
      descricao: `Repasse — ${nome} (${periodo.label})`,
      valor,
      data: dados.data,
      vencimento: dados.data,
      status: 'pago',
      dataPagamento: dados.data,
      cliente: nome,
      forma: dados.forma,
      veiculoId: '', linhaId: '', contratoId: '',
      obs: 'Gerado automaticamente pelo módulo Entregas',
      recorrente: false,
      statusConc: 'manual',
      criadoEm: new Date().toISOString(),
    };

    setData((d) => ({
      ...d,
      entPagamentos: [...(d.entPagamentos || []), pagamento],
      finEmpresa: [...(d.finEmpresa || []), lancamento],
    }));
    setPagando(null);
  }

  function estornar(pag) {
    setData((d) => ({
      ...d,
      entPagamentos: (d.entPagamentos || []).filter((p) => p.id !== pag.id),
      finEmpresa: (d.finEmpresa || []).filter((x) => x.repasseId !== pag.id),
    }));
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>Repasses</h2>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Quanto cada motoboy gerou, quanto já recebeu e o saldo
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

        <div className="rp-cards">
          <div className="rp-card"><span>{fmtBRL(totais.devido)}</span><small>Total gerado</small></div>
          <div className="rp-card verde"><span>{fmtBRL(totais.pago)}</span><small>Já pago</small></div>
          <div className="rp-card laranja"><span>{fmtBRL(totais.saldo)}</span><small>Saldo a pagar</small></div>
          <div className="rp-card"><span>{totais.pendentes}</span><small>Motoboys pendentes</small></div>
        </div>
      </div>

      {erro && <div className="ent-erro"><AlertTriangle size={14} /> {erro}</div>}

      {!linhas.length ? (
        <div className="card p-4">
          <Vazio icon={Wallet} titulo="Nada a repassar neste período"
            sub="Os valores aparecem conforme as rotas de entrega forem criadas." />
        </div>
      ) : (
        <div className="space-y-3">
          {linhas.map((l) => (
            <CardRepasse key={l.motoboy.id} linha={l}
              onPagar={() => setPagando(l)}
              onHistorico={() => setHistorico(l)} />
          ))}
        </div>
      )}

      {pagando && (
        <FormPagamento linha={pagando} periodo={periodo}
          onSalvar={(d) => registrarPagamento(pagando, d)}
          onCancelar={() => setPagando(null)} />
      )}

      {historico && (
        <ModalBase largo titulo={`Pagamentos — ${historico.motoboy.nome}`}
          onFechar={() => setHistorico(null)}>
          {!historico.pagamentos.length ? (
            <Vazio icon={History} titulo="Nenhum pagamento neste período" />
          ) : (
            <div className="ent-scroll">
              <table className="ent-tabela">
                <thead><tr><th>Data</th><th>Forma</th><th>Valor</th><th>Obs.</th><th></th></tr></thead>
                <tbody>
                  {historico.pagamentos.map((p) => (
                    <tr key={p.id}>
                      <td>{fmtData(p.data)}</td>
                      <td>{p.forma}</td>
                      <td><b>{fmtBRL(p.valor)}</b></td>
                      <td style={{ color: '#6B7280' }}>{p.obs || '—'}</td>
                      <td>
                        <button className="ent-mini neutro" style={{ color: '#B91C1C' }}
                          onClick={() => { estornar(p); setHistorico(null); }}>
                          Estornar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="ent-conf-tot" style={{ marginTop: 12 }}>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Devido {fmtBRL(historico.calc.total)} · Pago {fmtBRL(historico.pago)}
            </span>
            <strong>{fmtBRL(historico.saldo)}</strong>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>de saldo</span>
          </div>
        </ModalBase>
      )}

      <style>{RP_CSS}</style>
    </div>
  );
}

function CardRepasse({ linha, onPagar, onHistorico }) {
  const { motoboy, calc, pago, saldo, status, vencimento } = linha;
  const iniciais = (motoboy.nome || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  return (
    <div className="ent-conf">
      <div className="ent-conf-h">
        <div className="flex items-center gap-2 min-w-0">
          <div className="ent-mb-av" style={{ width: 34, height: 34 }}>{iniciais}</div>
          <div className="min-w-0">
            <div className="ent-conf-nome">{motoboy.nome}</div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {calc.qtdEntregas} entrega(s)
              {calc.qtdColetas > 0 && ` · ${calc.qtdColetas} coleta(s)`}
              {vencimento && ` · vence ${fmtData(vencimento)}`}
            </div>
          </div>
        </div>
        <Chip lista={REPASSE_STATUS} k={status} />
      </div>

      <div className="rp-linha">
        <div><small>Gerado</small><b>{fmtBRL(calc.total)}</b></div>
        <div><small>Pago</small><b style={{ color: '#047857' }}>{fmtBRL(pago)}</b></div>
        <div><small>Saldo</small><b style={{ color: saldo > 0 ? '#B91C1C' : '#047857' }}>{fmtBRL(saldo)}</b></div>
      </div>

      {calc.valorColetas > 0 && (
        <p className="ent-nota" style={{ marginTop: 10 }}>
          Entregas {fmtBRL(calc.valorEntregas)} · Coletas {fmtBRL(calc.valorColetas)}
        </p>
      )}

      <div className="ent-mb-acoes" style={{ marginTop: 12 }}>
        {saldo > 0 ? (
          <button className="btn btn-primary ent-b-sm" onClick={onPagar}>
            <Plus size={13} /> Registrar pagamento
          </button>
        ) : (
          <span className="ent-mini ok"><Check size={13} /> Quitado</span>
        )}
        <button className="btn btn-ghost ent-b-sm" onClick={onHistorico}>
          <History size={13} /> Histórico ({linha.pagamentos.length})
        </button>
      </div>
    </div>
  );
}

function FormPagamento({ linha, periodo, onSalvar, onCancelar }) {
  const [f, setF] = useState({
    valor: String(linha.saldo.toFixed(2)).replace('.', ','),
    data: new Date().toISOString().slice(0, 10),
    forma: 'PIX',
    obs: '',
  });

  return (
    <ModalBase titulo={`Pagamento — ${linha.motoboy.nome}`} onFechar={onCancelar}>
      <Aviso tipo="info">
        Devido {fmtBRL(linha.calc.total)} · já pago {fmtBRL(linha.pago)} · saldo {fmtBRL(linha.saldo)}
      </Aviso>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <Campo label="Valor (R$) *" dica="Pode ser parcial — o saldo continua registrado.">
          <input className="inp" inputMode="decimal" value={f.valor}
            onChange={(e) => setF({ ...f, valor: e.target.value })} />
        </Campo>
        <Campo label="Data *">
          <input className="inp" type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
        </Campo>
        <Campo label="Forma">
          <select className="inp" value={f.forma} onChange={(e) => setF({ ...f, forma: e.target.value })}>
            {FORMAS_REPASSE.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </Campo>
        <Campo label="Observação">
          <input className="inp" value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} />
        </Campo>
      </div>

      {linha.motoboy.pix && (
        <p className="ent-nota">Chave PIX cadastrada: <b>{linha.motoboy.pix}</b></p>
      )}
      <p className="ent-nota">
        <Lock size={12} style={{ display: 'inline', marginRight: 4 }} />
        Este pagamento vira uma saída já paga no Financeiro Empresa, categoria
        <b> {CAT_REPASSE_MOTOBOYS}</b>. O valor devido continua intacto — o saldo é calculado.
      </p>

      <div className="flex gap-2 justify-end mt-4">
        <button className="btn btn-ghost" onClick={onCancelar}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => onSalvar(f)}>Registrar pagamento</button>
      </div>
    </ModalBase>
  );
}

const RP_CSS = `
.rp-cards{ display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:10px; margin-top:14px; }
.rp-card{ background:#F9FAFB; border:1px solid #F1F2F4; border-radius:12px; padding:12px 13px; }
.rp-card.verde{ background:#ECFDF5; border-color:#D1FAE5; }
.rp-card.laranja{ background:#FFF7ED; border-color:#FFEDD5; }
.rp-card span{ display:block; font-size:19px; font-weight:700; letter-spacing:-.02em; color:#0B1324; }
.rp-card small{ font-size:11px; color:#6B7280; }
.rp-linha{ display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-top:12px; padding-top:11px; border-top:1px dashed #E5E7EB; }
.rp-linha small{ display:block; font-size:10.5px; text-transform:uppercase; letter-spacing:.04em; color:#9CA3AF; margin-bottom:2px; }
.rp-linha b{ font-size:16px; letter-spacing:-.01em; }
`;
