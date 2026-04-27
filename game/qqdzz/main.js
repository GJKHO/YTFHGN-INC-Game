// 游戏配置
const config = {
    mapWidth: 4000,
    mapHeight: 4000,
    baseMass: 10,
    foodMass: 1,
    virusMass: 100,
    maxCells: 16, // 玩家最大分裂数
    numFoods: 600,
    numBots: 20,
    numViruses: 30,
    colors: ['#FF6B6B', '#4ECDC4', '#556270', '#C7F464', '#C44D58', '#FF9F1C', '#2EC4B6', '#E71D36']
};

// 全局变量
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startMenu = document.getElementById('startMenu');
const startBtn = document.getElementById('startBtn');
const nicknameInput = document.getElementById('nicknameInput');
const gameUI = document.getElementById('gameUI');
const leaderboardList = document.getElementById('leaderboardList');
const scoreVal = document.getElementById('scoreVal');

let width, height;
let gameRunning = false;
let mouseX = 0, mouseY = 0;
let cameraX = 0, cameraY = 0, cameraZoom = 1;

// 实体列表
let nodes = []; // 所有玩家和Bot的细胞
let foods = [];
let viruses = [];
let bullets = []; // 吐出的孢子

// 玩家引用
let player = {
    id: -1,
    cells: [],
    name: '',
    color: '',
    targetX: 0,
    targetY: 0
};

// 工具函数
function randomRange(min, max) { return Math.random() * (max - min) + min; }
function getDist(x1, y1, x2, y2) { return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2); }
function getRandomColor() { return config.colors[Math.floor(Math.random() * config.colors.length)]; }

// 细胞类 (玩家或Bot的一个分身)
class Cell {
    constructor(ownerId, x, y, mass, color, name, isBot) {
        this.ownerId = ownerId; // 归属的玩家ID
        this.x = x;
        this.y = y;
        this.mass = mass;
        this.color = color;
        this.name = name;
        this.isBot = isBot;
        this.vx = 0;
        this.vy = 0;
        this.speedX = 0; // 额外的冲刺速度
        this.speedY = 0;
        this.mergeTimer = 0; // 合球倒计时（帧）
        this.canMerge = false;
        // 刚生成时给一定冷却时间 (比如30秒 = 1800帧)
        this.mergeTimer = 30 * 60; 
    }

    getRadius() {
        return Math.sqrt(this.mass * 100 / Math.PI); // 质量转半径
    }

    getSpeed() {
        // 质量越大速度越慢
        return 8 * Math.pow(this.mass, -0.4); 
    }

    move(targetX, targetY) {
        let r = this.getRadius();
        let speed = this.getSpeed();

        // 冲刺衰减
        this.x += this.speedX;
        this.y += this.speedY;
        this.speedX *= 0.9;
        this.speedY *= 0.9;

        // 向目标移动
        let dist = getDist(this.x, this.y, targetX, targetY);
        if (dist > 0) {
            this.vx = (targetX - this.x) / dist * speed;
            this.vy = (targetY - this.y) / dist * speed;
            this.x += this.vx;
            this.y += this.vy;
        }

        // 边界限制
        this.x = Math.max(r, Math.min(config.mapWidth - r, this.x));
        this.y = Math.max(r, Math.min(config.mapHeight - r, this.y));
    }
}

// 初始化游戏
function init() {
    resize();
    window.addEventListener('resize', resize);
    
    startBtn.addEventListener('click', startGame);
    
    canvas.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX - width / 2) / cameraZoom + cameraX;
        mouseY = (e.clientY - height / 2) / cameraZoom + cameraY;
    });

    // 键盘操作
    window.addEventListener('keydown', (e) => {
        if (!gameRunning) return;
        if (e.code === 'Space') splitPlayer();
        if (e.code === 'KeyW') ejectMass();
    });

    // 生成食物
    for (let i = 0; i < config.numFoods; i++) spawnFood();
    // 生成刺球
    for (let i = 0; i < config.numViruses; i++) spawnVirus();
    // 生成Bot
    for (let i = 0; i < config.numBots; i++) spawnBot(i + 100);

    gameLoop();
}

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}

function startGame() {
    let name = nicknameInput.value.trim() || "Anonymous";
    player.name = name;
    player.id = 1;
    player.color = getRandomColor();
    player.cells = [];
    
    // 生成玩家初始细胞
    spawnCell(player.id, randomRange(0, config.mapWidth), randomRange(0, config.mapHeight), config.baseMass, player.color, player.name, false);
    
    startMenu.style.display = 'none';
    gameUI.style.display = 'block';
    gameRunning = true;
}

function spawnCell(id, x, y, mass, color, name, isBot) {
    let cell = new Cell(id, x, y, mass, color, name, isBot);
    nodes.push(cell);
    return cell;
}

function spawnFood() {
    foods.push({
        x: randomRange(0, config.mapWidth),
        y: randomRange(0, config.mapHeight),
        color: getRandomColor(),
        radius: 5
    });
}

function spawnVirus() {
    viruses.push({
        x: randomRange(0, config.mapWidth),
        y: randomRange(0, config.mapHeight),
        radius: 35 // 视觉半径
    });
}

function spawnBot(id) {
    let names = ["Earth", "Mars", "Moon", "Sun", "Pluto", "Comet", "Star", "Nebula", "Bot", "AI"];
    let name = names[Math.floor(Math.random() * names.length)];
    let color = getRandomColor();
    spawnCell(id, randomRange(0, config.mapWidth), randomRange(0, config.mapHeight), randomRange(10, 50), color, name, true);
}

// 玩家分裂
function splitPlayer() {
    let newCells = [];
    let myCells = nodes.filter(n => n.ownerId === player.id);
    
    if (myCells.length >= config.maxCells) return;

    myCells.forEach(cell => {
        if (cell.mass >= 35 && myCells.length + newCells.length < config.maxCells) {
            let splitMass = cell.mass / 2;
            cell.mass = splitMass;
            cell.mergeTimer = 30 * 60; // 母球也重置冷却
            
            // 创建分裂出的新球
            let newCell = new Cell(player.id, cell.x, cell.y, splitMass, cell.color, cell.name, false);
            newCell.mergeTimer = 30 * 60; // 新球重置冷却
            
            // 计算分裂方向
            let dist = getDist(cell.x, cell.y, mouseX, mouseY);
            let dx = (mouseX - cell.x) / dist;
            let dy = (mouseY - cell.y) / dist;
            
            // 给予冲刺速度
            newCell.speedX = dx * 20;
            newCell.speedY = dy * 20;
            newCell.x += dx * cell.getRadius(); // 稍微前移防止重叠卡住
            newCell.y += dy * cell.getRadius();

            newCells.push(newCell);
        }
    });
    nodes = nodes.concat(newCells);
}

// 玩家吐球
function ejectMass() {
    let myCells = nodes.filter(n => n.ownerId === player.id);
    myCells.forEach(cell => {
        if (cell.mass > 30) {
            cell.mass -= 10;
            
            let dist = getDist(cell.x, cell.y, mouseX, mouseY);
            let dx = (mouseX - cell.x) / dist;
            let dy = (mouseY - cell.y) / dist;
            
            bullets.push({
                x: cell.x + dx * cell.getRadius(),
                y: cell.y + dy * cell.getRadius(),
                vx: dx * 25,
                vy: dy * 25,
                color: cell.color,
                mass: 10,
                radius: 10,
                decay: 30 // 减速计时
            });
        }
    });
}

// 逻辑更新
function update() {
    if (!gameRunning) return;

    // 1. 更新玩家细胞
    let myCells = nodes.filter(n => n.ownerId === player.id);
    
    // 计算摄像机中心（所有分身的重心）
    if (myCells.length > 0) {
        let cx = 0, cy = 0, totalMass = 0;
        myCells.forEach(c => {
            cx += c.x;
            cy += c.y;
            totalMass += c.mass;
        });
        cameraX = cx / myCells.length;
        cameraY = cy / myCells.length;
        
        // 自动缩放
        let size = Math.sqrt(totalMass);
        let targetZoom = 10 / (size + 50) + 0.5; // 简易缩放算法
        cameraZoom += (targetZoom - cameraZoom) * 0.05;
        
        scoreVal.innerText = Math.floor(totalMass);
    } else {
        // 玩家死亡
        // 这里简单处理：重生
        // spawnCell(player.id, randomRange(0, config.mapWidth), randomRange(0, config.mapHeight), config.baseMass, player.color, player.name, false);
    }

    // 2. 更新所有细胞移动
    nodes.forEach(node => {
        if (node.ownerId === player.id) {
            node.move(mouseX, mouseY);
        } else if (node.isBot) {
            // 简单的Bot AI
            botLogic(node);
        }
    });

    // 3. 更新子弹
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.x += b.vx;
        b.y += b.vy;
        b.vx *= 0.9;
        b.vy *= 0.9;
        if (Math.abs(b.vx) < 0.1 && Math.abs(b.vy) < 0.1) {
            // 变成食物
            foods.push({x: b.x, y: b.y, color: b.color, radius: 10, mass: 10});
            bullets.splice(i, 1);
        }
    }

    // 4. 碰撞检测
    checkCollisions();
    
    // 5. 补充食物
    while (foods.length < config.numFoods) spawnFood();
    while (nodes.filter(n => n.isBot).length < config.numBots) spawnBot(Math.random());
    
    updateLeaderboard();
}

// Bot AI 逻辑
function botLogic(bot) {
    // 寻找最近的食物或比自己小的球
    let target = null;
    let minD = Infinity;
    
    // 1. 寻找食物
    foods.forEach(f => {
        let d = getDist(bot.x, bot.y, f.x, f.y);
        if (d < 300 && d < minD) {
            minD = d;
            target = f;
        }
    });
    
    // 2. 躲避比自己大的球
    let runX = 0, runY = 0;
    nodes.forEach(other => {
        if (other === bot) return;
        let d = getDist(bot.x, bot.y, other.x, other.y);
        if (d < bot.getRadius() * 3 && other.mass > bot.mass * 1.25) {
            // 逃跑向量
            runX += bot.x - other.x;
            runY += bot.y - other.y;
        }
    });
    
    let moveX = bot.x;
    let moveY = bot.y;

    if (runX !== 0 || runY !== 0) {
        moveX = bot.x + runX;
        moveY = bot.y + runY;
    } else if (target) {
        moveX = target.x;
        moveY = target.y;
    } else {
        // 随机漫步
        if (Math.random() < 0.05) {
            bot.targetX = randomRange(0, config.mapWidth);
            bot.targetY = randomRange(0, config.mapHeight);
        }
        moveX = bot.targetX || bot.x;
        moveY = bot.targetY || bot.y;
    }

    bot.move(moveX, moveY);
}

function checkCollisions() {
    // 1. 细胞吃食物
    nodes.forEach(cell => {
        let r = cell.getRadius();
        for (let i = foods.length - 1; i >= 0; i--) {
            let f = foods[i];
            if (getDist(cell.x, cell.y, f.x, f.y) < r) {
                cell.mass += (f.mass || 1);
                foods.splice(i, 1);
            }
        }
    });

    // 更新合球倒计时
    nodes.forEach(n => {
        if (n.mergeTimer > 0) n.mergeTimer--;
        else n.canMerge = true;
    });

    // 2. 细胞互吃与合并
    // 排序：按质量从大到小，大的先判定吃小的
    nodes.sort((a, b) => b.mass - a.mass);

    // 刺球碰撞检测
    // 使用一个临时队列记录扎刺事件，避免在遍历中修改数组导致的问题
    let splitEvents = [];
    
    nodes.forEach(cell => {
        if (cell.mass < config.virusMass) return; 
        for (let i = viruses.length - 1; i >= 0; i--) {
            let v = viruses[i];
            if (getDist(cell.x, cell.y, v.x, v.y) < cell.getRadius()) {
                viruses.splice(i, 1);
                spawnVirus(); 
                splitEvents.push(cell);
                break; // 一个球一帧只扎一个刺
            }
        }
    });

    // 处理扎刺分裂
    splitEvents.forEach(cell => {
        let maxSplits = config.maxCells - nodes.filter(n => n.ownerId === cell.ownerId).length;
        let numSplits = Math.min(maxSplits, 8);
        
        if (numSplits > 0) {
            let massPerPiece = cell.mass / (numSplits + 1);
            cell.mass = massPerPiece;
            cell.mergeTimer = 30 * 60;
            for (let k = 0; k < numSplits; k++) {
                let angle = Math.random() * Math.PI * 2;
                // 关键修复：添加随机偏移量，防止 d=0 导致的 NaN 错误
                let offsetX = Math.cos(angle) * (cell.getRadius() + 5);
                let offsetY = Math.sin(angle) * (cell.getRadius() + 5);
                
                let nc = spawnCell(cell.ownerId, cell.x + offsetX, cell.y + offsetY, massPerPiece, cell.color, cell.name, cell.isBot);
                nc.speedX = Math.cos(angle) * 12;
                nc.speedY = Math.sin(angle) * 12;
                nc.mergeTimer = 30 * 60;
            }
        }
    });

    // 重新排序（因为质量变了，且新增了球）
    nodes.sort((a, b) => b.mass - a.mass);
    
    for (let i = 0; i < nodes.length; i++) {
        let eater = nodes[i];
        for (let j = nodes.length - 1; j > i; j--) {
            let victim = nodes[j];
            
            // 同一玩家
            if (eater.ownerId === victim.ownerId) {
                let d = getDist(eater.x, eater.y, victim.x, victim.y);
                let rEater = eater.getRadius();
                let rVictim = victim.getRadius();
                
                // 修复 d=0 的情况
                if (d === 0) {
                    d = 1; 
                    victim.x += 1; // 强制错开
                }

                // 检查合并
                
                if (eater.canMerge && victim.canMerge && d < rEater + rVictim / 2) {
                     // 合并！
                     eater.mass += victim.mass;
                     nodes.splice(j, 1);
                     continue;
                }

                // 未合并时：推挤逻辑
                if (d < rEater + rVictim) {
                    let pushX = (victim.x - eater.x) / d;
                    let pushY = (victim.y - eater.y) / d;
                    // 简单的推开
                    victim.x += pushX * 1;
                    victim.y += pushY * 1;
                }
                continue; 
            }

            // 吞噬判定: 质量大 20% 且距离足够近
            if (eater.mass > victim.mass * 1.20) {
                let dist = getDist(eater.x, eater.y, victim.x, victim.y);
                if (dist < eater.getRadius() - victim.getRadius() * 0.4) {
                    // 吃掉
                    eater.mass += victim.mass;
                    nodes.splice(j, 1);
                    
                    // 如果是玩家被吃，GameOver
                    if (victim.ownerId === player.id && nodes.filter(n=>n.ownerId===player.id).length===0) {
                         alert("You were eaten!");
                         location.reload();
                    }
                }
            }
        }
    }
}

function updateLeaderboard() {
    // 简单的按总质量排名的逻辑
    let scores = {};
    nodes.forEach(n => {
        if (!scores[n.ownerId]) scores[n.ownerId] = { mass: 0, name: n.name, id: n.ownerId };
        scores[n.ownerId].mass += n.mass;
    });
    
    let sorted = Object.values(scores).sort((a, b) => b.mass - a.mass).slice(0, 10);
    
    leaderboardList.innerHTML = '';
    sorted.forEach(s => {
        let li = document.createElement('li');
        li.innerText = `${s.name}: ${Math.floor(s.mass)}`;
        if (s.id === player.id) li.className = 'me';
        leaderboardList.appendChild(li);
    });
}

// 渲染
function draw() {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(cameraZoom, cameraZoom);
    ctx.translate(-cameraX, -cameraY);

    // 绘制网格
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= config.mapWidth; x += 50) {
        ctx.moveTo(x, 0); ctx.lineTo(x, config.mapHeight);
    }
    for (let y = 0; y <= config.mapHeight; y += 50) {
        ctx.moveTo(0, y); ctx.lineTo(config.mapWidth, y);
    }
    ctx.stroke();

    // 绘制边界
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, config.mapWidth, config.mapHeight);

    // 绘制食物
    foods.forEach(f => {
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
        ctx.fill();
    });
    
    // 绘制子弹
    bullets.forEach(b => {
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
    });

    // 绘制刺球
    ctx.fillStyle = '#33FF33';
    viruses.forEach(v => {
        ctx.beginPath();
        // 简单的齿轮形状模拟
        let r = v.radius;
        for (let i = 0; i < 20; i++) {
            let angle = (Math.PI * 2 * i) / 20;
            let rEff = r + (i % 2 === 0 ? 5 : -2);
            ctx.lineTo(v.x + Math.cos(angle) * rEff, v.y + Math.sin(angle) * rEff);
        }
        ctx.fill();
    });

    // 绘制细胞（按质量从小到大绘制，防止大球遮挡逻辑错误，但在视觉上应该大球遮挡小球，所以从小到大画没问题）
    nodes.sort((a, b) => a.mass - b.mass).forEach(node => {
        let r = node.getRadius();
        
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fill();
        
        // 名字
        if (r > 15) {
            ctx.fillStyle = 'white';
            ctx.font = `bold ${Math.max(12, r * 0.4)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.name, node.x, node.y);
        }
    });

    ctx.restore();
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

init();
