# Bloco 11 — Conta corrente de lojistas e motoboys

## Como subir

Seis arquivos. Nada de Firebase, nada de App.jsx.

`src/entregas/` — engine.js, ContaCorrente.jsx (novo), Lojistas.jsx,
Entregas.jsx, Fechamentos.jsx
`src/pdf/` — extrato.js (novo)

Arraste a **pasta `src`** no GitHub.

---

## O levantamento, antes de codar

**Já existia e foi reaproveitado, não recriado:**

- Snapshot de tarifas (item 4 do seu prompt) — já estava completo. Cada coleta
  guarda a tarifa de cada marketplace e cada rota guarda a tarifa por entrega,
  congeladas no momento em que nasceram.
- Aba Repasses (item 5) — total gerado, pago, saldo, status, pagamentos.
  O Histórico do motoboy usa **a mesma função** de apuração.
- PDF de cobrança do lojista — integrado ao histórico, não refeito.

**Foi criado:**

- Histórico Financeiro do lojista
- Histórico de Repasses do motoboy
- Extrato de Repasse em PDF
- Registro de recebimento do lojista (não existia)

---

## 1. Histórico Financeiro do lojista

Lojistas → botão **Histórico** no card.

Linha do tempo de todos os fechamentos, do mais recente ao mais antigo, com
período, volumes, tarifa média, total, recebido, saldo, vencimento, data do
pagamento e situação. No topo, três cards: faturado, recebido, em aberto.

Cada fechamento tem **PDF** e **Compartilhar** (WhatsApp) usando o gerador de
cobrança que já existia.

### Registro de recebimento

Botão **Registrar recebimento**, com valor parcial permitido.

A regra: o total do fechamento **nunca** é reduzido. O saldo é derivado.
A conta a receber no Financeiro Empresa é baixada apenas quando o fechamento
é quitado por completo — enquanto houver saldo, ela continua em aberto lá,
porque é ela que responde "quanto ainda tenho a receber".

> Efeito colateral honesto: um recebimento parcial só aparece no caixa quando
> o lojista quitar. Se isso incomodar no uso real, a gente inverte.

Um fechamento com recebimento registrado **não pode mais ser reaberto** —
seria apagar histórico de caixa. Estorne o recebimento primeiro.

---

## 2. Histórico de Repasses do motoboy

Motoboys → botão **Histórico** no card.

Quinzenas dos últimos 3, 6 ou 12 meses, com entregas, tarifa praticada,
total gerado, pago, saldo, pagamentos realizados e situação.

**Fonte única:** esta tela lê os mesmos documentos da aba Repasses. Registrar
um pagamento lá muda o histórico aqui no mesmo instante — não há segunda
apuração nem dado duplicado.

---

## 3. Extrato de Repasse em PDF

Botão **Extrato PDF** em cada período.

Mesmo padrão dos outros documentos: logo, marca d'água, timbrado, cor da
paleta. Contém dados da empresa, dados do motoboy (nome, telefone, PIX,
região, base), período, três cards de resumo, detalhamento com uma linha por
rota (data, código, região, entregas, tarifa, valor), pagamentos já
realizados, saldo em destaque, situação, data e hora de emissão e número
único do documento.

O botão **Enviar** abre o WhatsApp com o resumo pronto.

---

## 4. Tarifa histórica — verificado

Testado com um motoboy que recebia R$ 6,50 na primeira quinzena de agosto e
passou a R$ 7,00 na segunda:

```
16–31/08 | gerado 287,00 | tarifa 7,00
01–15/08 | gerado 208,00 | tarifa 6,50
```

Cada período mantém a tarifa da época. O extrato de agosto emitido em
dezembro continua saindo com os valores de agosto.

---

## Como testar

1. Feche uma quinzena de um lojista na aba Fechamentos
2. Lojistas → Histórico → registre um recebimento **parcial**
3. Confira: status vira "Parcialmente pago", saldo aparece, e no Financeiro
   Empresa a conta a receber continua pendente
4. Registre o restante → status "Quitado" e a conta a receber é baixada
5. Motoboys → Histórico → gere o Extrato PDF de um período
6. Registre um pagamento na aba Repasses e volte ao Histórico: o valor já
   está lá, sem precisar recarregar

Build sem erro.
