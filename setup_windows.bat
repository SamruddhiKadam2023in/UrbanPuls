@echo off
echo ================================================
echo  TPMS - Traffic ^& Parking Management System
echo  Windows development setup
echo ================================================
echo.

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Download from https://python.org
    pause
    exit /b
)
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Download from https://nodejs.org
    pause
    exit /b
)

echo -- Backend --
cd backend
if not exist venv python -m venv venv
call venv\Scripts\activate.bat
pip install -r requirements-dev.txt --quiet
if not exist .env copy .env.example .env >nul
echo Applying database migrations...
alembic upgrade head
echo Loading demo data...
python seed.py
cd ..

echo.
echo -- Frontend --
cd frontend
call npm install --silent
cd ..

echo.
echo Setup complete. Double-click start.bat to run TPMS.
echo Demo logins (development only):
echo   admin@tpms.com / admin123    vendor@tpms.com / vendor123
echo   user@tpms.com  / user123     police@tpms.com / police123
pause
