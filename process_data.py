#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Process passenger load factor data from XLS files
Convert to JSON format for web application
"""

import pandas as pd
import json
import os
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

def process_xls_file(filepath):
    """
    Process a single XLS file and extract flight data
    Returns list of data records
    """
    filename = os.path.basename(filepath)
    print(f"Processing: {filename}")
    
    try:
        # Extract year and month from filename (e.g., "111年1月.xls")
        year_str = filename.split('年')[0]
        month_str = filename.split('年')[1].split('月')[0]
        
        # Convert ROC year to AD year
        year = int(year_str) + 1911
        month = int(month_str)
        
        # Read Excel file
        df = pd.read_excel(filepath, engine='xlrd')
        
        # Print column names for debugging
        if not hasattr(process_xls_file, 'columns_printed'):
            print(f"Columns in file: {list(df.columns)}")
            print(f"First few rows:\n{df.head()}\n")
            process_xls_file.columns_printed = True
        
        records = []
        
        # Process each row
        for idx, row in df.iterrows():
            try:
                # Skip empty rows
                if pd.isna(row).all():
                    continue
                
                # Create record (adjust column names based on actual file structure)
                record = {
                    'year': year,
                    'month': month,
                    'year_month': f"{year}-{month:02d}",
                    'data': row.to_dict()
                }
                
                records.append(record)
                
            except Exception as e:
                print(f"Error processing row {idx}: {e}")
                continue
        
        print(f"  → Extracted {len(records)} records")
        return records
        
    except Exception as e:
        print(f"Error processing {filename}: {e}")
        return []

def main():
    """Main processing function"""
    print("="*80)
    print("Processing Passenger Load Factor Data")
    print("="*80)
    
    # Directory containing XLS files
    data_dir = Path("extracted")
    
    # Find all XLS files from year 111 onwards
    xls_files = sorted([
        f for f in data_dir.glob("*.xls")
        if f.name.startswith(('111年', '112年', '113年', '114年'))
    ])
    
    # Also include XLSX files
    xlsx_files = sorted([
        f for f in data_dir.glob("*.xlsx")
        if f.name.startswith(('111年', '112年', '113年', '114年'))
    ])
    
    all_files = sorted(xls_files + xlsx_files, key=lambda x: x.name)
    
    print(f"\nFound {len(all_files)} files to process\n")
    
    # Process all files
    all_records = []
    for filepath in all_files:
        records = process_xls_file(filepath)
        all_records.extend(records)
    
    # Save to JSON
    output_file = Path("data/flight_data.json")
    output_file.parent.mkdir(exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_records, f, ensure_ascii=False, indent=2)
    
    print(f"\n{'='*80}")
    print(f"Processing complete!")
    print(f"Total records: {len(all_records)}")
    print(f"Output file: {output_file}")
    print(f"File size: {output_file.stat().st_size / 1024:.2f} KB")
    print(f"{'='*80}")

if __name__ == "__main__":
    main()
