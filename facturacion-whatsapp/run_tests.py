#!/usr/bin/env python
"""Script para ejecutar tests fácilmente"""
import sys
import subprocess


def run_tests():
    """Ejecutar todos los tests"""
    result = subprocess.run([
        sys.executable, "-m", "pytest",
        "tests/",
        "-v",
        "--tb=short",
        "--asyncio-mode=auto"
    ], cwd=".")
    return result.returncode


def run_nlp_tests():
    """Ejecutar solo tests de NLP"""
    result = subprocess.run([
        sys.executable, "-m", "pytest",
        "tests/test_nlp.py",
        "-v",
        "--tb=short",
        "--asyncio-mode=auto"
    ], cwd=".")
    return result.returncode


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--nlp-only", action="store_true", help="Solo tests de NLP")
    args = parser.parse_args()
    
    if args.nlp_only:
        exit_code = run_nlp_tests()
    else:
        exit_code = run_tests()
    
    sys.exit(exit_code)