import { useMemo, useState } from 'react';
import {
  Warehouse, Bike, Check, Plus, Trash2, AlertTriangle, Package, ArrowRight,
} from 'lucide-react';
import { ModalBase, Campo, Vazio, Chip, Aviso, uidLocal, hojeISO, fmtData } from './ui';
import { getConfigEntregas, snapshotRota, qtdCobravelColeta, totalInformado } from './engine';
import { ROTA_STATUS } from './constants';

// ============================================================
//   BASE & TRIAGEM
// ------------------------------------------------------------
//   Duas etapas numa tela só, porque na prática acontecem juntas:
//
//   1. RECEBIMENTO — marcar que os pacotes chegaram na base.
//      Enquanto não chegam, não há o que separar.
//
//   2. DISTRIBUIÇÃO — depois de separar por região, criar a rota
//      de cada motoboy com a quantidade que ele leva.
//
//   A rota nasce com a tarifa carimbada. Se o dono mudar o valor
//   por entrega depois, esta rota continua valendo o de hoje.
// ============================================================

export default function Triagem({ data, setData }) {
  const cfg = getConfigEntregas(data?.entConfig);
  const coletas = Array.isArray(data?.entColetas) ? data.entColetas : [];
  const rotas = Array.isArray(data?.entRotas) ? data.entRotas : [];
  const motoboys = Array.isArray(data?.entMotoboys) ? data.entMotoboys : [];
  const bases = Array.isArray(data?.entBases) ? data.entBases : [];
  const lojistas = Array.isArray(data?.entLojistas) ? data.entLojistas : [];
  const tarifas = Array.isArray(data?.entTarifas) ? data.entTarifas : [];
  const regioes = cfg.operacional.regioes || [];

  const [dia, setDia] = useState(hojeISO());
  const [novaRota, setNovaRota] = useState(null);
  const [erro, setErro] = useState('');

  const doDia = useMemo(() => coletas.filter((c) => c.data === dia), [coletas, dia]);
  const aReceber = doDia.filter((c) => !c.recebidoNaBase);
  const recebidas = doDia.filter((c) => c.recebidoNaBase);
  const rotasDoDia = useMemo(() => rotas.filter((r) => r.data === dia), [rotas, dia]);

  const volumesNaBase = recebidas.reduce((s, c) => s + qtdCobravelColeta(c, cfg.comercial), 0);
  const volumesDistribuidos = rotasDoDia.reduce((s, r) => s + (Number(r.qtdAtribuida) || 0), 0);
  const aDistribuir = Math.max(0, volumesNaBase - volumesDistribuidos);

  function receber(c) {
    setData((d) => ({
      ...d,
      entColetas: (d.entColetas || []).map((x) =>
        x.id === c.id ? { ...x, recebidoNaBase: true, recebidoEm: new Date().toISOString() } : x),
    }));
  }

  function receberTodas() {
    const ids = aReceber.map((c) => c.id);
    setData((d) => ({
      ...d,
      entColetas: (d.entColetas || []).map((x) =>
        ids.includes(x.id) ? { ...x, recebidoNaBase: true, recebidoEm: new Date().toISOString() } : x),
    }));
  }

  function criarRota(item) {
    setErro('');
    const m = motoboys.find((x) => x.id === item.motoboyId);
    const b = bases.find((x) => x.id === item.baseId);
    const rota = {
      id: uidLocal(),
      data: dia,
      motoboyId: item.motoboyId,
      motoboyUid: m?.uid || '',
      motoboyNome: m?.nome || '',
      regiao: item.regiao || '',
      baseId: item.baseId,
      baseNome: b?.nome || '',
      qtdAtribuida: item.quantidade,
      qtdConcluida: 0,
      qtdOcorrencia: 0,
      status: 'atribuida',
      // Tarifa congelada no momento da atribuição.
      snapshot: snapshotRota(item.motoboyId, tarifas, cfg.comercial),
      fechamentoId: null,
      obs: item.obs || '',
      historico: [{ acao: 'rota criada', qtd: item.quantidade, em: new Date().toISOString() }],
      criadoEm: new Date().toISOString(),
    };
    setData((d) => ({ ...d, entRotas: [...(d.entRotas || []), rota] }));
    setNovaRota(null);
  }

  function excluirRota(r) {
    if (r.fechamentoId) { setErro('Rota já incluída num fechamento não pode ser excluída.'); return; }
    setData((d) => ({ ...d, entRotas: (d.entRotas || []).filter((x) => x.id !== r.id) }));
  }

  const nomeLojista = (c) => lojistas.find((l) => l.id === c.lojistaId)?.nome || c.lojistaNome || 'Loja';

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>Base & Triagem</h2>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Receba os pacotes na base e distribua as rotas por região
            </p>
          </div>
          <input className="inp" type="date" style={{ maxWidth: 170 }}
            value={dia} onChange={(e) => setDia(e.target.value)} />
        </div>

        <div className="ent-fluxo">
          <div className="ent-fx">
            <span className="ent-fx-n">{aReceber.reduce((s, c) => s + totalInformado(c), 0)}</span>
            <span className="ent-fx-l">A receber</span>
          </div>
          <ArrowRight size={16} style={{ color: '#D1D5DB' }} />
          <div className="ent-fx">
            <span className="ent-fx-n">{volumesNaBase}</span>
            <span className="ent-fx-l">Na base</span>
          </div>
          <ArrowRight size={16} style={{ color: '#D1D5DB' }} />
          <div className="ent-fx">
            <span className="ent-fx-n">{volumesDistribuidos}</span>
            <span className="ent-fx-l">Distribuídos</span>
          </div>
          <ArrowRight size={16} style={{ color: '#D1D5DB' }} />
          <div className="ent-fx destaque">
            <span className="ent-fx-n">{aDistribuir}</span>
            <span className="ent-fx-l">Aguardando rota</span>
          </div>
        </div>
      </div>

      {erro && <div className="ent-erro"><AlertTriangle size={14} /> {erro}</div>}

      {/* ---- Recebimento ---- */}
      <div className="card p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            Recebimento na base
          </h3>
          {!!aReceber.length && (
            <button className="btn btn-primary ent-b-sm" onClick={receberTodas}>
              <Check size={13} /> Receber todas
            </button>
          )}
        </div>

        {!doDia.length ? (
          <Vazio icon={Package} titulo="Nenhuma coleta neste dia"
            sub="Escolha outra data ou aguarde os registros dos motoboys." />
        ) : !aReceber.length ? (
          <Aviso tipo="info">Todos os pacotes deste dia já foram recebidos na base.</Aviso>
        ) : (
          <div className="ent-scroll">
            <table className="ent-tabela">
              <thead>
                <tr><th>Lojista</th><th>Motoboy</th><th>Base</th><th>Volumes</th><th></th></tr>
              </thead>
              <tbody>
                {aReceber.map((c) => (
                  <tr key={c.id}>
                    <td>{nomeLojista(c)}</td>
                    <td>{c.motoboyNome || '—'}</td>
                    <td>{c.baseNome || '—'}</td>
                    <td><b>{totalInformado(c)}</b></td>
                    <td>
                      <button className="ent-mini ok" onClick={() => receber(c)}>
                        <Warehouse size={12} /> Receber
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- Distribuição ---- */}
      <div className="card p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              Distribuição das rotas
            </h3>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Depois de separar por região, atribua a cada motoboy
            </p>
          </div>
          <button className="btn btn-primary ent-b-sm"
            onClick={() => setNovaRota({ baseId: bases[0]?.id || '', quantidade: '' })}>
            <Plus size={13} /> Nova rota
          </button>
        </div>

        {!rotasDoDia.length ? (
          <Vazio icon={Bike} titulo="Nenhuma rota criada neste dia"
            sub="Crie uma rota para cada motoboy que sair para entregar." />
        ) : (
          <div className="ent-grid">
            {rotasDoDia.map((r) => {
              const atrib = Number(r.qtdAtribuida) || 0;
              const feito = Number(r.qtdConcluida) || 0;
              const pct = atrib > 0 ? Math.round((feito / atrib) * 100) : 0;
              return (
                <div key={r.id} className="ent-card-mb">
                  <div className="ent-mb-head">
                    <div className="ent-mb-av"><Bike size={16} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="ent-mb-nome">{r.motoboyNome || 'Motoboy'}</div>
                      <div className="ent-mb-sub">{r.regiao || 'Sem região'} · {r.baseNome}</div>
                    </div>
                    <Chip lista={ROTA_STATUS} k={r.status || 'atribuida'} />
                  </div>

                  <div className="ent-conf-tot" style={{ marginTop: 11, borderTop: 0, paddingTop: 0 }}>
                    <strong>{feito}/{atrib}</strong>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>entregues</span>
                    {(Number(r.qtdOcorrencia) || 0) > 0 && (
                      <span className="ent-dif ruim">{r.qtdOcorrencia} ocorrência(s)</span>
                    )}
                  </div>
                  <div className="mb-barra" style={{ marginTop: 8 }}>
                    <div className="mb-barra-in" style={{ width: `${pct}%` }} />
                  </div>

                  {!r.fechamentoId && (
                    <div className="ent-mb-acoes">
                      <button className="btn btn-ghost ent-b-sm ent-b-del" onClick={() => excluirRota(r)}>
                        <Trash2 size={13} /> Excluir
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {novaRota && (
        <FormRota item={novaRota} motoboys={motoboys} bases={bases} regioes={regioes}
          maximo={aDistribuir} onSalvar={criarRota} onCancelar={() => setNovaRota(null)} />
      )}

      <style>{TRIAGEM_CSS}</style>
    </div>
  );
}

function FormRota({ item, motoboys, bases, regioes, maximo, onSalvar, onCancelar }) {
  const [f, setF] = useState({
    motoboyId: '', regiao: '', baseId: item.baseId || '', quantidade: '', obs: '',
  });
  const [err, setErr] = useState('');

  // Escolher o motoboy já traz a região e a base dele.
  function escolherMotoboy(id) {
    const m = motoboys.find((x) => x.id === id);
    setF((p) => ({
      ...p,
      motoboyId: id,
      regiao: m?.regiao || p.regiao,
      baseId: m?.baseId || p.baseId,
    }));
  }

  function submit() {
    if (!f.motoboyId) { setErr('Escolha o motoboy.'); return; }
    if (!f.baseId) { setErr('Escolha a base de origem.'); return; }
    const q = Math.round(Number(f.quantidade) || 0);
    if (q <= 0) { setErr('Informe a quantidade de volumes.'); return; }
    onSalvar({ ...f, quantidade: q });
  }

  const ativos = motoboys.filter((m) => m.status !== 'inativo');

  return (
    <ModalBase titulo="Nova rota de entrega" onFechar={onCancelar}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Campo label="Motoboy *" span={2}>
          <select className="inp" value={f.motoboyId} onChange={(e) => escolherMotoboy(e.target.value)}>
            <option value="">Selecione</option>
            {ativos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </Campo>
        <Campo label="Região">
          {regioes.length ? (
            <select className="inp" value={f.regiao} onChange={(e) => setF({ ...f, regiao: e.target.value })}>
              <option value="">—</option>
              {regioes.map((r) => <option key={r.id || r.nome} value={r.nome}>{r.nome}</option>)}
            </select>
          ) : (
            <input className="inp" value={f.regiao} onChange={(e) => setF({ ...f, regiao: e.target.value })}
              placeholder="Ex.: Osasco" />
          )}
        </Campo>
        <Campo label="Base de origem *">
          <select className="inp" value={f.baseId} onChange={(e) => setF({ ...f, baseId: e.target.value })}>
            <option value="">Selecione</option>
            {bases.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
          </select>
        </Campo>
        <Campo label="Volumes atribuídos *"
          dica={maximo > 0 ? `${maximo} volume(s) aguardando rota neste dia.` : undefined}>
          <input className="inp" inputMode="numeric" value={f.quantidade}
            onChange={(e) => setF({ ...f, quantidade: e.target.value })} placeholder="30" />
        </Campo>
        <Campo label="Observações">
          <input className="inp" value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} />
        </Campo>
      </div>
      <p className="ent-nota">
        A tarifa por entrega é congelada agora. Mudanças futuras na tabela não afetam esta rota.
      </p>
      {err && <div className="ent-erro">{err}</div>}
      <div className="flex gap-2 justify-end mt-4">
        <button className="btn btn-ghost" onClick={onCancelar}>Cancelar</button>
        <button className="btn btn-primary" onClick={submit}>Criar rota</button>
      </div>
    </ModalBase>
  );
}

const TRIAGEM_CSS = `
.ent-fluxo{ display:flex; align-items:center; gap:10px; overflow-x:auto; padding:4px 0; }
.ent-fx{ flex:1; min-width:96px; background:#F9FAFB; border:1px solid #F1F2F4; border-radius:12px; padding:11px 12px; }
.ent-fx.destaque{ background:#EFF6FF; border-color:#BFDBFE; }
.ent-fx-n{ display:block; font-size:21px; font-weight:700; letter-spacing:-.02em; color:#0B1324; }
.ent-fx-l{ font-size:11px; color:#6B7280; }
.mb-barra{ height:6px; background:#F1F2F4; border-radius:999px; overflow:hidden; }
.mb-barra-in{ height:100%; background:var(--color-accent,#1D4ED8); border-radius:999px; transition:width .3s ease; }
`;
