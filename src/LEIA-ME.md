# Bloco 2 — Módulo Entregas (cadastro de motoboy + app do motoboy)

## Como subir

### 1. Firebase (faça primeiro)
Console → Firestore → aba **Rules** → apague tudo → cole o conteúdo de
`firestore.rules` → **Publish**.

> Esta versão traz uma correção em relação à publicada no Bloco 1:
> o vínculo entre a conta de login e o cadastro do motoboy agora usa
> `members/{uid}.motoboyId`. Sem essa correção o motoboy não conseguiria
> ler o próprio perfil.

### 2. GitHub
Suba a pasta `src/` inteira por cima da existente. Os arquivos alterados são:

| Arquivo | O que mudou |
|---|---|
| `src/App.jsx` | 5 pontos: ícone Bike, imports do módulo, item na sidebar, rota e o roteador por papel |
| `src/auth/AuthContext.jsx` | papel `motoboy`, `signupMotoboy()` por convite, correção de escalada de privilégio |
| `src/auth/AuthGate.jsx` | tela "Cadastro de motoboy" |
| `src/data/useFirestoreSync.js` | as 10 coleções do módulo |
| `src/entregas/*` | pasta nova (5 arquivos) |

Nenhum outro arquivo do projeto foi tocado.

### 3. Vercel
Deploy automático. Build verificado aqui: 2.338 módulos, sem erro.

---

## Como testar

**Como dono:**
1. Sidebar → **Entregas** (ícone de bicicleta, acima do Painel Fiscal)
2. **Novo motoboy** → preencha nome, telefone, PIX, região → Salvar
3. **Gerar convite** → aparece um código `MB-XXXXXX` e uma mensagem pronta pro WhatsApp

**Como motoboy** (use o celular ou uma janela anônima):
4. **Criar conta** → role até o fim → **Cadastro de motoboy**
5. Cole o código, preencha nome/e-mail/senha → Criar minha conta
6. Abre um app diferente: topo escuro, dois cards, três abas embaixo

**O teste de segurança:**
7. Logado como motoboy, não existe caminho para o Financeiro — nem pela
   interface, nem forçando o endereço. As regras do Firestore recusam.
8. As listas de coleta e entrega aparecem vazias. É o esperado: esses
   fluxos entram no Bloco 3.

---

## O que ainda não existe (Bloco 3)

- Cadastro de lojistas e bases
- Registrar coleta pelo celular
- Tela de conferência com o lojista
- Configurações do módulo (tarifas, ciclo, modo de pagamento)

As abas correspondentes aparecem marcadas como "em breve" e estão
desabilitadas.

---

## Se algo der errado

Guarde o `regras-backup.txt` do Bloco 1. Se o app quebrar depois de
publicar as regras, republique o backup e o sistema volta ao normal.
