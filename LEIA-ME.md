# Bloco 4 — Fechamento e cobrança dos lojistas

## Como subir

Três arquivos, em duas pastas:

- `src/entregas/Fechamentos.jsx`  (novo)
- `src/entregas/Entregas.jsx`     (substitui — ganhou a aba Fechamentos)
- `src/pdf/cobranca.js`           (novo)

Nada de Firebase. Nada de App.jsx.

Arraste a **pasta `src`** no GitHub (não os arquivos soltos).

Build verificado: sem erro.

---

## Como testar

Entregas → aba **Fechamentos**

1. Navegue até o mês com as setas e escolha a quinzena (01–15 ou 16–fim)
2. Cada lojista aparece num card com o total do período
3. **PDF** — baixa o demonstrativo com logo, marca d'água e a cor da paleta
4. **Fechar e cobrar** — trava o período e cria a conta a receber no Financeiro
5. **WhatsApp** — abre a conversa com o resumo pronto (o PDF vai anexado à mão)

Depois de fechar, confira em **Financeiro Empresa**: deve haver UM lançamento
consolidado por lojista, categoria "Receita de Entregas", status pendente,
com o vencimento calculado pelo prazo das Configurações.

Não são criados lançamentos por coleta — apenas um por fechamento.

---

## Decisões tomadas no conteúdo do PDF

**Sem nome de motoboy.** Para o lojista é informação que só gera pergunta.
O painel interno continua mostrando tudo.

**Cobra a quantidade confirmada pela loja.** Se o motoboy informou 50 e ela
confirmou 48, o PDF traz 48. A diferença fica registrada internamente.

**Coleta pendente não entra.** Aparece um aviso amarelo e ela fica de fora
até ser conferida — o sistema não cobra número não confirmado.

Se quiser mudar qualquer uma dessas três, é ajuste rápido.

---

## Reabrir

O botão **Reabrir** desfaz o fechamento e remove a conta a receber, liberando
as coletas para um novo fechamento. Se o lançamento já tiver sido marcado como
**pago** no Financeiro, a reabertura é recusada — histórico pago não se mexe.

---

## O que falta

Triagem e distribuição de rotas, comprovantes, e os repasses aos motoboys
(quanto cada um gerou, quanto já recebeu, saldo). É o próximo bloco.
