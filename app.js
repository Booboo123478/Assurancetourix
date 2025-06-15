const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const fs = require('fs');
const session = require('express-session');

const app = express();



// Schéma utilisateur
const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  telephone: { type: String, default: '' },
  ville: { type: String, default: '' },
  handicap: { type: String, default: '' },
  communities: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now }
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration de la session (à mettre ici, au début, avant tes routes)
app.use(session({
  secret: 'une clé secrète',    // à changer par une vraie clé secrète
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }     // mettre true si HTTPS
}));

app.use((req, res, next) => {
  if (req.session.userId) {
    req.user = { id: req.session.userId };
  }
  next();
});

// Configuration des fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Route pour vérifier que le CSS est accessible (utile en dev)
app.get('/check-css', (req, res) => {
  const cssPath = path.join(__dirname, 'public', 'css', 'style.css');
  res.send(`Le fichier CSS existe: ${fs.existsSync(cssPath)}`);
});

// Connexion à MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/assurancetourix', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connecté à MongoDB'))
.catch(err => console.error('Erreur MongoDB:', err));

// Routes pour les pages statiques
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/profil', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'profil.html'));
});

app.get('/communaute', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'communaute.html'));
});

// Route d'inscription
app.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;

    if (!email || !password || !confirmPassword) {
      return res.status(400).json({ error: "Email et mots de passe requis" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Les mots de passe ne correspondent pas" });
    }

    // Vérifier si utilisateur existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "Un utilisateur avec cet email existe déjà" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ firstName, lastName, email, password: hashedPassword });
    await user.save();

    res.json({ success: true, message: "Inscription réussie !" });
  } catch (error) {
    console.error("Erreur inscription:", error);
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
    req.session.userId = user._id; 
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

app.post('/api/profil', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Non authentifié" });
  }

  // try {
  //   const updateData = {
  //     firstName: req.body.firstName,
  //     lastName: req.body.lastName,
  //     ville: req.body.ville,
  //     telephone: req.body.telephone,
  //     handicap: req.body.handicap,
  //     communities: req.body.communities || []
  //   };

  //   if (password && password.length > 0) {
  //     const hashed = await bcrypt.hash(password, 10);
  //     user.password = hashed;
  //   }

    // // Met à jour l'utilisateur dans MongoDB
    // await User.findByIdAndUpdate(req.user.id, updateData);
  try {
    const { firstName, lastName, ville, telephone, handicap, communities, password } = req.body;

    // Récupère l'utilisateur
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

    // Mets à jour les champs simples
    user.firstName = firstName;
    user.lastName = lastName;
    user.ville = ville;
    user.telephone = telephone;
    user.handicap = handicap;
    user.communities = communities || [];

    // Mets à jour le mot de passe si besoin
    if (password && password.length > 0) {
      const hashed = await bcrypt.hash(password, 10);
      user.password = hashed;
    }

    // Sauvegarde l'utilisateur
    await user.save();
    res.json({ success: true, message: "Profil mis à jour" });
  } catch (err) {
    console.error("Erreur mise à jour profil:", err);
    res.status(500).json({ error: "Erreur lors de la mise à jour" });
  }
});

app.get('/api/profil', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Non authentifié" });
  }

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

  res.json({
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    ville: user.ville,
    telephone: user.telephone,
    handicap: user.handicap,
    communities: user.communities || []
  });
});

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send("Erreur déconnexion");
    }
    res.clearCookie('connect.sid'); // nom de cookie par défaut express-session
    res.send("Déconnecté");
  });
});

// Démarrage du serveur
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
