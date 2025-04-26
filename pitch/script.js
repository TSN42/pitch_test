// --- グローバル変数と設定 (変更・追加) ---
let audioContext;
let referenceFrequency;
let choiceFrequencies = [];
let correctChoiceIndex;
let selectedChoiceIndex = -1;
let isPlaying = false;
let currentCents = 100;
const minCents = 1;
const maxCents = 200;
const soundDuration = 0.8;
const numChoices = 3;
const baseFrequencyMin = 261.63; // C4
const baseFrequencyMax = 523.25; // C5
const maxTrials = 15;
let trialCount = 0;
let testResults = [];

// --- Staircase & 難易度調整用変数 (変更・追加) ---
let correctStreak = 0; // 連続正解数 (Staircase: 2-down ruleで使用)
let reversalCount = 0; // 逆転回数
let lastDirection = null; // 難易度変化の方向: 'UP'(難易度上昇=Cents減少), 'DOWN'(難易度下降=Cents増加), null
const reversalThreshold = 2; // この回数逆転したらステップサイズを小さくする
// ステップサイズ係数 (難易度変化の大きさ)
const largeStepSizeFactor = {
    increase: 1.4, // 不正解時 (難易度DOWN): セント差を1.4倍に
    decrease: 0.7  // 2回連続正解時 (難易度UP): セント差を0.7倍に
};
const smallStepSizeFactor = {
    increase: 1.15, // 不正解時 (難易度DOWN): セント差を1.15倍に (穏やかに)
    decrease: 0.85  // 2回連続正解時 (難易度UP): セント差を0.85倍に (穏やかに)
};
let currentStepSizeFactor = { ...largeStepSizeFactor }; // 初期は大きなステップサイズ

// --- 計測用変数 ---
let trialStartTime;
let referencePlayCount = 0;
let choicePlayCount = 0;

// --- DOM要素の取得 ---
const playReferenceButton = document.getElementById('playReference');
const choicesContainer = document.getElementById('choices');
const submitAnswerButton = document.getElementById('submitAnswer');
const feedbackDisplay = document.getElementById('feedback');
const difficultyDisplay = document.getElementById('difficultyDisplay');

// --- Web Audio API 初期化 ---
function initAudio() {
    try {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();
    } catch (e) {
        alert('Web Audio APIはこのブラウザではサポートされていません。');
        console.error(e);
    }
}

// --- 音再生関数 ---
async function playSound(frequency, duration) {
    if (!audioContext || isPlaying) return;
    isPlaying = true;
    disableAllButtons();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.8, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration - 0.05);
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
    return new Promise(resolve => {
        setTimeout(() => {
            isPlaying = false;
            enableButtonsAfterPlayback();
            resolve();
        }, duration * 1000);
    });
}

// --- 周波数計算関数 ---
function calculateFrequency(baseFrequency, cents) {
    return baseFrequency * Math.pow(2, cents / 1200);
}

// --- 次の試行の準備 ---
function setupNextTrial() {
    if (trialCount >= maxTrials) {
        finishTest();
        return;
    }
    let trialInfo = document.getElementById('trialInfo');
    if (!trialInfo) {
        trialInfo = document.createElement('p');
        trialInfo.id = 'trialInfo';
        const controlsDiv = document.getElementById('controls');
        controlsDiv.parentNode.insertBefore(trialInfo, controlsDiv.nextSibling);
    }
    trialInfo.textContent = `試行 ${trialCount + 1} / ${maxTrials}`;
    selectedChoiceIndex = -1;
    choiceFrequencies = [];
    feedbackDisplay.textContent = '';
    feedbackDisplay.className = '';
    submitAnswerButton.disabled = true;
    playReferenceButton.disabled = false;
    choicesContainer.innerHTML = '';
    referencePlayCount = 0;
    choicePlayCount = 0;
    trialStartTime = performance.now();
    difficultyDisplay.textContent = currentCents.toFixed(1);
    referenceFrequency = baseFrequencyMin + Math.random() * (baseFrequencyMax - baseFrequencyMin);
    correctChoiceIndex = Math.floor(Math.random() * numChoices);
    let usedDistractorSigns = [];
    for (let i = 0; i < numChoices; i++) {
        if (i === correctChoiceIndex) {
            choiceFrequencies.push(referenceFrequency);
        } else {
            let distractorFreq;
            let sign;
            if (!usedDistractorSigns.includes(1)) sign = 1;
            else if (!usedDistractorSigns.includes(-1)) sign = -1;
            else sign = Math.random() < 0.5 ? 1 : -1;
            do {
                distractorFreq = calculateFrequency(referenceFrequency, sign * currentCents);
                if (choiceFrequencies.includes(distractorFreq)) {
                   sign *= -1;
                   distractorFreq = calculateFrequency(referenceFrequency, sign * currentCents);
                }
            } while (choiceFrequencies.includes(distractorFreq));
            choiceFrequencies.push(distractorFreq);
            if (sign !== 0) usedDistractorSigns.push(sign);
        }
    }
     choiceFrequencies.forEach((freq, index) => {
        const button = document.createElement('button');
        button.textContent = `選択肢 ${index + 1}`;
        button.dataset.index = index;
        button.dataset.frequency = freq;
        button.disabled = false;
        button.addEventListener('click', handleChoiceClick);
        choicesContainer.appendChild(button);
    });
    // console.log(`Trial ${trialCount + 1} Start: Correct=${correctChoiceIndex}, Cents=${currentCents.toFixed(1)}`);
}

// --- 選択肢ボタンクリック処理 ---
async function handleChoiceClick(event) {
    if (isPlaying || trialCount >= maxTrials) return;
    choicePlayCount++;
    const clickedButton = event.target;
    const index = parseInt(clickedButton.dataset.index);
    const freq = parseFloat(clickedButton.dataset.frequency);
    const previousSelected = choicesContainer.querySelector('.selected');
    if (previousSelected) previousSelected.classList.remove('selected');
    clickedButton.classList.add('selected');
    selectedChoiceIndex = index;
    await playSound(freq, soundDuration);
    submitAnswerButton.disabled = false;
}

// --- 確定ボタンクリック処理 ---
function handleSubmitClick() {
    if (selectedChoiceIndex === -1 || isPlaying || trialCount >= maxTrials) return;
    const endTime = performance.now();
    const timeTaken = (endTime - trialStartTime) / 1000;
    const totalPlays = referencePlayCount + choicePlayCount;
    const isCorrect = selectedChoiceIndex === correctChoiceIndex;
    testResults.push({
        trial: trialCount + 1,
        cents: currentCents,
        correct: isCorrect,
        referenceFreq: referenceFrequency,
        selectedChoiceIndex: selectedChoiceIndex,
        correctChoiceIndex: correctChoiceIndex,
        choiceFrequencies: [...choiceFrequencies],
        answerTime: timeTaken,
        totalPlays: totalPlays,
        // --- デバッグ用に逆転情報も記録 (オプション) ---
        // reversal: false // updateDifficulty内でtrueに設定可能
    });
    const selectedButton = choicesContainer.querySelector(`button[data-index="${selectedChoiceIndex}"]`);
    const correctButton = choicesContainer.querySelector(`button[data-index="${correctChoiceIndex}"]`);
    feedbackDisplay.textContent = isCorrect ? '正解！' : '不正解...';
    feedbackDisplay.className = isCorrect ? 'correct' : 'incorrect';
    if (selectedButton) selectedButton.classList.add(isCorrect ? 'feedback-correct' : 'feedback-incorrect');
    if (!isCorrect && correctButton) correctButton.classList.add('feedback-correct');

    // --- 難易度調整実行 ---
    updateDifficulty(isCorrect, timeTaken, totalPlays);

    trialCount++;
    disableAllButtons();
    submitAnswerButton.disabled = true;
    setTimeout(() => {
        choicesContainer.querySelectorAll('button').forEach(btn => {
            btn.classList.remove('feedback-correct', 'feedback-incorrect', 'selected');
        });
        setupNextTrial();
    }, 1500);
}

// --- 難易度調整ロジック (Staircase法 + 動的ステップサイズ + 時間/再生ペナルティ) ---
function updateDifficulty(isCorrect, timeTaken, totalPlays) {
    let directionChanged = false; // この試行で難易度方向が変わったかを示すフラグ
    let difficultyChanged = false; // この試行で難易度(Cents)が変更されたか
    let currentDirection = null; // この試行での難易度変化方向 ('UP' or 'DOWN')

    // --- 1. ステップサイズの決定 ---
    // 規定回数の逆転が起きたら、ステップサイズを小さくする
    if (reversalCount >= reversalThreshold && currentStepSizeFactor !== smallStepSizeFactor) {
        console.log(`Reversal threshold (${reversalThreshold}) reached at trial ${trialCount + 1}. Switching to small step size.`);
        currentStepSizeFactor = { ...smallStepSizeFactor }; // 新しいオブジェクトとしてコピー
    }
    // 現在のステップサイズ係数を取得
    let baseIncreaseFactor = currentStepSizeFactor.increase; // 不正解時 (難易度DOWN)
    let baseDecreaseFactor = currentStepSizeFactor.decrease; // 正解時 (難易度UP)

    // --- 2. 時間と再生回数に基づく調整係数 (ペナルティ計算) ---
    // パラメータ (調整可能):
    const timeThreshold = 10.0; // これを超えるとペナルティがかかり始める時間(秒)
    const playThreshold = numChoices + 2; // これを超えるとペナルティがかかり始める再生回数
    const timePenaltyFactor = 0.2; // 時間ペナルティの最大影響度(0.0-1.0)。大きいほど影響大。
    const playPenaltyFactor = 0.2; // 再生回数ペナルティの最大影響度(0.0-1.0)。
    const timePenaltySensitivity = 20.0; // 時間超過に対するペナルティ感度(大きいほど緩やか)
    const playPenaltySensitivity = 5.0; // 再生回数超過に対するペナルティ感度(大きいほど緩やか)

    let timeAdjustment = 1.0;
    if (timeTaken > timeThreshold) {
        timeAdjustment = 1.0 + Math.min(timePenaltyFactor, (timeTaken - timeThreshold) / timePenaltySensitivity);
    }
    let playAdjustment = 1.0;
    if (totalPlays > playThreshold) {
        playAdjustment = 1.0 + Math.min(playPenaltyFactor, (totalPlays - playThreshold) / playPenaltySensitivity);
    }
    // 総合的なペナルティ係数 (1.0が基準、大きいほどペナルティ大)
    const overallAdjustment = timeAdjustment * playAdjustment;

    // --- 3. 難易度更新 (Staircase: 2-down, 1-upルール適用) ---
    const previousCents = currentCents; // 変更前の値を保持

    if (isCorrect) {
        correctStreak++;
        // 2回連続正解で難易度UP (セント差を小さくする)
        if (correctStreak >= 2) {
            // ペナルティ(overallAdjustment > 1)があると、上昇幅が抑制される
            // adjustedDecrease = baseDecreaseFactor ^ (1 / overallAdjustment)
            let adjustedDecrease = Math.pow(baseDecreaseFactor, 1 / overallAdjustment);
            // 極端な値にならないようにクリッピング (例: 0.7 ~ 0.95 の範囲を維持)
            adjustedDecrease = Math.max(0.70, Math.min(0.95, adjustedDecrease));
            currentCents *= adjustedDecrease;
            currentDirection = 'UP'; // 難易度UP = セント差減少
            correctStreak = 0; // 難易度変更したらリセット
            difficultyChanged = true;
            // console.log(`Correct streak >= 2. Difficulty UP.`);
        } else {
            // console.log(`Correct streak < 2. Difficulty unchanged.`);
            // 難易度は変更しない
        }
    } else { // 不正解の場合
        correctStreak = 0; // 連続正解リセット
        // 1回の不正解で難易度DOWN (セント差を大きくする)
        // ペナルティ(overallAdjustment > 1)があると、下降幅が促進される
        // adjustedIncrease = baseIncreaseFactor ^ overallAdjustment
        let adjustedIncrease = Math.pow(baseIncreaseFactor, overallAdjustment);
        // 極端な値にならないようにクリッピング (例: 1.05 ~ 1.5 の範囲を維持)
        adjustedIncrease = Math.max(1.05, Math.min(1.50, adjustedIncrease));
        currentCents *= adjustedIncrease;
        currentDirection = 'DOWN'; // 難易度DOWN = セント差増加
        difficultyChanged = true;
        // console.log(`Incorrect. Difficulty DOWN.`);
    }

    // 最小/最大セント値の制限
    currentCents = Math.max(minCents, Math.min(maxCents, currentCents));

    // 変更があったか再確認 (min/max制限で変化しない場合もあるため)
    if (Math.abs(currentCents - previousCents) < 1e-6) { // ほぼ変化なし
        difficultyChanged = false;
        currentDirection = null; // 方向もリセット
    } else {
         // 難易度が実際に変更された場合のみ difficultyChanged を true に
        difficultyChanged = true;
    }


    // --- 4. 逆転判定 ---
    // 難易度が実際に変更され、かつ前回の方向があり、今回の方向が逆の場合
    if (difficultyChanged && lastDirection && currentDirection && lastDirection !== currentDirection) {
        reversalCount++;
        directionChanged = true;
        console.log(`Reversal detected at trial ${trialCount + 1}! Count: ${reversalCount}. New Cents: ${currentCents.toFixed(1)}`);
        // オプション: 結果に逆転フラグを立てる
        // if (testResults.length > 0) testResults[testResults.length - 1].reversal = true;
    }

    // --- 5. 次回のための状態更新 ---
    // 難易度が実際に変更された場合のみ、lastDirection を更新
    if (difficultyChanged && currentDirection) {
        lastDirection = currentDirection;
    }

    // --- デバッグログ ---
    console.log(
        `Trial ${trialCount + 1}: ` +
        `Correct=${isCorrect}, ` +
        `Streak=${correctStreak}, ` +
        `Time=${timeTaken.toFixed(1)}s, ` +
        `Plays=${totalPlays}, ` +
        `PenaltyAdj=${overallAdjustment.toFixed(2)}, ` +
        `Step:[${currentStepSizeFactor.decrease.toFixed(2)}, ${currentStepSizeFactor.increase.toFixed(2)}], ` +
        `Direction=${currentDirection || 'None'}, ` +
        `Reversals=${reversalCount}, ` +
        `Cents: ${previousCents.toFixed(1)} -> ${currentCents.toFixed(1)}`
    );
}


// --- ボタン無効化/有効化ヘルパー ---
function disableAllButtons() {
    playReferenceButton.disabled = true;
    submitAnswerButton.disabled = true;
    choicesContainer.querySelectorAll('button').forEach(btn => btn.disabled = true);
}

function enableButtonsAfterPlayback() {
    if (trialCount < maxTrials) {
        playReferenceButton.disabled = false;
        submitAnswerButton.disabled = selectedChoiceIndex === -1;
        choicesContainer.querySelectorAll('button').forEach(btn => btn.disabled = false);
        if (selectedChoiceIndex !== -1) {
            const selectedBtn = choicesContainer.querySelector(`button[data-index="${selectedChoiceIndex}"]`);
            if (selectedBtn) selectedBtn.classList.add('selected');
        }
    } else {
        disableAllButtons();
    }
}

// --- テスト終了処理 ---
function finishTest() {
    disableAllButtons();
    feedbackDisplay.textContent = `テスト終了！ ${maxTrials}回の試行が完了しました。結果ページに移動します...`;
    feedbackDisplay.className = '';
    try {
        localStorage.setItem('pitchTestResults', JSON.stringify(testResults));
        console.log("テスト結果をlocalStorageに保存しました:", testResults);
        setTimeout(() => {
            window.location.href = 'results.html';
        }, 1500);
    } catch (e) {
        console.error("結果の保存に失敗しました:", e);
        alert("テスト結果の保存に失敗しました。localStorageの容量を確認してください。");
        feedbackDisplay.textContent = "テスト終了 (結果表示エラー)";
    }
}

// --- 初期化処理 ---
document.addEventListener('DOMContentLoaded', () => {
    // AudioContext初期化ハンドラ（変更なし）
    const initAudioHandler = () => {
        if (!audioContext) {
            initAudio();
            if (audioContext) {
                console.log("AudioContext initialized.");
                setupNextTrial(); // 初期化成功後に最初の試行を開始
            } else {
                 feedbackDisplay.textContent = "オーディオ機能の初期化に失敗しました。";
                 feedbackDisplay.className = "incorrect";
                 disableAllButtons();
                 return;
            }
        }
        // イベントリスナーを削除
        document.body.removeEventListener('click', initAudioHandler, true);
    };
    document.body.addEventListener('click', initAudioHandler, { capture: true, once: true });

    // 基準音再生ボタンのイベントリスナー（変更なし）
    playReferenceButton.addEventListener('click', async () => {
        if (audioContext && !isPlaying && trialCount < maxTrials) {
            referencePlayCount++;
            await playSound(referenceFrequency, soundDuration);
        }
    });

    // 確定ボタンのイベントリスナー（変更なし）
    submitAnswerButton.addEventListener('click', handleSubmitClick);

    // 初期状態設定（変更なし）
    submitAnswerButton.disabled = true;
    difficultyDisplay.textContent = 'N/A'; // 初期状態
    // 最初の試行セットアップは initAudioHandler 内で行われる
});