FROM node:18-alpine

ENV NODE_ENV=production
ARG NPM_BUILD="npm install --omit=dev"
EXPOSE 3000/tcp

LABEL maintainer="Schoology Contributors"
LABEL summary="Schoology - Private Web Browser"
LABEL description="A secure private web browser with privacy-first design"

WORKDIR /app

COPY ["package.json", "pnpm-lock.yaml", "./"]
RUN apk add --upgrade --no-cache python3 make g++
RUN npm install -g pnpm && pnpm install --frozen-lockfile --prod

COPY . .

ENTRYPOINT [ "node" ]
CMD ["src/index.js"]
