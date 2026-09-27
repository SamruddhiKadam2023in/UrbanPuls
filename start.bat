@echo off
echo Starting TPMS...

REM Start backend
start "TPMS Backend" cmd /k "cd backend && venv\Scripts\activate && uvicorn main:app --reload --port 8000"

REM Wait 3 seconds for backend to start
timeout /t 3 >nul

REM Start frontend
start "TPMS Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Both servers starting...
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo API Docs: http://localhost:8000/docs
echo.
timeout /t 4 >nul
start http://localhost:5173
