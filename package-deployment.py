#!/usr/bin/env python3
import os
import zipfile
from pathlib import Path

def should_exclude(path):
    """Check if path should be excluded from zip"""
    exclude_patterns = [
        'node_modules',
        '.git',
        'dist',
        '__pycache__',
        '.DS_Store',
        '.env.local',
        '.env.*.local',
    ]
    
    path_str = str(path)
    for pattern in exclude_patterns:
        if pattern in path_str:
            return True
    return False

def create_deployment_zip():
    """Create a deployment-ready zip file"""
    root_dir = Path('.')
    zip_name = 'rf-dashboard-deployment.zip'
    
    # Remove existing zip if it exists
    if os.path.exists(zip_name):
        os.remove(zip_name)
    
    with zipfile.ZipFile(zip_name, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # Add all files except excluded ones
        for root, dirs, files in os.walk('.'):
            # Skip excluded directories
            dirs[:] = [d for d in dirs if not should_exclude(os.path.join(root, d))]
            
            for file in files:
                file_path = os.path.join(root, file)
                
                # Skip excluded files and the zip itself
                if should_exclude(file_path) or file_path.endswith('.zip'):
                    continue
                
                # Add file to zip
                arcname = os.path.relpath(file_path, '.')
                zipf.write(file_path, arcname)
                print(f"Added: {arcname}")
    
    size = os.path.getsize(zip_name) / (1024 * 1024)  # Size in MB
    print(f"\n✅ Created {zip_name} ({size:.2f} MB)")

if __name__ == '__main__':
    create_deployment_zip()

