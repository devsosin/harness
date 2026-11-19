# Moving mode 3 to a server

Keep it short in the repo: `compose.prod.yaml` + `deploy/nginx/<domain>.conf` + `deploy/README.md` (the commands below, filled in). Server provisioning, CI deploys and backups are separate work.

## `compose.prod.yaml`

Used alone on the server (`docker compose -f compose.prod.yaml up -d`), not as an override of the dev file — no dev mounts or seed can leak in.

```yaml
name: <repo-name>
services:
  db:
    image: postgres:16
    restart: unless-stopped
    environment: { POSTGRES_USER: app, POSTGRES_PASSWORD: "${PG_PASSWORD:?}", POSTGRES_DB: app }
    volumes: [pg-data:/var/lib/postgresql/data]   # production data: back up, never `down -v`
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U app -d app"], interval: 5s, retries: 30 }
  migrate:
    image: <registry>/<repo>-api:${TAG:?}   # migrations only, no seed
    command: ["<migrate command>"]
    depends_on: { db: { condition: service_healthy } }
  api:
    image: <registry>/<repo>-api:${TAG:?}
    restart: unless-stopped
    env_file: .env                            # on the server only
    depends_on: { migrate: { condition: service_completed_successfully } }
  nginx:
    image: nginx:1.27
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./deploy/nginx:/etc/nginx/conf.d:ro
      - ./web-dist:/usr/share/nginx/html:ro     # `pnpm build` output
      - certbot-www:/var/www/certbot:ro
      - letsencrypt:/etc/letsencrypt:ro
    depends_on: [api]
  certbot:
    image: certbot/certbot
    volumes: [certbot-www:/var/www/certbot, letsencrypt:/etc/letsencrypt]
    entrypoint: ["sh", "-c", "trap exit TERM; while :; do certbot renew --webroot -w /var/www/certbot; sleep 12h; done"]
volumes: { pg-data: {}, certbot-www: {}, letsencrypt: {} }
```

No DB port is published. The frontend is static files, so the `web` dev server does not exist here.

## `deploy/nginx/<domain>.conf`

```nginx
server {
  listen 80;
  server_name <domain>;
  location /.well-known/acme-challenge/ { root /var/www/certbot; }
  location / { return 301 https://$host$request_uri; }
}
server {
  listen 443 ssl;
  http2 on;
  server_name <domain>;
  ssl_certificate     /etc/letsencrypt/live/<domain>/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/<domain>/privkey.pem;

  location /api/ { proxy_pass http://api:8080; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; }
  location / { root /usr/share/nginx/html; try_files $uri /index.html; }   # SPA fallback
}
```

`/api` on the same origin as the frontend, exactly like the mode 2 and 3 proxy — cookies and CSRF behave the same locally and in production.

## First certificate (once per domain)

The 443 block cannot load before the certificate exists. Start with only the port-80 block, then:

```bash
docker compose -f compose.prod.yaml up -d nginx
docker compose -f compose.prod.yaml run --rm --entrypoint certbot certbot \
  certonly --webroot -w /var/www/certbot -d <domain> --email <ops-email> --agree-tos --no-eff-email
# add the 443 block, then
docker compose -f compose.prod.yaml exec nginx nginx -s reload
```

Renewal runs in the `certbot` service; reload nginx after a renewal (cron `nginx -s reload` daily is enough).

## Checks before the first deploy

- `.env` on the server has every key in `.env.example` with production values; nothing else holds secrets.
- DB backup and restore tried once.
- `docker compose -f compose.prod.yaml config` shows no dev mounts, no `seed`, no published DB port.
