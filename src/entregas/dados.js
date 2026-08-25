import { collection, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
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
  lojistaId, lojistaNome, baseId, baseNome,
  itens, data, obs,
}) {
  if (!companyId) throw new Error('Empresa não identificada.');
  if (!motoboyUid || !motoboyId) throw new Error('Seu cadastro não está vinculado. Fale com o responsável.');
  if (!lojistaId) throw new Error('Escolha a loja.');
  if (!baseId) throw new Error('Escolha a base de destino.');

  // Uma retirada pode trazer pacotes de vários marketplaces. Guardamos a
  // quebra por plataforma, porque cada uma tem tarifa própria.
  const limpos = (itens || [])
    .map((i) => ({ plataforma: i.plataforma || '', qtd: Math.max(0, Math.round(Number(i.qtd) || 0)) }))
    .filter((i) => i.qtd > 0);
  if (!limpos.length) throw new Error('Informe a quantidade de ao menos um marketplace.');

  const total = limpos.reduce((s, i) => s + i.qtd, 0);

  // Data da retirada. Pode ser retroativa: às vezes a loja separa pacotes no
  // sábado e o motoboy só passa na segunda — aqueles volumes pertencem ao
  // sábado, e é isso que faz o fechamento do período sair certo.
  const agora = new Date();
  const hoje = agora.toISOString().slice(0, 10);
  const dataColeta = data || hoje;
  if (dataColeta > hoje) throw new Error('A data da coleta não pode ser no futuro.');

  const ref = doc(collection(fdb, 'companies', companyId, 'entColetas'));

  await setDoc(ref, {
    data: dataColeta,
    hora: agora.toTimeString().slice(0, 5),
    retroativa: dataColeta !== hoje,
    registradaEm: hoje,

    lojistaId,
    lojistaNome: lojistaNome || '',
    itens: limpos.map((i) => ({ ...i, qtdConfirmada: null, tarifa: null })),
    // Campos-resumo mantidos para as telas e relatórios que leem uma linha só.
    plataforma: limpos.length === 1 ? limpos[0].plataforma : 'Vários',
    qtdInformada: total,

    motoboyUid,
    motoboyId,
    motoboyNome: motoboyNome || '',

    baseId,
    baseNome: baseNome || '',
    recebidoNaBase: false,

    // Só o painel preenche a quantidade confirmada, na conferência com o
    // lojista. As regras recusam a gravação se vier diferente de null.
    qtdConfirmada: null,
    conciliacaoStatus: 'pendente',

    // A tarifa é carimbada na conferência: o motoboy não tem (e não pode ter)
    // acesso de leitura à tabela de preços.
    snapshot: null,

    fechamentoLojistaId: null,
    fechamentoMotoboyId: null,

    obs: obs || '',
    origem: 'app_motoboy',
    historico: [{
      acao: 'criada',
      por: motoboyNome || '',
      uid: motoboyUid,
      qtd: total,
      itens: limpos,
      dataColeta,
      em: agora.toISOString(),
    }],
    criadoEm: serverTimestamp(),
  });

  return ref.id;
}

// ------------------------------------------------------------
//   Baixa de entrega feita pelo motoboy
// ------------------------------------------------------------
//   As regras só deixam ele mexer em qtdConcluida, qtdOcorrencia,
//   status, obs e historico — e apenas enquanto a rota não entrou
//   num fechamento. Qualquer campo a mais aqui faz a gravação ser
//   recusada, então não acrescente nada sem ajustar as regras.
export async function baixarEntregaMotoboy(companyId, rota, { concluidas, ocorrencias, obs, motoboyNome }) {
  if (!companyId || !rota?.id) throw new Error('Rota não identificada.');
  if (rota.fechamentoId) throw new Error('Esta rota já entrou num fechamento e não pode ser alterada.');

  const atrib = Math.max(0, Math.round(Number(rota.qtdAtribuida) || 0));
  const feitas = Math.max(0, Math.round(Number(concluidas) || 0));
  const ocor = Math.max(0, Math.round(Number(ocorrencias) || 0));
  if (feitas + ocor > atrib) {
    throw new Error(`A soma passa dos ${atrib} volumes atribuídos.`);
  }

  const status = feitas + ocor >= atrib && atrib > 0 ? 'concluida' : 'andamento';

  await updateDoc(doc(fdb, 'companies', companyId, 'entRotas', rota.id), {
    qtdConcluida: feitas,
    qtdOcorrencia: ocor,
    status,
    obs: obs || rota.obs || '',
    historico: [...(rota.historico || []), {
      acao: 'baixa pelo motoboy',
      de: rota.qtdConcluida ?? 0,
      para: feitas,
      por: motoboyNome || '',
      em: new Date().toISOString(),
    }],
  });

  return status;
}

// ------------------------------------------------------------
//   Comprovante
// ------------------------------------------------------------
//   A foto vai comprimida dentro do próprio documento, em base64 —
//   mesmo caminho que o app já usa para o logo da empresa. Evita
//   depender do Firebase Storage (ativação no console e custo por
//   GB) para uma foto que serve só para conferência visual.
//
//   O limite de um documento no Firestore é 1 MB, por isso a
//   compressão é obrigatória e há uma trava de tamanho no fim.
const LIMITE_BYTES = 700 * 1024;

export function comprimirImagem(file, maxLado = 1000, qualidade = 0.6) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo de imagem inválido.'));
      img.onload = () => {
        const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
        const w = Math.round(img.width * escala);
        const h = Math.round(img.height * escala);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(cv.toDataURL('image/jpeg', qualidade));
      };
      img.src = leitor.result;
    };
    leitor.readAsDataURL(file);
  });
}

export async function enviarComprovanteMotoboy(companyId, {
  motoboyUid, motoboyId, motoboyNome, rotaId, regiao, quantidade, arquivo, obs,
}) {
  if (!companyId) throw new Error('Empresa não identificada.');
  if (!motoboyUid) throw new Error('Sessão inválida. Entre novamente.');
  if (!arquivo) throw new Error('Selecione ou tire uma foto.');
  if (arquivo.length > LIMITE_BYTES) {
    throw new Error('A imagem ficou grande demais. Tente uma foto mais simples ou recorte antes.');
  }

  const agora = new Date();
  const ref = doc(collection(fdb, 'companies', companyId, 'entComprovantes'));
  await setDoc(ref, {
    data: agora.toISOString().slice(0, 10),
    hora: agora.toTimeString().slice(0, 5),
    motoboyUid, motoboyId, motoboyNome: motoboyNome || '',
    rotaId: rotaId || null,
    regiao: regiao || '',
    quantidade: Math.max(0, Math.round(Number(quantidade) || 0)),
    arquivo,
    obs: obs || '',
    // Espaço reservado para leitura automática da imagem no futuro.
    analise: null,
    criadoEm: serverTimestamp(),
  });
  return ref.id;
}
