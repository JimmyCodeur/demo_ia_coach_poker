FROM node:18-alpine

WORKDIR /app

# Copier package.json et package-lock.json
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier le code source
COPY . .

# Exposer le port
EXPOSE 3000

# Variables d'environnement pour le hot reload
ENV CHOKIDAR_USEPOLLING=true
ENV GENERATE_SOURCEMAP=false

# Commande pour le développement
CMD ["npm", "start"]