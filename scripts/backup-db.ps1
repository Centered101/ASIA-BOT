<#
    backup-db.ps1 — สำรองฐานข้อมูล Supabase ลงเครื่อง (รันมือบน Windows)

    ต้องมี pg_dump (PostgreSQL 17 client) ก่อน:
        winget install PostgreSQL.PostgreSQL
      หรือโหลดจาก https://www.postgresql.org/download/windows/

    วิธีใช้ (เลือกอย่างใดอย่างหนึ่งในการบอก connection string):
        1) ใส่ในไฟล์ .env.local บรรทัด:  SUPABASE_DB_URL=postgresql://...
        2) หรือส่งตอนรัน:  ./scripts/backup-db.ps1 -DbUrl "postgresql://..."

    เอา connection string จาก Supabase Dashboard → ปุ่ม Connect → เลือก "Session pooler"
#>

param(
    [string]$DbUrl = $env:SUPABASE_DB_URL
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot   # โฟลเดอร์โปรเจกต์

# --- 1) หา connection string ---
if ([string]::IsNullOrWhiteSpace($DbUrl)) {
    $envFile = Join-Path $root ".env.local"
    if (Test-Path $envFile) {
        $line = Select-String -Path $envFile -Pattern '^\s*SUPABASE_DB_URL\s*=' | Select-Object -First 1
        if ($line) {
            $DbUrl = ($line.Line -replace '^\s*SUPABASE_DB_URL\s*=', '').Trim().Trim('"').Trim("'")
        }
    }
}
if ([string]::IsNullOrWhiteSpace($DbUrl)) {
    Write-Host "ไม่พบ connection string" -ForegroundColor Red
    Write-Host "ตั้งค่า SUPABASE_DB_URL ใน .env.local หรือส่งผ่าน -DbUrl"
    exit 1
}

# --- 2) เช็ค pg_dump ---
$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) {
    Write-Host "ไม่พบ pg_dump" -ForegroundColor Red
    Write-Host "ติดตั้งด้วย:  winget install PostgreSQL.PostgreSQL"
    Write-Host "แล้วเพิ่มโฟลเดอร์ ...\PostgreSQL\17\bin ลงใน PATH"
    exit 1
}

# --- 3) เตรียมโฟลเดอร์ + ชื่อไฟล์ ---
$backupDir = Join-Path $root "backups"
if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir | Out-Null }
$stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$outFile = Join-Path $backupDir "backup_$stamp.sql"

# --- 4) dump ---
Write-Host "กำลังสำรองฐานข้อมูล..." -ForegroundColor Cyan
& pg_dump $DbUrl --no-owner --no-privileges --file $outFile
if ($LASTEXITCODE -ne 0) {
    Write-Host "pg_dump ล้มเหลว (exit $LASTEXITCODE)" -ForegroundColor Red
    exit $LASTEXITCODE
}

# --- 5) บีบอัดเป็น .zip ประหยัดพื้นที่ ---
$zipFile = "$outFile.zip"
Compress-Archive -Path $outFile -DestinationPath $zipFile -Force
Remove-Item $outFile

$sizeKB = [math]::Round((Get-Item $zipFile).Length / 1KB, 1)
Write-Host "สำเร็จ → $zipFile ($sizeKB KB)" -ForegroundColor Green

# --- 6) เก็บแค่ 30 ไฟล์ล่าสุด ที่เหลือลบทิ้ง ---
Get-ChildItem $backupDir -Filter "backup_*.sql.zip" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip 30 |
    Remove-Item -Force
