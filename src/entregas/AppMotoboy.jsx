import { useMemo, useState } from 'react';
import {
  Package, Bike, User, LogOut, Loader2, AlertTriangle, CheckCircle2,
  Clock, Inbox, Plus, Minus, Check,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useMotoboySync } from './useMotoboySync';
import { COLETA_STATUS, ROTA_STATUS } from './constants';
import { statusConciliacao } from './engine';
import { criarColetaMotoboy } from './dados';
import { SeletorGrande, Vazio, Chip, ENT_CSS, fmtData, hojeISO } from './ui';

// ============================================================
//   APP DO MOTOBOY
// ------------------------------------------------------------
//   Aplicativo separado, não uma versão escondida do painel.
//   AppInner (sidebar, dashboard, financeiro) nem chega a ser
//   montado quando o papel é 'motoboy'.
//
//   Mobile-first de verdade: alvos altos, pouca informação por
//   tela, listas em folha que sobem de baixo. Ele usa isso na
//   rua, com uma mão só.
// ============================================================

export default function AppMotoboy() {
  const { user, company, logout, motoboyId, erroAcesso } = useAuth();
  const { dados, pronto, erro } = useMotoboySync(company?.id, user?.uid, motoboyId);
  const [aba, setAba] = useState('coletas');
  const [registrando, setRegistrando] = useState(false);
  const [toast, setToast] = useState('');

  const nome = dados.perfil?.nome || user?.displayName || 'Motoboy';

  const resumo = useMemo(() => {
    const hoje = hojeISO();
    const coletasHoje = dados.coletas.filter((c) => c.data === hoje);
    const rotasAbertas = dados.rotas.filter((r) => r.status === 'atribuida' || r.status === 'andamento');
    return {
      volumesHoje: coletasHoje.reduce((s, c) => s + (Number(c.qtdInformada) || 0), 0),
      aEntregar: rotasAbertas.reduce(
        (s, r) => s + Math.max(0, (Number(r.qtdAtribuida) || 0) - (Number(r.qtdConcluida) || 0)), 0
      ),
    };
  }, [dados]);

  function avisar(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  }

  if (erroAcesso) {
    return (
      <div className="mb-wrap">
        <style>{ENT_CSS}{MB_CSS}</style>
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
      <style>{ENT_CSS}{MB_CSS}</style>

      <header className="mb-top">
        <div>
          <div className="mb-hello">Olá, {String(nome).split(' ')[0]}</div>
          <div className="mb-emp">{company?.nome || 'Empresa'}</div>
        </div>
        <button className="mb-sair" onClick={logout} aria-label="Sair"><LogOut size={18} /></button>
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
          <Perfil perfil={dados.perfil} user={user} bases={dados.bases}
            coletas={dados.coletas} rotas={dados.rotas} />
        )}
      </main>

      {aba === 'coletas' && pronto && (
        <button className="mb-fab" onClick={() => setRegistrando(true)}>
          <Plus size={20} /> Registrar coleta
        </button>
      )}

      {registrando && (
        <RegistrarColeta
          dados={dados}
          companyId={company?.id}
          motoboyUid={user?.uid}
          motoboyId={motoboyId}
          motoboyNome={nome}
          onFechar={() => setRegistrando(false)}
          onSalvo={(qtd) => { setRegistrando(false); avisar(`${qtd} volumes registrados`); }}
        />
      )}

      {toast && <div className="mb-toast"><CheckCircle2 size={16} /> {toast}</div>}

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

// ------------------------------------------------------------
//   Registrar coleta
// ------------------------------------------------------------
//   Fluxo de três toques: escolhe a loja, ajusta a quantidade,
//   confirma. A base vem preenchida pela loja e continua
//   trocável — o motoboy às vezes precisa desviar para outra.
// ------------------------------------------------------------
function RegistrarColeta({ dados, companyId, motoboyUid, motoboyId, motoboyNome, onFechar, onSalvo }) {
  const ativos = (dados.lojistas || []).filter((l) => l.status !== 'inativo');
  const basesAtivas = (dados.bases || []).filter((b) => b.status !== 'inativa');

  const [lojistaId, setLojistaId] = useState('');
  const [baseId, setBaseId] = useState('');
  const [plataforma, setPlataforma] = useState('');
  const [qtd, setQtd] = useState(0);
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const lojista = ativos.find((l) => l.id === lojistaId);
  const base = basesAtivas.find((b) => b.id === baseId);

  function escolherLoja(id) {
    const l = ativos.find((x) => x.id === id);
    setLojistaId(id);
    // Base pré-preenchida pela loja, mas continua editável: às vezes
    // o motoboy precisa desviar para outra base num dia atípico.
    if (l?.baseId) setBaseId(l.baseId);
    if (l?.plataforma) setPlataforma(l.plataforma);
    setErro('');
  }

  async function salvar() {
    setErro('');
    setSalvando(true);
    try {
      await criarColetaMotoboy(companyId, {
        motoboyUid, motoboyId, motoboyNome,
        lojistaId, lojistaNome: lojista?.nome || '',
        plataforma, baseId, baseNome: base?.nome || '',
        quantidade: qtd, obs,
      });
      onSalvo(qtd);
    } catch (e) {
      console.error('[coleta]', e);
      setErro(e?.message || 'Não foi possível registrar. Tente de novo.');
      setSalvando(false);
    }
  }

  const plataformas = dados.config?.plataformas || [];

  return (
    <div className="mb-full">
      <header className="mb-full-h">
        <button onClick={onFechar}>Cancelar</button>
        <span>Registrar coleta</span>
        <span style={{ width: 62 }} />
      </header>

      <div className="mb-full-b">
        <SeletorGrande
          label="Loja"
          valor={lojistaId}
          onChange={escolherLoja}
          placeholder="Escolher a loja"
          vazioMsg="Nenhuma loja cadastrada. Fale com o responsável."
          opcoes={ativos.map((l) => ({ valor: l.id, rotulo: l.nome, sub: l.regiao || l.plataforma }))}
        />

        <SeletorGrande
          label="Base de destino"
          valor={baseId}
          onChange={setBaseId}
          placeholder="Escolher a base"
          vazioMsg="Nenhuma base cadastrada. Fale com o responsável."
          opcoes={basesAtivas.map((b) => ({
            valor: b.id, rotulo: b.nome,
            sub: b.tipo === 'parceira' ? 'Parceira' : 'Própria',
          }))}
        />

        {plataformas.length > 1 && (
          <SeletorGrande
            label="Plataforma"
            valor={plataforma}
            onChange={setPlataforma}
            placeholder="Escolher"
            opcoes={plataformas.map((p) => ({ valor: p, rotulo: p }))}
          />
        )}

        <div className="mb-qtd-box">
          <span className="sg-lbl">Quantidade de volumes</span>
          <div className="mb-contador">
            <button onClick={() => setQtd((q) => Math.max(0, q - 1))} aria-label="Menos"><Minus size={22} /></button>
            <input
              className="mb-qtd-in"
              inputMode="numeric"
              value={qtd}
              onChange={(e) => setQtd(Math.max(0, Math.round(Number(e.target.value.replace(/\D/g, '')) || 0)))}
            />
            <button onClick={() => setQtd((q) => q + 1)} aria-label="Mais"><Plus size={22} /></button>
          </div>
          <div className="mb-atalhos">
            {[10, 20, 50].map((n) => (
              <button key={n} onClick={() => setQtd((q) => q + n)}>+{n}</button>
            ))}
            {qtd > 0 && <button className="limpar" onClick={() => setQtd(0)}>Zerar</button>}
          </div>
        </div>

        <label className="sg">
          <span className="sg-lbl">Observação (opcional)</span>
          <input className="mb-inp" value={obs} onChange={(e) => setObs(e.target.value)}
            placeholder="Ex.: dois pacotes danificados" />
        </label>

        {erro && <div className="mb-alerta" style={{ margin: '4px 0 0' }}><AlertTriangle size={15} /> {erro}</div>}

        <p className="mb-aviso-conf">
          O responsável vai confirmar essa quantidade com a loja. Registre o que você realmente retirou.
        </p>
      </div>

      <div className="mb-full-f">
        <button className="mb-btn-grande" disabled={salvando || !lojistaId || !baseId || qtd <= 0} onClick={salvar}>
          {salvando ? <Loader2 size={19} className="mb-spin" /> : <><Check size={19} /> Confirmar coleta</>}
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
function ListaColetas({ coletas, lojistas }) {
  const nomeLojista = (c) => lojistas.find((l) => l.id === c.lojistaId)?.nome || c.lojistaNome || 'Loja';
  const ordenadas = [...coletas].sort((a, b) =>
    `${b.data} ${b.hora || ''}`.localeCompare(`${a.data} ${a.hora || ''}`));

  if (!ordenadas.length) {
    return <Vazio icon={Inbox} titulo="Nenhuma coleta registrada"
      sub="Toque em Registrar coleta assim que retirar os pacotes." />;
  }

  return (
    <div className="mb-lista">
      {ordenadas.map((c) => (
        <article key={c.id} className="mb-item">
          <div className="mb-item-top">
            <span className="mb-item-nome">{nomeLojista(c)}</span>
            <Chip lista={COLETA_STATUS} k={statusConciliacao(c)} />
          </div>
          <div className="mb-item-linha">
            <strong className="mb-qtd">{c.qtdInformada || 0}</strong>
            <span className="mb-un">volumes</span>
            <span className="mb-data"><Clock size={13} /> {fmtData(c.data)} {c.hora}</span>
          </div>
          {c.baseNome && <div className="mb-item-sub">Base: {c.baseNome}</div>}
          {c.qtdConfirmada != null && c.qtdConfirmada !== c.qtdInformada && (
            <div className="mb-item-sub" style={{ color: '#B91C1C' }}>
              Loja confirmou {c.qtdConfirmada}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function ListaRotas({ rotas, bases }) {
  const nomeBase = (id) => bases.find((b) => b.id === id)?.nome || '';
  const ordenadas = [...rotas].sort((a, b) => String(b.data).localeCompare(String(a.data)));

  if (!ordenadas.length) {
    return <Vazio icon={Bike} titulo="Nenhuma rota atribuída"
      sub="Quando a base separar os pacotes, sua rota aparece aqui." />;
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

function Perfil({ perfil, user, bases, coletas, rotas }) {
  const totalColetado = coletas.reduce((s, c) => s + (Number(c.qtdInformada) || 0), 0);
  const totalEntregue = rotas.reduce((s, r) => s + (Number(r.qtdConcluida) || 0), 0);
  const base = bases.find((b) => b.id === perfil?.baseId);
  const infos = [
    perfil?.regiao && `Região: ${perfil.regiao}`,
    base?.nome && `Base: ${base.nome}`,
    perfil?.telefone,
  ].filter(Boolean);

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

      {!!infos.length && (
        <div className="mb-perfil-infos">
          {infos.map((t, i) => (
            <div key={i} className="mb-perfil-info"><CheckCircle2 size={14} /> {t}</div>
          ))}
        </div>
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

.mb-cards{ display:grid; grid-template-columns:1fr 1fr; gap:10px; padding:0 14px; margin-top:-14px; }
.mb-card{ background:#fff; border:1px solid #E5E7EB; border-radius:15px; padding:13px 14px; box-shadow:0 4px 14px rgba(11,19,36,.06); display:flex; flex-direction:column; gap:2px; }
.mb-card-num{ font-size:26px; font-weight:700; line-height:1.1; letter-spacing:-.02em; }
.mb-card-lbl{ font-size:11.5px; color:#6B7280; }

.mb-alerta{ margin:12px 14px 0; display:flex; align-items:center; gap:7px; background:#FEF3C7; border:1px solid #FDE68A; color:#92400E; padding:10px 12px; border-radius:11px; font-size:12.5px; }

.mb-main{ flex:1; padding:16px 14px 8px; }
.mb-lista{ display:flex; flex-direction:column; gap:10px; padding-bottom:64px; }
.mb-item{ background:#fff; border:1px solid #E5E7EB; border-radius:15px; padding:13px 14px; }
.mb-item-top{ display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
.mb-item-nome{ font-weight:600; font-size:14.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.mb-item-linha{ display:flex; align-items:baseline; gap:6px; flex-wrap:wrap; }
.mb-qtd{ font-size:21px; font-weight:700; letter-spacing:-.02em; }
.mb-un{ font-size:12.5px; color:#6B7280; }
.mb-data{ margin-left:auto; display:inline-flex; align-items:center; gap:4px; font-size:12px; color:#6B7280; }
.mb-item-sub{ margin-top:7px; font-size:12px; color:#6B7280; }
.mb-barra{ height:6px; background:#F1F2F4; border-radius:999px; overflow:hidden; margin-top:10px; }
.mb-barra-in{ height:100%; background:var(--color-accent,#1D4ED8); border-radius:999px; transition:width .3s ease; }

.mb-center{ display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:60px 24px; text-align:center; }
.mb-msg{ font-size:14px; color:#6B7280; margin:0; max-width:280px; }
.mb-spin{ animation:mb-rot 1s linear infinite; }
@keyframes mb-rot{ to{ transform:rotate(360deg);} }

.mb-perfil{ background:#fff; border:1px solid #E5E7EB; border-radius:16px; padding:22px 16px; text-align:center; }
.mb-avatar{ width:60px; height:60px; border-radius:50%; background:var(--color-primary,#0B1533); color:#fff; display:flex; align-items:center; justify-content:center; margin:0 auto 10px; }
.mb-perfil-nome{ font-size:17px; font-weight:650; }
.mb-perfil-mail{ font-size:12.5px; color:#6B7280; margin-top:2px; }
.mb-perfil-grid{ display:grid; grid-template-columns:1fr 1fr; gap:9px; margin:18px 0 6px; }
.mb-mini{ background:#F9FAFB; border:1px solid #F1F2F4; border-radius:12px; padding:11px 8px; }
.mb-mini span{ display:block; font-size:19px; font-weight:700; letter-spacing:-.02em; }
.mb-mini small{ font-size:10.5px; color:#6B7280; }
.mb-perfil-infos{ display:flex; flex-direction:column; align-items:center; gap:6px; margin-top:12px; }
.mb-perfil-info{ display:inline-flex; align-items:center; gap:6px; font-size:12.5px; color:#6B7280; }

.mb-btn{ display:inline-flex; align-items:center; justify-content:center; gap:7px; padding:12px 18px; border-radius:12px; font-size:14px; font-weight:600; border:0; cursor:pointer; }
.mb-btn-ghost{ background:#E5E7EB; color:#0B1324; }

.mb-fab{ position:fixed; left:14px; right:14px; bottom:calc(84px + env(safe-area-inset-bottom)); display:flex; align-items:center; justify-content:center; gap:8px; padding:16px; border-radius:15px; border:0; background:var(--color-primary,#0B1533); color:#fff; font-size:16px; font-weight:650; cursor:pointer; box-shadow:0 8px 22px rgba(11,19,36,.28); z-index:35; font-family:inherit; }
.mb-fab:active{ transform:scale(.99); }

.mb-toast{ position:fixed; left:14px; right:14px; bottom:calc(150px + env(safe-area-inset-bottom)); background:#065F46; color:#fff; padding:13px 15px; border-radius:13px; font-size:13.5px; display:flex; align-items:center; gap:8px; z-index:90; }

.mb-full{ position:fixed; inset:0; background:var(--color-background,#F3F4F6); z-index:70; display:flex; flex-direction:column; font-family:'Geist',system-ui,sans-serif; color:#0B1324; }
.mb-full-h{ display:flex; align-items:center; justify-content:space-between; padding:15px 16px; background:#fff; border-bottom:1px solid #E5E7EB; font-size:15px; font-weight:650; }
.mb-full-h button{ background:transparent; border:0; color:#6B7280; font-size:14px; cursor:pointer; font-family:inherit; padding:0; width:62px; text-align:left; }
.mb-full-b{ flex:1; overflow-y:auto; padding:18px 16px 24px; }
.mb-full-f{ padding:12px 16px calc(14px + env(safe-area-inset-bottom)); background:#fff; border-top:1px solid #E5E7EB; }
.mb-btn-grande{ width:100%; display:flex; align-items:center; justify-content:center; gap:8px; padding:17px; border-radius:15px; border:0; background:var(--color-primary,#0B1533); color:#fff; font-size:16.5px; font-weight:650; cursor:pointer; font-family:inherit; }
.mb-btn-grande:disabled{ background:#D1D5DB; color:#9CA3AF; cursor:not-allowed; }

.mb-qtd-box{ margin-bottom:15px; }
.mb-contador{ display:flex; align-items:center; gap:10px; }
.mb-contador button{ width:56px; height:56px; border-radius:14px; border:1.5px solid #D1D5DB; background:#fff; color:#0B1324; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; }
.mb-contador button:active{ background:#F3F4F6; }
.mb-qtd-in{ flex:1; min-width:0; height:56px; border:1.5px solid #D1D5DB; border-radius:14px; text-align:center; font-size:30px; font-weight:700; letter-spacing:-.02em; color:#0B1324; background:#fff; font-family:inherit; }
.mb-qtd-in:focus{ outline:none; border-color:var(--color-primary,#0B1533); }
.mb-atalhos{ display:flex; gap:7px; margin-top:9px; flex-wrap:wrap; }
.mb-atalhos button{ padding:9px 15px; border-radius:11px; border:1px solid #D1D5DB; background:#fff; font-size:14px; font-weight:600; color:#374151; cursor:pointer; font-family:inherit; }
.mb-atalhos .limpar{ color:#B91C1C; border-color:#FECACA; margin-left:auto; font-weight:500; }

.mb-inp{ width:100%; padding:14px 15px; border-radius:14px; border:1.5px solid #D1D5DB; font-size:15.5px; background:#fff; color:#0B1324; font-family:inherit; }
.mb-inp:focus{ outline:none; border-color:var(--color-primary,#0B1533); }
.mb-aviso-conf{ margin-top:14px; font-size:12.5px; color:#6B7280; background:#fff; border:1px solid #E5E7EB; border-radius:12px; padding:12px 13px; }

.mb-nav{ position:fixed; left:0; right:0; bottom:0; background:#fff; border-top:1px solid #E5E7EB; display:grid; grid-template-columns:repeat(3,1fr); padding:6px 4px calc(6px + env(safe-area-inset-bottom)); z-index:40; }
.mb-nav-b{ background:transparent; border:0; display:flex; flex-direction:column; align-items:center; gap:3px; padding:9px 4px; color:#9CA3AF; font-size:11px; font-weight:500; cursor:pointer; border-radius:12px; font-family:inherit; }
.mb-nav-b.on{ color:var(--color-primary,#0B1533); }
`;
