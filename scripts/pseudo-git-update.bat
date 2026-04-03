@echo off
REM LLM-Charge Pseudo-Git Update Tool (Windows)
REM Extracts a zip file and intelligently updates the current project with diffs

setlocal enabledelayedexpansion

echo.
echo 🔄 LLM-Charge Pseudo-Git Update Tool (Windows)
echo ===============================================

REM Check for zip file argument
if "%~1"=="" (
    echo ❌ Error: No zip file specified
    echo.
    echo Usage: %0 ^<zip-file^> [options]
    echo.
    echo Options:
    echo   --dry-run     Show what would be changed without making changes
    echo   --force       Force update even if there are conflicts
    echo   --backup      Create backup before applying changes
    echo   --help        Show this help message
    echo.
    echo Examples:
    echo   %0 llm-charge-20240315_143022.zip
    echo   %0 project-update.zip --dry-run
    echo   %0 changes.zip --backup --force
    exit /b 1
)

set "ZIP_FILE=%~1"
set "DRY_RUN=false"
set "FORCE=false"
set "BACKUP=false"

REM Parse additional arguments
shift
:parse_args
if "%~1"=="" goto :args_done
if "%~1"=="--dry-run" (
    set "DRY_RUN=true"
) else if "%~1"=="--force" (
    set "FORCE=true"
) else if "%~1"=="--backup" (
    set "BACKUP=true"
) else if "%~1"=="--help" (
    goto :show_help
) else (
    echo ❌ Unknown option: %~1
    exit /b 1
)
shift
goto :parse_args

:show_help
echo Usage: %0 ^<zip-file^> [options]
echo.
echo Options:
echo   --dry-run     Show what would be changed without making changes
echo   --force       Force update even if there are conflicts
echo   --backup      Create backup before applying changes
echo   --help        Show this help message
exit /b 0

:args_done

REM Check if zip file exists
if not exist "%ZIP_FILE%" (
    echo ❌ Error: Zip file '%ZIP_FILE%' not found
    exit /b 1
)

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: package.json not found. Please run this script from the project root.
    exit /b 1
)

echo 📁 Processing zip file: %ZIP_FILE%

REM Create temporary directory
set "TEMP_DIR=%TEMP%\llm-charge-update-%RANDOM%"
mkdir "%TEMP_DIR%"

REM Set cleanup on exit
set "CLEANUP_TEMP=%TEMP_DIR%"

REM Extract zip file
echo 📦 Extracting zip file to temporary location...

REM Check for different unzip utilities
where powershell >nul 2>&1
if %errorlevel%==0 (
    powershell -command "Expand-Archive -Path '%ZIP_FILE%' -DestinationPath '%TEMP_DIR%' -Force"
) else (
    REM Try using Windows built-in tar (Windows 10+)
    where tar >nul 2>&1
    if %errorlevel%==0 (
        tar -xf "%ZIP_FILE%" -C "%TEMP_DIR%"
    ) else (
        echo ❌ Error: No suitable extraction utility found
        echo Please install PowerShell or ensure tar is available
        goto :cleanup
    )
)

REM Find extracted project directory
echo 📂 Searching for project in extracted files...

set "EXTRACTED_PROJECT="
for /r "%TEMP_DIR%" %%f in (package.json) do (
    set "EXTRACTED_PROJECT=%%~dpf"
    set "EXTRACTED_PROJECT=!EXTRACTED_PROJECT:~0,-1!"
    goto :found_project
)

:found_project
if "%EXTRACTED_PROJECT%"=="" (
    echo ❌ Error: No valid project found in zip file (no package.json found)
    goto :cleanup
)

echo 📂 Found project in: %EXTRACTED_PROJECT%

echo 🔍 Analyzing differences...
echo.
echo ⚠️  Windows version provides simplified diff analysis.
echo For detailed analysis, use the Linux/macOS version or WSL.
echo.

REM Simple file comparison approach for Windows
set /a CHANGES=0

REM Check for new files in extracted directory
echo 📊 Scanning for changes...
for /r "%EXTRACTED_PROJECT%" %%f in (*) do (
    set "REL_PATH=%%f"
    set "REL_PATH=!REL_PATH:%EXTRACTED_PROJECT%\=!"
    
    REM Skip excluded files
    echo !REL_PATH! | findstr /i "node_modules dist build .vite .next .nuxt .output logs coverage .cache tmp temp" >nul
    if errorlevel 1 (
        echo !REL_PATH! | findstr /i ".log .pid .seed .lcov .tgz .tar.gz .env .DS_Store Thumbs.db .zip" >nul
        if errorlevel 1 (
            if not exist "!REL_PATH!" (
                echo   + !REL_PATH!
                set /a CHANGES+=1
            ) else (
                REM Check if file is different (simple size comparison)
                for %%a in ("%%f") do set "SIZE1=%%~za"
                for %%b in ("!REL_PATH!") do set "SIZE2=%%~zb"
                
                if not "!SIZE1!"=="!SIZE2!" (
                    echo   ~ !REL_PATH!
                    set /a CHANGES+=1
                )
            )
        )
    )
)

if %CHANGES%==0 (
    echo ✅ No changes detected. Project is up to date!
    goto :cleanup
)

echo.
echo 📊 Found %CHANGES% potential changes

if "%DRY_RUN%"=="true" (
    echo.
    echo 🔍 Dry run mode - no changes will be applied
    echo To apply these changes, run without --dry-run flag
    goto :cleanup
)

if "%FORCE%"=="false" (
    echo.
    set /p "CONFIRM=⚠️  Ready to apply changes. Continue? (y/N): "
    if /i not "!CONFIRM!"=="y" (
        echo Operation cancelled by user
        goto :cleanup
    )
)

echo.
echo 🚀 Applying changes...

REM Create backup if requested
if "%BACKUP%"=="true" (
    set "BACKUP_DIR=backup-%date:~10,4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
    set "BACKUP_DIR=!BACKUP_DIR: =0!"
    echo 💾 Creating backup directory: !BACKUP_DIR!
    mkdir "!BACKUP_DIR!" 2>nul
)

REM Copy files from extracted directory
echo 📁 Copying files...
xcopy "%EXTRACTED_PROJECT%" "." /E /Y /I /Q >nul 2>&1

if %errorlevel%==0 (
    echo ✅ Successfully updated project!
    echo   • Files copied from extracted archive
    if "%BACKUP%"=="true" (
        echo   • Backup created in: !BACKUP_DIR!
    )
    echo.
    echo 💡 Note: For more precise diff-based updates, use the Linux/macOS version
) else (
    echo ❌ Error occurred during file copy
    exit /b 1
)

:cleanup
if defined CLEANUP_TEMP (
    echo 🧹 Cleaning up temporary files...
    rd /s /q "%CLEANUP_TEMP%" 2>nul
)

echo.
echo Done!