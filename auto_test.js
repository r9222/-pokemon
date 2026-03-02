const fs = require('fs');

eval(fs.readFileSync('./pokemon-db.js', 'utf8').replace(/const /g, 'var '));
eval(fs.readFileSync('./item-db.js', 'utf8').replace(/const /g, 'var '));
eval(fs.readFileSync('./machine-db.js', 'utf8').replace(/const /g, 'var '));
let SYSTEM_PROMPT = "";
try {
    const ptd = fs.readFileSync('./poke-tamachan-data.js', 'utf8');
    const match = ptd.match(/const SYSTEM_PROMPT = `([\s\S]*?)`;/);
    if (match) SYSTEM_PROMPT = match[1];
} catch (e) { }

const mockDOM = `
const document = {
    getElementById: () => ({ checked: false, value: '', classList: {add: ()=>{}, remove: ()=>{}}, innerText: '' }),
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

async function runTests() {
    for (const query of testQueries) {
        console.log("-----------------------------------------");
        console.log("Query:", query);
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
                if (effMatch) effectText = effMatch[4] + " (威力:" + effMatch[1] + " / 命中:" + effMatch[2] + " / PP:" + effMatch[3] + ")";
            }
            let tmSection = "【わざマシンデータ】\n技マシン名: " + machineInfo.name + "\n効果: " + effectText + "\n入手場所: " + (machineInfo.location || "不明");
            cheatSheet = moveInfo ? (tmSection + "\n\n" + moveInfo) : tmSection;
        } else if (moveInfo) {
            cheatSheet = moveInfo;
        } else if (itemInfo) {
            cheatSheet = "【アイテムデータ】\n名前: " + itemInfo.name + "\n効果: " + itemInfo.effect + "\n入手方法: " + (itemInfo.location || "不明");
        } else {
            cheatSheet = "【システム通知】該当するデータがデータベース(DB)に見つかりませんでした。ユーザーが尋ねている対象はデータベース外のアイテムやマイナーな用語である可能性が高いです。無理に知識で答えず、必ずプロンプトの【Step 3】に従って検索トリガー「[UNKNOWN] 検索キーワード」を出力してください。";
        }

        const basePrompt = SYSTEM_PROMPT || "あなたはポケモンガチ勢のたまちゃんです。";
        const fullPrompt = `${basePrompt}\n\n=== カンペ ===\n${cheatSheet || "データが見つからないたま！"}\n\n=== 質問 ===\n${rawText}`;

        try {
            const res = await fetch("https://script.google.com/macros/s/AKfycbwBmtIRAwPZMoI2TPNd5si6kJaNltdZNypwlL9YKMmw1KKn4Yn7Loi2pkwfc6PoKjV20A/exec", {
                method: "POST",
                body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
            });
            const data = await res.json();
            const reply = data.candidates[0].content.parts[0].text;
            console.log("AI Reply:\n" + reply);
        } catch (e) {
            console.error("Fetch Error:", e.message);
        }
    }
}
runTests();
