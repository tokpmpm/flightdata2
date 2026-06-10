import requests
from bs4 import BeautifulSoup

url = "https://www.caa.gov.tw/article.aspx?a=1752&lang=1"
r = requests.get(url)
soup = BeautifulSoup(r.text, 'html.parser')
for a in soup.find_all('a'):
    title = a.get('title', '')
    text = a.text.strip()
    href = a.get('href', '')
    if 'FileDownLoad' in href or 'xls' in text.lower() or 'xls' in title.lower():
        print(f"Title: {title} | Text: {text} | Href: {href}")
