const fs = require('fs');
const json = fs.readFileSync('C:/Users/pc1/.gemini/antigravity/scratch/yakkun_scraper/frlg_items_db_full.json', 'utf8');
fs.writeFileSync('C:/Users/pc1/Desktop/ぽけもん/-pokemon/item-db.js', 'const ITEM_DB = ' + json + ';\n');
console.log('item-db.js created successfully.');
