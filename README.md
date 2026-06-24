# FinanceiroApp — Controle Financeiro Pessoal

Aplicação web completa para controle financeiro pessoal com suporte a múltiplos usuários. Cada usuário tem seus dados completamente isolados.

## Funcionalidades

- **Contas** — cadastre suas contas bancárias e acompanhe o saldo em tempo real
- **Receitas** — lançamentos pontuais ou recorrentes mensais (ex: salário fixo)
- **Despesas** — controle de gastos com suporte a despesas fixas mensais
- **Dívidas parceladas** — acompanhe parcelas, juros e previsão de quitação
- **Investimentos** — CDB, LCI, ações e outros com cálculo de rendimento
- **Metas** — defina objetivos financeiros e acompanhe o progresso
- **Cartões de crédito** — controle de faturas e compras parceladas
- **Orçamento** — defina limites por categoria e monitore o gasto real
- **Relatórios** — gráficos de fluxo de caixa e exportação CSV
- **Dashboard** — visão geral com KPIs, score de saúde financeira e projeções
- **Backup e restauração** — exporte e importe todos os seus dados em JSON

## Como rodar localmente

**Pré-requisitos:** Node.js 18+

```bash
# 1. Clone o repositório
git clone https://github.com/LuizMelo3/Financas.git
cd Financas

# 2. Inicie o app (instala dependências, faz build e sobe o servidor)
npm start

# 3. Acesse no navegador
http://localhost:3000
```

## Como fazer deploy no Railway

1. Suba o projeto para um repositório GitHub
2. Acesse [railway.app](https://railway.app) e crie um novo projeto a partir do repositório
3. Em **Volumes**, crie um volume montado em `/data`
4. Em **Variables**, adicione:

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `DATA_DIR` | `/data` |
| `JWT_SECRET` | `sua_chave_secreta_longa_e_aleatoria` |

5. O deploy ocorre automaticamente a cada push na branch `main`

## Tecnologias

- **Backend:** Node.js + Express
- **Banco de dados:** SQLite via [sql.js](https://github.com/sql-js/sql.js) (sem dependências nativas)
- **Autenticação:** JWT (jsonwebtoken) + bcryptjs
- **Frontend:** React 18 + Vite
- **Estilo:** Tailwind CSS
- **Gráficos:** Recharts

## Segurança

> Em produção, defina a variável de ambiente `JWT_SECRET` com uma string longa e aleatória (mínimo 32 caracteres). Nunca use o valor padrão em ambiente público.
>
> Exemplo de geração: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
