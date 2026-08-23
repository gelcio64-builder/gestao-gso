import { useMemo, useState } from 'react';
import {
  Package, Bike, User, LogOut, Loader2, AlertTriangle, CheckCircle2, Clock, Inbox,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useMotoboySync } from './useMotoboySync';
import { COLETA_STATUS, ROTA_STATUS } from './constants';
import { statusConciliacao } from './engine';

// ============================================================
//   APP DO MOTOBOY
// ------------------------------------------------------------
//   Aplicativo separado, não uma versão escondida do painel.
//   O Sidebar, o Dashboard e os módulos de gestão nem chegam a
//   ser montados quando o papel é 'motoboy'.
//
//   Desenho mobile-first: alvos grandes, pouca informação por
//   tela, sem tabela larga. Ele usa isso na rua, com uma mão,
//   às vezes de capacete.
//
//   Registrar coleta e enviar comprovante entram no Bloco 3.
// ============================================================

const fmtData = (iso) => {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
};

const hojeISO = () => new Date().toISOString().slice(0, 10);

export default function AppMotoboy() {
  const { user, company, logout, motoboyId, erroAcesso } = useAuth();
  const { dados, pronto, erro } = useMotoboySync(company?.id, user?.uid, motoboyId);
  const [aba, setAba] = useState('coletas');

  const nome = dados.perfil?.nome || user?.displayName || 'Motoboy';

  const resumo = useMemo(() => {
    const hoje = hojeISO();
    const coletasHoje = dados.coletas.filter((c) => c.data === hoje);
    const rotasAbertas = dados.rotas.filter((r) => r.status === 'atribuida' || r.status === 'andamento');
    return {
      volumesHoje: coletasHoje.reduce((s, c) => s + (Number(c.qtdInformada) || 0), 0),
      coletasHoje: coletasHoje.length,
      rotasAbertas: rotasAbertas.length,
      aEntregar: rotasAbertas.reduce(
        (s, r) => s + Math.max(0, (Number(r.qtdAtribuida) || 0) - (Number(r.qtdConcluida) || 0)), 0
      ),
    };
  }, [dados]);

  if (erroAcesso) {
    return (
      <div className="mb-wrap">
        <style>{MB_CSS}</style>
        <div className="mb-center">
          <AlertTriangle size={34} color="#F59E0B" />
          <p className="mb-msg">{erroAcesso}</p>
          <button className="mb-btn mb-btn-ghost" onClick={logout}>Sair</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-wrap">
      <style>{MB_CSS}</style>

      <header className="mb-top">
        <div>
          <div className="mb-hello">Olá, {nome.split(' ')[0]}</div>
          <div className="mb-emp">{company?.nome || 'Empresa'}</div>
        </div>
        <button className="mb-sair" onClick={logout} aria-label="Sair">
          <LogOut size={18} />
        </button>
      </header>

      <section className="mb-cards">
        <div className="mb-card">
          <span className="mb-card-num">{resumo.volumesHoje}</span>
          <span className="mb-card-lbl">Coletados hoje</span>
        </div>
        <div className="mb-card">
          <span className="mb-card-num">{resumo.aEntregar}</span>
          <span className="mb-card-lbl">A entregar</span>
        </div>
      </section>

      {erro && <div className="mb-alerta"><AlertTriangle size={15} /> {erro}</div>}

      <main className="mb-main">
        {!pronto ? (
          <div className="mb-center"><Loader2 size={22} className="mb-spin" /><p className="mb-msg">Carregando…</p></div>
        ) : aba === 'coletas' ? (
          <ListaColetas coletas={dados.coletas} lojistas={dados.lojistas} />
        ) : aba === 'entregas' ? (
          <ListaRotas rotas={dados.rotas} bases={dados.bases} />
        ) : (
          <Perfil perfil={dados.perfil} user={user} coletas={dados.coletas} rotas={dados.rotas} />
        )}
      </main>

      <nav className="mb-nav">
        <BotaoNav ativo={aba === 'coletas'} onClick={() => setAba('coletas')} icon={Package} label="Coletas" />
        <BotaoNav ativo={aba === 'entregas'} onClick={() => setAba('entregas')} icon={Bike} label="Entregas" />
        <BotaoNav ativo={aba === 'perfil'} onClick={() => setAba('perfil')} icon={User} label="Perfil" />
      </nav>
    </div>
  );
}

function BotaoNav({ ativo, onClick, icon: Icon, label }) {
  return (
    <button className={`mb-nav-b${ativo ? ' on' : ''}`} onClick={onClick}>
      <Icon size={21} />
      <span>{label}</span>
    </button>
  );
}

function Vazio({ icon: Icon, titulo, sub }) {
  return (
    <div className="mb-vazio">
      <Icon size={34} />
      <p className="mb-vazio-t">{titulo}</p>
      {sub && <p className="mb-vazio-s">{sub}</p>}
    </div>
  );
}

function Chip({ lista, k }) {
  const s = lista.find((x) => x.k === k) || lista[0];
  return <span className="mb-chip" style={{ color: s.cor, background: s.bg }}>{s.label}</span>;
}

function ListaColetas({ coletas, lojistas }) {
  const nomeLojista = (id) => lojistas.find((l) => l.id === id)?.nome || 'Lojista';
  const ordenadas = [...coletas].sort((a, b) => String(b.data).localeCompare(String(a.data)));

  if (!ordenadas.length) {
    return <Vazio icon={Inbox} titulo="Nenhuma coleta registrada" sub="Suas retiradas aparecem aqui assim que forem lançadas." />;
  }

  return (
    <div className="mb-lista">
      {ordenadas.map((c) => (
        <article key={c.id} className="mb-item">
          <div className="mb-item-top">
            <span className="mb-item-nome">{nomeLojista(c.lojistaId)}</span>
            <Chip lista={COLETA_STATUS} k={statusConciliacao(c)} />
          </div>
          <div className="mb-item-linha">
            <strong className="mb-qtd">{c.qtdInformada || 0}</strong>
            <span className="mb-un">volumes</span>
            <span className="mb-data"><Clock size={13} /> {fmtData(c.data)}</span>
          </div>
          {c.plataforma && <div className="mb-item-sub">{c.plataforma}</div>}
        </article>
      ))}
    </div>
  );
}

function ListaRotas({ rotas, bases }) {
  const nomeBase = (id) => bases.find((b) => b.id === id)?.nome || '';
  const ordenadas = [...rotas].sort((a, b) => String(b.data).localeCompare(String(a.data)));

  if (!ordenadas.length) {
    return <Vazio icon={Bike} titulo="Nenhuma rota atribuída" sub="Quando a base separar os pacotes, sua rota aparece aqui." />;
  }

  return (
    <div className="mb-lista">
      {ordenadas.map((r) => {
        const atrib = Number(r.qtdAtribuida) || 0;
        const feito = Number(r.qtdConcluida) || 0;
        const pct = atrib > 0 ? Math.min(100, Math.round((feito / atrib) * 100)) : 0;
        return (
          <article key={r.id} className="mb-item">
            <div className="mb-item-top">
              <span className="mb-item-nome">{r.regiao || 'Rota'}</span>
              <Chip lista={ROTA_STATUS} k={r.status || 'atribuida'} />
            </div>
            <div className="mb-item-linha">
              <strong className="mb-qtd">{feito}/{atrib}</strong>
              <span className="mb-un">entregues</span>
              <span className="mb-data"><Clock size={13} /> {fmtData(r.data)}</span>
            </div>
            <div className="mb-barra"><div className="mb-barra-in" style={{ width: `${pct}%` }} /></div>
            {r.baseId && <div className="mb-item-sub">Saída: {nomeBase(r.baseId)}</div>}
          </article>
        );
      })}
    </div>
  );
}

function Perfil({ perfil, user, coletas, rotas }) {
  const totalColetado = coletas.reduce((s, c) => s + (Number(c.qtdInformada) || 0), 0);
  const totalEntregue = rotas.reduce((s, r) => s + (Number(r.qtdConcluida) || 0), 0);
  return (
    <div className="mb-perfil">
      <div className="mb-avatar"><User size={26} /></div>
      <div className="mb-perfil-nome">{perfil?.nome || user?.displayName || '—'}</div>
      <div className="mb-perfil-mail">{user?.email}</div>

      <div className="mb-perfil-grid">
        <div className="mb-mini"><span>{totalColetado}</span><small>Volumes coletados</small></div>
        <div className="mb-mini"><span>{totalEntregue}</span><small>Volumes entregues</small></div>
        <div className="mb-mini"><span>{coletas.length}</span><small>Coletas</small></div>
        <div className="mb-mini"><span>{rotas.length}</span><small>Rotas</small></div>
      </div>

      {perfil?.regiao && (
        <div className="mb-perfil-info"><CheckCircle2 size={14} /> Região: {perfil.regiao}</div>
      )}
      {perfil?.telefone && (
        <div className="mb-perfil-info"><CheckCircle2 size={14} /> {perfil.telefone}</div>
      )}
    </div>
  );
}

const MB_CSS = `
.mb-wrap{ min-height:100vh; min-height:100dvh; background:var(--color-background,#F3F4F6); display:flex; flex-direction:column; font-family:'Geist',system-ui,sans-serif; color:#0B1324; padding-bottom:76px; }
.mb-top{ background:var(--color-primary,#0B1533); color:#fff; padding:18px 18px 20px; display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
.mb-hello{ font-size:19px; font-weight:650; letter-spacing:-.01em; }
.mb-emp{ font-size:12.5px; opacity:.7; margin-top:2px; }
.mb-sair{ background:rgba(255,255,255,.12); border:0; color:#fff; width:38px; height:38px; border-radius:11px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; }
.mb-sair:active{ transform:scale(.95); }

.mb-cards{ display:grid; grid-template-columns:1fr 1fr; gap:10px; padding:0 14px; margin-top:-14px; }
.mb-card{ background:#fff; border:1px solid #E5E7EB; border-radius:15px; padding:13px 14px; box-shadow:0 4px 14px rgba(11,19,36,.06); display:flex; flex-direction:column; gap:2px; }
.mb-card-num{ font-size:26px; font-weight:700; line-height:1.1; letter-spacing:-.02em; }
.mb-card-lbl{ font-size:11.5px; color:#6B7280; }

.mb-alerta{ margin:12px 14px 0; display:flex; align-items:center; gap:7px; background:#FEF3C7; border:1px solid #FDE68A; color:#92400E; padding:10px 12px; border-radius:11px; font-size:12.5px; }

.mb-main{ flex:1; padding:16px 14px 8px; }
.mb-lista{ display:flex; flex-direction:column; gap:10px; }
.mb-item{ background:#fff; border:1px solid #E5E7EB; border-radius:15px; padding:13px 14px; }
.mb-item-top{ display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
.mb-item-nome{ font-weight:600; font-size:14.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.mb-item-linha{ display:flex; align-items:baseline; gap:6px; flex-wrap:wrap; }
.mb-qtd{ font-size:21px; font-weight:700; letter-spacing:-.02em; }
.mb-un{ font-size:12.5px; color:#6B7280; }
.mb-data{ margin-left:auto; display:inline-flex; align-items:center; gap:4px; font-size:12px; color:#6B7280; }
.mb-item-sub{ margin-top:7px; font-size:12px; color:#6B7280; }
.mb-chip{ font-size:11px; font-weight:600; padding:4px 9px; border-radius:999px; white-space:nowrap; flex-shrink:0; }
.mb-barra{ height:6px; background:#F1F2F4; border-radius:999px; overflow:hidden; margin-top:10px; }
.mb-barra-in{ height:100%; background:var(--color-accent,#1D4ED8); border-radius:999px; transition:width .3s ease; }

.mb-vazio{ text-align:center; padding:52px 20px; color:#9CA3AF; }
.mb-vazio-t{ font-size:14.5px; font-weight:600; color:#6B7280; margin:12px 0 4px; }
.mb-vazio-s{ font-size:12.5px; margin:0; }

.mb-center{ display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:60px 24px; text-align:center; }
.mb-msg{ font-size:14px; color:#6B7280; margin:0; max-width:280px; }
.mb-spin{ animation:mb-rot 1s linear infinite; color:#6B7280; }
@keyframes mb-rot{ to{ transform:rotate(360deg);} }

.mb-perfil{ background:#fff; border:1px solid #E5E7EB; border-radius:16px; padding:22px 16px; text-align:center; }
.mb-avatar{ width:60px; height:60px; border-radius:50%; background:var(--color-primary,#0B1533); color:#fff; display:flex; align-items:center; justify-content:center; margin:0 auto 10px; }
.mb-perfil-nome{ font-size:17px; font-weight:650; }
.mb-perfil-mail{ font-size:12.5px; color:#6B7280; margin-top:2px; }
.mb-perfil-grid{ display:grid; grid-template-columns:1fr 1fr; gap:9px; margin:18px 0 6px; }
.mb-mini{ background:#F9FAFB; border:1px solid #F1F2F4; border-radius:12px; padding:11px 8px; }
.mb-mini span{ display:block; font-size:19px; font-weight:700; letter-spacing:-.02em; }
.mb-mini small{ font-size:10.5px; color:#6B7280; }
.mb-perfil-info{ display:inline-flex; align-items:center; gap:6px; font-size:12.5px; color:#6B7280; margin-top:8px; }

.mb-btn{ display:inline-flex; align-items:center; justify-content:center; gap:7px; padding:12px 18px; border-radius:12px; font-size:14px; font-weight:600; border:0; cursor:pointer; }
.mb-btn-ghost{ background:#E5E7EB; color:#0B1324; }

.mb-nav{ position:fixed; left:0; right:0; bottom:0; background:#fff; border-top:1px solid #E5E7EB; display:grid; grid-template-columns:repeat(3,1fr); padding:6px 4px calc(6px + env(safe-area-inset-bottom)); z-index:40; }
.mb-nav-b{ background:transparent; border:0; display:flex; flex-direction:column; align-items:center; gap:3px; padding:9px 4px; color:#9CA3AF; font-size:11px; font-weight:500; cursor:pointer; border-radius:12px; }
.mb-nav-b.on{ color:var(--color-primary,#0B1533); }
.mb-nav-b:active{ background:#F3F4F6; }
`;
