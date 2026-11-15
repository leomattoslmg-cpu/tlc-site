# TLC Ponta Porã - MS · Especificação da Plataforma

Nov 13, 2026 · @Leonardo

## Visão geral

A plataforma TLC Ponta Porã - MS reúne site público, portal do membro, painel administrativo e aplicativo mobile em um único sistema, com uma só base de dados e uma só API.

| Componente | Quem usa | Função principal |
| --- | --- | --- |
| Site institucional | Visitantes | Apresentar o TLC, divulgar eventos e galeria, levar ao login |
| Portal do Membro (web) | Membros | Mural, eventos, documentos, galeria e perfil |
| Painel Administrativo (web) | Super Administrador, Administrador, Coordenador, Secretaria | Gerir membros, conteúdo, eventos, check-in e indicadores |
| Aplicativo mobile (Android e iOS) | Membros e equipe | Mural, eventos, check-in por QR Code, notificações push, galeria e documentos |

### Princípios de produto

- **Uma fonte de verdade:** site, portal, painel e app consomem a mesma API; nada é cadastrado duas vezes.
- **Mobile primeiro:** a maioria dos membros acessa pelo celular, então toda tela nasce pensada para o polegar.
- **Simples de operar:** um secretário sem formação técnica publica um aviso ou abre um evento em menos de 2 minutos.
- **Privacidade por padrão (LGPD):** CPF e dados pessoais ficam restritos, criptografados e com trilha de auditoria.
- **Pronta para crescer:** o modelo de dados já aceita várias igrejas, turmas e, no futuro, outras cidades sem reescrita.

### Premissas adotadas

- O TLC de Ponta Porã é a única organização no início, mas todas as tabelas carregam `organizacao_id` para permitir expansão (outros polos do TLC).
- Todo membro pertence a uma igreja; a lista de igrejas é cadastrada pela coordenação. O TLC atende a partir de 13 anos, sem cadastro de responsável legal para menores de 18; o CPF completo só é visto por Super Administrador, Administrador e pelo próprio titular.
- Cadastros feitos pelo site passam por aprovação da secretaria antes de virar Membro.
- Visitante é quem navega sem login; ele só vê conteúdo público do site.
- Turma/edição do treinamento entra como entidade opcional desde o MVP, para que o histórico do membro faça sentido ao longo dos anos.

## 1. Arquitetura completa da solução

Quatro clientes (site, portal, painel e app) conversam com uma única API, que concentra regras de negócio, permissões e acesso aos dados; é isso que mantém tudo sincronizado e barato de manter.

&#91;embedded content: arquitetura · 4 clientes, 1 API, 3 serviços de dados, 3 serviços externos\]

Os clientes só falam com a API; ela grava no PostgreSQL, guarda cache e filas no Redis e deixa o envio de push e e-mail para o worker. O WhatsApp (tracejado) entra numa fase futura.

### Componentes

| Componente | Responsabilidade | Tecnologia sugerida |
| --- | --- | --- |
| Site institucional | Páginas públicas, eventos e álbuns marcados como públicos, formulário de contato | Next.js (renderização no servidor, bom para busca do Google) |
| Portal do Membro | Versão web do app para quem prefere o computador | Next.js, mesmo projeto do site |
| Painel Administrativo | Gestão de membros, conteúdo, eventos, check-in, notificações e indicadores | Next.js, área `/admin` |
| Aplicativo mobile | Uso diário pelo membro; QR Code, push e cache offline | React Native com Expo |
| API REST | Regras de negócio, autenticação, permissões, validação e documentação OpenAPI | NestJS (Node.js) |
| PostgreSQL | Dados relacionais, histórico e auditoria | PostgreSQL |
| Redis | Cache de feeds, limite de requisições e filas de tarefas | Redis |
| Storage e CDN | Fotos, miniaturas e PDFs, entregues por rede de distribuição | Compatível com S3 |
| Worker de filas | Envio de push e e-mail e processamento de imagens, fora do ciclo da requisição | BullMQ |
| Serviços externos | Push (FCM e APNs), e-mail transacional e, depois, WhatsApp | Firebase, SES ou Resend |

### Decisões de arquitetura

- **Monólito modular:** um único deploy com um módulo por domínio (membros, avisos, eventos...). Para uma equipe pequena é mais simples e barato do que microsserviços, e os módulos já nascem separados para uma futura divisão.
- **API primeiro:** nenhuma tela acessa o banco; site, portal, painel e app usam a mesma API, então uma regra nova vale para todos ao mesmo tempo.
- **Arquivos fora da API:** o cliente recebe uma URL assinada e envia a foto ou o PDF direto ao storage; a API só registra e valida. Isso mantém a API leve mesmo em dia de evento com muitas fotos.
- **Trabalho pesado em segundo plano:** push, e-mail e redimensionamento de imagens entram em fila e são processados pelo worker, com nova tentativa em caso de falha.
- **API sem estado:** a sessão vive no token, então a API pode rodar em várias réplicas quando o número de usuários crescer.
- **Pronta para vários polos:** `organizacao_id` em todo conteúdo e permissões por organização permitem atender outros TLCs sem recriar o sistema.
- **Segurança em camadas:** HTTPS, validação de entrada, permissões checadas na API, CPF cifrado e auditoria das ações sensíveis.

## 2. Estrutura do banco de dados

O banco é PostgreSQL com 35 tabelas em 9 domínios; todo conteúdo carrega `organizacao_id`, o que permite crescer para outros polos do TLC sem alterar o modelo.

### Convenções gerais

- **Chaves:** UUID v7 (ordenável por data) em todas as tabelas.
- **Auditoria de linha:** `criado_em`, `atualizado_em` e `excluido_em` (exclusão lógica) nas tabelas de conteúdo.
- **CPF:** guardado só com dígitos, cifrado (AES-256-GCM) em `cpf_cifrado`, mais `cpf_hash` (HMAC-SHA-256) para busca, unicidade e login. Os dígitos verificadores são validados na API.
- **Telefones:** formato E.164 (+55...), o que também aceita números de outros países.
- **Datas:** gravadas em UTC e exibidas em America/Campo\_Grande.
- **Arquivos:** nenhum binário no banco; a tabela `arquivos` guarda a chave no storage e as demais tabelas apontam para ela.
- **Índices principais:** busca de membros por nome (extensão pg\_trgm), `(organizacao_id, status)`, `eventos.inicio_em`, `avisos.publicar_em` decrescente.

### Domínio 1 · Organização e acesso

| Tabela | Campos principais | Observações |
| --- | --- | --- |
| `organizacoes` | id, nome, slug, cidade, uf, logo\_arquivo\_id | Hoje uma linha: TLC Ponta Porã - MS |
| `igrejas` | id, organizacao\_id, nome, pastor, cidade, telefone, ativa | Lista mantida pela coordenação |
| `usuarios` | id, organizacao\_id, email (único), senha\_hash, status (pendente/ativo/bloqueado/inativo), email\_verificado\_em, ultimo\_login\_em | Senha com argon2id |
| `perfis` | id, codigo, nome, nivel | Seis perfis fixos (seed) |
| `usuario_perfis` | usuario\_id, perfil\_id, atribuido\_por, atribuido\_em | Um usuário pode acumular perfis |
| `permissoes` | id, recurso, acao | Ex.: `avisos` + `publicar` |
| `perfil_permissoes` | perfil\_id, permissao\_id | Base da matriz de permissões |
| `sessoes` | id, usuario\_id, token\_hash, dispositivo, ip, expira\_em, revogado\_em | Refresh tokens com rotação |
| `recuperacoes_senha` | id, usuario\_id, token\_hash, expira\_em, usado\_em | Token de uso único, validade curta |

### Domínio 2 · Membros

| Tabela | Campos principais | Observações |
| --- | --- | --- |
| `membros` | id, organizacao\_id, usuario\_id (opcional, único), igreja\_id, nome\_completo, foto\_arquivo\_id, cpf\_cifrado (obrigatório; vazio só em registro anonimizado), cpf\_hash (único), data\_nascimento, telefone, whatsapp, email, cep, logradouro, numero, complemento, bairro, cidade, uf, observacoes, status (ativo/inativo/pendente), data\_ingresso | Membro sem login é permitido: a secretaria cadastra e libera o acesso depois |
| `membro_historico` | id, membro\_id, tipo (cadastro/mudanca\_igreja/turma/evento/perfil/status/observacao), descricao, referencia\_tipo, referencia\_id, criado\_por | Linha do tempo gerada automaticamente pelo sistema |
| `turmas` | id, organizacao\_id, nome, ano, data\_inicio, data\_fim, status | Edição do treinamento (opcional no MVP) |
| `membro_turmas` | membro\_id, turma\_id, papel (aluno/facilitador/coordenador), situacao (cursando/concluido/desistente) | Alimenta o histórico do membro |

### Domínio 3 · Mural de avisos

| Tabela | Campos principais | Observações |
| --- | --- | --- |
| `categorias_aviso` | id, nome, slug, cor | Seed: Geral, Eventos, Coordenação, Importante |
| `avisos` | id, organizacao\_id, titulo, conteudo, imagem\_arquivo\_id, categoria\_id, autor\_id, status (rascunho/agendado/publicado/arquivado), fixado, publico\_alvo (todos/membros/coordenacao), publicar\_em, expira\_em | `autor_id` e `criado_em` formam a autoria e a data exibidas |
| `aviso_comentarios` | id, aviso\_id, usuario\_id, parent\_id, texto, status (visivel/oculto/removido) | `parent_id` permite respostas de um nível |
| `aviso_reacoes` | aviso\_id, usuario\_id, tipo (curtir/amem/orar/celebrar) | Chave composta: uma reação por pessoa por aviso |
| `aviso_leituras` | aviso\_id, usuario\_id, lido\_em | Mede alcance e define o contador de não lidos |

### Domínio 4 · Eventos

| Tabela | Campos principais | Observações |
| --- | --- | --- |
| `eventos` | id, organizacao\_id, nome, descricao, inicio\_em, fim\_em, local\_nome, local\_endereco, imagem\_arquivo\_id, capacidade, status (rascunho/inscricoes\_abertas/esgotado/encerrado/cancelado), publico\_no\_site, exige\_inscricao, turma\_id (opcional), criado\_por | `capacidade` nula = sem limite |
| `evento_inscricoes` | id, evento\_id, membro\_id, status (confirmada/lista\_espera/cancelada), qr\_token, inscrito\_em | Único por `(evento_id, membro_id)` |
| `evento_checkins` | id, evento\_id, membro\_id, metodo (qr/manual), registrado\_por, registrado\_em | Único por `(evento_id, membro_id)`: impede check-in duplicado |

### Domínio 5 · Galeria

| Tabela | Campos principais | Observações |
| --- | --- | --- |
| `albuns` | id, titulo, descricao, evento\_id (opcional), capa\_foto\_id, visibilidade (publico/membros), status, criado\_por | Álbum ligado a evento ou avulso |
| `fotos` | id, album\_id, arquivo\_id, miniatura\_arquivo\_id, legenda, largura, altura, ordem, enviado\_por | Miniaturas geradas no upload |

### Domínio 6 · Documentos

| Tabela | Campos principais | Observações |
| --- | --- | --- |
| `categorias_documento` | id, nome | Seed: Regulamentos, Apostilas, Comunicados, Outros |
| `documentos` | id, organizacao\_id, titulo, descricao, categoria\_id, arquivo\_id, versao, publicado\_em, criado\_por | Apenas PDF no MVP |
| `documento_perfis` | documento\_id, perfil\_id | Quais perfis enxergam o documento; vazio = todos os autenticados |
| `documento_downloads` | documento\_id, usuario\_id, baixado\_em | Relatório de acesso |

### Domínio 7 · Notificações

| Tabela | Campos principais | Observações |
| --- | --- | --- |
| `notificacoes` | id, tipo, titulo, corpo, dados (JSON com link), origem\_tipo, origem\_id, prioridade (normal/alta), segmento (JSON), enviar\_em, status, criado\_por | Uma linha por disparo |
| `notificacao_destinatarios` | id, notificacao\_id, usuario\_id, push\_status, lida\_em | Caixa de entrada do app e rastreio de entrega |
| `dispositivos` | id, usuario\_id, plataforma (android/ios/web), push\_token, app\_versao, ativo, ultimo\_uso\_em | Um usuário, vários aparelhos |
| `preferencias_notificacao` | usuario\_id, tipo, push, email, no\_app | O membro escolhe o que recebe |

### Domínio 8 · Site institucional

| Tabela | Campos principais | Observações |
| --- | --- | --- |
| `paginas_site` | id, slug, titulo, conteudo, publicado, atualizado\_por | Quem Somos e História do TLC editáveis pelo painel |
| `mensagens_contato` | id, nome, email, telefone, assunto, mensagem, status (nova/em\_atendimento/respondida), respondido\_por | Formulário da página Contato |

### Domínio 9 · Sistema

| Tabela | Campos principais | Observações |
| --- | --- | --- |
| `arquivos` | id, chave\_storage, nome\_original, mime, tamanho\_bytes, hash\_sha256, enviado\_por | Valida tipo e tamanho no upload |
| `auditoria` | id, usuario\_id, acao, entidade, entidade\_id, antes (JSON), depois (JSON), ip, criado\_em | Obrigatória para dados pessoais, perfis e exclusões |

## 3. Relacionamento entre tabelas

O cadastro de membros é o centro do modelo: liga igrejas, turmas, eventos e histórico, e se conecta ao login por uma relação opcional de 1 para 1.

&#91;embedded content: modelo entidade-relacionamento · 14 entidades centrais\]

O diagrama mostra as 14 entidades centrais; `N` perto de uma tabela indica quantas linhas dela podem existir para cada linha da outra. A tabela `membros` pode existir sem `usuarios`, porque a Secretaria cadastra primeiro e libera o acesso depois.

### Todos os relacionamentos

| Relação | Tipo | Chave e regra de integridade |
| --- | --- | --- |
| `organizacoes` e todo conteúdo | 1 para N | `organizacao_id` em igrejas, usuários, membros, avisos, eventos, álbuns e documentos |
| `igrejas` e `membros` | 1 para N | Igreja com membros só pode ser inativada, nunca apagada |
| `usuarios` e `membros` | 1 para 0..1 | `membros.usuario_id` é opcional e único |
| `usuarios` e `perfis` | N para N | Tabela `usuario_perfis`, chave composta |
| `perfis` e `permissoes` | N para N | Tabela `perfil_permissoes`, chave composta |
| `membros` e `membro_historico` | 1 para N | Só inserção; nenhuma linha é editada |
| `membros` e `turmas` | N para N | Tabela `membro_turmas`; um membro entra uma vez por turma |
| `usuarios` e `avisos` | 1 para N | `avisos.autor_id` |
| `categorias_aviso` e `avisos` | 1 para N | `avisos.categoria_id`, obrigatório |
| `avisos` e `aviso_comentarios` | 1 para N | `parent_id` aponta para outro comentário (respostas de um nível) |
| `avisos` e `aviso_reacoes` | 1 para N | Chave composta `(aviso_id, usuario_id)`: uma reação por pessoa |
| `avisos` e `aviso_leituras` | 1 para N | Chave composta `(aviso_id, usuario_id)` |
| `eventos` e `evento_inscricoes` | 1 para N | Único por `(evento_id, membro_id)` |
| `eventos` e `evento_checkins` | 1 para N | Único por `(evento_id, membro_id)`; exige inscrição quando o evento exige inscrição |
| `eventos` e `albuns` | 1 para N | `albuns.evento_id` opcional; vazio é álbum avulso |
| `albuns` e `fotos` | 1 para N | Exclusão do álbum remove as fotos de forma lógica |
| `categorias_documento` e `documentos` | 1 para N | `documentos.categoria_id` |
| `documentos` e `perfis` | N para N | Tabela `documento_perfis`; sem linhas, todos os autenticados veem |
| `arquivos` e demais tabelas | 1 para N | Foto do membro, imagem de aviso e de evento, fotos e documentos apontam para `arquivos` |
| `notificacoes` e `notificacao_destinatarios` | 1 para N | Uma linha por usuário alcançado |
| `usuarios` e `dispositivos` | 1 para N | Um usuário pode ter vários aparelhos com push |
| `notificacoes` e sua origem | N para 1 | `origem_tipo` e `origem_id` apontam para aviso, evento ou documento |
| `usuarios` e `auditoria` | 1 para N | `auditoria.usuario_id`, sem exclusão em cascata |

## 4. Wireframes das telas principais

São 9 telas do aplicativo e 6 do painel e do site, em baixa fidelidade: mostram o que existe em cada tela e onde fica, sem cor nem tipografia final. `[ ]` é botão ou campo, `[x]` caixa marcada, `>` leva a outra tela.

### Aplicativo mobile

**Login:** um campo só, para o CPF, entrada por biometria e caminho claro para cadastro e recuperação de senha.

```text
┌──────────────────────────────────────┐
│                                      │
│            ( logo TLC )              │
│                                      │
│       TLC Ponta Porã - MS            │
│   Treinamento de Liderança Cristã    │
│                                      │
│  CPF                                 │
│  [_____________________________]     │
│  Senha                               │
│  [___________________________] o     │
│                                      │
│  [           ENTRAR           ]      │
│        Esqueci minha senha           │
│                                      │
│  ───────────── ou ─────────────      │
│  [   Entrar com biometria   ]        │
│                                      │
│  Ainda não tem cadastro? Criar       │
│                                      │
└──────────────────────────────────────┘
```

**Início (mural de avisos):** feed com filtro por categoria, avisos fixados no topo e sino de notificações com contador.

```text
┌──────────────────────────────────────┐
│ TLC Ponta Porã            [sino 3]   │
│ ──────────────────────────────────── │
│ Olá, Maria                           │
│ [Todos] Geral Eventos Coord. Imp.    │
│                                      │
│ ┌────────────────────────────────┐   │
│ │ IMPORTANTE              fixado │   │
│ │ Reunião de coordenação         │   │
│ │ Sábado, 8h, no salão principal │   │
│ │ [ imagem do aviso ]            │   │
│ │ 12 reações · 4 comentários     │   │
│ └────────────────────────────────┘   │
│                                      │
│ ┌────────────────────────────────┐   │
│ │ EVENTOS · 20 nov               │   │
│ │ Culto de formatura             │   │
│ │ Inscrições abertas · 38 vagas  │   │
│ └────────────────────────────────┘   │
│                                      │
│ ──────────────────────────────────── │
│ [Início] Eventos Galeria Docs Perfil │
└──────────────────────────────────────┘
```

**Detalhe do aviso:** categoria, autor e data no topo; reações em um toque; comentários com resposta.

```text
┌──────────────────────────────────────┐
│ < Voltar                             │
│ ──────────────────────────────────── │
│ IMPORTANTE · Ana Lima · 13 nov       │
│ Reunião de coordenação               │
│                                      │
│ [      imagem do aviso      ]        │
│                                      │
│ Texto completo do aviso, com         │
│ parágrafos e links.                  │
│                                      │
│ Reagir: Curtir Amém Orar Celebrar    │
│ 12 reações                           │
│ ──────────────────────────────────── │
│ Comentários (4)                      │
│ Pedro: Estarei lá!                   │
│   Responder                          │
│ João: Qual é o horário?              │
│   Responder                          │
│                                      │
│ [ Escreva um comentário...   ] [>]   │
└──────────────────────────────────────┘
```

**Detalhe do evento e ingresso:** o botão principal muda conforme o estado (Quero participar, Entrar na lista de espera, Ver meu ingresso); o QR Code abre em uma tela própria e funciona sem internet.

```text
┌──────────────────────────────────────┐   ┌──────────────────────────────────────┐
│ < Eventos                            │   │ < Meu ingresso                       │
│ [        imagem do evento        ]   │   │                                      │
│                                      │   │ Inscrição confirmada                 │
│ Culto de formatura                   │   │ Apresente o QR Code na entrada       │
│ Sáb, 20 nov · 19h30                  │   │                                      │
│ Local: salão principal               │   │        ┌──────────────┐              │
│ Vagas: 38 restantes de 120           │   │        │  ## .. ## .. │              │
│                                      │   │        │  .. ## .. ## │              │
│ Descrição do evento, programação     │   │        │  ## .. ## .. │              │
│ e orientações de chegada.            │   │        └──────────────┘              │
│                                      │   │                                      │
│ 82 inscritos                         │   │         Maria Souza                  │
│                                      │   │ Culto de formatura · 20 nov, 19h30   │
│ [      QUERO PARTICIPAR      ]       │   │ Funciona sem internet                │
│                                      │   │                                      │
└──────────────────────────────────────┘   │ [    Cancelar inscrição    ]         │
                                           └──────────────────────────────────────┘
```

**Galeria e documentos:** álbuns em grade de dois por linha; documentos em lista com tipo, tamanho e data de atualização.

```text
┌──────────────────────────────────────┐   ┌──────────────────────────────────────┐
│ Galeria                              │   │ Documentos                           │
│ [Álbuns]  Por evento                 │   │ [ Buscar documento...          ]     │
│                                      │   │ [Todos] Regulam. Apostilas Comunic.  │
│ ┌───────────────┐ ┌───────────────┐  │   │                                      │
│ │ [  capa  ]    │ │ [  capa  ]    │  │   │ ┌────────────────────────────────┐   │
│ │ Formatura 2026│ │ Retiro 2026   │  │   │ │ PDF  Regulamento geral do TLC  │   │
│ │ 48 fotos      │ │ 120 fotos     │  │   │ │      1,2 MB · atualizado 02 nov│   │
│ └───────────────┘ └───────────────┘  │   │ └────────────────────────────────┘   │
│ ┌───────────────┐ ┌───────────────┐  │   │ ┌────────────────────────────────┐   │
│ │ [  capa  ]    │ │ [  capa  ]    │  │   │ │ PDF  Apostila · Módulo 1       │   │
│ │ Encontro jovem│ │ Culto abertura│  │   │ │      3,4 MB · atualizado 20 out│   │
│ │ 36 fotos      │ │ 22 fotos      │  │   │ └────────────────────────────────┘   │
│ └───────────────┘ └───────────────┘  │   │ ┌────────────────────────────────┐   │
│                                      │   │ │ PDF  Comunicado da coordenação │   │
│ ──────────────────────────────────── │   │ │      0,2 MB · 10 nov           │   │
│ Início Eventos [Galeria] Docs Perfil │   │ └────────────────────────────────┘   │
└──────────────────────────────────────┘   │                                      │
                                           │ ──────────────────────────────────── │
                                           │ Início Eventos Galeria [Docs] Perfil │
                                           └──────────────────────────────────────┘
```

**Perfil e notificações:** o perfil reúne dados, histórico, ingressos e segurança; a caixa de notificações separa hoje e ontem e marca o que não foi lido.

```text
┌──────────────────────────────────────┐   ┌──────────────────────────────────────┐
│ Perfil                               │   │ < Notificações    Marcar como lidas  │
│                                      │   │ ──────────────────────────────────── │
│          ( foto )                    │   │ HOJE                                 │
│        Maria Souza                   │   │ * Novo aviso importante              │
│    Membro · Igreja Central           │   │   Reunião de coordenação · 08:02     │
│                                      │   │ * Evento amanhã                      │
│ ──────────────────────────────────── │   │   Culto de formatura, 19h30 · 07:00  │
│ Dados pessoais                    >  │   │                                      │
│ Contato e endereço                >  │   │ ONTEM                                │
│ Meu histórico                     >  │   │   Inscrição confirmada               │
│ Meus eventos e QR Codes           >  │   │   Culto de formatura · 18:11         │
│ Notificações                      >  │   │   Novo documento: Apostila · Módulo 1│
│ Segurança (senha e biometria)     >  │   │   Biblioteca · 15:40                 │
│ ──────────────────────────────────── │   │                                      │
│ Sair                                 │   └──────────────────────────────────────┘
│                                      │
│ Início Eventos Galeria Docs [Perfil] │
└──────────────────────────────────────┘
```

### Painel administrativo e site

**Dashboard:** os quatro indicadores pedidos (membros, eventos, usuários ativos, últimos avisos) mais pendências de aprovação e atalhos de criação no topo.

```text
┌──────────────────┬───────────────────────────────────────────────────────────────────────┐
│   TLC Ponta Porã │ Dashboard        [Buscar...]  [sino 3]  Ana Lima v                    │
│                  │ ───────────────────────────────────────────────────────────────────── │
│ > Dashboard      │ [+ Novo aviso] [+ Novo evento] [+ Novo membro]                        │
│   Membros        │                                                                       │
│   Mural          │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│   Eventos        │ │ Total membros│ │ Eventos      │ │ Usuários     │ │ Pendências   │   │
│   Check-in       │ │ 248          │ │ 14           │ │ 171          │ │ 3            │   │
│   Galeria        │ │ +6 no mês    │ │ 2 abertos    │ │ ativos (30 d)│ │ aprovações   │   │
│   Documentos     │ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
│   Notificações   │                                                                       │
│   Site           │ ┌────────────────────────────────┐ ┌────────────────────────────────┐ │
│   Usuários       │ │ Últimos avisos                 │ │ Próximos eventos               │ │
│   Configurações  │ │ IMPORTANTE Reunião de coord.   │ │ 20 nov  Culto de formatura     │ │
│   Auditoria      │ │ EVENTOS    Culto de formatura  │ │ 27 nov  Encontro de líderes    │ │
│                  │ │ GERAL      Horário secretaria  │ │ 04 dez  Retiro de fim de ano   │ │
│                  │ │ Ver todos >                    │ │ Ver todos >                    │ │
│                  │ └────────────────────────────────┘ └────────────────────────────────┘ │
└──────────────────┴───────────────────────────────────────────────────────────────────────┘
```

**Lista de membros:** busca por nome ou CPF, filtros por igreja, status e turma, e exportação.

```text
┌──────────────────┬───────────────────────────────────────────────────────────────────────┐
│   TLC Ponta Porã │ Membros                                      [+ Novo membro]          │
│                  │ ───────────────────────────────────────────────────────────────────── │
│   Dashboard      │ [Buscar nome ou CPF...] [Igreja v] [Status v] [Turma v]               │
│ > Membros        │                                                                       │
│   Mural          │ Nome                  Igreja            Status     WhatsApp           │
│   Eventos        │ ───────────────────────────────────────────────────────────────────── │
│   Check-in       │ Maria Souza           Igreja Central    Ativo      (67) 9xxxx-0001    │
│   Galeria        │ João Pereira          Igreja Esperança  Ativo      (67) 9xxxx-0002    │
│   Documentos     │ Ana Lima              Igreja Central    Ativo      (67) 9xxxx-0003    │
│   Notificações   │ Pedro Alves           Igreja Betel      Pendente   (67) 9xxxx-0004    │
│   Site           │ Luciana Rocha         Igreja Esperança  Inativo    (67) 9xxxx-0005    │
│   Usuários       │                                                                       │
│   Configurações  │ Mostrando 1-20 de 248            < 1  2  3  ... 13 >   [Exportar]     │
│   Auditoria      │                                                                       │
└──────────────────┴───────────────────────────────────────────────────────────────────────┘
```

**Perfil do membro:** dados com CPF mascarado (visão da Secretaria; Administradores têm o botão Mostrar CPF), abas de histórico, turmas e presença, e a linha do tempo gerada pelo sistema.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Membros > Maria Souza                                                                    │
│                                                                                          │
│ ( foto )   Maria Souza                     [Editar]  [Inativar]                          │
│            Igreja Central · Ativo · membro desde 2024                                    │
│                                                                                          │
│ [Dados]  Histórico  Turmas  Presença                                                     │
│ ──────────────────────────────────────────────────────────────────────                   │
│ CPF             ***.456.789-**       Nascimento    14/03/1990                            │
│ Telefone        (67) 3xxx-0001       WhatsApp      (67) 9xxxx-0001                       │
│ E-mail          maria@exemplo.com    Igreja        Igreja Central                        │
│ Endereço        Rua Exemplo, 100 · Centro · Ponta Porã - MS                              │
│ Observações     (internas, visíveis só à equipe administrativa)                          │
│ ──────────────────────────────────────────────────────────────────────                   │
│ Histórico recente                                                                        │
│   20 nov 2026   Presença no evento Culto de formatura                                    │
│   02 mar 2026   Concluiu a turma TLC 2025                                                │
│   10 jan 2025   Entrou na turma TLC 2025                                                 │
│   05 jan 2025   Cadastro aprovado pela Secretaria                                        │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Novo membro:** formulário único, usado também para menores de 18 anos.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Membros > Novo membro                                                                    │
│ ──────────────────────────────────────────────────────────────────────────────────────   │
│ Dados pessoais                                                                           │
│ Nome completo *  [______________________________]      ( foto )  [ Enviar foto ]         │
│ CPF *            [___.___.___-__]    Nascimento *  [__/__/____]                          │
│ Telefone         [(__) _____-____]   WhatsApp      [(__) _____-____]                     │
│ E-mail           [______________________________]                                        │
│ Igreja *         [Selecione v]                                                           │
│ Endereço         CEP [_____-___] [Buscar]   Rua [______________]  Nº [____]              │
│ Observações      [ internas, só a equipe vê ____________________________ ]               │
│                                                                                          │
│ Depois de salvo, o CPF aparece mascarado para a Secretaria (RN-MEM-11).                  │
│                                                                                          │
│ [ Salvar rascunho ]                              [ Cadastrar membro ]                    │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Check-in (modo recepção):** tela cheia com leitor de QR Code, busca manual, contador de presentes e resposta imediata a cada leitura.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Check-in · Culto de formatura · 20 nov, 19h30          [Sair]                            │
│                                                                                          │
│ Presentes: 64 de 82 inscritos          [########-----] 78%                               │
│                                                                                          │
│ ┌──────────────────────────────┐   [ Buscar por nome ou CPF...  ]                        │
│ │                              │                                                         │
│ │        ( câmera / QR )       │   Últimos check-ins                                     │
│ │                              │   19:42  Maria Souza                                    │
│ │      aponte para o QR        │   19:41  João Pereira                                   │
│ │                              │   19:39  Ana Lima                                       │
│ └──────────────────────────────┘                                                         │
│                                                                                          │
│ ╔══════════════════════════════════════════════════════════════════╗                     │
│ ║  OK  Maria Souza · Igreja Central · check-in às 19:42            ║                     │
│ ╚══════════════════════════════════════════════════════════════════╝                     │
│ Aviso em vermelho quando já registrado: "Já registrado às 19:42"                         │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Novo aviso:** formulário curto com prévia do aviso no app ao lado; agendamento e push ficam na mesma tela.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Mural > Novo aviso                                      ┌──────────────────────┐         │
│ ────────────────────────────────────────                │ Prévia no app        │         │
│ Título *                                                │                      │         │
│ [______________________________________]                │ IMPORTANTE           │         │
│ Categoria *   [Geral v]                                 │ Título do aviso      │         │
│               Geral · Eventos · Coord. · Importante     │ Início do texto...   │         │
│ Conteúdo *                                              │ [ imagem ]           │         │
│ ┌──────────────────────────────────────┐                │ 0 reações            │         │
│ │ B  I  Lista  Link                    │                └──────────────────────┘         │
│ │ Escreva o aviso aqui...              │                                                 │
│ │                                      │                                                 │
│ └──────────────────────────────────────┘                                                 │
│ Imagem        [ Enviar imagem ]  (até 5 MB)                                              │
│ Quem vê       (o) Todos  ( ) Só coordenação                                              │
│ Publicar      (o) Agora  ( ) Agendar [__/__/____ __:__]                                  │
│ [x] Fixar no topo     [x] Enviar notificação push                                        │
│                                                                                          │
│ [ Salvar rascunho ]            [ Publicar aviso ]                                        │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Home do site institucional:** chamada principal, próximos eventos públicos, galeria recente e botão Entrar sempre no menu.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ [logo TLC]   Home  Quem Somos  História  Eventos  Galeria  Contato [Entrar]              │
│ ──────────────────────────────────────────────────────────────────────────               │
│                                                                                          │
│        Treinamento de Liderança Cristã                                                   │
│        Formando líderes para servir em Ponta Porã e região                               │
│                                                                                          │
│        [ Conheça o TLC ]    [ Ver próximos eventos ]                                     │
│                                                                                          │
│ ──────────────────────────────────────────────────────────────────────────               │
│ Próximos eventos                                                                         │
│ ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐                  │
│ │ 20 nov              │ │ 27 nov              │ │ 04 dez              │                  │
│ │ Culto de formatura  │ │ Encontro de líderes │ │ Retiro de fim de ano│                  │
│ │ [ver detalhes]      │ │ [ver detalhes]      │ │ [ver detalhes]      │                  │
│ └─────────────────────┘ └─────────────────────┘ └─────────────────────┘                  │
│                                                                                          │
│ Galeria recente   [Ver galeria completa >]                                               │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐                  │
│ │ [foto]        │ │ [foto]        │ │ [foto]        │ │ [foto]        │                  │
│ └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘                  │
│                                                                                          │
│ ──────────────────────────────────────────────────────────────────────────               │
│ TLC Ponta Porã - MS · contato@... · redes sociais · privacidade                          │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

## 5. Navegação do aplicativo

O app tem cinco abas fixas na barra inferior e o sino de notificações no topo de todas elas; qualquer tela fica a no máximo 3 toques do início.

&#91;embedded content: navegação do app · 5 abas e sino de notificações\]

### O que muda conforme o perfil

| Perfil | O que vê no app |
| --- | --- |
| Visitante | Não usa o app: sem login vê apenas a tela de entrada e o cadastro; o conteúdo público está no site |
| Membro | As cinco abas, com inscrição em eventos, comentários, reações e documentos liberados para o seu perfil |
| Coordenador | O mesmo do Membro, mais botão "+" para publicar aviso, criar evento e enviar fotos, e a opção de moderar comentários |
| Secretaria | O mesmo do Coordenador, mais o modo Check-in em Eventos (leitor de QR Code e busca manual) |
| Administrador e Super Administrador | O mesmo da Secretaria, com atalho para abrir o painel administrativo no navegador; a gestão completa fica no painel |

### Regras de navegação

- **Abertura:** o app abre na última aba usada; depois da primeira vez, a biometria substitui a senha.
- **Link profundo:** cada notificação abre a tela exata (`tlc://avisos/{id}`, `tlc://eventos/{id}`, `tlc://documentos/{id}`); se o app estiver fechado ele abre e leva o usuário até lá.
- **Contador:** a aba Início mostra a quantidade de avisos não lidos e o sino, as notificações não lidas.
- **Sem internet:** o mural, os eventos e o QR Code já carregados continuam abertos; ações como comentar ficam em fila e são enviadas quando a conexão volta.
- **Sessão expirada:** o app renova o acesso sozinho; se não conseguir, volta ao login e retoma a tela em que o usuário estava.
- **Atualização obrigatória:** se a API recusar uma versão muito antiga do app, aparece um aviso com link para a loja.

## 6. Navegação do painel administrativo

O painel usa menu lateral fixo com 11 áreas, uma por módulo, e cada usuário só vê os itens que o seu perfil permite.

| Menu | Telas | Perfis com acesso |
| --- | --- | --- |
| Dashboard | Visão geral com total de membros, eventos cadastrados, usuários ativos e últimos avisos; atalhos para as tarefas mais comuns | Super Admin, Admin, Coordenador, Secretaria |
| Membros | Lista com busca e filtros · Novo membro · Perfil do membro (dados, histórico, turmas, presença) · Aprovações pendentes · Igrejas · Turmas | Super Admin, Admin, Secretaria; Coordenador só consulta a lista |
| Mural | Avisos · Novo aviso · Rascunhos e agendados · Moderação de comentários · Categorias | Super Admin, Admin, Coordenador, Secretaria |
| Eventos | Lista · Novo evento · Detalhe do evento (inscritos, lista de espera, presença) · Histórico de eventos | Super Admin, Admin, Coordenador, Secretaria |
| Check-in | Modo recepção em tela cheia: leitor de QR Code, busca manual por nome ou CPF, contador de presentes | Super Admin, Admin, Coordenador, Secretaria |
| Galeria | Álbuns · Novo álbum · Envio de fotos em lote | Super Admin, Admin, Coordenador, Secretaria |
| Documentos | Biblioteca · Novo documento · Categorias · Relatório de downloads | Super Admin, Admin, Coordenador, Secretaria |
| Notificações | Enviar comunicado · Histórico e entrega · Modelos de mensagem | Super Admin, Admin, Coordenador |
| Site | Páginas (Quem Somos, História do TLC) · Mensagens de contato | Páginas: Super Admin, Admin, Coordenador. Mensagens: Super Admin, Admin, Secretaria |
| Usuários e acesso | Usuários · Convites · Perfis e permissões (matriz em leitura) | Super Admin, Admin |
| Configurações | Organização · Termos e privacidade · Integrações de push e e-mail | Super Admin, Admin; Integrações só Super Admin |
| Auditoria | Trilha de ações com filtros por usuário, entidade e data | Super Admin |

### Barra superior e comportamento

- **Busca global:** encontra membros, avisos e eventos a partir de qualquer tela.
- **Atalho "+ Novo":** abre aviso, evento, membro ou álbum, conforme a permissão.
- **Sino de notificações:** pendências como aprovações de cadastro e mensagens de contato novas.
- **Menu do usuário:** meu perfil, trocar senha, ver como membro (abre o portal) e sair.
- **Telas pequenas:** o menu lateral vira ícones abaixo de 1280 px e uma gaveta abaixo de 768 px; o modo Check-in funciona bem em tablet e celular.
- **Orientação:** migalhas de pão em toda tela interna, listas com filtros que o usuário pode salvar e estados vazios com a ação sugerida ("Nenhum evento ainda. Criar o primeiro").

## 7. Regras de negócio

Cada regra tem um código (RN-módulo-número) para ser citada em tarefas, testes e conversas com a coordenação.

### Autenticação

| Código | Regra |
| --- | --- |
| RN-AUT-01 | O login é feito somente com CPF (11 dígitos, com ou sem máscara) e senha; não há login por e-mail. O e-mail serve para recuperar a senha e receber avisos, por isso é obrigatório para quem terá acesso. Todo usuário está ligado a um membro com CPF, inclusive equipe e administradores. |
| RN-AUT-02 | O CPF é validado pelos dígitos verificadores e é único por organização. |
| RN-AUT-03 | Senha com no mínimo 8 caracteres, ao menos 1 letra e 1 número, fora de uma lista de senhas comuns. |
| RN-AUT-04 | Após 5 tentativas falhas, a conta fica bloqueada por 15 minutos. A mensagem é sempre "Credenciais inválidas", sem dizer qual dado errou. |
| RN-AUT-05 | Recuperação de senha por link de uso único, válido por 60 minutos, enviado ao e-mail cadastrado. A resposta é igual exista ou não a conta. Quem entra por CPF vê o e-mail mascarado (j\*\*\*@gmail.com). |
| RN-AUT-06 | Membro sem e-mail cadastrado só recupera a senha pela Secretaria, que gera um novo convite. |
| RN-AUT-07 | Sessão: token de acesso de 15 minutos e refresh token de 30 dias com rotação. Trocar a senha encerra todas as sessões. |
| RN-AUT-08 | Cadastro feito pelo site cria usuário `pendente`; a Secretaria aprova, vincula ao membro e o perfil passa a Membro. |
| RN-AUT-09 | Membro cadastrado pela Secretaria recebe convite por e-mail ou WhatsApp com link para criar a senha, válido por 7 dias. |

### Membros

| Código | Regra |
| --- | --- |
| RN-MEM-01 | Campos obrigatórios: nome completo, CPF, data de nascimento, telefone ou WhatsApp e igreja. E-mail é obrigatório só para quem terá login. Todos, inclusive menores a partir de 13 anos, precisam de CPF (RN-MEM-10). |
| RN-MEM-02 | CPF duplicado é bloqueado; quem tem permissão vê um atalho para o cadastro já existente. |
| RN-MEM-03 | Foto em JPG, PNG ou WebP até 5 MB, recortada em formato quadrado. |
| RN-MEM-04 | Membros são inativados, não apagados. A exclusão definitiva é só do Super Administrador, anonimiza os dados pessoais e fica na auditoria. |
| RN-MEM-05 | O histórico é gerado pelo sistema, só recebe novas linhas e nunca é editado. |
| RN-MEM-06 | O campo Observações é interno: Secretaria e níveis acima veem; o próprio membro não. |
| RN-MEM-07 | O membro edita sozinho telefone, WhatsApp, e-mail, endereço e foto. Nome e igreja mudam pela Secretaria e geram linha no histórico; o CPF só muda por Administrador ou Super Administrador. |
| RN-MEM-08 | O cadastro registra o aceite do termo de privacidade (LGPD) com data e versão do texto. |
| RN-MEM-09 | O TLC atende a partir de 13 anos: o cadastro é recusado se a data de nascimento indicar menos de 13 anos. Quem tem de 13 a 17 anos é cadastrado como qualquer outro membro, sem responsável legal; a idade, calculada pela data de nascimento, também serve para filtros e relatórios. |
| RN-MEM-10 | O CPF é obrigatório para todos os membros, a qualquer idade (a partir de 13 anos), porque o login é feito só por CPF. Substitui a regra anterior que permitia cadastrar menor sem CPF. Só registro anonimizado (LGPD) fica sem CPF. |
| RN-MEM-11 | CPF completo só é visto por Super Administrador, Administrador e pelo próprio titular; os demais perfis veem o CPF mascarado (\*\*\*.456.789-\*\*). A regra vale na API, no painel, no app e nas exportações, e cada abertura do CPF completo de outra pessoa fica registrada na auditoria. |
| RN-MEM-12 | A Secretaria digita o CPF ao cadastrar, mas depois só o vê mascarado; a busca por CPF funciona com o número inteiro, e a correção do CPF é feita por Administrador ou Super Administrador. |

### Mural de avisos

| Código | Regra |
| --- | --- |
| RN-AVI-01 | Publicam avisos: Coordenador, Secretaria, Administrador e Super Administrador. Membros leem, comentam e reagem. |
| RN-AVI-02 | Categoria é obrigatória. Avisos da categoria Importante sugerem push ao autor, com um clique para confirmar; nas demais o push é opcional. |
| RN-AVI-03 | Até 3 avisos podem ficar fixados no topo. |
| RN-AVI-04 | Aviso com `publicar_em` futuro fica `agendado`; ao passar de `expira_em` é arquivado sozinho. |
| RN-AVI-05 | Comentário: só para autenticados, até 1.000 caracteres, editável por 10 minutos. Coordenador e níveis acima podem ocultar comentários. |
| RN-AVI-06 | Cada pessoa tem uma reação por aviso: tocar de novo remove, tocar em outra troca. |
| RN-AVI-07 | Aviso publicado e editado mostra "editado em" com a data. Excluir significa arquivar; a exclusão definitiva é do Administrador. |

### Eventos

| Código | Regra |
| --- | --- |
| RN-EVE-01 | O status muda sozinho: vira `esgotado` quando as inscrições confirmadas igualam a capacidade e `encerrado` depois de `fim_em`. Sem capacidade, as vagas são ilimitadas. |
| RN-EVE-02 | Inscrição só para membro autenticado. Sem vaga, entra na lista de espera. |
| RN-EVE-03 | Cancelar uma inscrição libera a vaga e promove o primeiro da lista de espera, que recebe notificação. |
| RN-EVE-04 | Cada inscrição gera um QR Code assinado e único, que deixa de valer quando o evento é encerrado. |
| RN-EVE-05 | O check-in vale de 2 horas antes do início até 2 horas depois do fim e só pode ser feito uma vez por membro. |
| RN-EVE-06 | Check-in por QR ou por busca manual (nome ou CPF); o manual é da Secretaria e níveis acima. |
| RN-EVE-07 | Em evento sem inscrição prévia, qualquer membro ativo pode fazer check-in direto. |
| RN-EVE-08 | Cancelar um evento notifica todos os inscritos com prioridade alta. |
| RN-EVE-09 | Eventos encerrados continuam consultáveis. A lista de presença é exportável em CSV e PDF e alimenta o histórico de cada membro. |
| RN-EVE-10 | O evento só aparece no site se estiver marcado como público e fora do status `rascunho`. |

### Galeria e documentos

| Código | Regra |
| --- | --- |
| RN-GAL-01 | Upload por Coordenador e níveis acima: JPG, PNG, WebP ou HEIC até 15 MB, em lotes de até 50 fotos. O sistema gera miniatura e versão web. |
| RN-GAL-02 | Álbum público (site) exige que o autor confirme ter autorização de imagem das pessoas fotografadas; sem confirmação, o álbum fica só para membros. |
| RN-GAL-03 | A localização (EXIF) é removida de toda foto enviada. |
| RN-DOC-01 | Só PDF até 25 MB no MVP. Documentos exigem login: visitante não acessa. |
| RN-DOC-02 | Cada documento define os perfis que o enxergam; sem seleção, todos os autenticados veem. |
| RN-DOC-03 | Substituir o arquivo aumenta a versão e notifica quem já baixou. Todo download é registrado. |

### Notificações e dashboard

| Código | Regra |
| --- | --- |
| RN-NOT-01 | O push depende da permissão do aparelho; sem ela, o aviso aparece na caixa de entrada do app. |
| RN-NOT-02 | Prioridade normal: no máximo 3 push por dia por usuário e silêncio das 22h às 7h (fuso America/Campo\_Grande); o excedente entra no resumo da manhã. Prioridade alta ignora ambos os limites. |
| RN-NOT-03 | Comentários e reações no mesmo aviso são agrupados em uma só notificação. |
| RN-NOT-04 | O usuário desliga categorias, exceto Importante e as de segurança da conta. |
| RN-DASH-01 | Usuário ativo é quem abriu o app ou o portal nos últimos 30 dias. Membro conta no total quando o status é `ativo`. |

### Perfis e permissões

| Código | Regra |
| --- | --- |
| RN-PER-01 | Um usuário pode ter mais de um perfil; a permissão efetiva é a soma dos perfis. |
| RN-PER-02 | Cada perfil só atribui perfis de nível inferior ao seu. O Administrador não cria nem edita Super Administradores. |
| RN-PER-03 | O sistema impede remover o último Super Administrador. |
| RN-PER-04 | Ações sensíveis (exclusão, mudança de perfil, exportação de dados pessoais) pedem confirmação por senha e entram na auditoria. |

### Decisões tomadas

- **Menores de 18 anos:** o TLC atende a partir de 13 anos; não é preciso cadastrar responsável legal (RN-MEM-09 e RN-MEM-10).
- **CPF completo:** só Super Administrador, Administrador e o próprio titular veem; os demais perfis veem o CPF mascarado (RN-MEM-11 e RN-MEM-12).

## 8. Controle de permissões

O acesso segue o modelo RBAC (controle por perfil): cada perfil recebe um conjunto de permissões no formato `recurso:ação` (por exemplo `avisos:publicar`), e a API é quem decide; esconder um botão na tela é só conforto visual.

### Perfis

| Perfil | Nível | Papel na organização | Onde acessa |
| --- | --- | --- | --- |
| Super Administrador | 5 | Responsável técnico e dono da conta; poucos nomes | Painel, portal, app |
| Administrador | 4 | Gestão geral do TLC: pessoas, conteúdo, configurações | Painel, portal, app |
| Coordenador | 3 | Conteúdo e atividades: avisos, eventos, galeria, documentos | Painel, portal, app |
| Secretaria | 3 | Rotina administrativa: cadastros, aprovações, check-in, contato | Painel, portal, app |
| Membro | 2 | Participante do TLC | Portal e app |
| Visitante | 1 | Pessoa sem login | Somente o site público |

### Matriz de permissões

Legenda: ✓ permitido · — negado · próprio = só sobre os próprios dados · condição entre parênteses.

| Recurso e ação | Super Admin | Admin | Coordenador | Secretaria | Membro | Visitante |
| --- | --- | --- | --- | --- | --- | --- |
| Criar e editar Administradores | ✓ | — | — | — | — | — |
| Atribuir perfis Coordenador e Secretaria | ✓ | ✓ | — | — | — | — |
| Aprovar cadastros e liberar acesso de membro | ✓ | ✓ | — | ✓ | — | — |
| Redefinir senha de outro usuário | ✓ | ✓ | — | ✓ | — | — |
| Ver lista de membros | ✓ | ✓ | ✓ (CPF mascarado) | ✓ (CPF mascarado) | — | — |
| Ver Observações (campo interno) | ✓ | ✓ | — | ✓ | — | — |
| Ver CPF completo | ✓ | ✓ | — | — | próprio | — |
| Cadastrar, editar e inativar membros | ✓ | ✓ | — | ✓ | — | — |
| Excluir (anonimizar) membro | ✓ | — | — | — | — | — |
| Editar o próprio perfil | ✓ | ✓ | ✓ | ✓ | próprio | — |
| Ler o mural de avisos | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Publicar e editar avisos | ✓ | ✓ | ✓ | ✓ | — | — |
| Excluir aviso definitivamente | ✓ | ✓ | — | — | — | — |
| Comentar e reagir | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Moderar comentários | ✓ | ✓ | ✓ | ✓ | — | — |
| Ver eventos | ✓ | ✓ | ✓ | ✓ | ✓ | públicos |
| Inscrever-se e cancelar inscrição | ✓ | ✓ | ✓ | ✓ | próprio | — |
| Criar e editar eventos | ✓ | ✓ | ✓ | ✓ | — | — |
| Ver lista de participantes | ✓ | ✓ | ✓ | ✓ | — | — |
| Fazer check-in | ✓ | ✓ | ✓ | ✓ | — | — |
| Exportar lista de presença | ✓ | ✓ | ✓ (sem CPF) | ✓ (sem CPF) | — | — |
| Ver galeria | ✓ | ✓ | ✓ | ✓ | ✓ | públicos |
| Enviar fotos e criar álbuns | ✓ | ✓ | ✓ | ✓ | — | — |
| Excluir fotos e álbuns | ✓ | ✓ | próprio | — | — | — |
| Ver e baixar documentos | ✓ | ✓ | conforme o documento | conforme o documento | conforme o documento | — |
| Enviar e gerenciar documentos | ✓ | ✓ | ✓ | ✓ | — | — |
| Enviar notificação avulsa a um grupo | ✓ | ✓ | ✓ | — | — | — |
| Ver o dashboard | ✓ | ✓ | ✓ | ✓ | — | — |
| Editar páginas do site | ✓ | ✓ | ✓ | — | — | — |
| Responder mensagens de contato | ✓ | ✓ | — | ✓ | — | — |
| Gerir igrejas, categorias e turmas | ✓ | ✓ | — | — | — | — |
| Consultar a auditoria | ✓ | — | — | — | — | — |

### Como a regra é aplicada

- **Na API:** cada rota declara a permissão exigida; um filtro único lê o token, soma as permissões dos perfis do usuário e responde 403 quando falta alguma.
- **No dado:** permissões "próprio" e "conforme o documento" são checadas no registro (o autor do álbum, o dono da inscrição, a lista em `documento_perfis`), não só na rota.
- **Na tela:** o painel e o app recebem a lista de permissões no login e escondem o que o usuário não pode usar.
- **Na auditoria:** negativas repetidas (403) e toda ação sensível ficam registradas em `auditoria`.

### CPF e menores de idade

- **CPF completo:** a permissão `membros:ver_cpf` fica só com Super Administrador e Administrador, e o titular vê o próprio CPF. Sem ela, a API devolve apenas `cpf_mascarado`, tanto nas telas quanto nas exportações; o CPF completo nunca chega ao aparelho de quem não pode vê-lo.
- **Secretaria:** digita o CPF no cadastro, mas depois só o vê mascarado; a busca por CPF funciona digitando o número inteiro, e a correção do CPF é feita por Administrador.
- **Auditoria:** cada abertura do CPF completo de outra pessoa por Administrador ou Super Administrador é registrada.
- **Menores de 18 anos:** seguem as mesmas regras de CPF e de acesso dos demais membros (RN-MEM-09).

## 9. Fluxos de usuário

Os dois fluxos mais críticos são o acesso (quem entra e como) e o evento (da inscrição à presença); os demais são curtos e estão na tabela.

### Fluxo 1 · Cadastro e primeiro acesso

&#91;embedded content: fluxo de cadastro e acesso · 1 decisão\]

O cadastro pelo site não libera nada sozinho. Já o membro cadastrado pela Secretaria pula as três primeiras etapas e recebe o convite direto.

### Fluxo 2 · Inscrição em evento e check-in

&#91;embedded content: fluxo de inscrição e check-in · 2 decisões\]

O QR Code fica salvo no aparelho, então o check-in funciona mesmo sem internet no local; o registro sobe quando a conexão volta.

### Outros fluxos

| Fluxo | Quem | Passos | Resultado |
| --- | --- | --- | --- |
| Login | Membro e equipe | 1. Digita o CPF e a senha. 2. A API valida e devolve o token. 3. O app guarda a sessão e oferece biometria. | Abre na última aba usada |
| Recuperação de senha | Qualquer usuário | 1. Toca em Esqueci minha senha e informa o CPF. 2. Recebe o link no e-mail cadastrado (válido por 60 minutos); a resposta é a mesma exista ou não a conta. 3. Define a nova senha. | Sessões antigas encerradas; login com a nova senha |
| Publicar aviso | Coordenador ou Secretaria | 1. Novo aviso no painel ou no app. 2. Preenche título, categoria e conteúdo; escolhe imagem, agendação e push. 3. Vê a prévia e publica. | Aviso no mural; push enviado se marcado |
| Comentar e reagir | Membro | 1. Abre o aviso. 2. Toca numa reação ou escreve o comentário. | Autor do aviso recebe uma notificação agrupada |
| Criar evento | Coordenador ou Secretaria | 1. Novo evento. 2. Informa nome, data, local, imagem, capacidade e se é público. 3. Salva como rascunho ou abre as inscrições. | Evento no app; no site se for público |
| Enviar fotos | Coordenador ou Secretaria | 1. Cria o álbum (avulso ou de um evento). 2. Seleciona até 50 fotos e envia. 3. Confirma a autorização de imagem se o álbum for público. | Miniaturas geradas; álbum visível conforme a visibilidade |
| Publicar documento | Coordenador ou Secretaria | 1. Novo documento e envio do PDF. 2. Escolhe categoria e quais perfis veem. 3. Publica. | Notificação aos perfis alcançados |
| Editar o próprio perfil | Membro | 1. Perfil e Dados pessoais. 2. Altera telefone, endereço ou foto. | Alteração salva; mudança de nome, CPF ou igreja vai para a Secretaria |
| Falar com o TLC | Visitante | 1. Abre Contato no site. 2. Preenche o formulário com captcha. | Mensagem na caixa da Secretaria, com aviso no painel |

## 10. Plano de implementação em fases

O plano entrega valor cedo: em cerca de 13 semanas a coordenação já usa mural, eventos e notificações em um piloto, e a versão completa fecha em cerca de 25 semanas. Os prazos assumem uma equipe de 3 a 4 pessoas (backend, web, mobile e design) e devem ser confirmados com a equipe real.

&#91;embedded content: roadmap · 5 fases e 4 pontos de decisão\]

### O que entra em cada fase

| Módulo | Fase 1 · MVP | Fase 2 | Fase 3 | Fase 4 |
| --- | --- | --- | --- | --- |
| Autenticação e perfis | Login por CPF, recuperação de senha, 6 perfis, cadastro com aprovação | Biometria no app | Consulta de auditoria | Login social e SSO, se houver necessidade |
| Membros | Cadastro, perfil, busca e filtros, igrejas | Histórico completo na linha do tempo | Turmas, exportação, importação de planilha | Anonimização em lote e pedidos do titular (LGPD) |
| Mural | Avisos com 4 categorias, imagem e fixados | Comentários, reações e moderação | Agendamento, expiração e alcance (lidos) | Enquetes |
| Eventos | Cadastro, inscrição, capacidade e status | Check-in por QR e manual, lista de espera, histórico | Relatório de presença em CSV e PDF | Certificado de participação, inscrição paga |
| Galeria | - | Álbuns, upload em lote, álbum por evento | Autorização de imagem e álbuns públicos | Marca d'água e download em lote |
| Documentos | - | Biblioteca com permissão por perfil e registro de downloads | Versionamento e relatório de acesso | Assinatura de ciência em comunicados |
| Notificações | Push, caixa no app e comunicado importante | Agrupamento e links profundos completos | Preferências por categoria e resumo da manhã | WhatsApp e e-mail em massa |
| Dashboard | Os 4 indicadores: membros, eventos, usuários ativos, últimos avisos | Presença por evento | Gráficos de evolução e relatórios exportáveis | Indicadores por igreja e por turma |
| Site | Home, Quem Somos, História do TLC, Contato e Login | Eventos públicos e Galeria | Edição das páginas pelo painel, SEO e métricas | Blog e doações, se fizer sentido |
| Plataforma | Deploy automático, backups, monitoramento | Testes de carga em dia de evento | Modo escuro, acessibilidade revisada | Vários polos (multi-organização) |

### Entregas e critérios de cada fase

| Fase | Entregas principais | Critério para seguir |
| --- | --- | --- |
| 0 · Descoberta (3 semanas) | Termo de privacidade e política de dados revisados, identidade visual, protótipo navegável, ambientes e repositório prontos, contas nas lojas Google Play e Apple | Coordenação aprova o protótipo |
| 1 · MVP (10 semanas) | API, painel, site e app Android e iOS com os itens da tabela; carga inicial dos membros por planilha; piloto fechado via TestFlight e teste interno do Google Play | Coordenação usa o piloto e aprova; sem falha grave aberta |
| 2 · Engajamento (6 semanas) | Check-in por QR, galeria, documentos, comentários e reações, site com eventos e galeria; publicação nas lojas | Um evento real feito de ponta a ponta no app |
| 3 · Gestão e escala (6 semanas) | Turmas, relatórios, preferências de notificação, agendamento, auditoria, modo escuro, ajustes de desempenho | Lançamento a todos os membros, com treinamento da Secretaria |
| 4 · Crescimento (contínuo) | Itens da última coluna, escolhidos por uso real e pedido da coordenação | Priorizado a cada trimestre |

### Riscos e cuidados

| Risco | Como reduzir |
| --- | --- |
| Aprovação nas lojas leva mais tempo que o previsto, em especial a da Apple | Abrir as contas na Fase 0 e enviar o primeiro build ainda no MVP |
| Dados dos membros chegam sujos ou incompletos | Importação com relatório de erros e período de revisão pela Secretaria antes do piloto |
| Baixa adoção pelos membros mais velhos | Convite por WhatsApp e e-mail, treinamento curto e o portal web como alternativa ao app |
| Fotos de pessoas, sobretudo de menores, expostas sem autorização | Álbum público exige confirmação de autorização; padrão é só para membros |
| Escopo cresce durante o MVP | Tudo o que não está na coluna da Fase 1 vai para a lista da próxima fase |

## 11. Stack tecnológica sugerida

A recomendação é TypeScript de ponta a ponta, em um monólito modular: um só deploy, módulos separados por domínio e tipos compartilhados entre API, web e app, o que reduz custo e erro para uma equipe pequena.

| Camada | Escolha | Por quê | Alternativa |
| --- | --- | --- | --- |
| App mobile | React Native com Expo | Um código para Android e iOS, build e atualizações pelo EAS, push integrado, tipos compartilhados com a web | Flutter |
| Web (site, portal e painel) | Next.js, React, Tailwind CSS e shadcn/ui | Site com SSR e boa indexação no Google; portal e painel no mesmo projeto; componentes acessíveis | Nuxt (Vue) |
| Backend | NestJS (Node.js) com OpenAPI | Módulos espelham o domínio; validação e documentação da API automáticas | Laravel (PHP), se a equipe já o domina |
| Banco de dados | PostgreSQL | Relacional, aceita JSON quando preciso, busca por nome com pg\_trgm | MySQL |
| ORM e migrações | Prisma ou Drizzle | Tipagem até o banco e migrações versionadas | TypeORM |
| Cache e filas | Redis com BullMQ | Filas de notificação, e-mail e imagens; limite de requisições | pg-boss (fila no próprio PostgreSQL, uma peça a menos) |
| Arquivos | Storage compatível com S3 (AWS S3 ou Cloudflare R2), CDN e a biblioteca sharp | Sem servidor de arquivos; miniaturas e WebP gerados no upload | Backblaze B2 |
| Autenticação | JWT de acesso curto, refresh com rotação, senhas com argon2id | Atende login por CPF sem depender de terceiros | Keycloak ou Auth0, se surgir login único (SSO) |
| Push | Firebase Cloud Messaging (Android direto, iOS via APNs) | Padrão de mercado e sem custo no volume esperado | Expo Push Service |
| E-mail | Amazon SES ou Resend | Boa entrega e custo baixo | SendGrid |
| WhatsApp (fase futura) | WhatsApp Business Platform, por provedor oficial | Convites e lembretes; cobrado por conversa | Link `wa.me` manual |
| Hospedagem | Contêineres Docker em PaaS (Railway, Render, Fly.io) ou VPS com Coolify, região de São Paulo | Operação simples e baixa latência no Brasil | AWS ECS |
| CI/CD | GitHub Actions e EAS Build | Testes, build e publicação automáticos | GitLab CI |
| Observabilidade | Sentry (erros), Better Stack ou Grafana (logs e disponibilidade) | Saber da falha antes do usuário reclamar | UptimeRobot |
| Testes | Vitest (API), Playwright (web), Maestro (mobile) | Cobre os fluxos críticos: login, aviso, evento, check-in | Jest, Detox |

### Organização do repositório

```text
tlc/
├─ apps/
│  ├─ web/        Next.js: site (/), portal (/portal) e painel (/admin)
│  ├─ mobile/     Expo (React Native)
│  └─ api/        NestJS: módulos auth, membros, avisos, eventos,
│                 galeria, documentos, notificacoes, dashboard, site
├─ packages/
│  ├─ contracts/  esquemas Zod e tipos gerados do OpenAPI
│  ├─ ui/         tokens de design e componentes compartilhados
│  └─ config/     ESLint, TypeScript, Tailwind
└─ infra/         Docker, scripts de deploy e backups
```

### Segurança e operação

- **Transporte e cabeçalhos:** HTTPS obrigatório, CORS restrito aos domínios do TLC e cabeçalhos de segurança (helmet).
- **Entradas:** validação de todo corpo e parâmetro com Zod; limite de requisições no login e na recuperação de senha.
- **Dados pessoais (LGPD):** CPF cifrado com chave guardada em gerenciador de segredos; exportação e exclusão de dados atendem pedido do titular.
- **Backups:** cópia diária do banco com retenção de 30 dias e teste de restauração a cada trimestre.
- **Ambientes:** local, homologação e produção, com dados fictícios fora de produção.

## 12. Estrutura da API REST

A API é única para site, portal, painel e app: JSON sobre HTTPS, versionada em `/v1`, documentada em OpenAPI e protegida por token Bearer.

### Padrões

| Tema | Padrão |
| --- | --- |
| Base | `https://<domínio-da-api>/v1` |
| Autenticação | Cabeçalho `Authorization: Bearer <token>`; rotas `/public/*` não exigem login |
| Formato | JSON em `snake_case`; datas ISO 8601 com fuso (2026-11-20T19:30:00-04:00) |
| Listas | `?page=1&per_page=20` (painel) ou `?cursor=...` (feeds do app); filtros `q`, `status`, `sort=-criado_em` |
| Resposta de lista | `{ "data": [...], "meta": { "page": 1, "per_page": 20, "total": 134 } }` |
| Erros | Formato RFC 9457 com `status`, `code`, `detail` e, em validação, `errors[]` por campo |
| Repetição segura | `Idempotency-Key` aceito em inscrição e check-in, para o app reenviar sem duplicar |
| Limites | Cabeçalhos `X-RateLimit-*`; limite rígido em login e recuperação de senha |
| Upload | O cliente pede uma URL pré-assinada, envia o arquivo direto ao storage e confirma à API |

### Autenticação e conta

| Método | Rota | Descrição | Permissão |
| --- | --- | --- | --- |
| POST | `/auth/login` | Entra com `cpf` e `senha` | Público |
| POST | `/auth/refresh` | Troca o refresh token por um novo par | Sessão |
| POST | `/auth/logout` | Revoga a sessão atual | Autenticado |
| POST | `/auth/cadastro` | Cria usuário `pendente` | Público |
| POST | `/auth/senha/esqueci` | Envia o link de recuperação | Público |
| POST | `/auth/senha/redefinir` | Define nova senha com o token do link | Público |
| POST | `/auth/convite/aceitar` | Cria a senha a partir do convite | Público |
| GET | `/me` | Dados do usuário, membro vinculado e perfis | Autenticado |
| PATCH | `/me` | Edita telefone, WhatsApp, e-mail, endereço | Autenticado |
| PUT | `/me/senha` | Troca a senha (pede a atual) | Autenticado |
| GET | `/me/permissoes` | Lista de `recurso:ação` do usuário | Autenticado |

### Usuários, membros, igrejas e turmas

| Método | Rota | Descrição | Permissão |
| --- | --- | --- | --- |
| GET | `/usuarios` | Lista usuários com filtros | `usuarios:ler` |
| PUT | `/usuarios/{id}/perfis` | Define os perfis do usuário | `usuarios:atribuir_perfil` |
| PATCH | `/usuarios/{id}/status` | Aprova, bloqueia ou inativa | `usuarios:aprovar` |
| POST | `/usuarios/{id}/convite` | Reenvia o convite de acesso | `usuarios:aprovar` |
| GET | `/membros` | Busca por `q`, `igreja_id`, `status`, `turma_id` | `membros:ler` |
| POST | `/membros` | Cadastra membro | `membros:criar` |
| GET | `/membros/{id}` | Perfil individual (CPF completo só com a permissão membros:ver\_cpf) | `membros:ler` |
| PATCH | `/membros/{id}` | Edita dados e observações | `membros:editar` |
| GET | `/membros/{id}/historico` | Linha do tempo do membro | `membros:ler` |
| DELETE | `/membros/{id}` | Anonimiza o membro | `membros:excluir` |
| GET, POST | `/igrejas`, `/turmas` | Lista e cria; `PATCH` e `DELETE` em `/{id}` | `cadastros:gerir` |

### Mural de avisos

| Método | Rota | Descrição | Permissão |
| --- | --- | --- | --- |
| GET | `/avisos` | Feed por `categoria_id`, com `cursor` | `avisos:ler` |
| POST | `/avisos` | Cria aviso (rascunho, agendado ou publicado) | `avisos:publicar` |
| GET | `/avisos/{id}` | Detalhe com contagem de reações e comentários | `avisos:ler` |
| PATCH | `/avisos/{id}` | Edita; `DELETE` arquiva | `avisos:publicar` |
| POST | `/avisos/{id}/leitura` | Marca como lido | `avisos:ler` |
| GET, POST | `/avisos/{id}/comentarios` | Lista e comenta | `avisos:comentar` |
| PATCH, DELETE | `/comentarios/{id}` | Edita o próprio, apaga ou oculta | próprio ou `comentarios:moderar` |
| PUT, DELETE | `/avisos/{id}/reacao` | Define ou remove a reação do usuário | `avisos:comentar` |
| GET | `/categorias-aviso` | Categorias disponíveis | `avisos:ler` |

### Eventos

| Método | Rota | Descrição | Permissão |
| --- | --- | --- | --- |
| GET | `/eventos` | Lista por `status` e período | `eventos:ler` |
| POST | `/eventos` | Cria evento | `eventos:criar` |
| PATCH | `/eventos/{id}` | Edita dados e status | `eventos:editar` |
| POST | `/eventos/{id}/cancelar` | Cancela e notifica inscritos | `eventos:editar` |
| POST | `/eventos/{id}/inscricoes` | Inscreve o usuário (vaga ou lista de espera) | `eventos:inscrever` |
| DELETE | `/eventos/{id}/inscricoes/me` | Cancela a própria inscrição | `eventos:inscrever` |
| GET | `/eventos/{id}/participantes` | Inscritos, lista de espera e presentes | `eventos:participantes` |
| POST | `/eventos/{id}/checkins` | Check-in por `qr_token` ou `membro_id` | `eventos:checkin` |
| GET | `/eventos/{id}/presenca/exportar` | CSV ou PDF da presença | `eventos:exportar` |
| GET | `/me/inscricoes` | Eventos em que o usuário está inscrito | Autenticado |
| GET | `/me/eventos/{id}/qr` | QR Code do usuário no evento | Autenticado |

### Galeria, documentos e arquivos

| Método | Rota | Descrição | Permissão |
| --- | --- | --- | --- |
| GET | `/albuns` | Lista álbuns visíveis ao usuário | `galeria:ler` |
| POST | `/albuns` | Cria álbum (avulso ou de evento) | `galeria:enviar` |
| GET | `/albuns/{id}/fotos` | Fotos do álbum, paginadas | `galeria:ler` |
| POST | `/albuns/{id}/fotos` | Registra fotos já enviadas ao storage | `galeria:enviar` |
| DELETE | `/fotos/{id}`, `/albuns/{id}` | Remove foto ou álbum | `galeria:excluir` |
| GET | `/documentos` | Lista por categoria, já filtrada pelo perfil | `documentos:ler` |
| POST | `/documentos` | Cadastra documento com perfis permitidos | `documentos:gerir` |
| GET | `/documentos/{id}/download` | URL assinada de curta duração; registra o download | `documentos:ler` |
| PUT | `/documentos/{id}/arquivo` | Envia nova versão | `documentos:gerir` |
| POST | `/arquivos/upload-url` | Pede URL pré-assinada de envio | Autenticado |
| POST | `/arquivos/{id}/confirmar` | Confirma o envio e valida tipo e tamanho | Autenticado |

### Notificações, dashboard, site e sistema

| Método | Rota | Descrição | Permissão |
| --- | --- | --- | --- |
| GET | `/me/notificacoes` | Caixa de entrada, com `cursor` | Autenticado |
| PATCH | `/me/notificacoes/{id}/lida` | Marca uma como lida | Autenticado |
| POST | `/me/notificacoes/marcar-todas-lidas` | Marca todas como lidas | Autenticado |
| POST, DELETE | `/me/dispositivos` | Registra ou remove o token de push | Autenticado |
| GET, PUT | `/me/preferencias-notificacao` | Lê e grava preferências | Autenticado |
| POST | `/notificacoes` | Envia notificação avulsa a um segmento | `notificacoes:enviar` |
| GET | `/dashboard/resumo` | Totais de membros, eventos, usuários ativos e últimos avisos | `dashboard:ler` |
| GET | `/public/paginas/{slug}` | Conteúdo de Quem Somos e História | Público |
| GET | `/public/eventos`, `/public/albuns` | Eventos e álbuns marcados como públicos | Público |
| POST | `/public/contato` | Recebe o formulário de contato | Público, com captcha |
| GET, PATCH | `/mensagens-contato` | Caixa de mensagens do painel | `contato:responder` |
| PUT | `/paginas-site/{slug}` | Edita página do site | `site:editar` |
| GET | `/auditoria` | Consulta a trilha de auditoria | `auditoria:ler` |
| GET | `/health` | Verificação de saúde do serviço | Público |

### Exemplos

Login com CPF (o mesmo campo aceita e-mail):

```json
POST /v1/auth/login
{ "cpf": "12345678909", "senha": "********", "dispositivo": { "plataforma": "android", "app_versao": "1.0.0" } }

200 OK
{ "access_token": "eyJ...", "refresh_token": "rt_...", "expira_em": 900,
  "usuario": { "id": "0192...", "nome": "Maria Souza", "perfis": ["membro"] } }
```

Criação de aviso com agendamento e push:

```json
POST /v1/avisos
{ "titulo": "Reunião de coordenação", "conteudo": "...", "categoria_id": "0192...",
  "publicar_em": "2026-11-16T08:00:00-04:00", "enviar_push": true }

201 Created
{ "id": "0192...", "status": "agendado", "autor": { "id": "0192...", "nome": "Ana Lima" } }
```

Erro de validação:

```json
422 Unprocessable Entity
{ "type": "https://<domínio-da-api>/erros/validacao", "title": "Dados inválidos", "status": 422,
  "code": "VALIDATION_ERROR",
  "errors": [ { "campo": "cpf", "mensagem": "CPF inválido" } ] }
```

## 13. Modelo de notificações

Toda notificação nasce de um evento do sistema (aviso publicado, evento cancelado, vaga liberada) e segue o mesmo caminho: é gravada na caixa do usuário, que é a fonte de verdade, e só depois enviada por push ou e-mail. Assim, quem não aceitou o push ou perdeu a mensagem ainda a encontra no app.

### Canais

| Canal | Quando usar | Observação |
| --- | --- | --- |
| Caixa no app | Sempre: toda notificação é gravada aqui | Tem contador de não lidas e histórico de 90 dias |
| Push (FCM e APNs) | Notificações com o app fechado | Depende da permissão do aparelho |
| E-mail | Segurança da conta, convites, recuperação de senha e resumo | Também serve de reserva quando não há push ativo |
| WhatsApp | Fase 4: convites e lembretes de evento | Só com consentimento do membro e modelos aprovados |

### Tipos de notificação

| Tipo | Gatilho | Quem recebe | Prioridade | Canais | Desligável |
| --- | --- | --- | --- | --- | --- |
| `aviso.importante` | Aviso da categoria Importante publicado | Todos os membros | Alta | Push, caixa | Não |
| `aviso.novo` | Aviso Geral, Eventos ou Coordenação publicado com push marcado | Público do aviso | Normal | Push, caixa | Sim |
| `aviso.resposta` | Comentário ou resposta no aviso ou no comentário do usuário | Autor do aviso e do comentário | Normal | Caixa, push agrupado | Sim |
| `evento.novo` | Evento passa a ter inscrições abertas | Todos os membros | Normal | Push, caixa | Sim |
| `evento.inscricao` | Inscrição confirmada ou entrada na lista de espera | O inscrito | Normal | Caixa | Não |
| `evento.vaga` | Vaga liberada na lista de espera | O primeiro da fila | Alta | Push, caixa | Não |
| `evento.lembrete` | 24 horas e 2 horas antes do início | Inscritos confirmados | Normal | Push, caixa | Sim |
| `evento.cancelado` | Evento cancelado | Inscritos e lista de espera | Alta | Push, caixa, e-mail | Não |
| `evento.alterado` | Data ou local alterados | Inscritos | Alta | Push, caixa | Não |
| `documento.novo` | Documento publicado ou nova versão | Perfis com acesso | Normal | Caixa, push | Sim |
| `galeria.novo` | Álbum novo publicado | Membros | Baixa | Caixa | Sim |
| `conta.convite` | Membro cadastrado pela Secretaria | O convidado | Alta | E-mail (e WhatsApp na Fase 4) | Não |
| `conta.aprovada` | Cadastro aprovado ou recusado | O solicitante | Normal | E-mail, caixa | Não |
| `conta.seguranca` | Troca de senha, login em aparelho novo | O próprio usuário | Alta | E-mail, push | Não |
| `admin.pendencia` | Cadastro novo aguardando ou mensagem de contato | Secretaria e Administradores | Normal | Painel (sino) | Sim |
| `comunicado.manual` | Envio avulso pelo painel a um grupo | Segmento escolhido | Escolhida pelo autor | Push, caixa | Conforme a prioridade |

### Caminho de uma notificação

1. **Evento de domínio:** o módulo (avisos, eventos...) publica o fato, por exemplo `evento.cancelado`, sem saber quem será notificado.
2. **Resolução de destinatários:** o serviço de notificações aplica o segmento (todos, perfil, igreja, turma ou inscritos de um evento) e remove quem está inativo.
3. **Preferências e limites:** aplica as preferências do usuário, o limite de 3 push por dia e o silêncio das 22h às 7h; prioridade alta ignora os dois últimos.
4. **Gravação:** cria `notificacoes` e uma linha em `notificacao_destinatarios` por pessoa; a caixa do app já mostra o item.
5. **Fila:** um trabalho por canal vai para a fila (BullMQ), com agendamento quando `enviar_em` é futuro.
6. **Envio:** o worker chama FCM, APNs ou o provedor de e-mail, com até 3 novas tentativas e espera crescente.
7. **Retorno:** tokens inválidos desativam o aparelho em `dispositivos`; o resultado fica em `push_status` (enviado, entregue, falhou).
8. **Leitura:** abrir a notificação grava `lida_em` e leva à tela de destino pelo link profundo.

### Formato da mensagem

```json
{
  "id": "0192f3...",
  "tipo": "evento.cancelado",
  "prioridade": "alta",
  "titulo": "Evento cancelado",
  "corpo": "O Culto de formatura de 20 nov foi cancelado.",
  "link": "tlc://eventos/0192a1...",
  "origem": { "tipo": "evento", "id": "0192a1..." },
  "criada_em": "2026-11-16T09:00:00-04:00"
}
```

O `link` é aberto pelo app e pelo portal; o push leva só o necessário (título, corpo e link) e o conteúdo completo é buscado na API depois do login.

### Modelos de texto

| Tipo | Título | Corpo |
| --- | --- | --- |
| `aviso.importante` | Aviso importante | {titulo\_do\_aviso} |
| `evento.lembrete` (24 h) | Amanhã tem {evento} | Começa às {hora} em {local}. Seu QR Code já está no app. |
| `evento.vaga` | Uma vaga abriu! | Você está inscrito em {evento}. Confirme sua presença no app. |
| `documento.novo` | Novo documento | {documento} já está na biblioteca. |
| `conta.seguranca` | Sua senha foi alterada | Se não foi você, fale com a Secretaria agora. |

### Regras de entrega

- **Segmentação do comunicado manual:** por perfil, igreja, turma, evento (inscritos ou presentes) ou todos; a tela mostra quantas pessoas serão alcançadas antes do envio.
- **Confirmação do envio em massa:** comunicados para mais de 50 pessoas pedem uma confirmação extra e entram na auditoria.
- **Sem duplicidade:** cada par (tipo, origem, usuário) é enviado uma vez, mesmo se o evento de domínio for repetido.
- **Mensagem importante nunca some:** categoria Importante e avisos de segurança ignoram preferências e o horário de silêncio.
- **Medição:** o painel mostra enviados, entregues e lidos de cada comunicado, para saber se o aviso chegou.

## 14. Recomendações de UX/UI

O público do TLC vai de jovens a pessoas mais velhas, quase sempre no celular, então o desenho prioriza letra legível, poucos toques e linguagem acolhedora.

### Identidade visual

As cores abaixo são uma proposta inicial e devem ser trocadas pelas do logotipo do TLC, se houver.

| Papel | Sugestão | Uso |
| --- | --- | --- |
| Primária | Azul-petróleo `#1F4E79` | Barra superior, botões principais, links |
| Destaque | Dourado `#B8860B` | Selos, itens fixados, marcação do evento do dia |
| Fundo e superfícies | Branco `#FFFFFF` e cinza-claro `#F5F7FA` | Telas e cartões |
| Texto | Grafite `#1F2933` e cinza `#52606D` | Títulos e texto de apoio |
| Categoria Geral | Cinza-azulado `#52606D` | Etiqueta do aviso |
| Categoria Eventos | Verde `#1B7F4B` | Etiqueta do aviso e status "inscrições abertas" |
| Categoria Coordenação | Roxo `#6B3FA0` | Etiqueta do aviso |
| Categoria Importante | Vermelho `#B42318` | Etiqueta do aviso, alertas e erros |

- **Tipografia:** uma família sem serifa (Inter ou Nunito Sans), corpo de 16 px no mínimo, títulos em peso 600.
- **Forma:** cantos de 12 px nos cartões, sombras leves, ícones de traço único (Lucide).
- **Modo escuro:** tokens de cor desde o início, para ligar o modo escuro sem refazer telas.

### No aplicativo

- **Navegação:** barra inferior com 5 itens, sempre visível, e o sino de notificações no topo da tela Início.
- **Toque:** alvos de pelo menos 48 px e ações principais ao alcance do polegar.
- **Login:** um campo único "CPF" com máscara 000.000.000-00, "mostrar senha" e entrada por biometria depois do primeiro acesso.
- **QR Code do evento:** abre em um toque a partir do cartão do evento, aumenta o brilho da tela e funciona sem internet.
- **Velocidade:** esqueletos de carregamento no lugar de ícones girando, cache local do mural, puxar para atualizar.
- **Notificações:** ao tocar, abre direto o aviso, o evento ou o documento (link profundo), nunca só a tela inicial.
- **Pedido de permissão:** o app explica o motivo do push antes de pedir a permissão do sistema, no momento em que faz sentido (ao se inscrever em um evento, por exemplo).

### Formulários e linguagem

- **Máscaras e atalhos:** CPF, telefone e CEP com máscara; endereço preenchido pelo CEP; teclado numérico nos campos numéricos.
- **Validação:** mensagem logo abaixo do campo, dizendo o que corrigir ("Falta um dígito no CPF"), nunca códigos de erro.
- **Tom:** português do Brasil, acolhedor e direto: "Inscrição confirmada. Te esperamos no dia 20!" em vez de "Operação realizada com sucesso".
- **Estados:** toda lista tem estado vazio com próxima ação, estado de erro com "Tentar de novo" e aviso claro quando estiver sem internet.

### No painel administrativo

- **Rotina da Secretaria primeiro:** publicar aviso, criar evento e cadastrar membro cabem em um formulário curto, com campos opcionais recolhidos em "Mais opções".
- **Tabelas:** busca, filtros salvos, colunas escolhidas pelo usuário e ações em lote (inativar, exportar).
- **Ações destrutivas:** pedem confirmação em texto claro e oferecem "Desfazer" por alguns segundos quando possível.
- **Check-in:** tela cheia com leitor de QR; resposta imediata em verde com vibração e nome do membro, ou em vermelho com o motivo ("Já registrado às 19:42").
- **Prévia:** todo aviso mostra como ficará no app antes de publicar.

### Acessibilidade e desempenho

- **Padrão:** WCAG 2.2 nível AA: contraste mínimo de 4,5:1 no texto, foco visível no teclado, rótulos para leitores de tela e tamanho de fonte que respeita o ajuste do sistema.
- **Cor nunca sozinha:** categorias e status também têm texto ou ícone, para quem não distingue cores.
- **Imagens:** WebP, carregamento sob demanda e miniaturas na galeria; texto alternativo opcional nas fotos de aviso.
- **Metas:** página inicial do site com carregamento principal em até 2,5 s no celular e abertura do app em até 2 s com cache.

### Como saber se está funcionando

| Indicador | Meta inicial |
| --- | --- |
| Tempo para a Secretaria publicar um aviso | Menos de 2 minutos |
| Cadastros iniciados que chegam ao fim | Acima de 80% |
| Check-ins feitos por QR Code, sem busca manual | Acima de 70% |
| Avisos importantes abertos em 24 horas | Acima de 60% |
| Membros que ativam o push | Acima de 50% |

As metas são pontos de partida para revisar após 3 meses de uso real.
