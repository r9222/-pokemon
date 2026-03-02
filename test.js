const fs = require('fs');

// Load DBs
eval(fs.readFileSync('./pokemon-db.js', 'utf8').replace(/const /g, 'var '));
eval(fs.readFileSync('./item-db.js', 'utf8').replace(/const /g, 'var '));
eval(fs.readFileSync('./machine-db.js', 'utf8').replace(/const /g, 'var '));
let SYSTEM_PROMPT = "";
try {
    const ptd = fs.readFileSync('./poke-tamachan-data.js', 'utf8');
    const match = ptd.match(/const SYSTEM_PROMPT = `([\s\S]*?)`;/);
    if (match) SYSTEM_PROMPT = match[1];
} catch (e) { }

// Extract functions from poke-ai.js
const mockDOM = `
const document = {
    getElementById: (id) => ({ checked: false, value: '', classList: {add: ()=>{}, remove: ()=>{}}, innerText: '' }),
    addEventListener: () => {}
};
const window = { location: { reload: () => {} } };
const localStorage = { getItem: () => 'false', setItem: () => {} };
class Audio { play() { return Promise.resolve(); } pause() {} };
const navigator = {};
const alert = console.log;
const confirm = () => true;
`;

const pokeAiCode = fs.readFileSync('./poke-ai.js', 'utf8');
eval(mockDOM + pokeAiCode);

const testQueries = [
    "じしんの入手方法",
    "マスターボールはどうやって手に入れる？",
    "きあいパンチ（わざマシン01）について教えて",
    "たべのこしの入手方法",
    "ふしぎなアメ"
];

const results = [];

for (const query of testQueries) {
    let rawText = fixVoiceInput(query);
    const directMatches = findPokemon(rawText);
    let moveInfo = null;
    let itemInfo = null;
    let machineInfo = null;

    if (directMatches.length === 0) {
        machineInfo = findMachine(rawText);
        if (machineInfo) {
            moveInfo = searchMoveInfoForTM(machineInfo.name.split(" ").pop());
        } else {
            moveInfo = searchMoveInfo(rawText);
        }

        if (!machineInfo && !moveInfo) {
            itemInfo = findItemOrMachine(rawText);
        }
    }

    let cheatSheet = "";

    if (directMatches.length > 0) {
        cheatSheet = directMatches.map(p => "【" + p.name + "】\n" + formatInfoForAI(p.info)).join("\n\n");
    } else if (machineInfo) {
        let effectText = machineInfo.effect || "データなし";
        if (moveInfo) {
            const effMatch = moveInfo.match(/威力: (.*?)\n命中: (.*?)\nPP: (.*?)\n効果: (.*?)\n/);
            if (effMatch) {
                effectText = effMatch[4] + " (威力:" + effMatch[1] + " / 命中:" + effMatch[2] + " / PP:" + effMatch[3] + ")";
            }
        }
        let tmSection = "【わざマシンデータ】\n技マシン名: " + machineInfo.name + "\n効果: " + effectText + "\n入手場所: " + (machineInfo.location || "不明");

        if (moveInfo) {
            cheatSheet = tmSection + "\n\n" + moveInfo;
        } else {
            cheatSheet = tmSection;
        }
    } else if (moveInfo) {
        cheatSheet = moveInfo;
    } else if (itemInfo) {
        cheatSheet = "【アイテムデータ】\n名前: " + itemInfo.name + "\n効果: " + itemInfo.effect + "\n入手方法: " + (itemInfo.location || "不明");
    } else {
        cheatSheet = "【システム通知】該当するデータがデータベース(DB)に見つかりませんでした。ユーザーが尋ねている対象はデータベース外のアイテムやマイナーな用語である可能性が高いです。無理に知識で答えず、必ずプロンプトの【Step 3】に従って検索トリガー「[UNKNOWN] 検索キーワード」を出力してください。";
    }

    results.push({
        query: query,
        rawText: rawText,
        machineInfo: machineInfo ? machineInfo.name : null,
        itemInfo: itemInfo ? itemInfo.name : null,
        moveInfo: moveInfo ? moveInfo.substring(0, 50).replace(/\n/g, '\\n') + "..." : null,
        cheatSheet: cheatSheet.substring(0, 150).replace(/\n/g, '\\n') + "..."
    });
}

console.log(JSON.stringify(results, null, 2));
