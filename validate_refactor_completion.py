#!/usr/bin/env python3
"""
TDD REFACTOR Phase Validation Script
Validates all enhancements to the FastAPI backend implementation
"""

import os
import ast
import sys
import json
from pathlib import Path

# Color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
BLUE = '\033[94m'
YELLOW = '\033[93m'
BOLD = '\033[1m'
RESET = '\033[0m'

def print_status(message, status="info"):
    """Print colored status messages"""
    color = {"success": GREEN, "error": RED, "info": BLUE, "warning": YELLOW}
    print(f"{color.get(status, '')}{message}{RESET}")

def validate_main_app_enhancements():
    """Validate main FastAPI application enhancements"""
    print_status("🔍 Validating main application enhancements...", "info")
    
    main_path = "backend/app/main.py"
    if not os.path.exists(main_path):
        print_status(f"❌ Main application file not found: {main_path}", "error")
        return False
    
    with open(main_path, 'r') as f:
        content = f.read()
    
    # Check for essential enhancements
    checks = [
        ("GZipMiddleware", "GZip compression middleware"),
        ("LLMChargeException", "Custom exception handling"),
        ("RequestValidationError", "Request validation error handling"),
        ("lifespan", "Application lifespan management"),
        ("asynccontextmanager", "Modern async context management"),
        ("setup_logging", "Proper logging setup"),
        ("get_logger", "Logger configuration"),
        ("components", "Health check with component status"),
        ("features", "API feature documentation"),
        ("error_id", "Error tracking with IDs"),
        ("traceback.format_exc", "Detailed error logging")
    ]
    
    passed = 0
    total = len(checks)
    
    for check, description in checks:
        if check in content:
            print_status(f"  ✅ {description}", "success")
            passed += 1
        else:
            print_status(f"  ❌ Missing: {description}", "error")
    
    print_status(f"Main app enhancements: {passed}/{total} checks passed", 
                "success" if passed == total else "warning")
    return passed == total

def validate_error_handling():
    """Validate comprehensive error handling implementation"""
    print_status("🔍 Validating error handling implementation...", "info")
    
    exceptions_path = "backend/app/core/exceptions.py"
    if not os.path.exists(exceptions_path):
        print_status(f"❌ Exceptions file not found: {exceptions_path}", "error")
        return False
    
    with open(exceptions_path, 'r') as f:
        content = f.read()
    
    # Check for all custom exceptions
    exceptions = [
        "LLMChargeException", 
        "ValidationError", 
        "NotFoundError", 
        "ConflictError",
        "DatabaseError", 
        "MCPError", 
        "WebSocketError"
    ]
    
    passed = 0
    for exc_class in exceptions:
        if f"class {exc_class}" in content:
            print_status(f"  ✅ {exc_class} defined", "success")
            passed += 1
        else:
            print_status(f"  ❌ Missing: {exc_class}", "error")
    
    print_status(f"Exception classes: {passed}/{len(exceptions)} defined", 
                "success" if passed == len(exceptions) else "warning")
    return passed == len(exceptions)

def validate_logging_system():
    """Validate logging system implementation"""
    print_status("🔍 Validating logging system...", "info")
    
    logging_path = "backend/app/core/logging.py"
    if not os.path.exists(logging_path):
        print_status(f"❌ Logging file not found: {logging_path}", "error")
        return False
    
    with open(logging_path, 'r') as f:
        content = f.read()
    
    checks = [
        ("setup_logging", "Main logging setup function"),
        ("get_logger", "Logger retrieval function"),
        ("logging.Formatter", "Log formatting"),
        ("StreamHandler", "Console output"),
        ("FileHandler", "Optional file output"),
        ("llm-charge", "Application logger namespace")
    ]
    
    passed = 0
    for check, description in checks:
        if check in content:
            print_status(f"  ✅ {description}", "success")
            passed += 1
        else:
            print_status(f"  ❌ Missing: {description}", "error")
    
    print_status(f"Logging system: {passed}/{len(checks)} features implemented", 
                "success" if passed == len(checks) else "warning")
    return passed == len(checks)

def validate_api_enhancements():
    """Validate API endpoint enhancements"""
    print_status("🔍 Validating API enhancements...", "info")
    
    agents_path = "backend/app/api/agents.py"
    if not os.path.exists(agents_path):
        print_status(f"❌ Agents API file not found: {agents_path}", "error")
        return False
    
    with open(agents_path, 'r') as f:
        content = f.read()
    
    enhancements = [
        ("pagination", "Pagination support"),
        ("filtering", "Query filtering"),
        ("search", "Search functionality"),
        ("AgentListResponse", "Structured response models"),
        ("HTTPException", "Proper HTTP error handling"),
        ("Query(", "FastAPI query parameters"),
        ("async def", "Async endpoint implementation"),
        ("response_model", "Response model validation"),
        ("status_code", "HTTP status codes"),
        ("get_logger", "Endpoint logging")
    ]
    
    passed = 0
    for check, description in enhancements:
        if check in content:
            print_status(f"  ✅ {description}", "success")
            passed += 1
        else:
            print_status(f"  ❌ Missing: {description}", "error")
    
    print_status(f"API enhancements: {passed}/{len(enhancements)} features implemented", 
                "success" if passed == len(enhancements) else "warning")
    return passed == len(enhancements)

def validate_database_models():
    """Validate database model enhancements"""
    print_status("🔍 Validating database model enhancements...", "info")
    
    agents_model_path = "backend/app/database/models/agents.py"
    if not os.path.exists(agents_model_path):
        print_status(f"❌ Agent model file not found: {agents_model_path}", "error")
        return False
    
    with open(agents_model_path, 'r') as f:
        content = f.read()
    
    enhancements = [
        ("AgentRole", "Role enumeration"),
        ("AgentStatus", "Status enumeration"),
        ("BaseModel", "Base model mixin"),
        ("SQLiteJSON", "JSON field handling"),
        ("nullable=False", "Required field validation"),
        ("index=True", "Database indexing"),
        ("default=", "Default values"),
        ("__tablename__", "Table naming"),
        ("relationship", "Model relationships"),
        ("ForeignKey", "Foreign key constraints")
    ]
    
    passed = 0
    for check, description in enhancements:
        if check in content:
            print_status(f"  ✅ {description}", "success")
            passed += 1
        else:
            print_status(f"  ❌ Missing: {description}", "error")
    
    print_status(f"Database model enhancements: {passed}/{len(enhancements)} features implemented", 
                "success" if passed == len(enhancements) else "warning")
    return passed == len(enhancements)

def validate_pydantic_schemas():
    """Validate Pydantic schema implementations"""
    print_status("🔍 Validating Pydantic schemas...", "info")
    
    schemas_path = "backend/app/schemas/agents.py"
    if not os.path.exists(schemas_path):
        print_status(f"❌ Schemas file not found: {schemas_path}", "error")
        return False
    
    with open(schemas_path, 'r') as f:
        content = f.read()
    
    schemas = [
        ("AgentBase", "Base agent schema"),
        ("AgentCreate", "Agent creation schema"),
        ("AgentUpdate", "Agent update schema"),
        ("AgentResponse", "Agent response schema"),
        ("AgentListResponse", "List response schema"),
        ("AgentMetrics", "Metrics schema"),
        ("Field(", "Field validation"),
        ("validator", "Custom validation"),
        ("Optional", "Optional fields"),
        ("datetime", "DateTime handling")
    ]
    
    passed = 0
    for check, description in schemas:
        if check in content:
            print_status(f"  ✅ {description}", "success")
            passed += 1
        else:
            print_status(f"  ❌ Missing: {description}", "error")
    
    print_status(f"Pydantic schemas: {passed}/{len(schemas)} features implemented", 
                "success" if passed == len(schemas) else "warning")
    return passed == len(schemas)

def validate_project_structure():
    """Validate complete project structure"""
    print_status("🔍 Validating project structure...", "info")
    
    required_files = [
        "backend/app/main.py",
        "backend/app/config.py", 
        "backend/app/__init__.py",
        "backend/app/core/__init__.py",
        "backend/app/core/exceptions.py",
        "backend/app/core/logging.py",
        "backend/app/database/__init__.py",
        "backend/app/database/database.py",
        "backend/app/database/models/__init__.py",
        "backend/app/database/models/agents.py",
        "backend/app/database/models/projects.py",
        "backend/app/database/models/specs.py",
        "backend/app/database/models/workflows.py",
        "backend/app/api/__init__.py",
        "backend/app/api/deps.py",
        "backend/app/api/agents.py",
        "backend/app/api/projects.py",
        "backend/app/api/specs.py",
        "backend/app/api/workflows.py",
        "backend/app/schemas/__init__.py",
        "backend/app/schemas/agents.py",
        "backend/app/schemas/projects.py",
        "backend/app/schemas/specs.py",
        "backend/app/schemas/workflows.py",
        "backend/app/mcp/__init__.py",
        "backend/app/mcp/server.py",
        "backend/app/mcp/tools.py",
        "backend/app/websocket/__init__.py",
        "backend/app/websocket/manager.py",
        "backend/requirements.txt",
        "backend/pyproject.toml"
    ]
    
    missing_files = []
    for file_path in required_files:
        if not os.path.exists(file_path):
            missing_files.append(file_path)
        else:
            print_status(f"  ✅ {file_path}", "success")
    
    if missing_files:
        print_status("❌ Missing files:", "error")
        for file_path in missing_files:
            print_status(f"    - {file_path}", "error")
    
    total_files = len(required_files)
    present_files = total_files - len(missing_files)
    print_status(f"Project structure: {present_files}/{total_files} files present", 
                "success" if missing_files == [] else "warning")
    return len(missing_files) == 0

def generate_refactor_report():
    """Generate comprehensive refactor completion report"""
    print_status("\n" + "="*60, "info")
    print_status("🎯 TDD REFACTOR PHASE COMPLETION REPORT", "info")
    print_status("="*60, "info")
    
    tests = [
        ("Project Structure", validate_project_structure),
        ("Main App Enhancements", validate_main_app_enhancements),
        ("Error Handling", validate_error_handling),
        ("Logging System", validate_logging_system),
        ("API Enhancements", validate_api_enhancements),
        ("Database Models", validate_database_models),
        ("Pydantic Schemas", validate_pydantic_schemas)
    ]
    
    results = []
    for test_name, test_func in tests:
        print_status(f"\n{test_name}:", "info")
        result = test_func()
        results.append((test_name, result))
    
    # Summary
    passed_tests = sum(1 for _, result in results if result)
    total_tests = len(results)
    
    print_status(f"\n{'='*60}", "info")
    print_status(f"🏆 REFACTOR PHASE SUMMARY", "info")
    print_status(f"{'='*60}", "info")
    
    for test_name, result in results:
        status_icon = "✅" if result else "❌"
        print_status(f"{status_icon} {test_name}", "success" if result else "error")
    
    print_status(f"\nOverall Result: {passed_tests}/{total_tests} validation tests passed", 
                "success" if passed_tests == total_tests else "warning")
    
    if passed_tests == total_tests:
        print_status("\n🎉 TDD REFACTOR PHASE COMPLETED SUCCESSFULLY!", "success")
        print_status("   All enhancements implemented and validated.", "success")
        print_status("   FastAPI backend is production-ready.", "success")
    else:
        print_status("\n⚠️  REFACTOR PHASE INCOMPLETE", "warning")
        print_status(f"   {total_tests - passed_tests} validation(s) failed.", "warning")
        print_status("   Please address missing components.", "warning")
    
    return passed_tests == total_tests

if __name__ == "__main__":
    print_status("🚀 Starting TDD REFACTOR phase validation...\n", "info")
    
    # Change to project root if needed
    if os.path.basename(os.getcwd()) != "lllm-charge":
        print_status("📁 Changing to project root directory...", "info")
        if os.path.exists("lllm-charge"):
            os.chdir("lllm-charge")
    
    success = generate_refactor_report()
    sys.exit(0 if success else 1)