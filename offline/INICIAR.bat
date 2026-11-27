@echo off
cd /d "%~dp0"
echo Iniciando Aqua City offline...
echo Mantenha esta janela aberta enquanto joga. Ctrl+C para encerrar.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor.ps1"
if errorlevel 1 (
 echo.
 echo Nao foi possivel iniciar. Verifique a mensagem acima.
 pause
)
