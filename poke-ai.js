// poke-ai.js
const gasUrl = "https://script.google.com/macros/s/AKfycbwBmtIRAwPZMoI2TPNd5si6kJaNltdZNypwlL9YKMmw1KKn4Yn7Loi2pkwfc6PoKjV20A/exec";

let pokeChatHistory = [];
let lastCheatSheet = "";
let recognition;
let isRecording = false;

// 設定の復元
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

// 音声入力の「漢字バグ」を公式表記に全自動翻訳するフィルター
function fixVoiceInput(text) {
    return text.replace(/人影/g, "ヒトカゲ")
               .replace(/不思議だね/g, "フシギダネ")
               .replace(/不思議そう/g, "フシギソウ")
               .replace(/不思議花/g, "フシギバナ")
               .replace(/玉魂/g, "タマタマ")
               .replace(/理沙/g, "リザード")
               .replace(/冷凍ビーム/g, "れいとうビーム")
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
               .replace(/毒々/g, "どくどく");
}

function findPokemon(userText) {
    if (typeof POKE_DB === 'undefined') return [];
    const sortedDB = [...POKE_DB].sort((a, b) => b.name.length - a.name.length);
    let matches = [];
    
    // 検索用だけ、ひらがなをカタカナにして探しやすくする
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

// 美しいカードレイアウトジェネレーター
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
    let rawText = inputEl.value.trim();
    if (!rawText) return;

    // 音声入力の誤変換（漢字）を公式のひらがな・カタカナに一発翻訳
    rawText = fixVoiceInput(rawText);

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

    // 💬 【AI：ON】AIが自信を持って探せるように「肯定のルール」を追加！ 💬
    const loadingId = "L-" + Date.now();
    chatBox.innerHTML += `<div id="${loadingId}" class="msg bot"><img src="tamachan.png" class="avatar"><div class="text">解析中だたま...🔍</div></div>`;
    chatBox.scrollTop = chatBox.scrollHeight;

    let cheatSheet = directMatches.length > 0 ? directMatches.map(p => `【${p.name}】\n${p.info}`).join("\n\n") : lastCheatSheet;
    if (cheatSheet) lastCheatSheet = cheatSheet;

    // ★AIの脳内を調整（ちゃんと見つけたら教えるように指示）
    const aiSystemPrompt = `
あなたはポケモンのガチ勢アシスタント「たまちゃん」だたま。
以下の【絶対厳守のルール】に従って回答しなさい。

1. 以下の === カンペ === のデータだけを「唯一の事実」として読み取りなさい。事前の知識は一切使ってはいけません。
2. ユーザーから「○○の技は覚える？」等と聞かれたら、カンペのテキスト内（レベルアップ、わざマシン、タマゴわざ等）を隅々まで探しなさい。
3. 音声入力の仕様で「冷凍ビーム」や「十万ボルト」など漢字になっていても、柔軟に「れいとうビーム」「10まんボルト」のことだと推測して照らし合わせなさい。
4. 【カンペの中に技があった場合】：「覚えるたま！」と元気に肯定し、どのレベルや、どのわざマシンで覚えるかをカンペから抜き出して教えなさい。
5. 【カンペの中に本当にない場合】のみ、「その技は覚えないたま！」とキッパリ否定しなさい。
6. 語尾は必ず「〜だたま！」にすること。
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
