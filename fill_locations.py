import asyncio
import json
import time
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup

async def main():
    json_path = 'c:/Users/pc1/.gemini/antigravity/scratch/yakkun_scraper/frlg_items_db_full.json'
    
    with open(json_path, 'r', encoding='utf-8') as f:
        db = json.load(f)
        
    missing_items = [i for i in db if not i['location']]
    print(f"Found {len(missing_items)} items missing locations. Starting scrape...")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            viewport={'width': 1280, 'height': 720},
            extra_http_headers={'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'}
        )
        page = await context.new_page()
        
        # Navigate to the main item list
        await page.goto("https://yakkun.com/fl/item.htm")
        await page.wait_for_timeout(3000)
        
        content = await page.content()
        soup = BeautifulSoup(content, 'html.parser')
        
        # Build dictionary from the table
        locations_found = {}
        tables = soup.find_all('table', class_='list')
        for table in tables:
            rows = table.find_all('tr')
            for row in rows:
                cols = row.find_all('td')
                if len(cols) >= 3:
                    item_name = cols[0].get_text(strip=True)
                    location = cols[2].get_text(strip=True)
                    locations_found[item_name] = location
                    
        # Update our DB
        updated_count = 0
        for item in db:
            if not item['location'] and item['name'] in locations_found:
                new_loc = locations_found[item['name']]
                if new_loc:
                    item['location'] = new_loc
                    updated_count += 1
                    
        print(f"Filled in {updated_count} missing locations.")
        
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(db, f, ensure_ascii=False, indent=2)
            
        await browser.close()
        
    # Also update item-db.js
    js_output = f"const ITEM_DB = {json.dumps(db, ensure_ascii=False, indent=2)};\n"
    with open('c:/Users/pc1/Desktop/ぽけもん/-pokemon/item-db.js', 'w', encoding='utf-8') as f:
        f.write(js_output)
        
    print("Successfully updated item-db.js")

asyncio.run(main())
