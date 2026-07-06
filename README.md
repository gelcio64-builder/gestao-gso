# Gestão GSO

Sistema de gestão para GSO Soluções — Painel, Financeiro Empresa, Financeiro Pessoal, Fretes & Linhas, Veículos, Combustível, Manutenção, Motoristas, Contratos, Documentos, Relatórios e Configurações.

Stack: **React 18 + Vite + Tailwind v3 + recharts + lucide-react + Firebase (Auth + Firestore)**.

Dados na nuvem com **sincronização em tempo real** via `onSnapshot`. Multiusuário por empresa.

---

## ⚙️ Primeiro setup — leia o `FIREBASE_SETUP.md`

Esse projeto precisa de um projeto Firebase configurado para rodar. Siga o passo a passo em **`FIREBASE_SETUP.md`** (na raiz) — leva ~10 minutos.

Resumo do que você vai fazer:
1. Criar projeto no Firebase Console.
2. Ativar Authentication (e-mail/senha).
3. Criar Firestore Database.
4. Publicar as regras de `firestore.rules`.
5. Copiar `.env.example` → `.env` e preencher com as chaves do seu projeto.

---

## Rodar local

Pré-requisito: Node.js 18+ ([baixar](https://nodejs.org/)).

```bash
npm install
npm run dev
```

Abra http://localhost:5173 e crie sua conta.

---

## Build de produção

```bash
npm run build      # gera /dist
npm run preview    # testa o build localmente
```

---

## Publicar no Vercel

```bash
git init && git add . && git commit -m "Gestão GSO" && git branch -M main
git remote add origin https://github.com/SEU-USUARIO/gestao-gso.git
git push -u origin main
```

Depois em https://vercel.com → **Add New → Project** → selecione o repositório → adicione as 6 variáveis `VITE_FIREBASE_*` em **Environment Variables** → **Deploy**.

Detalhes em `FIREBASE_SETUP.md` (passo 10).

---

## Convidar sócio

Dentro do app → **Configurações** → copie o **Código da empresa** → envie para o sócio → ele cria conta colando o código no campo "Código da empresa". Pronto, multiusuário em tempo real.
