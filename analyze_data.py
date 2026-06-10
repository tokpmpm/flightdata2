#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Analyze passenger load factor data structure
"""

import pandas as pd
import os
import sys

def analyze_excel_file(filepath):
    """Analyze an Excel file to understand its structure"""
    print(f"\n{'='*80}")
    print(f"Analyzing: {os.path.basename(filepath)}")
    print(f"{'='*80}\n")
    
    try:
        # Try to read the Excel file
        df = pd.read_excel(filepath)
        
        print(f"Shape: {df.shape} (rows x columns)")
        print(f"\nColumn names:")
        for i, col in enumerate(df.columns):
            print(f"  {i+1}. {col}")
        
        print(f"\nFirst 5 rows:")
        print(df.head())
        
        print(f"\nData types:")
        print(df.dtypes)
        
        print(f"\nSample data from first few rows:")
        print(df.head(3).to_string())
        
        return df
        
    except Exception as e:
        print(f"Error reading file: {e}")
        return None

if __name__ == "__main__":
    # Analyze a sample file
    sample_files = [
        "extracted/111年1月.xls",
        "extracted/112年1月.xls",
        "extracted/113年1月.xls",
    ]
    
    for sample_file in sample_files:
        if os.path.exists(sample_file):
            df = analyze_excel_file(sample_file)
            if df is not None:
                break
