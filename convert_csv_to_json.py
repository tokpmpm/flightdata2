#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Convert CSV files to JSON for the passenger load factor dashboard
Usage: python3 convert_csv_to_json.py
"""

import pandas as pd
import json
import glob
import os
from pathlib import Path

def convert_csv_to_json():
    """
    Convert all CSV files in extracted/ directory to a single JSON file
    """
    print("="*80)
    print("Converting CSV files to JSON format")
    print("="*80)
    
    all_data = []
    csv_files = sorted(glob.glob('extracted/*.csv'))
    
    if not csv_files:
        print("\n⚠️  No CSV files found in extracted/ directory")
        print("Please convert XLS files to CSV first using:")
        print("  - Online tool: https://cloudconvert.com/xls-to-csv")
        print("  - Excel: Open file → Save As → CSV UTF-8")
        print("  - LibreOffice: File → Save As → Text CSV")
        return
    
    print(f"\nFound {len(csv_files)} CSV files\n")
    
    for csv_file in csv_files:
        filename = os.path.basename(csv_file)
        print(f"Processing: {filename}")
        
        try:
            # Extract year and month from filename
            year_str = filename.split('年')[0]
            month_str = filename.split('年')[1].split('月')[0]
            year = int(year_str) + 1911  # Convert ROC year to AD
            month = int(month_str)
            
            # Read CSV file
            df = pd.read_csv(csv_file, encoding='utf-8')
            
            print(f"  Columns: {list(df.columns)}")
            print(f"  Rows: {len(df)}")
            
            # Process each row
            for _, row in df.iterrows():
                # Adjust column names based on your actual CSV structure
                # Common column names: 機場, 航點, 航空公司, 航班數, 總座位數, 載客人數, 載客率
                
                record = {
                    'year': year,
                    'month': month,
                    'year_month': f"{year}-{month:02d}",
                    'airport': str(row.get('機場', row.get('出發地', 'Unknown'))),
                    'destination': str(row.get('航點', row.get('目的地', 'Unknown'))),
                    'airline': str(row.get('航空公司', 'Unknown')),
                    'flights': int(row.get('航班數', 0)),
                    'total_seats': int(row.get('總座位數', 0)),
                    'passengers': int(row.get('載客人數', 0)),
                    'load_factor': float(row.get('載客率', 0))
                }
                
                all_data.append(record)
            
            print(f"  ✓ Successfully processed\n")
            
        except Exception as e:
            print(f"  ✗ Error: {e}\n")
            continue
    
    # Save to JSON
    output_file = Path('data/flight_data.json')
    output_file.parent.mkdir(exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)
    
    print("="*80)
    print("✅ Conversion complete!")
    print(f"Total records: {len(all_data)}")
    print(f"Output file: {output_file}")
    print(f"File size: {output_file.stat().st_size / 1024:.2f} KB")
    print("="*80)
    print("\nNext steps:")
    print("1. Update js/app.js to fetch from 'data/flight_data.json'")
    print("2. Start local server: python3 -m http.server 8000")
    print("3. Open browser: http://localhost:8000")

if __name__ == "__main__":
    convert_csv_to_json()
