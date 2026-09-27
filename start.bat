@echo off
echo Starting TPMS...

start "TPMS Backend" cmd /k "cd backend && venv\Scripts\activate && alembic upgrade head && uvicorn main:app --reload --port 8000"
timeout /t 3 >nul
start "TPMS Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo API docs: http://localhost:8000/docs
echo Emails (verification, password reset) are printed in the backend window until SMTP is set up.
timeout /t 4 >nul
start http://localhost:5173
