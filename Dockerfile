# Image de base Python officielle
# slim  :only essential packages
FROM python:3.11-slim

# Définir le dossier de travail dans la boîte
WORKDIR /app

# Copier le requirements.txt en premier
# (if requirements don't change, this layer is cached)
COPY requirements.txt .

# Installer toutes les bibliothèques
RUN pip install --no-cache-dir -r requirements.txt

# Copier tout le reste du projet
COPY . .

# Le port que notre serveur utilise
EXPOSE 8000

# La commande pour lancer le serveur
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]