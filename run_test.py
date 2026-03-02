import asyncio
from playwright.async_api import async_playwright
import json
import traceback

async def main():
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            await page.goto("file:///c:/Users/pc1/Desktop/ぽけもん/-pokemon/test.html")
            
            # evaluate script
            results = await page.evaluate("runTests()")
            print(json.dumps(results, indent=2, ensure_ascii=False))
            
            await browser.close()
    except Exception as e:
        print("Error:")
        traceback.print_exc()

asyncio.run(main())
