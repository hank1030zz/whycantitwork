// Firebase 配置
const firebaseConfig = {
  apiKey: "AIzaSyDc-M2Ss55wLmfZUkv0A1EU7aR13nvbuTA",
  authDomain: "testing2-dfb04.firebaseapp.com",
  databaseURL: "https://testing2-dfb04-default-rtdb.firebaseio.com",
  projectId: "testing2-dfb04",
  storageBucket: "testing2-dfb04.firebasestorage.app",
  messagingSenderId: "623840782993",
  appId: "1:623840782993:web:95812056bb71642916ad30",
  measurementId: "G-EY7PHY3HT1"
};

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const playersRef = database.ref('players'); // 用於儲存玩家數據的引用

let playerName = "";
let unlockedLevels = [1]; // 初始只解鎖第 1 關
let currentPlayingLevel = 0; // 記錄當前正在遊玩的關卡
let currentQuestions = []; // 儲存當前關卡的題目
let currentDragOptionsPool = []; // 儲存當前關卡所有可拖曳選項的原始池
let playerTotalCorrectAnswers = 0; // 追蹤玩家總共答對的題目數
let playerMaxCompletedLevel = 0; // 追蹤玩家實際完成的最高關卡數

// 遊戲題目資料庫
const gameLevels = {
  1: {
    title: "關卡 1：布林入門",
    questions: [
      { id: 'q1', text: "1 代表「真」嗎？", answer: "O" },
      { id: 'q2', text: "¬ 是代表「或（OR）」的意思？", answer: "X" },
      { id: 'q3', text: "∧ 是 AND 嗎？", answer: "O" },
      { id: 'q4', text: "0 表示「假」或 False 嗎？", answer: "O" },
      { id: 'q5', text: "1 ∨ 0 = ?", answer: "1" },
      { id: 'q6', text: "¬1 = ?", answer: "0(zero)" } // 修改答案
    ],
    dragOptions: ["O", "X", "0(zero)", "1"] // 修改選項
  },
  2: {
    title: "關卡 2：邏輯交錯",
    questions: [
      { id: 'q1', text: "1 ∧ 1 = ?", answer: "1" },
      { id: 'q2', text: "0 ∧ 1 = ?", answer: "0(zero)" }, // 修改答案
      { id: 'q3', text: "1 ∨ 0 = ?", answer: "1" },
      { id: 'q4', text: "¬0 = ?", answer: "1" },
      { id: 'q5', text: "若 a = 1，b = 0，則 a ∧ b = 0？", answer: "O" },
      { id: 'q6', text: "若 a = 0，b = 1，則 a ∨ b = 0？", answer: "X" }
    ],
    dragOptions: ["O", "X", "0(zero)", "1"] // 修改選項
  },
  3: {
    title: "關卡 3：邏輯魔王戰",
    questions: [
      { id: 'q1', text: "a ∨ (a ∧ b) = a 使用了哪個法則？", answer: "吸收律" },
      { id: 'q2', text: "a ∧ ¬a = ?", answer: "0(zero)" }, // 修改答案
      { id: 'q3', text: "¬(¬a) = ?", answer: "a" },
      { id: 'q4', text: "a ∧ 1 = ?", answer: "a" },
      { id: 'q5', text: "a ∨ 0 = ?", answer: "a" },
      { id: 'q6', text: "a ∨ ¬a = ?", answer: "1" }
    ],
    dragOptions: ["吸收律", "互補律", "雙重否定律", "分配律", "恆等律", "0(zero)", "1", "a", "¬a"] // 修改選項
  }
};


function startGame() {
  const nameInput = document.getElementById("player-name");
  if (!nameInput.value.trim()) {
    alert("請輸入你的姓名！");
    return;
  }

  playerName = nameInput.value.trim();
  document.getElementById("start-screen").classList.add("hidden");
  document.getElementById("map-screen").classList.remove("hidden");
  document.getElementById("display-name").textContent = playerName;
  document.getElementById("knowledge-block").classList.remove("hidden"); // 確保知識區塊在地圖畫面顯示

  // 檢查玩家在 Firebase 中是否有記錄，如果沒有則初始化
  playersRef.child(playerName).once('value', (snapshot) => {
    if (!snapshot.exists()) {
      playerMaxCompletedLevel = 0; // 初始未破任何關卡
      playerTotalCorrectAnswers = 0;
      playersRef.child(playerName).set({
        maxLevel: playerMaxCompletedLevel,
        totalCorrectAnswers: playerTotalCorrectAnswers
      });
    } else {
      const playerData = snapshot.val();
      playerMaxCompletedLevel = playerData.maxLevel || 0;
      playerTotalCorrectAnswers = playerData.totalCorrectAnswers || 0;

      // 根據玩家已完成的最高關卡來解鎖下一關
      unlockedLevels = [];
      for (let i = 1; i <= playerMaxCompletedLevel; i++) {
        unlockedLevels.push(i);
      }
      if (playerMaxCompletedLevel < 3) { // 如果未通關，將下一關解鎖
        unlockedLevels.push(playerMaxCompletedLevel + 1);
      }
    }
    updateCharacterPosition(playerMaxCompletedLevel + 1 > 3 ? 3 : playerMaxCompletedLevel + 1); // 將角色移動到已解鎖的最高關卡的下一關，如果已通關則停留在最終關
    updateLevelStyles();
  });
}

function selectLevel(level) {
  if (!unlockedLevels.includes(level)) {
    alert("你還沒有解鎖這個關卡！");
    return;
  }

  currentPlayingLevel = level;
  document.getElementById("map-screen").classList.add("hidden");
  document.getElementById("game-screen").classList.remove("hidden");
  document.getElementById("knowledge-block").classList.add("hidden"); // 進入關卡時隱藏知識區塊
  loadLevelQuestions(level);
}

function loadLevelQuestions(level) {
  const levelData = gameLevels[level];
  if (!levelData) {
    alert("找不到該關卡的題目！");
    return;
  }

  document.getElementById("level-title").textContent = levelData.title;
  const questionsContainer = document.getElementById("questions-container");
  questionsContainer.innerHTML = ''; // 清空舊題目

  // 隨機排列題目
  currentQuestions = shuffleArray([...levelData.questions]);
  currentDragOptionsPool = [...new Set(levelData.dragOptions)]; // 儲存原始選項池，用於無限生成

  currentQuestions.forEach(q => {
    const questionRow = document.createElement("div");
    questionRow.classList.add("question-row");
    questionRow.innerHTML = `
      <div class="question-text">${q.text}</div>
      <div class="drop-target" data-question-id="${q.id}" ondragover="allowDrop(event)" ondrop="drop(event)"></div>
    `;
    questionsContainer.appendChild(questionRow);
  });

  // 初始化拖曳選項
  populateDragOptions();
}

function populateDragOptions() {
  const dragOptionsContainer = document.getElementById("drag-options-container");
  dragOptionsContainer.innerHTML = ''; // 清空舊選項

  // 為了確保足夠選項，生成多個副本，例如每個選項生成 3 倍的量
  const optionsToGenerateMultiplier = 3;
  let optionsToPopulate = [];
  currentDragOptionsPool.forEach(option => {
    for (let i = 0; i < optionsToGenerateMultiplier; i++) {
      optionsToPopulate.push(option);
    }
  });

  const shuffledOptions = shuffleArray(optionsToPopulate);

  shuffledOptions.forEach(optionText => {
    const dragItem = document.createElement("div");
    dragItem.classList.add("drag-item");
    dragItem.setAttribute("draggable", "true");
    dragItem.setAttribute("ondragstart", `drag(event, '${optionText}')`);
    dragItem.textContent = optionText;
    dragOptionsContainer.appendChild(dragItem);
  });
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}


// --- 拖曳事件處理 ---
function drag(event, data) {
  event.dataTransfer.setData("text/plain", data);
}

function allowDrop(event) {
  event.preventDefault(); // 允許放置
}

function drop(event) {
  event.preventDefault();
  const data = event.dataTransfer.getData("text/plain");
  const dropTarget = event.target;

  // 確保放置在正確的目標上，且該目標目前為空
  if (dropTarget.classList.contains('drop-target') && dropTarget.textContent.trim() === "") {
    dropTarget.textContent = data;
    dropTarget.classList.add('filled');
  }
}

// --- 答案檢查邏輯 ---
function checkAnswers() {
  let currentLevelCorrectCount = 0;
  const dropTargets = document.querySelectorAll(".drop-target");

  let allQuestionsAnswered = true;
  dropTargets.forEach(target => {
    if (target.textContent.trim() === "") {
      allQuestionsAnswered = false;
    }
  });

  if (!allQuestionsAnswered) {
      alert("請完成所有配對再提交答案！");
      return;
  }

  // 檢查正確答案
  dropTargets.forEach(target => {
    const questionId = target.dataset.questionId;
    const userAnswer = target.textContent.trim();
    const question = currentQuestions.find(q => q.id === questionId);

    if (question && userAnswer === question.answer) {
      currentLevelCorrectCount++;
      target.style.backgroundColor = '#d4edda'; // 答對變綠
    } else {
      target.style.backgroundColor = '#f8d7da'; // 答錯變紅
    }
  });


  if (currentLevelCorrectCount === currentQuestions.length) {
    alert(`恭喜你，${playerName}！你答對了所有題目，本關卡完成！`);
    playerTotalCorrectAnswers += currentQuestions.length; // 更新玩家總答對題目數
    
    // 更新玩家已完成的最高關卡
    if (currentPlayingLevel > playerMaxCompletedLevel) {
        playerMaxCompletedLevel = currentPlayingLevel;
    }
    
    unlockNextLevel(currentPlayingLevel); // 解鎖下一關

    // 更新 Firebase 數據
    playersRef.child(playerName).update({
      maxLevel: playerMaxCompletedLevel, // 記錄玩家實際完成的最高關卡
      totalCorrectAnswers: playerTotalCorrectAnswers
    }).catch(error => {
      console.error("Firebase update failed:", error);
    });

    // 判斷是否為最終關卡，如果是則顯示遊戲結束訊息
    if (currentPlayingLevel === 3) {
      alert(`恭喜 ${playerName}！你成功挑戰了所有邏輯迷宮關卡！遊戲結束！`);
      setTimeout(goBackToMap, 2500); // 延遲後回到地圖
    } else {
      updateCharacterPosition(currentPlayingLevel + 1); // 角色移動到下一關
      setTimeout(goBackToMap, 1500); // 1.5秒後返回地圖
    }
  } else {
    alert(`挑戰失敗，${playerName}！你答對了 ${currentLevelCorrectCount} / ${currentQuestions.length} 題。請再試一次！`);
    // 清空放置區的答案並恢復背景色，讓玩家重新嘗試
    dropTargets.forEach(target => {
      target.textContent = ""; // 清空答案
      target.classList.remove('filled');
      target.style.backgroundColor = ''; // 恢復背景色
    });
    // 不需要重新 populateDragOptions，因為選項一直在那裡
  }
}

function goBackToMap() {
  document.getElementById("game-screen").classList.add("hidden");
  document.getElementById("leaderboard-screen").classList.add("hidden"); // 確保排行榜畫面也被隱藏
  document.getElementById("map-screen").classList.remove("hidden");
  document.getElementById("knowledge-block").classList.remove("hidden"); // 返回地圖時顯示知識區塊
  updateLevelStyles(); // 重新渲染地圖上的鎖定/解鎖狀態
  
  // 角色回到當前已完成的最高關卡或下一關的起點
  updateCharacterPosition(playerMaxCompletedLevel + 1 > 3 ? 3 : playerMaxCompletedLevel + 1);
}

function unlockNextLevel(currentLevel) {
  const nextLevel = currentLevel + 1;
  if (nextLevel <= 3 && !unlockedLevels.includes(nextLevel)) {
    unlockedLevels.push(nextLevel);
  }
}

function updateCharacterPosition(level) {
  const levels = [1, 2, 3];
  levels.forEach(lvl => {
    const elem = document.getElementById(`level${lvl}`);
    const marker = elem.querySelector(".player-marker");
    if (marker) {
      marker.remove();
    }
  });

  // 只在已解鎖的最高關卡顯示角色標記 (或通關後顯示在最終關卡)
  if (level >= 1 && level <= 3) {
    const marker = document.createElement("div");
    marker.classList.add("player-marker");
    marker.innerHTML = `🧝‍♀️<div>${playerName}</div>`;

    const target = document.getElementById(`level${level}`);
    if (target) {
      target.appendChild(marker);
    }
  }
}

function updateLevelStyles() {
  const levels = [1, 2, 3];
  levels.forEach(lvl => {
    const elem = document.getElementById(`level${lvl}`);
    if (unlockedLevels.includes(lvl)) {
      elem.classList.add("unlocked");
      elem.classList.remove("locked");
    } else {
      elem.classList.add("locked");
      elem.classList.remove("unlocked");
    }
  });
}

// --- 排行榜功能 ---
function showLeaderboard() {
  document.getElementById("map-screen").classList.add("hidden");
  document.getElementById("game-screen").classList.add("hidden"); // 確保遊戲畫面也被隱藏
  document.getElementById("knowledge-block").classList.add("hidden"); // 隱藏知識區塊
  document.getElementById("leaderboard-screen").classList.remove("hidden");
  loadLeaderboard();
}

function loadLeaderboard() {
  const leaderboardList = document.getElementById("leaderboard-list");
  leaderboardList.innerHTML = '<p>載入中...</p>'; // 顯示載入中訊息

  playersRef.orderByChild('maxLevel').limitToLast(10).once('value', (snapshot) => {
    const players = [];
    snapshot.forEach(childSnapshot => {
      const player = childSnapshot.val();
      player.name = childSnapshot.key; // 玩家名稱是 key
      players.push(player);
    });

    // 根據破關等級降序排列，如果等級相同，則根據總答對題目數降序排列
    players.sort((a, b) => {
      if (b.maxLevel !== a.maxLevel) {
        return b.maxLevel - a.maxLevel;
      }
      return b.totalCorrectAnswers - a.totalCorrectAnswers;
    });

    leaderboardList.innerHTML = ''; // 清空載入中訊息

    if (players.length === 0) {
      leaderboardList.innerHTML = '<p>目前沒有排行榜數據。</p>';
      return;
    }

    players.forEach((player, index) => {
      const playerEntry = document.createElement('div');
      playerEntry.innerHTML = `
        <span class="player-rank">${index + 1}.</span>
        <span class="player-name">${player.name}</span>
        <span class="player-stats">破關：${player.maxLevel} / 3 | 答對關卡內：${player.totalCorrectAnswers} 題</span>
      `;
      leaderboardList.appendChild(playerEntry);
    });
  });
}

function goBackToMapFromLeaderboard() {
  document.getElementById("leaderboard-screen").classList.add("hidden");
  document.getElementById("map-screen").classList.remove("hidden");
  document.getElementById("knowledge-block").classList.remove("hidden"); // 返回地圖時顯示知識區塊
}