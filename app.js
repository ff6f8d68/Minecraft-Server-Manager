const express = require('express');
const multer = require('multer');
const passport = require('passport');
const session = require('express-session');
const GitHubStrategy = require('passport-github2').Strategy;
const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// Set up the session middleware
app.use(session({ secret: 'minecraft-secret', resave: false, saveUninitialized: true }));

// Set up Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Set up body parser
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Set up the file upload middleware
const upload = multer({ dest: 'uploads/' });

// GitHub OAuth strategy
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,       // Read from .env file
    clientSecret: process.env.GITHUB_CLIENT_SECRET,  // Read from .env file
    callbackURL: "http://localhost:3000/auth/github/callback"  // Set callback URL
  },
  function(accessToken, refreshToken, profile, done) {
    return done(null, { profile, accessToken });  // Save profile and accessToken in session
  }
));

// Serialization of user to session
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// GitHub Authentication Routes
app.get('/auth/github', passport.authenticate('github', { scope: ['user', 'repo'] }));

app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/' }), (req, res) => {
  // Redirect to dashboard on successful login
  res.redirect('/dashboard');
});

// Middleware to protect routes
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/');
}

// Dashboard for authenticated users
app.get('/dashboard', ensureAuthenticated, (req, res) => {
  res.send(`
    <h1>Welcome ${req.user.profile.username}</h1>
    <form action="/upload-files" method="POST" enctype="multipart/form-data">
      <input type="file" name="serverFile" />
      <button type="submit">Upload Server Files</button>
    </form>
    <form action="/set-start-command" method="POST">
      <input type="text" name="startCommand" placeholder="Enter start command" />
      <button type="submit">Set Start Command</button>
    </form>
    <button onclick="startServer()">Start Server</button>

    <script>
      function startServer() {
        fetch('/start-server', { method: 'POST' })
          .then(response => response.json())
          .then(data => alert('Server started!'))
          .catch(err => console.error(err));
      }
    </script>
  `);
});

// Upload Minecraft server files
app.post('/upload-files', ensureAuthenticated, upload.single('serverFile'), (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).send('No file uploaded.');
  }
  const filePath = path.join(__dirname, 'uploads', file.filename);
  // Handle file upload logic (e.g., transfer to Codespace)
  res.send('File uploaded successfully.');
});

// Set the start command for Minecraft server
let startCommand = '';

app.post('/set-start-command', ensureAuthenticated, (req, res) => {
  startCommand = req.body.startCommand;
  if (!startCommand) {
    return res.status(400).send('No command provided.');
  }
  res.send('Start command set successfully.');
});

// Start the Minecraft server in Codespace
app.post('/start-server', ensureAuthenticated, async (req, res) => {
  const { accessToken } = req.user;

  if (!startCommand) {
    return res.status(400).send('Start command not set.');
  }

  try {
    // Use GitHub API to create a Codespace or run a command in an existing one
    const response = await axios.post('https://api.github.com/user/codespaces', {
      repository_id: 'your-repo-id',
      devcontainer_path: '.devcontainer.json'
    }, {
      headers: { Authorization: `token ${accessToken}` }
    });

    const codespaceUrl = response.data.web_url;
    
    // Assume we can now SSH into the Codespace and run the startCommand
    res.json({ message: 'Server started!', codespaceUrl });
  } catch (error) {
    console.error(error);
    res.status(500).send('Failed to start server.');
  }
});

// Start page
app.get('/', (req, res) => {
  res.send(`
    <h1>Welcome to Minecraft Server Manager</h1>
    <a href="/auth/github">Sign in with GitHub</a>
  `);
});

// Start the server
app.listen(3000, () => {
  console.log('App listening on http://localhost:3000');
});
