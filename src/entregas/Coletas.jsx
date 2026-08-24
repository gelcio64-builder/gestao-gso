import { useMemo, useState } from 'react';
import {
  Package, Phone, Check, AlertTriangle, Plus, Warehouse, Filter,
} from 'lucide-react';
import {
  ModalBase, Campo, Vazio, Chip, Aviso, uidLocal, hojeISO, agoraHora, fmtData, fmtBRL,
} from './ui';
import {
  getConfigEntregas, snapshotColeta, statusConciliacao, divergenciaColeta,
  cobrancaDeUmaColeta, registrarHistorico,
} from './engine';
import { COLETA_STATUS } from './constants';

// ============================================================
//   COLETAS — visão da gestão
// ------------------------------------------------------------
//   Duas abas:
//     Conferência → agrupa por lojista e por dia. É aqui que o
//       dono liga para a loja, confirma a quantidade e aprova.
//       É este passo que substitui o grupo de WhatsApp.
//     Histórico   → todas as coletas, com filtro.
//
//   A tarifa é carimbada no momento da aprovação: o motoboy não
//   tem acesso de leitura à tabela de tarifas, então não pode
//   carimbar nada na hora de registrar.
// ============================================================

export default function Coletas({ data, setData }) {
  const [vista, setVista] = useState('conferencia');
  const coletas = Array.isArray(data.entColetas) ? data.entColetas : [];
  const lojistas = Array.isArray(data.entLojistas) ? data.entLojistas : [];
  const motoboys = Array.isArray(data.entMotoboys) ? data.entMotoboys : [];
  const bases = Array.isArray(data.entBases) ? data.entBases : [];
  const tarifas = Array.isArray(data.entTarifas) ? data.entTarifas : [];
  const cfg = getConfigEntregas(data.entConfig).comercial;
  const plataformas = getConfigEntregas(data.entConfig).operacional.plataformas || [];

  const [novo, setNovo] = useState(null);

  const pendentes = coletas.filter((c) => statusConciliacao(c) === 'pendente');

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>Coletas</h2>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Retiradas nos lojistas e conferência das quantidades
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setNovo({})}>
            <Plus size={15} /> Lançar coleta
          </button>
        </div>

        <div className="flex gap-2 mb-1">
          <button className={`ent-tab${vista === 'conferencia' ? ' on' : ''}`} onClick={() => setVista('conferencia')}>
            Conferência {pendentes.length > 0 && <span className="ent-breve">{pendentes.length}</span>}
          </button>
          <button className={`ent-tab${vista === 'historico' ? ' on' : ''}`} onClick={() => setVista('historico')}>
            Histórico
          </button>
        </div>
      </div>

      {vista === 'conferencia'
        ? <Conferencia {...{ data, setData, coletas, lojistas, motoboys, tarifas, cfg }} />
        : <Historico {...{ coletas, lojistas, motoboys, bases, cfg, setData }} />}

      {novo && (
        <FormColetaManual
          lojistas={lojistas} motoboys={motoboys} bases={bases} plataformas={plataformas}
          onCancelar={() => setNovo(null)}
          onSalvar={(item) => {
            setData((d) => ({ ...d, entColetas: [...(d.entColetas || []), item] }));
            setNovo(null);
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------
//   Conferência
// ------------------------------------------------------------
function Conferencia({ data, setData, coletas, lojistas, motoboys, tarifas, cfg }) {
  const pendentes = coletas.filter((c) => statusConciliacao(c) === 'pendente');

  // Agrupa por lojista + dia: o dono liga uma vez e confirma o total
  // do dia, não coleta por coleta.
  const grupos = useMemo(() => {
    const mapa = new Map();
    pendentes.forEach((c) => {
      const chave = `${c.lojistaId}__${c.data}`;
      if (!mapa.has(chave)) mapa.set(chave, { lojistaId: c.lojistaId, data: c.data, itens: [] });
      mapa.get(chave).itens.push(c);
    });
    return [...mapa.values()].sort((a, b) => String(b.data).localeCompare(String(a.data)));
  }, [pendentes]);

  function aprovar(grupo, qtdConfirmadaTotal, motivo) {
    const total = grupo.itens.reduce((s, c) => s + (Number(c.qtdInformada) || 0), 0);
    const confirmado = Math.round(Number(qtdConfirmadaTotal) || 0);

    setData((d) => {
      const lista = d.entColetas || [];
      // Distribui o total confirmado entre as coletas do grupo, na
      // proporção do que cada motoboy informou. Sobras vão para a
      // última coleta, para o somatório fechar exato.
      let restante = confirmado;
      const ids = grupo.itens.map((x) => x.id);
      const ajustes = new Map();
      grupo.itens.forEach((c, i) => {
        const inf = Number(c.qtdInformada) || 0;
        let parte;
        if (i === grupo.itens.length - 1) parte = restante;
        else {
          parte = total > 0 ? Math.round((inf / total) * confirmado) : 0;
          restante -= parte;
        }
        ajustes.set(c.id, Math.max(0, parte));
      });

      return {
        ...d,
        entColetas: lista.map((c) => {
          if (!ids.includes(c.id)) return c;
          const qtdConfirmada = ajustes.get(c.id);
          const comHist = registrarHistorico(c, {
            acao: 'conferência com o lojista',
            campo: 'qtdConfirmada',
            de: c.qtdConfirmada,
            para: qtdConfirmada,
            motivo: motivo || '',
          });
          return {
            ...comHist,
            qtdConfirmada,
            conciliacaoStatus: qtdConfirmada === (Number(c.qtdInformada) || 0) ? 'conciliada' : 'divergente',
            // Carimba a tarifa vigente agora. A partir daqui, mudar a
            // tabela não altera mais o valor desta coleta.
            snapshot: c.snapshot || snapshotColeta(c.lojistaId, c.motoboyId, tarifas, cfg),
            conferidoEm: new Date().toISOString(),
          };
        }),
      };
    });
  }

  if (!grupos.length) {
    return (
      <div className="card p-4">
        <Vazio icon={Check} titulo="Nada pendente de conferência"
          sub="Assim que um motoboy registrar uma coleta, ela aparece aqui para você confirmar com o lojista." />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Aviso tipo="info">
        Ligue para o lojista, pergunte quantos volumes saíram no dia e informe o número abaixo.
        O sistema guarda os dois valores e sinaliza a diferença.
      </Aviso>
      {grupos.map((g) => (
        <CardConferencia key={`${g.lojistaId}__${g.data}`} grupo={g}
          lojista={lojistas.find((l) => l.id === g.lojistaId)}
          motoboys={motoboys}
          onAprovar={aprovar} />
      ))}
    </div>
  );
}

function CardConferencia({ grupo, lojista, motoboys, onAprovar }) {
  const total = grupo.itens.reduce((s, c) => s + (Number(c.qtdInformada) || 0), 0);
  const [valor, setValor] = useState(String(total));
  const [motivo, setMotivo] = useState('');
  const confirmado = Math.round(Number(valor) || 0);
  const dif = confirmado - total;
  const nomeMotoboy = (id, fallback) => motoboys.find((m) => m.id === id)?.nome || fallback || 'Motoboy';

  return (
    <div className="ent-conf">
      <div className="ent-conf-h">
        <div>
          <div className="ent-conf-nome">{lojista?.nome || 'Lojista removido'}</div>
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {fmtData(grupo.data)}{lojista?.telefone ? ` · ${lojista.telefone}` : ''}
          </div>
        </div>
        {lojista?.telefone && (
          <a className="btn btn-ghost ent-b-sm" href={`tel:${String(lojista.telefone).replace(/\D/g, '')}`}>
            <Phone size={13} /> Ligar
          </a>
        )}
      </div>

      <div className="ent-conf-linhas">
        {grupo.itens.map((c) => (
          <div key={c.id} className="ent-conf-l">
            <span>{nomeMotoboy(c.motoboyId, c.motoboyNome)}</span>
            <b>{c.qtdInformada}</b>
            <span style={{ color: '#9CA3AF' }}>volumes · {c.hora || '—'}</span>
          </div>
        ))}
      </div>

      <div className="ent-conf-tot">
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Informado pelos motoboys</span>
        <strong>{total}</strong>
      </div>

      <div className="ent-conf-form">
        <Campo label="Confirmado pelo lojista">
          <input className="inp" inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value)} />
        </Campo>
        {dif !== 0 && (
          <span className={`ent-dif ${dif === 0 ? 'ok' : 'ruim'}`}>
            {dif > 0 ? `+${dif}` : dif} de diferença
          </span>
        )}
        <button className="btn btn-primary" onClick={() => onAprovar(grupo, valor, motivo)}>
          <Check size={14} /> Aprovar
        </button>
      </div>

      {dif !== 0 && (
        <div className="mt-2">
          <Campo label="Motivo da diferença" dica="Fica registrado no histórico da coleta.">
            <input className="inp" value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: dois pacotes voltaram para a loja" />
          </Campo>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
//   Histórico
// ------------------------------------------------------------
function Historico({ coletas, lojistas, motoboys, bases, cfg, setData }) {
  const [filtro, setFiltro] = useState('todas');

  const lista = useMemo(() => {
    const ord = [...coletas].sort((a, b) =>
      `${b.data} ${b.hora || ''}`.localeCompare(`${a.data} ${a.hora || ''}`));
    if (filtro === 'todas') return ord;
    return ord.filter((c) => statusConciliacao(c) === filtro);
  }, [coletas, filtro]);

  const nome = (arr, id, fb) => arr.find((x) => x.id === id)?.nome || fb || '—';

  function marcarRecebida(c) {
    setData((d) => ({
      ...d,
      entColetas: (d.entColetas || []).map((x) =>
        x.id === c.id ? { ...x, recebidoNaBase: !x.recebidoNaBase } : x),
    }));
  }

  if (!coletas.length) {
    return (
      <div className="card p-4">
        <Vazio icon={Package} titulo="Nenhuma coleta registrada"
          sub="As retiradas lançadas pelos motoboys aparecem aqui." />
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Filter size={14} style={{ color: '#9CA3AF' }} />
        {['todas', 'pendente', 'conciliada', 'divergente'].map((k) => (
          <button key={k} className={`ent-tab${filtro === k ? ' on' : ''}`} onClick={() => setFiltro(k)}
            style={{ padding: '5px 11px', fontSize: 12 }}>
            {k === 'todas' ? 'Todas' : (COLETA_STATUS.find((s) => s.k === k)?.label || k)}
          </button>
        ))}
      </div>

      <div className="ent-scroll">
        <table className="ent-tabela">
          <thead>
            <tr>
              <th>Data</th><th>Lojista</th><th>Motoboy</th><th>Base</th>
              <th>Informado</th><th>Confirmado</th><th>Situação</th><th>Cobrança</th><th></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => {
              const st = statusConciliacao(c);
              const dif = divergenciaColeta(c);
              const cob = cobrancaDeUmaColeta(c, cfg);
              return (
                <tr key={c.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtData(c.data)}<br />
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>{c.hora}</span></td>
                  <td>{nome(lojistas, c.lojistaId, c.lojistaNome)}</td>
                  <td>{nome(motoboys, c.motoboyId, c.motoboyNome)}</td>
                  <td>{nome(bases, c.baseId, c.baseNome)}</td>
                  <td><b>{c.qtdInformada ?? '—'}</b></td>
                  <td>
                    {c.qtdConfirmada == null ? <span style={{ color: '#9CA3AF' }}>—</span> : <b>{c.qtdConfirmada}</b>}
                    {dif != null && dif !== 0 && (
                      <span className="ent-dif ruim" style={{ marginLeft: 6 }}>{dif > 0 ? `+${dif}` : dif}</span>
                    )}
                  </td>
                  <td><Chip lista={COLETA_STATUS} k={st} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {fmtBRL(cob.total)}
                    {cob.usouMinimo && <span className="ent-tag-pad" style={{ marginLeft: 5 }}>mínimo</span>}
                  </td>
                  <td>
                    <button className={`ent-mini ${c.recebidoNaBase ? 'ok' : 'neutro'}`}
                      onClick={() => marcarRecebida(c)} title="Marcar recebimento na base">
                      <Warehouse size={12} /> {c.recebidoNaBase ? 'Na base' : 'Receber'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
//   Lançamento manual (quando o motoboy não usa o app)
// ------------------------------------------------------------
function FormColetaManual({ lojistas, motoboys, bases, plataformas, onSalvar, onCancelar }) {
  const [f, setF] = useState({
    data: hojeISO(), hora: agoraHora(),
    lojistaId: '', motoboyId: '', baseId: '', plataforma: '', quantidade: '', obs: '',
  });
  const [err, setErr] = useState('');

  // Escolher a loja já traz a base e a plataforma dela — o operador
  // pode trocar, mas na maioria das vezes não precisa mexer.
  function escolherLojista(id) {
    const l = lojistas.find((x) => x.id === id);
    setF((p) => ({
      ...p,
      lojistaId: id,
      baseId: l?.baseId || p.baseId,
      plataforma: l?.plataforma || p.plataforma,
    }));
  }

  function submit() {
    if (!f.lojistaId) { setErr('Escolha o lojista.'); return; }
    if (!f.motoboyId) { setErr('Escolha o motoboy.'); return; }
    if (!f.baseId) { setErr('Escolha a base de destino.'); return; }
    const qtd = Math.round(Number(f.quantidade) || 0);
    if (qtd <= 0) { setErr('Informe a quantidade de volumes.'); return; }

    const l = lojistas.find((x) => x.id === f.lojistaId);
    const m = motoboys.find((x) => x.id === f.motoboyId);
    const b = bases.find((x) => x.id === f.baseId);

    onSalvar({
      id: uidLocal(),
      data: f.data, hora: f.hora,
      lojistaId: f.lojistaId, lojistaNome: l?.nome || '',
      plataforma: f.plataforma || l?.plataforma || '',
      motoboyId: f.motoboyId, motoboyNome: m?.nome || '', motoboyUid: m?.uid || '',
      baseId: f.baseId, baseNome: b?.nome || '',
      recebidoNaBase: false,
      qtdInformada: qtd, qtdConfirmada: null,
      conciliacaoStatus: 'pendente',
      snapshot: null,
      fechamentoLojistaId: null, fechamentoMotoboyId: null,
      obs: f.obs, origem: 'painel',
      historico: [{ acao: 'criada no painel', qtd, em: new Date().toISOString() }],
      criadoEm: new Date().toISOString(),
    });
  }

  return (
    <ModalBase titulo="Lançar coleta" onFechar={onCancelar}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Campo label="Lojista *" span={2}>
          <select className="inp" value={f.lojistaId} onChange={(e) => escolherLojista(e.target.value)}>
            <option value="">Selecione</option>
            {lojistas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </Campo>
        <Campo label="Motoboy *">
          <select className="inp" value={f.motoboyId} onChange={(e) => setF({ ...f, motoboyId: e.target.value })}>
            <option value="">Selecione</option>
            {motoboys.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </Campo>
        <Campo label="Base de destino *">
          <select className="inp" value={f.baseId} onChange={(e) => setF({ ...f, baseId: e.target.value })}>
            <option value="">Selecione</option>
            {bases.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
          </select>
        </Campo>
        <Campo label="Plataforma">
          <select className="inp" value={f.plataforma} onChange={(e) => setF({ ...f, plataforma: e.target.value })}>
            <option value="">—</option>
            {plataformas.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Campo>
        <Campo label="Volumes *">
          <input className="inp" inputMode="numeric" value={f.quantidade}
            onChange={(e) => setF({ ...f, quantidade: e.target.value })} placeholder="40" />
        </Campo>
        <Campo label="Data">
          <input className="inp" type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
        </Campo>
        <Campo label="Hora">
          <input className="inp" type="time" value={f.hora} onChange={(e) => setF({ ...f, hora: e.target.value })} />
        </Campo>
        <Campo label="Observações" span={2}>
          <input className="inp" value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} />
        </Campo>
      </div>
      {err && <div className="ent-erro"><AlertTriangle size={14} /> {err}</div>}
      <div className="flex gap-2 justify-end mt-4">
        <button className="btn btn-ghost" onClick={onCancelar}>Cancelar</button>
        <button className="btn btn-primary" onClick={submit}>Salvar coleta</button>
      </div>
    </ModalBase>
  );
}
