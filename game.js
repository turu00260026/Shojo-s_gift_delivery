// ゲーム状態管理
const GameState = {
    TITLE: 'title',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'gameOver',
    CLEAR: 'clear'
};

// ゲームオブジェクト
const game = {
    canvas: null,
    ctx: null,
    state: GameState.TITLE,
    animationId: null,
    bgm: null,
    bgmEnabled: true,
    life: 3,
    score: 0,
    scrollSpeed: 3,
    backgroundX: 0,
    deliveredPresents: 0,
    totalBeds: 10,
    clearTimer: 0,  // クリア演出用タイマー
    runningOutPhase: false  // 走り抜け演出フラグ
};

// プレイヤー（サンタ）
const player = {
    x: 100,
    y: 0,
    width: 160,  // 2倍のサイズ
    height: 160, // 2倍のサイズ
    velocityY: 0,
    gravity: 0.6,
    jumpPower: -18,
    moveSpeed: 5,
    isJumping: false,
    canDoubleJump: true,
    jumpCount: 0,
    state: 'running', // running, jumping, delivering
    previousState: 'running',  // 前の状態を記録
    movingLeft: false,
    movingRight: false,
    invincible: false,
    invincibleTimer: 0,
    nearBed: null,  // 近くのベッドを記録
    deliveringTimer: 0,  // 配達アニメーション用タイマー
    element: null,  // HTML要素
    // 当たり判定用（透過部分を除外した実際のキャラクター範囲）
    hitboxOffsetX: 30,
    hitboxOffsetY: 30,
    hitboxWidth: 100,
    hitboxHeight: 120
};

// 画像リソース
const images = {
    background: new Image(),
    santaRun: new Image(),
    santaJump: new Image(),
    santaDeliver: new Image(),
    gift: new Image(),
    jamadaruma: new Image(),
    teki1: new Image(),
    tekiJump: new Image(),
    beds: [],
    loaded: 0,
    total: 0
};

// 画像の読み込み（GIFアニメーション対応）
function loadImages(callback) {
    // キャッシュバスター（GIFアニメーションを確実に読み込むため）
    const cacheBuster = '?v=' + Date.now();

    const imagesToLoad = [
        { obj: images.background, src: 'assets/haikei.png' },
        { obj: images.santaRun, src: 'assets/santa.gif' + cacheBuster },
        { obj: images.santaJump, src: 'assets/santa2.gif' + cacheBuster },
        { obj: images.santaDeliver, src: 'assets/sant3.gif' + cacheBuster },
        { obj: images.gift, src: 'assets/gift.png' },
        { obj: images.jamadaruma, src: 'assets/jamadaruma.png' },
        { obj: images.teki1, src: 'assets/teki1.gif' + cacheBuster },
        { obj: images.tekiJump, src: 'assets/tekijump.gif' + cacheBuster }
    ];

    // ベッド画像を追加
    for (let i = 1; i <= 10; i++) {
        const bedImg = new Image();
        images.beds.push(bedImg);
        imagesToLoad.push({ obj: bedImg, src: `assets/bed${i}.png` });
    }

    images.total = imagesToLoad.length;

    // 各画像の読み込み
    imagesToLoad.forEach(item => {
        item.obj.onload = () => {
            images.loaded++;
            if (images.loaded === images.total && callback) {
                callback();
            }
        };
        item.obj.onerror = () => {
            console.error(`画像の読み込みエラー: ${item.src}`);
            images.loaded++;
            if (images.loaded === images.total && callback) {
                callback();
            }
        };
        item.obj.src = item.src;
    });
}

// 敵の配列
const enemies = [];

// ベッドの配列
const beds = [];

// プレゼントの配列
const gifts = [];

// 配達予定のプレゼント（遅延表示用）
const pendingGifts = [];

// キャラクターHTML要素の作成
function createCharacterElements() {
    const container = document.getElementById('gameCharacters');

    // プレイヤー要素を作成
    player.element = document.createElement('div');
    player.element.className = 'character player';
    player.element.innerHTML = `<img src="assets/santa.gif?v=${Date.now()}" alt="サンタ">`;
    container.appendChild(player.element);

    // 敵要素は動的に追加
}

// キャラクター要素の位置を更新
function updateCharacterPositions() {
    // プレイヤーの位置更新
    if (player.element) {
        player.element.style.left = `${player.x}px`;
        player.element.style.top = `${player.y}px`;
        player.element.style.width = `${player.width}px`;
        player.element.style.height = `${player.height}px`;

        // 状態が変わったときだけ画像を変更（GIFアニメーションを継続させるため）
        if (player.state !== player.previousState) {
            const img = player.element.querySelector('img');
            const timestamp = Date.now();

            if (player.state === 'delivering') {
                img.src = `assets/sant3.gif?v=${timestamp}`;
            } else if (player.state === 'jumping') {
                img.src = `assets/santa2.gif?v=${timestamp}`;
            } else {
                img.src = `assets/santa.gif?v=${timestamp}`;
            }

            player.previousState = player.state;
        }

        // 無敵時の点滅
        if (player.invincible && Math.floor(player.invincibleTimer / 5) % 2 === 1) {
            player.element.style.opacity = '0';
        } else {
            player.element.style.opacity = '1';
        }
    }

    // 敵の位置更新
    enemies.forEach((enemy) => {
        // 画面内にいるかチェック（背景画面の範囲内のみ表示）
        const isOnScreen = enemy.x + enemy.width > 0 && enemy.x < game.canvas.width;

        if (!enemy.element) {
            enemy.element = document.createElement('div');
            enemy.element.className = 'character enemy';
            const timestamp = Date.now();
            const gifSrc = enemy.type === 'jamadaruma' ? 'jamadaruma.png' : `${enemy.type}.gif`;
            enemy.element.innerHTML = `<img src="assets/${gifSrc}?v=${timestamp}" alt="${enemy.type}">`;
            document.getElementById('gameCharacters').appendChild(enemy.element);
        }

        // 画面内にいる場合のみ表示（背景範囲内のみ）
        if (isOnScreen) {
            enemy.element.style.display = 'block';
            enemy.element.style.left = `${enemy.x}px`;
            enemy.element.style.top = `${enemy.y}px`;
            enemy.element.style.width = `${enemy.width}px`;
            enemy.element.style.height = `${enemy.height}px`;
        } else {
            enemy.element.style.display = 'none';
        }
    });
}

// キャラクター要素をクリア
function clearCharacterElements() {
    enemies.forEach(enemy => {
        if (enemy.element && enemy.element.parentNode) {
            enemy.element.parentNode.removeChild(enemy.element);
        }
    });
}

// 初期化
function init() {
    game.canvas = document.getElementById('gameCanvas');
    game.ctx = game.canvas.getContext('2d');

    // Canvasサイズ設定
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // BGM設定
    game.bgm = new Audio('assets/bgm.mp3');
    game.bgm.loop = true;

    // イベントリスナー設定
    setupEventListeners();

    // タイトル画面でのEnterキー対応
    window.addEventListener('keydown', handleTitleScreenKey);

    // キャラクター要素を作成
    createCharacterElements();

    // 画像読み込み（ロード完了後にスタートボタンを有効化）
    showLoadingMessage();
    loadImages(() => {
        hideLoadingMessage();
        console.log('すべての画像のロードが完了しました');
    });
}

// ローディングメッセージ表示
function showLoadingMessage() {
    const startButton = document.getElementById('startButton');
    startButton.disabled = true;
    startButton.textContent = 'Loading...';
}

// ローディングメッセージ非表示
function hideLoadingMessage() {
    const startButton = document.getElementById('startButton');
    startButton.disabled = false;
    startButton.textContent = 'スタート';
}

// Canvasサイズ調整
function resizeCanvas() {
    const container = document.getElementById('gameContainer');
    const aspectRatio = 16 / 9;

    let width = container.clientWidth;
    let height = container.clientHeight;

    if (width / height > aspectRatio) {
        width = height * aspectRatio;
    } else {
        height = width / aspectRatio;
    }

    game.canvas.width = width;
    game.canvas.height = height;

    // 地面の位置を設定（すべてのオブジェクトが同じラインに）
    if (game.canvas.height) {
        player.groundY = game.canvas.height - 160;  // 160に変更（キャラの高さ分）
        if (player.y === 0) {
            player.y = player.groundY;
        }
    }
}

// イベントリスナー設定
function setupEventListeners() {
    // スタートボタン
    document.getElementById('startButton').addEventListener('click', startGame);

    // リトライボタン
    document.getElementById('retryButton').addEventListener('click', retryGame);

    // 再スタートボタン
    document.getElementById('restartButton').addEventListener('click', retryGame);

    // BGMボタン
    document.getElementById('bgmButton').addEventListener('click', toggleBGM);

    // 一時停止ボタン
    document.getElementById('pauseButton').addEventListener('click', togglePause);

    // キーボード操作（PC）
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // タッチ操作（スマホ）
    setupTouchControls();
}

// タッチコントロール設定
function setupTouchControls() {
    const leftButton = document.getElementById('leftButton');
    const rightButton = document.getElementById('rightButton');
    const jumpButton = document.getElementById('jumpButton');
    const deliverButton = document.getElementById('deliverButton');

    // 左移動ボタン
    leftButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        player.movingLeft = true;
    });
    leftButton.addEventListener('touchend', (e) => {
        e.preventDefault();
        player.movingLeft = false;
    });
    leftButton.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        player.movingLeft = false;
    });

    // 右移動ボタン
    rightButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        player.movingRight = true;
    });
    rightButton.addEventListener('touchend', (e) => {
        e.preventDefault();
        player.movingRight = false;
    });
    rightButton.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        player.movingRight = false;
    });

    // ジャンプボタン
    jumpButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleJump();
    });
    jumpButton.addEventListener('click', (e) => {
        e.preventDefault();
        handleJump();
    });

    // 配達ボタン
    deliverButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleDeliver();
    });
    deliverButton.addEventListener('click', (e) => {
        e.preventDefault();
        handleDeliver();
    });
}

// タイトル画面でのキー入力
function handleTitleScreenKey(e) {
    // タイトル画面が表示されている場合のみ
    const titleScreen = document.getElementById('titleScreen');
    if (titleScreen.style.display !== 'none' && e.key === 'Enter') {
        const startButton = document.getElementById('startButton');
        if (!startButton.disabled) {
            e.preventDefault();
            startGame();
        }
    }
}

// キーボード入力（押下）
function handleKeyDown(e) {
    if (game.state !== GameState.PLAYING) return;

    if (e.key === 'ArrowLeft') {
        player.movingLeft = true;
    } else if (e.key === 'ArrowRight') {
        player.movingRight = true;
    } else if (e.key === ' ') {
        e.preventDefault();
        handleJump();
    } else if (e.key === 'Enter' || e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        handleDeliver();  // プレゼント配達
    }
}

// キーボード入力（解放）
function handleKeyUp(e) {
    if (e.key === 'ArrowLeft') {
        player.movingLeft = false;
    } else if (e.key === 'ArrowRight') {
        player.movingRight = false;
    }
}

// ジャンプ処理
function handleJump() {
    if (game.state !== GameState.PLAYING) return;

    if (player.jumpCount === 0) {
        // 1段ジャンプ
        player.velocityY = player.jumpPower;
        player.isJumping = true;
        player.jumpCount = 1;
        player.state = 'jumping';
    } else if (player.jumpCount === 1 && player.canDoubleJump) {
        // 2段ジャンプ
        player.velocityY = player.jumpPower;
        player.jumpCount = 2;
        player.canDoubleJump = false;
    }
}

// プレゼント配達処理
function handleDeliver() {
    if (game.state !== GameState.PLAYING) return;
    if (player.nearBed && !player.nearBed.delivered) {
        deliverPresent(player.nearBed);
    }
}

// BGMトグル
function toggleBGM() {
    game.bgmEnabled = !game.bgmEnabled;
    const btn = document.getElementById('bgmButton');

    if (game.bgmEnabled) {
        game.bgm.play().catch(e => console.log('BGM再生エラー:', e));
        btn.textContent = '🔊';
    } else {
        game.bgm.pause();
        btn.textContent = '🔇';
    }
}

// 一時停止トグル
function togglePause() {
    if (game.state === GameState.PLAYING) {
        game.state = GameState.PAUSED;
        document.getElementById('pauseButton').textContent = '▶';
        game.bgm.pause();
    } else if (game.state === GameState.PAUSED) {
        game.state = GameState.PLAYING;
        document.getElementById('pauseButton').textContent = '⏸';
        if (game.bgmEnabled) {
            game.bgm.play().catch(e => console.log('BGM再生エラー:', e));
        }
        gameLoop();
    }
}

// ゲーム開始
function startGame() {
    document.getElementById('titleScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';

    // ゲーム状態リセット
    resetGame();

    // BGM再生
    if (game.bgmEnabled) {
        game.bgm.play().catch(e => console.log('BGM再生エラー:', e));
    }

    game.state = GameState.PLAYING;
    gameLoop();
}

// ゲームリセット
function resetGame() {
    game.life = 3;
    game.score = 0;
    game.backgroundX = 0;
    game.deliveredPresents = 0;
    game.clearTimer = 0;
    game.runningOutPhase = false;

    player.x = 100;
    player.y = player.groundY;
    player.velocityY = 0;
    player.isJumping = false;
    player.canDoubleJump = true;
    player.jumpCount = 0;
    player.state = 'running';
    player.previousState = 'running';
    player.movingLeft = false;
    player.movingRight = false;
    player.invincible = false;
    player.invincibleTimer = 0;
    player.nearBed = null;
    player.deliveringTimer = 0;

    // キャラクター要素をクリア
    clearCharacterElements();

    enemies.length = 0;
    beds.length = 0;
    gifts.length = 0;
    pendingGifts.length = 0;  // 配達予定プレゼントもクリア

    updateLifeDisplay();
    initializeBeds();
    spawnEnemies();
}

// ライフ表示更新
function updateLifeDisplay() {
    const hearts = document.querySelectorAll('.heart');
    hearts.forEach((heart, index) => {
        if (index < game.life) {
            heart.classList.remove('lost');
        } else {
            heart.classList.add('lost');
        }
    });
}

// ベッド初期化
function initializeBeds() {
    const spacing = 1800;  // 1200から1800に変更（1.5倍に）

    for (let i = 0; i < game.totalBeds; i++) {
        const bedHeight = 160;
        beds.push({
            x: 1500 + i * spacing,  // 初期位置をさらに右に
            y: player.groundY - 80,  // プレイヤーより80px上に配置
            width: 200,  // 2倍のサイズ
            height: bedHeight, // 2倍のサイズ
            bedNumber: i,
            delivered: false
        });
    }
}

// 敵のスポーン
function spawnEnemies() {
    const enemyTypes = [
        {
            type: 'jamadaruma',
            image: images.jamadaruma,
            width: 120,
            height: 120,
            hitboxOffsetX: 30,  // 透過部分を除外するため増やす
            hitboxOffsetY: 30,  // 透過部分を除外するため増やす
            hitboxWidth: 60,   // 実際のキャラクター部分のみ
            hitboxHeight: 60   // 実際のキャラクター部分のみ
        },
        {
            type: 'teki1',
            image: images.teki1,
            width: 120,
            height: 120,
            hitboxOffsetX: 35,  // 透過部分を除外するため増やす
            hitboxOffsetY: 35,  // 透過部分を除外するため増やす
            hitboxWidth: 50,   // 実際のキャラクター部分のみ
            hitboxHeight: 60   // 実際のキャラクター部分のみ
        },
        {
            type: 'tekiJump',
            image: images.tekiJump,
            width: 120,
            height: 120,
            hitboxOffsetX: 35,  // 透過部分を除外するため増やす
            hitboxOffsetY: 35,  // 透過部分を除外するため増やす
            hitboxWidth: 50,   // 実際のキャラクター部分のみ
            hitboxHeight: 60   // 実際のキャラクター部分のみ
        }
    ];

    // ベッドの間に敵を配置（ベッドと重ならないように）
    const bedSpacing = 1800;  // ベッド間隔と合わせて1800に
    const bedsStartX = 1500;

    for (let i = 0; i < game.totalBeds - 1; i++) {
        const enemyType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
        // ベッドの間に配置（中間地点にランダムに配置）
        const bedX = bedsStartX + i * bedSpacing;
        const enemyX = bedX + 400 + Math.random() * (bedSpacing - 800);

        enemies.push({
            x: enemyX,
            y: player.groundY + 50,  // プレイヤーより50px下に配置
            width: enemyType.width,
            height: enemyType.height,
            type: enemyType.type,
            image: enemyType.image,
            flying: false,
            hitboxOffsetX: enemyType.hitboxOffsetX,
            hitboxOffsetY: enemyType.hitboxOffsetY,
            hitboxWidth: enemyType.hitboxWidth,
            hitboxHeight: enemyType.hitboxHeight
        });

        // 後半（ベッド5以降）は確率を上げてjamadarumaを追加配置
        const jamadarumaProbability = i >= 4 ? 0.5 : 0.3;  // 後半は50%の確率
        if (Math.random() < jamadarumaProbability) {
            const jamaType = enemyTypes[0];  // jamadaruma
            const jamaX = bedX + 600 + Math.random() * (bedSpacing - 1000);

            enemies.push({
                x: jamaX,
                y: player.groundY + 50,
                width: jamaType.width,
                height: jamaType.height,
                type: jamaType.type,
                image: jamaType.image,
                flying: false,
                hitboxOffsetX: jamaType.hitboxOffsetX,
                hitboxOffsetY: jamaType.hitboxOffsetY,
                hitboxWidth: jamaType.hitboxWidth,
                hitboxHeight: jamaType.hitboxHeight
            });
        }
    }

    // 最後のベッドの後は敵を配置しない（走り抜けてクリア）
}

// リトライ
function retryGame() {
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('clearScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';

    resetGame();
    game.state = GameState.PLAYING;

    if (game.bgmEnabled) {
        game.bgm.currentTime = 0;
        game.bgm.play().catch(e => console.log('BGM再生エラー:', e));
    }

    gameLoop();
}

// メインゲームループ
function gameLoop() {
    if (game.state !== GameState.PLAYING) return;

    update();
    render();

    game.animationId = requestAnimationFrame(gameLoop);
}

// 更新処理
function update() {
    // クリア演出中（走り抜け）
    if (game.runningOutPhase) {
        player.x += player.moveSpeed * 2;  // 通常の2倍の速度で右へ
        player.state = 'running';

        // 画面外に完全に消えたらクリア画面へ
        if (player.x > game.canvas.width + player.width) {
            gameClear();
        }
        return;
    }

    // 配達アニメーション中は移動を制限
    if (player.deliveringTimer > 0) {
        player.deliveringTimer--;
        if (player.deliveringTimer <= 0) {
            player.state = 'running';
        }
    } else {
        // プレイヤー移動
        if (player.movingLeft && player.x > 0) {
            player.x -= player.moveSpeed;
        }
        if (player.movingRight && player.x < game.canvas.width - player.width) {
            player.x += player.moveSpeed;
        }
    }

    // 重力適用
    player.velocityY += player.gravity;
    player.y += player.velocityY;

    // 地面判定
    if (player.y >= player.groundY) {
        player.y = player.groundY;
        player.velocityY = 0;
        player.isJumping = false;
        player.canDoubleJump = true;
        player.jumpCount = 0;
        if (player.state === 'jumping') {
            player.state = 'running';
        }
    }

    // 無敵時間更新
    if (player.invincible) {
        player.invincibleTimer--;
        if (player.invincibleTimer <= 0) {
            player.invincible = false;
        }
    }

    // 背景スクロール
    game.backgroundX -= game.scrollSpeed;
    if (game.backgroundX <= -game.canvas.width) {
        game.backgroundX = 0;
    }

    // 敵の更新
    enemies.forEach(enemy => {
        enemy.x -= game.scrollSpeed;
    });

    // ベッドの更新
    player.nearBed = null;  // リセット
    beds.forEach(bed => {
        bed.x -= game.scrollSpeed;

        // ベッドの近くにいるかチェック（自動配達は削除）
        if (!bed.delivered && checkNearBed(player, bed)) {
            player.nearBed = bed;
        }
    });

    // プレゼントの更新
    gifts.forEach(gift => {
        gift.x -= game.scrollSpeed;
    });

    // 配達予定プレゼントのタイマー更新
    for (let i = pendingGifts.length - 1; i >= 0; i--) {
        const pendingGift = pendingGifts[i];
        pendingGift.x -= game.scrollSpeed;  // スクロールに合わせて移動
        pendingGift.timer--;

        if (pendingGift.timer <= 0) {
            // タイマーが0になったら実際に表示
            gifts.push({
                x: pendingGift.x,
                y: pendingGift.y,
                width: pendingGift.width,
                height: pendingGift.height
            });
            pendingGifts.splice(i, 1);  // 配達予定から削除
        }
    }

    // 敵との衝突判定
    if (!player.invincible) {
        enemies.forEach(enemy => {
            if (checkCollision(player, enemy)) {
                hitByEnemy();
            }
        });
    }

    // 画面外のオブジェクト削除
    cleanupOffscreenObjects();

    // クリア判定（全ベッドに配達完了から2秒後に走り抜け開始）
    if (game.deliveredPresents >= game.totalBeds && !game.runningOutPhase) {
        if (game.clearTimer === 0) {
            game.clearTimer = 1;  // タイマー開始
        } else {
            game.clearTimer++;
            if (game.clearTimer >= 120) {  // 120フレーム（約2秒）後
                game.runningOutPhase = true;  // 走り抜け演出開始
            }
        }
    }
}

// 衝突判定（透過部分を除外した実際の描画範囲で判定）
function checkCollision(obj1, obj2) {
    // オフセットとヒットボックスサイズを考慮した判定
    const obj1HitX = obj1.x + (obj1.hitboxOffsetX || 0);
    const obj1HitY = obj1.y + (obj1.hitboxOffsetY || 0);
    const obj1HitWidth = obj1.hitboxWidth || obj1.width;
    const obj1HitHeight = obj1.hitboxHeight || obj1.height;

    const obj2HitX = obj2.x + (obj2.hitboxOffsetX || 0);
    const obj2HitY = obj2.y + (obj2.hitboxOffsetY || 0);
    const obj2HitWidth = obj2.hitboxWidth || obj2.width;
    const obj2HitHeight = obj2.hitboxHeight || obj2.height;

    return obj1HitX < obj2HitX + obj2HitWidth &&
           obj1HitX + obj1HitWidth > obj2HitX &&
           obj1HitY < obj2HitY + obj2HitHeight &&
           obj1HitY + obj1HitHeight > obj2HitY;
}

// ベッドの近くにいるかチェック（配達可能範囲）
function checkNearBed(player, bed) {
    const rangeX = 150;  // 横方向の配達可能範囲
    const rangeY = 150;  // 縦方向の配達可能範囲（ベッドが上にあるため広く）
    return Math.abs(player.x - bed.x) < rangeX &&
           Math.abs(player.y - bed.y) < rangeY;
}

// プレゼント配達
function deliverPresent(bed) {
    bed.delivered = true;
    game.deliveredPresents++;

    // サンタの状態を配達アクションに変更
    player.state = 'delivering';
    player.deliveringTimer = 30;  // 約0.5秒のアニメーション（60FPS想定）

    // プレゼントを0.5秒後に表示するため、配達予定に追加
    pendingGifts.push({
        x: bed.x + (bed.width - 80) / 2,  // ベッドの中央に配置
        y: bed.y + (bed.height - 80) / 2,  // ベッドの中央に配置
        width: 80,   // 2倍のサイズ
        height: 80,   // 2倍のサイズ
        timer: 30  // 30フレーム（約0.5秒）後に表示
    });
}

// 敵に当たった時の処理
function hitByEnemy() {
    game.life--;
    updateLifeDisplay();

    player.invincible = true;
    player.invincibleTimer = 60; // 約1秒の無敵時間

    if (game.life <= 0) {
        gameOver();
    }
}

// 画面外オブジェクトのクリーンアップ
function cleanupOffscreenObjects() {
    // 敵
    for (let i = enemies.length - 1; i >= 0; i--) {
        if (enemies[i].x + enemies[i].width < -100) {
            enemies.splice(i, 1);
        }
    }

    // プレゼント
    for (let i = gifts.length - 1; i >= 0; i--) {
        if (gifts[i].x + gifts[i].width < -100) {
            gifts.splice(i, 1);
        }
    }
}

// ゲームオーバー
function gameOver() {
    game.state = GameState.GAME_OVER;
    game.bgm.pause();
    document.getElementById('gameOverScreen').style.display = 'flex';
    cancelAnimationFrame(game.animationId);
}

// ゲームクリア
function gameClear() {
    game.state = GameState.CLEAR;
    game.bgm.pause();

    // 配達数を表示
    const clearScreen = document.getElementById('clearScreen');
    const deliveryCountElement = clearScreen.querySelector('#deliveryCount');
    if (deliveryCountElement) {
        deliveryCountElement.textContent = `${game.deliveredPresents}個 / ${game.totalBeds}個`;
    }

    clearScreen.style.display = 'flex';
    cancelAnimationFrame(game.animationId);
}

// 描画処理
function render() {
    const ctx = game.ctx;
    const canvas = game.canvas;

    // 背景描画（Canvasで描画）
    ctx.drawImage(images.background, game.backgroundX, 0, canvas.width, canvas.height);
    ctx.drawImage(images.background, game.backgroundX + canvas.width, 0, canvas.width, canvas.height);

    // ベッド描画（Canvasで描画）
    beds.forEach(bed => {
        if (bed.x > -bed.width && bed.x < canvas.width + 100) {
            const bedImage = images.beds[bed.bedNumber];
            ctx.drawImage(bedImage, bed.x, bed.y, bed.width, bed.height);

            // 配達可能な場合は「E」キーのヒントを表示
            if (player.nearBed === bed && !bed.delivered) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.font = 'bold 24px Arial';
                ctx.fillText('Press E or Enter', bed.x, bed.y - 20);
            }
        }
    });

    // プレゼント描画（Canvasで描画）
    gifts.forEach(gift => {
        ctx.drawImage(images.gift, gift.x, gift.y, gift.width, gift.height);
    });

    // デバッグ情報（任意）
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.fillText(`プレゼント: ${game.deliveredPresents}/${game.totalBeds}`, 10, canvas.height - 20);

    // キャラクターの位置を更新（HTML要素でGIFアニメーション）
    updateCharacterPositions();
}

// ページ読み込み時に初期化
window.addEventListener('load', init);
