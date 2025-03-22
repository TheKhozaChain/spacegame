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
let invincibilityFrames = 0; // Added to prevent multiple hits in the same frame
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
  
  // DIRECT API APPROACH: Using direct Supabase REST API calls
  console.log("Using direct API calls for leaderboard");
  
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
      console.log("At game over, killStreak is:", killStreak, "and will be stored in finalGameStats");
      
      // IMPORTANT: We no longer stop the game loop here to allow interaction
      // Instead, we'll just return to prevent further game updates
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
        // Check if shield is active - if so, don't reduce lives
        if (shieldActive) {
          // Just destroy the enemy without reducing lives
          explosions.push(new Explosion(enemies[i].x, enemies[i].y));
          playExplosionSound();
          // Add shield hit effect
          for (let j = 0; j < 10; j++) {
            particles.push(new Particle(
              enemies[i].x, 
              enemies[i].y, 
              0, 200, 255, // Blue shield color
              30
            ));
          }
          enemies.splice(i, 1);
        } else if (invincibilityFrames <= 0) { // Only take damage if not invincible
          // No shield, reduce lives
          lives--;
          explosions.push(new Explosion(enemies[i].x, enemies[i].y));
          playExplosionSound();
          enemies.splice(i, 1);
          
          // Give invincibility frames to prevent multiple hits at once
          invincibilityFrames = 60; // 1 second invincibility
          
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
            
            // IMPORTANT: We no longer stop the game loop here to allow interaction
            // Instead, we'll just return from the draw function
            return;
          }
        } else {
          // Player is in invincibility frames but still destroy the enemy
          explosions.push(new Explosion(enemies[i].x, enemies[i].y));
          playExplosionSound();
          enemies.splice(i, 1);
        }
        continue;
      }
      
      // Check if enemy has gone off-screen
      if (enemies[i].y > HEIGHT + 20) {
        escapedEnemies++;
        if (penalizeEscapedEnemies && !shieldActive) {
          // Only deduct lives if shield is not active
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
            
            // IMPORTANT: We no longer stop the game loop here to allow interaction
            // Instead, we'll just return from the draw function
            return;
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
                
                // Give temporary shield when boss is defeated for safety
                shieldActive = true;
                shieldTime = 120; // 2 seconds at 60fps
                
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
            
            // Update combo - CRITICAL for tracking enemies destroyed
            killStreak++;
            console.log("Enemy destroyed! killStreak increased to:", killStreak);
            
            // Update finalGameStats immediately if it exists, so we don't lose the count
            if (window.finalGameStats) {
              window.finalGameStats.killStreak = killStreak;
              console.log("Updated window.finalGameStats.killStreak to:", killStreak);
            }
            
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
            
            // Ensure killStreak is correctly updated in finalGameStats if game is already over
            if (gameState === "gameOver" && window.finalGameStats) {
              window.finalGameStats.killStreak = killStreak;
              console.log("Updated finalGameStats.killStreak after enemy destroyed:", window.finalGameStats.killStreak);
            }
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
        // Check if shield is active - if so, don't reduce lives
        if (shieldActive) {
          // Just destroy the bullet without reducing lives
          // Add shield hit effect
          for (let j = 0; j < 5; j++) {
            particles.push(new Particle(
              enemyBullets[i].x, 
              enemyBullets[i].y, 
              0, 200, 255, // Blue shield color
              20
            ));
          }
          enemyBullets.splice(i, 1);
        } else if (invincibilityFrames <= 0) { // Only take damage if not invincible
          // No shield, reduce lives
          lives--;
          explosions.push(new Explosion(player.x, player.y));
          playExplosionSound();
          enemyBullets.splice(i, 1);
          
          // Set invincibility frames to prevent multiple hits
          invincibilityFrames = 60; // 1 second invincibility
          
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
            
            // IMPORTANT: We no longer stop the game loop here to allow interaction
            // Instead, we'll just return from the draw function
            return;
          }
        } else {
          // Player is in invincibility frames but still destroy the bullet
          enemyBullets.splice(i, 1);
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
  
  // Add debug logging to track killStreak and finalGameStats
  console.log("Drawing game over screen, current killStreak:", killStreak);
  console.log("finalGameStats available:", window.finalGameStats ? "yes" : "no");
  if (window.finalGameStats) {
    console.log("finalGameStats killStreak:", window.finalGameStats.killStreak);
  }
  
  // Create a more robust way to get the kill streak value
  let displayKillStreak = 0;
  
  // First try window.finalGameStats if available
  if (window.finalGameStats && typeof window.finalGameStats.killStreak === 'number' && window.finalGameStats.killStreak > 0) {
    displayKillStreak = window.finalGameStats.killStreak;
    console.log("Using window.finalGameStats.killStreak:", displayKillStreak);
  } 
  // Fallback to current killStreak if it has a value
  else if (typeof killStreak === 'number' && killStreak > 0) {
    displayKillStreak = killStreak;
    console.log("Using current killStreak:", displayKillStreak);
  } 
  // Last resort - try to calculate from score (approximately)
  else if (finalScore > 0) {
    // Estimate kill count based on score (assuming average 10 points per enemy)
    displayKillStreak = Math.floor(finalScore / 10);
    console.log("Estimated killStreak from score:", displayKillStreak);
  }
  
  // Make sure we log what is being displayed
  console.log("Final displayKillStreak that will be shown:", displayKillStreak);
  
  // FIXED: Make sure we always have a valid finalScore for display and submission
  if (finalScore <= 0 && window.finalGameStats && window.finalGameStats.score > 0) {
    finalScore = window.finalGameStats.score;
    console.log("Corrected finalScore to", finalScore, "from window.finalGameStats");
  } else if (finalScore <= 0 && score > 0) {
    finalScore = score;
    console.log("Corrected finalScore to current score:", finalScore);
    
    // Also update finalGameStats to ensure consistency
    if (!window.finalGameStats) {
      window.finalGameStats = {
        score: finalScore,
        level: level,
        killStreak: killStreak
      };
    } else {
      window.finalGameStats.score = finalScore;
      // Also ensure killStreak is set if it wasn't already
      if (!window.finalGameStats.killStreak || window.finalGameStats.killStreak <= 0) {
        window.finalGameStats.killStreak = killStreak;
      }
    }
  }
  
  // IMPORTANT: We no longer stop the game loop here to allow interaction with buttons
  // Instead, we ensure the game state is properly set to prevent gameplay updates
  
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
  background(0);
  
  // Title
  fill(255);
  textSize(36);
  textAlign(CENTER, CENTER);
  text("LEADERBOARD", WIDTH / 2, 50);
  
  if (isLoadingLeaderboard) {
    // Loading indicator
    fill(255);
    textSize(24);
    text("Loading leaderboard...", WIDTH / 2, HEIGHT / 2);
    return;
  }
  
  if (leaderboardError) {
    // Error message
    fill(255, 50, 50);
    textSize(24);
    text("Error: " + leaderboardError, WIDTH / 2, HEIGHT / 2);
    
    // Back button
    fill(100, 100, 255);
    rect(WIDTH / 2 - 100, HEIGHT - 100, 200, 40, 10);
    fill(255);
    textSize(20);
    text("BACK TO MENU", WIDTH / 2, HEIGHT - 80);
    return;
  }
  
  if (!leaderboardData || leaderboardData.length === 0) {
    // No data
    fill(255);
    textSize(24);
    text("No scores yet. Be the first!", WIDTH / 2, HEIGHT / 2);
    
    // Back button
    fill(100, 100, 255);
    rect(WIDTH / 2 - 100, HEIGHT - 100, 200, 40, 10);
    fill(255);
    textSize(20);
    text("BACK TO MENU", WIDTH / 2, HEIGHT - 80);
    return;
  }
  
  // Display leaderboard entries
  const entriesPerPage = 10;
  const startIndex = 0;
  const endIndex = Math.min(startIndex + entriesPerPage, leaderboardData.length);
  
  // Header
  fill(150, 150, 255);
  textSize(20);
  textAlign(LEFT, CENTER);
  text("RANK", 50, 100);
  text("PLAYER", 150, 100);
  text("SCORE", 400, 100);
  text("LEVEL", 500, 100);
  text("KILLS", 600, 100);
  
  // Entries
  for (let i = startIndex; i < endIndex; i++) {
    const entry = leaderboardData[i];
    const y = 140 + (i - startIndex) * 40;
    
    // Highlight current player's score
    if (entry.player_email === document.getElementById('player-email').value) {
      fill(0, 100, 0, 100);
      rect(40, y - 20, WIDTH - 80, 40);
    }
    
    // Rank
    fill(255);
    textAlign(LEFT, CENTER);
    text(`${i + 1}`, 50, y);
    
    // Player (email with privacy)
    const email = entry.player_email;
    const displayEmail = email.length > 12 ? 
      email.substring(0, 4) + "..." + email.substring(email.indexOf('@')) : 
      email;
    
    // Display email without local label
    fill(255);
    if (entry.isCurrentGame) {
      fill(200, 200, 255); // Highlight current game with light blue
      text(displayEmail, 150, y);
    } else {
      text(displayEmail, 150, y);
    }
    
    // Score
    fill(255, 255, 100);
    text(entry.score, 400, y);
    
    // Level
    fill(100, 255, 100);
    text(entry.level_reached || "1", 500, y);
    
    // Kills - ensure enemies_destroyed is properly displayed
    fill(255, 100, 100);
    // Get the kill count, ensuring it's never displayed as 0 unless truly 0
    const killCount = entry.enemies_destroyed !== undefined && entry.enemies_destroyed !== null 
      ? entry.enemies_destroyed 
      : (entry.isCurrentGame && window.finalGameStats 
         ? window.finalGameStats.killStreak 
         : "0");
    text(killCount, 600, y);
  }
  
  // Back button
  fill(100, 100, 255);
  rect(WIDTH / 2 - 100, HEIGHT - 100, 200, 40, 10);
  fill(255);
  textSize(20);
  textAlign(CENTER, CENTER);
  text("BACK TO MENU", WIDTH / 2, HEIGHT - 80);
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
      console.log("Leaderboard button clicked on title screen");
      fetchLeaderboard();
      gameState = "leaderboard";
    }
    
    // Check if play button was clicked
    if (mouseX > WIDTH / 2 - 100 && mouseX < WIDTH / 2 + 100 &&
        mouseY > HEIGHT * 3/4 && mouseY < HEIGHT * 3/4 + 40) {
      console.log("Play button clicked on title screen");
      gameState = "playing";
    }
  }
  // Handle button clicks on game over screen
  else if (gameState === "gameOver") {
    console.log("Mouse pressed on game over screen at", mouseX, mouseY);
    
    // Check if submit to leaderboard button was clicked
    if (!scoreSubmitted &&
        mouseX > WIDTH / 2 - 150 && mouseX < WIDTH / 2 + 150 &&
        mouseY > HEIGHT / 4 + 260 && mouseY < HEIGHT / 4 + 300) {
      console.log("Submit to leaderboard button clicked");
      
      // Make sure we have consistent game stats
      if (!window.finalGameStats) {
        console.log("Creating finalGameStats before showing email form");
        window.finalGameStats = {
          score: finalScore,
          level: level,
          killStreak: killStreak
        };
      }
      
      // Show email form
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
  // If we've just submitted a score, don't reset stats immediately
  if (scoreSubmitted) {
    console.log("Score was submitted - preserving stats");
    scoreSubmitted = false; // Reset for next game
    gameState = "playing";
    return;
  }
  
  // Save high score
  if (finalScore > highScore) {
    highScore = finalScore;
  }
  
  // Clear saved game stats
  window.finalGameStats = null;
  console.log("Game restarted, stats reset. window.finalGameStats cleared");
  
  // Save the current Supabase client reference before resetting
  const currentSupabase = supabase;
  
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
  
  // Explicitly reset the kill streak to 0
  killStreak = 0;
  console.log("killStreak reset to 0");
  
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
  
  // Restore the Supabase client reference
  supabase = currentSupabase;
  
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
    
    // Add temporary shield when boss spawns to prevent instant deaths
    shieldActive = true;
    shieldTime = 180; // 3 seconds at 60fps
    
    // Schedule boss spawn after a short delay to prevent unfair deaths
    setTimeout(() => {
      spawnBoss();
    }, 1000);
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
    
    // Update invincibility frames to prevent multiple hits in the same frame
    if (invincibilityFrames > 0) {
      invincibilityFrames--;
    }
    
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
    
    // FIXED: Ensure powerups don't disable shooting
    // Reset any invalid states that might prevent shooting
    if (this.shootCooldown < 0) {
      this.shootCooldown = 0;
    }
  }
  
  shoot() {
    // Calculate current cooldown based on power-ups
    let currentCooldown = rapidFireActive ? this.baseShootCooldown / 2 : this.baseShootCooldown;
    
    // FIXED: Ensure shooting is always enabled regardless of powerups
    // The previous implementation might have had issues with powerups disabling shooting
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
        console.warn("Error playing shoot sound:", e);
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
    
    // Visual indicator for invincibility frames
    if (invincibilityFrames > 0) {
      // Draw invincibility effect (blinking/transparency)
      if (frameCount % 4 < 2) { // Blink every few frames
        noFill();
        stroke(255, 255, 0, 150 + sin(frameCount * 0.3) * 50);
        strokeWeight(2);
        ellipse(0, 0, this.size * 2, this.size * 2);
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
  gameState = "leaderboard";
  
  try {
    // CORS FIX: Try to fetch from API with fallback to localStorage
    console.log("Fetching leaderboard data...");
    
    // Store the current game score temporarily for display if not yet submitted
    let currentGameEntry = null;
    if (!scoreSubmitted && finalScore > 0) {
      // If we have saved game stats, use those
      const currentGameScore = window.finalGameStats ? window.finalGameStats.score : finalScore;
      const currentGameLevel = window.finalGameStats ? window.finalGameStats.level : level;
      const currentGameKillStreak = window.finalGameStats ? window.finalGameStats.killStreak : killStreak;
      
      // Create a temporary entry for the current game
      currentGameEntry = {
        player_email: "Current Game",
        score: currentGameScore,
        level_reached: currentGameLevel,
        enemies_destroyed: currentGameKillStreak,
        isCurrentGame: true  // Flag to identify this as the current game
      };
      
      console.log("Created current game entry for display:", currentGameEntry);
    }
    
    // Reset leaderboard data
    leaderboardData = [];
    
    // Get API leaderboard data - this will always fetch the latest scores from the server
    let apiData = [];
    try {
      if (window.supabaseApi && typeof window.supabaseApi.getLeaderboard === 'function') {
        apiData = await window.supabaseApi.getLeaderboard();
        console.log("API leaderboard data:", apiData.length, "entries");
      } else {
        console.warn("window.supabaseApi not available or missing getLeaderboard method");
      }
    } catch (apiError) {
      console.error("Error fetching API leaderboard:", apiError);
    }
    
    // If we got API data, use it as our primary source
    if (apiData && apiData.length > 0) {
      console.log("Using API data as primary source");
      leaderboardData = [...apiData];
    } else {
      // If API failed, try to get stored leaderboard data from localStorage
      try {
        console.log("API data empty or failed, trying localStorage");
        const storedApiData = localStorage.getItem('spaceGameApiLeaderboard');
        if (storedApiData) {
          const parsedApiData = JSON.parse(storedApiData);
          if (parsedApiData && parsedApiData.length > 0) {
            console.log("Using cached API data from localStorage:", parsedApiData.length, "entries");
            leaderboardData = [...parsedApiData];
          }
        }
      } catch (localApiError) {
        console.error("Error reading cached API data:", localApiError);
      }
    }
    
    // Get regular localStorage data as a fallback or supplement
    let localData = [];
    try {
      const storedData = localStorage.getItem('spaceGameLeaderboard');
      if (storedData) {
        localData = JSON.parse(storedData);
        console.log("Local leaderboard data:", localData.length, "entries");
      }
    } catch (localError) {
      console.error("Error fetching local leaderboard:", localError);
    }
    
    // If we still don't have any data from API or API cache, use local data
    if (leaderboardData.length === 0 && localData.length > 0) {
      console.log("No API data available, using local data as primary source");
      leaderboardData = [...localData];
    }
    // Otherwise, supplement API data with any local entries not in the API data
    else if (localData.length > 0) {
      console.log("Supplementing API data with local entries");
      
      // Extract emails from API data for quick lookup
      const apiEmails = new Set(leaderboardData.map(entry => entry.player_email));
      
      // Add local entries that don't exist in API data
      for (const localEntry of localData) {
        // Only add entries that are marked as API successful submissions or
        // entries that don't exist in the API data
        if ((localEntry.is_api || !apiEmails.has(localEntry.player_email)) && 
            localEntry.player_email !== "Current Game") {
          // Mark as local entry if not already marked
          if (!localEntry.is_local) localEntry.is_local = true;
          leaderboardData.push(localEntry);
        }
      }
    }
    
    // Sort by score (highest first)
    leaderboardData.sort((a, b) => b.score - a.score);
    
    // If we have a current game entry, add it to the leaderboard
    if (currentGameEntry) {
      // Insert at beginning before sorting by score
      leaderboardData.unshift(currentGameEntry);
    }
    
    console.log("Final leaderboard data:", leaderboardData.length, "entries");
    
    // Only set error if we literally have no data at all
    if (leaderboardData.length === 0) {
      leaderboardError = "No leaderboard data available";
    }
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    leaderboardError = error.message || "Failed to fetch leaderboard";
    
    // Even if there's an error, still show the current game if available
    if (!scoreSubmitted && finalScore > 0 && leaderboardData.length === 0) {
      const tempEntry = {
        player_email: "Current Game",
        score: finalScore,
        level_reached: level,
        enemies_destroyed: killStreak,
        isCurrentGame: true,
        is_local: true
      };
      leaderboardData = [tempEntry];
      // Clear the error since we have at least one entry
      leaderboardError = null;
    }
  } finally {
    isLoadingLeaderboard = false;
  }
}

function showEmailForm() {
  // We no longer stop the game loop here to prevent freezing
  // Instead, we'll just pause updates while the form is visible
  
  // FIXED: More robust handling of final score
  // First, find the best available score
  let bestScore = 0;
  if (window.finalGameStats && window.finalGameStats.score > 0) {
    bestScore = window.finalGameStats.score;
  } else if (finalScore > 0) {
    bestScore = finalScore;
  } else if (score > 0) {
    bestScore = score;
  }
  
  // Now make sure window.finalGameStats has the correct score
  if (!window.finalGameStats || window.finalGameStats.score <= 0) {
    console.log("Creating or updating finalGameStats with best score:", bestScore);
    window.finalGameStats = {
      score: bestScore,
      level: level,
      killStreak: killStreak
    };
  }
  
  // Also ensure finalScore has a valid value (needed for display and other checks)
  if (finalScore <= 0 && bestScore > 0) {
    finalScore = bestScore;
    console.log("Updated finalScore to best available score:", finalScore);
  }
  
  console.log("Final game stats before showing email form:", window.finalGameStats);
  console.log("Current finalScore:", finalScore, "Current score:", score, "Best score:", bestScore);
  
  // ENHANCED ROBUST SUPABASE CONNECTION FIX:
  // Always force a fresh Supabase client initialization before showing the form
  let supabaseConnected = false;
  
  // 1. First attempt: Use window.initSupabase if available (most reliable method)
  if (window.initSupabase && typeof window.initSupabase === 'function') {
    console.log("Initializing fresh Supabase client using window.initSupabase");
    const success = window.initSupabase();
    if (success) {
      supabase = window.supabase;
      console.log("Successfully initialized fresh Supabase client");
      supabaseConnected = true;
    }
  }
  
  // 2. Second attempt: Try to access the already created client
  if (!supabaseConnected && window.supabase && typeof window.supabase.from === 'function') {
    console.log("Using existing Supabase client from window object");
    supabase = window.supabase;
    supabaseConnected = true;
  }
  
  // 3. Third attempt: Create a new client directly using the library
  if (!supabaseConnected && window.SUPABASE_URL && window.SUPABASE_KEY) {
    console.log("Creating new Supabase client directly");
    try {
      // Verify the supabase library is loaded properly
      if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
        supabase = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        
        // Verify the client was created successfully
        if (supabase && typeof supabase.from === 'function') {
          console.log("Successfully created new Supabase client");
          // Store it in the window for future use
          window.supabase = supabase;
          supabaseConnected = true;
        }
      }
    } catch (e) {
      console.error("Error creating new Supabase client:", e);
    }
  }
  
  // If still not connected, try one more approach with global scope
  if (!supabaseConnected) {
    console.log("Attempting last resort method to create Supabase client");
    try {
      // Try to create a client using the global object if it exists
      if (typeof window.supabase === 'object' && typeof window.supabase.createClient === 'function') {
        supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        supabaseConnected = true;
      } else if (typeof supabase === 'object' && typeof supabase.createClient === 'function') {
        supabase = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        supabaseConnected = true;
      }
    } catch (e) {
      console.error("Last resort method failed:", e);
    }
  }
  
  // NEW FALLBACK: Use window.supabaseApi if available
  if (!supabaseConnected && window.supabaseApi) {
    console.log("Using window.supabaseApi as fallback for supabase client");
    supabase = window.supabaseApi;
    supabaseConnected = true;
  }
  
  // Modified final check: allow a client with either a .from or .addScore method
  if (!supabaseConnected || !supabase || (typeof supabase.from !== 'function' && typeof supabase.addScore !== 'function')) {
    console.error("Supabase client still not initialized, cannot show form");
    alert("Unable to connect to leaderboard service. Please refresh the page and try again.");
    loop(); // Resume game loop if we can't show the form
    return;
  }
  
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
  
  // Re-enable the submit button
  submitButton.disabled = false;
  
  // We no longer need to restart the loop since we're not stopping it
  
  // Don't restart the game if the score was submitted successfully
  // This prevents the score from being reset to 0
  if (!scoreSubmitted) {
    console.log("Email form hidden without score submission, game continues");
  }
}

async function submitScore() {
  // DIRECT API APPROACH: Store the score values at the start of the function
  const initialFinalScore = finalScore;
  const initialScore = score;
  const initialKillStreak = killStreak;
  const initialLevel = level;
  
  console.log("Submitting score - finalScore:", initialFinalScore, "score:", initialScore);
  
  // Create a guaranteed non-zero score value
  let guaranteedScore = 0;
  
  // Try all possible sources in order of preference
  if (window.finalGameStats && window.finalGameStats.score > 0) {
    guaranteedScore = window.finalGameStats.score;
    console.log("Using score from window.finalGameStats:", guaranteedScore);
  } else if (initialFinalScore > 0) {
    guaranteedScore = initialFinalScore;
    console.log("Using initialFinalScore:", guaranteedScore);
  } else if (finalScore > 0) {
    guaranteedScore = finalScore;
    console.log("Using finalScore:", guaranteedScore);
  } else if (initialScore > 0) {
    guaranteedScore = initialScore;
    console.log("Using initialScore:", guaranteedScore);
  } else if (score > 0) {
    guaranteedScore = score;
    console.log("Using current score:", guaranteedScore);
  } else {
    // Absolute fallback - if somehow all scores are 0, use 1 as minimum
    guaranteedScore = 1;
    console.log("Using fallback minimum score:", guaranteedScore);
  }
  
  // Create a guaranteed enemies destroyed count
  let guaranteedKillStreak = 0;
  
  // Try all possible sources in order of preference
  if (window.finalGameStats && window.finalGameStats.killStreak > 0) {
    guaranteedKillStreak = window.finalGameStats.killStreak;
    console.log("Using killStreak from window.finalGameStats:", guaranteedKillStreak);
  } else if (initialKillStreak > 0) {
    guaranteedKillStreak = initialKillStreak;
    console.log("Using initialKillStreak:", guaranteedKillStreak);
  } else if (killStreak > 0) {
    guaranteedKillStreak = killStreak;
    console.log("Using current killStreak:", guaranteedKillStreak);
  } else if (guaranteedScore > 0) {
    // Last resort - estimate from score (assumes average 10 points per enemy)
    guaranteedKillStreak = Math.floor(guaranteedScore / 10);
    console.log("Estimated killStreak from score:", guaranteedKillStreak);
  }
  
  console.log("Guaranteed score:", guaranteedScore);
  console.log("Guaranteed kill count:", guaranteedKillStreak);
  
  const email = emailInput.value.trim();
  
  // Validate email
  if (!email || !isValidEmail(email)) {
    inputMessage.textContent = 'Please enter a valid email address';
    inputMessage.className = 'error';
    return;
  }
  
  // Always use our guaranteed score
  window.finalGameStats = {
    score: guaranteedScore,
    level: initialLevel > 0 ? initialLevel : level,
    killStreak: initialKillStreak > 0 ? initialKillStreak : killStreak
  };
  
  console.log("Final game stats:", window.finalGameStats);
  
  // We no longer need to pause/resume the game loop
  
  inputMessage.textContent = 'Submitting score...';
  inputMessage.className = '';
  submitButton.disabled = true;
  
  try {
    // CORS FIX: Try to submit via API with fallback to localStorage
    let result;
    
    try {
      // First try the API
      await window.supabaseApi.addScore(
        email,
        guaranteedScore,
        window.finalGameStats.level,
        guaranteedKillStreak
      );
      result = { success: true, isLocal: false };
    } catch (apiError) {
      console.error("API submission failed, trying localStorage fallback:", apiError);
      
      // If API fails, use localStorage fallback
      result = window.supabaseApi.fallbackToLocalStorage(
        email,
        guaranteedScore,
        window.finalGameStats.level,
        guaranteedKillStreak
      );
      
      if (!result.success) {
        throw new Error("Both API and localStorage submission failed");
      }
    }
    
    // Score was submitted successfully
    scoreSubmitted = true;
    
    if (result.isLocal) {
      // Replace "saved locally" message with a more neutral success message
      inputMessage.textContent = `Score ${guaranteedScore} submitted successfully!`;
    } else {
      inputMessage.textContent = `Score ${guaranteedScore} submitted successfully!`;
    }
    
    inputMessage.className = 'success';
    shareButton.style.display = 'inline-block';
    
    // Create a "View Leaderboard" button if it doesn't exist
    if (!document.getElementById('view-leaderboard-after-submit')) {
      const viewLeaderboardButton = document.createElement('button');
      viewLeaderboardButton.id = 'view-leaderboard-after-submit';
      viewLeaderboardButton.textContent = 'View Leaderboard';
      viewLeaderboardButton.onclick = function() {
        hideEmailForm();
        // Save the current score and game state before switching to leaderboard
        const currentScore = score;
        const currentFinalScore = finalScore;
        const currentGameState = gameState;
        const currentLives = lives;
        
        // Switch to leaderboard view
        fetchLeaderboard();
        gameState = "leaderboard";
        
        // Preserve the existing score and game state
        score = currentScore;
        finalScore = currentFinalScore;
        lives = currentLives;
        
        // Create a button to return to game over screen
        const backToGameButton = document.createElement('button');
        backToGameButton.id = 'back-to-game-button';
        backToGameButton.textContent = 'Back to Game';
        backToGameButton.style.position = 'absolute';
        backToGameButton.style.top = '10px';
        backToGameButton.style.left = '10px';
        backToGameButton.style.zIndex = '1000';
        backToGameButton.onclick = function() {
          document.body.removeChild(backToGameButton);
          gameState = currentGameState;
        };
        document.body.appendChild(backToGameButton);
      };
      
      // Insert after share button
      shareButton.parentNode.insertBefore(viewLeaderboardButton, shareButton.nextSibling);
    }
  } catch (error) {
    console.error("Error submitting score:", error);
    inputMessage.textContent = `Error: ${error.message}`;
    inputMessage.className = 'error';
    submitButton.disabled = false;
  }
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Function to fetch all leaderboard entries and clean up duplicates
async function fetchAndCleanupLeaderboard() {
  console.log("Starting leaderboard cleanup process");
  
  try {
    // Get a fresh Supabase connection
    if (window.initSupabase && typeof window.initSupabase === 'function') {
      window.initSupabase();
      supabase = window.supabase;
    }
    
    if (!supabase || typeof supabase.from !== 'function') {
      console.error("No valid Supabase connection for cleanup");
      return;
    }
    
    // Fetch all entries (no limit)
    const { data: allEntries, error } = await supabase
      .from('leaderboard')
      .select('*');
      
    if (error) {
      console.error("Error fetching entries for cleanup:", error);
      return;
    }
    
    if (!allEntries || allEntries.length === 0) {
      console.log("No entries found, nothing to clean up");
      return;
    }
    
    console.log(`Found ${allEntries.length} total entries in leaderboard`);
    
    // If we have entries, clean up duplicates
    await cleanupDuplicateEntries(allEntries);
    
  } catch (error) {
    console.error("Error in fetchAndCleanupLeaderboard:", error);
  }
}

// Function to clean up duplicate entries in the database
async function cleanupDuplicateEntries(allEntries) {
  console.log("Cleaning up duplicate entries in database");
  
  try {
    // Group entries by email
    const entriesByEmail = {};
    
    for (const entry of allEntries) {
      const email = entry.player_email;
      if (!entriesByEmail[email]) {
        entriesByEmail[email] = [];
      }
      entriesByEmail[email].push(entry);
    }
    
    // For each email with multiple entries, keep only the highest score
    for (const email in entriesByEmail) {
      const entries = entriesByEmail[email];
      
      if (entries.length > 1) {
        console.log(`Found ${entries.length} entries for email ${email}`);
        
        // Sort by score (highest first)
        entries.sort((a, b) => b.score - a.score);
        
        // Keep the highest score, delete the rest
        for (let i = 1; i < entries.length; i++) {
          console.log(`Deleting duplicate entry id ${entries[i].id} with score ${entries[i].score}`);
          
          const { error } = await supabase
            .from('leaderboard')
            .delete()
            .eq('id', entries[i].id);
            
          if (error) {
            console.error(`Error deleting duplicate entry: ${error.message}`);
          }
        }
      }
    }
    
    console.log("Finished cleaning up duplicate entries");
  } catch (error) {
    console.error("Error in cleanupDuplicateEntries:", error);
  }
}

function shareToX() {
  // Use finalScore instead of score to ensure correct value is shared
  const text = `I scored ${finalScore} points and reached level ${level} in AI SPACE DEFENDER! Can you beat my score?`;
  const url = window.location.href;
  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  
  // Open Twitter share dialog
  window.open(shareUrl, '_blank', 'width=550,height=420');
}