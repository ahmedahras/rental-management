param(
  [string]$PgBin = 'C:\Program Files\PostgreSQL\18\bin',
  [string]$Host = 'localhost',
  [int]$Port = 55432,
  [string]$User = 'admin',
  [string]$Database = 'shop_management',
  [string]$BackupDir = 'C:\rental management\ops\backups'
)

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null

$dumpFile = Join-Path $BackupDir "${Database}-${timestamp}.dump"
$pgDump = Join-Path $PgBin 'pg_dump.exe'

& $pgDump -h $Host -p $Port -U $User -F c -f $dumpFile $Database
if ($LASTEXITCODE -ne 0) {
  throw "Backup failed with exit code $LASTEXITCODE"
}

Write-Host "Backup created: $dumpFile"
