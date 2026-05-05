FROM python:3.12-slim

# Variables de entorno
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Crear usuario seguro
RUN adduser --disabled-password --gecos '' appuser

WORKDIR /app

# Instalar dependencias del sistema (solo si las necesitas)
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements primero (mejora cache)
COPY requirements.txt .

# Instalar dependencias Python
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el resto del proyecto
COPY . .

# Cambiar a usuario no root
USER appuser

EXPOSE 8000

# Comando optimizado (Render/free usa 1 worker)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]