# AI SPACE DEFENDER

A space shooter game where you defend Earth from an AI invasion. Features include multiple enemy types, power-ups, boss battles, and an online leaderboard.

## Game Features

- **Multiple Enemy Types**: Basic ships, hunter ships that track you, and boss ships that appear every 5 levels
- **Power-Up System**: Collect power-ups for weapon upgrades, shields, extra lives, rapid fire, and triple shot
- **Visual Effects**: Particle explosions, bullet trails, twinkling stars, and a gradient space background
- **Scoring System**: Points based on enemy type with combo multipliers for consecutive kills
- **Online Leaderboard**: Submit your scores to a global leaderboard using Supabase

## Setup Instructions

### Prerequisites

- A modern web browser (Chrome, Firefox, Edge, etc.)
- [Supabase](https://supabase.com/) account (free tier works fine)
- Basic knowledge of SQL and web development

### Setting Up Supabase

1. **Create a Supabase Project**:
   - Sign up or log in at [supabase.com](https://supabase.com/)
   - Create a new project and note your project URL and anon/public key

2. **Create the Leaderboard Table**:
   - Go to the SQL Editor in your Supabase dashboard
   - Run the following SQL to create the leaderboard table:

```sql
CREATE TABLE leaderboard (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_email TEXT NOT NULL,
  score INTEGER NOT NULL,
  level_reached INTEGER NOT NULL,
  enemies_destroyed INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index for faster sorting by score
CREATE INDEX idx_leaderboard_score ON leaderboard(score DESC);

-- Set up Row Level Security (RLS)
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

-- Create policies for secure access
CREATE POLICY "Allow anonymous read access" 
  ON leaderboard FOR SELECT 
  USING (true);

CREATE POLICY "Allow anonymous insert access" 
  ON leaderboard FOR INSERT 
  WITH CHECK (true);
```

3. **Set Up Email Validation (Optional)**:
   - If you want to validate email addresses, you can add a trigger:

```sql
CREATE OR REPLACE FUNCTION validate_email()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.player_email !~ '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_email_trigger
BEFORE INSERT ON leaderboard
FOR EACH ROW
EXECUTE FUNCTION validate_email();
```

### Configuring the Game

1. **Update Supabase Configuration**:
   - Open `supabase-config.js` in the game folder
   - Replace the placeholder values with your actual Supabase project URL and anon key:

```javascript
const SUPABASE_URL = 'https://your-actual-project-url.supabase.co';
const SUPABASE_KEY = 'your-actual-anon-key';
```

2. **Verify the HTML File**:
   - Make sure your `index.html` file includes the module script that imports the Supabase configuration:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI SPACE DEFENDER</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.0/p5.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.0/addons/p5.sound.min.js"></script>
  <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
  <style>
    body {
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background-color: #000;
      color: #fff;
      font-family: Arial, sans-serif;
    }
    canvas {
      display: block;
    }
    #email-input {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: rgba(0, 0, 0, 0.8);
      padding: 20px;
      border-radius: 10px;
      border: 2px solid #0066ff;
      display: none;
      width: 300px;
      text-align: center;
    }
    input, button {
      margin: 10px 0;
      padding: 8px;
      width: 100%;
    }
    button {
      background-color: #0066ff;
      color: white;
      border: none;
      cursor: pointer;
      border-radius: 5px;
    }
    button:hover {
      background-color: #0055cc;
    }
    .error {
      color: #ff3333;
    }
    .success {
      color: #33cc33;
    }
  </style>
</head>
<body>
  <div id="email-input">
    <h3>Submit Your Score</h3>
    <input type="email" id="player-email" placeholder="Enter your email">
    <p id="input-message"></p>
    <button id="submit-score">Submit</button>
    <button id="cancel-submit">Cancel</button>
    <button id="share-button" style="display: none;">Share on Twitter</button>
  </div>
  <script type="module">
    // Import Supabase configuration
    import { SUPABASE_URL, SUPABASE_KEY } from './supabase-config.js';
    
    // Make configuration available to the sketch.js file
    window.SUPABASE_URL = SUPABASE_URL;
    window.SUPABASE_KEY = SUPABASE_KEY;
    window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  </script>
  <script src="sketch.js"></script>
</body>
</html>
```

3. **Verify the Game Code**:
   - Your `sketch.js` file should already have the following code for Supabase initialization:

```javascript
// Supabase variables
let supabase;

// In the setup function:
try {
  supabase = window.supabase;
  console.log("Supabase client initialized");
} catch (e) {
  console.error("Error initializing Supabase client:", e);
}
```

### Running the Game

1. **Local Development Server**:
   - Due to browser security restrictions, you need to run the game on a local server
   - You can use any of these methods:

   **Using Python (simplest):**
   ```bash
   # If you have Python installed:
   # For Python 3.x
   python -m http.server
   # For Python 2.x
   python -m SimpleHTTPServer
   ```

   **Using Node.js:**
   ```bash
   # Install http-server globally if you haven't already
   npm install -g http-server
   # Run the server
   http-server
   ```

2. **Access the Game**:
   - Open your browser and navigate to:
     - `http://localhost:8000` (for Python or http-server)
   - The game should load and connect to your Supabase backend

## Game Controls

- **Arrow Keys**: Move your ship
- **Spacebar**: Shoot
- **P**: Toggle penalty for escaped enemies
- **R**: Restart game (when game over)
- **ESC**: Return to menu (from leaderboard)

## Troubleshooting

- **Supabase Connection Issues**:
  - Check that your Supabase URL and anon key are correct
  - Ensure your browser allows JavaScript from your local server
  - Check the browser console for specific error messages

- **Game Performance**:
  - If the game runs slowly, try closing other applications
  - Reduce the number of stars or particles in the code for better performance

## Credits

- Created with [p5.js](https://p5js.org/)
- Backend powered by [Supabase](https://supabase.com/)

## License

This project is open source and available under the MIT License. 