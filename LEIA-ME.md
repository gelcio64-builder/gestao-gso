# Bloco 5 — Triagem, comprovantes e repasses

Fecha o ciclo completo: lojista → coleta → base → triagem → entrega →
comprovante → fechamento → cobrança → repasse → financeiro.

## Como subir

### 1. Firebase — PRECISA republicar
Console → Firestore → Rules → cole o `firestore.rules` → Publish.

**Por quê:** o app do motoboy filtrava as rotas pelo `uid` do login, mas as
rotas são criadas no painel, que não conhece esse uid. Rota criada nunca
apareceria no celular dele. Agora o filtro é pelo `motoboyId`, que os dois
lados conhecem. Sem republicar, a aba Entregas do motoboy fica vazia.

### 2. GitHub
Arraste a pasta `src`. Seis arquivos em `src/entregas/`:
`Triagem.jsx` e `Repasses.jsx` (novos), `Entregas.jsx`, `AppMotoboy.jsx`,
`dados.js` e `useMotoboySync.js` (substituem).

Build verificado: sem erro.

---

## Roteiro de teste

**Base & Triagem** (aba nova)
1. Escolha o dia → a faixa mostra o fluxo: a receber → na base → distribuídos → aguardando rota
2. **Receber todas** → os pacotes entram na base
3. **Nova rota** → escolha o motoboy (região e base vêm preenchidas) e a quantidade

**App do motoboy** → aba Entregas
4. A rota aparece com dois botões: **Dar baixa** e **Comprovante**
5. Dar baixa → contadores de entregues e ocorrências, com atalho "Tudo"
6. Comprovante → tira foto pela câmera ou escolhe da galeria

**Repasses** (aba nova)
7. Quatro cards no topo: total gerado, já pago, saldo, motoboys pendentes
8. Cada motoboy mostra Gerado / Pago / Saldo com o status colorido
9. **Registrar pagamento** → aceita valor parcial
10. Confira no Financeiro Empresa: saída já paga, categoria "Repasse Motoboys"

Teste o parcial: se o Gelson gerou R$ 2.080 e você paga R$ 1.500, o status
vira **Parcialmente pago** e o saldo fica R$ 580. O valor devido não muda.

---

## Sobre os comprovantes

A foto é comprimida no celular (máx. 1000px, JPEG) e guardada junto do
registro, sem usar o Firebase Storage. Evita ativação no console e custo por
GB. A troca: a imagem fica reduzida — serve para conferir, não para ampliar
detalhe. Se um dia precisar de qualidade alta, migramos para o Storage.

---

## Como o dinheiro chega no Financeiro

**Cobrança do lojista** → uma conta a receber pendente por fechamento.

**Repasse ao motoboy** → uma saída já paga por pagamento registrado.

A diferença é proposital. O Financeiro só tem pago/pendente, não tem
"parcialmente pago". Então a dívida com o motoboy vive no módulo Entregas,
com todo o histórico, e só o dinheiro que realmente saiu vira lançamento.
Três PIX para o mesmo motoboy = três saídas. O fluxo de caixa fica correto
e não há duplicidade.

O botão **Estornar** no histórico desfaz um pagamento e remove o lançamento
correspondente.
