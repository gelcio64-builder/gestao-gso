# Bloco 6 — Painel da operação

## Como subir

Dois arquivos em `src/entregas/`:

- `PainelEntregas.jsx` (novo)
- `Entregas.jsx` (substitui — ganhou a aba Painel, que passa a ser a inicial)

Nada de Firebase. Nada de App.jsx.

Arraste a **pasta `src`** no GitHub.

---

## O que aparece

Ao abrir Entregas, o Painel é a primeira aba.

**Alertas no topo** — coletas aguardando conferência (clicável, leva direto
para a tela de conferência) e divergências encontradas.

**Seis indicadores** — coletados, na base, atribuídos, entregues, pendentes
e ocorrências.

**Resultado da operação** — receita dos lojistas, repasse aos motoboys e
margem operacional com o percentual.

**Card de repasses** — clicável, abre a tela completa de Repasses.

**Dois gráficos** — rosca de volumes por etapa (com a taxa de sucesso) e
barras de coletas por dia.

**Rankings** — top 5 lojistas por volume e valor, top 5 motoboys por
entregas concluídas e percentual de conclusão.

**Fluxo da operação** — os cinco passos, cada um clicando direto na tela
correspondente.

Tudo respeita o período selecionado (quinzena ou o ciclo configurado).

---

## Uma observação sobre a margem

O card diz, em texto, que aquilo é **margem operacional e não lucro**.

É proposital. Receita dos lojistas menos repasse aos motoboys não desconta
combustível, aluguel, impostos, manutenção nem salários. Esse número passa
uma impressão boa demais se for lido como lucro, e é o tipo de conta em que
o dono decide contratar mais gente achando que sobra dinheiro. O lucro real
continua sendo o do Financeiro Empresa.

---

## Com isso o módulo está completo

Lojista → coleta → conferência → base → triagem → entrega → comprovante →
fechamento → cobrança em PDF → repasse → financeiro → indicadores.
