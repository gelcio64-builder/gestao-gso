# Bloco 3 — Ciclo completo da coleta

## Como subir

**Só uma pasta muda: `src/entregas/`.**

Nada de Firebase desta vez — as regras continuam as mesmas do Bloco 2.
Nada de `App.jsx`, `AuthContext`, `AuthGate` ou `useFirestoreSync`.

1. Descompacte o ZIP
2. GitHub → **Add file → Upload files**
3. Arraste a **pasta `src`** (o ícone da pasta, não os arquivos de dentro)
4. Commit
5. Aguarde o deploy na Vercel

Build verificado: 2.344 módulos, sem erro.

---

## Ordem de teste (importante seguir nesta sequência)

O sistema tem dependências entre as telas: sem base cadastrada, o motoboy
não consegue registrar coleta. Faça nesta ordem:

### 1. Configurações
Entregas → aba **Configurações**

- Escolha o modelo de pagamento (para o João Pedro: **Somente por entrega**)
- Valor por entrega: `6,50`
- Valor por volume cobrado do lojista: `10,00`
- Cadastre as regiões: Osasco, Guarulhos, Taboão da Serra, Diadema…
- **Salvar configurações**

### 2. Bases
Aba **Bases** → Nova base → "Base Guarulhos", tipo Própria, marque as regiões

### 3. Lojistas
Aba **Lojistas** → Novo lojista → "João Imports", plataforma Mercado Livre,
base de destino "Base Guarulhos", telefone (o botão Ligar usa esse número)

Depois clique em **Tarifa** no card dele para dar valor diferente do padrão
— por exemplo R$ 10 por volume com mínimo de R$ 50.

### 4. Motoboys
A tarifa individual agora tem botão próprio no card. Deixe no padrão se não
houver acordo diferente.

### 5. App do motoboy
Entre com a conta de motoboy → botão grande **Registrar coleta**

- Escolhe a loja → a **base vem preenchida sozinha** (e dá para trocar)
- Ajusta a quantidade nos botões + / − ou nos atalhos +10 / +20 / +50
- **Confirmar coleta**

### 6. Conferência (o passo que substitui o WhatsApp)
Volte ao painel → Entregas → aba **Coletas** → **Conferência**

A coleta aparece agrupada por loja e por dia, com o total já somado.
Ligue para a loja, digite o que ela confirmou e clique em **Aprovar**.

- Número igual → status **Conciliada**
- Número diferente → status **Divergente**, e o sistema pede o motivo

Os dois números ficam guardados para sempre. A tarifa é carimbada neste
momento — mudar a tabela depois não altera esta coleta.

---

## O que ainda não existe

Triagem e distribuição de rotas, comprovantes, fechamentos, repasses aos
motoboys e a ponte com o Financeiro Empresa. Tudo isso é o próximo bloco.

A aba **Entregas** dentro do app do motoboy já existe, mas fica vazia até
a triagem ser construída.
