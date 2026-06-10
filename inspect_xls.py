#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simple script to inspect XLS file structure
"""

import sys
import xlrd
import json

def inspect_xls(filepath):
    """Inspect XLS file structure"""
    print(f"Inspecting: {filepath}\n")
    
    try:
        # Open workbook
        workbook = xlrd.open_workbook(filepath, encoding_override='utf-8')
        
        # Get first sheet
        sheet = workbook.sheet_by_index(0)
        
        print(f"Sheet name: {sheet.name}")
        print(f"Rows: {sheet.nrows}, Columns: {sheet.ncols}\n")
        
        # Print first 10 rows
        print("First 10 rows:")
        print("="*100)
        for row_idx in range(min(10, sheet.nrows)):
            row_values = []
            for col_idx in range(sheet.ncols):
                cell = sheet.cell(row_idx, col_idx)
                value = cell.value
                if isinstance(value, float) and value.is_integer():
                    value = int(value)
                row_values.append(str(value))
            print(f"Row {row_idx}: {' | '.join(row_values)}")
        
        print("="*100)
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    filepath = "extracted/111年1月.xls"
    inspect_xls(filepath)
