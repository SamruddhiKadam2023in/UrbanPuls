@echo off
echo ================================================
echo  TPMS - Traffic ^& Parking Management System
echo  Windows Setup Script
echo ================================================
echo.

REM ── Check Python ─────────────────────────────────
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Download from https://python.org
    pause
    exit /b
)
echo [OK] Python found

REM ── Check Node.js ────────────────────────────────
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Download from https://nodejs.org
    pause
    exit /b
)
echo [OK] Node.js found

REM ── Check Docker ─────────────────────────────────
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] Docker not found. Install from https://docker.com/desktop
    echo        You can still run without Docker using separate terminals.
) else (
    echo [OK] Docker found
)

echo.
echo ── Step 1: Starting PostgreSQL + Redis via Docker ──
docker-compose up -d db redis
timeout /t 5 >nul

echo.
echo ── Step 2: Setting up Python backend ──
cd backend
if not exist venv (
    python -m venv venv
    echo [OK] Virtual environment created
)
call venv\Scripts\activate.bat
pip install -r requirements.txt --quiet
echo [OK] Python dependencies installed

echo.
echo ── Step 3: Seeding database ──
python seed.py
cd ..

echo.
echo ── Step 4: Setting up React frontend ──
cd frontend
call npm install --silent
echo [OK] Node modules installed
cd ..

echo.
echo ================================================
echo  Setup complete!
echo ================================================
echo.
echo  To START the project, open 2 terminals:
echo.
echo  Terminal 1 (Backend):
echo    cd backend
echo    venv\Scripts\activate
echo    uvicorn main:app --reload --port 8000
echo.
echo  Terminal 2 (Frontend):
echo    cd frontend
echo    npm run dev
echo.
echo  Then open: http://localhost:5173
echo.
echo  Login credentials:
echo    Admin  → admin@tpms.com  / admin123
echo    Vendor → vendor@tpms.com / vendor123
echo    User   → user@tpms.com   / user123
echo.
pause
