import { useState } from 'react';
import { Plus, X, Save, Info } from 'lucide-react';
import { Campo, uidLocal } from './ui';
import { getConfigEntregas } from './engine';
import {
  MODO_PAGAMENTO, MODO_PAGAMENTO_LABEL,
  BASE_ENTREGA, BASE_ENTREGA_LABEL,
  BASE_COLETA, BASE_COLETA_LABEL,
  CICLOS,
} from './constants';

// ============================================================
//   CONFIGURAÇÕES DO MÓDULO
// ------------------------------------------------------------
//   Dois documentos separados por segurança:
//     entConfig/operacional → o motoboy lê (regiões, plataformas)
//     entConfig/comercial   → só a gestão (tarifas, ciclo, prazos)
//
//   Nada de valor fica fixo no código. O modo de pagamento em
//   particular existe porque cada transportadora paga diferente:
//   umas só pela entrega, outras pela coleta e pela entrega.
// ============================================================

export default function ConfigEntregas({ data, setData }) {
  const cfg = getConfigEntregas(data.entConfig);
  const [op, setOp] = useState(cfg.operacional);
  const [co, setCo] = useState(cfg.comercial);
  const [novaRegiao, setNovaRegiao] = useState('');
  const [novaPlataforma, setNovaPlataforma] = useState('');
  const [salvo, setSalvo] = useState(false);

  function salvar() {
    setData((d) => {
      const lista = d.entConfig || [];
      const upsert = (arr, doc) =>
        arr.some((x) => x.id === doc.id) ? arr.map((x) => (x.id === doc.id ? doc : x)) : [...arr, doc];
      let out = upsert(lista, { ...op, id: 'operacional' });
      out = upsert(out, { ...co, id: 'comercial' });
      return { ...d, entConfig: out };
    });
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2500);
  }

  const num = (v) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; };

  function addRegiao() {
    const nome = novaRegiao.trim();
    if (!nome) return;
    if ((op.regioes || []).some((r) => r.nome.toLowerCase() === nome.toLowerCase())) { setNovaRegiao(''); return; }
    setOp((p) => ({ ...p, regioes: [...(p.regioes || []), { id: uidLocal(), nome, ativo: true }] }));
    setNovaRegiao('');
  }
  function addPlataforma() {
    const nome = novaPlataforma.trim();
    if (!nome || (op.plataformas || []).includes(nome)) { setNovaPlataforma(''); return; }
    setOp((p) => ({ ...p, plataformas: [...(p.plataformas || []), nome] }));
    setNovaPlataforma('');
  }

  const modoDuplo = co.modoPagamento === MODO_PAGAMENTO.COLETA_ENTREGA;

  return (
    <div className="space-y-4">
      <Secao titulo="Pagamento aos motoboys"
        sub="Como a empresa remunera a equipe. Vale como padrão; dá para ajustar por motoboy.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Campo label="Modelo de pagamento" span={2}
            dica="No modelo por entrega, a coleta está embutida no valor pago pela entrega.">
            <select className="inp" value={co.modoPagamento}
              onChange={(e) => setCo({ ...co, modoPagamento: e.target.value })}>
              {Object.values(MODO_PAGAMENTO).map((m) => (
                <option key={m} value={m}>{MODO_PAGAMENTO_LABEL[m]}</option>
              ))}
            </select>
          </Campo>

          <Campo label="Valor por entrega (R$)">
            <input className="inp" inputMode="decimal" value={co.tarifaEntregaPadrao}
              onChange={(e) => setCo({ ...co, tarifaEntregaPadrao: e.target.value })} placeholder="6,50" />
          </Campo>

          {modoDuplo && (
            <Campo label="Valor por coleta (R$)">
              <input className="inp" inputMode="decimal" value={co.tarifaColetaPadrao}
                onChange={(e) => setCo({ ...co, tarifaColetaPadrao: e.target.value })} placeholder="2,00" />
            </Campo>
          )}

          <Campo label="Pagar entregas por" span={modoDuplo ? 1 : 2}
            dica="O sistema guarda sempre os dois números; isto define qual vira dinheiro.">
            <select className="inp" value={co.baseEntrega}
              onChange={(e) => setCo({ ...co, baseEntrega: e.target.value })}>
              {Object.values(BASE_ENTREGA).map((b) => (
                <option key={b} value={b}>{BASE_ENTREGA_LABEL[b]}</option>
              ))}
            </select>
          </Campo>

          {modoDuplo && (
            <Campo label="Pagar coletas por">
              <select className="inp" value={co.baseColeta}
                onChange={(e) => setCo({ ...co, baseColeta: e.target.value })}>
                {Object.values(BASE_COLETA).map((b) => (
                  <option key={b} value={b}>{BASE_COLETA_LABEL[b]}</option>
                ))}
              </select>
            </Campo>
          )}
        </div>
        <p className="ent-nota">
          <Info size={12} style={{ display: 'inline', marginRight: 4 }} />
          Trocar estes valores <b>não</b> recalcula o passado: cada coleta e cada rota guarda a tarifa
          vigente no dia em que foi criada.
        </p>
      </Secao>

      <Secao titulo="Cobrança dos lojistas"
        sub="Padrão da empresa. Cada lojista pode ter tarifa própria na aba Lojistas.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Campo label="Valor por volume (R$)">
            <input className="inp" inputMode="decimal" value={co.tarifaLojistaPadrao}
              onChange={(e) => setCo({ ...co, tarifaLojistaPadrao: e.target.value })} placeholder="10,00" />
          </Campo>
          <Campo label="Valor mínimo por coleta (R$)" dica="Protege coletas pequenas e distantes.">
            <input className="inp" inputMode="decimal" value={co.valorMinimoPadrao}
              onChange={(e) => setCo({ ...co, valorMinimoPadrao: e.target.value })} placeholder="0,00" />
          </Campo>
          <Campo label="Base de cálculo da cobrança" span={2}
            dica="O recomendado é cobrar pelo que o lojista confirmou — é o número que ele aceita pagar.">
            <select className="inp" value={co.baseColeta}
              onChange={(e) => setCo({ ...co, baseColeta: e.target.value })}>
              {Object.values(BASE_COLETA).map((b) => (
                <option key={b} value={b}>{BASE_COLETA_LABEL[b]}</option>
              ))}
            </select>
          </Campo>
        </div>
      </Secao>

      <Secao titulo="Fechamento" sub="Períodos de apuração e prazos de pagamento.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Campo label="Ciclo">
            <select className="inp" value={co.ciclo} onChange={(e) => setCo({ ...co, ciclo: e.target.value })}>
              {CICLOS.map((c) => <option key={c.k} value={c.k}>{c.label}</option>)}
            </select>
          </Campo>
          <Campo label="Dia da cobrança">
            <input className="inp" inputMode="numeric" value={co.diaCobranca}
              onChange={(e) => setCo({ ...co, diaCobranca: e.target.value })} />
          </Campo>
          <Campo label="Prazo de pagamento (dias)">
            <input className="inp" inputMode="numeric" value={co.prazoPagamentoDias}
              onChange={(e) => setCo({ ...co, prazoPagamentoDias: e.target.value })} />
          </Campo>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <Marcar checked={!!co.bloquearFechamentoComPendencia}
            onChange={(v) => setCo({ ...co, bloquearFechamentoComPendencia: v })}
            label="Avisar antes de fechar quando houver coleta sem conferência" />
          <Marcar checked={!!co.exigirJustificativaTarifa}
            onChange={(v) => setCo({ ...co, exigirJustificativaTarifa: v })}
            label="Exigir motivo ao alterar uma tarifa já definida" />
        </div>
      </Secao>

      <Secao titulo="Regiões" sub="Usadas na triagem e na distribuição das rotas.">
        <div className="flex gap-2 mb-3">
          <input className="inp" value={novaRegiao} onChange={(e) => setNovaRegiao(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRegiao()} placeholder="Ex.: Osasco" />
          <button className="btn btn-primary" onClick={addRegiao}><Plus size={15} /></button>
        </div>
        <div className="flex flex-wrap gap-2">
          {!(op.regioes || []).length && <span className="text-xs" style={{ color: '#9CA3AF' }}>Nenhuma região cadastrada.</span>}
          {(op.regioes || []).map((r) => (
            <span key={r.id} className="ent-mini ok">
              {r.nome}
              <button onClick={() => setOp((p) => ({ ...p, regioes: p.regioes.filter((x) => x.id !== r.id) }))}
                style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'inherit', padding: 0, marginLeft: 2 }}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      </Secao>

      <Secao titulo="Plataformas" sub="Marketplaces atendidos. Dá para acrescentar novos a qualquer momento.">
        <div className="flex gap-2 mb-3">
          <input className="inp" value={novaPlataforma} onChange={(e) => setNovaPlataforma(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPlataforma()} placeholder="Ex.: Amazon Flex" />
          <button className="btn btn-primary" onClick={addPlataforma}><Plus size={15} /></button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(op.plataformas || []).map((p) => (
            <span key={p} className="ent-mini ok">
              {p}
              <button onClick={() => setOp((s) => ({ ...s, plataformas: s.plataformas.filter((x) => x !== p) }))}
                style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'inherit', padding: 0, marginLeft: 2 }}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      </Secao>

      <Secao titulo="Comprovantes" sub="Regras para o envio de comprovante pelo motoboy.">
        <Marcar checked={!!op.comprovanteObrigatorio}
          onChange={(v) => setOp({ ...op, comprovanteObrigatorio: v })}
          label="Exigir comprovante para concluir uma rota" />
      </Secao>

      <div className="flex items-center justify-end gap-3">
        {salvo && <span className="text-sm" style={{ color: '#047857' }}>Configurações salvas</span>}
        <button className="btn btn-primary" onClick={() => {
          salvar();
        }}><Save size={15} /> Salvar configurações</button>
      </div>
    </div>
  );

  function Secao({ titulo, sub, children }) {
    return (
      <div className="card p-4">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{titulo}</h3>
        {sub && <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>{sub}</p>}
        {children}
      </div>
    );
  }
}

function Marcar({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-text)' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
