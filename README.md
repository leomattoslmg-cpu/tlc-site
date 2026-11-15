# TLC Ponta Porã - MS · Plataforma

Monorepo da plataforma digital do TLC (Treinamento de Liderança Cristã): site público, portal do membro, painel administrativo, aplicativo e API. Um só banco e uma só API.

```
apps/
  api/    API NestJS (/v1) e migrações do banco   → Sprint 0: FUN-03 e FUN-04
  web/    Next.js: site público (/) e, depois, portal e painel
  mobile/ (futuro) Expo / React Native
packages/ (futuro) contracts, ui, config
docs/     especificação, OpenAPI, backlog (xlsx) e schema de referência
```

Decisões do projeto, regras de negócio e permissões estão em `docs/01-especificacao-completa.md`; o contrato da API em `docs/03-openapi.yaml`; o backlog em `docs/04-backlog-mvp.xlsx`.

## Rodar localmente
```bash
docker compose up -d                       # PostgreSQL 16 e Redis
npm install                                # na raiz: instala API e site
export DATABASE_URL=postgres://tlc:tlc@localhost:5432/tlc
npm run db:migrate && npm run db:verify    # cria as 35 tabelas e os dados iniciais
npm run dev:api                            # http://localhost:3000/v1/health
npm run dev:web                            # http://localhost:3001
npm test                                   # testes da API
```
Cada app tem o seu `.env.example` (`apps/api`, `apps/web`) e o seu README com detalhes.

## Regras de ouro
- **Nunca edite uma migração já aplicada** (`apps/api/db/migrations`); crie a próxima.
- A API confere a permissão `recurso:ação` em toda rota; esconder botões nas telas é só conforto.
- CPF completo: só Super Administrador, Administrador e o próprio titular (os demais veem mascarado). Idade mínima de 13 anos; sem cadastro de responsável legal.

## Estado (14/11/2026)
Sprint 0: banco por migrações (FUN-03) e esqueleto da API (FUN-04) escritos; site público pronto, com as rotas públicas da API (`/public/paginas`, `/eventos`, `/albuns`, `/contato`). Falta rodar `npm install` e o CI pela primeira vez (nada foi compilado ainda) e gerar o `package-lock.json`.
