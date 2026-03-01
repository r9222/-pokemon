// poke-ai.js
const gasUrl = "https://script.google.com/macros/s/AKfycbwBmtIRAwPZMoI2TPNd5si6kJaNltdZNypwlL9YKMmw1KKn4Yn7Loi2pkwfc6PoKjV20A/exec";

let pokeChatHistory = [];
let lastCheatSheet = "";
let recognition;
let isRecording = false;

// アプリ強制アップデート
function forceUpdateApp() {
    if (confirm("サーバーから最新の攻略データを読み込むたま！\nよろしいだたま？")) {
        if ('serviceWorker' in navigator) {
            caches.keys().then((keyList) => Promise.all(keyList.map((key) => caches.delete(key))))
            .then(() => {
                navigator.serviceWorker.getRegistrations().then((registrations) => {
                    for(let registration of registrations) registration.unregister();
                    window.location.reload(true);
                });
            });
        } else window.location.reload(true);
    }
}

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

function fixVoiceInput(text) {
    return text.replace(/人影/g, "ヒトカゲ")
               .replace(/不思議だね|ふしぎだね/g, "フシギダネ")
               .replace(/不思議そう|ふしぎそう/g, "フシギソウ")
               .replace(/不思議花|ふしぎばな/g, "フシギバナ")
               .replace(/玉魂|たまたま/g, "タマタマ")
               .replace(/理沙/g, "リザード")
               .replace(/冷凍ビーム|れいとうびーむ/g, "れいとうビーム")
               .replace(/冷凍パンチ/g, "れいとうパンチ")
               .replace(/十万ボルト|10万ボルト/g, "10まんボルト")
               .replace(/火炎放射/g, "かえんほうしゃ")
               .replace(/破壊光線/g, "はかいこうせん")
               .replace(/波乗り/g, "なみのり")
               .replace(/空を飛ぶ/g, "そらをとぶ")
               .replace(/自己再生/g, "じこさいせい")
               .replace(/大文字/g, "だいもんじ")
               .replace(/電光石火/g, "でんこうせっか")
               .replace(/怪力/g, "かいりき")
               .replace(/地震/g, "じしん")
               .replace(/吹雪/g, "ふぶき")
               .replace(/雷/g, "かみなり")
               .replace(/影分身/g, "かげぶんしん")
               .replace(/恩返し/g, "おんがえし")
               .replace(/穴を掘る/g, "あなをほる")
               .replace(/眠る/g, "ねむる")
               .replace(/剣の舞/g, "つるぎのまい")
               .replace(/毒々|毒毒/g, "どくどく")
               .replace(/突進/g, "とっしん")
               .replace(/超音波/g, "ちょうおんぱ")
               .replace(/気合パンチ|気合いパンチ/g, "きあいパンチ")
               .replace(/嫌な音/g, "いやなおと")
               .replace(/日本晴れ/g, "にほんばれ")
               .replace(/雨乞い/g, "あまごい")
               .replace(/自己暗示/g, "じこあんじ");
}

function findPokemon(userText) {
    if (typeof POKE_DB === 'undefined') return [];
    const sortedDB = [...POKE_DB].sort((a, b) => b.name.length - a.name.length);
    let matches = [];
    let searchTarget = userText.replace(/[\u3041-\u3096]/g, function(match) {
        return String.fromCharCode(match.charCodeAt(0) + 0x60);
    });

    for (const p of sortedDB) {
        if (searchTarget.includes(p.name)) {
            matches.push(p);
            searchTarget = searchTarget.replace(p.name, ""); 
        }
    }
    return matches;
}

let ALL_MOVES_CACHE = null;
function extractAllMoves() {
    if (ALL_MOVES_CACHE) return ALL_MOVES_CACHE;
    let moves = new Set();
    const typesList = ["ノーマル","ほのお","みず","でんき","くさ","こおり","かくとう","どく","じめん","ひこう","エスパー","むし","いわ","ゴースト","ドラゴン","はがね","あく","？？？"];
    for (const poke of POKE_DB) {
        const lines = poke.info.split('\n').map(l => l.trim());
        for (let i = 0; i < lines.length; i++) {
            if (typesList.includes(lines[i]) && i > 0 && i + 4 < lines.length) {
                let moveName = lines[i-1];
                if(moveName.length >= 2 && !moveName.includes(" ") && !moveName.includes("レベル")) {
                    moves.add(moveName);
                }
            }
        }
    }
    ALL_MOVES_CACHE = Array.from(moves).sort((a,b) => b.length - a.length);
    return ALL_MOVES_CACHE;
}

function searchMoveInfo(userText) {
    if (typeof POKE_DB === 'undefined') return null;
    
    const allMoves = extractAllMoves();
    let targetMove = null;
    
    for (const m of allMoves) {
        if (userText.includes(m)) {
            targetMove = m;
            break;
        }
    }

    if (!targetMove) return null; 

    let moveData = null;
    let learningPokemons = [];
    const typesList = ["ノーマル","ほのお","みず","でんき","くさ","こおり","かくとう","どく","じめん","ひこう","エスパー","むし","いわ","ゴースト","ドラゴン","はがね","あく","？？？"];
    
    for (const poke of POKE_DB) {
        const lines = poke.info.split('\n').map(l => l.trim());
        let idx = lines.indexOf(targetMove);
        
        if (idx !== -1 && idx + 5 < lines.length) {
            const type = lines[idx+1];
            if (typesList.includes(type)) {
                if (!moveData) { 
                    moveData = {
                        name: targetMove,
                        type: type,
                        power: lines[idx+2],
                        acc: lines[idx+3],
                        pp: lines[idx+4],
                        effect: lines[idx+5]
                    };
                }
                learningPokemons.push(poke.name); 
            }
        }
    }
    
    if (moveData) {
        const uniquePokemons = [...new Set(learningPokemons)];
        return `【技データ】\n技名: ${moveData.name}\nタイプ: ${moveData.type}\n威力: ${moveData.power}\n命中: ${moveData.acc}\nPP: ${moveData.pp}\n効果: ${moveData.effect}\n\n【この技を覚える代表的なポケモン】\n${uniquePokemons.slice(0, 10).join("、")} など`;
    }
    return null;
}

function formatInfoForAI(infoText) {
    const lines = infoText.split('\n').map(l => l.trim()).filter(l => l !== "");
    let cleanText = "";
    let currentSection = "";
    let moveBuffer = [];
    const typesList = ["ノーマル","ほのお","みず","でんき","くさ","こおり","かくとう","どく","じめん","ひこう","エスパー","むし","いわ","ゴースト","ドラゴン","はがね","あく","？？？"];
    
    for (let i = 0; i < lines.length; i++) {
        let l = lines[i];
        if (l.includes("All rights reserved") || l.includes("Present by") || l === "戻る") continue;
        
        if (l.includes("覚えるわざ") || l.includes("ひでんマシン") || l.includes("教えてもらえる")) {
            currentSection = 'moves';
            cleanText += `\n[${l}]\n`;
            moveBuffer = [];
            continue;
        }
        if (l === "説明" || l === "種族値") { currentSection = 'stats'; cleanText += `\n[${l}]\n`; continue; }
        
        if (currentSection === 'moves') {
            if (["レベル", "わざ名", "タイプ", "威力", "命中", "PP", "効果", "マシンNo"].includes(l)) continue;
            if (l.includes("登録されていない技")) { moveBuffer = []; continue; } 

            moveBuffer.push(l);
            let typeIdx = moveBuffer.findIndex(x => typesList.includes(x));
            if (typeIdx >= 1 && moveBuffer.length >= typeIdx + 5) {
                let name = moveBuffer[typeIdx - 1];
                let level = typeIdx >= 2 ? moveBuffer.slice(0, typeIdx - 1).join(" ") : "-";
                if(level.length > 10) level = level.split(" ").pop(); 
                cleanText += `・${name} (条件:${level}, タイプ:${moveBuffer[typeIdx]}, 威力:${moveBuffer[typeIdx + 1]})\n`;
                moveBuffer = [];
            }
        } else {
            if (i + 1 < lines.length && lines[i].length <= 10 && lines[i+1].length <= 20 && !lines[i+1].includes("わざ")) {
                cleanText += `${l}: ${lines[i+1]}\n`;
                i++;
            } else { cleanText += `${l}\n`; }
        }
    }
    return cleanText;
}

function createBeautifulCard(poke) {
    const pokeNum = parseInt(poke.no);
    const imgUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokeNum}.png`;

    const lines = poke.info.split('\n').map(l => l.trim()).filter(l => l !== "");
    let statsHtml = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; margin-top: 10px;">';
    let descHtml = '';
    let movesHtml = '';
    
    let currentSection = 'basic';
    let moveBuffer = [];
    const typesList = ["ノーマル","ほのお","みず","でんき","くさ","こおり","かくとう","どく","じめん","ひこう","エスパー","むし","いわ","ゴースト","ドラゴン","はがね","あく","？？？"];
    
    for (let i = 0; i < lines.length; i++) {
        let l = lines[i];
        if (l === poke.name || l === "No" || l === poke.no || l === "ポケモン図鑑絵" || l === "戻る" || l === "1" || l.includes("All rights reserved") || l.includes("Present by")) continue;
        if (l === "説明") { currentSection = 'desc'; continue; }
        if (l === "種族値") { currentSection = 'stats'; continue; }
        
        if (l.includes("覚えるわざ") || l.includes("ひでんマシン") || l.includes("教えてもらえる")) {
            currentSection = 'moves';
            moveBuffer = [];
            movesHtml += `<div style="background:#222; color:#fff; padding:6px 10px; margin:20px 0 10px; font-weight:bold; border-radius:4px; font-size:14px;">${l}</div>`;
            continue;
        }

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
        else if (currentSection === 'desc') {
            if (l !== "ファイアレッド" && l !== "リーフグリーン" && l !== "説明") {
                 descHtml += `<div style="font-size:13px; margin-bottom:8px; padding:8px 12px; background:#e8f5e9; border-left:4px solid #1976d2; border-radius:4px; color:#0d47a1; line-height:1.5;">${l.replace(/　/g, '')}</div>`;
            }
        } 
        else if (currentSection === 'moves') {
            if (["レベル", "わざ名", "タイプ", "威力", "命中", "PP", "効果", "マシンNo"].includes(l)) continue;
            
            if (l.includes("登録されていない技")) {
                let badMove = moveBuffer.length > 0 ? moveBuffer[moveBuffer.length - 1] : "不明な技";
                movesHtml += `<div style="color:#c0392b; font-size:11px; margin-bottom:6px; background:#fadbd8; padding:4px; border-radius:4px;">※ [${badMove}] はデータベース欠損だたま！</div>`;
                moveBuffer = [];
                continue;
            }

            moveBuffer.push(l);
            let typeIdx = moveBuffer.findIndex(x => typesList.includes(x));
            
            if (typeIdx >= 1 && moveBuffer.length >= typeIdx + 5) {
                let name = moveBuffer[typeIdx - 1];
                let level = typeIdx >= 2 ? moveBuffer.slice(0, typeIdx - 1).join(" ") : "-";
                if(level.length > 15) level = level.split(" ").pop(); 
                
                let type = moveBuffer[typeIdx];
                let power = moveBuffer[typeIdx + 1];
                let acc = moveBuffer[typeIdx + 2];
                let pp = moveBuffer[typeIdx + 3];
                let eff = moveBuffer[typeIdx + 4];
                
                let tColor = "#555";
                if(type==="ほのお") tColor="#e74c3c";
                else if(type==="みず" || type==="こおり") tColor="#3498db";
                else if(type==="くさ") tColor="#2ecc71";
                else if(type==="でんき") tColor="#f1c40f";
                else if(type==="エスパー" || type==="どく") tColor="#9b59b6";
                else if(type==="じめん" || type==="いわ" || type==="かくとう") tColor="#e67e22";
                
                movesHtml += `
                <div style="background:#fff; border:1px solid #ddd; border-left:4px solid ${tColor}; border-radius:4px; padding:8px; margin-bottom:6px; box-shadow:1px 1px 2px rgba(0,0,0,0.05);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <span><span style="color:#888; font-size:11px; margin-right:6px;">${level}</span><strong style="font-size:14px; color:#222;">${name}</strong></span>
                        <span style="background:${tColor}; color:#fff; font-size:10px; padding:2px 6px; border-radius:10px;">${type}</span>
                    </div>
                    <div style="font-size:11px; color:#e74c3c; margin-bottom:4px;">威力:${power} / 命中:${acc} / PP:${pp}</div>
                    <div style="font-size:11px; color:#555;">${eff}</div>
                </div>`;
                moveBuffer = []; 
            }
        }
    }
    statsHtml += '</div>';
    
    // ★ iOSのスクロールバグ対策として、overscroll-behavior-y: contain; と touch-action: pan-y; と position: relative; z-index: 1; を追加 ★
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
        <div style="padding:15px; max-height:450px; overflow-y:auto; overscroll-behavior-y: contain; touch-action: pan-y; -webkit-overflow-scrolling: touch; position: relative; z-index: 1; background:#fafafa; border-bottom-left-radius: 5px; border-bottom-right-radius: 5px;">
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
    let rawText = inputEl.value.trim();
    if (!rawText) return;

    rawText = fixVoiceInput(rawText);

    const chatBox = document.getElementById('chat-messages');
    
    const userMsgId = "msg-" + Date.now();
    chatBox.innerHTML += `<div id="${userMsgId}" class="msg user"><div class="text">${rawText}</div></div>`;
    inputEl.value = '';
    
    const directMatches = findPokemon(rawText);
    let moveInfo = null;

    if (directMatches.length === 0) {
        moveInfo = searchMoveInfo(rawText);
    }
    
    if (!isAiMode) {
        seReceive.play().catch(e => {});
        if (directMatches.length > 0) {
            directMatches.forEach(p => { chatBox.innerHTML += createBeautifulCard(p); });
        } else if (moveInfo) {
            chatBox.innerHTML += `
            <div class="data-card" style="background:#fff; border-left:5px solid #f1c40f; padding:15px; font-size:13px; line-height:1.6; color:#222;">
                ${moveInfo.replace(/\n/g, '<br>')}
            </div>`;
        } else {
            chatBox.innerHTML += `<div class="data-card" style="padding:15px; color:#e74c3c;">データが見つからなかったたま…</div>`;
        }
        
        setTimeout(() => {
            const userMsgEl = document.getElementById(userMsgId);
            if (userMsgEl) {
                chatBox.scrollTo({
                    top: userMsgEl.offsetTop - 10,
                    behavior: 'smooth'
                });
            }
        }, 50);
        
        return; 
    }

    const loadingId = "L-" + Date.now();
    chatBox.innerHTML += `<div id="${loadingId}" class="msg bot"><img src="tamachan.png" class="avatar"><div class="text">解析中だたま...🔍</div></div>`;
    
    setTimeout(() => {
        const userMsgEl = document.getElementById(userMsgId);
        if (userMsgEl) {
            chatBox.scrollTo({
                top: userMsgEl.offsetTop - 10,
                behavior: 'smooth'
            });
        }
    }, 50);

    let cheatSheet = "";
    
    if (directMatches.length > 0) {
        cheatSheet = directMatches.map(p => `【${p.name}】\n${formatInfoForAI(p.info)}`).join("\n\n");
        lastCheatSheet = cheatSheet;
    } else if (moveInfo) {
        cheatSheet = moveInfo; 
        lastCheatSheet = cheatSheet;
    } else {
        cheatSheet = lastCheatSheet; 
    }

    const basePrompt = typeof SYSTEM_PROMPT !== 'undefined' ? SYSTEM_PROMPT : "あなたはポケモンガチ勢のたまちゃんです。語尾は「だたま」です。";
    const fullPrompt = `${basePrompt}\n\n=== カンペ ===\n${cheatSheet || "データが見つからないたま！"}\n\n=== 質問 ===\n${rawText}`;

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
            
        setTimeout(() => {
            const userMsgEl = document.getElementById(userMsgId);
            if (userMsgEl) {
                chatBox.scrollTo({
                    top: userMsgEl.offsetTop - 10,
                    behavior: 'smooth'
                });
            } else {
                chatBox.scrollTop = chatBox.scrollHeight;
            }
        }, 50);
        
        if (isTTSEnabled) {
            seReceive.play().catch(e => {});
            speakText(reply);
        }
    } catch (e) {
        document.getElementById(loadingId).innerText = "通信エラーだたま！";
    }
}
