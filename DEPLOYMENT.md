# Deployment Guide (Ubuntu 24.04)

This system is configured to run using **Docker Compose** on Ubuntu 24.04. It includes Node.js (Next.js), PostgreSQL, and MinIO.

## Prerequisites

1. **Git**: Installed by default on Ubuntu 24.04.
2. **Docker & Docker Compose**: 
   Install using the official Docker script:
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   ```

## Initial Setup

1. **Clone the repository**:
   ```bash
   git clone <repository_url>
   cd datacenter
   ```

2. **Prepare Environment**:
   Ensure `.env.production` contains the correct values. The default configuration is set to work out-of-the-box with Docker Compose.

3. **Deploy using Docker Compose**:
   ```bash
   # Build and start services in detached mode
   sudo docker compose up --build -d
   ```

## Post-Deployment Commands

### 1. Database Setup
If you have migrations:
```bash
sudo docker exec -it nextjs-app npx prisma migrate deploy
```
If you are starting from scratch without migration files:
```bash
sudo docker exec -it nextjs-app npx prisma db push
```

### 2. Database Seeding (Optional)
If you need to seed initial data:
```bash
sudo docker exec -it nextjs-app npm run db:seed
```

### 3. Check Logs
```bash
sudo docker compose logs -f app
```

## Service Access

- **Next.js App**: [http://localhost:3000](http://localhost:3000)
- **MinIO Console**: [http://localhost:9001](http://localhost:9001) (User/Pass: `minioadmin` / `minioadmin`)

## Environment Maintenance

The `.env.production` file is used by the application within the container. To update environment variables:
1. Edit `.env.production`.
2. Restart the app container: `sudo docker compose up -d`.

## Volumes & Persistence

- Database data is persisted in a Docker volume `pg-data`.
- MinIO data is persisted in a Docker volume `minio-data`.
Check these with `sudo docker volume ls`.

## Updating the App

To deploy a new version from Git:
```bash
git pull origin main
sudo docker compose up --build -d
```
