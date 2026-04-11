#!/bin/bash
set -e

# ─── SchoolApp Production Deploy Script ───────────────────────────────────────
# Usage:
#   First time:  ./deploy.sh setup
#   Deploy:      ./deploy.sh deploy
#   SSL cert:    ./deploy.sh ssl
#   Seed DB:     ./deploy.sh seed
#   Logs:        ./deploy.sh logs

ENV_FILE=".env.prod"
COMPOSE="docker compose -f docker-compose.prod.yml --env-file $ENV_FILE"

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: $ENV_FILE not found. Copy .env.prod.example to .env.prod and fill in values."
    exit 1
fi

source "$ENV_FILE"

case "$1" in
  setup)
    echo "==> Installing Docker (if needed)..."
    if ! command -v docker &> /dev/null; then
        curl -fsSL https://get.docker.com | sh
    fi

    echo "==> Generating secrets..."
    if grep -q "<openssl" "$ENV_FILE"; then
        echo "Please fill in all values in $ENV_FILE first!"
        exit 1
    fi

    echo "==> Building and starting services..."
    $COMPOSE up -d --build

    echo "==> Waiting for database..."
    sleep 10

    echo "==> Running migrations..."
    $COMPOSE exec api npx prisma migrate deploy

    echo "==> Seeding database..."
    $COMPOSE exec api node src/seed.js

    echo ""
    echo "✓ Setup complete!"
    echo "  Next: run './deploy.sh ssl' to set up HTTPS"
    echo "  Your app is at: http://$DOMAIN (HTTP only until SSL)"
    ;;

  ssl)
    echo "==> Getting SSL certificate for $DOMAIN..."

    # Stop nginx temporarily
    $COMPOSE stop nginx

    # Get certificate
    docker run --rm \
        -v "$(pwd)/devops/certbot/conf:/etc/letsencrypt" \
        -v "$(pwd)/devops/certbot/www:/var/www/certbot" \
        -p 80:80 \
        certbot/certbot certonly \
        --standalone \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL_FROM" \
        -d "$DOMAIN"

    # Symlink cert to a fixed name nginx can find
    ln -sfn "$DOMAIN" "$(pwd)/devops/certbot/conf/live/cert"

    # Restart nginx with SSL
    $COMPOSE up -d nginx

    echo ""
    echo "✓ SSL certificate installed!"
    echo "  Your app is at: https://$DOMAIN"
    ;;

  deploy)
    echo "==> Pulling latest code..."
    git pull origin master

    echo "==> Building and restarting..."
    $COMPOSE up -d --build

    echo "==> Running migrations..."
    $COMPOSE exec api npx prisma migrate deploy

    echo ""
    echo "✓ Deployed!"
    ;;

  seed)
    echo "==> Seeding database..."
    $COMPOSE exec api node src/seed.js
    echo "✓ Done!"
    ;;

  logs)
    $COMPOSE logs -f --tail=100
    ;;

  down)
    $COMPOSE down
    ;;

  *)
    echo "Usage: ./deploy.sh {setup|ssl|deploy|seed|logs|down}"
    exit 1
    ;;
esac
