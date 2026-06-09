import requests
from bs4 import BeautifulSoup
import os
import re

url = "https://www.caa.gov.tw/article.aspx?a=1752&lang=1"
base_url = "https://www.caa.gov.tw/"
r = requests.get(url)
soup = BeautifulSoup(r.text, 'html.parser')

script_dir = os.path.dirname(os.path.abspath(__file__))
extracted_dir = os.path.join(script_dir, "extracted")
os.makedirs(extracted_dir, exist_ok=True)
existing_files = set(os.listdir(extracted_dir))

downloaded = 0
for a in soup.find_all('a'):
    title = a.get('title', '')
    text = a.text.strip()
    href = a.get('href', '')
    
    name = title if title.endswith('.xls') or title.endswith('.xlsx') else ''
    if not name and 'xls' in text.lower():
        name = text
        
    if not name:
        match = re.search(r'fn=(.+)', href)
        if match:
            import urllib.parse
            name = urllib.parse.unquote(match.group(1)) + '.xls'
            
    # Dynamically extract ROC year and download if >= 111 (2022)
    year_match = re.search(r'(\d+)年', name)
    if year_match:
        year = int(year_match.group(1))
        if year >= 111:
            filename = name
            if not filename.endswith('.xls') and not filename.endswith('.xlsx'):
                filename += '.xls'
            
            if 'FileAtt.ashx' in href:
                import urllib.parse
                full_url = href if href.startswith('http') else urllib.parse.urljoin(base_url, href)
                
                if filename not in existing_files:
                    print(f"Downloading {filename} from {full_url}")
                    try:
                        file_r = requests.get(full_url)
                        with open(os.path.join(extracted_dir, filename), 'wb') as f:
                            f.write(file_r.content)
                        existing_files.add(filename)
                        downloaded += 1
                    except Exception as e:
                        print(f"Failed to download {filename}: {e}")

print(f"Total downloaded: {downloaded}")
