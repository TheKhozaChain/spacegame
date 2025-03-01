let player;
let enemies = [];
let playerBullets = [];
let enemyBullets = [];
let explosions = [];
let stars = [];
let particles = [];
let score = 0;
let finalScore = 0; // Store the final score when game ends
let lives = 3;
let escapedEnemies = 0;
let gameOver = false;
let shootSound, explosionSound;
let penalizeEscapedEnemies = false;
let gameTitle = "AI SPACE DEFENDER";
let powerUps = [];
let level = 1;
let killStreak = 0;
let shieldActive = false;
let shieldTime = 0;
let bossSpawned = false;
let bossDefeated = 0;
let comboMultiplier = 1;
let comboTimer = 0;
let highScore = 0;
let gameState = "title"; // title, playing, gameOver, leaderboard
let rapidFireActive = false;
let rapidFireTime = 0;
let tripleShot = false;
let tripleShotTime = 0;

// Supabase variables
let supabase;

// Leaderboard variables
let leaderboardData = [];
let isLoadingLeaderboard = false;
let leaderboardError = null;
let scoreSubmitted = false;
let submissionError = null;
let emailInput;
let submitButton;
let cancelButton;
let shareButton;
let inputMessage;

const WIDTH = 800;
const HEIGHT = 600;

function setup() {
  createCanvas(WIDTH, HEIGHT);
  player = new Player();
  
  // Initialize stars - increase the number for a denser starfield
  for (let i = 0; i < 200; i++) {
    stars.push(new Star());
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
  
  // Initialize Supabase client
  try {
    console.log("Initializing Supabase client in setup...");
    console.log("window.supabase exists:", !!window.supabase);
    
    // Check if window.supabase exists and has the required methods
    if (window.supabase && typeof window.supabase.from === 'function') {
      supabase = window.supabase;
      console.log("Supabase client successfully initialized in sketch.js");
    } else {
      // Try to create a new client if window.supabase doesn't exist but we have the URL and key
      if (window.SUPABASE_URL && window.SUPABASE_KEY && window.supabase) {
        console.log("Attempting to create a new Supabase client...");
        try {
          supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
          console.log("Successfully created new Supabase client");
        } catch (createError) {
          console.error("Error creating Supabase client:", createError);
          throw createError;
        }
      } else {
        throw new Error("Supabase client is not properly initialized or doesn't have the required methods");
      }
    }
  } catch (e) {
    console.error("Error initializing Supabase client in sketch.js:", e);
    // Removed logs with sensitive information
    leaderboardError = "Supabase client initialization failed. Please check your configuration.";
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
  // Draw the space background instead of solid black
  drawBackground();
  
  // Draw and update stars
  for (let star of stars) {
    star.update();
    star.draw();
  }
  
  if (gameState === "title") {
    drawTitleScreen();
  } else if (gameState === "playing") {
    // Game playing state
    // Check if game is over
    if (lives <= 0 && gameState !== "gameOver") {
      finalScore = score; // Save final score
      gameState = "gameOver";
      
      // Ensure we capture all the game stats at the moment the game is over
      const finalGameStats = {
        score: score,
        level: level,
        killStreak: killStreak
      };
      
      // Store these in a safe place that won't be reset
      window.finalGameStats = finalGameStats;
      
      console.log("Game over! Final stats captured:", window.finalGameStats);
      
      return; // Exit the draw function to prevent further updates
    }
    
    // Update and draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update();
      particles[i].draw();
      if (particles[i].isDead()) {
        particles.splice(i, 1);
      }
    }
    
    // Update and draw power-ups
    for (let i = powerUps.length - 1; i >= 0; i--) {
      powerUps[i].update();
      powerUps[i].draw();
      
      // Check collision with player
      if (dist(player.x, player.y, powerUps[i].x, powerUps[i].y) < 30) {
        powerUps[i].applyEffect();
        powerUps.splice(i, 1);
      }
      
      // Remove power-ups off-screen
      if (powerUps[i] && powerUps[i].y > HEIGHT) {
        powerUps.splice(i, 1);
      }
    }
    
    // Spawn power-up randomly
    if (frameCount % 600 === 0) { // Every 10 seconds
      powerUps.push(new PowerUp());
    }
    
    // Update shield
    if (shieldActive) {
      shieldTime--;
      if (shieldTime <= 0) {
        shieldActive = false;
      }
    }
    
    player.update();
    player.draw();
    
    // Update and draw enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      enemies[i].update();
      enemies[i].draw();
      
      // Check collision with player
      if (dist(player.x, player.y, enemies[i].x, enemies[i].y) < 20) {
        lives--;
        explosions.push(new Explosion(enemies[i].x, enemies[i].y));
        playExplosionSound();
        enemies.splice(i, 1);
        if (lives <= 0 && gameState !== "gameOver") {
          finalScore = score; // Save final score
          gameState = "gameOver";
          
          // Capture final stats
          window.finalGameStats = {
            score: score,
            level: level,
            killStreak: killStreak
          };
          
          console.log("Game over! Final stats captured:", window.finalGameStats);
        }
        continue;
      }
      
      // Check if enemy has gone off-screen
      if (enemies[i].y > HEIGHT + 20) {
        escapedEnemies++;
        if (penalizeEscapedEnemies) {
          lives--;
          if (lives <= 0 && gameState !== "gameOver") {
            finalScore = score; // Save final score
            gameState = "gameOver";
            
            // Capture final stats
            window.finalGameStats = {
              score: score,
              level: level,
              killStreak: killStreak
            };
            
            console.log("Game over! Final stats captured:", window.finalGameStats);
          }
        }
        // Add a visual indicator at the bottom of the screen
        fill(255, 0, 0, 100);
        rect(0, HEIGHT - 10, WIDTH, 10);
        enemies.splice(i, 1);
      }
    }
    
    // Update and draw player bullets
    for (let i = playerBullets.length - 1; i >= 0; i--) {
      playerBullets[i].update();
      playerBullets[i].draw();
      
      let bulletRemoved = false;
      
      // Check collision with enemies
      for (let j = enemies.length - 1; j >= 0; j--) {
        let hitDistance = enemies[j].type === 2 ? 25 : 10; // Larger hit area for boss
        if (dist(playerBullets[i].x, playerBullets[i].y, enemies[j].x, enemies[j].y) < hitDistance) {
          // Handle enemy hit
          let enemyDestroyed = true;
          
          if (enemies[j].type === 2) {
            // Boss takes multiple hits
            enemyDestroyed = enemies[j].takeDamage();
            
            // Create hit effect even if not destroyed
            for (let k = 0; k < 5; k++) {
              particles.push(new Particle(
                playerBullets[i].x, 
                playerBullets[i].y, 
                255, 100, 100, 
                20
              ));
            }
          }
          
          if (enemyDestroyed) {
            // Calculate score based on enemy type
            let pointValue = 0;
            let explosionSize = 50;
            let explosionColor = {r: 255, g: 100, b: 0};
            
            switch(enemies[j].type) {
              case 0: // Basic ship
                pointValue = 10;
                break;
              case 1: // Hunter ship
                pointValue = 25;
                explosionSize = 70;
                explosionColor = {r: 255, g: 50, b: 0};
                break;
              case 2: // Boss ship
                pointValue = 100;
                explosionSize = 100;
                explosionColor = {r: 200, g: 0, b: 255};
                bossDefeated++;
                
                // Spawn power-ups when boss is defeated
                for (let k = 0; k < 3; k++) {
                  powerUps.push(new PowerUp(enemies[j].x + random(-30, 30), enemies[j].y + random(-30, 30)));
                }
                
                bossSpawned = false;
                break;
            }
            
            // Apply combo multiplier
            let pointsScored = pointValue * comboMultiplier;
            score += pointsScored;
            
            // Update combo
            killStreak++;
            comboMultiplier = min(floor(killStreak / 5) + 1, 5);
            comboTimer = 180; // 3 seconds at 60fps
            
            // Create score popup
            let scoreText = `+${pointsScored}`;
            if (comboMultiplier > 1) {
              scoreText += ` x${comboMultiplier}`;
            }
            
            // Create explosion with appropriate size and color
            explosions.push(new Explosion(enemies[j].x, enemies[j].y, explosionSize, explosionColor));
            playExplosionSound();
            
            // Remove the enemy
            enemies.splice(j, 1);
          }
          
          // Remove the bullet
          playerBullets.splice(i, 1);
          bulletRemoved = true;
          break;
        }
      }
      
      // Skip the rest of this iteration if the bullet was already removed
      if (bulletRemoved) continue;
      
      // Remove bullets off-screen
      if (playerBullets[i].isOffScreen()) {
        playerBullets.splice(i, 1);
      }
    }
    
    // Update and draw enemy bullets
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      enemyBullets[i].update();
      enemyBullets[i].draw();
      
      // Check collision with player
      if (dist(enemyBullets[i].x, enemyBullets[i].y, player.x, player.y) < 10) {
        lives--;
        explosions.push(new Explosion(player.x, player.y));
        playExplosionSound();
        enemyBullets.splice(i, 1);
        if (lives <= 0 && gameState !== "gameOver") {
          finalScore = score; // Save final score
          gameState = "gameOver";
          
          // Capture final stats
          window.finalGameStats = {
            score: score,
            level: level,
            killStreak: killStreak
          };
          
          console.log("Game over! Final stats captured:", window.finalGameStats);
        }
      }
      
      // Remove bullets off-screen
      if (enemyBullets[i] && enemyBullets[i].isOffScreen()) {
        enemyBullets.splice(i, 1);
      }
    }
    
    // Update and draw explosions
    for (let i = explosions.length - 1; i >= 0; i--) {
      explosions[i].update();
      explosions[i].draw();
      if (explosions[i].isFinished()) {
        explosions.splice(i, 1);
      }
    }
    
    // Spawn enemies
    if (frameCount % 60 === 0) {
      enemies.push(new Enemy());
    }
    
    // Display UI
    textSize(20);
    fill(255);
    text(`Score: ${score}`, 10, 30);
    text(`Lives: ${lives}`, 10, 60);
    text(`Escaped: ${escapedEnemies}`, 10, 90);
    text(`Level: ${level}`, 10, 120);
    
    // Display power-up status
    let statusY = 150;
    
    // Display shield status if active
    if (shieldActive) {
      text(`Shield: ${Math.ceil(shieldTime / 60)}s`, 10, statusY);
      statusY += 30;
    }
    
    // Display rapid fire status if active
    if (rapidFireActive) {
      text(`Rapid Fire: ${Math.ceil(rapidFireTime / 60)}s`, 10, statusY);
      statusY += 30;
    }
    
    // Display triple shot status if active
    if (tripleShot) {
      text(`Triple Shot: ${Math.ceil(tripleShotTime / 60)}s`, 10, statusY);
    }
    
    // Display game rules
    textSize(12);
    textAlign(RIGHT);
    if (penalizeEscapedEnemies) {
      text("Enemies that escape will cost you a life!", WIDTH - 10, 30);
    } else {
      text("Destroy enemies before they escape!", WIDTH - 10, 30);
    }
    textAlign(LEFT);
    
    // Level up based on score
    if (score > 0 && score >= level * 100 && !bossSpawned) {
      levelUp();
    }
    
    // Update combo timer
    if (comboTimer > 0) {
      comboTimer--;
      if (comboTimer === 0) {
        killStreak = 0;
        comboMultiplier = 1;
      }
    }
    
    // Display combo multiplier if active
    if (comboMultiplier > 1) {
      textSize(24);
      fill(255, 255, 0);
      text(`Combo x${comboMultiplier}`, WIDTH - 150, 30);
    }
    
    // Spawn boss at certain intervals
    if (level % 5 === 0 && !bossSpawned && frameCount % 300 === 0) {
      spawnBoss();
    }
  } else if (gameState === "gameOver") {
    // Game over screen
    drawGameOverScreen();
  } else if (gameState === "leaderboard") {
    // Leaderboard screen
    drawLeaderboardScreen();
  }
}

function drawTitleScreen() {
  push();
  textAlign(CENTER);
  
  // Title
  fill(0, 150, 255);
  textSize(60);
  text(gameTitle, WIDTH / 2, HEIGHT / 3);
  
  // Subtitle
  fill(200, 200, 255);
  textSize(24);
  text("DEFEND EARTH FROM THE AI INVASION", WIDTH / 2, HEIGHT / 3 + 50);
  
  // High score
  if (highScore > 0) {
    fill(255, 255, 0);
    textSize(30);
    text(`HIGH SCORE: ${highScore}`, WIDTH / 2, HEIGHT / 3 + 100);
  }
  
  // Instructions
  fill(255);
  textSize(20);
  text("ARROW KEYS: Move", WIDTH / 2, HEIGHT / 2 + 50);
  text("SPACEBAR: Shoot", WIDTH / 2, HEIGHT / 2 + 80);
  text("P: Toggle penalty for escaped enemies", WIDTH / 2, HEIGHT / 2 + 110);
  
  // Start prompt
  fill(0, 255, 200);
  textSize(30);
  if (frameCount % 60 < 30) {
    text("PRESS SPACE TO START", WIDTH / 2, HEIGHT * 3/4);
  }
  
  // Leaderboard button
  fill(100, 100, 255);
  rect(WIDTH / 2 - 100, HEIGHT * 3/4 + 50, 200, 40, 10);
  fill(255);
  textSize(20);
  text("VIEW LEADERBOARD", WIDTH / 2, HEIGHT * 3/4 + 75);
  
  // Credits
  fill(150, 150, 150);
  textSize(16);
  text("Created with p5.js", WIDTH / 2, HEIGHT - 30);
  
  pop();
}

function drawGameOverScreen() {
  // Game over screen
  background(0, 0, 0, 150);
  
  // Game over text
  fill(255, 50, 50);
  textSize(48);
  textAlign(CENTER, CENTER);
  text("GAME OVER", WIDTH / 2, HEIGHT / 4 - 20);
  
  // Final score
  fill(255, 255, 255);
  textSize(32);
  
  // Use the stored final stats if available
  const displayKillStreak = window.finalGameStats ? window.finalGameStats.killStreak : killStreak;
  
  // Display final score
  text(`Final Score: ${finalScore}`, WIDTH / 2, HEIGHT / 4 + 40);
  
  // High score
  if (finalScore > highScore) {
    highScore = finalScore;
    fill(255, 215, 0); // Gold color
    textSize(28);
    text("NEW HIGH SCORE!", WIDTH / 2, HEIGHT / 4 + 80);
  } else {
    fill(200, 200, 200);
    textSize(24);
    text(`High Score: ${highScore}`, WIDTH / 2, HEIGHT / 4 + 120);
  }
  
  // Stats - adjusted spacing and moved up
  fill(200, 200, 255);
  textSize(20);
  text(`Enemies Destroyed: ${displayKillStreak}`, WIDTH / 2, HEIGHT / 4 + 160);
  text(`Enemies Escaped: ${escapedEnemies}`, WIDTH / 2, HEIGHT / 4 + 190);
  text(`Level Reached: ${level}`, WIDTH / 2, HEIGHT / 4 + 220);
  
  // Submit to leaderboard button - positioned below stats with proper spacing
  if (!scoreSubmitted) {
    fill(0, 150, 255);
    rect(WIDTH / 2 - 150, HEIGHT / 4 + 260, 300, 40, 10);
    fill(255);
    textSize(20);
    text("SUBMIT TO LEADERBOARD", WIDTH / 2, HEIGHT / 4 + 285);
  } else {
    fill(0, 200, 100);
    textSize(20);
    text("SCORE SUBMITTED!", WIDTH / 2, HEIGHT / 4 + 280);
  }
  
  // View leaderboard button - positioned below submit button
  fill(100, 100, 255);
  rect(WIDTH / 2 - 100, HEIGHT / 4 + 320, 200, 40, 10);
  fill(255);
  textSize(20);
  text("VIEW LEADERBOARD", WIDTH / 2, HEIGHT / 4 + 345);
  
  // Restart prompt - positioned with clear space below the leaderboard button
  if (frameCount % 60 < 30) {
    // Create a semi-transparent background for better visibility
    fill(0, 0, 0, 150);
    rect(WIDTH / 2 - 200, HEIGHT / 4 + 390, 400, 50, 10);
    
    // Draw the text
    fill(0, 255, 200);
    textSize(30);
    text("PRESS 'R' TO RESTART", WIDTH / 2, HEIGHT / 4 + 425);
  }
  
  pop();
}

function drawLeaderboardScreen() {
  push();
  textAlign(CENTER);
  
  // Title
  fill(0, 150, 255);
  textSize(40);
  text("LEADERBOARD", WIDTH / 2, 80);
  
  // Loading state
  if (isLoadingLeaderboard) {
    fill(255);
    textSize(24);
    text("Loading scores...", WIDTH / 2, HEIGHT / 2);
  } 
  // Error state
  else if (leaderboardError) {
    fill(255, 50, 50);
    textSize(24);
    text("Error loading leaderboard", WIDTH / 2, HEIGHT / 2);
    textSize(16);
    text(leaderboardError, WIDTH / 2, HEIGHT / 2 + 30);
  } 
  // Display leaderboard
  else if (leaderboardData.length > 0) {
    // Check if there's a current game entry
    const hasCurrentGame = leaderboardData.some(entry => entry.isCurrentGame);
    
    // Header
    fill(200, 200, 255);
    textSize(20);
    textAlign(LEFT);
    text("RANK", 100, 130);
    text("EMAIL", 250, 130);
    text("SCORE", 500, 130);
    text("LEVEL", 600, 130);
    
    // Note about current game
    if (hasCurrentGame && !scoreSubmitted) {
      textAlign(CENTER);
      fill(0, 255, 200);
      textSize(14);
      text("* Current game score (not yet submitted)", WIDTH / 2, HEIGHT - 120);
      textAlign(LEFT);
    }
    
    // Remove duplicates from leaderboard by keeping highest score per email
    const uniqueEntries = [];
    const emailsAdded = new Set();
    
    for (const entry of leaderboardData) {
      // Always include current game entries
      if (entry.isCurrentGame) {
        uniqueEntries.push(entry);
      } 
      // For regular entries, only add if email hasn't been seen yet
      else if (!emailsAdded.has(entry.player_email)) {
        uniqueEntries.push(entry);
        emailsAdded.add(entry.player_email);
      }
    }
    
    // Sort by score in descending order
    uniqueEntries.sort((a, b) => b.score - a.score);
    
    // Scores
    fill(255);
    textSize(16);
    for (let i = 0; i < Math.min(uniqueEntries.length, 10); i++) {
      const entry = uniqueEntries[i];
      
      // Format email display
      let displayEmail;
      if (entry.isCurrentGame) {
        displayEmail = "CURRENT GAME *";
      } else {
        displayEmail = entry.player_email.substring(0, 3) + "..." + 
                      entry.player_email.substring(entry.player_email.indexOf('@'));
      }
      
      // Highlight the current player's score
      if (scoreSubmitted && entry.player_email === emailInput.value) {
        fill(255, 255, 0); // Yellow for submitted score
      } else if (entry.isCurrentGame) {
        fill(0, 255, 200); // Cyan for current game score
      } else {
        fill(255); // White for other scores
      }
      
      text(`${i + 1}.`, 100, 170 + i * 30);
      text(displayEmail, 250, 170 + i * 30);
      text(entry.score, 500, 170 + i * 30);
      text(entry.level_reached, 600, 170 + i * 30);
    }
  } 
  // No scores
  else {
    fill(255);
    textSize(24);
    text("No scores yet. Be the first!", WIDTH / 2, HEIGHT / 2);
  }
  
  // Back button
  textAlign(CENTER);
  fill(100, 100, 255);
  rect(WIDTH / 2 - 100, HEIGHT - 80, 200, 40, 10);
  fill(255);
  textSize(20);
  text("BACK TO MENU", WIDTH / 2, HEIGHT - 55);
  
  pop();
}

function keyPressed() {
  if (gameState === "title" && keyCode === 32) { // Spacebar on title screen
    gameState = "playing";
    return;
  }
  
  if (gameState === "playing" && keyCode === 32) { // Spacebar during gameplay
    player.shoot();
    console.log("Player shooting! Bullet count:", playerBullets.length);
  }
  
  // Toggle penalty for escaped enemies with 'P' key
  if (keyCode === 80) { // 'P' key
    penalizeEscapedEnemies = !penalizeEscapedEnemies;
    console.log("Penalty for escaped enemies:", penalizeEscapedEnemies ? "ON" : "OFF");
  }
  
  // Restart game with 'R' key
  if (keyCode === 82 && gameState === "gameOver") { // 'R' key and game is over
    restartGame();
  }
  
  // Back to menu from leaderboard with ESC key
  if (keyCode === 27 && gameState === "leaderboard") { // ESC key
    gameState = "title";
  }
}

function mousePressed() {
  // Check if email form is visible - if so, don't handle canvas clicks
  const emailForm = document.getElementById('email-input');
  if (emailForm && emailForm.style.display === 'block') {
    return;
  }
  
  // Handle button clicks on title screen
  if (gameState === "title") {
    // Check if leaderboard button was clicked
    if (mouseX > WIDTH / 2 - 100 && mouseX < WIDTH / 2 + 100 &&
        mouseY > HEIGHT * 3/4 + 50 && mouseY < HEIGHT * 3/4 + 90) {
      fetchLeaderboard();
      gameState = "leaderboard";
    }
  }
  // Handle button clicks on game over screen
  else if (gameState === "gameOver") {
    // Check if submit to leaderboard button was clicked
    if (!scoreSubmitted &&
        mouseX > WIDTH / 2 - 150 && mouseX < WIDTH / 2 + 150 &&
        mouseY > HEIGHT / 4 + 260 && mouseY < HEIGHT / 4 + 300) {
      
      // Make sure we have consistent game stats
      if (!window.finalGameStats) {
        console.log("Creating finalGameStats before showing email form");
        window.finalGameStats = {
          score: finalScore,
          level: level,
          killStreak: killStreak
        };
      }
      
      // Pause game loop and show email form
      showEmailForm();
    }
    
    // Check if view leaderboard button was clicked
    if (mouseX > WIDTH / 2 - 100 && mouseX < WIDTH / 2 + 100 &&
        mouseY > HEIGHT / 4 + 320 && mouseY < HEIGHT / 4 + 360) {
      console.log("View leaderboard button clicked");
      
      // Clear any existing leaderboard data to ensure fresh data
      leaderboardData = [];
      
      // Add current game score to leaderboard data temporarily if not submitted
      if (!scoreSubmitted && finalScore > 0) {
        // If we have saved game stats, use those
        const currentGameScore = window.finalGameStats ? window.finalGameStats.score : finalScore;
        const currentGameLevel = window.finalGameStats ? window.finalGameStats.level : level;
        const currentGameKillStreak = window.finalGameStats ? window.finalGameStats.killStreak : killStreak;
        
        // Create a temporary entry for the current game
        const tempEntry = {
          player_email: "Current Game",
          score: currentGameScore,
          level_reached: currentGameLevel,
          enemies_destroyed: currentGameKillStreak,
          isCurrentGame: true  // Flag to identify this as the current game
        };
        
        // Add to leaderboard data
        leaderboardData.push(tempEntry);
      }
      
      // Fetch leaderboard data
      fetchLeaderboard();
      
      // Change game state to leaderboard
      gameState = "leaderboard";
    }
  }
  // Handle button clicks on leaderboard screen
  else if (gameState === "leaderboard") {
    // Check if back button was clicked
    if (mouseX > WIDTH / 2 - 100 && mouseX < WIDTH / 2 + 100 &&
        mouseY > HEIGHT - 80 && mouseY < HEIGHT - 40) {
      // Remove temporary entry when going back
      if (leaderboardData.length > 0) {
        leaderboardData = leaderboardData.filter(entry => !entry.isCurrentGame);
      }
      gameState = "title";
    }
  }
}

function restartGame() {
  // Save high score
  if (finalScore > highScore) {
    highScore = finalScore;
  }
  
  // Clear saved game stats
  window.finalGameStats = null;
  
  player = new Player();
  enemies = [];
  playerBullets = [];
  enemyBullets = [];
  explosions = [];
  particles = [];
  powerUps = [];
  score = 0;
  finalScore = 0;
  lives = 3;
  escapedEnemies = 0;
  gameState = "playing";
  level = 1;
  killStreak = 0;
  comboMultiplier = 1;
  comboTimer = 0;
  shieldActive = false;
  shieldTime = 0;
  bossSpawned = false;
  bossDefeated = 0;
  rapidFireActive = false;
  rapidFireTime = 0;
  tripleShot = false;
  tripleShotTime = 0;
  scoreSubmitted = false;
  
  console.log("Game restarted!");
}

function playExplosionSound() {
  try {
    explosionSound.amp(0.5, 0.1); // Ramp amplitude to 0.5 over 0.1 seconds
    setTimeout(() => explosionSound.amp(0, 0.1), 200); // Ramp back to 0 after 200ms
  } catch (e) {
    console.warn("Error playing explosion sound");
  }
}

function levelUp() {
  level++;
  
  // Create level-up effect
  for (let i = 0; i < 50; i++) {
    particles.push(new Particle(random(WIDTH), random(HEIGHT), 
                               random(0, 255), random(100, 255), random(100, 255)));
  }
  
  // Make game harder
  if (level % 5 === 0) {
    // Every 5 levels, spawn a boss instead of making the game harder
    spawnBoss();
  } else {
    // Otherwise increase enemy spawn rate and speed
    for (let enemy of enemies) {
      enemy.speed *= 1.1;
    }
  }
}

class Player {
  constructor() {
    this.x = WIDTH / 2;
    this.y = HEIGHT - 50;
    this.speed = 5;
    this.shootCooldown = 0;
    this.thrusterAnimation = 0;
    this.size = 25;
    this.weaponLevel = 1;
    this.baseShootCooldown = 15; // Base cooldown for shooting
    
    // Ship colors
    this.colors = {
      primary: {r: 0, g: 150, b: 255},     // Main blue
      secondary: {r: 0, g: 100, b: 200},   // Darker blue
      accent: {r: 200, g: 255, b: 255},    // Light blue/white
      thruster: {r: 0, g: 200, b: 255}     // Cyan for thrusters
    };
    
    // Thruster animation variables
    this.thrusterSize = 0;
    this.thrusterGrowth = 0.2;
  }
  
  update() {
    // Movement controls
    let isMoving = false;
    
    if (keyIsDown(LEFT_ARROW)) {
      this.x -= this.speed;
      isMoving = true;
      // Add thruster particles on the right side
      particles.push(new Particle(this.x + 10, this.y + 10, 
                                 this.colors.thruster.r, 
                                 this.colors.thruster.g, 
                                 this.colors.thruster.b, 20));
    }
    if (keyIsDown(RIGHT_ARROW)) {
      this.x += this.speed;
      isMoving = true;
      // Add thruster particles on the left side
      particles.push(new Particle(this.x - 10, this.y + 10, 
                                 this.colors.thruster.r, 
                                 this.colors.thruster.g, 
                                 this.colors.thruster.b, 20));
    }
    if (keyIsDown(UP_ARROW)) {
      this.y -= this.speed * 0.7;
      isMoving = true;
    }
    if (keyIsDown(DOWN_ARROW)) {
      this.y += this.speed * 0.7;
      isMoving = true;
    }
    
    // Constrain player to screen
    this.x = constrain(this.x, this.size, WIDTH - this.size);
    this.y = constrain(this.y, this.size, HEIGHT - this.size);
    
    // Add engine thruster particles
    if (frameCount % 2 === 0) {
      // Main thruster
      particles.push(new Particle(
        this.x, 
        this.y + 15, 
        this.colors.thruster.r, 
        this.colors.thruster.g, 
        this.colors.thruster.b, 
        30
      ));
      
      // Side thrusters
      if (isMoving) {
        particles.push(new Particle(
          this.x - 15, 
          this.y + 10, 
          this.colors.thruster.r, 
          this.colors.thruster.g, 
          this.colors.thruster.b, 
          20
        ));
        particles.push(new Particle(
          this.x + 15, 
          this.y + 10, 
          this.colors.thruster.r, 
          this.colors.thruster.g, 
          this.colors.thruster.b, 
          20
        ));
      }
    }
    
    // Update thruster animation
    this.thrusterAnimation = (this.thrusterAnimation + 0.1) % TWO_PI;
    
    // Animate thruster size
    this.thrusterSize += this.thrusterGrowth;
    if (this.thrusterSize > 1.5 || this.thrusterSize < 0.5) {
      this.thrusterGrowth *= -1;
    }
    
    // Cooldown for shooting - affected by rapid fire power-up
    if (this.shootCooldown > 0) {
      this.shootCooldown--;
    }
    
    // Update power-up timers
    if (rapidFireActive) {
      rapidFireTime--;
      if (rapidFireTime <= 0) {
        rapidFireActive = false;
      }
    }
    
    if (tripleShot) {
      tripleShotTime--;
      if (tripleShotTime <= 0) {
        tripleShot = false;
      }
    }
  }
  
  shoot() {
    // Calculate current cooldown based on power-ups
    let currentCooldown = rapidFireActive ? this.baseShootCooldown / 2 : this.baseShootCooldown;
    
    if (this.shootCooldown === 0) {
      // Different weapon patterns based on weapon level and power-ups
      if (tripleShot) {
        // Triple shot pattern
        playerBullets.push(new Bullet(this.x, this.y - 10, -8, true));
        playerBullets.push(new Bullet(this.x - 10, this.y, -7, true, -1, -7));
        playerBullets.push(new Bullet(this.x + 10, this.y, -7, true, 1, -7));
      } else if (this.weaponLevel === 1) {
        playerBullets.push(new Bullet(this.x, this.y - 10, -8, true));
      } else if (this.weaponLevel === 2) {
        playerBullets.push(new Bullet(this.x - 5, this.y - 5, -8, true));
        playerBullets.push(new Bullet(this.x + 5, this.y - 5, -8, true));
      } else if (this.weaponLevel >= 3) {
        playerBullets.push(new Bullet(this.x, this.y - 10, -8, true));
        playerBullets.push(new Bullet(this.x - 10, this.y, -7, true, -1, -7));
        playerBullets.push(new Bullet(this.x + 10, this.y, -7, true, 1, -7));
      }
      
      this.shootCooldown = currentCooldown;
      
      try {
        shootSound.freq(440);
        shootSound.amp(0.5, 0.1); // Ramp amplitude to 0.5 over 0.1 seconds
        setTimeout(() => shootSound.amp(0, 0.1), 100); // Ramp back to 0 after 100ms
      } catch (e) {
        console.warn("Error playing shoot sound");
      }
    }
  }
  
  draw() {
    push();
    translate(this.x, this.y);
    
    // Draw shield if active
    if (shieldActive) {
      noFill();
      stroke(0, 200, 255, 150 + sin(frameCount * 0.1) * 50);
      strokeWeight(2);
      ellipse(0, 0, this.size * 2.5, this.size * 2.5);
      
      // Shield particles
      if (frameCount % 5 === 0) {
        let angle = random(TWO_PI);
        let x = cos(angle) * this.size * 1.2;
        let y = sin(angle) * this.size * 1.2;
        particles.push(new Particle(this.x + x, this.y + y, 0, 200, 255, 40));
      }
    }
    
    // Draw thruster flames
    noStroke();
    
    // Main thruster flame
    fill(this.colors.thruster.r, this.colors.thruster.g, this.colors.thruster.b, 
         150 + sin(this.thrusterAnimation) * 50);
    beginShape();
    vertex(-8, 15);
    vertex(-4, 15 + sin(this.thrusterAnimation * 2) * 10 * this.thrusterSize);
    vertex(0, 15 + sin(this.thrusterAnimation) * 15 * this.thrusterSize);
    vertex(4, 15 + sin(this.thrusterAnimation * 2) * 10 * this.thrusterSize);
    vertex(8, 15);
    endShape(CLOSE);
    
    // Side thruster flames
    fill(this.colors.thruster.r, this.colors.thruster.g, this.colors.thruster.b, 
         100 + sin(this.thrusterAnimation) * 30);
    
    // Left thruster
    beginShape();
    vertex(-18, 10);
    vertex(-20, 10 + sin(this.thrusterAnimation * 1.5) * 5 * this.thrusterSize);
    vertex(-18, 15);
    vertex(-16, 10);
    endShape(CLOSE);
    
    // Right thruster
    beginShape();
    vertex(18, 10);
    vertex(20, 10 + sin(this.thrusterAnimation * 1.5) * 5 * this.thrusterSize);
    vertex(18, 15);
    vertex(16, 10);
    endShape(CLOSE);
    
    // Draw ship body - sleek blue design
    // Main hull
    fill(this.colors.primary.r, this.colors.primary.g, this.colors.primary.b);
    beginShape();
    vertex(0, -20);  // Nose
    vertex(-15, 5);  // Left mid
    vertex(-10, 15); // Left back
    vertex(10, 15);  // Right back
    vertex(15, 5);   // Right mid
    endShape(CLOSE);
    
    // Wings
    fill(this.colors.secondary.r, this.colors.secondary.g, this.colors.secondary.b);
    // Left wing
    beginShape();
    vertex(-10, 0);
    vertex(-25, 10);
    vertex(-20, 15);
    vertex(-10, 10);
    endShape(CLOSE);
    
    // Right wing
    beginShape();
    vertex(10, 0);
    vertex(25, 10);
    vertex(20, 15);
    vertex(10, 10);
    endShape(CLOSE);
    
    // Cockpit
    fill(this.colors.accent.r, this.colors.accent.g, this.colors.accent.b, 200);
    ellipse(0, -5, 10, 15);
    
    // Weapon pods based on weapon level
    fill(this.colors.thruster.r, this.colors.thruster.g, this.colors.thruster.b);
    if (this.weaponLevel >= 1) {
      ellipse(0, -12, 6, 6);
    }
    if (this.weaponLevel >= 2) {
      ellipse(-12, 5, 5, 5);
      ellipse(12, 5, 5, 5);
    }
    if (this.weaponLevel >= 3) {
      ellipse(-18, 10, 4, 4);
      ellipse(18, 10, 4, 4);
    }
    
    // Engine glow
    fill(this.colors.thruster.r, this.colors.thruster.g, this.colors.thruster.b, 50);
    ellipse(0, 12, 16, 8);
    ellipse(-18, 12, 8, 4);
    ellipse(18, 12, 8, 4);
    
    pop();
  }
  
  upgradeWeapon() {
    this.weaponLevel = min(this.weaponLevel + 1, 3);
  }
}

class Enemy {
  constructor() {
    this.x = random(WIDTH);
    this.y = 0;
    this.speed = random(1, 3);
    this.type = floor(random(10)); // 0-6: basic, 7-9: hunter, 10: boss (rare)
    
    // Convert to proper type
    if (this.type >= 7 && this.type <= 9) {
      this.type = 1; // Hunter
    } else if (this.type === 10) {
      this.type = 2; // Boss
    } else {
      this.type = 0; // Basic
    }
    
    this.size = this.type === 2 ? 50 : random(15, 25);
    this.shootCooldown = floor(random(60, 120)); // Shoots every 1-2 seconds
    
    // Health for boss ships
    this.health = this.type === 2 ? 10 : 1;
    this.maxHealth = this.health;
    
    // For hunter ships
    this.targetX = this.x;
    this.targetY = this.y;
    
    this.pulseRate = random(0.02, 0.05);
    this.pulseOffset = random(0, TWO_PI);
    this.rotation = 0;
    this.rotationSpeed = random(-0.02, 0.02);
    
    // Eye animation
    this.eyeSize = 0;
    this.eyeGrowth = 0.05;
  }
  
  update() {
    // Basic movement
    this.y += this.speed;
    this.rotation += this.rotationSpeed;
    
    // Hunter ships track player
    if (this.type === 1 && player) {
      this.targetX = player.x;
      this.targetY = player.y;
      
      // Move towards player
      let dx = this.targetX - this.x;
      let dy = this.targetY - this.y;
      let angle = atan2(dy, dx);
      
      // Move slower horizontally than vertically
      this.x += cos(angle) * this.speed * 0.5;
      this.y += sin(angle) * this.speed * 0.7;
      
      // Don't go above the screen
      this.y = max(this.y, this.size);
    }
    
    // Eye animation
    this.eyeSize += this.eyeGrowth;
    if (this.eyeSize > 1 || this.eyeSize < 0.5) {
      this.eyeGrowth *= -1;
    }
    
    // Shooting logic based on ship type
    if (frameCount % this.shootCooldown === 0) {
      if (this.type === 0) {
        // Basic ship shoots straight
        enemyBullets.push(new Bullet(this.x, this.y, 5));
      } else if (this.type === 1) {
        // Hunter ship shoots at player
        let dx = player.x - this.x;
        let dy = player.y - this.y;
        let angle = atan2(dy, dx);
        let bulletSpeed = 5;
        let vx = cos(angle) * bulletSpeed;
        let vy = sin(angle) * bulletSpeed;
        
        enemyBullets.push(new Bullet(this.x, this.y, 0, false, vx, vy));
      } else if (this.type === 2) {
        // Boss ship shoots in multiple directions
        for (let i = 0; i < 8; i++) {
          let angle = TWO_PI / 8 * i;
          let vx = cos(angle) * 4;
          let vy = sin(angle) * 4;
          enemyBullets.push(new Bullet(this.x, this.y, 0, false, vx, vy));
        }
      }
    }
  }
  
  draw() {
    push();
    translate(this.x, this.y);
    rotate(this.rotation);
    
    // Pulsing effect
    let pulseSize = sin(frameCount * this.pulseRate + this.pulseOffset) * 5;
    
    if (this.type === 0) {
      // Basic AI Ship - more menacing purple with glowing red eyes
      // Outer glow effect
      fill(150, 50, 200, 50 + sin(frameCount * 0.1) * 20);
      ellipse(0, 0, this.size * 2.2 + pulseSize, this.size * 1.5 + pulseSize);
      
      // Ship body - more angular and threatening
      fill(150, 50, 200);
      beginShape();
      vertex(0, -this.size * 0.7);  // Front point
      vertex(-this.size * 0.8, -this.size * 0.2);
      vertex(-this.size * 0.9, this.size * 0.3);
      vertex(-this.size * 0.4, this.size * 0.1);
      vertex(0, this.size * 0.4);
      vertex(this.size * 0.4, this.size * 0.1);
      vertex(this.size * 0.9, this.size * 0.3);
      vertex(this.size * 0.8, -this.size * 0.2);
      endShape(CLOSE);
      
      // Menacing details
      fill(100, 30, 150);
      beginShape();
      vertex(0, -this.size * 0.7);
      vertex(-this.size * 0.4, -this.size * 0.1);
      vertex(0, this.size * 0.2);
      vertex(this.size * 0.4, -this.size * 0.1);
      endShape(CLOSE);
      
      // Spikes
      fill(170, 70, 220);
      triangle(-this.size * 0.9, this.size * 0.3, -this.size * 1.2, this.size * 0.5, -this.size * 0.7, this.size * 0.5);
      triangle(this.size * 0.9, this.size * 0.3, this.size * 1.2, this.size * 0.5, this.size * 0.7, this.size * 0.5);
      
      // Red glowing eyes - more intense
      fill(255, 0, 0, 200 + sin(frameCount * 0.15) * 55);
      ellipse(-this.size * 0.3, -this.size * 0.1, this.size * 0.35 * this.eyeSize, this.size * 0.35 * this.eyeSize);
      ellipse(this.size * 0.3, -this.size * 0.1, this.size * 0.35 * this.eyeSize, this.size * 0.35 * this.eyeSize);
      
      // Eye glow effect
      fill(255, 50, 50, 100);
      ellipse(-this.size * 0.3, -this.size * 0.1, this.size * 0.6 * this.eyeSize, this.size * 0.6 * this.eyeSize);
      ellipse(this.size * 0.3, -this.size * 0.1, this.size * 0.6 * this.eyeSize, this.size * 0.6 * this.eyeSize);
      
      // Engine glow - more dramatic
      fill(200, 100, 255, 150 + sin(frameCount * 0.2) * 50);
      ellipse(0, this.size * 0.4, this.size * 0.8, this.size * 0.4);
      
      // Energy tendrils
      stroke(200, 100, 255, 100 + sin(frameCount * 0.1) * 50);
      strokeWeight(1);
      noFill();
      beginShape();
      for (let i = 0; i < 10; i++) {
        let angle = map(i, 0, 10, 0, TWO_PI);
        let r = this.size * 0.8 + sin(frameCount * 0.05 + i) * 5;
        curveVertex(cos(angle) * r, sin(angle) * r);
      }
      endShape(CLOSE);
    } 
    else if (this.type === 1) {
      // Hunter Ship - more aggressive red with pulsing effects
      // Outer glow
      fill(255, 50, 50, 50 + sin(frameCount * 0.15) * 30);
      ellipse(0, 0, this.size * 2.5 + pulseSize, this.size * 2 + pulseSize);
      
      // Ship body - more predatory shape
      fill(200, 50, 50);
      beginShape();
      vertex(0, -this.size * 1.2);  // Sharper front
      vertex(-this.size * 0.7, -this.size * 0.3);
      vertex(-this.size * 1.2, this.size * 0.5);  // Extended wings
      vertex(-this.size * 0.5, this.size * 0.2);
      vertex(0, this.size * 0.4);
      vertex(this.size * 0.5, this.size * 0.2);
      vertex(this.size * 1.2, this.size * 0.5);  // Extended wings
      vertex(this.size * 0.7, -this.size * 0.3);
      endShape(CLOSE);
      
      // Armor plates
      fill(150, 30, 30);
      beginShape();
      vertex(0, -this.size * 1.2);
      vertex(-this.size * 0.5, -this.size * 0.4);
      vertex(0, -this.size * 0.2);
      vertex(this.size * 0.5, -this.size * 0.4);
      endShape(CLOSE);
      
      // Weapon pods
      fill(255, 100, 100);
      ellipse(-this.size * 0.8, this.size * 0.2, this.size * 0.3, this.size * 0.5);
      ellipse(this.size * 0.8, this.size * 0.2, this.size * 0.3, this.size * 0.5);
      
      // Yellow glowing eyes - more menacing
      fill(255, 255, 0, 200 + sin(frameCount * 0.25) * 55);
      ellipse(-this.size * 0.3, -this.size * 0.4, this.size * 0.45 * this.eyeSize, this.size * 0.45 * this.eyeSize);
      ellipse(this.size * 0.3, -this.size * 0.4, this.size * 0.45 * this.eyeSize, this.size * 0.45 * this.eyeSize);
      
      // Eye glow effect
      fill(255, 255, 100, 120);
      ellipse(-this.size * 0.3, -this.size * 0.4, this.size * 0.7 * this.eyeSize, this.size * 0.7 * this.eyeSize);
      ellipse(this.size * 0.3, -this.size * 0.4, this.size * 0.7 * this.eyeSize, this.size * 0.7 * this.eyeSize);
      
      // Engine flames - more dynamic
      fill(255, 100, 0, 200 + sin(frameCount * 0.2) * 55);
      beginShape();
      vertex(-this.size * 0.5, this.size * 0.5);
      vertex(-this.size * 0.3, this.size * 0.5 + sin(frameCount * 0.2) * 10);
      vertex(-this.size * 0.15, this.size + sin(frameCount * 0.15) * 15);
      vertex(0, this.size * 0.5 + sin(frameCount * 0.25) * 10);
      vertex(this.size * 0.15, this.size + sin(frameCount * 0.15) * 15);
      vertex(this.size * 0.3, this.size * 0.5 + sin(frameCount * 0.2) * 10);
      vertex(this.size * 0.5, this.size * 0.5);
      endShape(CLOSE);
      
      // Energy field
      stroke(255, 150, 0, 80 + sin(frameCount * 0.1) * 40);
      strokeWeight(2);
      noFill();
      for (let i = 0; i < 3; i++) {
        ellipse(0, 0, this.size * (1.2 + i * 0.3) + sin(frameCount * 0.05 + i) * 5, 
                      this.size * (0.8 + i * 0.2) + sin(frameCount * 0.05 + i) * 5);
      }
    } 
    else if (this.type === 2) {
      // Boss Ship - more intimidating with advanced AI visuals
      // Outer energy field
      fill(100, 0, 150, 50 + sin(frameCount * 0.05) * 20);
      ellipse(0, 0, this.size * 3 + pulseSize, this.size * 1.8 + pulseSize);
      
      // Pulsing shield effect
      noFill();
      stroke(200, 100, 255, 100 + sin(frameCount * 0.07) * 50);
      strokeWeight(3);
      ellipse(0, 0, this.size * 2.5 + sin(frameCount * 0.05) * 10, this.size * 1.5 + sin(frameCount * 0.05) * 5);
      
      // Ship body - more complex and threatening
      noStroke();
      fill(100, 0, 150);
      beginShape();
      vertex(0, -this.size * 0.8);  // Front point
      vertex(-this.size * 0.7, -this.size * 0.5);
      vertex(-this.size * 1.2, -this.size * 0.2);
      vertex(-this.size * 1.5, this.size * 0.3);
      vertex(-this.size * 0.8, this.size * 0.5);
      vertex(0, this.size * 0.3);
      vertex(this.size * 0.8, this.size * 0.5);
      vertex(this.size * 1.5, this.size * 0.3);
      vertex(this.size * 1.2, -this.size * 0.2);
      vertex(this.size * 0.7, -this.size * 0.5);
      endShape(CLOSE);
      
      // Armor plates and details
      fill(80, 0, 120);
      beginShape();
      vertex(0, -this.size * 0.8);
      vertex(-this.size * 0.5, -this.size * 0.3);
      vertex(0, this.size * 0.1);
      vertex(this.size * 0.5, -this.size * 0.3);
      endShape(CLOSE);
      
      // Weapon arrays
      fill(150, 50, 200);
      ellipse(-this.size * 1, this.size * 0.1, this.size * 0.4, this.size * 0.6);
      ellipse(this.size * 1, this.size * 0.1, this.size * 0.4, this.size * 0.6);
      
      // Spikes
      fill(130, 30, 180);
      for (let i = 0; i < 5; i++) {
        let angle = map(i, 0, 5, -PI/3, PI + PI/3);
        let x1 = cos(angle) * this.size * 0.8;
        let y1 = sin(angle) * this.size * 0.5;
        let x2 = cos(angle) * this.size * 1.2;
        let y2 = sin(angle) * this.size * 0.8;
        triangle(x1, y1, x2, y2, x1 + cos(angle + PI/2) * this.size * 0.2, y1 + sin(angle + PI/2) * this.size * 0.2);
      }
      
      // Central AI brain - more advanced and menacing
      fill(200, 100, 255, 180 + sin(frameCount * 0.05) * 75);
      ellipse(0, 0, this.size * 0.9, this.size * 0.9);
      
      // AI core patterns - more complex
      stroke(255, 200, 255, 150 + sin(frameCount * 0.1) * 50);
      strokeWeight(2);
      noFill();
      
      // Neural network pattern
      for (let i = 0; i < 5; i++) {
        let r = this.size * 0.3 + i * 0.1;
        beginShape();
        for (let j = 0; j < 12; j++) {
          let angle = TWO_PI / 12 * j;
          let x = cos(angle) * r + sin(frameCount * 0.02 + i + j) * 3;
          let y = sin(angle) * r + cos(frameCount * 0.02 + i + j) * 3;
          vertex(x, y);
        }
        endShape(CLOSE);
      }
      
      // Glowing eyes - multiple eyes for boss
      noStroke();
      for (let i = 0; i < 3; i++) {
        let angle = map(i, 0, 3, -PI/4, PI/4);
        let x = cos(angle) * this.size * 0.3;
        let y = sin(angle) * this.size * 0.3 - this.size * 0.1;
        let eyeSize = this.size * 0.15 * this.eyeSize;
        
        // Eye
        fill(255, 0, 100, 200 + sin(frameCount * 0.1 + i) * 55);
        ellipse(x, y, eyeSize, eyeSize);
        
        // Eye glow
        fill(255, 50, 150, 100);
        ellipse(x, y, eyeSize * 1.8, eyeSize * 1.8);
      }
      
      // Health bar - more dramatic
      noStroke();
      fill(30, 30, 30, 200);
      rect(-this.size, -this.size * 0.9, this.size * 2, this.size * 0.15, 5);
      
      // Health indicator with pulsing effect
      let healthRatio = this.health / this.maxHealth;
      let healthColor = lerpColor(
        color(255, 0, 0), 
        color(0, 255, 100),
        healthRatio
      );
      
      fill(healthColor);
      rect(-this.size, -this.size * 0.9, this.size * 2 * healthRatio, this.size * 0.15, 5);
      
      // Energy tendrils
      stroke(200, 100, 255, 100 + sin(frameCount * 0.1) * 50);
      strokeWeight(1);
      for (let i = 0; i < 8; i++) {
        let angle = TWO_PI / 8 * i;
        let x1 = cos(angle) * this.size * 0.5;
        let y1 = sin(angle) * this.size * 0.5;
        let x2 = cos(angle) * (this.size * 1.5 + sin(frameCount * 0.05 + i) * 10);
        let y2 = sin(angle) * (this.size * 1.0 + sin(frameCount * 0.05 + i) * 10);
        
        beginShape();
        vertex(x1, y1);
        let ctrlX1 = cos(angle + PI/8) * this.size;
        let ctrlY1 = sin(angle + PI/8) * this.size * 0.7;
        let ctrlX2 = cos(angle - PI/8) * this.size;
        let ctrlY2 = sin(angle - PI/8) * this.size * 0.7;
        bezierVertex(ctrlX1, ctrlY1, ctrlX2, ctrlY2, x2, y2);
        endShape();
      }
      
      // Engine glow
      noStroke();
      fill(200, 100, 255, 150 + sin(frameCount * 0.1) * 50);
      ellipse(-this.size * 0.5, this.size * 0.5, this.size * 0.4, this.size * 0.3);
      ellipse(this.size * 0.5, this.size * 0.5, this.size * 0.4, this.size * 0.3);
    }
    
    pop();
  }
  
  takeDamage() {
    this.health--;
    return this.health <= 0;
  }
}

class Bullet {
  constructor(x, y, speed, isPlayerBullet = false, vx = 0, vy = 0) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    
    // If speed is provided and no vx/vy, use traditional vertical movement
    if (speed !== 0 && vx === 0 && vy === 0) {
      this.vy = speed;
    }
    
    this.isPlayerBullet = isPlayerBullet;
    this.size = isPlayerBullet ? 4 : 3;
    
    // Different colors for different bullet types
    if (isPlayerBullet) {
      this.color = {r: 0, g: 200, b: 255};
    } else {
      // Enemy bullet colors based on enemy type
      this.color = {r: 255, g: 100, b: 0};
    }
    
    this.trail = [];
    this.maxTrailLength = 10;
    this.age = 0;
  }
  
  update() {
    // Add current position to trail
    this.trail.push({x: this.x, y: this.y});
    
    // Keep trail at max length
    if (this.trail.length > this.maxTrailLength) {
      this.trail.shift();
    }
    
    // Update position
    this.x += this.vx;
    this.y += this.vy;
    this.age++;
  }
  
  draw() {
    // Draw trail
    noStroke();
    for (let i = 0; i < this.trail.length; i++) {
      let alpha = map(i, 0, this.trail.length, 50, 200);
      fill(this.color.r, this.color.g, this.color.b, alpha);
      let size = map(i, 0, this.trail.length, this.size/3, this.size);
      ellipse(this.trail[i].x, this.trail[i].y, size, size);
    }
    
    // Draw bullet
    fill(this.color.r, this.color.g, this.color.b);
    ellipse(this.x, this.y, this.size, this.size);
    
    // Glow effect
    fill(this.color.r, this.color.g, this.color.b, 100);
    ellipse(this.x, this.y, this.size * 2, this.size * 2);
  }
  
  isOffScreen() {
    return this.x < -50 || this.x > WIDTH + 50 || this.y < -50 || this.y > HEIGHT + 50;
  }
}

class Explosion {
  constructor(x, y, size = 50, color = {r: 255, g: 100, b: 0}) {
    this.x = x;
    this.y = y;
    this.size = 0;
    this.maxSize = size;
    this.growthRate = 5;
    this.particles = [];
    this.rings = [];
    this.color = color;
    this.alpha = 255;
    
    // Create explosion particles
    for (let i = 0; i < 20; i++) {
      let angle = random(TWO_PI);
      let speed = random(1, 3);
      let particleSize = random(2, 6);
      let lifespan = random(30, 60);
      
      this.particles.push({
        x: this.x,
        y: this.y,
        vx: cos(angle) * speed,
        vy: sin(angle) * speed,
        size: particleSize,
        alpha: 255,
        decay: 255 / lifespan
      });
    }
    
    // Create explosion rings
    for (let i = 0; i < 3; i++) {
      this.rings.push({
        size: 0,
        alpha: 200,
        growthRate: random(3, 8),
        decay: random(5, 10)
      });
    }
    
    // Create global particles for debris
    for (let i = 0; i < 10; i++) {
      particles.push(new Particle(
        this.x, 
        this.y, 
        this.color.r, 
        this.color.g, 
        this.color.b, 
        random(30, 60)
      ));
    }
  }
  
  update() {
    // Update main explosion size
    this.size += this.growthRate;
    this.alpha -= 10;
    
    // Update particles
    for (let particle of this.particles) {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.alpha -= particle.decay;
    }
    
    // Update rings
    for (let ring of this.rings) {
      ring.size += ring.growthRate;
      ring.alpha -= ring.decay;
    }
  }
  
  draw() {
    // Draw explosion rings
    for (let ring of this.rings) {
      if (ring.alpha > 0) {
        noFill();
        stroke(this.color.r, this.color.g, this.color.b, ring.alpha);
        strokeWeight(2);
        ellipse(this.x, this.y, ring.size, ring.size);
      }
    }
    
    // Draw explosion particles
    noStroke();
    for (let particle of this.particles) {
      if (particle.alpha > 0) {
        fill(this.color.r, this.color.g, this.color.b, particle.alpha);
        ellipse(particle.x, particle.y, particle.size, particle.size);
      }
    }
    
    // Draw main explosion
    fill(this.color.r, this.color.g, this.color.b, this.alpha * 0.5);
    ellipse(this.x, this.y, this.size, this.size);
    
    // Draw explosion glow
    fill(this.color.r, this.color.g, this.color.b, this.alpha * 0.2);
    ellipse(this.x, this.y, this.size * 1.5, this.size * 1.5);
    
    noStroke();
  }
  
  isFinished() {
    return this.size >= this.maxSize && this.alpha <= 0;
  }
}

class Star {
  constructor() {
    this.x = random(WIDTH);
    this.y = random(HEIGHT);
    this.size = random(1, 3);
    this.baseSize = this.size;
    this.speed = random(0.5, 2);
    this.brightness = random(150, 255);
    this.twinkleSpeed = random(0.02, 0.1);
    this.twinkleOffset = random(0, TWO_PI);
    this.color = {
      r: random(200, 255),
      g: random(200, 255),
      b: random(200, 255)
    };
    // Add more variation to stars
    this.twinkleAmount = random(0.5, 1.5); // How much the star twinkles
    this.pulseSize = random(1.5, 3);       // Maximum size multiplier during pulse
  }
  
  update() {
    this.y += this.speed;
    if (this.y > HEIGHT) {
      this.y = 0;
      this.x = random(WIDTH);
    }
    
    // Enhanced twinkle effect
    let twinkleFactor = sin(frameCount * this.twinkleSpeed + this.twinkleOffset);
    this.size = this.baseSize + twinkleFactor * this.twinkleAmount;
  }
  
  draw() {
    // Calculate twinkle brightness with more dramatic effect
    let twinkleBrightness = this.brightness + sin(frameCount * this.twinkleSpeed + this.twinkleOffset) * 100;
    
    // Occasionally create a "pulse" effect for random stars
    let sizeMult = 1;
    if (random(100) < 1) { // 1% chance each frame
      sizeMult = this.pulseSize;
      // Add a small particle burst for the pulsing star
      particles.push(new Particle(
        this.x, 
        this.y, 
        this.color.r, 
        this.color.g, 
        this.color.b, 
        20
      ));
    }
    
    // Draw star with enhanced glow
    fill(this.color.r, this.color.g, this.color.b, twinkleBrightness);
    ellipse(this.x, this.y, this.size * sizeMult, this.size * sizeMult);
    
    // Draw stronger glow
    fill(this.color.r, this.color.g, this.color.b, twinkleBrightness * 0.4);
    ellipse(this.x, this.y, this.size * 2 * sizeMult, this.size * 2 * sizeMult);
    
    // Add an extra outer glow for more prominent stars
    if (this.baseSize > 2) {
      fill(this.color.r, this.color.g, this.color.b, twinkleBrightness * 0.2);
      ellipse(this.x, this.y, this.size * 4 * sizeMult, this.size * 4 * sizeMult);
    }
  }
}

class Particle {
  constructor(x, y, r, g, b, lifespan = 60) {
    this.x = x;
    this.y = y;
    this.vx = random(-1, 1);
    this.vy = random(-1, 1);
    this.alpha = 255;
    this.size = random(2, 5);
    this.r = r;
    this.g = g;
    this.b = b;
    this.lifespan = lifespan;
  }
  
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= 255 / this.lifespan;
    this.size *= 0.95;
  }
  
  draw() {
    noStroke();
    fill(this.r, this.g, this.b, this.alpha);
    ellipse(this.x, this.y, this.size, this.size);
  }
  
  isDead() {
    return this.alpha <= 0;
  }
}

class PowerUp {
  constructor(x = null, y = null) {
    this.x = x !== null ? x : random(WIDTH);
    this.y = y !== null ? y : 0;
    this.speed = 2;
    this.type = floor(random(5)); // 0: weapon upgrade, 1: shield, 2: extra life, 3: rapid fire, 4: triple shot
    this.size = 15;
    this.rotation = 0;
  }
  
  update() {
    this.y += this.speed;
    this.rotation += 0.05;
  }
  
  draw() {
    push();
    translate(this.x, this.y);
    rotate(this.rotation);
    
    // Draw power-up based on type
    if (this.type === 0) {
      // Weapon upgrade - red
      fill(255, 50, 50);
      rect(-this.size/2, -this.size/2, this.size, this.size);
      fill(255);
      textSize(10);
      textAlign(CENTER, CENTER);
      text("W", 0, 0);
    } else if (this.type === 1) {
      // Shield - blue
      fill(50, 50, 255);
      ellipse(0, 0, this.size, this.size);
      noFill();
      stroke(255);
      ellipse(0, 0, this.size * 0.7, this.size * 0.7);
    } else if (this.type === 2) {
      // Extra life - green
      fill(50, 255, 50);
      beginShape();
      for (let i = 0; i < 5; i++) {
        let angle = TWO_PI / 5 * i - HALF_PI;
        let x = cos(angle) * this.size;
        let y = sin(angle) * this.size;
        vertex(x, y);
      }
      endShape(CLOSE);
      fill(255);
      textSize(10);
      textAlign(CENTER, CENTER);
      text("1UP", 0, 0);
    } else if (this.type === 3) {
      // Rapid fire - orange
      fill(255, 150, 0);
      rect(-this.size/2, -this.size/2, this.size, this.size, 3);
      fill(255);
      textSize(10);
      textAlign(CENTER, CENTER);
      text("RF", 0, 0);
    } else if (this.type === 4) {
      // Triple shot - purple
      fill(200, 50, 255);
      triangle(0, -this.size/2, -this.size/2, this.size/2, this.size/2, this.size/2);
      fill(255);
      textSize(10);
      textAlign(CENTER, CENTER);
      text("3X", 0, 0);
    }
    
    pop();
    
    // Glow effect
    noStroke();
    let glowColor;
    if (this.type === 0) glowColor = [255, 50, 50, 100];
    else if (this.type === 1) glowColor = [50, 50, 255, 100];
    else if (this.type === 2) glowColor = [50, 255, 50, 100];
    else if (this.type === 3) glowColor = [255, 150, 0, 100];
    else glowColor = [200, 50, 255, 100];
    
    fill(glowColor[0], glowColor[1], glowColor[2], glowColor[3] + sin(frameCount * 0.1) * 50);
    ellipse(this.x, this.y, this.size * 2, this.size * 2);
  }
  
  applyEffect() {
    if (this.type === 0) {
      // Weapon upgrade
      player.upgradeWeapon();
      // Create particles
      for (let i = 0; i < 20; i++) {
        particles.push(new Particle(this.x, this.y, 255, 50, 50));
      }
    } else if (this.type === 1) {
      // Shield
      shieldActive = true;
      shieldTime = 600; // 10 seconds at 60fps
      // Create particles
      for (let i = 0; i < 20; i++) {
        particles.push(new Particle(this.x, this.y, 50, 50, 255));
      }
    } else if (this.type === 2) {
      // Extra life
      lives++;
      // Create particles
      for (let i = 0; i < 20; i++) {
        particles.push(new Particle(this.x, this.y, 50, 255, 50));
      }
    } else if (this.type === 3) {
      // Rapid fire
      rapidFireActive = true;
      rapidFireTime = 600; // 10 seconds at 60fps
      // Create particles
      for (let i = 0; i < 20; i++) {
        particles.push(new Particle(this.x, this.y, 255, 150, 0));
      }
    } else if (this.type === 4) {
      // Triple shot
      tripleShot = true;
      tripleShotTime = 600; // 10 seconds at 60fps
      // Create particles
      for (let i = 0; i < 20; i++) {
        particles.push(new Particle(this.x, this.y, 200, 50, 255));
      }
    }
  }
}

// Function to draw the space background with gradient
function drawBackground() {
  // Create a darker space background
  push();
  noStroke();
  
  // Deep space gradient - darker version
  for (let y = 0; y < HEIGHT; y++) {
    let inter = map(y, 0, HEIGHT, 0, 1);
    let c = lerpColor(
      color(0, 0, 15),      // Almost black at top
      color(20, 0, 40),     // Very dark purple at bottom
      inter
    );
    stroke(c);
    line(0, y, WIDTH, y);
  }
  
  // Add subtle nebula effects with lower opacity
  for (let i = 0; i < 3; i++) {
    let x = random(WIDTH);
    let y = random(HEIGHT);
    let size = random(100, 300);
    
    // Create a nebula cloud
    for (let j = 0; j < 30; j++) {
      let angle = random(TWO_PI);
      let dist = random(size);
      let alpha = random(2, 10); // Lower alpha for subtler effect
      
      let nebulaX = x + cos(angle) * dist;
      let nebulaY = y + sin(angle) * dist;
      
      // Random nebula colors - darker
      let nebulaColor;
      let colorChoice = floor(random(3));
      if (colorChoice === 0) {
        nebulaColor = color(50, 20, 80, alpha); // Dark Purple
      } else if (colorChoice === 1) {
        nebulaColor = color(20, 40, 80, alpha); // Dark Blue
      } else {
        nebulaColor = color(80, 20, 50, alpha); // Dark Pink
      }
      
      fill(nebulaColor);
      ellipse(nebulaX, nebulaY, random(20, 80), random(20, 80));
    }
  }
  
  pop();
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

// Leaderboard functions
async function fetchLeaderboard() {
  isLoadingLeaderboard = true;
  leaderboardError = null;
  
  // Save any current game entry before fetching
  const currentGameEntry = leaderboardData.find(entry => entry.isCurrentGame);
  
  try {
    console.log("Starting fetchLeaderboard function...");
    // Removed detailed client state logs
    
    // Check if supabase is properly initialized
    if (!supabase || typeof supabase.from !== 'function') {
      console.error("Supabase client validation failed");
      
      // Try to reinitialize from window.supabase if available
      if (window.supabase && typeof window.supabase.from === 'function') {
        console.log("Attempting to use window.supabase instead");
        supabase = window.supabase;
      } else {
        throw new Error("Supabase client is not properly initialized. Make sure the Supabase library is loaded and configured correctly.");
      }
    }
    
    console.log("Attempting to fetch leaderboard data...");
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('score', { ascending: false })
      .limit(20); // Get more entries initially to handle duplicates
    
    if (error) throw error;
    
    // Filter out any entries with score 0
    const filteredData = (data || []).filter(entry => entry.score > 0);
    
    // Handle duplicate emails - keep only the highest score for each email
    const uniqueData = [];
    const emailsProcessed = new Set();
    
    // Process entries in order (highest score first)
    for (const entry of filteredData) {
      if (!emailsProcessed.has(entry.player_email)) {
        uniqueData.push(entry);
        emailsProcessed.add(entry.player_email);
        
        // Only keep top 10 after deduplication
        if (uniqueData.length >= 10) {
          break;
        }
      }
    }
    
    leaderboardData = uniqueData;
    console.log("Leaderboard data after deduplication:", leaderboardData);
    
    // Re-add current game entry if it exists and has a score > 0
    if (currentGameEntry && currentGameEntry.score > 0) {
      leaderboardData.push(currentGameEntry);
      // Sort by score in descending order
      leaderboardData.sort((a, b) => b.score - a.score);
    }
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    leaderboardError = error.message || "Failed to load leaderboard";
    
    // Additional debugging (removed sensitive information)
    console.log("Supabase client initialized:", !!supabase);
    
    // If we have a current game entry with score > 0, make sure it's still displayed
    if (currentGameEntry && currentGameEntry.score > 0 && !leaderboardData.some(entry => entry.isCurrentGame)) {
      leaderboardData.push(currentGameEntry);
      leaderboardData.sort((a, b) => b.score - a.score);
    }
  } finally {
    isLoadingLeaderboard = false;
  }
}

function showEmailForm() {
  // Ensure we're in a paused state while the form is open
  noLoop();
  
  const formElement = document.getElementById('email-input');
  formElement.style.display = 'block';
  emailInput.focus();
  inputMessage.textContent = '';
  inputMessage.className = '';
  shareButton.style.display = 'none';
  
  // Add event listener for the cancel button
  cancelButton.onclick = function() {
    hideEmailForm();
    loop();
  };
  
  // Add event listener for the submit button
  submitButton.onclick = submitScore;
  
  // Remove any existing view leaderboard buttons
  const existingButton = document.getElementById('view-leaderboard-button');
  if (existingButton) {
    existingButton.remove();
  }
  
  const existingAfterSubmitButton = document.getElementById('view-leaderboard-after-submit');
  if (existingAfterSubmitButton) {
    existingAfterSubmitButton.remove();
  }
}

function hideEmailForm() {
  const formElement = document.getElementById('email-input');
  formElement.style.display = 'none';
  emailInput.value = '';
  
  // Re-enable the submit button
  submitButton.disabled = false;
  
  // Resume the game loop if it was paused
  loop();
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
    console.warn("window.finalGameStats is not available, creating it now");
    window.finalGameStats = {
      score: finalScore,
      level: level,
      killStreak: killStreak
    };
  }
  
  const gameStats = window.finalGameStats;
  const scoreToSubmit = gameStats.score;
  
  // Prevent submission of 0 scores
  if (scoreToSubmit <= 0) {
    inputMessage.textContent = 'Cannot submit a score of 0';
    inputMessage.className = 'error';
    return;
  }
  
  // Pause game loop to prevent any further changes during submission
  noLoop();
  
  // Debug display
  console.log("Submitting score from gameStats:", gameStats);
  console.log("Current game state - score:", score, "finalScore:", finalScore, "killStreak:", killStreak);
  console.log("window.finalGameStats:", window.finalGameStats);
  
  inputMessage.textContent = 'Submitting score...';
  inputMessage.className = '';
  submitButton.disabled = true;
  
  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .insert([
        { 
          player_email: email,
          score: scoreToSubmit,
          level_reached: gameStats.level,
          enemies_destroyed: gameStats.killStreak
        }
      ]);
    
    if (error) throw error;
    
    scoreSubmitted = true;
    inputMessage.textContent = `Score ${scoreToSubmit} submitted successfully!`;
    inputMessage.className = 'success';
    shareButton.style.display = 'inline-block';
    
    // Fetch updated leaderboard
    fetchLeaderboard();
    
    // Add a view leaderboard button
    let viewLeaderboardAfterSubmit;
    
    // Check if the button already exists
    if (!document.getElementById('view-leaderboard-after-submit')) {
      viewLeaderboardAfterSubmit = document.createElement('button');
      viewLeaderboardAfterSubmit.textContent = 'View Leaderboard';
      viewLeaderboardAfterSubmit.id = 'view-leaderboard-after-submit';
      viewLeaderboardAfterSubmit.style.marginTop = '10px';
      viewLeaderboardAfterSubmit.style.backgroundColor = '#6666ff';
      document.getElementById('email-input').appendChild(viewLeaderboardAfterSubmit);
    } else {
      viewLeaderboardAfterSubmit = document.getElementById('view-leaderboard-after-submit');
    }
    
    // Add event listener for the view leaderboard button
    viewLeaderboardAfterSubmit.onclick = function() {
      hideEmailForm();
      gameState = "leaderboard";
    };
    
    // Hide form after a delay
    setTimeout(() => {
      hideEmailForm();
    }, 5000); // Increased to 5 seconds to give more time to click the button
    
  } catch (error) {
    console.error("Error submitting score:", error);
    inputMessage.textContent = error.message || 'Failed to submit score';
    inputMessage.className = 'error';
    submitButton.disabled = false;
    
    // Resume game loop in case of error
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