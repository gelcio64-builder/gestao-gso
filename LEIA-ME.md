# Módulo Entregas — pacote COMPLETO (v11)

Este ZIP tem **a pasta `src/entregas` inteira** (16 arquivos) mais os dois
geradores de PDF. Não é um remendo: substituindo essas pastas, o módulo fica
na versão mais recente por completo, sem chance de ficar pela metade.

Nada de Firebase. Nada de App.jsx, AuthContext, AuthGate ou useFirestoreSync.

---

## Como subir

1. Descompacte o ZIP
2. GitHub → **Add file → Upload files**
3. Arraste a **pasta `src`** (o ícone da pasta, não os arquivos de dentro)
4. Commit e aguarde o deploy

---

## Como conferir se subiu certo

Abra Entregas. No canto direito da barra de abas aparece um selo cinza
escrito **"Entregas v11"**.

Se o selo não aparecer, o deploy não pegou — não adianta testar o resto.

---

## Por que isso foi necessário

Pelos prints, os Blocos 10 e 11 não chegaram a entrar no ar. O card do
lojista mostrava a tarifa antiga sem as etiquetas por marketplace, e faltava
o botão Histórico. Sem esses dois blocos, nada do que você procurou existia:

- multi-marketplace na coleta (Bloco 10)
- data retroativa (Bloco 10)
- tarifa por marketplace (Bloco 10)
- histórico financeiro do lojista (Bloco 11)
- histórico e extrato do motoboy (Bloco 11)

---

## Onde encontrar cada coisa

**Tarifa por marketplace** — Entregas → Lojistas → botão **Tarifa**.
Tem o valor geral em cima e uma linha por marketplace embaixo. O que ficar
em branco usa o valor geral. No card aparecem etiquetas azuis com cada valor.

**Extrato de pagamento do motoboy** — Entregas → **Motoboys** → botão
**Histórico** no card do motoboy → cada quinzena tem **Extrato PDF** e
**Enviar**.

**Histórico financeiro do lojista** — Entregas → Lojistas → botão
**Histórico** → linha do tempo com Registrar recebimento, PDF e Compartilhar.

**Multi-marketplace e data retroativa** — no app do motoboy, botão
**Registrar coleta**. A tela agora tem um contador por marketplace e, abaixo,
uma faixa com os últimos 7 dias (Hoje, Sáb 23, Sex 22...) mais um campo de
data.

---

## Sobre as Configurações travadas

Lembre que a tela de Configurações do módulo **só grava ao clicar em
"Salvar configurações"**, no fim da página. Adicionar uma plataforma ou
região com o botão **+** apenas monta a lista na tela; sair sem salvar
descarta.

Se depois de salvar continuar não gravando, abra o console (F12) e me mande
o erro — aí é outra coisa.

---

## O erro do PDF

Este pacote já traz a versão que mostra a **causa real** na mensagem, em vez
de "não foi possível". Se ainda falhar, o print da faixa vermelha agora diz
exatamente o que houve.

O gerador foi testado isolado com os dados do A&G Imports (18 volumes,
R$ 162, Shopee) e produziu o PDF corretamente.
