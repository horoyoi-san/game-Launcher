@echo off
setlocal
rem Puts Thai text into the 4.7 beta client (English where the beta has no Thai yet). See README.md next to this file.
rem   Thai-Beta.bat           build the Thai text and switch the beta to it (run again after a beta update/hotfix)
rem   Thai-Beta.bat restore   back to the client's previous text language
rem   Thai-Beta.bat build --beta "D:\Games\<new beta folder>"   for a beta in another folder (optional --live)
rem Default path: DEFAULT_BETA in thai_text.py. Thai TextMaps are downloaded automatically; Live is optional.
rem Close the game first.

tasklist /FI "IMAGENAME eq StarRail.exe" | find /I "StarRail.exe" >nul
if not errorlevel 1 (
    echo Close the game first.
    pause
    exit /b 1
)

if "%~1"=="" (
    python "%~dp0thai_text.py" build
) else (
    python "%~dp0thai_text.py" %*
)
if errorlevel 1 (
    echo Failed.
    pause
    exit /b 1
)
pause
