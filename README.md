# Gestão GSO

Sistema de gestão para GSO Soluções — Painel, Financeiro Empresa, Financeiro Pessoal, Fretes & Linhas, Veículos, Combustível, Manutenção, Motoristas, Contratos e Relatórios.

Stack: React 18 + Vite + Tailwind v3 + recharts + lucide-react. Dados em `localStorage` (chave `gso_data_v28`).

---

## 1. Rodar local

Pré-requisito: Node.js 18+ instalado ([baixar aqui](https://nodejs.org/)).

```bash
npm install
npm run dev
```

Abra http://localhost:5173

---

## 2. Build de produção

```bash
npm run build
```

Gera a pasta `dist/` com o site estático pronto.

Para testar o build localmente:

```bash
npm run preview
```

---

## 3. Subir para o GitHub

```bash
git init
git add .
git commit -m "Gestão GSO inicial"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/gestao-gso.git
git push -u origin main
```

(Crie o repositório vazio antes em https://github.com/new)

---

## 4. Publicar no Vercel (grátis)

1. Entre em https://vercel.com com sua conta GitHub.
2. Clique em **Add New → Project**.
3. Selecione o repositório `gestao-gso`.
4. O Vercel detecta Vite automaticamente. Deixe tudo padrão.
5. Clique em **Deploy**.

Em ~1 minuto o app fica online em `https://gestao-gso.vercel.app` (ou nome similar).

Cada `git push` futuro atualiza o site automaticamente.

---

## Migrar para Firestore depois

O app já tem uma camada `db` abstraída (`src/App.jsx`, próximo ao topo). Para trocar de `localStorage` para Firestore, basta substituir as duas funções `db.get` e `db.set` pelas chamadas do Firestore. Nenhum outro código precisa mudar.
