FROM node:24-alpine AS build
WORKDIR /app
COPY . .
ARG API_INTERNAL_URL=http://backend:4000
ENV API_INTERNAL_URL=$API_INTERNAL_URL
RUN npm ci
RUN npm run build --workspace shared-types
RUN npm run build --workspace frontend

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build /app/apps/frontend/.next/standalone ./
COPY --from=build /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=build /app/apps/frontend/public ./apps/frontend/public
USER node
EXPOSE 3000
CMD ["node", "apps/frontend/server.js"]
