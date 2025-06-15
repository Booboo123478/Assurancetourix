const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 3000;

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });
const filePath = './data/posts.json';

// Publier un message (sans auteur pour l'instant)
app.post('/posts', upload.single('media'), (req, res) => {
  const { content } = req.body;
  const media = req.file ? `/uploads/${req.file.filename}` : null;

  if (!content) {
    return res.status(400).send("Le contenu est requis.");
  }

  const newPost = {
    content,
    media,
    date: new Date().toISOString()
  };

  let posts = [];
  if (fs.existsSync(filePath)) {
    posts = JSON.parse(fs.readFileSync(filePath));
  }

  posts.push(newPost);
  fs.writeFileSync(filePath, JSON.stringify(posts, null, 2));

  res.redirect('/');
});

// Renvoyer tous les messages
app.get('/posts', (req, res) => {
  let posts = [];
  if (fs.existsSync(filePath)) {
    posts = JSON.parse(fs.readFileSync(filePath));
  }
  res.json(posts);
});

// Autoriser l’accès au dossier des fichiers uploadés
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Lancer le serveur
app.listen(PORT, () => {
  console.log(`Serveur actif sur http://localhost:${PORT}`);
});
