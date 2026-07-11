import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut, updateProfile,
} from 'firebase/auth';
import {
  doc, getDoc, setDoc, collection, serverTimestamp, updateDoc, arrayUnion,
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

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) { setUser(null); setProfile(null); setCompany(null); setModulosPermitidos(null); setLoading(false); return; }
        setUser({ uid: u.uid, email: u.email, displayName: u.displayName });
        const profSnap = await getDoc(doc(fdb, 'users', u.uid));
        if (profSnap.exists()) {
          const prof = { id: u.uid, ...profSnap.data() };
          setProfile(prof);
          if (prof.companyId) {
            const compSnap = await getDoc(doc(fdb, 'companies', prof.companyId));
            const comp = compSnap.exists() ? { id: compSnap.id, ...compSnap.data() } : null;
            setCompany(comp);

            // Load or create own member doc (permissions)
            if (comp) {
              const memRef = doc(fdb, 'companies', prof.companyId, 'members', u.uid);
              const memSnap = await getDoc(memRef);
              if (memSnap.exists()) {
                const modulos = memSnap.data().modulosPermitidos;
                setModulosPermitidos(modulos === undefined ? null : modulos);
              } else {
                // Backwards compat: create the member doc from profile
                const isOwner = comp.ownerUid === u.uid;
                await setDoc(memRef, {
                  nome: prof.nome || u.displayName || '',
                  email: u.email || '',
                  role: isOwner ? 'owner' : (prof.role || 'member'),
                  modulosPermitidos: null,
                  joinedAt: serverTimestamp(),
                });
                setModulosPermitidos(null);
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

  async function signup({ nome, email, senha, empresaNome, codigoEmpresa }) {
    try {
      const codigo = (codigoEmpresa || '').trim();
      const entrando = !!codigo;

      // 1) Autentica PRIMEIRO — sem estar logado, nenhuma leitura/escrita passa nas regras.
      const cred = await createUserWithEmailAndPassword(auth, email, senha);
      await updateProfile(cred.user, { displayName: nome });
      const uid = cred.user.uid;

      let companyId = codigo;

      if (entrando) {
        // 2) Entrando numa empresa existente via código de convite.
        //    Adiciona o usuário à lista `members` da empresa. A regra
        //    `joiningOrCreating()` libera o update porque o próprio uid
        //    passa a constar em request.resource.data.members.
        try {
          await updateDoc(doc(fdb, 'companies', companyId), { members: arrayUnion(uid) });
        } catch (joinErr) {
          // Código inválido/inexistente: desfaz o usuário recém-criado pra não deixar órfão
          try { await cred.user.delete(); } catch (_) {}
          throw new Error('Código de convite inválido. Confira com o dono da empresa.');
        }
      } else {
        // 2) Criando uma empresa nova (esse usuário vira dono).
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

      // 3) Cria o perfil do usuário e o registro de membro.
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
    <AuthContext.Provider value={{ user, profile, company, modulosPermitidos, isOwner, loading, signup, login, resetPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
