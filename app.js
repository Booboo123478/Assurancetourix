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

// Configuration de la session
app.use(session({
  secret: 'une clé secrète',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }   
}));

app.use((req, res, next) => {
  if (req.session.userId) {
    req.user = { id: req.session.userId };
  }
  next();
});

// Configuration des fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Route pour vérifier que le CSS est accessible
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

// Routes pour les pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/profil', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'profil.html'));
});

app.get('/forum', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'forum.html'));
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

// Route de connexion
app.post('/login', async (req, res) => {
  try {
    console.log('Tentative de connexion:', req.body);
    
    // Vérification des champs requis
    if (!req.body.email || !req.body.password) {
      return res.status(400).json({ 
        success: false,
        error: 'Email et mot de passe requis' 
      });
    }

    // Vérification dans MongoDB
    const user = await User.findOne({ email: req.body.email });
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        error: 'Email incorrect' 
      });
    }

    // Comparaison des mots de passe
    const isMatch = await bcrypt.compare(req.body.password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({ 
        success: false,
        error: 'Mot de passe incorrect' 
      });
    }

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

// Route Post du profil
app.post('/api/profil', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Non authentifié" });
  }
  try {
    const { firstName, lastName, ville, telephone, handicap, communities, password } = req.body;

    // Récupération de l'utilisateur
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

    // Maj des champs
    user.firstName = firstName;
    user.lastName = lastName;
    user.ville = ville;
    user.telephone = telephone;
    user.handicap = handicap;
    user.communities = communities || [];

    // Maj du mdp
    if (password && password.length > 0) {
      const hashed = await bcrypt.hash(password, 10);
      user.password = hashed;
    }

    // Sauvegarde de l'utilisateur
    await user.save();
    res.json({ success: true, message: "Profil mis à jour" });
  } catch (err) {
    console.error("Erreur mise à jour profil:", err);
    res.status(500).json({ error: "Erreur lors de la mise à jour" });
  }
});

// Route Get du profil
app.get('/api/profil', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Non authentifié" });
  }

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

  // Récupération des infos de l'utilisateur
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

// Route de déconnexion
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send("Erreur déconnexion");
    }
    res.clearCookie('connect.sid');
    res.send("Déconnecté");
  });
});

// Route pour récupérer les infos de l'utilisateur connecté
app.get('/api/me', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Utilisateur non connecté' });
  }
  
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non connecté' });
    }

    res.json({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email
    });
  } catch (err) {
    console.error('Erreur récupération utilisateur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route de debug pour récupérer les infos de l'utilisateur dans MongoDB
// URL = http://localhost:3000/api/debug/users
app.get('/api/debug/users', async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route de debug pour récupérer les infos des messages dans MongoDB
// URL = http://localhost:3000/api/debug/messages
app.get('/api/debug/messages', async (req, res) => {
  try {
    const messages = await Message.find({})
      .sort({ createdAt: -1 }) 
      .limit(20);               
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modèle des messages
const Message = mongoose.model('Message', {
  communaute: String,
  auteur: String,
  texte: String,
  date: { type: Date, default: Date.now },
  reactions: {
    type: Map,
    of: Number,
    default: () => new Map()
  },
  replies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  mediaUrl: String
});

// Récupérer les Communautés de l'utilisateur
app.get('/api/communities', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: "Non authentifié" });

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

    res.json({ communities: user.communities || [] });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Récupération des messages parents et enfants
app.get('/api/forums/:communaute/messages', async (req, res) => {
  try {
    const messages = await Message.find({ communaute: req.params.communaute, parent: null })
      .sort({ date: -1 })
      .limit(50)
      .lean();

    for (const msg of messages) {
      msg.replies = await Message.find({ parent: msg._id }).sort({ date: 1 }).lean();
    }

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Erreur de récupération des messages' });
  }
});


// Poster un message dans une communauté
app.post('/api/forums/:communaute/messages', express.json(), async (req, res) => {
  try {
    const { auteur, texte } = req.body;
    if (!texte || !auteur) return res.status(400).json({ error: 'Texte et auteur requis' });

    const message = new Message({
      communaute: req.params.communaute,
      auteur,
      texte
    });
    await message.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de l\'envoi du message' });
  }
});

// Réaction à un message
app.post('/api/messages/:id/react', express.json(), async (req, res) => {
  const messageId = req.params.id;
  const { reaction } = req.body;

  if (!reaction) {
    return res.status(400).json({ error: "Type de réaction manquant." });
  }

  try {
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message introuvable." });
    }

    if (!message.reactions) {
      message.reactions = new Map();
    }

    const currentCount = message.reactions.get(reaction) || 0;
    message.reactions.set(reaction, currentCount + 1);

    await message.save();

    const reactionsObj = {};
    for (const [key, value] of message.reactions.entries()) {
      reactionsObj[key] = value;
    }

    res.status(200).json({ success: true, reactions: reactionsObj });

  } catch (err) {
    console.error("Erreur lors de la réaction :", err);
    res.status(500).json({ error: "Erreur serveur lors de la réaction." });
  }
});


// Reponse à un message
app.post('/api/messages/:id/reply', express.json(), async (req, res) => {
  const { auteur, texte } = req.body;
  const parentId = req.params.id;

  if (!auteur || !texte) {
    return res.status(400).json({ error: "Auteur ou texte manquant." });
  }

  try {
    const parentMessage = await Message.findById(parentId);
    if (!parentMessage) {
      return res.status(404).json({ error: "Message parent introuvable." });
    }
    const reply = new Message({
      auteur,
      texte,
      date: new Date(),
      communaute: parentMessage.communaute,
      parent: parentId 
    });

    await reply.save();
    res.status(201).json({ success: true, reply });

  } catch (err) {
    console.error("Erreur lors de la création de la réponse :", err);
    res.status(500).json({ error: "Erreur serveur lors de l'envoi de la réponse." });
  }
});

// Contenue Multimédia
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
app.post('/api/forums/:communaute/messages-with-media', upload.single('media'), async (req, res) => {
  const { auteur, texte } = req.body;
  const file = req.file;

  try {
    const mediaUrl = file ? `/uploads/${file.filename}` : null;

    const message = new Message({
      communaute: req.params.communaute,
      auteur,
      texte,
      mediaUrl
    });

    await message.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur envoi avec média' });
  }
});

// Chemin d'upload du contenu multimedia
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Démarrage du serveur
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
