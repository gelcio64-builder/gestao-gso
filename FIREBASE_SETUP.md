# Configurar o Firebase — passo a passo

Esse guia leva ~10 minutos. Faça **uma vez** e o app fica multiusuário, em tempo real, na nuvem.

---

## 1) Criar o projeto Firebase

1. Acesse https://console.firebase.google.com
2. Clique em **Adicionar projeto**.
3. Nome: `gestao-gso` (ou outro). Pode desativar o Google Analytics se quiser.
4. Aguarde a criação e clique em **Continuar**.

---

## 2) Ativar Authentication (login por e-mail)

1. No menu lateral, vá em **Build → Authentication → Get started**.
2. Aba **Sign-in method**, clique em **E-mail/senha** e ative o primeiro toggle.
3. Salve.

---

## 3) Criar o Firestore Database

1. Menu lateral → **Build → Firestore Database → Create database**.
2. Escolha localização **southamerica-east1 (São Paulo)** para baixa latência.
3. Inicie em **modo de produção**.

---

## 4) Configurar as regras de segurança

1. Dentro do Firestore, aba **Rules**.
2. Cole exatamente o conteúdo do arquivo `firestore.rules` (na raiz deste projeto).
3. Clique em **Publish**.

Essas regras garantem que cada usuário só acessa os dados da empresa à qual ele pertence.

---

## 5) Registrar o app web no Firebase

1. Volte em **Project settings** (engrenagem no topo do menu lateral).
2. Em **Your apps**, clique no ícone **`</>`** (web).
3. Apelido: `gestao-gso-web`. **NÃO** marque "Firebase Hosting" agora.
4. Clique em **Register app**.
5. Aparecerá um bloco `firebaseConfig` com `apiKey`, `authDomain`, etc. **Mantenha essa tela aberta.**

---

## 6) Criar o arquivo .env local

Na raiz do projeto (mesma pasta do `package.json`):

```bash
cp .env.example .env
```

Abra o `.env` e preencha com os valores do bloco `firebaseConfig`:

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=gestao-gso.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=gestao-gso
VITE_FIREBASE_STORAGE_BUCKET=gestao-gso.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=1:...:web:...
```

Salve.

---

## 7) Rodar local

```bash
npm install
npm run dev
```

Abra http://localhost:5173 — você verá a tela de login. Clique em **Criar conta**, preencha nome/e-mail/senha e o **nome da empresa** (deixe o campo "Código da empresa" vazio).

Pronto: sua empresa foi criada na nuvem. Os módulos abrem vazios (sem dados de demonstração).

---

## 8) Convidar seu sócio

1. Dentro do app, abra **Configurações** (menu lateral).
2. Em "Convidar sócio ou colaborador", copie o **Código da empresa**.
3. Envie esse código para o sócio.
4. Ele clica em **Criar conta**, preenche os dados e cola o código no campo **"Código da empresa"**.
5. A conta dele entra automaticamente na mesma empresa. Tudo que um criar/editar/apagar, o outro vê em tempo real.

---

## 9) Migração automática do localStorage

Se você já estava usando o app com `localStorage` (versão anterior, sem Firebase), **no seu primeiro login após configurar o Firebase** o sistema:

1. Detecta os dados no `localStorage` do navegador.
2. Envia tudo para o Firestore da empresa recém-criada.
3. Faz um backup em `localStorage` na chave `gso_data_v28_backup` (por segurança).
4. Limpa a chave original.

Isso acontece **uma única vez por empresa/navegador**. Você não precisa fazer nada.

---

## 10) Publicar online (Vercel)

1. Suba o projeto para o GitHub (passos no `README.md`).
2. Em https://vercel.com, **Add New → Project** e selecione o repositório.
3. Antes de fazer Deploy, em **Environment Variables**, adicione todas as 6 variáveis `VITE_FIREBASE_*` com os mesmos valores do seu `.env` (Vercel ⇒ usar o tipo "Plain Text"). Marque "Production", "Preview" e "Development".
4. Clique em **Deploy**.

Pronto: o app fica online em `https://gestao-gso.vercel.app` (ou o nome que escolher), pronto para Play Store/App Store wrappers (Capacitor/TWA) ou uso direto em produção.

---

## Estrutura Firestore

```
users/{uid}                   { nome, email, companyId, role, createdAt }
companies/{cid}               { nome, ownerUid, members[], createdAt }
  └── settings/main           { nomeEmpresa, logoUrl, cnpj, telefone,
                                emailContato, endereco, cidade, uf,
                                precoCombustivel, consumoPadrao }
  └── members/{uid}           { nome, email, role, modulosPermitidos,
                                joinedAt }   ← controle de acesso por módulo
  └── veiculos/{id}
  └── motoristas/{id}
  └── linhas/{id}
  └── combustivel/{id}
  └── manutencao/{id}
  └── finEmpresa/{id}         (com statusConc: manual/pendente/conciliado)
  └── finPessoal/{id}
  └── contratos/{id}
  └── metasPessoais/{id}
  └── crmLeads/{id}           (CRM Comercial)
  └── wms/{id}                (Armazém)
```

Cada subcoleção é sincronizada em tempo real via `onSnapshot`. Quando um usuário cria/edita/exclui, o outro vê instantaneamente.

---

## Variáveis de ambiente necessárias

| Variável | Onde obter |
|---|---|
| `VITE_FIREBASE_API_KEY` | firebaseConfig.apiKey |
| `VITE_FIREBASE_AUTH_DOMAIN` | firebaseConfig.authDomain |
| `VITE_FIREBASE_PROJECT_ID` | firebaseConfig.projectId |
| `VITE_FIREBASE_STORAGE_BUCKET` | firebaseConfig.storageBucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | firebaseConfig.messagingSenderId |
| `VITE_FIREBASE_APP_ID` | firebaseConfig.appId |

---

## Arquivos criados nesta migração

```
src/
├── firebase.js                       Init do Firebase (lê env vars)
├── auth/
│   ├── AuthContext.jsx               Provider de autenticação
│   └── AuthGate.jsx                  Telas Login / Cadastro / Recuperar senha
└── data/
    └── useFirestoreSync.js           Hook que sincroniza data <-> Firestore em tempo real
.env.example                          Modelo de variáveis de ambiente
firestore.rules                       Regras de segurança
FIREBASE_SETUP.md                     Este guia
```

`src/App.jsx` foi modificado pontualmente para:
- envolver tudo em `<AuthProvider>` + `<AuthGate>`,
- trocar `usePersistedState` por `useFirestoreSync`,
- mostrar empresa/usuário/logout no topo,
- adicionar a tela **Configurações** (nome da empresa, código de convite, conta, sair).

Nenhum módulo (Painel, Financeiro, Veículos, Linhas, Motoristas, Contratos, etc.) teve sua lógica ou design alterados.
