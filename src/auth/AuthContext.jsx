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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) { setUser(null); setProfile(null); setCompany(null); setLoading(false); return; }
        setUser({ uid: u.uid, email: u.email, displayName: u.displayName });
        const profSnap = await getDoc(doc(fdb, 'users', u.uid));
        if (profSnap.exists()) {
          const prof = { id: u.uid, ...profSnap.data() };
          setProfile(prof);
          if (prof.companyId) {
            const compSnap = await getDoc(doc(fdb, 'companies', prof.companyId));
            setCompany(compSnap.exists() ? { id: compSnap.id, ...compSnap.data() } : null);
          } else {
            setCompany(null);
          }
        } else {
          setProfile(null); setCompany(null);
        }
      } catch (e) {
        console.error('[Auth] load error:', e);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  async function signup({ nome, email, senha, empresaNome, codigoEmpresa }) {
    try {
      let companyId = (codigoEmpresa || '').trim();
      if (companyId) {
        const snap = await getDoc(doc(fdb, 'companies', companyId));
        if (!snap.exists()) throw new Error('Código de empresa inválido.');
      }
      const cred = await createUserWithEmailAndPassword(auth, email, senha);
      await updateProfile(cred.user, { displayName: nome });
      if (!companyId) {
        const newRef = doc(collection(fdb, 'companies'));
        companyId = newRef.id;
        await setDoc(newRef, {
          nome: empresaNome || 'Minha Empresa',
          ownerUid: cred.user.uid,
          members: [cred.user.uid],
          createdAt: serverTimestamp(),
        });
        await setDoc(doc(fdb, 'companies', companyId, 'settings', 'main'), {
          nomeEmpresa: empresaNome || 'Minha Empresa',
          precoCombustivel: 5.89,
          consumoPadrao: 10,
        });
      } else {
        await updateDoc(doc(fdb, 'companies', companyId), { members: arrayUnion(cred.user.uid) });
      }
      await setDoc(doc(fdb, 'users', cred.user.uid), {
        nome, email, companyId,
        role: (codigoEmpresa || '').trim() ? 'member' : 'owner',
        createdAt: serverTimestamp(),
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
    <AuthContext.Provider value={{ user, profile, company, loading, signup, login, resetPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
