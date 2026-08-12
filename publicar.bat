@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ============================================
echo   CuraLabs3D - NFC Hub Manager
echo   Publicar no GitHub
echo ============================================
echo.

REM Garante que o script roda a partir da pasta onde ele esta salvo,
REM nao importa de onde foi clicado/chamado.
cd /d "%~dp0"

REM --- Verifica se o Git esta instalado ---
git --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Git nao encontrado. Instale em https://git-scm.com/download/win
    echo e rode este arquivo de novo.
    echo.
    pause
    exit /b 1
)

REM --- Verifica se esta dentro de um repositorio git ---
if not exist ".git" (
    echo [ERRO] Pasta ".git" nao encontrada aqui.
    echo Este .bat precisa estar dentro da pasta "curalabs3d-nfc-hub"
    echo extraida do zip original.
    echo.
    pause
    exit /b 1
)

set REPO_URL=https://github.com/Curalabs3d/CuralabsTag.git

REM --- Configura o remoto "origin" (cria se nao existir, corrige se estiver diferente) ---
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo Adicionando remoto origin...
    git remote add origin %REPO_URL%
) else (
    echo Atualizando remoto origin para %REPO_URL%...
    git remote set-url origin %REPO_URL%
)

echo.
echo Renomeando branch atual para "main"...
git branch -M main

echo.
echo Enviando commits para o GitHub...
echo (quando pedir senha, cole o Personal Access Token, nao a senha da conta)
echo.
git push -u origin main

if errorlevel 1 (
    echo.
    echo ============================================
    echo   Algo deu errado no push. Veja a mensagem
    echo   de erro acima e me envie para eu ajudar.
    echo ============================================
) else (
    echo.
    echo ============================================
    echo   Publicado com sucesso!
    echo   https://github.com/Curalabs3d/CuralabsTag
    echo ============================================
)

echo.
pause
