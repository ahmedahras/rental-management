# Operations Hardening Checklist

## 1. Credentials Rotation

- Admin password has been rotated from default.
- JWT secret has been rotated in `backend/.env`.

## 2. HTTPS (Reverse Proxy)

Use Nginx/Caddy in front of backend (`:4000`) and web (`:3000`).

Nginx sketch:

```nginx
server {
  listen 443 ssl;
  server_name your-domain.com;

  ssl_certificate /etc/letsencrypt/live/your-domain/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/your-domain/privkey.pem;

  location /api/ {
    proxy_pass http://127.0.0.1:4000/;
  }

  location / {
    proxy_pass http://127.0.0.1:3000/;
  }
}
```

## 3. Daily Database Backup

Manual run:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\rental management\ops\backup-db.ps1"
```

Schedule (Task Scheduler):

```powershell
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-ExecutionPolicy Bypass -File "C:\rental management\ops\backup-db.ps1"'
$trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
Register-ScheduledTask -TaskName 'ShopMgmtDailyBackup' -Action $action -Trigger $trigger -Description 'Daily PostgreSQL backup for Shop Management'
```

## 4. Additional Safety

- Limit API exposure to trusted network/VPN.
- Keep PostgreSQL port private.
- Rotate admin password periodically.
- Keep backup retention policy (e.g., 30 days).
