# Nuottitreeni without Cloudflare: builds the site and serves it with scripts/serve.mjs.
# Sync codes are off in this setup (they need Cloudflare D1); everything else works.
#   docker build -t nuottitreeni --build-arg NT_DEFAULT_LOCALE=fi --build-arg NT_LOCALES=fi,en .
#   docker run --rm -p 127.0.0.1:8080:8080 nuottitreeni     ->  http://localhost:8080/
# Behind an HTTPS reverse proxy, forward X-Forwarded-Proto: https. See docs/self-hosting.md.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
ARG NT_SITE_URL=""
ARG NT_INDEXABLE="0"
ARG NT_LOCALES="en,fi"
ARG NT_DEFAULT_LOCALE=""
ARG NT_OPERATOR_NAME=""
ARG NT_OPERATOR_CONTACT=""
RUN node scripts/build.mjs

FROM node:24-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/scripts/serve.mjs ./scripts/serve.mjs
COPY --from=build /app/worker/headers.js ./worker/headers.js
COPY --from=build /app/package.json ./package.json
USER node
EXPOSE 8080
CMD ["node", "scripts/serve.mjs", "--host", "0.0.0.0", "--port", "8080"]
