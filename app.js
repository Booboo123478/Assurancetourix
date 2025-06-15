const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const app = express();
const bcrypt = require('bcrypt');
const fs = require('fs');
const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true },
  password: String,
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// Configuration des fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Route pour vérifier que le CSS est accessible
app.get('/check-css', (req, res) => {
  const cssPath = path.join(__dirname, 'public', 'css', 'style.css');
  res.send(`Le fichier CSS existe: ${fs.existsSync(cssPath)}`);
});


// Middleware pour parser les requêtes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connexion MongoDB (version simplifiée)
mongoose.connect('mongodb://127.0.0.1:27017/assurancetourix')
  .then(() => console.log('Connecté à MongoDB'))
  .catch(err => console.error('Erreur MongoDB:', err));

// Route pour servir index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Routes API
app.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Les mots de passe ne correspondent pas" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ firstName, lastName, email, password: hashedPassword });
    await user.save();

    res.json({ success: true, message: "Inscription réussie !" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur lors de l'inscription" });
  }
});

app.post('/login', async (req, res) => {
  try {
    console.log('Tentative de connexion:', req.body);
    
    // 1. Vérification des champs requis
    if (!req.body.email || !req.body.password) {
      return res.status(400).json({ 
        success: false,
        error: 'Email et mot de passe requis' 
      });
    }

    // 2. Vérification dans MongoDB (version réelle)
    const user = await User.findOne({ email: req.body.email });
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        error: 'Email incorrect' 
      });
    }

    // 3. Comparaison des mots de passe (avec bcrypt)
    const isMatch = await bcrypt.compare(req.body.password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({ 
        success: false,
        error: 'Mot de passe incorrect' 
      });
    }

    // 4. Réponse en cas de succès
    res.json({ 
      success: true,
      message: 'Connexion réussie !',
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Erreur connexion:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur serveur lors de la connexion' 
    });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});

app.get('/profil', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'profil.html'));
});

app.get('/communaute', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'communaute.html'));
});
