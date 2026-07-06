import { useState } from 'react';
import { Truck, Mail, Lock, User, Building2, KeyRound, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from './AuthContext';

export function AuthGate({ children }) {
  const { user, profile, company, loading } = useAuth();
  const [mode, setMode] = useState('login'); // login | signup | reset

  if (loading) return <SplashLoading />;
  if (user && profile && company) return children;

  // User is authenticated but doesn't have a profile/company yet (edge case)
  // Default to showing login (signed-in users get logged out via Firebase rules)
  return (
    <div className="auth-wrap">
      <style>{AUTH_CSS}</style>
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo"><Truck size={22} /></div>
          <div>
            <div className="auth-app">Gestão GSO</div>
            <div className="auth-sub">Sistema de gestão para transportes</div>
          </div>
        </div>
        {mode === 'login' && <LoginForm onSwitch={setMode} />}
        {mode === 'signup' && <SignupForm onSwitch={setMode} />}
        {mode === 'reset' && <ResetForm onSwitch={setMode} />}
      </div>
    </div>
  );
}

function SplashLoading() {
  return (
    <div className="auth-wrap">
      <style>{AUTH_CSS}</style>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, color: '#9FB2D4' }}>
        <div className="auth-logo" style={{ width: 56, height: 56 }}><Truck size={26} /></div>
        <Loader2 size={20} className="auth-spin" />
        <div style={{ fontSize: 13 }}>Carregando…</div>
      </div>
    </div>
  );
}

function LoginForm({ onSwitch }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr('');
    if (!email || !senha) { setErr('Preencha e-mail e senha.'); return; }
    setBusy(true);
    try { await login(email, senha); } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <h2 className="auth-title">Entrar</h2>
      <p className="auth-lead">Acesse o painel da sua empresa.</p>
      <AField icon={Mail} type="email" label="E-mail" value={email} onChange={setEmail} placeholder="seu@email.com" />
      <AField icon={Lock} type="password" label="Senha" value={senha} onChange={setSenha} placeholder="••••••••" onEnter={submit} />
      {err && <div className="auth-err">{err}</div>}
      <button onClick={submit} disabled={busy} className="auth-btn">
        {busy ? <Loader2 size={16} className="auth-spin" /> : <>Entrar <ArrowRight size={16} /></>}
      </button>
      <div className="auth-row">
        <button onClick={() => onSwitch('reset')} className="auth-link">Esqueci minha senha</button>
        <button onClick={() => onSwitch('signup')} className="auth-link">Criar conta</button>
      </div>
    </>
  );
}

function SignupForm({ onSwitch }) {
  const { signup } = useAuth();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [senha2, setSenha2] = useState('');
  const [empresaNome, setEmpresaNome] = useState('');
  const [codigoEmpresa, setCodigoEmpresa] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr('');
    if (!nome || !email || !senha) { setErr('Preencha nome, e-mail e senha.'); return; }
    if (senha.length < 6) { setErr('Senha precisa ter ao menos 6 caracteres.'); return; }
    if (senha !== senha2) { setErr('As senhas não coincidem.'); return; }
    if (!codigoEmpresa.trim() && !empresaNome.trim()) { setErr('Informe o nome da empresa OU o código de convite.'); return; }
    setBusy(true);
    try { await signup({ nome, email, senha, empresaNome, codigoEmpresa }); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <h2 className="auth-title">Criar conta</h2>
      <p className="auth-lead">Crie sua empresa ou entre em uma existente via código.</p>
      <AField icon={User} label="Nome" value={nome} onChange={setNome} placeholder="Seu nome completo" />
      <AField icon={Mail} type="email" label="E-mail" value={email} onChange={setEmail} placeholder="seu@email.com" />
      <AField icon={Lock} type="password" label="Senha" value={senha} onChange={setSenha} placeholder="mínimo 6 caracteres" />
      <AField icon={Lock} type="password" label="Confirmar senha" value={senha2} onChange={setSenha2} placeholder="repita a senha" />
      <div className="auth-or">— ou —</div>
      <AField icon={Building2} label="Nome da empresa (para criar nova)" value={empresaNome} onChange={setEmpresaNome} placeholder="GSO Transportes" />
      <AField icon={KeyRound} label="Código da empresa (para entrar em existente)" value={codigoEmpresa} onChange={setCodigoEmpresa} placeholder="cole o código compartilhado" onEnter={submit} />
      {err && <div className="auth-err">{err}</div>}
      <button onClick={submit} disabled={busy} className="auth-btn">
        {busy ? <Loader2 size={16} className="auth-spin" /> : <>Criar conta <ArrowRight size={16} /></>}
      </button>
      <div className="auth-row" style={{ justifyContent: 'center' }}>
        <span className="auth-mute">Já tem conta?</span>
        <button onClick={() => onSwitch('login')} className="auth-link">Entrar</button>
      </div>
    </>
  );
}

function ResetForm({ onSwitch }) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(''); setMsg('');
    if (!email) { setErr('Informe o e-mail.'); return; }
    setBusy(true);
    try { await resetPassword(email); setMsg('Enviamos um link de redefinição para seu e-mail.'); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <h2 className="auth-title">Recuperar senha</h2>
      <p className="auth-lead">Informe seu e-mail e enviaremos um link de redefinição.</p>
      <AField icon={Mail} type="email" label="E-mail" value={email} onChange={setEmail} placeholder="seu@email.com" onEnter={submit} />
      {err && <div className="auth-err">{err}</div>}
      {msg && <div className="auth-ok">{msg}</div>}
      <button onClick={submit} disabled={busy} className="auth-btn">
        {busy ? <Loader2 size={16} className="auth-spin" /> : <>Enviar link <ArrowRight size={16} /></>}
      </button>
      <div className="auth-row" style={{ justifyContent: 'center' }}>
        <button onClick={() => onSwitch('login')} className="auth-link">Voltar para login</button>
      </div>
    </>
  );
}

function AField({ icon: Icon, label, value, onChange, type = 'text', placeholder, onEnter }) {
  return (
    <label className="auth-fld">
      <span className="auth-lbl">{label}</span>
      <span className="auth-inp">
        <Icon size={15} />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) onEnter(); }}
          autoComplete={type === 'password' ? 'current-password' : 'off'}
        />
      </span>
    </label>
  );
}

const AUTH_CSS = `
.auth-wrap{ min-height:100vh; min-height:100dvh; background:radial-gradient(circle at 20% 0%, #182952 0%, #0B1533 55%, #060B1F 100%); display:flex; align-items:center; justify-content:center; padding:24px 16px; font-family:'Geist', system-ui, sans-serif; }
.auth-card{ width:100%; max-width:420px; background:rgba(255,255,255,.04); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,.08); border-radius:18px; padding:28px 24px; box-shadow:0 20px 60px rgba(0,0,0,.4); }
.auth-brand{ display:flex; align-items:center; gap:12px; margin-bottom:22px; }
.auth-logo{ width:42px; height:42px; border-radius:11px; background:linear-gradient(135deg,#1D4ED8,#0EA5E9); display:flex; align-items:center; justify-content:center; color:#fff; flex-shrink:0; }
.auth-app{ color:#fff; font-weight:700; font-size:16px; letter-spacing:-.01em; }
.auth-sub{ color:#9FB2D4; font-size:11px; }
.auth-title{ color:#fff; font-family:'Fraunces', serif; font-size:24px; font-weight:600; margin:0 0 4px; }
.auth-lead{ color:#9FB2D4; font-size:13px; margin:0 0 18px; }
.auth-fld{ display:block; margin-bottom:12px; }
.auth-lbl{ display:block; color:#9FB2D4; font-size:10.5px; text-transform:uppercase; letter-spacing:.05em; font-weight:500; margin-bottom:5px; }
.auth-inp{ display:flex; align-items:center; gap:9px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.10); border-radius:10px; padding:10px 12px; color:#9FB2D4; transition:border-color .15s ease, background .15s ease; }
.auth-inp:focus-within{ border-color:rgba(93,162,255,.55); background:rgba(255,255,255,.07); }
.auth-inp input{ flex:1; min-width:0; background:transparent; border:0; outline:none; color:#fff; font-size:14px; font-family:inherit; }
.auth-inp input::placeholder{ color:#5B6B8C; }
.auth-or{ text-align:center; color:#5B6B8C; font-size:11px; margin:10px 0; letter-spacing:.06em; }
.auth-btn{ display:flex; align-items:center; justify-content:center; gap:7px; width:100%; padding:11px 14px; border-radius:10px; background:linear-gradient(135deg,#1D4ED8,#0EA5E9); color:#fff; font-weight:600; font-size:14px; border:0; cursor:pointer; margin-top:8px; transition:transform .15s ease, box-shadow .15s ease; }
.auth-btn:hover:not(:disabled){ transform:translateY(-1px); box-shadow:0 10px 24px rgba(29,78,216,.35); }
.auth-btn:active:not(:disabled){ transform:scale(.99); }
.auth-btn:disabled{ opacity:.7; cursor:wait; }
.auth-row{ display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:14px; flex-wrap:wrap; }
.auth-link{ color:#7AB7FF; font-size:12.5px; background:transparent; border:0; cursor:pointer; padding:4px 0; font-family:inherit; }
.auth-link:hover{ color:#A4CCFF; text-decoration:underline; }
.auth-mute{ color:#5B6B8C; font-size:12.5px; }
.auth-err{ background:rgba(180,35,75,.15); border:1px solid rgba(180,35,75,.35); color:#FFB3C2; padding:9px 12px; border-radius:8px; font-size:12.5px; margin-top:4px; }
.auth-ok{ background:rgba(8,127,91,.15); border:1px solid rgba(8,127,91,.35); color:#7EE7C2; padding:9px 12px; border-radius:8px; font-size:12.5px; margin-top:4px; }
.auth-spin{ animation:auth-rot 1s linear infinite; }
@keyframes auth-rot{ to{ transform:rotate(360deg);} }
`;
