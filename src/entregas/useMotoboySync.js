import { useEffect, useState } from 'react';
import { collection, doc, query, where, onSnapshot } from 'firebase/firestore';
import { fdb } from '../firebase';
import { ENT_CONFIG_OPERACIONAL_DEFAULT } from './constants';

// ============================================================
//   Hook do APP DO MOTOBOY
// ------------------------------------------------------------
//   Deliberadamente NÃO é o useFirestoreSync. Aquele hook abre
//   um listener em cada coleção da empresa e baixa tudo — no
//   celular do motoboy isso seria dado demais no 4G dele, custo
//   de leitura demais para o dono, e as regras recusariam a
//   maior parte das coleções de qualquer forma.
//
//   Aqui só entram:
//     • as coletas e rotas DELE (where motoboyUid == uid)
//     • lojistas e bases (precisa para preencher os formulários)
//     • entConfig/operacional (regiões, plataformas, regras)
//     • o próprio cadastro em entMotoboys
//
//   Nada de tarifas, fechamentos, repasses ou financeiro.
// ============================================================

const vazio = {
  coletas: [],
  rotas: [],
  lojistas: [],
  bases: [],
  comprovantes: [],
  perfil: null,
  config: { ...ENT_CONFIG_OPERACIONAL_DEFAULT },
};

export function useMotoboySync(companyId, uid, motoboyId) {
  const [dados, setDados] = useState(vazio);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    // Sem motoboyId não há como filtrar: as regras exigem o vínculo.
    if (!companyId || !uid || !motoboyId) return;
    const cache = { ...vazio };
    setDados({ ...cache });
    setPronto(false);
    setErro('');

    const recebidos = new Set();
    const esperados = 6;
    const marcar = (k) => {
      recebidos.add(k);
      if (recebidos.size >= esperados) setPronto(true);
    };

    const base = (nome) => collection(fdb, 'companies', companyId, nome);
    const unsubs = [];

    const ouvir = (chave, ref, transform) => {
      unsubs.push(onSnapshot(
        ref,
        (snap) => {
          cache[chave] = transform(snap);
          setDados({ ...cache });
          marcar(chave);
        },
        (e) => {
          console.error('[motoboy]', chave, e);
          setErro('Não foi possível carregar seus dados. Verifique sua conexão.');
          marcar(chave);
        }
      ));
    };

    const lista = (snap) => snap.docs.map((d) => ({ ...d.data(), id: d.id }));

    // Filtro por motoboyId, não por uid: coletas e rotas lançadas pelo
    // painel não carregam o uid do login, e ele precisa vê-las também.
    // As regras exigem exatamente este filtro.
    ouvir('coletas', query(base('entColetas'), where('motoboyId', '==', motoboyId)), lista);
    ouvir('rotas', query(base('entRotas'), where('motoboyId', '==', motoboyId)), lista);
    ouvir('comprovantes', query(base('entComprovantes'), where('motoboyId', '==', motoboyId)), lista);

    // Cadastros que ele precisa ler para trabalhar (sem valores comerciais).
    ouvir('lojistas', base('entLojistas'), lista);
    ouvir('bases', base('entBases'), lista);

    {
      unsubs.push(onSnapshot(
        doc(fdb, 'companies', companyId, 'entMotoboys', motoboyId),
        (snap) => {
          cache.perfil = snap.exists() ? { ...snap.data(), id: snap.id } : null;
          setDados({ ...cache });
          marcar('perfil');
        },
        (e) => { console.error('[motoboy] perfil', e); marcar('perfil'); }
      ));
    }

    // Config operacional é o único doc de configuração que ele enxerga.
    unsubs.push(onSnapshot(
      doc(fdb, 'companies', companyId, 'entConfig', 'operacional'),
      (snap) => {
        cache.config = snap.exists()
          ? { ...ENT_CONFIG_OPERACIONAL_DEFAULT, ...snap.data() }
          : { ...ENT_CONFIG_OPERACIONAL_DEFAULT };
        setDados({ ...cache });
      },
      (e) => console.error('[motoboy] config', e)
    ));

    return () => unsubs.forEach((u) => u());
  }, [companyId, uid, motoboyId]);

  return { dados, pronto, erro };
}
