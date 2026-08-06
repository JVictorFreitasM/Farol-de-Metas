FROM node:20-alpine

WORKDIR /app

# OS-009-C: idp-client é consumido via dependência "file:./idp-client" — precisa existir e
# já vir compilado (dist/) ANTES do npm install do pacote raiz, senão o link local falha.
COPY idp-client ./idp-client
RUN npm --prefix idp-client install && npm --prefix idp-client run build

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

EXPOSE 3000

CMD ["npm", "run", "dev"]
