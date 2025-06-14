const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const app = express();
const bcrypt = require('bcrypt');

// Configuration pour servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

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
app.post('/register', (req, res) => {
  console.log('Données d\'inscription:', req.body);
  res.json({ message: 'Inscription reçue!', data: req.body });
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