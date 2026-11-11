@echo off
rem Cluster Layouts demo: runs the app's own code on this PC and opens it in your browser.
rem Put this file in the repository folder (next to apps, kit, tools). Needs Node.js.
cd /d "%~dp0"
where node 1>NUL 2>NUL
if errorlevel 1 (echo Node.js is not installed or not on PATH. & pause & exit /b 1)
if not exist "apps\cluster_layouts\app.json" (echo Put cluster_demo.bat in the idrive7-cluster-info folder. & pause & exit /b 1)
echo Starting the demo. Close this window to stop it.
node tools\cluster_demo.js %*
pause
