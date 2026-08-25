import { useMemo, useState } from 'react';
import { Store, Plus, Pencil, Trash2, Search, Coins, History } from 'lucide-react';
import {
  ModalBase, Campo, ModalConfirma, Vazio, Aviso, uidLocal, fmtBRL,
} from './ui';
import { getConfigEntregas, tarifaDoLojista, registrarHistorico, todayISO } from './engine';
import { PLATAFORMAS_PADRAO } from './constants';
import { HistoricoLojista } from './ContaCorrente';

// ============================================================
//   LOJISTAS
// ------------------------------------------------------------
//   Cadastro dividido em dois lugares, de propósito:
//     entLojistas → dados operacionais (o motoboy lê)
//     entTarifas  → valores (o motoboy nunca lê)
//   O Firestore não faz segurança por campo: se a tarifa morasse
//   no doc do lojista, ler o lojista seria ler a tarifa.
// ============================================================

export default function Lojistas({ data, setData }) {
  const cfg = getConfigEntregas(data.entConfig).comercial;
  const lojistas = Array.isArray(data.entLojistas) ? data.entLojistas : [];
  const bases = Array.isArray(data.entBases) ? data.entBases : [];
  const tarifas = Array.isArray(data.entTarifas) ? data.entTarifas : [];
  const plataformas = getConfigEntregas(data.entConfig).operacional.plataformas || PLATAFORMAS_PADRAO;

  const [busca, setBusca] = useState('');
  const [form, setForm] = useState(null);
  const [tarifaAlvo, setTarifaAlvo] = useState(null);
  const [delAlvo, setDelAlvo] = useState(null);
  const [histAlvo, setHistAlvo] = useState(null);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = [...lojistas].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    if (!q) return base;
    return base.filter((l) =>
      (l.nome || '').toLowerCase().includes(q) ||
      (l.regiao || '').toLowerCase().includes(q) ||
      (l.plataforma || '').toLowerCase().includes(q)
    );
  }, [lojistas, busca]);

  function salvar(item) {
    const novo = !item.id;
    const reg = { ...item, id: item.id || uidLocal(), status: item.status || 'ativo' };
    setData((d) => ({
      ...d,
      entLojistas: novo
        ? [...(d.entLojistas || []), reg]
        : (d.entLojistas || []).map((x) => (x.id === reg.id ? reg : x)),
    }));
    setForm(null);
  }

  function excluir(l) {
    setData((d) => ({
      ...d,
      entLojistas: (d.entLojistas || []).filter((x) => x.id !== l.id),
      entTarifas: (d.entTarifas || []).filter((t) => !(t.tipo === 'lojista' && t.refId === l.id)),
    }));
    setDelAlvo(null);
  }

  // A tarifa nunca é sobrescrita em silêncio: o valor anterior vai
  // para o histórico com autor, data e motivo. É o que permite
  // explicar depois por que um fechamento saiu diferente do outro.
  function salvarTarifa(lojistaId, { valorPacote, valorMinimo, porPlataforma, motivo }) {
    setData((d) => {
      const lista = d.entTarifas || [];
      const atual = lista.find((t) => t.tipo === 'lojista' && t.refId === lojistaId);
      const anterior = atual
        ? { valorPacote: atual.valorPacote, valorMinimo: atual.valorMinimo, porPlataforma: atual.porPlataforma || {} }
        : null;
      const registrado = registrarHistorico(atual || {}, {
        acao: atual ? 'tarifa alterada' : 'tarifa definida',
        campo: 'tarifa',
        de: anterior,
        para: { valorPacote, valorMinimo, porPlataforma },
        motivo,
      });
      const novo = {
        ...registrado,
        id: atual?.id || uidLocal(),
        tipo: 'lojista',
        refId: lojistaId,
        valorPacote,
        valorMinimo,
        porPlataforma,
        vigenciaInicio: todayISO(),
      };
      return {
        ...d,
        entTarifas: atual ? lista.map((t) => (t.id === novo.id ? novo : t)) : [...lista, novo],
      };
    });
    setTarifaAlvo(null);
  }

  return (
    <>
      <style>{LJ_CSS}</style>
      <div className="card p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>Lojistas</h2>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Quem gera os pacotes. Só quem está aqui aparece para o motoboy escolher.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setForm({})}><Plus size={15} /> Novo lojista</button>
        </div>

        <div className="ent-busca">
          <Search size={15} />
          <input className="inp" placeholder="Buscar por nome, região ou plataforma"
            value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>

        {!bases.length && (
          <Aviso tipo="alerta">
            Cadastre ao menos uma base antes — é para lá que o motoboy leva os pacotes.
          </Aviso>
        )}

        {!filtrados.length ? (
          <Vazio icon={Store} titulo="Nenhum lojista cadastrado"
            sub="Cadastre as lojas que a transportadora atende." />
        ) : (
          <div className="ent-grid">
            {filtrados.map((l) => {
              const t = tarifaDoLojista(l.id, null, tarifas, cfg);
              const base = bases.find((b) => b.id === l.baseId);
              return (
                <div key={l.id} className="ent-card-mb">
                  <div className="ent-mb-head">
                    <div className="ent-mb-av" style={{ background: '#1D4ED8' }}>
                      <Store size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="ent-mb-nome" title={l.nome}>{l.nome || 'Sem nome'}</div>
                      <div className="ent-mb-sub">{l.plataforma || 'Sem plataforma'}</div>
                    </div>
                    <span className={`ent-status ${l.status === 'inativo' ? 'off' : 'on'}`}>
                      {l.status === 'inativo' ? 'Inativo' : 'Ativo'}
                    </span>
                  </div>

                  <div className="ent-mb-pix">
                    {l.regiao || 'Sem região'}{base ? ` · ${base.nome}` : ''}
                  </div>

                  <div className="ent-tarifa" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 5 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Coins size={14} />
                      <b>{fmtBRL(t.valorPacote)}</b> por volume
                      <span style={{ color: '#9CA3AF', fontSize: 11 }}>(geral)</span>
                      {t.valorMinimo > 0 && <span>· mín. <b>{fmtBRL(t.valorMinimo)}</b></span>}
                      {!t.personalizada && <span className="ent-tag-pad">padrão</span>}
                    </span>
                    {Object.keys(t.porPlataforma || {}).length > 0 && (
                      <span style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {Object.entries(t.porPlataforma).map(([plat, val]) => (
                          <span key={plat} className="lj-plat">
                            {plat.split('—')[0].trim()} <b>{fmtBRL(val)}</b>
                          </span>
                        ))}
                      </span>
                    )}
                  </div>

                  <div className="ent-mb-acoes">
                    <button className="btn btn-primary ent-b-sm" onClick={() => setHistAlvo(l)}>
                      <History size={13} /> Histórico
                    </button>
                    <button className="btn btn-ghost ent-b-sm" onClick={() => setTarifaAlvo(l)}>
                      <Coins size={13} /> Tarifa
                    </button>
                    <button className="btn btn-ghost ent-b-sm" onClick={() => setForm(l)}><Pencil size={13} /></button>
                    <button className="btn btn-ghost ent-b-sm ent-b-del" onClick={() => setDelAlvo(l)}><Trash2 size={13} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {form && (
        <FormLojista item={form} bases={bases} plataformas={plataformas}
          onSalvar={salvar} onCancelar={() => setForm(null)} />
      )}
      {tarifaAlvo && (
        <FormTarifa lojista={tarifaAlvo} atual={tarifaDoLojista(tarifaAlvo.id, null, tarifas, cfg)} cfg={cfg}
          plataformas={plataformas}
          onSalvar={(v) => salvarTarifa(tarifaAlvo.id, v)} onCancelar={() => setTarifaAlvo(null)} />
      )}
      {histAlvo && (
        <HistoricoLojista lojista={histAlvo} data={data} setData={setData}
          onFechar={() => setHistAlvo(null)} />
      )}
      {delAlvo && (
        <ModalConfirma titulo="Excluir lojista"
          mensagem={`Remover ${delAlvo.nome || 'este lojista'}? As coletas já registradas continuam no histórico.`}
          onCancelar={() => setDelAlvo(null)} onConfirmar={() => excluir(delAlvo)} />
      )}
    </>
  );
}

function FormLojista({ item, bases, plataformas, onSalvar, onCancelar }) {
  const [f, setF] = useState({
    nome: item.nome || '',
    documento: item.documento || '',
    telefone: item.telefone || '',
    contato: item.contato || '',
    endereco: item.endereco || '',
    regiao: item.regiao || '',
    plataforma: item.plataforma || plataformas[0] || '',
    baseId: item.baseId || (bases[0]?.id || ''),
    status: item.status || 'ativo',
    obs: item.obs || '',
  });
  const [err, setErr] = useState('');

  function submit() {
    if (!f.nome.trim()) { setErr('Informe o nome do lojista.'); return; }
    onSalvar({ ...item, ...f, nome: f.nome.trim() });
  }

  return (
    <ModalBase titulo={item.id ? 'Editar lojista' : 'Novo lojista'} onFechar={onCancelar}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Campo label="Nome / loja *" span={2}>
          <input className="inp" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: João Imports" />
        </Campo>
        <Campo label="CNPJ / CPF">
          <input className="inp" value={f.documento} onChange={(e) => setF({ ...f, documento: e.target.value })} />
        </Campo>
        <Campo label="Telefone">
          <input className="inp" value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} placeholder="(11) 90000-0000" />
        </Campo>
        <Campo label="Pessoa de contato">
          <input className="inp" value={f.contato} onChange={(e) => setF({ ...f, contato: e.target.value })} placeholder="Quem confirma a quantidade" />
        </Campo>
        <Campo label="Plataforma">
          <select className="inp" value={f.plataforma} onChange={(e) => setF({ ...f, plataforma: e.target.value })}>
            {plataformas.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Campo>
        <Campo label="Endereço" span={2}>
          <input className="inp" value={f.endereco} onChange={(e) => setF({ ...f, endereco: e.target.value })} />
        </Campo>
        <Campo label="Região">
          <input className="inp" value={f.regiao} onChange={(e) => setF({ ...f, regiao: e.target.value })} placeholder="Ex.: Osasco" />
        </Campo>
        <Campo label="Base de destino" dica="Vem preenchida ao registrar a coleta; o motoboy pode trocar.">
          <select className="inp" value={f.baseId} onChange={(e) => setF({ ...f, baseId: e.target.value })}>
            <option value="">Sem base definida</option>
            {bases.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
          </select>
        </Campo>
        <Campo label="Status">
          <select className="inp" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </Campo>
        <Campo label="Observações" span={2}>
          <textarea className="inp" rows={2} value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} />
        </Campo>
      </div>
      {err && <div className="ent-erro">{err}</div>}
      <div className="flex gap-2 justify-end mt-4">
        <button className="btn btn-ghost" onClick={onCancelar}>Cancelar</button>
        <button className="btn btn-primary" onClick={submit}>Salvar</button>
      </div>
    </ModalBase>
  );
}

function FormTarifa({ lojista, atual, cfg, plataformas, onSalvar, onCancelar }) {
  const [valorPacote, setVp] = useState(String(atual.geral ?? atual.valorPacote ?? ''));
  const [valorMinimo, setVm] = useState(String(atual.valorMinimo ?? ''));
  const [porPlat, setPorPlat] = useState(() => {
    const base = {};
    (plataformas || []).forEach((p) => {
      const v = atual.porPlataforma?.[p];
      base[p] = v == null ? '' : String(v);
    });
    // Plataformas com preço salvo que não estão mais na lista de configuração
    Object.entries(atual.porPlataforma || {}).forEach(([p, v]) => {
      if (base[p] === undefined) base[p] = String(v);
    });
    return base;
  });
  const [motivo, setMotivo] = useState('');
  const [err, setErr] = useState('');

  const num = (v) => Number(String(v).replace(',', '.'));

  function submit() {
    const vp = num(valorPacote);
    const vm = num(valorMinimo) || 0;
    if (!Number.isFinite(vp) || vp <= 0) { setErr('Informe o valor geral por volume.'); return; }

    const mapa = {};
    for (const [plat, val] of Object.entries(porPlat)) {
      if (String(val).trim() === '') continue;
      const v = num(val);
      if (!Number.isFinite(v) || v <= 0) { setErr(`Valor inválido em ${plat}.`); return; }
      mapa[plat] = v;
    }

    if (cfg.exigirJustificativaTarifa && atual.personalizada && !motivo.trim()) {
      setErr('Descreva o motivo da alteração. Fica registrado no histórico.');
      return;
    }
    onSalvar({ valorPacote: vp, valorMinimo: vm, porPlataforma: mapa, motivo: motivo.trim() });
  }

  return (
    <ModalBase largo titulo={`Tarifa — ${lojista.nome}`} onFechar={onCancelar}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Campo label="Valor geral por volume (R$) *"
          dica="Vale para marketplaces sem preço próprio abaixo.">
          <input className="inp" inputMode="decimal" value={valorPacote}
            onChange={(e) => setVp(e.target.value)} placeholder="10,00" />
        </Campo>
        <Campo label="Valor mínimo por coleta (R$)" dica="Deixe 0 para não usar mínimo.">
          <input className="inp" inputMode="decimal" value={valorMinimo}
            onChange={(e) => setVm(e.target.value)} placeholder="0,00" />
        </Campo>
      </div>

      <div className="lj-sec">
        <h4>Valor por marketplace</h4>
        <p>
          Uma mesma loja costuma pagar diferente em cada plataforma. Preencha só as que
          têm preço próprio — as demais usam o valor geral acima.
        </p>
        <div className="lj-plats">
          {(Object.keys(porPlat).length ? Object.keys(porPlat) : []).map((plat) => (
            <label key={plat} className="lj-plat-row">
              <span className="lj-plat-nome">{plat}</span>
              <span className="lj-plat-inp">
                <small>R$</small>
                <input inputMode="decimal" value={porPlat[plat]}
                  placeholder={valorPacote || '—'}
                  onChange={(e) => setPorPlat({ ...porPlat, [plat]: e.target.value })} />
              </span>
            </label>
          ))}
          {!Object.keys(porPlat).length && (
            <p style={{ fontSize: 12.5, color: '#9CA3AF' }}>
              Nenhuma plataforma cadastrada. Adicione em Configurações → Plataformas.
            </p>
          )}
        </div>
      </div>

      <Campo label="Motivo da alteração" span={2}>
        <input className="inp" value={motivo} onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ex.: reajuste combinado em agosto" />
      </Campo>

      <p className="ent-nota">
        A cobrança usa o maior valor entre <b>a soma dos marketplaces</b> e o <b>mínimo</b>.
        O mínimo vale por viagem, não por marketplace. Coletas já conferidas mantêm a tarifa
        da época — esta mudança só vale daqui pra frente.
      </p>
      {err && <div className="ent-erro">{err}</div>}
      <div className="flex gap-2 justify-end mt-4">
        <button className="btn btn-ghost" onClick={onCancelar}>Cancelar</button>
        <button className="btn btn-primary" onClick={submit}>Salvar tarifa</button>
      </div>
    </ModalBase>
  );
}

const LJ_CSS = `
.lj-plat{ font-size:11px; background:#EFF6FF; color:#1D4ED8; padding:3px 7px; border-radius:6px; }
.lj-plat b{ color:#1D4ED8; }
.lj-sec{ margin-top:16px; padding-top:14px; border-top:1px solid #F1F2F4; }
.lj-sec h4{ font-size:13px; font-weight:650; margin:0 0 3px; color:var(--color-text); }
.lj-sec p{ font-size:12px; color:var(--color-text-muted); margin:0 0 11px; }
.lj-plats{ display:flex; flex-direction:column; gap:7px; }
.lj-plat-row{ display:flex; align-items:center; gap:10px; padding:9px 12px; border:1px solid #E5E7EB; border-radius:11px; }
.lj-plat-nome{ flex:1; min-width:0; font-size:13.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.lj-plat-inp{ display:flex; align-items:center; gap:5px; border:1px solid #D1D5DB; border-radius:9px; padding:5px 9px; flex-shrink:0; }
.lj-plat-inp small{ font-size:11px; color:#9CA3AF; }
.lj-plat-inp input{ width:74px; border:0; outline:none; font-size:14px; font-family:inherit; text-align:right; color:#0B1324; background:transparent; }
`;
