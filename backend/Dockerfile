FROM python:3.11-slim

WORKDIR /app

# Dépendances système nécessaires pour psycopg2 et librosa
RUN apt-get update && apt-get install -y \
    gcc libpq-dev libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000