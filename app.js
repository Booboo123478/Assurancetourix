// 1. Import des outils
const express = require('express');
const mongoose = require('mongoose');

// 2. Création de l'application
const app = express();

// 3. Connexion à la base de données
mongoose.connect('mongodb://localhost:27017/assurancetourix');

// 4. Définition du modèle utilisateur
const User = mongoose.model('User', {
  email: String,
  password: String
});

// 5. Gestion des inscriptions
app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  
  // Hachage du mot de passe
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Sauvegarde en base
  const user = new User({ email, password: hashedPassword });
  await user.save();
  
  res.send('Inscription réussie !');
});

// 6. Démarrer le serveur
app.listen(3000, () => {
  console.log('Serveur démarré sur http://localhost:3000');
});