FROM python:3.11-slim

WORKDIR /app

# Dépendances système (libopenblas0 requis par numpy/sklearn)
RUN apt-get update && apt-get install -y \
    gcc libpq-dev libsndfile1 libopenblas0 libgfortran5 \
    && ln -sf /usr/lib/x86_64-linux-gnu/libopenblas.so.0 /usr/local/lib/libcblas.so.3 \
    && ldconfig \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]