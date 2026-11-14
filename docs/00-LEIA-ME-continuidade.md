# TLC Ponta Porã - MS · Pacote de continuidade

Este pacote reúne tudo o que foi feito até 14/11/2026, para continuar o projeto em outra conta do Claude (ou com outra pessoa) sem perder contexto.

## Arquivos do pacote

| Arquivo | O que é |
|---|---|
| 01-especificacao-completa.md | Especificação completa: arquitetura, banco, relacionamentos, wireframes, navegação do app e do painel, regras de negócio, permissões, fluxos, plano em fases, stack, API REST, modelo de notificações e recomendações de UX/UI |
| 02-schema.sql | Script PostgreSQL 16: 35 tabelas, restrições, índices, gatilhos e dados iniciais (organização, 6 perfis, 35 permissões, categorias). Testado em PostgreSQL 16 |
| 03-openapi.yaml | API REST em OpenAPI 3.1: 63 caminhos e 84 operações, com a permissão exigida em cada uma (`x-permissao`) |
| 04-backlog-mvp.xlsx | Backlog da Fase 1: 55 histórias do MVP em 9 épicos e 6 sprints, com critérios de aceite, pontos e dependências |

## Como usar em outra conta do Claude

1. Crie um **Projeto** novo (ou abra uma conversa nova) e anexe os 4 arquivos acima.
2. Cole o texto da seção "Prompt para começar" abaixo.
3. Se for trabalhar com código, vincule o GitHub da nova conta (Configurações → Conectores) e informe o repositório.

## O que é o projeto

Plataforma digital do **TLC Ponta Porã - MS** (Treinamento de Liderança Cristã) com quatro partes: site público, portal do membro, painel administrativo e aplicativo mobile (Android e iOS). Um só banco de dados e uma só API.

Módulos: autenticação (login por e-mail ou CPF, recuperação de senha), membros, mural de avisos, eventos, galeria, documentos, notificações, dashboard e site institucional.

Perfis: Super Administrador, Administrador, Coordenador, Secretaria, Membro, Visitante.

## Decisões já tomadas pelo responsável

- A **paleta de cores** proposta (azul-petróleo, dourado e cores por categoria de aviso) está **aprovada**.
- O TLC aceita **menores de 18 anos** e trabalha com pessoas de **13 anos para cima**. Menor de 13 não pode ser cadastrado.
- **Não se cadastra responsável legal.**
- O **CPF completo** só pode ser visto por **Super Administrador, Administrador e pelo próprio titular**. Os demais perfis veem o CPF mascarado (`***.456.789-**`). A Secretaria digita o CPF no cadastro, mas depois o vê só mascarado; correção de CPF é feita por Administrador. Cada abertura do CPF de outra pessoa fica na auditoria.
- Menor de 18 anos sem CPF próprio pode ser cadastrado sem CPF; o CPF passa a ser obrigatório aos 18.

## Arquitetura em uma frase

Monólito modular: API NestJS + Next.js (site, portal e painel) + app React Native/Expo; PostgreSQL, Redis/BullMQ, armazenamento compatível com S3 + CDN, FCM/APNs para push, SES ou Resend para e-mail. Controle de acesso por permissões `recurso:ação`, conferido sempre na API.

## Estado atual (14/11/2026)

- Especificação, banco e API: **prontos**.
- Backlog do MVP: **pronto**. A Sprint 0 começa em **14/11/2026**. Estimativa: cerca de 13 semanas até o lançamento do MVP (fim previsto em 12/02/2027), com capacidade assumida de 44 pontos por sprint de 2 semanas. Essa capacidade é suposição, sem histórico real.
- Única história iniciada: **FUN-03** (banco criado por migrações a partir do `02-schema.sql`).
- **Código: ainda não foi escrito.** O repositório `leomattoslmg-cpu/TLC-plataforma` existe no GitHub, mas a conexão com o Claude não foi concluída (a conta do GitHub não estava vinculada).

## Próximos passos

1. Vincular o GitHub e conectar o repositório; começar por **FUN-03** (migrações do banco) e **FUN-04** (esqueleto da API).
2. Abrir as contas de **Apple Developer**, **Google Play Console**, **Firebase (push)** e **e-mail (Resend ou SES)**. São as que mais demoram. Decidir se ficam em nome do TLC (pede o número D-U-N-S da entidade) ou de uma pessoa.
3. Seguir o backlog sprint a sprint (aba "Sprints" da planilha).

## Prompt para começar

> Estou continuando o projeto "TLC Ponta Porã - MS". Leia o arquivo 00-LEIA-ME-continuidade.md e a especificação completa anexada. O banco (02-schema.sql) e a API (03-openapi.yaml) estão prontos, e o backlog do MVP está na planilha. Respeite as decisões já tomadas, principalmente as regras do CPF e da idade mínima de 13 anos. Hoje quero [começar o código da Sprint 0 / revisar a especificação / detalhar a tela X]. Pergunte só o que for indispensável.
