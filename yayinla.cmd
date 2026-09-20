@echo off
setlocal
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"

echo Node:
node -v
if errorlevel 1 (
  echo Node.js bulunamadi. https://nodejs.org adresinden LTS kur.
  pause
  exit /b 1
)

echo.
echo [1] Supabase girisi - tarayici acilacak, sen onayla.
call npx.cmd --yes supabase login
if errorlevel 1 goto :fail

echo.
echo [2] Projeyi bagla ve student-ai fonksiyonunu yayinla.
call npx.cmd --yes supabase link --project-ref naiakscryafhvcghjmzx
call npx.cmd --yes supabase functions deploy student-ai --no-verify-jwt
if errorlevel 1 goto :fail

echo.
echo [3] Vercel girisi - tarayici acilacak, sen onayla.
call npx.cmd --yes vercel login
if errorlevel 1 goto :fail

echo.
echo [4] Siteyi production olarak yayinla.
call npx.cmd --yes vercel --prod --yes
if errorlevel 1 goto :fail

echo.
echo Bitti.
pause
exit /b 0

:fail
echo.
echo Yayinlama yarida kaldi. Girisi tarayicide bitirip bu dosyayi tekrar calistir.
pause
exit /b 1
