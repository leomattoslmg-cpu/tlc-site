# Publicar o piloto sem custo (site + API + banco)

Valores e limites dos planos gratuitos mudam; confira nas páginas dos serviços antes de começar.

| Parte | Onde | Observação |
|---|---|---|
| Site (`apps/web`) | Vercel (Hobby) | Plano para uso não comercial; confira os termos |
| API (`apps/api`) | Render (web service grátis) | Dorme após 15 min sem acesso e leva ~1 min para acordar |
| Banco | Neon (Free) | 1 GB; suspende após 5 min parado, os dados ficam. **Não use o Postgres grátis da Render: expira em 30 dias.** |

## 1. Banco (Neon)
1. Crie uma conta em neon.com e um projeto; escolha a região mais próxima do Brasil (São Paulo, se disponível).
2. Copie a **connection string** (`postgres://...neon.tech/...?sslmode=require`). É o `DATABASE_URL`.
3. Não crie tabelas: a API aplica as migrações sozinha ao iniciar (35 tabelas e os dados iniciais).

## 2. Captcha (Cloudflare Turnstile)
1. Em dash.cloudflare.com → Turnstile, crie um widget para o domínio do site.
2. Guarde a **chave do site** (pública, vai para o site) e a **chave secreta** (vai para a API).

## 3. API (Render)
1. Em render.com, **New → Blueprint** e escolha este repositório; ele lê o `render.yaml`.
2. Preencha as variáveis pedidas:
   - `DATABASE_URL`: a string do Neon.
   - `API_PUBLIC_URL`: o endereço que a Render der ao serviço (ex.: `https://tlc-api.onrender.com`); pode editar depois do primeiro deploy.
   - `CORS_ORIGINS`: o endereço do site (ex.: `https://tlc-site.vercel.app`; vários, separados por vírgula).
   - `TURNSTILE_SECRET`: a chave secreta do passo 2.
   A região é Virgínia (EUA), a mais próxima do Brasil; a Render não tem São Paulo. A região não pode ser trocada depois de criado o serviço: para mudar, é preciso criar outro.
3. Aguarde o deploy e abra `https://SEU-ENDERECO/v1/health`: deve responder `{"status":"ok"}`. Em `/v1/health/ready` ele confere o banco.

## 4. Site (Vercel)
1. Em vercel.com, **Add New → Project**, escolha o repositório e em **Root Directory** selecione `apps/web`.
2. Variáveis de ambiente:
   - `NEXT_PUBLIC_API_URL`: `https://SEU-ENDERECO-DA-API/v1`
   - `NEXT_PUBLIC_SITE_URL`: o endereço do próprio site
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: a chave pública do passo 2
   - `NEXT_PUBLIC_CONTATO_EMAIL` e `NEXT_PUBLIC_CONTATO_INSTAGRAM`: os contatos do TLC
3. Faça o deploy. Se mudar a URL da API depois, publique o site de novo.

## 5. Primeiro conteúdo
Enquanto o painel não existe (Sprint 5), os textos entram direto no banco. No **SQL Editor** do Neon, edite os textos e rode:

```sql
INSERT INTO paginas_site (organizacao_id, slug, titulo, conteudo, publicado)
SELECT id, 'quem-somos', 'Quem Somos', 'Primeiro parágrafo.

Segundo parágrafo.', true FROM organizacoes
ON CONFLICT (organizacao_id, slug) DO UPDATE
  SET titulo = EXCLUDED.titulo, conteudo = EXCLUDED.conteudo, publicado = true, atualizado_em = now();
```
Troque `'quem-somos'` e `'Quem Somos'` por `'historia'` e `'História do TLC'` para a outra página. Parágrafos são separados por uma linha em branco. O site atualiza em até 5 minutos.

## Limites a ter em mente
- A primeira visita depois de um período parado pode levar ~1 minuto (a API acorda). O site mostra o conteúdo guardado em cache; só o envio do formulário sente a demora.
- O limite de 5 mensagens por hora por IP e a Idempotency-Key ficam na memória da API e zeram quando ela dorme. Para o piloto basta.
- Para os membros usarem de verdade (login, app, notificações), a API precisa ficar sempre ligada: plano pago pequeno.
