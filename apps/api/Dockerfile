# Imagem da API. Construir a partir da RAIZ do repositório:
#   docker build -f apps/api/Dockerfile -t tlc-api .
FROM node:22-slim AS build
WORKDIR /app
COPY package.json ./
COPY apps/api/package.json apps/api/
RUN npm install --workspace @tlc/api
COPY apps/api apps/api
RUN npm run build -w @tlc/api && npm prune --omit=dev --workspace @tlc/api

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json package.json
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/db apps/api/db
WORKDIR /app/apps/api
USER node
EXPOSE 3000
# Aplica as migrações pendentes (com trava, então é seguro com mais de uma instância) e sobe a API.
CMD ["sh", "-c", "node db/migrate.mjs && node dist/main.js"]
