#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Process XLS files to extract real passenger data
Focus on major destinations to reduce data size
"""

import xlrd
import json
import os
from pathlib import Path
from collections import defaultdict

# Major destinations to include (reduce data size)
MAJOR_DESTINATIONS = [
    '日本', '東京', '大阪', '福岡', '沖繩', '名古屋', '札幌',
    '韓國', '首爾', '釜山',
    '中國大陸', '上海', '北京', '廣州', '深圳', '廈門',
    '香港', '澳門',
    '泰國', '曼谷',
    '新加坡',
    '馬來西亞', '吉隆坡',
    '越南', '胡志明市', '河內',
    '菲律賓', '馬尼拉',
    '美國', '洛杉磯', '舊金山', '紐約',
    '加拿大', '溫哥華', '多倫多',
    '歐洲', '倫敦', '巴黎', '法蘭克福', '阿姆斯特丹',
    '澳洲', '雪梨', '墨爾本', '布里斯本'
]

def is_major_destination(dest):
    """Check if destination is in major destinations list"""
    if not dest or dest == 'Unknown':
        return False
    
    dest = str(dest).strip()
    for major in MAJOR_DESTINATIONS:
        if major in dest:
            return True
    return False

def process_xls_file_lightweight(filepath):
    """Process XLS file with minimal memory usage"""
    filename = os.path.basename(filepath)
    print(f"Processing: {filename}")
    
    try:
        # Extract year and month
        year_str = filename.split('年')[0]
        month_str = filename.split('年')[1].split('月')[0]
        year = int(year_str) + 1911
        month = int(month_str)
        
        # Open workbook
        workbook = xlrd.open_workbook(filepath, on_demand=True)
        sheet = workbook.sheet_by_index(0)
        
        # Find header row and columns
        headers = {}
        for row_idx in range(min(5, sheet.nrows)):
            row = [sheet.cell_value(row_idx, col_idx) for col_idx in range(sheet.ncols)]
            
            # Look for key column names
            for col_idx, cell_value in enumerate(row):
                cell_str = str(cell_value).strip()
                if '機場' in cell_str or '出發' in cell_str:
                    headers['airport'] = col_idx
                if '航點' in cell_str or '目的地' in cell_str or '抵達' in cell_str:
                    headers['destination'] = col_idx
                if '航空公司' in cell_str or '業者' in cell_str:
                    headers['airline'] = col_idx
                if '班次' in cell_str or '航班' in cell_str:
                    headers['flights'] = col_idx
                if '座位' in cell_str and '總' in cell_str:
                    headers['seats'] = col_idx
                if '載客' in cell_str and ('人數' in cell_str or '數' in cell_str):
                    headers['passengers'] = col_idx
                if '載客率' in cell_str or '客座率' in cell_str:
                    headers['load_factor'] = col_idx
            
            if len(headers) >= 4:  # Found enough headers
                header_row = row_idx
                break
        
        if not headers:
            print(f"  ⚠️  Could not find headers, skipping")
            workbook.release_resources()
            return []
        
        print(f"  Headers found at row {header_row}: {headers}")
        
        records = []
        row_count = 0
        
        # Process data rows
        for row_idx in range(header_row + 1, sheet.nrows):
            try:
                airport = sheet.cell_value(row_idx, headers.get('airport', 0))
                destination = sheet.cell_value(row_idx, headers.get('destination', 1))
                
                # Filter for major destinations only
                if not is_major_destination(destination):
                    continue
                
                airline = sheet.cell_value(row_idx, headers.get('airline', 2))
                
                # Get numeric values safely
                def get_numeric(col_key, default=0):
                    if col_key not in headers:
                        return default
                    try:
                        val = sheet.cell_value(row_idx, headers[col_key])
                        return float(val) if val else default
                    except:
                        return default
                
                flights = int(get_numeric('flights', 0))
                seats = int(get_numeric('seats', 0))
                passengers = int(get_numeric('passengers', 0))
                load_factor = get_numeric('load_factor', 0)
                
                # Skip empty rows
                if passengers == 0 and seats == 0:
                    continue
                
                # Calculate load factor if not provided
                if load_factor == 0 and seats > 0:
                    load_factor = (passengers / seats) * 100
                
                record = {
                    'year': year,
                    'month': month,
                    'year_month': f"{year}-{month:02d}",
                    'airport': str(airport).strip(),
                    'destination': str(destination).strip(),
                    'airline': str(airline).strip(),
                    'flights': flights,
                    'total_seats': seats,
                    'passengers': passengers,
                    'load_factor': round(load_factor, 2)
                }
                
                records.append(record)
                row_count += 1
                
            except Exception as e:
                continue
        
        workbook.release_resources()
        print(f"  ✓ Extracted {row_count} records (major destinations only)\n")
        return records
        
    except Exception as e:
        print(f"  ✗ Error: {e}\n")
        return []

def main():
    print("="*80)
    print("Processing Real Passenger Data (Major Destinations)")
    print("="*80)
    
    data_dir = Path("extracted")
    xls_files = sorted([
        f for f in data_dir.glob("*.xls")
        if f.name.startswith(('111年', '112年', '113年', '114年'))
    ])
    
    print(f"\nFound {len(xls_files)} XLS files from 2022 onwards\n")
    
    all_records = []
    
    for filepath in xls_files[:48]:  # Process up to 48 files to avoid token limits
        records = process_xls_file_lightweight(str(filepath))
        all_records.extend(records)
        
        # Limit total records to avoid memory issues
        if len(all_records) > 50000:
            print("\n⚠️  Reached 50K records limit, stopping processing")
            break
    
    # Save to JSON
    output_file = Path("data/flight_data.json")
    output_file.parent.mkdir(exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_records, f, ensure_ascii=False, indent=2)
    
    print("\n" + "="*80)
    print("✅ Processing Complete!")
    print(f"Total records: {len(all_records)}")
    print(f"Output file: {output_file}")
    print(f"File size: {output_file.stat().st_size / 1024:.2f} KB")
    
    # Print summary statistics
    airports = set(r['airport'] for r in all_records)
    destinations = set(r['destination'] for r in all_records)
    airlines = set(r['airline'] for r in all_records)
    
    print(f"\nData Summary:")
    print(f"  Airports: {len(airports)}")
    print(f"  Destinations: {len(destinations)}")
    print(f"  Airlines: {len(airlines)}")
    print(f"  Date range: {min(r['year_month'] for r in all_records)} to {max(r['year_month'] for r in all_records)}")
    print("="*80)

if __name__ == "__main__":
    main()
