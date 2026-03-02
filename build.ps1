$json = Get-Content 'C:\Users\pc1\.gemini\antigravity\scratch\yakkun_scraper\frlg_items_db_full.json' -Raw
$content = "const ITEM_DB = " + $json + ";"
[System.IO.File]::WriteAllText('.\item-db.js', $content, [System.Text.Encoding]::UTF8)
