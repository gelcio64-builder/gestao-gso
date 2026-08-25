import { useMemo, useState } from 'react';
import {
  Package, Phone, Check, AlertTriangle, Plus, Warehouse, Filter,
} from 'lucide-react';
import {
  ModalBase, Campo, Vazio, Chip, Aviso, uidLocal, hojeISO, agoraHora, fmtData, fmtBRL,
} from './ui';
import {
  getConfigEntregas, snapshotColeta, statusConciliacao, divergenciaColeta,
  cobrancaDeUmaColeta, registrarHistorico, itensColeta, totalInformado, totalConfirmado,
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
        : <Historico {...{ coletas, lojistas, motoboys, bases, cfg, tarifas, setData }} />}

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

  // A confirmação vem por coleta e por marketplace: o lojista costuma
  // conferir separado ("saiu 30 do Mercado Livre e 12 da Amazon"), porque
  // os painéis dele são diferentes. E cada marketplace tem tarifa própria,
  // então o total sozinho não permitiria calcular a cobrança certa.
  function aprovar(grupo, confirmacoes, motivo) {
    const ids = grupo.itens.map((x) => x.id);

    setData((d) => ({
      ...d,
      entColetas: (d.entColetas || []).map((c) => {
        if (!ids.includes(c.id)) return c;
        const conf = confirmacoes[c.id] || {};
        const itens = itensColeta(c).map((i) => {
          const v = conf[i.plataforma];
          return {
            plataforma: i.plataforma,
            qtd: i.qtd,
            qtdConfirmada: v === '' || v == null ? i.qtd : Math.max(0, Math.round(Number(v) || 0)),
            tarifa: i.tarifa,
          };
        });
        const totalConf = itens.reduce((s, i) => s + i.qtdConfirmada, 0);
        const totalInf = itens.reduce((s, i) => s + i.qtd, 0);

        const comHist = registrarHistorico(c, {
          acao: 'conferência com o lojista',
          campo: 'quantidades',
          de: itensColeta(c).map((i) => ({ p: i.plataforma, q: i.qtd })),
          para: itens.map((i) => ({ p: i.plataforma, q: i.qtdConfirmada })),
          motivo: motivo || '',
        });

        const comItens = { ...comHist, itens };
        return {
          ...comItens,
          qtdConfirmada: totalConf,
          conciliacaoStatus: totalConf === totalInf ? 'conciliada' : 'divergente',
          // Carimba as tarifas vigentes agora, uma por marketplace. A partir
          // daqui, mexer na tabela não altera mais o valor desta coleta.
          snapshot: c.snapshot || snapshotColeta(comItens, tarifas, cfg),
          conferidoEm: new Date().toISOString(),
        };
      }),
    }));
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
  const nomeMotoboy = (id, fb) => motoboys.find((m) => m.id === id)?.nome || fb || 'Motoboy';

  // Estado inicial: assume que o lojista vai confirmar o que o motoboy disse.
  const [conf, setConf] = useState(() => {
    const base = {};
    grupo.itens.forEach((c) => {
      base[c.id] = {};
      itensColeta(c).forEach((i) => {
        base[c.id][i.plataforma] = String(i.qtdConfirmada == null ? i.qtd : i.qtdConfirmada);
      });
    });
    return base;
  });
  const [motivo, setMotivo] = useState('');

  const totalInf = grupo.itens.reduce((s, c) => s + totalInformado(c), 0);
  const totalConf = grupo.itens.reduce((s, c) => {
    const m = conf[c.id] || {};
    return s + itensColeta(c).reduce((t, i) => {
      const v = m[i.plataforma];
      return t + (v === '' || v == null ? i.qtd : Math.max(0, Math.round(Number(v) || 0)));
    }, 0);
  }, 0);
  const dif = totalConf - totalInf;

  // Soma por marketplace no dia, para o telefonema ficar simples.
  const porPlataforma = new Map();
  grupo.itens.forEach((c) => {
    itensColeta(c).forEach((i) => {
      porPlataforma.set(i.plataforma, (porPlataforma.get(i.plataforma) || 0) + i.qtd);
    });
  });

  function setQtd(coletaId, plataforma, valor) {
    setConf((p) => ({ ...p, [coletaId]: { ...(p[coletaId] || {}), [plataforma]: valor } }));
  }

  return (
    <div className="ent-conf">
      <div className="ent-conf-h">
        <div>
          <div className="ent-conf-nome">{lojista?.nome || 'Lojista removido'}</div>
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {fmtData(grupo.data)}{lojista?.telefone ? ` · ${lojista.telefone}` : ''}
            {grupo.itens.some((c) => c.retroativa) && ' · contém retirada retroativa'}
          </div>
        </div>
        {lojista?.telefone && (
          <a className="btn btn-ghost ent-b-sm" href={`tel:${String(lojista.telefone).replace(/\D/g, '')}`}>
            <Phone size={13} /> Ligar
          </a>
        )}
      </div>

      <div className="cf-resumo">
        <span className="cf-resumo-t">O que os motoboys informaram neste dia</span>
        {[...porPlataforma.entries()].map(([plat, qtd]) => (
          <span key={plat} className="cf-plat">{plat || 'Sem plataforma'} <b>{qtd}</b></span>
        ))}
      </div>

      {grupo.itens.map((c) => (
        <div key={c.id} className="cf-coleta">
          <div className="cf-coleta-h">
            <span>{nomeMotoboy(c.motoboyId, c.motoboyNome)}</span>
            <small>{c.hora || '—'}{c.retroativa ? ' · retroativa' : ''}</small>
          </div>
          {itensColeta(c).map((i) => {
            const v = (conf[c.id] || {})[i.plataforma];
            const num = v === '' || v == null ? i.qtd : Math.round(Number(v) || 0);
            const d = num - i.qtd;
            return (
              <div key={i.plataforma} className="cf-item">
                <span className="cf-item-p">{i.plataforma || 'Sem plataforma'}</span>
                <span className="cf-item-inf">informado <b>{i.qtd}</b></span>
                <input className="cf-item-in" inputMode="numeric" value={v}
                  onChange={(e) => setQtd(c.id, i.plataforma, e.target.value.replace(/\D/g, ''))} />
                {d !== 0 && <span className={`ent-dif ruim`}>{d > 0 ? `+${d}` : d}</span>}
              </div>
            );
          })}
        </div>
      ))}

      <div className="ent-conf-tot">
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Informado {totalInf} · confirmado
        </span>
        <strong>{totalConf}</strong>
        {dif !== 0 && <span className="ent-dif ruim">{dif > 0 ? `+${dif}` : dif}</span>}
      </div>

      {dif !== 0 && (
        <div className="mt-2">
          <Campo label="Motivo da diferença" dica="Fica registrado no histórico da coleta.">
            <input className="inp" value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: dois pacotes voltaram para a loja" />
          </Campo>
        </div>
      )}

      <div className="ent-mb-acoes" style={{ marginTop: 12 }}>
        <button className="btn btn-primary ent-b-sm" onClick={() => onAprovar(grupo, conf, motivo)}>
          <Check size={14} /> Aprovar conferência
        </button>
      </div>

      <style>{CF_CSS}</style>
    </div>
  );
}

const CF_CSS = `
.cf-resumo{ display:flex; flex-wrap:wrap; align-items:center; gap:7px; background:#F9FAFB; border-radius:11px; padding:10px 12px; margin:12px 0; }
.cf-resumo-t{ width:100%; font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:#9CA3AF; font-weight:600; }
.cf-plat{ font-size:12.5px; background:#fff; border:1px solid #E5E7EB; padding:4px 9px; border-radius:8px; color:#374151; }
.cf-plat b{ color:#0B1324; }
.cf-coleta{ border:1px solid #F1F2F4; border-radius:12px; padding:11px 12px; margin-bottom:9px; }
.cf-coleta-h{ display:flex; align-items:baseline; justify-content:space-between; gap:8px; margin-bottom:8px; }
.cf-coleta-h span{ font-size:13.5px; font-weight:600; }
.cf-coleta-h small{ font-size:11.5px; color:#9CA3AF; }
.cf-item{ display:flex; align-items:center; gap:9px; padding:6px 0; flex-wrap:wrap; }
.cf-item-p{ flex:1; min-width:120px; font-size:13px; color:#374151; }
.cf-item-inf{ font-size:12px; color:#9CA3AF; }
.cf-item-inf b{ color:#6B7280; }
.cf-item-in{ width:72px; padding:7px 9px; border:1px solid #D1D5DB; border-radius:9px; text-align:center; font-size:14.5px; font-weight:600; font-family:inherit; color:#0B1324; }
.cf-item-in:focus{ outline:none; border-color:var(--color-primary); }
`;

// ------------------------------------------------------------
//   Histórico
// ------------------------------------------------------------
function Historico({ coletas, lojistas, motoboys, bases, cfg, tarifas, setData }) {
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
              const cob = cobrancaDeUmaColeta(c, cfg, tarifas);
              return (
                <tr key={c.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtData(c.data)}<br />
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                      {c.hora}{c.retroativa ? ' · retro' : ''}
                    </span></td>
                  <td>{nome(lojistas, c.lojistaId, c.lojistaNome)}</td>
                  <td>{nome(motoboys, c.motoboyId, c.motoboyNome)}</td>
                  <td>{nome(bases, c.baseId, c.baseNome)}</td>
                  <td>
                    <b>{totalInformado(c)}</b>
                    {Array.isArray(c.itens) && c.itens.length > 1 && (
                      <div style={{ fontSize: 10.5, color: '#9CA3AF', marginTop: 2 }}>
                        {c.itens.filter((i) => i.qtd > 0)
                          .map((i) => `${String(i.plataforma).split('—')[0].trim()} ${i.qtd}`).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td>
                    {totalConfirmado(c) == null ? <span style={{ color: '#9CA3AF' }}>—</span> : <b>{totalConfirmado(c)}</b>}
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
    lojistaId: '', motoboyId: '', baseId: '', obs: '',
  });
  const [qtds, setQtds] = useState({});
  const [err, setErr] = useState('');

  const total = Object.values(qtds).reduce((s, v) => s + (Number(v) || 0), 0);

  function escolherLojista(id) {
    const l = lojistas.find((x) => x.id === id);
    setF((p) => ({ ...p, lojistaId: id, baseId: l?.baseId || p.baseId }));
  }

  function submit() {
    if (!f.lojistaId) { setErr('Escolha o lojista.'); return; }
    if (!f.motoboyId) { setErr('Escolha o motoboy.'); return; }
    if (!f.baseId) { setErr('Escolha a base de destino.'); return; }
    const itens = Object.entries(qtds)
      .map(([plataforma, qtd]) => ({ plataforma, qtd: Math.round(Number(qtd) || 0), qtdConfirmada: null, tarifa: null }))
      .filter((i) => i.qtd > 0);
    if (!itens.length) { setErr('Informe a quantidade de ao menos um marketplace.'); return; }

    const l = lojistas.find((x) => x.id === f.lojistaId);
    const m = motoboys.find((x) => x.id === f.motoboyId);
    const b = bases.find((x) => x.id === f.baseId);
    const hoje = hojeISO();

    onSalvar({
      id: uidLocal(),
      data: f.data, hora: f.hora,
      retroativa: f.data !== hoje,
      registradaEm: hoje,
      lojistaId: f.lojistaId, lojistaNome: l?.nome || '',
      itens,
      plataforma: itens.length === 1 ? itens[0].plataforma : 'Vários',
      qtdInformada: itens.reduce((s, i) => s + i.qtd, 0),
      motoboyId: f.motoboyId, motoboyNome: m?.nome || '', motoboyUid: '',
      baseId: f.baseId, baseNome: b?.nome || '',
      recebidoNaBase: false,
      qtdConfirmada: null,
      conciliacaoStatus: 'pendente',
      snapshot: null,
      fechamentoLojistaId: null, fechamentoMotoboyId: null,
      obs: f.obs, origem: 'painel',
      historico: [{ acao: 'criada no painel', qtd: total, itens, em: new Date().toISOString() }],
      criadoEm: new Date().toISOString(),
    });
  }

  return (
    <ModalBase largo titulo="Lançar coleta" onFechar={onCancelar}>
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
        <Campo label="Data da retirada *" dica="Use a data real da retirada, mesmo que o lançamento seja hoje.">
          <input className="inp" type="date" value={f.data} max={hojeISO()}
            onChange={(e) => setF({ ...f, data: e.target.value })} />
        </Campo>
        <Campo label="Hora">
          <input className="inp" type="time" value={f.hora} onChange={(e) => setF({ ...f, hora: e.target.value })} />
        </Campo>
      </div>

      <div className="lj-sec" style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #F1F2F4' }}>
        <h4 style={{ fontSize: 13, fontWeight: 650, margin: '0 0 3px' }}>Volumes por marketplace</h4>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 11px' }}>
          Cada marketplace tem tarifa própria, por isso a quebra é obrigatória.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {plataformas.map((plat) => (
            <label key={plat} className="lj-plat-row" style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
              border: '1px solid #E5E7EB', borderRadius: 11,
            }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5 }}>{plat}</span>
              <input className="inp" inputMode="numeric" style={{ width: 90, textAlign: 'center' }}
                value={qtds[plat] || ''} placeholder="0"
                onChange={(e) => setQtds({ ...qtds, [plat]: e.target.value.replace(/\D/g, '') })} />
            </label>
          ))}
          {!plataformas.length && (
            <p style={{ fontSize: 12.5, color: '#9CA3AF' }}>
              Nenhum marketplace cadastrado. Adicione em Configurações → Plataformas.
            </p>
          )}
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: 11, padding: '11px 13px', borderRadius: 11,
          background: total > 0 ? 'var(--color-primary)' : '#F3F4F6',
          color: total > 0 ? '#fff' : '#6B7280', fontSize: 13.5,
        }}>
          <span>Total da coleta</span>
          <strong style={{ fontSize: 20 }}>{total}</strong>
        </div>
      </div>

      <Campo label="Observações" span={2}>
        <input className="inp" value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} />
      </Campo>

      {err && <div className="ent-erro"><AlertTriangle size={14} /> {err}</div>}
      <div className="flex gap-2 justify-end mt-4">
        <button className="btn btn-ghost" onClick={onCancelar}>Cancelar</button>
        <button className="btn btn-primary" onClick={submit}>Salvar coleta</button>
      </div>
    </ModalBase>
  );
}
