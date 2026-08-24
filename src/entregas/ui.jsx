import { Component, useState } from 'react';
import { X, AlertTriangle, ChevronDown, Check } from 'lucide-react';

// ============================================================
//   Primitivos compartilhados do módulo Entregas
//   Ficam aqui para que Lojistas, Bases, Coletas e Config usem
//   o mesmo visual sem duplicar código nem depender do App.jsx.
// ============================================================

export function ModalBase({ titulo, children, onFechar, largo }) {
  return (
    <div className="ent-ov" onClick={onFechar}>
      <div className={`ent-modal${largo ? ' largo' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="ent-modal-h">
          <h3>{titulo}</h3>
          <button className="ent-x" onClick={onFechar} aria-label="Fechar"><X size={17} /></button>
        </div>
        <div className="ent-modal-b">{children}</div>
      </div>
    </div>
  );
}

export function Campo({ label, children, span = 1, dica }) {
  return (
    <label className={span === 2 ? 'sm:col-span-2' : ''}>
      <span className="ent-lbl">{label}</span>
      {children}
      {dica && <span className="ent-dica">{dica}</span>}
    </label>
  );
}

export function ModalConfirma({ titulo, mensagem, rotulo = 'Excluir', onCancelar, onConfirmar }) {
  return (
    <ModalBase titulo={titulo} onFechar={onCancelar}>
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{mensagem}</p>
      <div className="flex gap-2 justify-end mt-4">
        <button className="btn btn-ghost" onClick={onCancelar}>Cancelar</button>
        <button className="btn btn-danger" onClick={onConfirmar}>{rotulo}</button>
      </div>
    </ModalBase>
  );
}

export function Vazio({ icon: Icon, titulo, sub }) {
  return (
    <div className="ent-vazio">
      <Icon size={34} />
      <p className="ent-vazio-t">{titulo}</p>
      {sub && <p className="ent-vazio-s">{sub}</p>}
    </div>
  );
}

export function Chip({ lista, k }) {
  const s = lista.find((x) => x.k === k) || lista[0];
  if (!s) return null;
  return <span className="ent-chip" style={{ color: s.cor, background: s.bg }}>{s.label}</span>;
}

export function Aviso({ tipo = 'info', children }) {
  return <div className={`ent-aviso ${tipo}`}><AlertTriangle size={14} /> <span>{children}</span></div>;
}

// ------------------------------------------------------------
//   Seletor grande — pensado para a mão do motoboy na rua.
//   Alvo alto, texto grande, lista em folha que sobe de baixo.
// ------------------------------------------------------------
export function SeletorGrande({ label, valor, opcoes, onChange, placeholder = 'Selecione', vazioMsg }) {
  const [aberto, setAberto] = useState(false);
  const atual = opcoes.find((o) => o.valor === valor);

  return (
    <div className="sg">
      <span className="sg-lbl">{label}</span>
      <button className={`sg-botao${atual ? ' ok' : ''}`} onClick={() => setAberto(true)}>
        <span className="sg-txt">{atual ? atual.rotulo : placeholder}</span>
        <ChevronDown size={19} />
      </button>
      {atual?.sub && <span className="sg-sub">{atual.sub}</span>}

      {aberto && (
        <div className="sg-ov" onClick={() => setAberto(false)}>
          <div className="sg-folha" onClick={(e) => e.stopPropagation()}>
            <div className="sg-folha-h">
              <span>{label}</span>
              <button onClick={() => setAberto(false)} aria-label="Fechar"><X size={19} /></button>
            </div>
            <div className="sg-folha-b">
              {!opcoes.length ? (
                <p className="sg-vazio">{vazioMsg || 'Nada cadastrado ainda.'}</p>
              ) : opcoes.map((o) => (
                <button
                  key={o.valor}
                  className={`sg-op${o.valor === valor ? ' on' : ''}`}
                  onClick={() => { onChange(o.valor); setAberto(false); }}
                >
                  <span className="sg-op-txt">
                    <strong>{o.rotulo}</strong>
                    {o.sub && <small>{o.sub}</small>}
                  </span>
                  {o.valor === valor && <Check size={18} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
//   Barreira de erro — mantém a falha contida no módulo em vez
//   de derrubar o React inteiro e deixar a tela branca.
// ------------------------------------------------------------
export class BarreiraErro extends Component {
  constructor(props) { super(props); this.state = { erro: null }; }
  static getDerivedStateFromError(erro) { return { erro }; }
  componentDidCatch(erro, info) { console.error('[Entregas]', erro, info); }
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
            <p className="ent-crash-dica">Copie a mensagem acima e envie ao suporte.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const uidLocal = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const hojeISO = () => new Date().toISOString().slice(0, 10);
export const agoraHora = () => new Date().toTimeString().slice(0, 5);

export const fmtData = (iso) => {
  if (!iso) return '—';
  const [a, m, d] = String(iso).split('-');
  return d ? `${d}/${m}/${a}` : iso;
};

export const fmtBRL = (v) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const ENT_CSS = `
.ent-tabs{ display:flex; gap:6px; overflow-x:auto; padding-bottom:2px; }
.ent-tab{ flex-shrink:0; padding:8px 14px; border-radius:11px; border:1px solid #E5E7EB; background:#fff; font-size:13px; font-weight:500; color:#6B7280; cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
.ent-tab.on{ background:var(--color-primary,#0B1533); border-color:var(--color-primary,#0B1533); color:#fff; }
.ent-tab:disabled{ opacity:.5; cursor:default; }
.ent-breve{ font-size:9.5px; text-transform:uppercase; letter-spacing:.04em; background:#F3F4F6; color:#9CA3AF; padding:2px 5px; border-radius:5px; }

.ent-busca{ display:flex; align-items:center; gap:8px; border:1px solid #D1D5DB; border-radius:12px; padding:2px 12px; color:#9CA3AF; margin-bottom:14px; }
.ent-busca .inp{ border:0; padding:6px 0; }
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
.ent-mb-acoes{ display:flex; gap:6px; margin-top:12px; flex-wrap:wrap; }
.ent-b-sm{ padding:7px 11px; font-size:12.5px; }
.ent-b-del{ color:#B91C1C; }

.ent-tarifa{ margin-top:10px; display:flex; align-items:center; gap:8px; background:#F9FAFB; border-radius:9px; padding:8px 10px; font-size:12px; color:#374151; flex-wrap:wrap; }
.ent-tarifa b{ color:#0B1324; }
.ent-tag-pad{ font-size:10px; background:#E5E7EB; color:#6B7280; padding:2px 6px; border-radius:5px; }

.ent-vazio{ text-align:center; padding:44px 20px; color:#9CA3AF; }
.ent-vazio-t{ margin-top:10px; font-size:14px; font-weight:600; color:#6B7280; }
.ent-vazio-s{ margin-top:3px; font-size:12.5px; }
.ent-aviso{ display:flex; align-items:flex-start; gap:7px; padding:9px 12px; border-radius:10px; font-size:12.5px; margin:10px 0; }
.ent-aviso.info{ background:#EFF6FF; border:1px solid #BFDBFE; color:#1D4ED8; }
.ent-aviso.erro{ background:#FEE2E2; border:1px solid #FECACA; color:#B91C1C; }
.ent-aviso.alerta{ background:#FEF3C7; border:1px solid #FDE68A; color:#92400E; }
.ent-erro{ display:flex; align-items:center; gap:7px; background:#FEE2E2; border:1px solid #FECACA; color:#B91C1C; padding:9px 12px; border-radius:10px; font-size:12.5px; margin:10px 0; }
.ent-nota{ margin-top:12px; font-size:11.5px; color:#6B7280; background:#F9FAFB; border-radius:9px; padding:9px 11px; }
.ent-dica{ display:block; font-size:11px; color:#9CA3AF; margin-top:4px; }

.ent-ov{ position:fixed; inset:0; background:rgba(11,19,36,.45); display:flex; align-items:center; justify-content:center; padding:16px; z-index:60; }
.ent-modal{ background:#fff; border-radius:17px; width:100%; max-width:520px; max-height:90vh; overflow:auto; }
.ent-modal.largo{ max-width:680px; }
.ent-modal-h{ display:flex; align-items:center; justify-content:space-between; padding:16px 18px; border-bottom:1px solid #F1F2F4; position:sticky; top:0; background:#fff; z-index:2; }
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

.ent-chip{ font-size:11px; font-weight:600; padding:4px 9px; border-radius:999px; white-space:nowrap; flex-shrink:0; }

.ent-tabela{ width:100%; border-collapse:collapse; font-size:13px; }
.ent-tabela th{ text-align:left; font-size:10.5px; text-transform:uppercase; letter-spacing:.04em; color:#6B7280; font-weight:600; padding:8px 10px; border-bottom:1px solid #F1F2F4; white-space:nowrap; }
.ent-tabela td{ padding:11px 10px; border-bottom:1px solid #F6F7F8; vertical-align:middle; }
.ent-tabela tr:last-child td{ border-bottom:0; }
.ent-scroll{ overflow-x:auto; }

.ent-conf{ border:1px solid #E5E7EB; border-radius:15px; padding:14px; background:#fff; }
.ent-conf-h{ display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
.ent-conf-nome{ font-size:15px; font-weight:650; }
.ent-conf-linhas{ margin:11px 0; display:flex; flex-direction:column; gap:5px; }
.ent-conf-l{ display:flex; align-items:center; gap:8px; font-size:12.5px; color:#374151; }
.ent-conf-l b{ min-width:34px; text-align:right; }
.ent-conf-tot{ display:flex; align-items:baseline; gap:7px; padding-top:10px; border-top:1px dashed #E5E7EB; }
.ent-conf-tot strong{ font-size:23px; letter-spacing:-.02em; }
.ent-conf-form{ display:flex; align-items:flex-end; gap:8px; margin-top:12px; flex-wrap:wrap; }
.ent-conf-form .inp{ max-width:120px; }
.ent-dif{ font-size:12px; font-weight:600; padding:4px 9px; border-radius:8px; }
.ent-dif.ok{ background:#D1FAE5; color:#047857; }
.ent-dif.ruim{ background:#FEE2E2; color:#B91C1C; }

.ent-crash{ background:#fff; border:1px solid #FECACA; border-radius:16px; padding:26px 22px; text-align:center; color:#6B7280; }
.ent-crash svg{ color:#DC2626; }
.ent-crash h3{ font-size:15.5px; font-weight:650; color:#0B1324; margin:12px 0 4px; }
.ent-crash p{ font-size:13px; margin:0; }
.ent-crash-msg{ margin:16px auto 0; max-width:560px; text-align:left; background:#FEF2F2; border:1px solid #FECACA; color:#991B1B; padding:12px 14px; border-radius:10px; font-size:12px; font-family:ui-monospace,monospace; white-space:pre-wrap; word-break:break-word; }
.ent-crash-dica{ margin-top:12px !important; font-size:12px; }

/* ---- Seletor grande (usado no app do motoboy) ---- */
.sg{ display:block; margin-bottom:15px; }
.sg-lbl{ display:block; font-size:11.5px; text-transform:uppercase; letter-spacing:.04em; color:#6B7280; font-weight:600; margin-bottom:6px; }
.sg-botao{ width:100%; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:15px 15px; border-radius:14px; border:1.5px solid #D1D5DB; background:#fff; font-size:16px; color:#9CA3AF; cursor:pointer; text-align:left; font-family:inherit; }
.sg-botao.ok{ color:#0B1324; font-weight:600; border-color:var(--color-primary,#0B1533); }
.sg-botao:active{ transform:scale(.995); }
.sg-txt{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sg-sub{ display:block; font-size:12px; color:#6B7280; margin-top:5px; }
.sg-ov{ position:fixed; inset:0; background:rgba(11,19,36,.5); z-index:80; display:flex; align-items:flex-end; }
.sg-folha{ background:#fff; width:100%; border-radius:20px 20px 0 0; max-height:78vh; display:flex; flex-direction:column; animation:sg-up .18s ease; }
@keyframes sg-up{ from{ transform:translateY(18px); opacity:.6; } to{ transform:none; opacity:1; } }
.sg-folha-h{ display:flex; align-items:center; justify-content:space-between; padding:16px 18px; border-bottom:1px solid #F1F2F4; font-size:13px; font-weight:650; text-transform:uppercase; letter-spacing:.04em; color:#6B7280; }
.sg-folha-h button{ background:transparent; border:0; color:#6B7280; cursor:pointer; padding:2px; }
.sg-folha-b{ overflow-y:auto; padding:8px 10px calc(14px + env(safe-area-inset-bottom)); }
.sg-op{ width:100%; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:14px 13px; border:0; background:transparent; border-radius:12px; cursor:pointer; text-align:left; font-family:inherit; color:#0B1324; }
.sg-op:active{ background:#F3F4F6; }
.sg-op.on{ background:#EFF6FF; color:var(--color-primary,#0B1533); }
.sg-op-txt{ display:flex; flex-direction:column; gap:2px; min-width:0; }
.sg-op-txt strong{ font-size:15.5px; font-weight:600; }
.sg-op-txt small{ font-size:12px; color:#6B7280; }
.sg-vazio{ padding:30px 16px; text-align:center; color:#9CA3AF; font-size:13.5px; }
`;
