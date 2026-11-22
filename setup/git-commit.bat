@echo off
cd /d "%~dp0.."
echo [1/3] Changed files
git add -A
git status --short
echo.
echo [2/3] Commit
git commit -F setup\commit-message.txt
echo.
echo [3/3] Recent commits
git log --oneline -5
echo.
pause
