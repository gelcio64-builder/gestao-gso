import { useEffect, useRef, useState, useCallback } from 'react';
import {
  collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch,
} from 'firebase/firestore';
import { fdb } from '../firebase';

const COLS = [
  'veiculos', 'motoristas', 'linhas', 'combustivel', 'manutencao',
  'finEmpresa', 'finPessoal', 'contratos', 'metasPessoais',
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

  // ----- localStorage one-time migration -----
  useEffect(() => {
    if (!companyId || !ready) return;
    const flagKey = `gso_migrated_${companyId}`;
    if (localStorage.getItem(flagKey)) return;
    const raw = localStorage.getItem('gso_data_v28');
    if (!raw) { localStorage.setItem(flagKey, '1'); return; }
    const cur = dataRef.current;
    const isEmpty = COLS.every((k) => (cur[k] || []).length === 0);
    if (!isEmpty) { localStorage.setItem(flagKey, '1'); return; }
    try {
      const parsed = JSON.parse(raw);
      const batch = writeBatch(fdb);
      let count = 0;
      COLS.forEach((name) => {
        (parsed[name] || []).forEach((item) => {
          if (!item || !item.id) return;
          const { id, ...rest } = item;
          batch.set(doc(fdb, 'companies', companyId, name, id), rest);
          count++;
        });
      });
      if (parsed.config) batch.set(doc(fdb, 'companies', companyId, 'settings', 'main'), parsed.config);
      batch.commit()
        .then(() => {
          console.log(`[migration] ${count} itens migrados do localStorage para Firestore`);
          localStorage.setItem(flagKey, '1');
          localStorage.setItem('gso_data_v28_backup', raw);
          localStorage.removeItem('gso_data_v28');
        })
        .catch((e) => console.error('[migration]', e));
    } catch (e) {
      console.error('[migration parse]', e);
      localStorage.setItem(flagKey, '1');
    }
  }, [companyId, ready]);

  return [data, setData, ready];
}
