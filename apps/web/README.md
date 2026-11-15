# TLC Ponta Porã - MS · Site público

Site institucional em Next.js 14 (App Router), TypeScript e Tailwind. Páginas: Início, Quem Somos, História, Eventos, Galeria, Contato e Privacidade. O botão **Entrar** leva ao portal do membro.

O conteúdo dinâmico vem da API da plataforma (rotas `/public/*` do OpenAPI do projeto):

| Página | Rota da API |
|---|---|
| Quem Somos, História | `GET /public/paginas/{slug}` (`quem-somos`, `historia`) |
| Início, Eventos | `GET /public/eventos` |
| Início, Galeria | `GET /public/albuns` |
| Contato | `POST /public/contato` (202, com captcha) |

Sem `NEXT_PUBLIC_API_URL`, ou se a API falhar, as páginas mostram um estado vazio amigável. Nenhum conteúdo é inventado.

## Rodar
```bash
cp .env.example .env.local   # dentro de apps/web
npm install
npm run dev      # http://localhost:3001
npm run typecheck && npm run lint && npm run build
```

## Pendências para publicar
- Trocar o selo "TLC" do cabeçalho pelo logotipo (`public/logo.svg`), se houver.
- Preencher e-mail e Instagram no `.env` (rodapé).
- Conferir o texto da página Privacidade.
- Definir o captcha (Cloudflare Turnstile) e a chave pública; a API valida o token.
- Publicar a API (apps/api) e apontar `NEXT_PUBLIC_API_URL` para ela; as rotas `/public/*` já existem lá.
- A API precisa de `TURNSTILE_SECRET` em produção, senão recusa as mensagens de contato.

## Design
Paleta aprovada (azul-petróleo `#1F4E79`, dourado `#B8860B`, cores por categoria) em variáveis CSS (`src/app/globals.css`), com modo escuro. O dourado é só detalhe, nunca cor de texto sobre fundo branco (contraste insuficiente). Corpo de 16 px, alvos de toque de 48 px, fonte Nunito Sans.
