import { useState } from 'react';
import { Warehouse, Plus, Pencil, Trash2, MapPin } from 'lucide-react';
import { ModalBase, Campo, ModalConfirma, Vazio, uidLocal } from './ui';
import { getConfigEntregas } from './engine';
import { BASE_TIPOS, BASE_TIPO_LABEL } from './constants';

// ============================================================
//   BASES
//   Onde os pacotes são descarregados e triados. Podem ser
//   próprias ou de parceiros.
// ============================================================

export default function Bases({ data, setData }) {
  const bases = Array.isArray(data.entBases) ? data.entBases : [];
  const regioes = getConfigEntregas(data.entConfig).operacional.regioes || [];
  const [form, setForm] = useState(null);
  const [delAlvo, setDelAlvo] = useState(null);

  function salvar(item) {
    const novo = !item.id;
    const reg = { ...item, id: item.id || uidLocal(), status: item.status || 'ativa' };
    setData((d) => ({
      ...d,
      entBases: novo
        ? [...(d.entBases || []), reg]
        : (d.entBases || []).map((x) => (x.id === reg.id ? reg : x)),
    }));
    setForm(null);
  }

  function excluir(b) {
    setData((d) => ({ ...d, entBases: (d.entBases || []).filter((x) => x.id !== b.id) }));
    setDelAlvo(null);
  }

  return (
    <>
      <div className="card p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>Bases</h2>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Onde os pacotes são descarregados e separados por região
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setForm({})}><Plus size={15} /> Nova base</button>
        </div>

        {!bases.length ? (
          <Vazio icon={Warehouse} titulo="Nenhuma base cadastrada"
            sub="A base é o destino da coleta — cadastre pelo menos uma." />
        ) : (
          <div className="ent-grid">
            {bases.map((b) => (
              <div key={b.id} className="ent-card-mb">
                <div className="ent-mb-head">
                  <div className="ent-mb-av" style={{ background: b.tipo === 'parceira' ? '#7C3AED' : '#047857' }}>
                    <Warehouse size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="ent-mb-nome" title={b.nome}>{b.nome || 'Sem nome'}</div>
                    <div className="ent-mb-sub">{BASE_TIPO_LABEL[b.tipo] || 'Própria'}</div>
                  </div>
                  <span className={`ent-status ${b.status === 'inativa' ? 'off' : 'on'}`}>
                    {b.status === 'inativa' ? 'Inativa' : 'Ativa'}
                  </span>
                </div>

                {b.endereco && <div className="ent-mb-pix"><MapPin size={12} /> {b.endereco}</div>}
                {b.responsavel && <div className="ent-mb-pix">Responsável: {b.responsavel}</div>}
                {!!(b.regioes || []).length && (
                  <div className="ent-tarifa">
                    <span>Atende: <b>{(b.regioes || []).join(', ')}</b></span>
                  </div>
                )}

                <div className="ent-mb-acoes">
                  <button className="btn btn-ghost ent-b-sm" onClick={() => setForm(b)}><Pencil size={13} /> Editar</button>
                  <button className="btn btn-ghost ent-b-sm ent-b-del" onClick={() => setDelAlvo(b)}><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {form && <FormBase item={form} regioes={regioes} onSalvar={salvar} onCancelar={() => setForm(null)} />}
      {delAlvo && (
        <ModalConfirma titulo="Excluir base"
          mensagem={`Remover ${delAlvo.nome || 'esta base'}? As coletas já registradas continuam no histórico.`}
          onCancelar={() => setDelAlvo(null)} onConfirmar={() => excluir(delAlvo)} />
      )}
    </>
  );
}

function FormBase({ item, regioes, onSalvar, onCancelar }) {
  const [f, setF] = useState({
    nome: item.nome || '',
    tipo: item.tipo || 'propria',
    responsavel: item.responsavel || '',
    telefone: item.telefone || '',
    endereco: item.endereco || '',
    regioes: item.regioes || [],
    status: item.status || 'ativa',
    obs: item.obs || '',
  });
  const [err, setErr] = useState('');

  function alternarRegiao(nome) {
    setF((p) => ({
      ...p,
      regioes: p.regioes.includes(nome) ? p.regioes.filter((r) => r !== nome) : [...p.regioes, nome],
    }));
  }

  function submit() {
    if (!f.nome.trim()) { setErr('Informe o nome da base.'); return; }
    onSalvar({ ...item, ...f, nome: f.nome.trim() });
  }

  return (
    <ModalBase titulo={item.id ? 'Editar base' : 'Nova base'} onFechar={onCancelar}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Campo label="Nome *" span={2}>
          <input className="inp" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Base Guarulhos" />
        </Campo>
        <Campo label="Tipo">
          <select className="inp" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
            {BASE_TIPOS.map((t) => <option key={t} value={t}>{BASE_TIPO_LABEL[t]}</option>)}
          </select>
        </Campo>
        <Campo label="Status">
          <select className="inp" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="ativa">Ativa</option>
            <option value="inativa">Inativa</option>
          </select>
        </Campo>
        <Campo label="Responsável">
          <input className="inp" value={f.responsavel} onChange={(e) => setF({ ...f, responsavel: e.target.value })} />
        </Campo>
        <Campo label="Telefone">
          <input className="inp" value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} />
        </Campo>
        <Campo label="Endereço" span={2}>
          <input className="inp" value={f.endereco} onChange={(e) => setF({ ...f, endereco: e.target.value })} />
        </Campo>
        <Campo label="Regiões atendidas" span={2}
          dica={regioes.length ? 'Usadas na triagem para distribuir as rotas.' : 'Cadastre regiões em Configurações para marcar aqui.'}>
          <div className="flex flex-wrap gap-2">
            {!regioes.length ? (
              <span className="text-xs" style={{ color: '#9CA3AF' }}>Nenhuma região cadastrada ainda.</span>
            ) : regioes.map((r) => {
              const on = f.regioes.includes(r.nome);
              return (
                <button key={r.id || r.nome} type="button" onClick={() => alternarRegiao(r.nome)}
                  className={`ent-mini ${on ? 'ok' : 'neutro'}`}>
                  {r.nome}
                </button>
              );
            })}
          </div>
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
