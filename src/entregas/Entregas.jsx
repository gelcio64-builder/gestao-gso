import { useMemo, useState, Component } from 'react';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import {
  Bike, Plus, Pencil, Trash2, X, KeyRound, Copy, Check, Search,
  CheckCircle2, AlertTriangle, Link2,
} from 'lucide-react';
import { fdb } from '../firebase';
import { useAuth } from '../auth/AuthContext';
import { gerarCodigoConvite } from './engine';

// ============================================================
//   MÓDULO ENTREGAS — painel de gestão
// ------------------------------------------------------------
//   Uma rota só na sidebar ('entregas'), com abas internas.
//   No Bloco 2 apenas a aba Motoboys está ativa; as demais
//   entram nos blocos seguintes, na ordem combinada.
// ============================================================

const ABAS = [
  { k: 'motoboys', label: 'Motoboys' },
  { k: 'lojistas', label: 'Lojistas', breve: true },
  { k: 'bases', label: 'Bases', breve: true },
  { k: 'coletas', label: 'Coletas', breve: true },
  { k: 'fechamentos', label: 'Fechamentos', breve: true },
];

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const STATUS_MOTOBOY = ['ativo', 'inativo'];

// ------------------------------------------------------------
//   Barreira de erro
// ------------------------------------------------------------
//   Sem isto, qualquer exceção dentro do módulo derruba o React
//   inteiro e o usuário vê uma tela branca, sem pista nenhuma.
//   Aqui o erro fica contido no módulo e a mensagem aparece na
//   tela — o resto do sistema continua navegável.
// ------------------------------------------------------------
class BarreiraErro extends Component {
  constructor(props) {
    super(props);
    this.state = { erro: null };
  }
  static getDerivedStateFromError(erro) {
    return { erro };
  }
  componentDidCatch(erro, info) {
    console.error('[Entregas] erro no módulo:', erro, info);
  }
  render() {
    if (this.state.erro) {
      const msg = this.state.erro?.message || String(this.state.erro);
      return (
        <div className="p-4 sm:p-6">
          <style>{ENT_CSS}</style>
          <div className="ent-crash">
            <AlertTriangle size={30} />
            <h3>O módulo Entregas não conseguiu abrir</h3>
            <p>O restante do sistema continua funcionando normalmente.</p>
            <pre className="ent-crash-msg">{msg}</pre>
            <p className="ent-crash-dica">
              Copie a mensagem acima e envie ao suporte — ela diz exatamente o que falhou.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Entregas(props) {
  return (
    <BarreiraErro>
      <EntregasConteudo {...props} />
    </BarreiraErro>
  );
}

function EntregasConteudo({ data, setData }) {
  const [aba, setAba] = useState('motoboys');
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="ent-tabs">
        {ABAS.map((a) => (
          <button
            key={a.k}
            className={`ent-tab${aba === a.k ? ' on' : ''}`}
            onClick={() => !a.breve && setAba(a.k)}
            disabled={a.breve}
            title={a.breve ? 'Em breve' : undefined}
          >
            {a.label}
            {a.breve && <span className="ent-breve">em breve</span>}
          </button>
        ))}
      </div>
      <style>{ENT_CSS}</style>
      {aba === 'motoboys' && <Motoboys data={data || {}} setData={setData} />}
    </div>
  );
}

// ------------------------------------------------------------
//   Motoboys
// ------------------------------------------------------------
function Motoboys({ data, setData }) {
  // useAuth() pode devolver null se o provider ainda não montou.
  // Sem o `|| {}` o destructuring abaixo estoura e a tela fica branca.
  const auth = useAuth() || {};
  const { company, isOwner } = auth;
  const lista = Array.isArray(data?.entMotoboys) ? data.entMotoboys : [];
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState(null);      // motoboy sendo editado (ou {} p/ novo)
  const [convite, setConvite] = useState(null); // { codigo, nome }
  const [delAlvo, setDelAlvo] = useState(null);
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
    const registro = {
      ...item,
      id: item.id || uid(),
      status: item.status || 'ativo',
      criadoEm: item.criadoEm || new Date().toISOString(),
    };
    setData((d) => ({
      ...d,
      entMotoboys: novo
        ? [...(d.entMotoboys || []), registro]
        : (d.entMotoboys || []).map((m) => (m.id === registro.id ? registro : m)),
    }));
    setForm(null);
  }

  function excluir(m) {
    setData((d) => ({ ...d, entMotoboys: (d.entMotoboys || []).filter((x) => x.id !== m.id) }));
    setDelAlvo(null);
  }

  // ----------------------------------------------------------
  //   Convite pessoal
  // ----------------------------------------------------------
  //   Grava em convites/{codigo} na RAIZ do banco — precisa ficar
  //   fora de companies/ para o motoboy conseguir validar o código
  //   antes de ser membro da empresa. O doc não guarda nada
  //   sensível: só amarra código → empresa → cadastro.
  async function gerarConvite(m) {
    setErro('');
    if (!company?.id) { setErro('Empresa não identificada. Recarregue a página e tente de novo.'); return; }
    try {
      const codigo = gerarCodigoConvite();
      await setDoc(doc(fdb, 'convites', codigo), {
        cid: company.id,
        motoboyId: m.id,
        nome: m.nome || '',
        usado: false,
        criadoEm: serverTimestamp(),
      });
      // Guarda o último código no cadastro para o dono reconsultar.
      setData((d) => ({
        ...d,
        entMotoboys: (d.entMotoboys || []).map((x) =>
          x.id === m.id ? { ...x, conviteCodigo: codigo, conviteEm: new Date().toISOString() } : x
        ),
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
        x.id === m.id ? { ...x, conviteCodigo: '', conviteEm: '' } : x
      ),
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
          <button className="btn btn-primary" onClick={() => setForm({})}>
            <Plus size={15} /> Novo motoboy
          </button>
        </div>

        <div className="ent-busca">
          <Search size={15} />
          <input
            className="inp"
            style={{ border: 0, padding: '6px 0' }}
            placeholder="Buscar por nome, telefone ou região"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {erro && <div className="ent-erro"><AlertTriangle size={14} /> {erro}</div>}

        {!filtrados.length ? (
          <div className="ent-vazio">
            <Bike size={34} />
            <p>Nenhum motoboy cadastrado ainda.</p>
          </div>
        ) : (
          <div className="ent-grid">
            {filtrados.map((m) => (
              <CardMotoboy
                key={m.id}
                m={m}
                podeConvidar={isOwner}
                onEditar={() => setForm(m)}
                onExcluir={() => setDelAlvo(m)}
                onConvite={() => gerarConvite(m)}
                onRevogar={() => revogarConvite(m)}
                onVerCodigo={() => setConvite({ codigo: m.conviteCodigo, nome: m.nome })}
              />
            ))}
          </div>
        )}
      </div>

      {form && <FormMotoboy item={form} onSalvar={salvar} onCancelar={() => setForm(null)} />}
      {convite && <ModalConvite convite={convite} onFechar={() => setConvite(null)} />}
      {delAlvo && (
        <ModalConfirma
          titulo="Excluir motoboy"
          mensagem={`Remover ${delAlvo.nome || 'este motoboy'} do cadastro? As coletas e rotas já registradas continuam no histórico.`}
          onCancelar={() => setDelAlvo(null)}
          onConfirmar={() => excluir(delAlvo)}
        />
      )}
    </>
  );
}

function CardMotoboy({ m, podeConvidar, onEditar, onExcluir, onConvite, onRevogar, onVerCodigo }) {
  const iniciais = (m.nome || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const temConvite = !!m.conviteCodigo;
  return (
    <div className="ent-card-mb">
      <div className="ent-mb-head">
        <div className="ent-mb-av">{iniciais}</div>
        <div className="min-w-0 flex-1">
          <div className="ent-mb-nome">{m.nome || 'Sem nome'}</div>
          <div className="ent-mb-sub">{m.regiao || 'Sem região'}{m.telefone ? ` · ${m.telefone}` : ''}</div>
        </div>
        <span className={`ent-status ${m.status === 'inativo' ? 'off' : 'on'}`}>
          {m.status === 'inativo' ? 'Inativo' : 'Ativo'}
        </span>
      </div>

      {m.pix && <div className="ent-mb-pix">PIX: {m.pix}</div>}

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
        {podeConvidar && (
          temConvite ? (
            <button className="btn btn-ghost ent-b-sm" onClick={onRevogar}>Revogar</button>
          ) : (
            <button className="btn btn-primary ent-b-sm" onClick={onConvite}>
              <KeyRound size={13} /> Gerar convite
            </button>
          )
        )}
        <button className="btn btn-ghost ent-b-sm" onClick={onEditar}><Pencil size={13} /></button>
        <button className="btn btn-ghost ent-b-sm ent-b-del" onClick={onExcluir}><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

function FormMotoboy({ item, onSalvar, onCancelar }) {
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
        <Campo label="Chave PIX">
          <input className="inp" value={f.pix} onChange={(e) => setF({ ...f, pix: e.target.value })} placeholder="Usada nos repasses" />
        </Campo>
        <Campo label="Região">
          <input className="inp" value={f.regiao} onChange={(e) => setF({ ...f, regiao: e.target.value })} placeholder="Ex.: Osasco" />
        </Campo>
        <Campo label="Status">
          <select className="inp" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            {STATUS_MOTOBOY.map((s) => <option key={s} value={s}>{s === 'ativo' ? 'Ativo' : 'Inativo'}</option>)}
          </select>
        </Campo>
        <Campo label="Observações" span={2}>
          <textarea className="inp" rows={2} value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} />
        </Campo>
      </div>
      <p className="ent-nota">
        A tarifa deste motoboy é definida em Configurações → Entregas. Deixando em branco, vale a tarifa padrão da empresa.
      </p>
      {err && <div className="ent-erro"><AlertTriangle size={14} /> {err}</div>}
      <div className="flex gap-2 justify-end mt-4">
        <button className="btn btn-ghost" onClick={onCancelar}>Cancelar</button>
        <button className="btn btn-primary" onClick={submit}>Salvar</button>
      </div>
    </ModalBase>
  );
}

function ModalConvite({ convite, onFechar }) {
  const [copiado, setCopiado] = useState(false);
  const texto =
    `Oi${convite.nome ? ` ${convite.nome.split(' ')[0]}` : ''}! Seu acesso ao app está pronto.\n\n` +
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

// ---- primitivos locais (o módulo não depende de exports do App.jsx) ----
function ModalBase({ titulo, children, onFechar }) {
  return (
    <div className="ent-ov" onClick={onFechar}>
      <div className="ent-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ent-modal-h">
          <h3>{titulo}</h3>
          <button className="ent-x" onClick={onFechar}><X size={17} /></button>
        </div>
        <div className="ent-modal-b">{children}</div>
      </div>
    </div>
  );
}

function Campo({ label, children, span = 1 }) {
  return (
    <label className={span === 2 ? 'sm:col-span-2' : ''}>
      <span className="ent-lbl">{label}</span>
      {children}
    </label>
  );
}

function ModalConfirma({ titulo, mensagem, onCancelar, onConfirmar }) {
  return (
    <ModalBase titulo={titulo} onFechar={onCancelar}>
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{mensagem}</p>
      <div className="flex gap-2 justify-end mt-4">
        <button className="btn btn-ghost" onClick={onCancelar}>Cancelar</button>
        <button className="btn btn-danger" onClick={onConfirmar}>Excluir</button>
      </div>
    </ModalBase>
  );
}

const ENT_CSS = `
.ent-tabs{ display:flex; gap:6px; overflow-x:auto; padding-bottom:2px; }
.ent-tab{ flex-shrink:0; padding:8px 14px; border-radius:11px; border:1px solid #E5E7EB; background:#fff; font-size:13px; font-weight:500; color:#6B7280; cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
.ent-tab.on{ background:var(--color-primary,#0B1533); border-color:var(--color-primary,#0B1533); color:#fff; }
.ent-tab:disabled{ opacity:.5; cursor:default; }
.ent-breve{ font-size:9.5px; text-transform:uppercase; letter-spacing:.04em; background:#F3F4F6; color:#9CA3AF; padding:2px 5px; border-radius:5px; }

.ent-busca{ display:flex; align-items:center; gap:8px; border:1px solid #D1D5DB; border-radius:12px; padding:2px 12px; color:#9CA3AF; margin-bottom:14px; }
.ent-busca .inp:focus{ outline:none; box-shadow:none; }

.ent-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(270px,1fr)); gap:12px; }
.ent-card-mb{ border:1px solid #E5E7EB; border-radius:15px; padding:14px; background:#fff; }
.ent-mb-head{ display:flex; align-items:center; gap:10px; }
.ent-mb-av{ width:40px; height:40px; border-radius:11px; background:var(--color-primary,#0B1533); color:#fff; display:flex; align-items:center; justify-content:center; font-size:13.5px; font-weight:650; flex-shrink:0; }
.ent-mb-nome{ font-size:14.5px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ent-mb-sub{ font-size:12px; color:#6B7280; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ent-status{ font-size:10.5px; font-weight:600; padding:3px 8px; border-radius:999px; flex-shrink:0; }
.ent-status.on{ background:#D1FAE5; color:#047857; }
.ent-status.off{ background:#F3F4F6; color:#6B7280; }
.ent-mb-pix{ margin-top:10px; font-size:11.5px; color:#6B7280; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ent-mb-acesso{ margin-top:10px; }
.ent-mini{ display:inline-flex; align-items:center; gap:5px; font-size:11.5px; padding:5px 9px; border-radius:8px; border:0; cursor:pointer; font-family:inherit; }
.ent-mini.ok{ background:#DBEAFE; color:#1D4ED8; font-weight:600; }
.ent-mini.neutro{ background:#F9FAFB; color:#9CA3AF; }
.ent-mb-acoes{ display:flex; gap:6px; margin-top:12px; }
.ent-b-sm{ padding:7px 11px; font-size:12.5px; }
.ent-b-del{ color:#B91C1C; }

.ent-vazio{ text-align:center; padding:44px 20px; color:#9CA3AF; }
.ent-vazio p{ margin-top:10px; font-size:13.5px; }
.ent-erro{ display:flex; align-items:center; gap:7px; background:#FEE2E2; border:1px solid #FECACA; color:#B91C1C; padding:9px 12px; border-radius:10px; font-size:12.5px; margin:10px 0; }
.ent-nota{ margin-top:12px; font-size:11.5px; color:#6B7280; background:#F9FAFB; border-radius:9px; padding:9px 11px; }

.ent-ov{ position:fixed; inset:0; background:rgba(11,19,36,.45); display:flex; align-items:center; justify-content:center; padding:16px; z-index:60; }
.ent-modal{ background:#fff; border-radius:17px; width:100%; max-width:520px; max-height:90vh; overflow:auto; }
.ent-modal-h{ display:flex; align-items:center; justify-content:space-between; padding:16px 18px; border-bottom:1px solid #F1F2F4; position:sticky; top:0; background:#fff; }
.ent-modal-h h3{ font-size:15.5px; font-weight:650; margin:0; }
.ent-x{ background:transparent; border:0; cursor:pointer; color:#6B7280; padding:4px; }
.ent-modal-b{ padding:18px; }
.ent-lbl{ display:block; font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:#6B7280; font-weight:500; margin-bottom:5px; }

.ent-cod-box{ background:#F9FAFB; border:1px dashed #D1D5DB; border-radius:13px; padding:18px; text-align:center; }
.ent-cod-lbl{ display:block; font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:#6B7280; margin-bottom:6px; }
.ent-cod{ font-size:27px; font-weight:700; letter-spacing:.06em; color:var(--color-primary,#0B1533); font-family:ui-monospace,monospace; }
.ent-avisos{ list-style:none; padding:0; margin:16px 0 0; display:flex; flex-direction:column; gap:8px; }
.ent-avisos li{ display:flex; align-items:flex-start; gap:7px; font-size:12.5px; color:#6B7280; }
.ent-avisos svg{ color:#047857; flex-shrink:0; margin-top:1px; }

.ent-crash{ background:#fff; border:1px solid #FECACA; border-radius:16px; padding:26px 22px; text-align:center; color:#6B7280; }
.ent-crash svg{ color:#DC2626; }
.ent-crash h3{ font-size:15.5px; font-weight:650; color:#0B1324; margin:12px 0 4px; }
.ent-crash p{ font-size:13px; margin:0; }
.ent-crash-msg{ margin:16px auto 0; max-width:560px; text-align:left; background:#FEF2F2; border:1px solid #FECACA; color:#991B1B; padding:12px 14px; border-radius:10px; font-size:12px; font-family:ui-monospace,monospace; white-space:pre-wrap; word-break:break-word; }
.ent-crash-dica{ margin-top:12px !important; font-size:12px; }
`;
