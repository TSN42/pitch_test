document.addEventListener('DOMContentLoaded', () => {
    const resultsDataString = localStorage.getItem('pitchTestResults');
    const summaryElement = document.getElementById('summary'); // 親要素
    const finalThresholdElement = document.getElementById('finalThreshold');
    const totalTrialsElement = document.getElementById('totalTrials');
    const correctCountElement = document.getElementById('correctCount');
    const correctRateElement = document.getElementById('correctRate');
    // --- 追加要素の取得 ---
    const averageTimeElement = document.getElementById('averageTime');
    const averagePlaysElement = document.getElementById('averagePlays');
    const chartContainer = document.querySelector('.chart-container'); // グラフコンテナ
    const ctx = document.getElementById('thresholdChart').getContext('2d');

    if (!resultsDataString) {
        summaryElement.innerHTML = '<p>テスト結果が見つかりませんでした。もう一度テストを実行してください。</p>';
        chartContainer.style.display = 'none'; // グラフエリア非表示
        return;
    }

    try {
        const results = JSON.parse(resultsDataString);

        if (!Array.isArray(results) || results.length === 0) {
             summaryElement.innerHTML = '<p>テスト結果データが空です。</p>';
             chartContainer.style.display = 'none';
            return;
        }

        // --- サマリー情報の計算と表示 (変更・追加) ---
        const totalTrials = results.length;
        const correctCount = results.filter(r => r.correct).length;
        const correctRate = totalTrials > 0 ? ((correctCount / totalTrials) * 100).toFixed(1) : "0.0";

        let totalTime = 0;
        let totalPlays = 0;
        let validTimeTrials = 0;
        let validPlayTrials = 0;

        results.forEach(r => {
            if (typeof r.answerTime === 'number') {
                totalTime += r.answerTime;
                validTimeTrials++;
            }
            if (typeof r.totalPlays === 'number') {
                totalPlays += r.totalPlays;
                validPlayTrials++;
            }
        });

        const averageTime = validTimeTrials > 0 ? (totalTime / validTimeTrials).toFixed(2) : "N/A";
        const averagePlays = validPlayTrials > 0 ? (totalPlays / validPlayTrials).toFixed(1) : "N/A";

        totalTrialsElement.textContent = totalTrials;
        correctCountElement.textContent = correctCount;
        correctRateElement.textContent = correctRate;
        averageTimeElement.textContent = averageTime; // 平均時間を表示
        averagePlaysElement.textContent = averagePlays; // 平均再生回数を表示

        const lastTrials = results.slice(-5);
        if (lastTrials.length > 0) {
            const sumCents = lastTrials.reduce((sum, r) => sum + r.cents, 0);
            const avgCents = (sumCents / lastTrials.length).toFixed(1);
            finalThresholdElement.textContent = avgCents;
        } else {
            finalThresholdElement.textContent = "N/A";
        }

        // --- Chart.js を使った閾値追跡プロット (ツールチップ変更) ---
        const trials = results.map(r => r.trial);
        const centsData = results.map(r => r.cents);
        const pointBackgroundColors = results.map(r => r.correct ? 'rgba(75, 192, 192, 1)' : 'rgba(255, 99, 132, 1)');
        const pointBorderColors = results.map(r => r.correct ? 'rgba(75, 192, 192, 1)' : 'rgba(255, 99, 132, 1)');

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: trials,
                datasets: [{
                    label: '試行ごとのセント差',
                    data: centsData,
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1,
                    pointBackgroundColor: pointBackgroundColors,
                    pointBorderColor: pointBorderColors,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                scales: {
                    x: {
                        title: { display: true, text: '試行回数' }
                    },
                    y: {
                        title: { display: true, text: 'セント差 (小さいほど難しい)' },
                        beginAtZero: true
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            // --- ツールチップに時間と回数を追加 ---
                            afterLabel: function(context) {
                                const index = context.dataIndex;
                                const result = results[index];
                                if (!result) return ''; // データなければ空
                                const correct = result.correct;
                                // データが存在するか確認してから表示
                                const timeStr = typeof result.answerTime === 'number' ? `時間: ${result.answerTime.toFixed(1)}秒` : '時間: N/A';
                                const playsStr = typeof result.totalPlays === 'number' ? `再生: ${result.totalPlays}回` : '再生: N/A';
                                const resultStr = correct ? '結果: 正解' : '結果: 不正解';
                                return [resultStr, timeStr, playsStr]; // 配列で返すと複数行表示になる
                            }
                        }
                    },
                    legend: { display: true }
                }
            }
        });

        // localStorage.removeItem('pitchTestResults'); // 必要ならコメント解除

    } catch (e) {
        console.error("結果データの解析または描画に失敗しました:", e);
        summaryElement.innerHTML = '<p>結果データの表示中にエラーが発生しました。</p>';
        chartContainer.style.display = 'none';
    }
});