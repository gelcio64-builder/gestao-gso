import { useMemo, useState } from 'react';
import {
  FileText, Download, Send, Check, Wallet, History, TrendingUp, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ModalBase, Campo, Vazio, Chip, Aviso, ModalConfirma, uidLocal, fmtData, fmtBRL } from './ui';
import {
  getConfigEntregas, historicoLojista, historicoRepasses, detalheRotasExtrato,
  somaRecebimentos, saldoFechamento, statusFechamentoLojista, dataQuitacao, idDocumento,
} from './engine';
import { FECHAMENTO_STATUS, REPASSE_STATUS, FORMAS_REPASSE } from './constants';
import { gerarCobrancaPDF } from '../pdf/cobranca';
import { gerarExtratoRepassePDF } from '../pdf/extrato';

// ============================================================
//   CONTA CORRENTE
// ------------------------------------------------------------
//   Duas visões novas sobre dados que JÁ EXISTEM. Nenhuma
//   apuração nova é feita aqui: o histórico do lojista lê os
//   mesmos fechamentos da aba Fechamentos, e o do motoboy usa
//   exatamente a mesma função da aba Repasses.
//
//   Fonte única de verdade: registrar um pagamento em Repasses
//   muda o histórico aqui no mesmo instante, porque é o mesmo
//   documento sendo lido.
// ============================================================

export function dadosEmpresaPDF(data, company) {
  return {
    nome: data?.config?.nomeEmpresa || company?.nome || 'Gestão GSO',
    logoUrl: data?.config?.logoUrl || '',
    cnpj: data?.config?.cnpj || '',
    telefone: data?.config?.telefone || '',
    endereco: data?.config?.endereco || '',
    cidade: data?.config?.cidade || '',
    uf: data?.config?.uf || '',
    emailContato: data?.config?.emailContato || '',
    corPrimaria: (typeof document !== 'undefined'
      ? getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim()
      : '') || '#0B1533',
    pixCobranca: data?.config?.pixCobranca || '',
  };
}

// ------------------------------------------------------------
//   Histórico financeiro do LOJISTA
// ------------------------------------------------------------
export function HistoricoLojista({ lojista, data, setData, onFechar }) {
  const auth = useAuth() || {};
  const fechamentos = Array.isArray(data?.entFechamentos) ? data.entFechamentos : [];
  const linhas = useMemo(() => historicoLojista(lojista.id, fechamentos), [lojista.id, fechamentos]);
  const [recebendo, setRecebendo] = useState(null);
  const [estornoAlvo, setEstornoAlvo] = useState(null);
  const [erro, setErro] = useState('');

  const totais = linhas.reduce((a, l) => ({
    faturado: a.faturado + (Number(l.total) || 0),
    recebido: a.recebido + l.pago,
    aberto: a.aberto + Math.max(0, l.saldo),
  }), { faturado: 0, recebido: 0, aberto: 0 });

  // O recebimento entra dentro do próprio fechamento. O total NUNCA é
  // reduzido — o saldo é derivado, e é isso que preserva a auditoria.
  // A conta a receber no Financeiro só é baixada quando quita, porque é
  // ela que responde "quanto ainda tenho a receber".
  function registrarRecebimento(fech, dados) {
    setErro('');
    const valor = Number(String(dados.valor).replace(',', '.'));
    if (!Number.isFinite(valor) || valor <= 0) { setErro('Informe um valor válido.'); return; }
    const saldo = saldoFechamento(fech);
    if (valor > saldo + 0.009) { setErro(`O valor passa do saldo em aberto (${fmtBRL(saldo)}).`); return; }

    const rec = {
      id: uidLocal(),
      valor,
      data: dados.data,
      forma: dados.forma,
      obs: dados.obs || '',
      registradoEm: new Date().toISOString(),
    };

    setData((d) => {
      const lista = (d.entFechamentos || []).map((f) =>
        f.id === fech.id ? { ...f, recebimentos: [...(f.recebimentos || []), rec] } : f);
      const atualizado = lista.find((f) => f.id === fech.id);
      const quitou = somaRecebimentos(atualizado) >= (Number(atualizado.total) || 0) - 0.009;

      return {
        ...d,
        entFechamentos: lista,
        finEmpresa: (d.finEmpresa || []).map((x) =>
          x.fechamentoId === fech.id && quitou
            ? { ...x, status: 'pago', dataPagamento: dados.data, forma: dados.forma }
            : x),
      };
    });
    setRecebendo(null);
  }

  function estornar(fech, rec) {
    setData((d) => ({
      ...d,
      entFechamentos: (d.entFechamentos || []).map((f) =>
        f.id === fech.id
          ? { ...f, recebimentos: (f.recebimentos || []).filter((r) => r.id !== rec.id) }
          : f),
      finEmpresa: (d.finEmpresa || []).map((x) =>
        x.fechamentoId === fech.id ? { ...x, status: 'pendente', dataPagamento: '' } : x),
    }));
  }

  async function baixarPDF(f) {
    try {
      await gerarCobrancaPDF(
        { ...f, numero: f.numero || idDocumento('COB', lojista.id, f.periodoChave) },
        lojista,
        dadosEmpresaPDF(data, auth.company)
      );
    } catch (e) {
      console.error('[pdf]', e);
      setErro(`Não foi possível gerar o PDF — ${e?.message || e}`);
    }
  }

  function compartilhar(f) {
    const tel = String(lojista.telefone || '').replace(/\D/g, '');
    const msg =
      `Olá, ${lojista.nome}!\n\n`
      + `Demonstrativo de coletas ${fmtData(f.inicio)} a ${fmtData(f.fim)}:\n`
      + `Volumes: ${f.qtdTotal}\n`
      + `Total: ${fmtBRL(f.total)}\n`
      + (f.saldo > 0 && f.pago > 0 ? `Já recebido: ${fmtBRL(f.pago)}\nSaldo: ${fmtBRL(f.saldo)}\n` : '')
      + (f.vencimento ? `Vencimento: ${fmtData(f.vencimento)}\n` : '');
    window.open(
      tel ? `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`
          : `https://wa.me/?text=${encodeURIComponent(msg)}`,
      '_blank'
    );
  }

  return (
    <ModalBase largo titulo={`Histórico financeiro — ${lojista.nome}`} onFechar={onFechar}>
      <div className="cc-cards">
        <div className="cc-card"><small>Faturado</small><b>{fmtBRL(totais.faturado)}</b></div>
        <div className="cc-card verde"><small>Recebido</small><b>{fmtBRL(totais.recebido)}</b></div>
        <div className="cc-card laranja"><small>Em aberto</small><b>{fmtBRL(totais.aberto)}</b></div>
      </div>

      {erro && <div className="ent-erro"><AlertTriangle size={14} /> {erro}</div>}

      {!linhas.length ? (
        <Vazio icon={FileText} titulo="Nenhum fechamento ainda"
          sub="Os períodos aparecem aqui depois que você fechar e cobrar na aba Fechamentos." />
      ) : (
        <div className="cc-linha-lista">
          {linhas.map((f) => (
            <div key={f.id} className="cc-linha">
              <div className="cc-linha-h">
                <div>
                  <div className="cc-periodo">{fmtData(f.inicio)} a {fmtData(f.fim)}</div>
                  <div className="cc-sub">
                    {f.qtdTotal} volumes · {fmtBRL(f.tarifaMedia)} por volume
                  </div>
                </div>
                <Chip lista={FECHAMENTO_STATUS} k={f.situacao} />
              </div>

              <div className="cc-vals">
                <div><small>Total</small><b>{fmtBRL(f.total)}</b></div>
                <div><small>Recebido</small><b style={{ color: '#047857' }}>{fmtBRL(f.pago)}</b></div>
                <div><small>Saldo</small>
                  <b style={{ color: f.saldo > 0 ? '#B91C1C' : '#047857' }}>{fmtBRL(f.saldo)}</b>
                </div>
              </div>

              <div className="cc-datas">
                {f.vencimento && <span>Vence {fmtData(f.vencimento)}</span>}
                {f.quitadoEm && <span style={{ color: '#047857' }}>Pago em {fmtData(f.quitadoEm)}</span>}
              </div>

              {!!(f.recebimentos || []).length && (
                <div className="cc-recs">
                  {f.recebimentos.map((r) => (
                    <div key={r.id} className="cc-rec">
                      <span>{fmtData(r.data)} · {r.forma}</span>
                      <b>{fmtBRL(r.valor)}</b>
                      <button onClick={() => setEstornoAlvo({ fech: f, rec: r })}>Estornar</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="ent-mb-acoes">
                {f.saldo > 0 && (
                  <button className="btn btn-primary ent-b-sm" onClick={() => setRecebendo(f)}>
                    <Check size={13} /> Registrar recebimento
                  </button>
                )}
                <button className="btn btn-ghost ent-b-sm" onClick={() => baixarPDF(f)}>
                  <Download size={13} /> PDF
                </button>
                <button className="btn btn-ghost ent-b-sm" onClick={() => compartilhar(f)}>
                  <Send size={13} /> Compartilhar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {estornoAlvo && (
        <ModalConfirma
          titulo="Estornar recebimento"
          rotulo="Estornar"
          mensagem={
            `Estornar ${fmtBRL(estornoAlvo.rec.valor)} recebidos em ${fmtData(estornoAlvo.rec.data)}? `
            + 'A conta a receber no Financeiro Empresa volta a ficar pendente.'
          }
          onCancelar={() => setEstornoAlvo(null)}
          onConfirmar={() => { estornar(estornoAlvo.fech, estornoAlvo.rec); setEstornoAlvo(null); }}
        />
      )}
      {recebendo && (
        <FormRecebimento fech={recebendo} lojista={lojista}
          onSalvar={(d) => registrarRecebimento(recebendo, d)}
          onCancelar={() => setRecebendo(null)} />
      )}

      <style>{CC_CSS}</style>
    </ModalBase>
  );
}

function FormRecebimento({ fech, lojista, onSalvar, onCancelar }) {
  const saldo = saldoFechamento(fech);
  const [f, setF] = useState({
    valor: String(saldo.toFixed(2)).replace('.', ','),
    data: new Date().toISOString().slice(0, 10),
    forma: 'PIX',
    obs: '',
  });

  return (
    <ModalBase titulo={`Recebimento — ${lojista.nome}`} onFechar={onCancelar}>
      <Aviso tipo="info">
        Fechamento de {fmtData(fech.inicio)} a {fmtData(fech.fim)} · total {fmtBRL(fech.total)} ·
        saldo {fmtBRL(saldo)}
      </Aviso>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <Campo label="Valor (R$) *" dica="Pode ser parcial — o saldo continua registrado.">
          <input className="inp" inputMode="decimal" value={f.valor}
            onChange={(e) => setF({ ...f, valor: e.target.value })} />
        </Campo>
        <Campo label="Data *">
          <input className="inp" type="date" value={f.data}
            onChange={(e) => setF({ ...f, data: e.target.value })} />
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
      <p className="ent-nota">
        A conta a receber no Financeiro Empresa é baixada quando o fechamento for quitado por
        completo. Enquanto houver saldo, ela continua em aberto lá.
      </p>
      <div className="flex gap-2 justify-end mt-4">
        <button className="btn btn-ghost" onClick={onCancelar}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => onSalvar(f)}>Registrar</button>
      </div>
    </ModalBase>
  );
}

// ------------------------------------------------------------
//   Histórico de repasses do MOTOBOY
// ------------------------------------------------------------
export function HistoricoMotoboy({ motoboy, data, onFechar }) {
  const auth = useAuth() || {};
  const cfg = getConfigEntregas(data?.entConfig).comercial;
  const coletas = Array.isArray(data?.entColetas) ? data.entColetas : [];
  const rotas = Array.isArray(data?.entRotas) ? data.entRotas : [];
  const pagamentos = Array.isArray(data?.entPagamentos) ? data.entPagamentos : [];
  const bases = Array.isArray(data?.entBases) ? data.entBases : [];
  const [meses, setMeses] = useState(6);
  // 'quinzena' mostra cada período do ciclo; 'mes' junta as quinzenas do
  // mesmo mês numa linha só, para quem prefere enxergar o fechamento mensal.
  const [agrupar, setAgrupar] = useState('quinzena');
  const [erro, setErro] = useState('');

  // Mesma função que alimenta a aba Repasses — não há segunda apuração.
  const linhas = useMemo(() => historicoRepasses({
    motoboyId: motoboy.id, coletas, rotas, pagamentos, cfgComercial: cfg, mesesParaTras: meses,
  }), [motoboy.id, coletas, rotas, pagamentos, cfg, meses]);

  const exibidas = useMemo(() => {
    if (agrupar === 'quinzena') return linhas;
    const mapa = new Map();
    linhas.forEach((l) => {
      const k = `${l.ano}-${String(l.mes).padStart(2, '0')}`;
      if (!mapa.has(k)) {
        mapa.set(k, {
          ...l,
          agrupado: true,
          periodo: {
            chave: `${k}-MES`,
            label: 'Mês inteiro',
            inicio: `${k}-01`,
            fim: l.periodo.fim,
          },
          calc: { ...l.calc },
          rotas: [...l.rotas],
          pagamentos: [...l.pagamentos],
        });
        return;
      }
      const g = mapa.get(k);
      g.calc = {
        ...g.calc,
        qtdEntregas: g.calc.qtdEntregas + l.calc.qtdEntregas,
        qtdColetas: g.calc.qtdColetas + l.calc.qtdColetas,
        valorEntregas: g.calc.valorEntregas + l.calc.valorEntregas,
        valorColetas: g.calc.valorColetas + l.calc.valorColetas,
        total: g.calc.total + l.calc.total,
      };
      g.rotas = [...g.rotas, ...l.rotas];
      g.pagamentos = [...g.pagamentos, ...l.pagamentos];
      g.pago += l.pago;
      g.saldo += l.saldo;
      g.periodo.inicio = l.periodo.inicio < g.periodo.inicio ? l.periodo.inicio : g.periodo.inicio;
      g.periodo.fim = l.periodo.fim > g.periodo.fim ? l.periodo.fim : g.periodo.fim;
      // Tarifa média recalculada sobre o mês todo.
      g.tarifaMedia = g.calc.qtdEntregas > 0
        ? Math.round((g.calc.valorEntregas / g.calc.qtdEntregas) * 100) / 100 : 0;
      g.situacao = g.saldo <= 0.009 ? 'pago' : (g.pago > 0 ? 'parcial' : 'pendente');
    });
    return [...mapa.values()].sort((a, b) => String(b.periodo.inicio).localeCompare(String(a.periodo.inicio)));
  }, [linhas, agrupar]);

  const totais = linhas.reduce((a, l) => ({
    gerado: a.gerado + l.calc.total,
    pago: a.pago + l.pago,
    saldo: a.saldo + Math.max(0, l.saldo),
  }), { gerado: 0, pago: 0, saldo: 0 });

  async function extrato(l) {
    try {
      await gerarExtratoRepassePDF(
        {
          numero: idDocumento('EXT', motoboy.id, l.periodo.chave),
          periodoLabel: l.periodo.label,
          inicio: l.periodo.inicio,
          fim: l.periodo.fim,
          vencimento: l.vencimento,
          qtdEntregas: l.calc.qtdEntregas,
          valorEntregas: l.calc.valorEntregas,
          qtdColetas: l.calc.qtdColetas,
          valorColetas: l.calc.valorColetas,
          total: l.calc.total,
          pago: l.pago,
          saldo: l.saldo,
          situacao: l.situacao,
          // Uma linha por rota, com a tarifa carimbada na época.
          linhas: detalheRotasExtrato(l.rotas, cfg),
          pagamentos: l.pagamentos,
        },
        {
          ...motoboy,
          baseNome: bases.find((b) => b.id === motoboy.baseId)?.nome || '',
        },
        dadosEmpresaPDF(data, auth.company)
      );
    } catch (e) {
      console.error('[extrato]', e);
      setErro(`Não foi possível gerar o extrato — ${e?.message || e}`);
    }
  }

  function enviar(l) {
    const tel = String(motoboy.telefone || '').replace(/\D/g, '');
    const msg =
      `Olá, ${String(motoboy.nome || '').split(' ')[0]}!\n\n`
      + `Seu extrato de ${fmtData(l.periodo.inicio)} a ${fmtData(l.periodo.fim)}:\n`
      + `Entregas: ${l.calc.qtdEntregas}\n`
      + `Total gerado: ${fmtBRL(l.calc.total)}\n`
      + `Já pago: ${fmtBRL(l.pago)}\n`
      + `Saldo: ${fmtBRL(l.saldo)}\n\n`
      + `O extrato detalhado segue em anexo.`;
    window.open(
      tel ? `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`
          : `https://wa.me/?text=${encodeURIComponent(msg)}`,
      '_blank'
    );
  }

  return (
    <ModalBase largo titulo={`Histórico de repasses — ${motoboy.nome}`} onFechar={onFechar}>
      <div className="cc-cards">
        <div className="cc-card"><small>Total gerado</small><b>{fmtBRL(totais.gerado)}</b></div>
        <div className="cc-card verde"><small>Já pago</small><b>{fmtBRL(totais.pago)}</b></div>
        <div className="cc-card laranja"><small>Saldo a pagar</small><b>{fmtBRL(totais.saldo)}</b></div>
      </div>

      {erro && <div className="ent-erro"><AlertTriangle size={14} /> {erro}</div>}

      <div className="flex gap-2 mb-3 flex-wrap items-center">
        {[3, 6, 12].map((m) => (
          <button key={m} className={`ent-tab${meses === m ? ' on' : ''}`} onClick={() => setMeses(m)}
            style={{ padding: '5px 11px', fontSize: 12 }}>
            {m} meses
          </button>
        ))}
        <span style={{ width: 1, height: 20, background: '#E5E7EB', margin: '0 2px' }} />
        {[['quinzena', 'Por quinzena'], ['mes', 'Mensal']].map(([k, rot]) => (
          <button key={k} className={`ent-tab${agrupar === k ? ' on' : ''}`} onClick={() => setAgrupar(k)}
            style={{ padding: '5px 11px', fontSize: 12 }}>
            {rot}
          </button>
        ))}
      </div>

      {!exibidas.length ? (
        <Vazio icon={Wallet} titulo="Nenhum período com movimento"
          sub="As quinzenas aparecem aqui conforme as rotas de entrega forem criadas." />
      ) : (
        <div className="cc-linha-lista">
          {exibidas.map((l) => (
            <div key={l.periodo.chave} className="cc-linha">
              <div className="cc-linha-h">
                <div>
                  <div className="cc-periodo">{fmtData(l.periodo.inicio)} a {fmtData(l.periodo.fim)}</div>
                  <div className="cc-sub">
                    {l.calc.qtdEntregas} entregas
                    {l.tarifaMedia > 0 && ` · ${fmtBRL(l.tarifaMedia)} por entrega`}
                    {l.calc.qtdColetas > 0 && ` · ${l.calc.qtdColetas} coletas`}
                  </div>
                </div>
                <Chip lista={REPASSE_STATUS} k={l.situacao} />
              </div>

              <div className="cc-vals">
                <div><small>Gerado</small><b>{fmtBRL(l.calc.total)}</b></div>
                <div><small>Pago</small><b style={{ color: '#047857' }}>{fmtBRL(l.pago)}</b></div>
                <div><small>Saldo</small>
                  <b style={{ color: l.saldo > 0 ? '#B91C1C' : '#047857' }}>{fmtBRL(l.saldo)}</b>
                </div>
              </div>

              {!!l.pagamentos.length && (
                <div className="cc-recs">
                  {l.pagamentos.map((p) => (
                    <div key={p.id} className="cc-rec">
                      <span>{fmtData(p.data)} · {p.forma}</span>
                      <b>{fmtBRL(p.valor)}</b>
                    </div>
                  ))}
                </div>
              )}

              <div className="ent-mb-acoes">
                <button className="btn btn-primary ent-b-sm" onClick={() => extrato(l)}>
                  <Download size={13} /> Extrato PDF
                </button>
                <button className="btn btn-ghost ent-b-sm" onClick={() => enviar(l)}>
                  <Send size={13} /> Enviar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="ent-nota">
        <TrendingUp size={12} style={{ display: 'inline', marginRight: 4 }} />
        Os pagamentos são registrados na aba <b>Repasses</b>. Esta tela lê exatamente os mesmos
        dados — o que você lançar lá aparece aqui na hora.
      </p>

      <style>{CC_CSS}</style>
    </ModalBase>
  );
}

const CC_CSS = `
.cc-cards{ display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:10px; margin-bottom:14px; }
.cc-card{ background:#F9FAFB; border:1px solid #F1F2F4; border-radius:12px; padding:11px 13px; }
.cc-card.verde{ background:#ECFDF5; border-color:#D1FAE5; }
.cc-card.laranja{ background:#FFF7ED; border-color:#FFEDD5; }
.cc-card small{ display:block; font-size:10.5px; text-transform:uppercase; letter-spacing:.04em; color:#9CA3AF; margin-bottom:2px; }
.cc-card b{ font-size:17px; letter-spacing:-.01em; color:#0B1324; }

.cc-linha-lista{ display:flex; flex-direction:column; gap:11px; }
.cc-linha{ border:1px solid #E5E7EB; border-radius:14px; padding:13px 14px; }
.cc-linha-h{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
.cc-periodo{ font-size:14.5px; font-weight:650; color:#0B1324; }
.cc-sub{ font-size:12px; color:#6B7280; margin-top:2px; }
.cc-vals{ display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-top:11px; padding-top:10px; border-top:1px dashed #E5E7EB; }
.cc-vals small{ display:block; font-size:10.5px; text-transform:uppercase; letter-spacing:.04em; color:#9CA3AF; margin-bottom:2px; }
.cc-vals b{ font-size:15.5px; letter-spacing:-.01em; }
.cc-datas{ display:flex; gap:12px; flex-wrap:wrap; margin-top:9px; font-size:11.5px; color:#6B7280; }
.cc-recs{ margin-top:10px; background:#F9FAFB; border-radius:10px; padding:8px 10px; display:flex; flex-direction:column; gap:5px; }
.cc-rec{ display:flex; align-items:center; gap:9px; font-size:12px; color:#6B7280; }
.cc-rec b{ margin-left:auto; color:#047857; }
.cc-rec button{ background:transparent; border:0; color:#B91C1C; font-size:11.5px; cursor:pointer; font-family:inherit; text-decoration:underline; }
`;
