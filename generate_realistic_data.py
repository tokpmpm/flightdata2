#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate realistic passenger data based on Taiwan flight routes
Focuses on major destinations to provide meaningful demo data
"""

import json
import random
from datetime import datetime

# Real Taiwan airports
TAIWAN_AIRPORTS = {
    '桃園國際機場': 'TPE',
    '松山機場': 'TSA',
    '高雄國際機場': 'KHH',
    '台中清泉崗機場': 'RMQ',
    '台南機場': 'TNN'
}

# Major international destinations from Taiwan
DESTINATIONS = {
    # Japan
    '東京成田': {'region': '日本', 'popularity': 0.95},
    '東京羽田': {'region': '日本', 'popularity': 0.9},
    '大阪關西': {'region': '日本', 'popularity': 0.9},
    '福岡': {'region': '日本', 'popularity': 0.75},
    '沖繩': {'region': '日本', 'popularity': 0.85},
    '名古屋': {'region': '日本', 'popularity': 0.65},
    '札幌新千歲': {'region': '日本', 'popularity': 0.7},
    
    # Korea
    '首爾仁川': {'region': '韓國', 'popularity': 0.9},
    '首爾金浦': {'region': '韓國', 'popularity': 0.75},
    '釜山': {'region': '韓國', 'popularity': 0.7},
    
    # China
    '上海浦東': {'region': '中國大陸', 'popularity': 0.6},
    '北京首都': {'region': '中國大陸', 'popularity': 0.55},
    '廣州': {'region': '中國大陸', 'popularity': 0.5},
    
    # Hong Kong & Macau
    '香港': {'region': '香港', 'popularity': 0.85},
    '澳門': {'region': '澳門', 'popularity': 0.7},
    
    # Southeast Asia
    '曼谷素萬那普': {'region': '泰國', 'popularity': 0.8},
    '新加坡': {'region': '新加坡', 'popularity': 0.85},
    '吉隆坡': {'region': '馬來西亞', 'popularity': 0.7},
    '胡志明市': {'region': '越南', 'popularity': 0.65},
    '河內': {'region': '越南', 'popularity': 0.6},
    '馬尼拉': {'region': '菲律賓', 'popularity': 0.7},
    
    # US & Canada
    '洛杉磯': {'region': '美國', 'popularity': 0.6},
    '舊金山': {'region': '美國', 'popularity': 0.55},
    '西雅圖': {'region': '美國', 'popularity': 0.5},
    '溫哥華': {'region': '加拿大', 'popularity': 0.55},
    
    # Australia
    '雪梨': {'region': '澳洲', 'popularity': 0.65},
    '墨爾本': {'region': '澳洲', 'popularity': 0.55},
}

# Major airlines operating from Taiwan
AIRLINES = {
    '中華航空': {'market_share': 0.25, 'load_factor_avg': 82},
    '長榮航空': {'market_share': 0.25, 'load_factor_avg': 84},
    '星宇航空': {'market_share': 0.12, 'load_factor_avg': 86},
    '台灣虎航': {'market_share': 0.08, 'load_factor_avg': 88},
    '立榮航空': {'market_share': 0.06, 'load_factor_avg': 75},
    '日本航空': {'market_share': 0.05, 'load_factor_avg': 80},
    '全日空': {'market_share': 0.05, 'load_factor_avg': 81},
    '大韓航空': {'market_share': 0.04, 'load_factor_avg': 79},
    '國泰航空': {'market_share': 0.04, 'load_factor_avg': 77},
    '新加坡航空': {'market_share': 0.03, 'load_factor_avg': 83},
    '泰國航空': {'market_share': 0.03, 'load_factor_avg': 76},
}

def generate_realistic_data():
    """Generate realistic flight data for 2022-2025"""
    data = []
    
    # COVID recovery factors by year
    covid_factors = {
        2022: 0.4,   # 40% recovery
        2023: 0.75,  # 75% recovery
        2024: 0.95,  # 95% recovery
        2025: 1.0    # Full recovery
    }
    
    # Seasonal factors by month
    seasonal_factors = {
        1: 1.1,   # Chinese New Year
        2: 1.15,  # CNY continues
        3: 0.9,
        4: 0.95,
        5: 0.9,
        6: 1.0,
        7: 1.2,   # Summer vacation
        8: 1.25,  # Peak summer
        9: 1.0,
        10: 1.05, # National Day holiday
        11: 0.95,
        12: 1.1   # Year-end holidays
    }
    
    for year in range(2022, 2026):
        max_month = 10 if year == 2025 else 12
        
        for month in range(1, max_month + 1):
            # Apply recovery and seasonal factors
            recovery = covid_factors[year]
            seasonal = seasonal_factors[month]
            
            # Generate routes from major airports
            for airport in list(TAIWAN_AIRPORTS.keys())[:3]:  # Top 3 airports
                for dest, dest_info in DESTINATIONS.items():
                    # Not all airlines fly all routes
                    active_airlines = random.sample(
                        list(AIRLINES.keys()),
                        k=random.randint(2, min(5, len(AIRLINES)))
                    )
                    
                    for airline in active_airlines:
                        airline_info = AIRLINES[airline]
                        
                        # Calculate realistic numbers
                        base_flights = int(dest_info['popularity'] * 30 * recovery * seasonal)
                        if base_flights == 0:
                            continue
                        
                        flights = max(1, base_flights + random.randint(-5, 5))
                        avg_seats_per_flight = random.choice([180, 220, 280, 320, 350])
                        total_seats = flights * avg_seats_per_flight
                        
                        # Load factor varies by airline and season
                        base_lf = airline_info['load_factor_avg']
                        load_factor = min(98, max(50, base_lf + random.randint(-8, 8) * seasonal))
                        passengers = int(total_seats * (load_factor / 100))
                        
                        record = {
                            'year': year,
                            'month': month,
                            'year_month': f"{year}-{month:02d}",
                            'airport': airport,
                            'destination': dest,
                            'airline': airline,
                            'flights': flights,
                            'total_seats': total_seats,
                            'passengers': passengers,
                            'load_factor': round(load_factor, 2)
                        }
                        
                        data.append(record)
    
    return data

def main():
    print("="*80)
    print("Generating Realistic Taiwan Flight Data")
    print("="*80)
    
    data = generate_realistic_data()
    
    # Save to JSON
    output_file = 'data/flight_data.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Generated {len(data)} realistic records")
    print(f"Output: {output_file}")
    
    # Statistics
    airports = set(r['airport'] for r in data)
    destinations = set(r['destination'] for r in data)
    airlines = set(r['airline'] for r in data)
    
    print(f"\nData Summary:")
    print(f"  Airports: {len(airports)}")
    print(f"  Destinations: {len(destinations)}")
    print(f"  Airlines: {len(airlines)}")
    print(f"  Years: 2022-2025")
    print(f"  Total Months: {len(set(r['year_month'] for r in data))}")
    print("="*80)

if __name__ == "__main__":
    main()
