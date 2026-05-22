#!/bin/bash
set -e

echo "🚀 Inicializando Laravel..."

# Generar cache de config
php artisan config:cache

# Generar cache de rutas
php artisan route:cache

# Generar optimización de autoloader
php artisan optimize

echo "✅ Laravel configurado. Iniciando servidor..."

# Iniciar el servidor
php artisan serve --host=0.0.0.0 --port=${PORT:-8000}
