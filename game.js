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
    baseScrollSpeed: 3,  // 基本スクロール速度
    scrollSpeed: 3,
    backgroundX: 0,
    deliveredPresents: 0,
    totalBeds: 10,
    clearTimer: 0,  // クリア演出用タイマー
    runningOutPhase: false,  // 走り抜け演出フラグ
    scale: 1,  // 画面サイズに応じたスケール倍率
    isMobile: false,  // モバイル判定
    bgZoom: 1  // 背景のズーム倍率（モバイル時に調整）
};

// プレイヤー（サンタ）
const player = {
    x: 100,
    y: 0,
    groundY: 0,  // 地面のY座標を追加
    baseWidth: 160,  // 基本サイズ（スケール前）
    baseHeight: 160, // 基本サイズ（スケール前）
    width: 160,  // 実際のサイズ（スケール後）
    height: 160, // 実際のサイズ（スケール後）
    velocityY: 0,
    gravity: 0.6,
    baseJumpPower: -18,  // 基本ジャンプ力
    jumpPower: -18,  // 実際のジャンプ力（モバイルで調整）
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
    baseHitboxOffsetX: 30,
    baseHitboxOffsetY: 30,
    baseHitboxWidth: 100,
    baseHitboxHeight: 120,
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
    
    // 前の要素をクリア（念のため）
    if (container) {
        container.innerHTML = '';
    }

    // プレイヤー要素を作成
    player.element = document.createElement('div');
    player.element.className = 'character player';
    const cacheBuster = '?v=' + Date.now();
    player.element.innerHTML = `<img src="assets/santa.gif${cacheBuster}" alt="サンタ">`;
    if (container) {
        container.appendChild(player.element);
    }

    // 敵要素は動的に追加
}

// キャラクター要素の位置を更新
function updateCharacterPositions() {
    // モバイル時の背景ズームに合わせた変換を適用
    const container = document.getElementById('gameCharacters');
    if (!container) return;

    // コンテナの基本スタイル設定
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.pointerEvents = 'none';

    // コンテナの変換を毎回設定（リセット後も正しく適用されるように）
    if (game.isMobile) {
        // 背景と同じ1.25倍拡大を適用
        container.style.transform = `scale(${game.bgZoom})`;
        container.style.transformOrigin = '50% 50%';
    } else {
        // PC時は変換なし
        container.style.transform = 'none';
        container.style.transformOrigin = '0 0';
    }

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
        // 画面内にいるかチェック（CSS表示サイズ基準）
        const displayWidth = game.canvas.clientWidth;
        const isOnScreen = enemy.x + enemy.width > 0 && enemy.x < displayWidth;

        if (!enemy.element) {
            enemy.element = document.createElement('div');
            enemy.element.className = 'character enemy';
            const timestamp = Date.now();
            let gifSrc;
            if (enemy.type === 'jamadaruma') {
                gifSrc = 'jamadaruma.png';
            } else if (enemy.type === 'tekiJump') {
                gifSrc = 'tekijump.gif';  // 小文字のファイル名に対応
            } else {
                gifSrc = `${enemy.type}.gif`;
            }
            enemy.element.innerHTML = `<img src="assets/${gifSrc}?v=${timestamp}" alt="${enemy.type}" style="display: block; width: 100%; height: 100%;">`;
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
    // プレイヤー要素を削除
    if (player.element && player.element.parentNode) {
        player.element.parentNode.removeChild(player.element);
        player.element = null;
    }

    // 敵要素を削除
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
    try {
        game.bgm = new Audio('assets/bgm.mp3');
        game.bgm.loop = true;
        game.bgm.volume = 0.5;  // 音量を50%に設定

        // イベントリスナーでデバッグ
        game.bgm.addEventListener('canplaythrough', () => {
            console.log('BGM: ロード完了、再生可能');
        });
        game.bgm.addEventListener('error', (e) => {
            console.error('BGM: ロードエラー', e);
            console.error('エラー詳細:', game.bgm.error);
        });
        game.bgm.addEventListener('play', () => {
            console.log('BGM: 再生開始');
        });
        game.bgm.addEventListener('pause', () => {
            console.log('BGM: 一時停止');
        });

        // BGMのロード開始
        game.bgm.load();
        console.log('BGM: 初期化完了');
    } catch (error) {
        console.error('BGM初期化エラー:', error);
    }

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

    // デバイスのピクセル比を取得（Retina対応）
    const dpr = window.devicePixelRatio || 1;

    // Canvas の実際の解像度を高く設定
    game.canvas.width = width * dpr;
    game.canvas.height = height * dpr;

    // CSS上の表示サイズは通常サイズ
    game.canvas.style.width = width + 'px';
    game.canvas.style.height = height + 'px';

    // スケール倍率を計算（基準は1200px幅）
    const baseWidth = 1200;
    game.scale = width / baseWidth;

    // スマホ（768px以下）の場合、スクロール速度を1/3 + 10%に、背景を1.25倍ズーム
    if (width <= 768) {
        game.isMobile = true;
        game.scrollSpeed = (game.baseScrollSpeed / 3) * 1.1;  // 1/3の速度から10%アップ
        // 二段ジャンプで背景の95%高さに到達するように調整
        player.jumpPower = -Math.sqrt(height * 0.57);
        game.bgZoom = 1.25;  // 背景を1.25倍に拡大（左右10%ずつカット）
    } else {
        game.isMobile = false;
        game.scrollSpeed = game.baseScrollSpeed;
        player.jumpPower = player.baseJumpPower;  // PCは通常のジャンプ力
        game.bgZoom = 1;  // 通常表示
    }

    // プレイヤーのサイズをスケールに応じて調整
    player.width = player.baseWidth * game.scale;
    player.height = player.baseHeight * game.scale;
    player.hitboxOffsetX = player.baseHitboxOffsetX * game.scale;
    player.hitboxOffsetY = player.baseHitboxOffsetY * game.scale;
    player.hitboxWidth = player.baseHitboxWidth * game.scale;
    player.hitboxHeight = player.baseHitboxHeight * game.scale;

    // 地面の位置を設定
    if (game.isMobile) {
        // モバイル時：キャラが背景画像の上に立つようにボタン領域の上に配置
        const touchControlsHeight = width <= 480 ? 100 : 120;
        player.groundY = height - touchControlsHeight + 25;
    } else {
        // PC時：通常計算
        player.groundY = height - player.height;
    }

    // 初期位置または範囲外の場合は地面に配置
    if (player.y === 0 || player.y > player.groundY) {
        player.y = player.groundY;
    }


    // 既存のベッドと敵のサイズも更新
    updateObjectsScale();
}

// オブジェクトのスケール更新
function updateObjectsScale() {
    // ベッドのサイズ更新
    beds.forEach(bed => {
        if (bed.baseWidth) {
            bed.width = bed.baseWidth * game.scale;
            bed.height = bed.baseHeight * game.scale;
            bed.x = bed.baseX * game.scale;
            bed.y = player.groundY - (bed.baseHeight - player.baseHeight) * game.scale;
        }
    });

    // 敵のサイズ更新
    enemies.forEach(enemy => {
        if (enemy.baseWidth) {
            enemy.width = enemy.baseWidth * game.scale;
            enemy.height = enemy.baseHeight * game.scale;
            enemy.x = enemy.baseX * game.scale;
            enemy.y = player.groundY + 50 * game.scale;
            enemy.hitboxOffsetX = enemy.baseHitboxOffsetX * game.scale;
            enemy.hitboxOffsetY = enemy.baseHitboxOffsetY * game.scale;
            enemy.hitboxWidth = enemy.baseHitboxWidth * game.scale;
            enemy.hitboxHeight = enemy.baseHitboxHeight * game.scale;
        }
    });
}

// イベントリスナー設定
function setupEventListeners() {
    // スタートボタン
    const startButton = document.getElementById('startButton');
    startButton.addEventListener('click', startGame);
    startButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startGame();
    });

    // リトライボタン
    const retryButton = document.getElementById('retryButton');
    retryButton.addEventListener('click', retryGame);
    retryButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        retryGame();
    });

    // 再スタートボタン
    const restartButton = document.getElementById('restartButton');
    restartButton.addEventListener('click', retryGame);
    restartButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        retryGame();
    });

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
        const playPromise = game.bgm.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    console.log('BGM再生開始');
                    btn.textContent = '🔊';
                })
                .catch(e => {
                    console.error('BGM再生エラー:', e);
                    game.bgmEnabled = false;
                    btn.textContent = '🔇';
                });
        }
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
            const playPromise = game.bgm.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => console.error('BGM再生エラー:', e));
            }
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

    // BGM再生（ユーザー操作後なので確実に再生可能）
    if (game.bgm && game.bgmEnabled) {
        game.bgm.currentTime = 0;  // 最初から再生
        const playPromise = game.bgm.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    console.log('✓ ゲーム開始: BGM再生成功');
                    document.getElementById('bgmButton').textContent = '🔊';
                })
                .catch(e => {
                    console.error('✗ BGM再生エラー:', e);
                    // エラー時はボタン状態を更新（アラートは表示しない）
                    game.bgmEnabled = false;
                    document.getElementById('bgmButton').textContent = '🔇';
                });
        }
    } else {
        console.warn('BGMが無効または未初期化');
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

    // 地面の位置を再計算（player.groundY は既に resizeCanvas で設定済み）
    // 念のため再設定
    const container = document.getElementById('gameContainer');
    let height = container.clientHeight;
    const width = container.clientWidth;
    const aspectRatio = 16 / 9;
    if (width / height > aspectRatio) {
        height = (width / aspectRatio);
    }
    
    // 地面の位置を設定
    if (game.isMobile) {
        // モバイル時：キャラが背景画像の上に立つようにボタン領域の上に配置
        const touchControlsHeight = width <= 480 ? 100 : 120;
        player.groundY = height - touchControlsHeight + 25;
    } else {
        // PC時：通常計算
        player.groundY = height - player.height;
    }

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
    player._frameCount = 0;
    player._debugStartTime = null;


    // キャラクター要素をクリア
    clearCharacterElements();

    enemies.length = 0;
    beds.length = 0;
    gifts.length = 0;
    pendingGifts.length = 0;  // 配達予定プレゼントもクリア

    // プレイヤー要素を再作成
    createCharacterElements();

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
    const baseSpacing = 1800;  // 基本間隔
    let baseWidth = 200;
    let baseHeight = 160;
    const baseStartX = 1500;

    // モバイル時は1.2倍のサイズ
    if (game.isMobile) {
        baseWidth *= 1.2;
        baseHeight *= 1.2;
    }

    for (let i = 0; i < game.totalBeds; i++) {
        let bedY = player.groundY - (baseHeight - player.baseHeight) * game.scale;
        
        // モバイル時はベッドも20ピクセル下げる
        if (game.isMobile) {
            bedY += 20;
        }
        
        beds.push({
            baseX: baseStartX + i * baseSpacing,  // 基本位置
            baseWidth: baseWidth,
            baseHeight: baseHeight,
            x: (baseStartX + i * baseSpacing) * game.scale,  // スケール後の位置
            y: bedY,
            width: baseWidth * game.scale,
            height: baseHeight * game.scale,
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
            baseWidth: 120,
            baseHeight: 120,
            baseHitboxOffsetX: 30,
            baseHitboxOffsetY: 30,
            baseHitboxWidth: 60,
            baseHitboxHeight: 60
        },
        {
            type: 'teki1',
            image: images.teki1,
            baseWidth: 120,
            baseHeight: 120,
            baseHitboxOffsetX: 35,
            baseHitboxOffsetY: 35,
            baseHitboxWidth: 50,
            baseHitboxHeight: 60
        },
        {
            type: 'tekiJump',
            image: images.tekiJump,
            baseWidth: 120,
            baseHeight: 120,
            baseHitboxOffsetX: 35,
            baseHitboxOffsetY: 35,
            baseHitboxWidth: 50,
            baseHitboxHeight: 60
        }
    ];

    // ベッドの間に敵を配置（ベッドと重ならないように）
    const bedSpacing = 1800;
    const bedsStartX = 1500;

    for (let i = 0; i < game.totalBeds - 1; i++) {
        const enemyType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
        // ベッドの間に配置（中間地点にランダムに配置）
        const bedX = bedsStartX + i * bedSpacing;
        const enemyBaseX = bedX + 400 + Math.random() * (bedSpacing - 800);

        enemies.push({
            baseX: enemyBaseX,
            baseWidth: enemyType.baseWidth,
            baseHeight: enemyType.baseHeight,
            x: enemyBaseX * game.scale,
            y: player.groundY + 50 * game.scale,
            width: enemyType.baseWidth * game.scale,
            height: enemyType.baseHeight * game.scale,
            type: enemyType.type,
            image: enemyType.image,
            flying: false,
            baseHitboxOffsetX: enemyType.baseHitboxOffsetX,
            baseHitboxOffsetY: enemyType.baseHitboxOffsetY,
            baseHitboxWidth: enemyType.baseHitboxWidth,
            baseHitboxHeight: enemyType.baseHitboxHeight,
            hitboxOffsetX: enemyType.baseHitboxOffsetX * game.scale,
            hitboxOffsetY: enemyType.baseHitboxOffsetY * game.scale,
            hitboxWidth: enemyType.baseHitboxWidth * game.scale,
            hitboxHeight: enemyType.baseHitboxHeight * game.scale
        });

        // 後半（ベッド5以降）は確率を上げてjamadarumaを追加配置
        const jamadarumaProbability = i >= 4 ? 0.5 : 0.3;
        if (Math.random() < jamadarumaProbability) {
            const jamaType = enemyTypes[0];  // jamadaruma
            const jamaBaseX = bedX + 600 + Math.random() * (bedSpacing - 1000);

            enemies.push({
                baseX: jamaBaseX,
                baseWidth: jamaType.baseWidth,
                baseHeight: jamaType.baseHeight,
                x: jamaBaseX * game.scale,
                y: player.groundY + 50 * game.scale,
                width: jamaType.baseWidth * game.scale,
                height: jamaType.baseHeight * game.scale,
                type: jamaType.type,
                image: jamaType.image,
                flying: false,
                baseHitboxOffsetX: jamaType.baseHitboxOffsetX,
                baseHitboxOffsetY: jamaType.baseHitboxOffsetY,
                baseHitboxWidth: jamaType.baseHitboxWidth,
                baseHitboxHeight: jamaType.baseHitboxHeight,
                hitboxOffsetX: jamaType.baseHitboxOffsetX * game.scale,
                hitboxOffsetY: jamaType.baseHitboxOffsetY * game.scale,
                hitboxWidth: jamaType.baseHitboxWidth * game.scale,
                hitboxHeight: jamaType.baseHitboxHeight * game.scale
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
        const playPromise = game.bgm.play();
        if (playPromise !== undefined) {
            playPromise.catch(e => console.error('BGM再生エラー:', e));
        }
    }

    gameLoop();
}

// メインゲームループ
function gameLoop() {
    if (game.state !== GameState.PLAYING) return;

    try {
        update();
        render();
    } catch (error) {
        console.error('ゲームループエラー:', error);
        console.error('スタック:', error.stack);
        // エラーが発生してもゲームを続行
    }

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

    // 上限チェック（画面上端を超えないように）
    if (player.y < 0) {
        player.y = 0;
        player.velocityY = 0;  // 上昇を止める
    }

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
    
    // ループリセット（CSS表示サイズを基準に）
    const resetThreshold = game.canvas.clientWidth;
    if (game.backgroundX <= -resetThreshold) {
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
    const rangeX = 150 * game.scale;  // スケールに応じた配達可能範囲
    const rangeY = 150 * game.scale;
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

    let giftSize = 80 * game.scale;  // スケールに応じたプレゼントサイズ
    
    // モバイル時は1.2倍のサイズ
    if (game.isMobile) {
        giftSize *= 1.2;
    }

    // プレゼントを0.5秒後に表示するため、配達予定に追加
    pendingGifts.push({
        x: bed.x + (bed.width - giftSize) / 2,  // ベッドの中央に配置
        y: bed.y + (bed.height - giftSize) / 2,  // ベッドの中央に配置
        width: giftSize,
        height: giftSize,
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

    // Canvas をクリア
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // デバイスピクセル比でスケール
    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);

    // 画像スムージングを有効化（高品質レンダリング）
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // CSS表示サイズ（デバイスピクセル比の影響を受けない）
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    // 背景描画（Canvasで描画）
    if (game.isMobile) {
        // モバイル時: 背景を1.25倍に拡大して中央から表示（左右10%ずつカット）
        const bgWidth = displayWidth * game.bgZoom;
        const bgHeight = displayHeight * game.bgZoom;
        const offsetX = -(bgWidth - displayWidth) / 2;  // 中央揃え用オフセット
        const offsetY = -(bgHeight - displayHeight) / 2;

        // 3つの背景画像を描画してシームレスループを保証
        ctx.drawImage(images.background, game.backgroundX - displayWidth + offsetX, offsetY, bgWidth, bgHeight);
        ctx.drawImage(images.background, game.backgroundX + offsetX, offsetY, bgWidth, bgHeight);
        ctx.drawImage(images.background, game.backgroundX + displayWidth + offsetX, offsetY, bgWidth, bgHeight);
    } else {
        // PC時: 通常表示
        ctx.drawImage(images.background, game.backgroundX, 0, displayWidth, displayHeight);
        ctx.drawImage(images.background, game.backgroundX + displayWidth, 0, displayWidth, displayHeight);
    }

    // ベッド描画（Canvasで描画）
    beds.forEach(bed => {
        // 画面内のベッドのみ描画（CSS表示サイズ基準）
        const isInView = bed.x > -bed.width && bed.x < displayWidth + 100;

        if (isInView) {
            const bedImage = images.beds[bed.bedNumber];
            if (bedImage && bedImage.complete) {
                ctx.drawImage(bedImage, bed.x, bed.y, bed.width, bed.height);

                // 配達可能な場合は「E」キーのヒントを表示
                if (player.nearBed === bed && !bed.delivered) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                    ctx.font = 'bold 24px Arial';
                    ctx.fillText('Press E or Enter', bed.x, bed.y - 20);
                }
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
    ctx.fillText(`プレゼント: ${game.deliveredPresents}/${game.totalBeds}`, 10, displayHeight - 20);

    // キャラクターの位置を更新（HTML要素でGIFアニメーション）
    updateCharacterPositions();
}

// ページ読み込み時に初期化
window.addEventListener('load', () => {
    console.log('=== ゲーム初期化開始 ===');
    try {
        init();
        console.log('=== ゲーム初期化完了 ===');
    } catch (error) {
        console.error('=== 初期化エラー ===', error);
    }
});

// グローバルエラーハンドラ
window.addEventListener('error', (event) => {
    console.error('グローバルエラー:', event.error);
    console.error('メッセージ:', event.message);
    console.error('ファイル:', event.filename, '行:', event.lineno);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('未処理のPromise拒否:', event.reason);
});
