import { useEffect, useRef, useState, useCallback } from 'react';
import {
  collection, doc, onSnapshot, setDoc, deleteDoc,
} from 'firebase/firestore';
import { fdb } from '../firebase';

const COLS = [
  'veiculos', 'motoristas', 'linhas', 'combustivel', 'manutencao',
  'finEmpresa', 'finPessoal', 'contratos', 'metasPessoais', 'crmLeads', 'wms', 'documentos',
];
const DEFAULT_CONFIG = { nomeEmpresa: 'Minha Empresa', precoCombustivel: 5.89, consumoPadrao: 10 };

const buildEmpty = () => {
  const e = { config: { ...DEFAULT_CONFIG } };
  COLS.forEach((c) => (e[c] = []));
  return e;
};

export function useFirestoreSync(companyId) {
  const [data, setDataRaw] = useState(buildEmpty);
  const [ready, setReady] = useState(false);
  const dataRef = useRef(buildEmpty());
  const writingRef = useRef(new Set()); // tracks doc paths we just wrote to ignore echo

  useEffect(() => {
    if (!companyId) return;
    const cache = buildEmpty();
    dataRef.current = cache;
    setDataRaw({ ...cache });
    setReady(false);
    const received = new Set();
    const total = COLS.length + 1;

    const checkReady = () => { if (received.size >= total) setReady(true); };
    const unsubs = [];

    unsubs.push(
      onSnapshot(doc(fdb, 'companies', companyId, 'settings', 'main'), (snap) => {
        cache.config = snap.exists() ? { ...DEFAULT_CONFIG, ...snap.data() } : { ...DEFAULT_CONFIG };
        dataRef.current = { ...cache };
        setDataRaw({ ...cache });
        received.add('settings');
        checkReady();
      }, (err) => console.error('[fs] settings', err))
    );

    COLS.forEach((name) => {
      unsubs.push(
        onSnapshot(collection(fdb, 'companies', companyId, name), (snap) => {
          cache[name] = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
          dataRef.current = { ...cache };
          setDataRaw({ ...cache });
          received.add(name);
          checkReady();
        }, (err) => console.error('[fs]', name, err))
      );
    });

    return () => unsubs.forEach((u) => u());
  }, [companyId]);

  const setData = useCallback((updater) => {
    if (!companyId) return;
    const prev = dataRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    setDataRaw(next);
    dataRef.current = next;

    COLS.forEach((name) => {
      const prevArr = prev[name] || [];
      const nextArr = next[name] || [];
      if (prevArr === nextArr) return;
      const prevMap = new Map(prevArr.map((x) => [x.id, x]));
      const nextMap = new Map(nextArr.map((x) => [x.id, x]));

      nextArr.forEach((item) => {
        if (!item.id) return;
        const old = prevMap.get(item.id);
        if (!old || JSON.stringify(old) !== JSON.stringify(item)) {
          const { id, ...rest } = item;
          setDoc(doc(fdb, 'companies', companyId, name, id), rest)
            .catch((e) => console.error('[fs write]', name, id, e));
        }
      });
      prevArr.forEach((item) => {
        if (!item.id) return;
        if (!nextMap.has(item.id)) {
          deleteDoc(doc(fdb, 'companies', companyId, name, item.id))
            .catch((e) => console.error('[fs delete]', name, item.id, e));
        }
      });
    });

    if (JSON.stringify(prev.config) !== JSON.stringify(next.config)) {
      setDoc(doc(fdb, 'companies', companyId, 'settings', 'main'), next.config)
        .catch((e) => console.error('[fs settings]', e));
    }
  }, [companyId]);

  // Automatic localStorage migration was removed.
  // New companies always start empty. If we ever need to import local data
  // for a specific user, we can add an explicit button in Configurações.

  return [data, setData, ready];
}
