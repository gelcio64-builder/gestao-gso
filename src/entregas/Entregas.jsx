import { useMemo, useState } from 'react';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import {
  Bike, Plus, Pencil, Trash2, KeyRound, Copy, Check, Search,
  CheckCircle2, AlertTriangle, Link2, Coins, Settings, Store, Warehouse, Package, FileText, Wallet, LayoutDashboard, History,
} from 'lucide-react';
import { fdb } from '../firebase';
import { useAuth } from '../auth/AuthContext';
import {
  ModalBase, Campo, ModalConfirma, Vazio, BarreiraErro, uidLocal, fmtBRL, ENT_CSS,
} from './ui';
import {
  gerarCodigoConvite, getConfigEntregas, tarifaDoMotoboy, registrarHistorico, todayISO,
} from './engine';
import { MODO_PAGAMENTO } from './constants';
import Lojistas from './Lojistas';
import Bases from './Bases';
import PainelEntregas from './PainelEntregas';
import Coletas from './Coletas';
import Triagem from './Triagem';
import Repasses from './Repasses';
import Fechamentos from './Fechamentos';
import ConfigEntregas from './ConfigEntregas';
import { HistoricoMotoboy } from './ContaCorrente';

// ============================================================
//   MÓDULO ENTREGAS — painel de gestão
// ------------------------------------------------------------
//   Uma rota só na sidebar ('entregas'), com abas internas —
//   segue o padrão do módulo Mudanças, sem criar uma segunda
//   barra lateral dentro da tela.
// ============================================================

export const VERSAO_ENTREGAS = 'Entregas v11';

const ABAS = [
  { k: 'painel', label: 'Painel', icon: LayoutDashboard },
  { k: 'coletas', label: 'Coletas', icon: Package },
  { k: 'triagem', label: 'Base & Triagem', icon: Warehouse },
  { k: 'fechamentos', label: 'Fechamentos', icon: FileText },
  { k: 'repasses', label: 'Repasses', icon: Wallet },
  { k: 'lojistas', label: 'Lojistas', icon: Store },
  { k: 'motoboys', label: 'Motoboys', icon: Bike },
  { k: 'bases', label: 'Bases', icon: Warehouse },
  { k: 'config', label: 'Configurações', icon: Settings },
];

export default function Entregas(props) {
  return (
    <BarreiraErro>
      <EntregasConteudo {...props} />
    </BarreiraErro>
  );
}

function EntregasConteudo({ data, setData }) {
  const [aba, setAba] = useState('painel');
  const d = data || {};

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <style>{ENT_CSS}{`
        .ent-topo{ display:flex; align-items:center; gap:10px; }
        .ent-topo .ent-tabs{ flex:1; min-width:0; }
        .ent-versao{ flex-shrink:0; font-size:10.5px; font-weight:600; letter-spacing:.03em;
          color:#9CA3AF; background:#F3F4F6; padding:4px 9px; border-radius:7px; white-space:nowrap; }
      `}</style>
      <div className="ent-topo">
        <div className="ent-tabs">
          {ABAS.map((a) => (
            <button key={a.k} className={`ent-tab${aba === a.k ? ' on' : ''}`} onClick={() => setAba(a.k)}>
              <a.icon size={14} /> {a.label}
            </button>
          ))}
        </div>
        {/* Selo de versão: serve para confirmar de olho qual build está no ar
            sem precisar abrir o GitHub. */}
        <span className="ent-versao" title="Versão do módulo Entregas">{VERSAO_ENTREGAS}</span>
      </div>

      {aba === 'painel' && <PainelEntregas data={d} setData={setData} onIrPara={setAba} />}
      {aba === 'coletas' && <Coletas data={d} setData={setData} />}
      {aba === 'triagem' && <Triagem data={d} setData={setData} />}
      {aba === 'fechamentos' && <Fechamentos data={d} setData={setData} />}
      {aba === 'repasses' && <Repasses data={d} setData={setData} />}
      {aba === 'lojistas' && <Lojistas data={d} setData={setData} />}
      {aba === 'motoboys' && <Motoboys data={d} setData={setData} />}
      {aba === 'bases' && <Bases data={d} setData={setData} />}
      {aba === 'config' && <ConfigEntregas data={d} setData={setData} />}
    </div>
  );
}

// ------------------------------------------------------------
//   Motoboys
// ------------------------------------------------------------
function Motoboys({ data, setData }) {
  // useAuth() pode devolver null antes do provider montar; sem o `|| {}`
  // o destructuring estoura e a tela fica branca.
  const auth = useAuth() || {};
  const { company, isOwner } = auth;

  const lista = Array.isArray(data?.entMotoboys) ? data.entMotoboys : [];
  const tarifas = Array.isArray(data?.entTarifas) ? data.entTarifas : [];
  const bases = Array.isArray(data?.entBases) ? data.entBases : [];
  const cfg = getConfigEntregas(data?.entConfig).comercial;

  const [busca, setBusca] = useState('');
  const [form, setForm] = useState(null);
  const [convite, setConvite] = useState(null);
  const [tarifaAlvo, setTarifaAlvo] = useState(null);
  const [delAlvo, setDelAlvo] = useState(null);
  const [histAlvo, setHistAlvo] = useState(null);
  const [erro, setErro] = useState('');

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = [...lista].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    if (!q) return base;
    return base.filter((m) =>
      (m.nome || '').toLowerCase().includes(q) ||
      (m.telefone || '').includes(q) ||
      (m.regiao || '').toLowerCase().includes(q)
    );
  }, [lista, busca]);

  function salvar(item) {
    const novo = !item.id;
    const reg = {
      ...item,
      id: item.id || uidLocal(),
      status: item.status || 'ativo',
      criadoEm: item.criadoEm || new Date().toISOString(),
    };
    setData((d) => ({
      ...d,
      entMotoboys: novo
        ? [...(d.entMotoboys || []), reg]
        : (d.entMotoboys || []).map((m) => (m.id === reg.id ? reg : m)),
    }));
    setForm(null);
  }

  function excluir(m) {
    setData((d) => ({
      ...d,
      entMotoboys: (d.entMotoboys || []).filter((x) => x.id !== m.id),
      entTarifas: (d.entTarifas || []).filter((t) => !(t.tipo === 'motoboy' && t.refId === m.id)),
    }));
    setDelAlvo(null);
  }

  function salvarTarifa(motoboyId, valores) {
    setData((d) => {
      const arr = d.entTarifas || [];
      const atual = arr.find((t) => t.tipo === 'motoboy' && t.refId === motoboyId);
      const anterior = atual
        ? { valorEntrega: atual.valorEntrega, valorColeta: atual.valorColeta }
        : null;
      const comHist = registrarHistorico(atual || {}, {
        acao: atual ? 'tarifa alterada' : 'tarifa definida',
        campo: 'tarifa',
        de: anterior,
        para: { valorEntrega: valores.valorEntrega, valorColeta: valores.valorColeta },
        motivo: valores.motivo,
      });
      const novo = {
        ...comHist,
        id: atual?.id || uidLocal(),
        tipo: 'motoboy',
        refId: motoboyId,
        valorEntrega: valores.valorEntrega,
        valorColeta: valores.valorColeta,
        modoPagamento: valores.modoPagamento,
        vigenciaInicio: todayISO(),
      };
      return { ...d, entTarifas: atual ? arr.map((t) => (t.id === novo.id ? novo : t)) : [...arr, novo] };
    });
    setTarifaAlvo(null);
  }

  // ----------------------------------------------------------
  //   Convite pessoal
  // ----------------------------------------------------------
  //   Grava em convites/{codigo} na RAIZ do banco — precisa ficar
  //   fora de companies/ para o motoboy validar o código antes de
  //   ser membro da empresa. Não guarda nada sensível: só amarra
  //   código → empresa → cadastro.
  async function gerarConvite(m) {
    setErro('');
    if (!company?.id) { setErro('Empresa não identificada. Recarregue a página.'); return; }
    try {
      const codigo = gerarCodigoConvite();
      await setDoc(doc(fdb, 'convites', codigo), {
        cid: company.id,
        motoboyId: m.id,
        nome: m.nome || '',
        usado: false,
        criadoEm: serverTimestamp(),
      });
      setData((d) => ({
        ...d,
        entMotoboys: (d.entMotoboys || []).map((x) =>
          x.id === m.id ? { ...x, conviteCodigo: codigo, conviteEm: new Date().toISOString() } : x),
      }));
      setConvite({ codigo, nome: m.nome });
    } catch (e) {
      console.error('[convite]', e);
      setErro('Não foi possível gerar o convite. Tente novamente.');
    }
  }

  async function revogarConvite(m) {
    if (!m.conviteCodigo) return;
    try { await deleteDoc(doc(fdb, 'convites', m.conviteCodigo)); } catch (_) {}
    setData((d) => ({
      ...d,
      entMotoboys: (d.entMotoboys || []).map((x) =>
        x.id === m.id ? { ...x, conviteCodigo: '', conviteEm: '' } : x),
    }));
  }

  return (
    <>
      <div className="card p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>Motoboys</h2>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Cadastre a equipe e gere o convite de acesso ao app
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setForm({})}><Plus size={15} /> Novo motoboy</button>
        </div>

        <div className="ent-busca">
          <Search size={15} />
          <input className="inp" placeholder="Buscar por nome, telefone ou região"
            value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>

        {erro && <div className="ent-erro"><AlertTriangle size={14} /> {erro}</div>}

        {!filtrados.length ? (
          <Vazio icon={Bike} titulo="Nenhum motoboy cadastrado"
            sub="Cadastre a equipe e envie o convite de acesso." />
        ) : (
          <div className="ent-grid">
            {filtrados.map((m) => (
              <CardMotoboy key={m.id} m={m}
                tarifa={tarifaDoMotoboy(m.id, tarifas, cfg)}
                base={bases.find((b) => b.id === m.baseId)}
                podeConvidar={isOwner}
                onEditar={() => setForm(m)}
                onExcluir={() => setDelAlvo(m)}
                onTarifa={() => setTarifaAlvo(m)}
                onHistorico={() => setHistAlvo(m)}
                onConvite={() => gerarConvite(m)}
                onRevogar={() => revogarConvite(m)}
                onVerCodigo={() => setConvite({ codigo: m.conviteCodigo, nome: m.nome })} />
            ))}
          </div>
        )}
      </div>

      {form && <FormMotoboy item={form} bases={bases} onSalvar={salvar} onCancelar={() => setForm(null)} />}
      {tarifaAlvo && (
        <FormTarifaMotoboy motoboy={tarifaAlvo} atual={tarifaDoMotoboy(tarifaAlvo.id, tarifas, cfg)} cfg={cfg}
          onSalvar={(v) => salvarTarifa(tarifaAlvo.id, v)} onCancelar={() => setTarifaAlvo(null)} />
      )}
      {histAlvo && (
        <HistoricoMotoboy motoboy={histAlvo} data={data} onFechar={() => setHistAlvo(null)} />
      )}
      {convite && <ModalConvite convite={convite} onFechar={() => setConvite(null)} />}
      {delAlvo && (
        <ModalConfirma titulo="Excluir motoboy"
          mensagem={`Remover ${delAlvo.nome || 'este motoboy'}? As coletas e rotas já registradas continuam no histórico.`}
          onCancelar={() => setDelAlvo(null)} onConfirmar={() => excluir(delAlvo)} />
      )}
    </>
  );
}

function CardMotoboy({ m, tarifa, base, podeConvidar, onEditar, onExcluir, onTarifa, onHistorico, onConvite, onRevogar, onVerCodigo }) {
  const iniciais = (m.nome || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const temConvite = !!m.conviteCodigo;
  const duplo = tarifa.modoPagamento === MODO_PAGAMENTO.COLETA_ENTREGA;

  return (
    <div className="ent-card-mb">
      <div className="ent-mb-head">
        <div className="ent-mb-av">{iniciais}</div>
        <div className="min-w-0 flex-1">
          <div className="ent-mb-nome" title={m.nome}>{m.nome || 'Sem nome'}</div>
          <div className="ent-mb-sub">
            {[m.regiao, base?.nome, m.telefone].filter(Boolean).join(' · ') || 'Sem região'}
          </div>
        </div>
        <span className={`ent-status ${m.status === 'inativo' ? 'off' : 'on'}`}>
          {m.status === 'inativo' ? 'Inativo' : 'Ativo'}
        </span>
      </div>

      {m.pix && <div className="ent-mb-pix">PIX: {m.pix}</div>}

      <div className="ent-tarifa">
        <Coins size={14} />
        <span><b>{fmtBRL(tarifa.valorEntrega)}</b> por entrega</span>
        {duplo && <span>· <b>{fmtBRL(tarifa.valorColeta)}</b> por coleta</span>}
        {!tarifa.personalizada && <span className="ent-tag-pad">padrão</span>}
      </div>

      <div className="ent-mb-acesso">
        {temConvite ? (
          <button className="ent-mini ok" onClick={onVerCodigo}>
            <KeyRound size={13} /> Convite: {m.conviteCodigo}
          </button>
        ) : (
          <span className="ent-mini neutro"><Link2 size={13} /> Sem convite gerado</span>
        )}
      </div>

      <div className="ent-mb-acoes">
        {podeConvidar && (temConvite
          ? <button className="btn btn-ghost ent-b-sm" onClick={onRevogar}>Revogar</button>
          : <button className="btn btn-primary ent-b-sm" onClick={onConvite}><KeyRound size={13} /> Convite</button>
        )}
        <button className="btn btn-ghost ent-b-sm" onClick={onHistorico}><History size={13} /> Histórico</button>
        <button className="btn btn-ghost ent-b-sm" onClick={onTarifa}><Coins size={13} /> Tarifa</button>
        <button className="btn btn-ghost ent-b-sm" onClick={onEditar}><Pencil size={13} /></button>
        <button className="btn btn-ghost ent-b-sm ent-b-del" onClick={onExcluir}><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

function FormMotoboy({ item, bases, onSalvar, onCancelar }) {
  const [f, setF] = useState({
    nome: item.nome || '',
    telefone: item.telefone || '',
    documento: item.documento || '',
    pix: item.pix || '',
    regiao: item.regiao || '',
    baseId: item.baseId || '',
    status: item.status || 'ativo',
    obs: item.obs || '',
  });
  const [err, setErr] = useState('');

  function submit() {
    if (!f.nome.trim()) { setErr('Informe o nome do motoboy.'); return; }
    onSalvar({ ...item, ...f, nome: f.nome.trim() });
  }

  return (
    <ModalBase titulo={item.id ? 'Editar motoboy' : 'Novo motoboy'} onFechar={onCancelar}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Campo label="Nome *" span={2}>
          <input className="inp" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Nome completo" />
        </Campo>
        <Campo label="Telefone">
          <input className="inp" value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} placeholder="(11) 90000-0000" />
        </Campo>
        <Campo label="Documento">
          <input className="inp" value={f.documento} onChange={(e) => setF({ ...f, documento: e.target.value })} placeholder="CPF ou RG" />
        </Campo>
        <Campo label="Chave PIX" dica="Usada nos repasses.">
          <input className="inp" value={f.pix} onChange={(e) => setF({ ...f, pix: e.target.value })} />
        </Campo>
        <Campo label="Região">
          <input className="inp" value={f.regiao} onChange={(e) => setF({ ...f, regiao: e.target.value })} placeholder="Ex.: Osasco" />
        </Campo>
        <Campo label="Base">
          <select className="inp" value={f.baseId} onChange={(e) => setF({ ...f, baseId: e.target.value })}>
            <option value="">Sem base fixa</option>
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

function FormTarifaMotoboy({ motoboy, atual, cfg, onSalvar, onCancelar }) {
  const [modo, setModo] = useState(atual.modoPagamento);
  const [entrega, setEntrega] = useState(String(atual.valorEntrega ?? ''));
  const [coleta, setColeta] = useState(String(atual.valorColeta ?? ''));
  const [motivo, setMotivo] = useState('');
  const [err, setErr] = useState('');
  const duplo = modo === MODO_PAGAMENTO.COLETA_ENTREGA;

  function submit() {
    const ve = Number(String(entrega).replace(',', '.'));
    const vc = Number(String(coleta).replace(',', '.')) || 0;
    if (!Number.isFinite(ve) || ve <= 0) { setErr('Informe o valor por entrega.'); return; }
    if (duplo && vc <= 0) { setErr('No modelo coleta + entrega, informe também o valor da coleta.'); return; }
    if (cfg.exigirJustificativaTarifa && atual.personalizada && !motivo.trim()) {
      setErr('Descreva o motivo da alteração. Fica registrado no histórico.'); return;
    }
    onSalvar({ valorEntrega: ve, valorColeta: duplo ? vc : 0, modoPagamento: modo, motivo: motivo.trim() });
  }

  return (
    <ModalBase titulo={`Tarifa — ${motoboy.nome}`} onFechar={onCancelar}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Campo label="Modelo de pagamento" span={2}
          dica="Deixe igual ao padrão da empresa, a menos que este motoboy tenha acordo diferente.">
          <select className="inp" value={modo} onChange={(e) => setModo(e.target.value)}>
            <option value={MODO_PAGAMENTO.ENTREGA}>Somente por entrega</option>
            <option value={MODO_PAGAMENTO.COLETA_ENTREGA}>Por coleta + por entrega</option>
          </select>
        </Campo>
        <Campo label="Valor por entrega (R$) *">
          <input className="inp" inputMode="decimal" value={entrega} onChange={(e) => setEntrega(e.target.value)} placeholder="6,50" />
        </Campo>
        {duplo && (
          <Campo label="Valor por coleta (R$) *">
            <input className="inp" inputMode="decimal" value={coleta} onChange={(e) => setColeta(e.target.value)} placeholder="2,00" />
          </Campo>
        )}
        <Campo label="Motivo da alteração" span={2}>
          <input className="inp" value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: aumento combinado por tempo de casa" />
        </Campo>
      </div>
      <p className="ent-nota">
        Fechamentos já emitidos não mudam: cada coleta e cada rota carrega a tarifa da época.
      </p>
      {err && <div className="ent-erro">{err}</div>}
      <div className="flex gap-2 justify-end mt-4">
        <button className="btn btn-ghost" onClick={onCancelar}>Cancelar</button>
        <button className="btn btn-primary" onClick={submit}>Salvar tarifa</button>
      </div>
    </ModalBase>
  );
}

function ModalConvite({ convite, onFechar }) {
  const [copiado, setCopiado] = useState(false);
  const texto =
    `Oi${convite.nome ? ` ${String(convite.nome).split(' ')[0]}` : ''}! Seu acesso ao app está pronto.\n\n` +
    `1. Abra o app\n2. Toque em "Criar conta" e depois em "Cadastro de motoboy"\n` +
    `3. Use o código: ${convite.codigo}\n\nO código só funciona uma vez.`;

  function copiar() {
    navigator.clipboard?.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <ModalBase titulo="Convite gerado" onFechar={onFechar}>
      <div className="ent-cod-box">
        <span className="ent-cod-lbl">Código pessoal</span>
        <span className="ent-cod">{convite.codigo}</span>
      </div>
      <ul className="ent-avisos">
        <li><CheckCircle2 size={14} /> Vale uma única vez — depois de usado, deixa de funcionar.</li>
        <li><CheckCircle2 size={14} /> A conta nasce restrita: ele vê só as próprias coletas e rotas.</li>
        <li><CheckCircle2 size={14} /> Não é o código da empresa. Nunca envie aquele para um motoboy.</li>
      </ul>
      <div className="flex gap-2 justify-end mt-4">
        <button className="btn btn-ghost" onClick={onFechar}>Fechar</button>
        <button className="btn btn-primary" onClick={copiar}>
          {copiado ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar mensagem</>}
        </button>
      </div>
    </ModalBase>
  );
}
