const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const port = process.env.PORT || 4000;
const path = require('path');
const fileUpload = require('express-fileupload'); // Importar express-fileupload

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let users = [];
const userNames = {};
let userProfiles = {}; // Para almacenar perfiles de usuario

// Configurar express-fileupload
app.use(fileUpload());

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));
app.use('/img', express.static(path.join(__dirname, 'public', 'img')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Endpoint para subir imágenes de perfil
app.post('/upload-profile', (req, res) => {
  if (!req.files || !req.files.profileImage) {
    return res.status(400).json({ error: 'No se subió ninguna imagen' });
  }

  const profileImage = req.files.profileImage;
  const uploadPath = path.join(__dirname, 'public', 'img', `${Date.now()}-${profileImage.name}`);
  
  profileImage.mv(uploadPath, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Error al subir la imagen' });
    }
    res.json({ imageUrl: `/img/${path.basename(uploadPath)}` });
  });
});

// Endpoint para subir archivos en el chat
app.post('/upload-file', (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(400).json({ error: 'No se subió ningún archivo' });
  }

  const file = req.files.file;
  const uploadPath = path.join(__dirname, 'public', 'uploads', `${Date.now()}-${file.name}`);

  file.mv(uploadPath, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Error al subir el archivo' });
    }
    res.json({ fileUrl: `/uploads/${path.basename(uploadPath)}`, fileType: file.mimetype });
  });
});

// Ruta principal para la página de inicio
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Configuración del socket
io.on('connection', (socket) => {
  console.log('Un usuario se conectó con ID:', socket.id);

  socket.on('setUserName', (data) => {
    userNames[socket.id] = data.userName;
    userProfiles[socket.id] = data.profile;
    io.emit('update users', Object.keys(userNames).map(id => ({
      id,
      name: userNames[id],
      profile: userProfiles[id]
    })));

    // Notificar a todos que un usuario se conectó
    io.emit('chat message', {
      userName: 'Sistema',
      profile: 'system',
      message: `${data.userName} se ha unido al chat`,
      type: 'notification'
    });
  });

  socket.on('chat message', (data) => {
    io.emit('chat message', data);
  });

  socket.on('file shared', (data) => {
    io.emit('file shared', data); // Envía el archivo a todos los clientes
  });

  socket.on('typing', (data) => {
    socket.broadcast.emit('typing', data);
    setTimeout(() => {
      socket.broadcast.emit('stop typing', data);
    }, 3000); // Se oculta después de 3 segundos
  });

  socket.on('disconnect', () => {
    const userName = userNames[socket.id] || 'Anónimo';
    const profile = userProfiles[socket.id] || 'system';
    delete userNames[socket.id];
    delete userProfiles[socket.id];
    io.emit('update users', Object.keys(userNames).map(id => ({
      id,
      name: userNames[id],
      profile: userProfiles[id]
    })));

    // Notificar a todos que un usuario se desconectó
    io.emit('chat message', {
      userName: 'Sistema',
      profile: 'system',
      message: `${userName} se ha desconectado`,
      type: 'notification'
    });
  });
});

server.listen(port, () => {
  console.log(`Servidor iniciado en http://localhost:${port}`);
});
