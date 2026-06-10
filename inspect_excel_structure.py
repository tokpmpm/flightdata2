import pandas as pd
import os

def inspect_file(filepath):
    print(f"--- Inspecting {os.path.basename(filepath)} ---")
    try:
        if filepath.endswith('.xls'):
            df = pd.read_excel(filepath, engine='xlrd') # older format
        else:
            df = pd.read_excel(filepath, engine='openpyxl') # newer format
        
        print("Columns:", df.columns.tolist())
        print("First 5 rows:")
        print(df.head().to_string())
        print("\n")
    except Exception as e:
        print(f"Error reading {filepath}: {e}")

base_dir = '/Users/pmpmpm/Antigravity/passenger_capacity/extracted'
files_to_inspect = ['113年7月.xlsx', '111年10月.xls']

for f in files_to_inspect:
    inspect_file(os.path.join(base_dir, f))
