// poke-ai.js
const gasUrl = "https://script.google.com/macros/s/AKfycbwBmtIRAwPZMoI2TPNd5si6kJaNltdZNypwlL9YKMmw1KKn4Yn7Loi2pkwfc6PoKjV20A/exec";

let pokeChatHistory = [];
let lastCheatSheet = "";
let recognition;
let isRecording = false;

let isAiMode = localStorage.getItem('tama_ai_mode') !== 'false'; 
let isTTSEnabled = localStorage.getItem('tama_tts_enabled') !== 'false';
let currentAudio = null;

const seStart = new Audio('start.mp3');
const seReceive = new Audio('receive.mp3');

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('ai-checkbox').checked = isAiMode;
    document.getElementById('tts-checkbox').checked = isTTSEnabled;
    updateToggleText();
});

function toggleMode() {
    isAiMode = document.getElementById('ai-checkbox').checked;
    localStorage.setItem('tama_ai_mode', isAiMode);
    updateToggleText();
}

function toggleTTS() {
    isTTSEnabled = document.getElementById('tts-checkbox').checked;
    localStorage.setItem('tama_tts_enabled', isTTSEnabled);
    if (!isTTSEnabled && currentAudio) currentAudio.pause();
    updateToggleText();
}

function updateToggleText() {
    const aiText = document.getElementById('ai-status-text');
    const ttsText = document.getElementById('tts-status-text');
    aiText.innerText = isAiMode ? "AI：ON" : "AI：OFF";
    aiText.style.background = isAiMode ? "#e8f5e9" : "#fff"; 
    ttsText.innerText = isTTSEnabled ? "読上：ON" : "読上：OFF";
    ttsText.style.background = isTTSEnabled ? "#e8f5e9" : "#fff";
}

// ▼▼▼ 音声入力の漢字・ひらがなバグを修正するフィルター ▼▼▼
function normalizePokemonName(text) {
    let t = text.replace(/人影/g, "ヒトカゲ")
                .replace(/不思議だね/g, "フシギダネ")
                .replace(/不思議そう/g, "フシギソウ")
                .replace(/不思議花/g, "フシギバナ")
                .replace(/玉魂/g, "タマタマ")
                .replace(/理沙/g, "リザード"); // リザードンと誤爆しないよう注意
    
    // ひらがなをすべてカタカナに変換する魔法のコード
    t = t.replace(/[\u3041-\u3096]/g, function(match) {
        return String.fromCharCode(match.charCodeAt(0) + 0x60);
    });
    return t;
}

function findPokemon(userText) {
    if (typeof POKE_DB === 'undefined') return [];
    const sortedDB = [...POKE_DB].sort((a, b) => b.name.length - a.name.length);
    let matches = [];
    let searchTarget = normalizePokemonName(userText); // ここでフィルターを通す！

    for (const p of sortedDB) {
        if (searchTarget.includes(p.name)) {
            matches.push(p);
            searchTarget = searchTarget.replace(p.name, ""); 
        }
    }
    return matches;
}

// ▼▼▼ 技ズレを完全に防ぐ「アンカー(碇)方式」ジェネレーター ▼▼▼
function createBeautifulCard(poke) {
    const pokeNum = parseInt(poke.no);
    const imgUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokeNum}.png`;

    const lines = poke.info.split('\n').map(l => l.trim()).filter(l => l !== "");
    
    let statsHtml = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; margin-top: 10px;">';
    let descHtml = '';
    let movesHtml = '';
    
    let currentSection = 'basic';
    let moveBuffer = [];
    const typesList = ["ノーマル","ほのお","みず","でんき","くさ","こおり","かくとう","どく","じめん","ひこう","エスパー","むし","いわ","ゴースト","ドラゴン","はがね","あく"];
    
    for (let i = 0; i < lines.length; i++) {
        let l = lines[i];
        
        if (l === poke.name || l === "No" || l === poke.no || l === "ポケモン図鑑絵" || l === "戻る" || l === "1" || l.includes("All rights reserved") || l.includes("Present by")) continue;
        if (l === "説明") { currentSection = 'desc'; continue; }
        if (l === "種族値") { currentSection = 'stats'; continue; }
        
        // 技セクションの開始
        if (l.includes("覚えるわざ") || l.includes("ひでんマシン") || l.includes("教えてもらえる")) {
            currentSection = 'moves';
            moveBuffer = [];
            movesHtml += `<div style="background:#222; color:#fff; padding:6px 10px; margin:20px 0 10px; font-weight:bold; border-radius:4px; font-size:14px;">${l}</div>`;
            continue;
        }

        // 基本データ・種族値のバッジ化
        if (currentSection === 'stats' || currentSection === 'basic') {
            if (i + 1 < lines.length && lines[i].length <= 15 && lines[i+1].length <= 30 && !lines[i+1].includes("わざ") && lines[i+1] !== "説明" && lines[i+1] !== "種族値") {
                statsHtml += `
                <div style="background:#fff; border: 1px solid #ddd; border-left:4px solid #e74c3c; padding:6px; border-radius:4px; box-shadow:1px 1px 2px rgba(0,0,0,0.05);">
                    <div style="font-size:10px; color:#888; margin-bottom:2px;">${l}</div>
                    <div style="font-size:13px; font-weight:bold; color:#222;">${lines[i+1]}</div>
                </div>`;
                i++;
            }
        } 
        // 説明文
        else if (currentSection === 'desc') {
            if (l !== "ファイアレッド" && l !== "リーフグリーン" && l !== "説明") {
                 descHtml += `<div style="font-size:13px; margin-bottom:8px; padding:8px 12px; background:#e8f5e9; border-left:4px solid #1976d2; border-radius:4px; color:#0d47a1; line-height:1.5;">${l.replace(/　/g, '')}</div>`;
            }
        } 
        // ▼ ズレない技カード生成
        else if (currentSection === 'moves') {
            // 見出し行はスキップ
            if (["レベル", "わざ名", "タイプ", "威力", "命中", "PP", "効果", "マシンNo"].includes(l)) continue;
            
            moveBuffer.push(l);
            
            // バッファの中に「タイプ（ほのお等）」が含まれているか探す
            let typeIdx = moveBuffer.findIndex(x => typesList.includes(x));
            
            // タイプが見つかり、かつその後ろに「威力・命中・PP・効果」の4つが揃ったらカード化！
            if (typeIdx >= 1 && moveBuffer.length >= typeIdx + 5) {
                let name = moveBuffer[typeIdx - 1];
                let level = typeIdx >= 2 ? moveBuffer.slice(0, typeIdx - 1).join(" ") : "-";
                if(level.length > 15) level = level.split(" ").pop(); // ゴミ回避
                
                let type = moveBuffer[typeIdx];
                let power = moveBuffer[typeIdx + 1];
                let acc = moveBuffer[typeIdx + 2];
                let pp = moveBuffer[typeIdx + 3];
                let eff = moveBuffer[typeIdx + 4];
                
                let tColor = "#555";
                if(type==="ほのお") tColor="#e74c3c";
                else if(type==="みず") tColor="#3498db";
                else if(type==="くさ") tColor="#2ecc71";
                else if(type==="でんき") tColor="#f1c40f";
                
                movesHtml += `
                <div style="background:#fff; border:1px solid #ddd; border-left:4px solid ${tColor}; border-radius:4px; padding:8px; margin-bottom:6px; box-shadow:1px 1px 2px rgba(0,0,0,0.05);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <span><span style="color:#888; font-size:11px; margin-right:6px;">${level}</span><strong style="font-size:14px; color:#222;">${name}</strong></span>
                        <span style="background:${tColor}; color:#fff; font-size:10px; padding:2px 6px; border-radius:10px;">${type}</span>
                    </div>
                    <div style="font-size:11px; color:#e74c3c; margin-bottom:4px;">威力:${power} / 命中:${acc} / PP:${pp}</div>
                    <div style="font-size:11px; color:#555;">${eff}</div>
                </div>`;
                
                moveBuffer = []; // 次の技のためにリセット
            }
            // エラー文が混ざっていた場合の処理
            else if (moveBuffer.length > 0 && moveBuffer[moveBuffer.length-1].includes("登録されていない技")) {
                movesHtml += `<div style="color:#e74c3c; font-size:11px; margin-bottom:6px;">※ ${moveBuffer[moveBuffer.length-1]}</div>`;
                moveBuffer = [];
            }
        }
    }
    statsHtml += '</div>';
    
    return `
    <div class="data-card" style="display:flex; flex-direction:column; box-shadow: 2px 2px 5px rgba(0,0,0,0.5);">
        <div class="data-card-header" style="display:flex; justify-content:space-between; background: #222; color: #fff; padding: 10px;">
            <span>No.${poke.no} ${poke.name}</span>
            <span style="font-size:10px; opacity: 0.8;">DB抽出完了</span>
        </div>
        <div style="display:flex; flex-wrap:wrap; padding:15px; background:radial-gradient(circle, #fff 0%, #f0f0f0 100%); gap:15px; border-bottom:2px solid #222;">
            <div style="flex: 0 0 120px; display:flex; justify-content:center; align-items:center;">
                <img src="${imgUrl}" style="width:120px; height:120px; object-fit:contain; filter:drop-shadow(2px 4px 4px rgba(0,0,0,0.3));">
            </div>
            <div style="flex: 1; min-width:180px; align-self: center;">
                ${descHtml}
            </div>
        </div>
        <div style="padding:15px; max-height:450px; overflow-y:auto; background:#fafafa; border-bottom-left-radius: 5px; border-bottom-right-radius: 5px;">
            ${statsHtml}
            ${movesHtml}
        </div>
    </div>`;
}

function linkify(text) {
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlPattern, '<br><a href="$1" target="_blank" class="search-link">🔗 詳しく見る</a>');
}

async function speakText(text) {
    if (!isTTSEnabled) return;
    if (currentAudio) currentAudio.pause();
    let cleanText = text.replace(/https?:\/\/[^\s]+/g, "。参考サイトを確認してたま！").replace(/[*#_`]/g, ""); 
    const apiUrl = `https://api.tts.quest/v3/voicevox/synthesis?speaker=13&text=${encodeURIComponent(cleanText)}`;
    try {
        currentAudio = new Audio(apiUrl);
        currentAudio.play();
    } catch (e) { console.error("TTSエラー:", e); }
}

function initMic() {
    if (!('webkitSpeechRecognition' in window)) { alert("音声入力非対応だたま！"); return; }
    recognition = new webkitSpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.onstart = () => {
        isRecording = true;
        if (currentAudio) currentAudio.pause();
        seStart.play().catch(e => {});
        document.getElementById('mic-btn').classList.add('active');
        document.getElementById('mic-status').innerText = "聞き取り中...";
    };
    recognition.onresult = (e) => {
        document.getElementById('chat-input').value = e.results[0][0].transcript;
        askPokemonAI();
    };
    recognition.onend = () => stopMic();
    recognition.start();
}
function toggleMic() { if (isRecording) recognition.stop(); else initMic(); }
function stopMic() { isRecording = false; document.getElementById('mic-btn').classList.remove('active'); document.getElementById('mic-status').innerText = "タップして話す"; }

// ▼▼▼ メインロジック ▼▼▼
async function askPokemonAI() {
    const inputEl = document.getElementById('chat-input');
    const rawText = inputEl.value.trim();
    if (!rawText) return;

    const chatBox = document.getElementById('chat-messages');
    chatBox.innerHTML += `<div class="msg user"><div class="text">${rawText}</div></div>`;
    inputEl.value = '';
    
    const directMatches = findPokemon(rawText);
    
    // ⚡ 【AI：OFF】 ⚡
    if (!isAiMode && directMatches.length > 0) {
        seReceive.play().catch(e => {});
        directMatches.forEach(p => {
            chatBox.innerHTML += createBeautifulCard(p);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
        return; 
    }

    // 💬 【AI：ON】幻覚防止プロンプト追加 💬
    const loadingId = "L-" + Date.now();
    chatBox.innerHTML += `<div id="${loadingId}" class="msg bot"><img src="tamachan.png" class="avatar"><div class="text">解析中だたま...🔍</div></div>`;
    chatBox.scrollTop = chatBox.scrollHeight;

    let cheatSheet = directMatches.length > 0 ? directMatches.map(p => `【${p.name}】\n${p.info}`).join("\n\n") : lastCheatSheet;
    if (cheatSheet) lastCheatSheet = cheatSheet;

    // AIに「嘘をつくな」と強く命令する
    const aiSystemPrompt = `
あなたはポケモンのガチ勢アシスタント「たまちゃん」だたま。
【厳守ルール】
1. 以下の=== カンペ ===にあるデータのみを「絶対の事実」として扱いなさい。
2. カンペにない技（れいとうビームなど）は、絶対に「覚える」と言ってはいけません。「その技は覚えないたま！」と正しなさい。推測で適当な情報をでっち上げるのは厳禁です。
3. 語尾は「〜だたま！」
4. 第3世代(FRLG)の仕様です。
`;

    const fullPrompt = `${aiSystemPrompt}\n\n=== カンペ ===\n${cheatSheet || "データが見つからないたま！"}\n\n=== 質問 ===\n${rawText}`;

    try {
        const res = await fetch(gasUrl, { method: "POST", body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] }) });
        const data = await res.json();
        let reply = data.candidates[0].content.parts[0].text;
        
        document.getElementById(loadingId).remove();
        
        chatBox.innerHTML += `
            <div class="msg bot">
                <img src="tamachan.png" class="avatar">
                <div class="text">${linkify(reply)}</div>
            </div>`;
        chatBox.scrollTop = chatBox.scrollHeight;
        
        if (isTTSEnabled) {
            seReceive.play().catch(e => {});
            speakText(reply);
        }
    } catch (e) {
        document.getElementById(loadingId).innerText = "通信エラーだたま！";
    }
}
