@echo off
REM LLM-Charge Release Zip Creator for Windows
REM Creates a clean project zip with datetime in the filename

setlocal EnableDelayedExpansion

echo.
echo ==========================================
echo 🚀 LLM-Charge Release Zip Creator
echo ==========================================

REM Generate timestamp (YYYYMMDD_HHMMSS format)
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YY=%dt:~2,2%" & set "YYYY=%dt:~0,4%" & set "MM=%dt:~4,2%" & set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%" & set "Min=%dt:~10,2%" & set "Sec=%dt:~12,2%"
set "TIMESTAMP=%YYYY%%MM%%DD%_%HH%%Min%%Sec%"

set "PROJECT_NAME=llm-charge"
set "ZIP_NAME=%PROJECT_NAME%-%TIMESTAMP%.zip"

echo 📦 Creating zip file: %ZIP_NAME%

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: package.json not found. Please run this script from the project root.
    pause
    exit /b 1
)

REM Remove any existing zip files
if exist "*.zip" (
    echo 🧹 Removing existing zip files...
    del /q "*.zip" >nul 2>&1
)

echo 📦 Creating clean project archive...

REM Use 7-Zip if available, otherwise use PowerShell
where 7z >nul 2>&1
if %errorlevel%==0 (
    echo Using 7-Zip...
    7z a -tzip "%ZIP_NAME%" . ^
        -x!node_modules ^
        -x!*/node_modules ^
        -x!dist ^
        -x!build ^
        -x!.vite ^
        -x!.next ^
        -x!.nuxt ^
        -x!.output ^
        -x!.svelte-kit ^
        -x!.env* ^
        -x!*.log ^
        -x!logs ^
        -x!coverage ^
        -x!.nyc_output ^
        -x!.eslintcache ^
        -x!.parcel-cache ^
        -x!.fusebox ^
        -x!.dynamodb ^
        -x!.vscode-test ^
        -x!.codegraph\cache ^
        -x!.codegraph\tmp ^
        -x!tmp ^
        -x!temp ^
        -x!*.tgz ^
        -x!*.tar.gz ^
        -x!*.pid ^
        -x!.cache ^
        -x!.git ^
        -x!test-* ^
        -x!*.zip >nul
) else (
    echo Using PowerShell Compress-Archive...
    powershell -Command "& { ^
        $excludePatterns = @('node_modules', 'dist', 'build', '.vite', '.next', '.env*', '*.log', 'logs', 'coverage', '.cache', '.git', 'test-*', '*.zip'); ^
        $files = Get-ChildItem -Recurse | Where-Object { ^
            $file = $_; ^
            -not ($excludePatterns | Where-Object { $file.FullName -like \"*$_*\" }) ^
        }; ^
        $files | Compress-Archive -DestinationPath '%ZIP_NAME%' -CompressionLevel Optimal ^
    }"
)

REM Check if zip was created successfully
if exist "%ZIP_NAME%" (
    for %%A in ("%ZIP_NAME%") do set "FILE_SIZE=%%~zA"
    
    REM Convert to MB if large enough
    set /a SIZE_MB=!FILE_SIZE!/1048576
    if !SIZE_MB! GTR 0 (
        set "SIZE_DISPLAY=!SIZE_MB!MB"
    ) else (
        set /a SIZE_KB=!FILE_SIZE!/1024
        if !SIZE_KB! GTR 0 (
            set "SIZE_DISPLAY=!SIZE_KB!KB"
        ) else (
            set "SIZE_DISPLAY=!FILE_SIZE!B"
        )
    )
    
    echo.
    echo ✅ Success! Created %ZIP_NAME% ^(!SIZE_DISPLAY!^)
    echo.
    echo 📋 Zip file contents:
    echo • Source code ^(src/^)
    echo • Configuration files
    echo • Documentation
    echo • Tests
    echo • Database files
    echo • Scripts
    echo • Docker files
    echo.
    echo 🎉 Ready for distribution!
) else (
    echo ❌ Error: Failed to create zip file
    pause
    exit /b 1
)

echo.
echo Press any key to exit...
pause >nul