FROM composer:2 as build
WORKDIR /app
COPY appAcademico/ .
RUN composer install --no-dev --optimize-autoloader

FROM php:8.2-apache
WORKDIR /var/www/html
COPY --from=build /app /var/www/html
RUN chown -R www-data:www-data /var/www/html
RUN a2enmod rewrite
EXPOSE 80
CMD ["apache2-foreground"]
