"""Dependency validation and error handling for Blender pipeline."""

from __future__ import annotations

import importlib
import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class DependencyStatus:
    """Status information for a dependency."""
    
    name: str
    available: bool
    version: Optional[str] = None
    error_message: Optional[str] = None
    install_instructions: Optional[str] = None


@dataclass
class DependencyReport:
    """Comprehensive dependency validation report."""
    
    blender_available: bool
    http_client_available: bool
    imaging_available: bool
    dependencies: dict[str, DependencyStatus] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    
    @property
    def is_functional(self) -> bool:
        """Check if the system has minimum dependencies for basic functionality."""
        return self.blender_available and self.http_client_available
    
    @property
    def is_fully_functional(self) -> bool:
        """Check if all optional dependencies are available."""
        return all(dep.available for dep in self.dependencies.values())


class DependencyValidator:
    """Validates and reports on system dependencies."""
    
    def __init__(self) -> None:
        self._dependency_map = {
            # Critical dependencies
            'bpy': DependencyStatus(
                name='bpy',
                available=False,
                install_instructions='Install Blender 3.0+ from https://blender.org'
            ),
            'bmesh': DependencyStatus(
                name='bmesh',
                available=False,
                install_instructions='Included with Blender installation'
            ),
            'mathutils': DependencyStatus(
                name='mathutils',
                available=False,
                install_instructions='Included with Blender installation'
            ),
            
            # HTTP clients (at least one required)
            'requests': DependencyStatus(
                name='requests',
                available=False,
                install_instructions='pip install requests>=2.31.0'
            ),
            'httpx': DependencyStatus(
                name='httpx',
                available=False,
                install_instructions='pip install httpx>=0.25.0'
            ),
            
            # Image processing
            'PIL': DependencyStatus(
                name='PIL/Pillow',
                available=False,
                install_instructions='pip install Pillow>=10.0.0'
            ),
            
            # Optional scientific computing
            'numpy': DependencyStatus(
                name='numpy',
                available=False,
                install_instructions='pip install numpy>=1.24.0'
            ),
            
            # Optional watch functionality
            'watchdog': DependencyStatus(
                name='watchdog',
                available=False,
                install_instructions='pip install watchdog>=3.0.0'
            ),
        }
    
    def validate_dependency(self, module_name: str) -> DependencyStatus:
        """Validate a single dependency."""
        status = self._dependency_map.get(
            module_name, 
            DependencyStatus(name=module_name, available=False)
        )
        
        try:
            # Handle special cases
            if module_name == 'PIL':
                module = importlib.import_module('PIL')
                from PIL import Image  # Test actual functionality
            else:
                module = importlib.import_module(module_name)
            
            status.available = True
            
            # Try to get version info
            if hasattr(module, '__version__'):
                status.version = module.__version__
            elif hasattr(module, 'version'):
                status.version = str(module.version)
            
            logger.debug(f"✅ {module_name} available (version: {status.version})")
            
        except ImportError as e:
            status.available = False
            status.error_message = str(e)
            logger.debug(f"❌ {module_name} not available: {e}")
        except Exception as e:
            status.available = False
            status.error_message = f"Validation failed: {e}"
            logger.warning(f"⚠️ {module_name} validation error: {e}")
        
        return status
    
    def validate_all_dependencies(self) -> DependencyReport:
        """Validate all dependencies and generate a comprehensive report."""
        report = DependencyReport(
            blender_available=False,
            http_client_available=False,
            imaging_available=False
        )
        
        # Validate all known dependencies
        for module_name in self._dependency_map:
            status = self.validate_dependency(module_name)
            report.dependencies[module_name] = status
        
        # Check critical functionality groups
        report.blender_available = (
            report.dependencies['bpy'].available and
            report.dependencies['bmesh'].available and
            report.dependencies['mathutils'].available
        )
        
        report.http_client_available = (
            report.dependencies['requests'].available or
            report.dependencies['httpx'].available
        )
        
        report.imaging_available = report.dependencies['PIL'].available
        
        # Generate warnings and errors
        self._generate_warnings_and_errors(report)
        
        return report
    
    def _generate_warnings_and_errors(self, report: DependencyReport) -> None:
        """Generate human-readable warnings and errors."""
        # Critical errors
        if not report.blender_available:
            report.errors.append(
                "Blender Python API (bpy) not available. "
                "Most 3D functionality will be disabled. "
                "Install Blender 3.0+ and run Python from within Blender."
            )
        
        if not report.http_client_available:
            report.errors.append(
                "No HTTP client available for LLM integration. "
                "Install either 'requests' or 'httpx': "
                "pip install requests httpx"
            )
        
        # Warnings for missing optional features
        if not report.imaging_available:
            report.warnings.append(
                "Pillow not available. Texture processing and thumbnails disabled. "
                "Install with: pip install Pillow>=10.0.0"
            )
        
        if not report.dependencies['numpy'].available:
            report.warnings.append(
                "NumPy not available. Advanced mathematical operations may be slower. "
                "Install with: pip install numpy>=1.24.0"
            )
        
        if not report.dependencies['watchdog'].available:
            report.warnings.append(
                "Watchdog not available. Folder watching functionality disabled. "
                "Install with: pip install watchdog>=3.0.0"
            )
    
    def get_installation_script(self, report: DependencyReport) -> str:
        """Generate a pip install script for missing dependencies."""
        missing_pip_packages = []
        
        for name, status in report.dependencies.items():
            if not status.available and name not in ['bpy', 'bmesh', 'mathutils']:
                if name == 'PIL':
                    missing_pip_packages.append('Pillow>=10.0.0')
                elif status.install_instructions and status.install_instructions.startswith('pip install'):
                    package = status.install_instructions.replace('pip install ', '')
                    missing_pip_packages.append(package)
        
        if missing_pip_packages:
            return f"pip install {' '.join(missing_pip_packages)}"
        return "# All pip-installable dependencies are available"
    
    def log_dependency_report(self, report: DependencyReport) -> None:
        """Log a comprehensive dependency report."""
        logger.info("=== Blender Pipeline Dependency Report ===")
        
        # Overall status
        if report.is_functional:
            logger.info("✅ System is functional (minimum dependencies available)")
        else:
            logger.error("❌ System is not functional (missing critical dependencies)")
        
        if report.is_fully_functional:
            logger.info("✅ All optional features available")
        else:
            logger.warning(f"⚠️ {len([d for d in report.dependencies.values() if not d.available])} optional dependencies missing")
        
        # Detailed dependency status
        logger.info("\n--- Dependency Details ---")
        for name, status in report.dependencies.items():
            status_icon = "✅" if status.available else "❌"
            version_info = f" (v{status.version})" if status.version else ""
            logger.info(f"{status_icon} {name}{version_info}")
            
            if not status.available and status.install_instructions:
                logger.info(f"   📦 Install: {status.install_instructions}")
        
        # Warnings and errors
        if report.errors:
            logger.error("\n--- Critical Issues ---")
            for error in report.errors:
                logger.error(f"🚨 {error}")
        
        if report.warnings:
            logger.warning("\n--- Warnings ---")
            for warning in report.warnings:
                logger.warning(f"⚠️ {warning}")
        
        # Installation help
        install_script = self.get_installation_script(report)
        if "pip install" in install_script:
            logger.info(f"\n--- Quick Install ---")
            logger.info(f"Run: {install_script}")


# Global validator instance
_validator = DependencyValidator()


def validate_dependencies() -> DependencyReport:
    """Validate all dependencies and return a report."""
    return _validator.validate_all_dependencies()


def check_critical_dependencies() -> bool:
    """Quick check for critical dependencies. Returns True if functional."""
    report = validate_dependencies()
    return report.is_functional


def log_dependency_status() -> None:
    """Log the current dependency status."""
    report = validate_dependencies()
    _validator.log_dependency_report(report)


def get_missing_dependency_help() -> str:
    """Get installation instructions for missing dependencies."""
    report = validate_dependencies()
    return _validator.get_installation_script(report)