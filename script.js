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
const playersRef = database.ref('players');

let playerName = "";
let unlockedLevels = [1];
let currentPlayingLevel = 0;
let currentQuestions = [];
let currentDragOptionsPool = [];
let playerTotalCorrectAnswers = 0;
let playerMaxCompletedLevel = 0;

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
      { id: 'q6', text: "¬1 = ?", answer: "0(zero)" }
    ],
    dragOptions: ["O", "X", "0(zero)", "1"]
  },
  2: {
    title: "關卡 2：邏輯交錯",
    questions: [
      { id: 'q1', text: "1 ∧ 1 = ?", answer: "1" },
      { id: 'q2', text: "0 ∧ 1 = ?", answer: "0(zero)" },
      { id: 'q3', text: "1 ∨ 0 = ?", answer: "1" },
      { id: 'q4', text: "¬0 = ?", answer: "1" },
      { id: 'q5', text: "若 a = 1，b = 0，則 a ∧ b = 0？", answer: "O" },
      { id: 'q6', text: "若 a = 0，b = 1，則 a ∨ b = 0？", answer: "X" }
    ],
    dragOptions: ["O", "X", "0(zero)", "1"]
  },
  3: {
    title: "關卡 3：邏輯魔王戰",
    questions: [
      { id: 'q1', text: "a ∨ (a ∧ b) = a 使用了哪個法則？", answer: "吸收律" },
      { id: 'q2', text: "a ∧ ¬a = ?", answer: "0(zero)" },
      { id: 'q3', text: "¬(¬a) = ?", answer: "a" },
      { id: 'q4', text: "a ∧ 1 = ?", answer: "a" },
      { id: 'q5', text: "a ∨ 0 = ?", answer: "a" },
      { id: 'q6', text: "a ∨ ¬a = ?", answer: "1" }
    ],
    dragOptions: ["吸收律", "互補律", "雙重否定律", "分配律", "恆等律", "0(zero)", "1", "a", "¬a"]
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
  document.getElementById("knowledge-block").classList.remove("hidden");

  playersRef.child(playerName).once('value', (snapshot) => {
    if (!snapshot.exists()) {
      playerMaxCompletedLevel = 0;
      playerTotalCorrectAnswers = 0;
      playersRef.child(playerName).set({
        maxLevel: playerMaxCompletedLevel,
        totalCorrectAnswers: playerTotalCorrectAnswers
      });
    } else {
      const playerData = snapshot.val();
      playerMaxCompletedLevel = playerData.maxLevel || 0;
      playerTotalCorrectAnswers = playerData.totalCorrectAnswers || 0;

      unlockedLevels = [];
      for (let i = 1; i <= playerMaxCompletedLevel; i++) {
        unlockedLevels.push(i);
      }
      if (playerMaxCompletedLevel < 3) {
        unlockedLevels.push(playerMaxCompletedLevel + 1);
      }
    }
    updateCharacterPosition(playerMaxCompletedLevel + 1 > 3 ? 3 : playerMaxCompletedLevel + 1);
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
  document.getElementById("knowledge-block").classList.add("hidden");
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
  questionsContainer.innerHTML = '';

  currentQuestions = shuffleArray([...levelData.questions]);
  currentDragOptionsPool = [...new Set(levelData.dragOptions)];

  currentQuestions.forEach(q => {
    const questionRow = document.createElement("div");
    questionRow.classList.add("question-row");
    questionRow.innerHTML = `
      <div class="question-text">${q.text}</div>
      <div class="drop-target-wrapper">
        <div class="drop-target" data-question-id="${q.id}" ondragover="allowDrop(event)" ondrop="drop(event)"></div>
        <button class="cancel-button" onclick="resetDropTarget(this)">X</button>
      </div>
    `;
    questionsContainer.appendChild(questionRow);
  });

  populateDragOptions();
}

function populateDragOptions() {
  const dragOptionsContainer = document.getElementById("drag-options-container");
  dragOptionsContainer.innerHTML = '';

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
  // 如果是從 drop-target 拖曳出來的，則清除該 drop-target
  if (event.target.classList.contains('drop-target')) {
      event.target.textContent = "";
      event.target.classList.remove('filled');
      event.target.style.backgroundColor = '';
      // 隱藏取消按鈕
      event.target.nextElementSibling.style.visibility = 'hidden';
  }
}

function allowDrop(event) {
  event.preventDefault();
}

function drop(event) {
  event.preventDefault();
  const data = event.dataTransfer.getData("text/plain");
  const dropTarget = event.target;

  if (dropTarget.classList.contains('drop-target')) {
    // 如果目標已經有內容，先將其內容返回選項區 (可選，這裡簡化為直接覆蓋)
    // if (dropTarget.textContent.trim() !== "") {
    //     // 可在這裡重新生成被替換的選項到 dragOptionsContainer
    // }
    dropTarget.textContent = data;
    dropTarget.classList.add('filled');
    dropTarget.style.backgroundColor = ''; // 恢復預設背景色
    // 顯示取消按鈕
    dropTarget.nextElementSibling.style.visibility = 'visible';
  }
}

function resetDropTarget(buttonElement) {
    const dropTarget = buttonElement.previousElementSibling; // 獲取旁邊的 drop-target
    if (dropTarget && dropTarget.classList.contains('drop-target')) {
        const value = dropTarget.textContent.trim();
        if (value !== "") {
            // 可以選擇將該值重新加入到選項池中，如果需要的話
            // populateDragOptions(); // 簡單暴力地重新生成所有選項
            // 或者更精確地只添加這個值
            // const dragOptionsContainer = document.getElementById("drag-options-container");
            // const dragItem = document.createElement("div");
            // dragItem.classList.add("drag-item");
            // dragItem.setAttribute("draggable", "true");
            // dragItem.setAttribute("ondragstart", `drag(event, '${value}')`);
            // dragItem.textContent = value;
            // dragOptionsContainer.appendChild(dragItem);
        }
        dropTarget.textContent = "";
        dropTarget.classList.remove('filled');
        dropTarget.style.backgroundColor = '';
        buttonElement.style.visibility = 'hidden'; // 隱藏取消按鈕
    }
}


// --- 答案檢查邏輯 ---
function checkAnswers() {
  let currentLevelCorrectCount = 0;
  const dropTargets = document.querySelectorAll(".drop-target");
  let incorrectQuestions = [];

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

    if (question) {
      if (userAnswer === question.answer) {
        currentLevelCorrectCount++;
        target.style.backgroundColor = '#d4edda'; // 答對變綠
      } else {
        target.style.backgroundColor = '#f8d7da'; // 答錯變紅
        incorrectQuestions.push({ questionText: question.text, correctAnswer: question.answer });
      }
    }
  });


  if (currentLevelCorrectCount === currentQuestions.length) {
    alert(`恭喜你，${playerName}！你答對了所有題目，本關卡完成！`);
    playerTotalCorrectAnswers += currentQuestions.length;
    
    if (currentPlayingLevel > playerMaxCompletedLevel) {
        playerMaxCompletedLevel = currentPlayingLevel;
    }
    
    unlockNextLevel(currentPlayingLevel);

    playersRef.child(playerName).update({
      maxLevel: playerMaxCompletedLevel,
      totalCorrectAnswers: playerTotalCorrectAnswers
    }).catch(error => {
      console.error("Firebase update failed:", error);
    });

    if (currentPlayingLevel === 3) {
      alert(`恭喜 ${playerName}！你成功挑戰了所有邏輯迷宮關卡！遊戲結束！`);
      setTimeout(goBackToMap, 2500);
    } else {
      updateCharacterPosition(currentPlayingLevel + 1);
      setTimeout(goBackToMap, 1500);
    }
  } else {
    let errorMessage = `挑戰失敗，${playerName}！你答對了 ${currentLevelCorrectCount} / ${currentQuestions.length} 題。\n\n`;
    if (incorrectQuestions.length > 0) {
        errorMessage += "以下題目有誤：\n";
        incorrectQuestions.forEach(item => {
            errorMessage += `題目：「${item.questionText}」\n建議答案：「${item.correctAnswer}」\n`;
        });
    }
    errorMessage += "\n請再試一次！";
    alert(errorMessage);

    dropTargets.forEach(target => {
      target.textContent = "";
      target.classList.remove('filled');
      target.style.backgroundColor = '';
      // 隱藏取消按鈕
      target.nextElementSibling.style.visibility = 'hidden';
    });
  }
}

function goBackToMap() {
  document.getElementById("game-screen").classList.add("hidden");
  document.getElementById("leaderboard-screen").classList.add("hidden");
  document.getElementById("map-screen").classList.remove("hidden");
  document.getElementById("knowledge-block").classList.remove("hidden");
  updateLevelStyles();
  
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
  document.getElementById("game-screen").classList.add("hidden");
  document.getElementById("knowledge-block").classList.add("hidden");
  document.getElementById("leaderboard-screen").classList.remove("hidden");
  loadLeaderboard();
}

function loadLeaderboard() {
  const leaderboardList = document.getElementById("leaderboard-list");
  leaderboardList.innerHTML = '<p>載入中...</p>';

  playersRef.orderByChild('maxLevel').limitToLast(10).once('value', (snapshot) => {
    const players = [];
    snapshot.forEach(childSnapshot => {
      const player = childSnapshot.val();
      player.name = childSnapshot.key;
      players.push(player);
    });

    players.sort((a, b) => {
      if (b.maxLevel !== a.maxLevel) {
        return b.maxLevel - a.maxLevel;
      }
      return b.totalCorrectAnswers - a.totalCorrectAnswers;
    });

    leaderboardList.innerHTML = '';

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
  document.getElementById("knowledge-block").classList.remove("hidden");
}
