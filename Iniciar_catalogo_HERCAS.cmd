@echo off
cd /d "D:\Aliados exteriores\catalogo_hercas_app"
echo Catalogo HERCAS: http://127.0.0.1:3000
echo Mantenga esta ventana abierta mientras usa el catalogo.
start "" "http://127.0.0.1:3000"
"C:\Users\Administrador\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd" start
pause
