// Game variables
let player;
let bullets = [];
let enemies = [];
let explosions = [];
let powerUps = [];
let stars = [];
let score = 0;
let finalScore = 0;
let highScore = 0;
let level = 1;
let lives = 3;
let gameState = "start"; // start, playing, gameOver, leaderboard
let killStreak = 0;
let lastKillTime = 0;
let comboMultiplier = 1;
let comboTimer = 0;
let comboText = "";
let comboTextSize = 24;
let comboTextAlpha = 255;
let comboTextColor;
let levelUpTime = 0;
let levelUpTextSize = 36;
let levelUpTextAlpha = 255;
let gameOverTime = 0;
let gameOverTextSize = 48;
let gameOverTextAlpha = 0;
let restartTextAlpha = 0;
let restartTextSize = 24;
let playerImage;
let enemyImage;
let bulletImage;
let explosionImages = [];
let powerUpImage;
let backgroundImage;
let starImage;
let enemyBulletImage;
let enemyBullets = [];
let enemyFireRate = 0.005; // Chance of enemy firing per frame
let enemyBulletSpeed = 5;
let enemySpeed = 2;
let enemySpawnRate = 0.02; // Chance of enemy spawning per frame
let enemyMaxSpeed = 3;
let enemyHealth = 1;
let playerInvincible = false;
let playerInvincibleTime = 0;
let playerInvincibleDuration = 2000; // 2 seconds
let playerBlinkRate = 100; // milliseconds
let playerVisible = true;
let playerShield = 0;
let shieldImage;
let shieldAlpha = 150;
let shieldPulseRate = 0.05;
let shieldPulseAmount = 50;
let shieldPulseOffset = 0;
let lastEnemySpawnTime = 0;
let enemySpawnCooldown = 500; // milliseconds
let lastBulletTime = 0;
let bulletCooldown = 250; // milliseconds
let bulletSpeed = 10;
let starSpeed = 2;
let starSpawnRate = 0.1; // Chance of star spawning per frame
let starMaxSpeed = 5;
let powerUpSpawnRate = 0.001; // Chance of power-up spawning per frame
let powerUpSpeed = 2;
let powerUpDuration = 5000; // 5 seconds
let powerUpActive = false;
let powerUpType = "";
let powerUpStartTime = 0;
let powerUpTextSize = 24;
let powerUpTextAlpha = 255;
let powerUpText = "";
let rapidFireActive = false;
let rapidFireBulletCooldown = 100; // milliseconds
let tripleFireActive = false;
let shieldPowerUpActive = false;
let scoreMultiplierActive = false;
let scoreMultiplier = 1;
let enemyKillPoints = 10;
let levelUpPoints = 100;
let levelUpPointsIncrement = 50;
let nextLevelPoints = levelUpPoints;
let levelUpSound;
let shootSound;
let explosionSound;
let powerUpSound;
let gameOverSound;
let backgroundMusic;
let musicPlaying = false;
let soundEffectsEnabled = true;
let musicEnabled = true;
let touchStartX = 0;
let touchStartY = 0;
let isShooting = false;
let shootInterval;
let isMobile = false;
let mobileControlsVisible = false;
let leftButton, rightButton, shootButton;
let leaderboardData = [];
let leaderboardPage = 0;
let leaderboardItemsPerPage = 10;
let supabase;
let leaderboardLoaded = false;
let leaderboardError = null;

// Email form variables
let emailFormDiv;
let emailInput;
let submitButton;
let cancelButton;
let inputMessage;
let emailFormVisible = false;
let viewLeaderboardButton;
let submitScoreButton;

const WIDTH = 800;
const HEIGHT = 600;

function setup() {
  createCanvas(800, 600);
  
  // Initialize game state
  gameState = "start";
  
  // Initialize player
  player = {
    x: width / 2,
    y: height - 50
  };
  
  // Initialize game variables
  score = 0;
  finalScore = 0;
  highScore = 0;
  level = 1;
  lives = 3;
  killStreak = 0;
  nextLevelPoints = levelUpPoints;
  
  // Initialize time tracking
  lastBulletTime = 0;
  lastEnemySpawnTime = 0;
  gameOverTime = 0;
  levelUpTime = 0;
  
  // Try to initialize Supabase client
  try {
    console.log("Initializing Supabase client in sketch.js...");
    
    // Check if we already have a Supabase client from index.html
    if (window.supabase && typeof window.supabase.from === 'function') {
      console.log("Using Supabase client from index.html");
      supabase = window.supabase;
    } else {
      // Try to create a new client
      if (window.SUPABASE_URL && window.SUPABASE_KEY) {
        console.log("Attempting to create a new Supabase client...");
        try {
          // Make sure the Supabase library is loaded
          if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
            supabase = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
            console.log("Successfully created new Supabase client");
          } else {
            throw new Error("Supabase library not loaded correctly. Make sure the Supabase script is included before sketch.js");
          }
        } catch (createError) {
          console.error("Error creating Supabase client:", createError);
          throw createError;
        }
      } else {
        throw new Error("Supabase configuration missing. Make sure SUPABASE_URL and SUPABASE_KEY are defined.");
      }
    }
  } catch (e) {
    console.error("Error initializing Supabase client in sketch.js:", e);
    leaderboardError = "Supabase client initialization failed: " + e.message;
  }
  
  // Detect mobile devices
  isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Create mobile controls if needed
  if (isMobile) {
    createMobileControls();
  }
  
  // Initialize game objects arrays
  bullets = [];
  enemies = [];
  enemyBullets = [];
  explosions = [];
  powerUps = [];
  stars = [];
  
  // Create stars for background
  for (let i = 0; i < 100; i++) {
    stars.push({
      x: random(width),
      y: random(height),
      size: random(1, 3),
      speed: random(0.5, 2),
      brightness: random(150, 255)
    });
  }
  
  // Initialize sound effects with error handling
  try {
    shootSound = new p5.Oscillator('sine');
    shootSound.amp(0);
    shootSound.start();
    
    explosionSound = new p5.Noise();
    explosionSound.amp(0);
    explosionSound.start();
  } catch (e) {
    console.warn("Sound library not available, using fallback sound handling");
    // Create dummy sound objects with the same methods
    shootSound = {
      freq: function() {},
      amp: function() {}
    };
    explosionSound = {
      amp: function() {}
    };
  }
  
  // Get DOM elements
  emailInput = document.getElementById('player-email');
  submitButton = document.getElementById('submit-score');
  cancelButton = document.getElementById('cancel-submit');
  shareButton = document.getElementById('share-button');
  inputMessage = document.getElementById('input-message');
  
  // Add event listeners
  submitButton.addEventListener('click', submitScore);
  cancelButton.addEventListener('click', hideEmailForm);
  shareButton.addEventListener('click', shareToX);
}

function draw() {
  // Draw the space background
  drawBackground();
  
  // Handle different game states
  if (gameState === "start") {
    drawTitleScreen();
    return;
  } else if (gameState === "gameOver") {
    drawGameOverScreen();
    return;
  } else if (gameState === "leaderboard") {
    drawLeaderboardScreen();
    return;
  }
  
  // If we're here, we're in the "playing" state
  
  // Update player
  if (player) {
    // Handle player movement with arrow keys
    if (keyIsDown(LEFT_ARROW)) {
      player.x -= 5;
    }
    if (keyIsDown(RIGHT_ARROW)) {
      player.x += 5;
    }
    if (keyIsDown(UP_ARROW)) {
      player.y -= 3;
    }
    if (keyIsDown(DOWN_ARROW)) {
      player.y += 3;
    }
    
    // Keep player within screen bounds
    player.x = constrain(player.x, 20, width - 20);
    player.y = constrain(player.y, 20, height - 20);
    
    // Draw player
    fill(0, 150, 255);
    ellipse(player.x, player.y, 40, 40);
    
    // Draw shield if active
    if (playerShield > 0) {
      noFill();
      stroke(0, 200, 255, shieldAlpha + sin(frameCount * shieldPulseRate + shieldPulseOffset) * shieldPulseAmount);
      strokeWeight(3);
      ellipse(player.x, player.y, 60, 60);
      noStroke();
    }
  } else {
    // Initialize player if it doesn't exist
    player = {
      x: width / 2,
      y: height - 50
    };
  }
  
  // Update and draw bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    
    // Move bullet
    if (bullet.isPlayerBullet) {
      bullet.y -= bullet.speed;
    } else {
      bullet.y += bullet.speed;
    }
    
    // Draw bullet
    if (bullet.isPlayerBullet) {
      fill(0, 255, 255);
    } else {
      fill(255, 100, 0);
    }
    ellipse(bullet.x, bullet.y, 8, 8);
    
    // Remove bullets that go off screen
    if (bullet.y < 0 || bullet.y > height) {
      bullets.splice(i, 1);
    }
  }
  
  // Spawn enemies randomly
  if (random() < enemySpawnRate && millis() - lastEnemySpawnTime > enemySpawnCooldown) {
    enemies.push({
      x: random(width),
      y: -20,
      speed: random(1, enemyMaxSpeed),
      health: enemyHealth
    });
    lastEnemySpawnTime = millis();
  }
  
  // Update and draw enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    
    // Move enemy
    enemy.y += enemy.speed;
    
    // Draw enemy
    fill(255, 0, 100);
    ellipse(enemy.x, enemy.y, 30, 30);
    
    // Enemy shoots randomly
    if (random() < enemyFireRate) {
      enemyBullets.push({
        x: enemy.x,
        y: enemy.y + 15,
        speed: enemyBulletSpeed,
        isPlayerBullet: false
      });
    }
    
    // Check for collision with player bullets
    for (let j = bullets.length - 1; j >= 0; j--) {
      const bullet = bullets[j];
      if (bullet.isPlayerBullet && dist(bullet.x, bullet.y, enemy.x, enemy.y) < 20) {
        // Enemy hit by player bullet
        enemy.health--;
        bullets.splice(j, 1);
        
        // Create explosion effect
        explosions.push({
          x: enemy.x,
          y: enemy.y,
          size: 10,
          maxSize: 30,
          alpha: 255
        });
        
        // Check if enemy is destroyed
        if (enemy.health <= 0) {
          // Increase score
          score += 10 * scoreMultiplier;
          killStreak++;
          
          // Create larger explosion
          explosions.push({
            x: enemy.x,
            y: enemy.y,
            size: 20,
            maxSize: 50,
            alpha: 255
          });
          
          // Remove enemy
          enemies.splice(i, 1);
          
          // Spawn power-up randomly
          if (random() < powerUpSpawnRate) {
            powerUps.push({
              x: enemy.x,
              y: enemy.y,
              type: floor(random(4)), // 0: shield, 1: triple fire, 2: rapid fire, 3: score multiplier
              speed: powerUpSpeed
            });
          }
          
          break;
        }
      }
    }
    
    // Check if enemy has gone off screen
    if (enemy.y > height + 20) {
      enemies.splice(i, 1);
    }
    
    // Check for collision with player
    if (!playerInvincible && player && dist(player.x, player.y, enemy.x, enemy.y) < 30) {
      // Player hit by enemy
      if (playerShield > 0) {
        playerShield--;
        
        // Create shield impact effect
        explosions.push({
          x: enemy.x,
          y: enemy.y,
          size: 20,
          maxSize: 40,
          alpha: 255
        });
        
        // Remove enemy
        enemies.splice(i, 1);
      } else {
        // Player loses a life
        lives--;
        
        // Make player temporarily invincible
        playerInvincible = true;
        playerInvincibleTime = millis();
        
        // Create explosion
        explosions.push({
          x: player.x,
          y: player.y,
          size: 30,
          maxSize: 60,
          alpha: 255
        });
        
        // Check for game over
        if (lives <= 0) {
          // Game over
          gameState = "gameOver";
          finalScore = score;
          gameOverTime = millis();
          
          // Save final game stats for leaderboard submission
          window.finalGameStats = {
            score: finalScore,
            level: level,
            killStreak: killStreak
          };
          
          console.log("Game over! Final score:", finalScore);
        }
      }
    }
  }
  
  // Update and draw enemy bullets
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const bullet = enemyBullets[i];
    
    // Move bullet
    bullet.y += bullet.speed;
    
    // Draw bullet
    fill(255, 100, 0);
    ellipse(bullet.x, bullet.y, 8, 8);
    
    // Remove bullets that go off screen
    if (bullet.y > height) {
      enemyBullets.splice(i, 1);
      continue;
    }
    
    // Check for collision with player
    if (!playerInvincible && player && dist(bullet.x, bullet.y, player.x, player.y) < 20) {
      // Player hit by enemy bullet
      if (playerShield > 0) {
        playerShield--;
        
        // Create shield impact effect
        explosions.push({
          x: bullet.x,
          y: bullet.y,
          size: 15,
          maxSize: 30,
          alpha: 255
        });
      } else {
        // Player loses a life
        lives--;
        
        // Make player temporarily invincible
        playerInvincible = true;
        playerInvincibleTime = millis();
        
        // Create explosion
        explosions.push({
          x: player.x,
          y: player.y,
          size: 30,
          maxSize: 60,
          alpha: 255
        });
        
        // Check for game over
        if (lives <= 0) {
          // Game over
          gameState = "gameOver";
          finalScore = score;
          gameOverTime = millis();
          
          // Save final game stats for leaderboard submission
          window.finalGameStats = {
            score: finalScore,
            level: level,
            killStreak: killStreak
          };
          
          console.log("Game over! Final score:", finalScore);
        }
      }
      
      // Remove the bullet
      enemyBullets.splice(i, 1);
    }
  }
  
  // Update and draw power-ups
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const powerUp = powerUps[i];
    
    // Move power-up
    powerUp.y += powerUp.speed;
    
    // Draw power-up based on type
    switch (powerUp.type) {
      case 0: // Shield
        fill(0, 100, 255);
        break;
      case 1: // Triple fire
        fill(255, 0, 255);
        break;
      case 2: // Rapid fire
        fill(255, 150, 0);
        break;
      case 3: // Score multiplier
        fill(255, 255, 0);
        break;
    }
    ellipse(powerUp.x, powerUp.y, 20, 20);
    
    // Check if power-up has gone off screen
    if (powerUp.y > height + 20) {
      powerUps.splice(i, 1);
      continue;
    }
    
    // Check for collision with player
    if (player && dist(player.x, player.y, powerUp.x, powerUp.y) < 30) {
      // Apply power-up effect
      switch (powerUp.type) {
        case 0: // Shield
          playerShield = 3;
          break;
        case 1: // Triple fire
          tripleFireActive = true;
          setTimeout(() => { tripleFireActive = false; }, powerUpDuration);
          break;
        case 2: // Rapid fire
          rapidFireActive = true;
          bulletCooldown = rapidFireBulletCooldown;
          setTimeout(() => { 
            rapidFireActive = false; 
            bulletCooldown = 250; 
          }, powerUpDuration);
          break;
        case 3: // Score multiplier
          scoreMultiplier = 2;
          setTimeout(() => { scoreMultiplier = 1; }, powerUpDuration);
          break;
      }
      
      // Create power-up collection effect
      explosions.push({
        x: powerUp.x,
        y: powerUp.y,
        size: 10,
        maxSize: 40,
        alpha: 255
      });
      
      // Remove power-up
      powerUps.splice(i, 1);
    }
  }
  
  // Update and draw explosions
  for (let i = explosions.length - 1; i >= 0; i--) {
    const explosion = explosions[i];
    
    // Grow explosion
    explosion.size += 2;
    explosion.alpha -= 10;
    
    // Draw explosion
    fill(255, 100, 0, explosion.alpha);
    ellipse(explosion.x, explosion.y, explosion.size, explosion.size);
    
    // Remove finished explosions
    if (explosion.size >= explosion.maxSize || explosion.alpha <= 0) {
      explosions.splice(i, 1);
    }
  }
  
  // Check player invincibility
  if (playerInvincible) {
    // Make player blink
    if (frameCount % 10 < 5) {
      // Draw player with reduced opacity
      fill(0, 150, 255, 100);
      ellipse(player.x, player.y, 40, 40);
    }
    
    // Check if invincibility should end
    if (millis() - playerInvincibleTime > playerInvincibleDuration) {
      playerInvincible = false;
    }
  }
  
  // Draw HUD
  fill(255);
  textSize(20);
  textAlign(LEFT);
  text(`Score: ${score}`, 20, 30);
  text(`Lives: ${lives}`, 20, 60);
  text(`Level: ${level}`, 20, 90);
  
  // Draw power-up indicators
  textAlign(RIGHT);
  if (tripleFireActive) {
    fill(255, 0, 255);
    text("Triple Fire", width - 20, 30);
  }
  if (rapidFireActive) {
    fill(255, 150, 0);
    text("Rapid Fire", width - 20, 60);
  }
  if (scoreMultiplier > 1) {
    fill(255, 255, 0);
    text(`Score x${scoreMultiplier}`, width - 20, 90);
  }
  if (playerShield > 0) {
    fill(0, 100, 255);
    text(`Shield: ${playerShield}`, width - 20, 120);
  }
  
  // Level up logic
  if (score >= nextLevelPoints) {
    level++;
    nextLevelPoints += levelUpPoints + (level - 1) * levelUpPointsIncrement;
    
    // Increase difficulty
    enemySpawnRate += 0.005;
    enemyMaxSpeed += 0.5;
    enemyHealth = Math.ceil(level / 3);
    
    // Show level up message
    levelUpTime = millis();
    levelUpTextAlpha = 255;
  }
  
  // Draw level up message
  if (millis() - levelUpTime < 2000) {
    textAlign(CENTER);
    textSize(levelUpTextSize);
    fill(0, 255, 0, levelUpTextAlpha);
    text(`LEVEL ${level}!`, width / 2, height / 2);
    levelUpTextAlpha -= 2;
  }
}

// Function to draw the title screen
function drawTitleScreen() {
  // Draw title
  textAlign(CENTER, CENTER);
  fill(0, 150, 255);
  textSize(60);
  text("AI SPACE DEFENDER", width / 2, height / 3);
  
  // Draw subtitle
  fill(200, 200, 255);
  textSize(24);
  text("DEFEND EARTH FROM ALIEN INVASION", width / 2, height / 3 + 60);
  
  // Draw instructions
  fill(255);
  textSize(20);
  text("ARROW KEYS: MOVE", width / 2, height / 2 + 40);
  text("SPACEBAR: SHOOT", width / 2, height / 2 + 70);
  
  // Draw start prompt
  if (frameCount % 60 < 30) {
    fill(0, 255, 200);
    textSize(30);
    text("PRESS SPACEBAR TO START", width / 2, height * 3/4);
  }
  
  // Draw leaderboard button
  fill(100, 100, 255);
  rect(width / 2 - 100, height * 3/4 + 50, 200, 40, 10);
  fill(255);
  textSize(20);
  text("VIEW LEADERBOARD", width / 2, height * 3/4 + 70);
  
  // Check for mouse click on leaderboard button
  if (mouseIsPressed && 
      mouseX > width / 2 - 100 && mouseX < width / 2 + 100 &&
      mouseY > height * 3/4 + 50 && mouseY < height * 3/4 + 90) {
    fetchLeaderboard();
    gameState = "leaderboard";
  }
}

// Function to draw the leaderboard screen
function drawLeaderboardScreen() {
  // Draw title
  textAlign(CENTER, CENTER);
  fill(0, 150, 255);
  textSize(40);
  text("LEADERBOARD", width / 2, 80);
  
  // Check if leaderboard is loading
  if (!leaderboardLoaded && !leaderboardError) {
    fill(255);
    textSize(24);
    text("Loading scores...", width / 2, height / 2);
  } 
  // Check if there was an error loading the leaderboard
  else if (leaderboardError) {
    fill(255, 50, 50);
    textSize(24);
    text("Error loading leaderboard", width / 2, height / 2);
    textSize(16);
    text(leaderboardError, width / 2, height / 2 + 30);
  } 
  // Display leaderboard data
  else if (leaderboardData.length > 0) {
    // Header
    fill(200, 200, 255);
    textSize(20);
    textAlign(LEFT, CENTER);
    text("RANK", 100, 130);
    text("EMAIL", 250, 130);
    text("SCORE", 500, 130);
    text("LEVEL", 600, 130);
    
    // Calculate start and end indices for pagination
    const startIndex = leaderboardPage * leaderboardItemsPerPage;
    const endIndex = Math.min(startIndex + leaderboardItemsPerPage, leaderboardData.length);
    
    // Display scores
    fill(255);
    textSize(16);
    for (let i = startIndex; i < endIndex; i++) {
      const entry = leaderboardData[i];
      const y = 170 + (i - startIndex) * 30;
      
      // Format email for display (privacy)
      let displayEmail = entry.email;
      if (displayEmail && displayEmail.includes('@')) {
        const atIndex = displayEmail.indexOf('@');
        displayEmail = displayEmail.substring(0, 3) + "..." + displayEmail.substring(atIndex);
      }
      
      // Display rank, email, score, and level
      text(`${i + 1}.`, 100, y);
      text(displayEmail, 250, y);
      text(entry.score, 500, y);
      text(entry.level, 600, y);
    }
    
    // Pagination controls if needed
    if (leaderboardData.length > leaderboardItemsPerPage) {
      // Previous page button
      if (leaderboardPage > 0) {
        fill(100, 100, 255);
        rect(width / 2 - 150, height - 80, 100, 40, 10);
        fill(255);
        textSize(20);
        textAlign(CENTER, CENTER);
        text("PREV", width / 2 - 100, height - 60);
      }
      
      // Next page button
      if ((leaderboardPage + 1) * leaderboardItemsPerPage < leaderboardData.length) {
        fill(100, 100, 255);
        rect(width / 2 + 50, height - 80, 100, 40, 10);
        fill(255);
        textSize(20);
        textAlign(CENTER, CENTER);
        text("NEXT", width / 2 + 100, height - 60);
      }
      
      // Page indicator
      fill(255);
      textSize(16);
      textAlign(CENTER, CENTER);
      text(`Page ${leaderboardPage + 1} of ${Math.ceil(leaderboardData.length / leaderboardItemsPerPage)}`, width / 2, height - 60);
    }
  } 
  // No scores available
  else {
    fill(255);
    textSize(24);
    text("No scores yet. Be the first!", width / 2, height / 2);
  }
  
  // Back button
  fill(100, 100, 255);
  rect(width / 2 - 100, height - 140, 200, 40, 10);
  fill(255);
  textSize(20);
  textAlign(CENTER, CENTER);
  text("BACK TO MENU", width / 2, height - 120);
  
  // Check for mouse click on back button
  if (mouseIsPressed && 
      mouseX > width / 2 - 100 && mouseX < width / 2 + 100 &&
      mouseY > height - 140 && mouseY < height - 100) {
    gameState = "start";
  }
  
  // Check for mouse click on pagination buttons
  if (mouseIsPressed && leaderboardData.length > leaderboardItemsPerPage) {
    // Previous page
    if (leaderboardPage > 0 && 
        mouseX > width / 2 - 150 && mouseX < width / 2 - 50 &&
        mouseY > height - 80 && mouseY < height - 40) {
      leaderboardPage--;
    }
    
    // Next page
    if ((leaderboardPage + 1) * leaderboardItemsPerPage < leaderboardData.length && 
        mouseX > width / 2 + 50 && mouseX < width / 2 + 150 &&
        mouseY > height - 80 && mouseY < height - 40) {
      leaderboardPage++;
    }
  }
}

function drawGameOverScreen() {
  // Draw semi-transparent background
  fill(0, 0, 0, 200);
  rect(0, 0, width, height);
  
  // Calculate time since game over
  const timeSinceGameOver = millis() - gameOverTime;
  
  // Animate game over text
  if (timeSinceGameOver < 2000) {
    gameOverTextAlpha = map(timeSinceGameOver, 0, 1000, 0, 255);
    gameOverTextSize = map(timeSinceGameOver, 0, 1000, 72, 48);
  } else {
    gameOverTextAlpha = 255;
    gameOverTextSize = 48;
  }
  
  // Animate restart text
  if (timeSinceGameOver > 1000) {
    restartTextAlpha = map(timeSinceGameOver, 1000, 2000, 0, 255);
  } else {
    restartTextAlpha = 0;
  }
  
  // Draw game over text
  textSize(gameOverTextSize);
  fill(255, 0, 0, gameOverTextAlpha);
  textAlign(CENTER, CENTER);
  text("GAME OVER", width / 2, height / 3 - 50);
  
  // Draw final score
  textSize(36);
  fill(255, 255, 255, gameOverTextAlpha);
  text(`FINAL SCORE: ${finalScore}`, width / 2, height / 3 + 20);
  
  // Draw stats
  textSize(24);
  fill(200, 200, 255, gameOverTextAlpha);
  text(`LEVEL REACHED: ${level}`, width / 2, height / 3 + 70);
  text(`ENEMIES DESTROYED: ${killStreak}`, width / 2, height / 3 + 110);
  
  // Draw high score
  if (finalScore > highScore && finalScore > 0) {
    textSize(28);
    fill(255, 255, 0, gameOverTextAlpha);
    text("NEW HIGH SCORE!", width / 2, height / 3 + 160);
  } else if (highScore > 0) {
    textSize(24);
    fill(180, 180, 180, gameOverTextAlpha);
    text(`HIGH SCORE: ${highScore}`, width / 2, height / 3 + 160);
  }
  
  // Draw restart instructions
  if (timeSinceGameOver > 1000) {
    textSize(restartTextSize);
    fill(255, 255, 255, restartTextAlpha);
    text("PRESS 'R' TO RESTART", width / 2, height - 100);
    
    // Draw submit score button
    if (finalScore > 0 && timeSinceGameOver > 1500) {
      // Create a button to submit score if it doesn't exist
      if (!submitScoreButton) {
        submitScoreButton = createButton('SUBMIT TO LEADERBOARD');
        submitScoreButton.position(width / 2 - 100, height / 2 + 50);
        submitScoreButton.class('game-button');
        submitScoreButton.mousePressed(showEmailForm);
      }
    }
  }
}

// Function to draw the space background with stars
function drawBackground() {
  // Create a gradient background
  background(0);
  
  // Draw stars
  for (let i = 0; i < stars.length; i++) {
    const star = stars[i];
    
    // Update star position
    star.y += star.speed;
    
    // Wrap stars around when they go off screen
    if (star.y > height) {
      star.y = 0;
      star.x = random(width);
    }
    
    // Calculate twinkle effect
    const twinkle = sin(frameCount * 0.05 + i) * 50;
    const brightness = constrain(star.brightness + twinkle, 100, 255);
    
    // Draw star
    fill(brightness);
    noStroke();
    ellipse(star.x, star.y, star.size, star.size);
    
    // Draw glow for larger stars
    if (star.size > 1.5) {
      fill(brightness, 100);
      ellipse(star.x, star.y, star.size * 2, star.size * 2);
    }
  }
  
  // Occasionally add a shooting star
  if (random() < 0.01) {
    const shootingStar = {
      x: random(width),
      y: 0,
      length: random(50, 150),
      speed: random(10, 20),
      angle: random(PI/6, PI/3),
      alpha: 255
    };
    
    // Draw shooting star
    stroke(255, 255, 200, shootingStar.alpha);
    strokeWeight(2);
    line(
      shootingStar.x, 
      shootingStar.y, 
      shootingStar.x + cos(shootingStar.angle) * shootingStar.length, 
      shootingStar.y + sin(shootingStar.angle) * shootingStar.length
    );
    
    // Draw glow
    strokeWeight(1);
    stroke(255, 255, 200, shootingStar.alpha / 3);
    line(
      shootingStar.x, 
      shootingStar.y, 
      shootingStar.x + cos(shootingStar.angle) * (shootingStar.length + 10), 
      shootingStar.y + sin(shootingStar.angle) * (shootingStar.length + 10)
    );
  }
}

function spawnBoss() {
  let boss = new Enemy();
  boss.type = 2;
  boss.x = WIDTH / 2;
  boss.y = 50;
  boss.size = 50;
  boss.health = 10 + (level / 5) * 2; // Increase health with level
  boss.maxHealth = boss.health;
  boss.speed = 0.5;
  enemies.push(boss);
  bossSpawned = true;
  
  // Create boss entrance effect
  for (let i = 0; i < 30; i++) {
    particles.push(new Particle(
      boss.x + random(-50, 50), 
      boss.y + random(-50, 50), 
      200, 0, 255, 
      60
    ));
  }
}

// Function to fetch leaderboard data from Supabase
async function fetchLeaderboard() {
  // Reset leaderboard state
  leaderboardLoaded = false;
  leaderboardError = null;
  leaderboardPage = 0;
  
  try {
    console.log("Fetching leaderboard data...");
    
    // Check if Supabase client is available
    if (!supabase || typeof supabase.from !== 'function') {
      console.error("Supabase client validation failed");
      
      // Try to reinitialize Supabase
      if (window.SUPABASE_URL && window.SUPABASE_KEY) {
        console.log("Attempting to reinitialize Supabase client");
        
        try {
          // Check if the Supabase library is available
          if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
            supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
            console.log("Successfully reinitialized Supabase client");
          } else if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
            supabase = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
            console.log("Successfully reinitialized Supabase client using global supabase object");
          } else {
            throw new Error("Supabase library not available. Make sure the Supabase script is loaded correctly.");
          }
        } catch (error) {
          throw new Error("Failed to reinitialize Supabase client: " + error.message);
        }
      } else {
        throw new Error("Supabase configuration missing. Make sure SUPABASE_URL and SUPABASE_KEY are defined.");
      }
    }
    
    console.log("Attempting to fetch leaderboard data...");
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('score', { ascending: false })
      .limit(100);
    
    if (error) {
      throw error;
    }
    
    if (!data || !Array.isArray(data)) {
      throw new Error("Invalid data format received from server");
    }
    
    // Filter out any entries with score 0
    const filteredData = data.filter(entry => entry.score > 0);
    
    console.log("Leaderboard data fetched successfully:", filteredData.length, "entries");
    leaderboardData = filteredData;
    leaderboardLoaded = true;
  } catch (err) {
    console.error("Error fetching leaderboard:", err);
    leaderboardError = err.message || "Failed to load leaderboard";
  }
}

// Function to show the leaderboard
function showLeaderboard() {
  // Hide email form if it's visible
  if (emailFormVisible) {
    hideEmailForm();
  }
  
  // Change game state to leaderboard
  gameState = "leaderboard";
  
  // Fetch the latest leaderboard data
  fetchLeaderboard();
  
  // Resume game loop if it was paused
  loop();
}

// Function to hide the email form
function hideEmailForm() {
  if (emailFormDiv) {
    emailFormDiv.style('display', 'none');
    emailFormVisible = false;
  }
}

// Function to show the email form for score submission
function showEmailForm() {
  // Ensure we preserve the final game stats
  if (!window.finalGameStats) {
    console.warn("window.finalGameStats is not available, creating it now with finalScore:", finalScore);
    window.finalGameStats = {
      score: finalScore,
      level: level,
      killStreak: killStreak
    };
  }
  
  // Create email form if it doesn't exist
  if (!emailFormDiv) {
    createEmailForm();
  }
  
  // Show the form
  emailFormDiv.style('display', 'block');
  emailFormVisible = true;
  
  // Focus on the email input
  emailInput.elt.focus();
}

async function submitScore() {
  const email = emailInput.value.trim();
  
  // Validate email
  if (!email || !isValidEmail(email)) {
    inputMessage.textContent = 'Please enter a valid email address';
    inputMessage.className = 'error';
    return;
  }
  
  // Always use window.finalGameStats if available to ensure we have the correct values
  // from when the game ended
  if (!window.finalGameStats) {
    console.warn("window.finalGameStats is not available, creating it now with finalScore:", finalScore);
    window.finalGameStats = {
      score: finalScore,
      level: level,
      killStreak: killStreak
    };
  }
  
  const gameStats = window.finalGameStats;
  const scoreToSubmit = gameStats.score;
  
  console.log("Score to submit:", scoreToSubmit, "from gameStats:", gameStats);
  
  // Prevent submission of 0 scores
  if (scoreToSubmit <= 0) {
    inputMessage.textContent = `Cannot submit a score of 0. Current finalScore: ${finalScore}`;
    inputMessage.className = 'error';
    
    // If we have a non-zero finalScore but gameStats.score is 0, fix it
    if (finalScore > 0 && scoreToSubmit <= 0) {
      console.log("Fixing gameStats with current finalScore:", finalScore);
      window.finalGameStats.score = finalScore;
      inputMessage.textContent = 'Score fixed. Please try submitting again.';
      return;
    }
    return;
  }
  
  // Pause game loop to prevent any further changes during submission
  noLoop();
  
  // Disable submit button to prevent multiple submissions
  submitButton.attribute('disabled', '');
  submitButton.style('opacity', '0.5');
  
  try {
    inputMessage.textContent = 'Submitting score...';
    inputMessage.className = '';
    
    console.log("Submitting to Supabase:", {
      email: email,
      score: scoreToSubmit,
      level: gameStats.level,
      enemies_destroyed: gameStats.killStreak
    });
    
    const { data, error } = await supabase
      .from('leaderboard')
      .insert([
        {
          email: email,
          score: scoreToSubmit,
          level: gameStats.level,
          enemies_destroyed: gameStats.killStreak
        }
      ]);
    
    if (error) {
      console.error('Error submitting score:', error);
      inputMessage.textContent = 'Error submitting score: ' + error.message;
      inputMessage.className = 'error';
      
      // Re-enable submit button on error
      submitButton.removeAttribute('disabled');
      submitButton.style('opacity', '1');
      loop();
      return;
    }
    
    console.log('Score submitted successfully:', data);
    inputMessage.textContent = 'Score submitted successfully!';
    inputMessage.className = 'success';
    
    // Create "View Leaderboard" button if it doesn't exist
    if (!viewLeaderboardButton) {
      viewLeaderboardButton = createButton('View Leaderboard');
      viewLeaderboardButton.position(width / 2 - 75, height / 2 + 180);
      viewLeaderboardButton.mousePressed(showLeaderboard);
      viewLeaderboardButton.class('game-button');
    }
    
    // Resume game loop
    loop();
  } catch (err) {
    console.error('Unexpected error submitting score:', err);
    inputMessage.textContent = 'Unexpected error: ' + err.message;
    inputMessage.className = 'error';
    
    // Re-enable submit button on error
    submitButton.removeAttribute('disabled');
    submitButton.style('opacity', '1');
    loop();
  }
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function shareToX() {
  // Use finalScore instead of score to ensure correct value is shared
  const text = `I scored ${finalScore} points and reached level ${level} in AI SPACE DEFENDER! Can you beat my score?`;
  const url = window.location.href;
  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  
  // Open Twitter share dialog
  window.open(shareUrl, '_blank', 'width=550,height=420');
}

// Function to create the email form elements
function createEmailForm() {
  // Create a div to hold the form
  emailFormDiv = createDiv();
  emailFormDiv.position(width / 2 - 150, height / 2 - 100);
  emailFormDiv.size(300, 200);
  emailFormDiv.class('email-form');
  
  // Create form title
  let formTitle = createP('Submit Your Score');
  formTitle.parent(emailFormDiv);
  formTitle.class('form-title');
  
  // Create email input
  emailInput = createInput('', 'email');
  emailInput.attribute('placeholder', 'Enter your email');
  emailInput.parent(emailFormDiv);
  emailInput.class('email-input');
  
  // Create message paragraph for feedback
  inputMessage = createP('');
  inputMessage.parent(emailFormDiv);
  inputMessage.class('input-message');
  
  // Create submit button
  submitButton = createButton('Submit Score');
  submitButton.parent(emailFormDiv);
  submitButton.mousePressed(submitScore);
  submitButton.class('submit-button');
  
  // Create cancel button
  cancelButton = createButton('Cancel');
  cancelButton.parent(emailFormDiv);
  cancelButton.mousePressed(hideEmailForm);
  cancelButton.class('cancel-button');
  
  // Hide the form initially
  emailFormDiv.style('display', 'none');
  emailFormVisible = false;
}

// Function to validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Function to restart the game
function restartGame() {
  // Save high score
  if (finalScore > highScore) {
    highScore = finalScore;
  }
  
  // Reset game variables
  score = 0;
  finalScore = 0;
  level = 1;
  lives = 3;
  gameState = "playing";
  killStreak = 0;
  comboMultiplier = 1;
  comboTimer = 0;
  
  // Reset power-up states
  powerUpActive = false;
  powerUpType = "";
  rapidFireActive = false;
  tripleFireActive = false;
  shieldPowerUpActive = false;
  scoreMultiplierActive = false;
  scoreMultiplier = 1;
  
  // Reset game objects
  bullets = [];
  enemies = [];
  enemyBullets = [];
  explosions = [];
  powerUps = [];
  
  // Reset player state
  playerInvincible = false;
  playerShield = 0;
  
  // Clear window.finalGameStats
  window.finalGameStats = null;
  
  // Remove UI elements
  if (submitScoreButton) {
    submitScoreButton.remove();
    submitScoreButton = null;
  }
  
  if (viewLeaderboardButton) {
    viewLeaderboardButton.remove();
    viewLeaderboardButton = null;
  }
  
  // Hide email form if visible
  if (emailFormVisible) {
    hideEmailForm();
  }
  
  // Resume game loop
  loop();
  
  console.log("Game restarted!");
}

// Handle keyboard input
function keyPressed() {
  // Start game from title screen with spacebar
  if (gameState === "start" && keyCode === 32) {
    gameState = "playing";
    return;
  }
  
  // Restart game with 'R' key when game over
  if (gameState === "gameOver" && keyCode === 82) {
    restartGame();
    return;
  }
  
  // Return to title screen from leaderboard with ESC key
  if (gameState === "leaderboard" && keyCode === 27) {
    gameState = "start";
    return;
  }
  
  // Shooting with spacebar during gameplay
  if (gameState === "playing" && keyCode === 32) {
    // Implement shooting logic here
    if (millis() - lastBulletTime > bulletCooldown) {
      // Create a new bullet
      bullets.push({
        x: player.x,
        y: player.y - 20,
        speed: bulletSpeed,
        isPlayerBullet: true
      });
      
      // If triple fire is active, add two more bullets
      if (tripleFireActive) {
        bullets.push({
          x: player.x - 15,
          y: player.y - 10,
          speed: bulletSpeed,
          isPlayerBullet: true
        });
        bullets.push({
          x: player.x + 15,
          y: player.y - 10,
          speed: bulletSpeed,
          isPlayerBullet: true
        });
      }
      
      lastBulletTime = millis();
      
      // Play shoot sound if implemented
      // playShootSound();
    }
  }
}

// Function to create mobile controls
function createMobileControls() {
  // Create left movement button
  leftButton = createButton('←');
  leftButton.position(20, height - 100);
  leftButton.size(60, 60);
  leftButton.class('mobile-button');
  leftButton.mousePressed(() => {
    player.x -= 10;
  });
  leftButton.touchStarted(() => {
    player.x -= 10;
    return false;
  });
  
  // Create right movement button
  rightButton = createButton('→');
  rightButton.position(100, height - 100);
  rightButton.size(60, 60);
  rightButton.class('mobile-button');
  rightButton.mousePressed(() => {
    player.x += 10;
  });
  rightButton.touchStarted(() => {
    player.x += 10;
    return false;
  });
  
  // Create shoot button
  shootButton = createButton('FIRE');
  shootButton.position(width - 100, height - 100);
  shootButton.size(80, 60);
  shootButton.class('mobile-button');
  shootButton.mousePressed(() => {
    if (millis() - lastBulletTime > bulletCooldown) {
      // Create a new bullet
      bullets.push({
        x: player.x,
        y: player.y - 20,
        speed: bulletSpeed,
        isPlayerBullet: true
      });
      
      // If triple fire is active, add two more bullets
      if (tripleFireActive) {
        bullets.push({
          x: player.x - 15,
          y: player.y - 10,
          speed: bulletSpeed,
          isPlayerBullet: true
        });
        bullets.push({
          x: player.x + 15,
          y: player.y - 10,
          speed: bulletSpeed,
          isPlayerBullet: true
        });
      }
      
      lastBulletTime = millis();
    }
  });
  shootButton.touchStarted(() => {
    if (millis() - lastBulletTime > bulletCooldown) {
      // Create a new bullet
      bullets.push({
        x: player.x,
        y: player.y - 20,
        speed: bulletSpeed,
        isPlayerBullet: true
      });
      
      // If triple fire is active, add two more bullets
      if (tripleFireActive) {
        bullets.push({
          x: player.x - 15,
          y: player.y - 10,
          speed: bulletSpeed,
          isPlayerBullet: true
        });
        bullets.push({
          x: player.x + 15,
          y: player.y - 10,
          speed: bulletSpeed,
          isPlayerBullet: true
        });
      }
      
      lastBulletTime = millis();
    }
    return false;
  });
  
  // Hide mobile controls initially if not in playing state
  if (gameState !== "playing") {
    leftButton.style('display', 'none');
    rightButton.style('display', 'none');
    shootButton.style('display', 'none');
    mobileControlsVisible = false;
  } else {
    mobileControlsVisible = true;
  }
}

// Handle mouse interactions
function mousePressed() {
  // Don't handle clicks if email form is visible
  if (emailFormVisible) {
    return;
  }
  
  // Handle clicks on title screen
  if (gameState === "start") {
    // Check if leaderboard button was clicked
    if (mouseX > width / 2 - 100 && mouseX < width / 2 + 100 &&
        mouseY > height * 3/4 + 50 && mouseY < height * 3/4 + 90) {
      fetchLeaderboard();
      gameState = "leaderboard";
    }
  }
  
  // Handle clicks on game over screen
  else if (gameState === "gameOver") {
    // Check if submit score button was clicked
    if (submitScoreButton && 
        mouseX > width / 2 - 100 && mouseX < width / 2 + 100 &&
        mouseY > height / 2 + 50 && mouseY < height / 2 + 90) {
      showEmailForm();
    }
    
    // Check if view leaderboard button was clicked
    if (viewLeaderboardButton && 
        mouseX > width / 2 - 75 && mouseX < width / 2 + 75 &&
        mouseY > height / 2 + 180 && mouseY < height / 2 + 210) {
      fetchLeaderboard();
      gameState = "leaderboard";
    }
  }
  
  // Handle clicks on leaderboard screen
  else if (gameState === "leaderboard") {
    // Check if back button was clicked
    if (mouseX > width / 2 - 100 && mouseX < width / 2 + 100 &&
        mouseY > height - 140 && mouseY < height - 100) {
      gameState = "start";
    }
    
    // Check pagination buttons
    if (leaderboardData.length > leaderboardItemsPerPage) {
      // Previous page
      if (leaderboardPage > 0 && 
          mouseX > width / 2 - 150 && mouseX < width / 2 - 50 &&
          mouseY > height - 80 && mouseY < height - 40) {
        leaderboardPage--;
      }
      
      // Next page
      if ((leaderboardPage + 1) * leaderboardItemsPerPage < leaderboardData.length && 
          mouseX > width / 2 + 50 && mouseX < width / 2 + 150 &&
          mouseY > height - 80 && mouseY < height - 40) {
        leaderboardPage++;
      }
    }
  }
}