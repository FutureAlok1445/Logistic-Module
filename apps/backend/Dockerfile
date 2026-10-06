FROM node:24-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci
RUN npx prisma generate --schema apps/backend/prisma/schema.prisma
RUN npm run build --workspace shared-types
RUN npm run build --workspace backend
RUN npm prune --omit=dev --ignore-scripts

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared-types ./packages/shared-types
COPY --from=build /app/apps/backend ./apps/backend
WORKDIR /app/apps/backend
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:4000/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
