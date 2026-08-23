import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut, updateProfile,
} from 'firebase/auth';
import {
  doc, getDoc, setDoc, updateDoc, collection, serverTimestamp, arrayUnion,
} from 'firebase/firestore';
import { auth, fdb } from '../firebase';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function friendly(err) {
  const c = err?.code || '';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'E-mail ou senha inválidos.';
  if (c.includes('email-already-in-use')) return 'Este e-mail já está cadastrado.';
  if (c.includes('weak-password')) return 'Senha muito fraca (mínimo 6 caracteres).';
  if (c.includes('invalid-email')) return 'E-mail inválido.';
  if (c.includes('too-many-requests')) return 'Muitas tentativas. Tente novamente em alguns minutos.';
  if (c.includes('network-request-failed')) return 'Falha de conexão. Verifique sua internet.';
  return err?.message || 'Erro inesperado.';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [company, setCompany] = useState(null);
  const [modulosPermitidos, setModulosPermitidos] = useState(null); // null = sem restrição
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null); // 'owner' | 'socio' | 'member' | 'motoboy'
  const [motoboyId, setMotoboyId] = useState(null);
  const [erroAcesso, setErroAcesso] = useState('');

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) {
          setUser(null); setProfile(null); setCompany(null);
          setModulosPermitidos(null); setRole(null); setMotoboyId(null); setErroAcesso('');
          setLoading(false); return;
        }
        setUser({ uid: u.uid, email: u.email, displayName: u.displayName });
        const profSnap = await getDoc(doc(fdb, 'users', u.uid));
        if (profSnap.exists()) {
          const prof = { id: u.uid, ...profSnap.data() };
          setProfile(prof);
          if (prof.companyId) {
            const compSnap = await getDoc(doc(fdb, 'companies', prof.companyId));
            const comp = compSnap.exists() ? { id: compSnap.id, ...compSnap.data() } : null;
            setCompany(comp);

            if (comp) {
              const memRef = doc(fdb, 'companies', prof.companyId, 'members', u.uid);
              const memSnap = await getDoc(memRef);
              if (memSnap.exists()) {
                const md = memSnap.data();
                const modulos = md.modulosPermitidos;
                setModulosPermitidos(modulos === undefined ? null : modulos);
                setRole(comp.ownerUid === u.uid ? 'owner' : (md.role || 'member'));
                setMotoboyId(md.motoboyId || null);
              } else if (prof.role === 'motoboy') {
                // ------------------------------------------------------------
                // SEGURANÇA: não recriamos o doc de membro de um motoboy.
                // O bloco de retrocompatibilidade abaixo cria o membro com
                // modulosPermitidos = null, que no app significa "vê tudo".
                // Se o doc de um motoboy sumisse, ele viraria membro pleno no
                // login seguinte. Aqui a conta simplesmente não abre e o dono
                // precisa reemitir o convite.
                // ------------------------------------------------------------
                setModulosPermitidos([]);
                setRole('motoboy');
                setMotoboyId(prof.motoboyId || null);
                setErroAcesso('Seu acesso precisa ser reativado. Peça um novo convite ao responsável.');
              } else {
                // Retrocompat: usuário antigo, anterior ao doc de membro.
                const isOwnerHere = comp.ownerUid === u.uid;
                await setDoc(memRef, {
                  nome: prof.nome || u.displayName || '',
                  email: u.email || '',
                  role: isOwnerHere ? 'owner' : (prof.role || 'member'),
                  modulosPermitidos: null,
                  joinedAt: serverTimestamp(),
                });
                setModulosPermitidos(null);
                setRole(isOwnerHere ? 'owner' : 'member');
              }
            } else {
              setModulosPermitidos(null);
            }
          } else {
            setCompany(null); setModulosPermitidos(null);
          }
        } else {
          setProfile(null); setCompany(null); setModulosPermitidos(null);
        }
      } catch (e) {
        console.error('[Auth] load error:', e);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const isOwner = !!(user && company && user.uid === company.ownerUid);
  const papel = isOwner ? 'owner' : (role || 'member');
  const isSocio = papel === 'socio';
  const isMotoboy = papel === 'motoboy';
  // Quem enxerga o negócio inteiro (dono e sócio). Motoboy nunca.
  const isGestor = (isOwner || isSocio) && !isMotoboy;

  async function signup({ nome, email, senha, empresaNome, codigoEmpresa }) {
    try {
      const codigo = (codigoEmpresa || '').trim();
      const entrando = !!codigo;

      if (codigo.toUpperCase().startsWith('MB-')) {
        throw new Error('Esse é um convite de motoboy. Use a opção "Sou motoboy" na tela de cadastro.');
      }

      const cred = await createUserWithEmailAndPassword(auth, email, senha);
      await updateProfile(cred.user, { displayName: nome });
      const uid = cred.user.uid;

      let companyId = codigo;

      if (entrando) {
        try {
          await updateDoc(doc(fdb, 'companies', companyId), { members: arrayUnion(uid) });
        } catch (joinErr) {
          try { await cred.user.delete(); } catch (_) {}
          throw new Error('Código de convite inválido. Confira com o dono da empresa.');
        }
      } else {
        const newRef = doc(collection(fdb, 'companies'));
        companyId = newRef.id;
        await setDoc(newRef, {
          nome: empresaNome || 'Minha Empresa',
          ownerUid: uid,
          members: [uid],
          createdAt: serverTimestamp(),
        });
        await setDoc(doc(fdb, 'companies', companyId, 'settings', 'main'), {
          nomeEmpresa: empresaNome || 'Minha Empresa',
          precoCombustivel: 5.89,
          consumoPadrao: 10,
        });
      }

      await setDoc(doc(fdb, 'users', uid), {
        nome, email, companyId,
        role: entrando ? 'member' : 'owner',
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(fdb, 'companies', companyId, 'members', uid), {
        nome, email,
        role: entrando ? 'member' : 'owner',
        modulosPermitidos: null,
        joinedAt: serverTimestamp(),
      });
    } catch (e) {
      throw new Error(friendly(e));
    }
  }

  // ============================================================
  //   CADASTRO DE MOTOBOY — por convite pessoal (MB-XXXXXX)
  // ------------------------------------------------------------
  //   Diferente do cadastro comum: aqui o código NÃO é o id da
  //   empresa. É a chave de um doc em `convites/{codigo}`, que
  //   aponta para a empresa e para o cadastro do motoboy.
  //
  //   A conta nasce travada: role 'motoboy' e modulosPermitidos
  //   ['entregas']. Não existe a janela de "vê tudo até o dono
  //   restringir" que o cadastro comum tem.
  //
  //   O convite é de uso único e é queimado no fim do processo.
  // ============================================================
  async function signupMotoboy({ nome, email, senha, codigo }) {
    const cod = (codigo || '').trim().toUpperCase();
    if (!cod) throw new Error('Informe o código do convite.');

    let cred = null;
    try {
      // 1) Autentica primeiro — sem login, nenhuma leitura passa nas regras.
      cred = await createUserWithEmailAndPassword(auth, email, senha);
      await updateProfile(cred.user, { displayName: nome });
      const uid = cred.user.uid;

      // 2) Valida o convite.
      const convRef = doc(fdb, 'convites', cod);
      const convSnap = await getDoc(convRef);
      if (!convSnap.exists()) throw new Error('Convite não encontrado. Confira o código com o responsável.');
      const conv = convSnap.data();
      if (conv.usado) throw new Error('Este convite já foi utilizado. Peça um novo ao responsável.');
      if (!conv.cid || !conv.motoboyId) throw new Error('Convite inválido. Peça um novo ao responsável.');

      // 3) Entra na empresa.
      await updateDoc(doc(fdb, 'companies', conv.cid), { members: arrayUnion(uid) });

      // 4) Perfil e membro — já com o papel travado.
      await setDoc(doc(fdb, 'users', uid), {
        nome, email,
        companyId: conv.cid,
        role: 'motoboy',
        motoboyId: conv.motoboyId,
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(fdb, 'companies', conv.cid, 'members', uid), {
        nome, email,
        role: 'motoboy',
        modulosPermitidos: ['entregas'],
        motoboyId: conv.motoboyId,
        conviteCodigo: cod,
        joinedAt: serverTimestamp(),
      });

      // 5) Queima o convite (uso único).
      await updateDoc(convRef, { usado: true, usadoPor: uid, usadoEm: serverTimestamp() });
    } catch (e) {
      // Qualquer falha no meio do caminho: remove a conta recém-criada para
      // não deixar usuário órfão sem empresa.
      if (cred?.user) { try { await cred.user.delete(); } catch (_) {} }
      throw new Error(friendly(e));
    }
  }

  async function login(email, senha) {
    try { return await signInWithEmailAndPassword(auth, email, senha); }
    catch (e) { throw new Error(friendly(e)); }
  }
  async function resetPassword(email) {
    try { return await sendPasswordResetEmail(auth, email); }
    catch (e) { throw new Error(friendly(e)); }
  }
  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{
      user, profile, company, modulosPermitidos, isOwner, papel, isSocio, isGestor,
      isMotoboy, motoboyId, erroAcesso, loading,
      signup, signupMotoboy, login, resetPassword, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
