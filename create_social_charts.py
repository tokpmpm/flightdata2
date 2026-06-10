import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import seaborn as sns
import pandas as pd
import numpy as np

# Set style
sns.set_theme(style="whitegrid")
plt.rcParams['figure.dpi'] = 300
plt.rcParams['savefig.dpi'] = 300

# Try to find a Chinese font
font_path = '/System/Library/Fonts/PingFang.ttc' # Common on macOS
try:
    font_prop = fm.FontProperties(fname=font_path)
    plt.rcParams['font.family'] = font_prop.get_name()
except:
    print("PingFang font not found, falling back to default.")
    # Fallback for standard sans-serif if specific Chinese font fails, 
    # though Chinese chars might not render correctly without it.
    plt.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'SimHei', 'sans-serif']

# Data for Top Destinations
top_dest_data = {
    'City': ['東京成田', '大阪', '東京羽田', '福岡', '沖繩'],
    'Passengers': [423, 385, 130, 123, 114] # In ten thousands (萬)
}
df_top = pd.DataFrame(top_dest_data)

# Data for Rising Stars (Growth)
growth_data = {
    'City': ['石垣島', '宮崎', '高松', '仙台'],
    'Growth': [26.5, 10.4, 1.35, 1.33], # Multiplier (26.5x, etc) or Ratio
    'Label': ['26.5倍', '10.4倍', '+35%', '+34%']
}
df_growth = pd.DataFrame(growth_data)

# Colors
primary_color = '#FF6B6B'
secondary_color = '#4ECDC4'
text_color = '#333333'

def create_top_dest_chart():
    plt.figure(figsize=(10, 12))
    ax = sns.barplot(x='Passengers', y='City', data=df_top, palette='viridis')
    
    plt.title('2025 日本熱門航點 Top 5 (預估)', fontsize=24, pad=20, fontproperties=font_prop, color=text_color, weight='bold')
    plt.xlabel('預估旅客人次 (萬)', fontsize=16, fontproperties=font_prop)
    plt.ylabel('', fontsize=16)
    
    # Add value labels
    for i, v in enumerate(df_top['Passengers']):
        ax.text(v + 5, i, f'{v}萬', va='center', fontsize=18, fontproperties=font_prop, weight='bold')
        
    plt.xticks(fontsize=14)
    plt.yticks(fontsize=18, fontproperties=font_prop)
    sns.despine(left=True, bottom=True)
    plt.tight_layout()
    plt.savefig('chart_top_destinations.png')
    plt.close()

def create_growth_chart():
    plt.figure(figsize=(10, 12))
    # Using specific colors to highlight the massive growth
    colors = [primary_color if x > 5 else secondary_color for x in df_growth['Growth']]
    ax = sns.barplot(x='City', y='Growth', data=df_growth, palette=colors)
    
    plt.title('2025 爆發性成長航點', fontsize=24, pad=20, fontproperties=font_prop, color=text_color, weight='bold')
    plt.ylabel('成長倍數/幅度', fontsize=16, fontproperties=font_prop)
    plt.xlabel('', fontsize=16)
    
    # Add value labels
    for i, v in enumerate(df_growth['Growth']):
        label = df_growth['Label'][i]
        ax.text(i, v + 0.5, label, ha='center', fontsize=20, fontproperties=font_prop, weight='bold', color='black')
        
    plt.xticks(fontsize=18, fontproperties=font_prop)
    plt.yticks([]) # Hide y axis values as we have labels
    sns.despine(left=True, bottom=True, left=True)
    plt.tight_layout()
    plt.savefig('chart_growth_stars.png')
    plt.close()

def create_kobe_chart():
    plt.figure(figsize=(10, 10))
    plt.axis('off')
    
    # Background
    plt.imshow(np.full((10, 10, 3), 1.0)) # White background
    
    plt.text(5, 8.5, '關西新門戶', ha='center', fontsize=30, color=secondary_color, fontproperties=font_prop, weight='bold')
    plt.text(5, 7.5, '神戶 (Kobe)', ha='center', fontsize=40, color=text_color, fontproperties=font_prop, weight='bold')
    
    plt.text(2.5, 5, '2024', ha='center', fontsize=24, color='#999', fontproperties=font_prop)
    plt.text(2.5, 4, '0', ha='center', fontsize=40, color='#999', fontproperties=font_prop, weight='bold')
    
    plt.arrow(4, 4.5, 2, 0, head_width=0.3, head_length=0.3, fc=primary_color, ec=primary_color)
    
    plt.text(7.5, 5, '2025', ha='center', fontsize=24, color=primary_color, fontproperties=font_prop, weight='bold')
    plt.text(7.5, 4, '22.1萬', ha='center', fontsize=40, color=primary_color, fontproperties=font_prop, weight='bold')
    
    plt.text(5, 2, '預估旅客人次', ha='center', fontsize=20, color='#666', fontproperties=font_prop)
    
    plt.tight_layout()
    plt.savefig('chart_kobe_emergence.png')
    plt.close()

def create_market_overview():
    plt.figure(figsize=(10, 6))
    plt.axis('off')
    
    plt.text(0.5, 0.8, '2025 日本航線市場預測', ha='center', fontsize=28, fontproperties=font_prop, weight='bold')
    
    # Seats
    plt.text(0.25, 0.5, '總座位數', ha='center', fontsize=20, fontproperties=font_prop, color='#666')
    plt.text(0.25, 0.3, '+11.3%', ha='center', fontsize=36, fontproperties=font_prop, weight='bold', color=secondary_color)
    
    # Passengers
    plt.text(0.75, 0.5, '總旅客人次', ha='center', fontsize=20, fontproperties=font_prop, color='#666')
    plt.text(0.75, 0.3, '+5.1%', ha='center', fontsize=36, fontproperties=font_prop, weight='bold', color=primary_color)
    
    plt.tight_layout()
    plt.savefig('chart_market_overview.png')
    plt.close()

if __name__ == "__main__":
    create_top_dest_chart()
    create_growth_chart()
    create_kobe_chart()
    create_market_overview()
    print("Charts generated successfully.")
