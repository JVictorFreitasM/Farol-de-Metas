#!/bin/sh
# Roda a partir da RAIZ do projeto (onde está o package.json do backend e a pasta frontend/).
# Gera farol-deploy.tar contendo:
#  - as duas imagens Docker (backend e frontend) já buildadas
#  - docker-compose.prod.yml
#  - .env.prod.example
# Prontos para levar ao servidor 192.168.0.200 e subir com um único comando.

set -e

echo "==> Buildando imagem do backend..."
docker build -f deploy/Dockerfile.backend -t farol-backend:prod .

echo "==> Buildando imagem do frontend..."
docker build -f deploy/Dockerfile.frontend -t farol-frontend:prod .

echo "==> Salvando imagens em farol-images.tar..."
docker save -o deploy/farol-images.tar farol-backend:prod farol-frontend:prod

echo "==> Empacotando tudo em farol-deploy.tar..."
cd deploy
tar -cvf ../farol-deploy.tar farol-images.tar docker-compose.prod.yml .env.prod.example
cd ..
rm deploy/farol-images.tar

echo ""
echo "Pronto: farol-deploy.tar gerado na raiz do projeto."
echo "Copie esse arquivo para o servidor (192.168.0.200) e siga o DEPLOY.md."
