import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { fdb } from '../firebase';

// ============================================================
//   Escritas diretas no Firestore
// ------------------------------------------------------------
//   O painel de gestão grava através do useFirestoreSync (que
//   espelha o objeto `data` inteiro). O app do motoboy não usa
//   aquele hook, então precisa escrever direto — e é o que estas
//   funções fazem.
//
//   Todos os campos exigidos pelas regras de segurança estão
//   explícitos aqui. Alterar qualquer um deles quebra a gravação
//   do motoboy, então mexer nesta função pede olhar as regras
//   junto (match /entColetas).
// ============================================================

export async function criarColetaMotoboy(companyId, {
  motoboyUid, motoboyId, motoboyNome,
  lojistaId, lojistaNome, plataforma, baseId, baseNome,
  quantidade, obs,
}) {
  if (!companyId) throw new Error('Empresa não identificada.');
  if (!motoboyUid || !motoboyId) throw new Error('Seu cadastro não está vinculado. Fale com o responsável.');
  if (!lojistaId) throw new Error('Escolha a loja.');
  if (!baseId) throw new Error('Escolha a base de destino.');
  const qtd = Math.round(Number(quantidade) || 0);
  if (qtd <= 0) throw new Error('Informe a quantidade de volumes.');

  const agora = new Date();
  const ref = doc(collection(fdb, 'companies', companyId, 'entColetas'));

  await setDoc(ref, {
    data: agora.toISOString().slice(0, 10),
    hora: agora.toTimeString().slice(0, 5),

    lojistaId,
    lojistaNome: lojistaNome || '',
    plataforma: plataforma || '',

    motoboyUid,
    motoboyId,
    motoboyNome: motoboyNome || '',

    baseId,
    baseNome: baseNome || '',
    recebidoNaBase: false,

    qtdInformada: qtd,
    // Só o painel preenche a quantidade confirmada, na conferência
    // com o lojista. As regras recusam a gravação se o motoboy
    // tentar mandar qualquer coisa diferente de null aqui.
    qtdConfirmada: null,
    conciliacaoStatus: 'pendente',

    // A tarifa é carimbada na conferência: o motoboy não tem (e não
    // pode ter) acesso de leitura à tabela de tarifas.
    snapshot: null,

    fechamentoLojistaId: null,
    fechamentoMotoboyId: null,

    obs: obs || '',
    origem: 'app_motoboy',
    historico: [{
      acao: 'criada',
      por: motoboyNome || '',
      uid: motoboyUid,
      qtd,
      em: agora.toISOString(),
    }],
    criadoEm: serverTimestamp(),
  });

  return ref.id;
}
