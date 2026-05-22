FROM composer:2 as build
WORKDIR /app
COPY appAcademico/ .
RUN composer install --no-dev --optimize-autoloader

FROM php:8.2-cli
WORKDIR /app
COPY --from=build /app /app
RUN chown -R www-data:www-data /app
RUN apt-get update && apt-get install -y libpq-dev
RUN docker-php-ext-install pdo pdo_pgsql pgsql
EXPOSE 8000
CMD ["sh", "-c", "php artisan serve --host=0.0.0.0 --port=${PORT:-8000}"]
