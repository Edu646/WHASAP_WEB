const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const port = process.env.PORT || 4000;
const path = require('path');
const fileUpload = require('express-fileupload');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let users = [];
const userNames = {};
let userProfiles = {}; // Para almacenar perfiles de usuario
let userStatuses = {}; // Para almacenar estados de usuario

// Configurar express-fileupload con límites aumentados
app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // Aumentar a 50MB
    useTempFiles: true,
    tempFileDir: '/tmp/',
    debug: true // Habilitar debugging para identificar problemas
}));

// Configurar análisis de cuerpo de solicitud
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));
app.use('/img', express.static(path.join(__dirname, 'public', 'img')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Asegurar que los directorios de carga existan
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'public', 'uploads');
const imgDir = path.join(__dirname, 'public', 'img');

if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(imgDir)){
    fs.mkdirSync(imgDir, { recursive: true });
}

// Endpoint para subir imágenes de perfil
app.post('/upload-profile', (req, res) => {
  console.log('Solicitud de carga de perfil recibida', req.files);
  
  if (!req.files || !req.files.profileImage) {
    return res.status(400).json({ error: 'No se subió ninguna imagen' });
  }

  const profileImage = req.files.profileImage;
  const uploadPath = path.join(__dirname, 'public', 'img', `${Date.now()}-${profileImage.name}`);
  
  profileImage.mv(uploadPath, (err) => {
    if (err) {
      console.error('Error al mover el archivo:', err);
      return res.status(500).json({ error: 'Error al subir la imagen' });
    }
    res.json({ imageUrl: `/img/${path.basename(uploadPath)}` });
  });
});

// Endpoint para subir archivos en el chat
app.post('/upload-file', (req, res) => {
  console.log('Solicitud de carga de archivo recibida', req.files);
  
  if (!req.files || !req.files.file) {
    return res.status(400).json({ error: 'No se subió ningún archivo' });
  }

  const file = req.files.file;
  const uploadPath = path.join(__dirname, 'public', 'uploads', `${Date.now()}-${file.name}`);

  // Asegurarse de que el nombre del archivo sea seguro
  const sanitizedFileName = file.name.replace(/[^\w\s.-]/gi, '_');
  const finalUploadPath = path.join(__dirname, 'public', 'uploads', `${Date.now()}-${sanitizedFileName}`);

  file.mv(finalUploadPath, (err) => {
    if (err) {
      console.error('Error al mover el archivo:', err);
      return res.status(500).json({ error: 'Error al subir el archivo', details: err.message });
    }
    
    // Devolver la URL relativa y el tipo MIME
    const fileUrl = `/uploads/${path.basename(finalUploadPath)}`;
    console.log('Archivo subido correctamente:', fileUrl);
    
    res.json({ 
      fileUrl: fileUrl, 
      fileType: file.mimetype,
      fileName: sanitizedFileName,
      fileSize: file.size
    });
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
    console.log('Nuevo usuario:', data);
    
    userNames[socket.id] = data.userName;
    userProfiles[socket.id] = data.profile;
    
    // Asegurarse de que el estado siempre se guarde correctamente
    userStatuses[socket.id] = data.status || "hola";
    
    console.log('Estado del usuario configurado:', userStatuses[socket.id]);
    
    // Actualizar la lista de usuarios con nombres, perfiles y estados
    const updatedUsers = Object.keys(userNames).map(id => ({
      id,
      name: userNames[id],
      profile: userProfiles[id],
      status: userStatuses[id]
    }));
    
    console.log('Lista de usuarios actualizada:', updatedUsers);
    io.emit('update users', updatedUsers);

    // Notificar a todos que un usuario se conectó
    io.emit('chat message', {
      userName: 'Sistema',
      profile: 'system',
      message: `${data.userName} se ha unido al chat`,
      type: 'notification'
    });
  });

  socket.on('chat message', (data) => {
    console.log('Mensaje recibido:', data);
    io.emit('chat message', data);
  });

  socket.on('file shared', (data) => {
    console.log('Archivo compartido:', data);
    io.emit('file shared', data); // Envía el archivo a todos los clientes
  });

  socket.on('typing', (data) => {
    console.log('Usuario escribiendo:', data.userName);
    socket.broadcast.emit('typing', data);
  });

  socket.on('stop typing', (data) => {
    console.log('Usuario dejó de escribir:', data.userName);
    socket.broadcast.emit('stop typing', data);
  });

  socket.on('update status', (data) => {
    console.log('Actualización de estado recibida:', data);
    if (userNames[socket.id]) {
      userStatuses[socket.id] = data.status;
      
      // Emitir la lista actualizada de usuarios
      io.emit('update users', Object.keys(userNames).map(id => ({
        id,
        name: userNames[id],
        profile: userProfiles[id],
        status: userStatuses[id]
      })));
    }
  });

  socket.on('disconnect', () => {
    const userName = userNames[socket.id] || 'Anónimo';
    const profile = userProfiles[socket.id] || 'system';
    
    console.log('Usuario desconectado:', userName);
    
    // Eliminar usuario desconectado
    delete userNames[socket.id];
    delete userProfiles[socket.id];
    delete userStatuses[socket.id];
    
    // Actualizar la lista de usuarios
    io.emit('update users', Object.keys(userNames).map(id => ({
      id,
      name: userNames[id],
      profile: userProfiles[id],
      status: userStatuses[id]
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

// Manejo de errores globales
app.use((err, req, res, next) => {
  console.error('Error en la aplicación:', err);
  res.status(500).json({ error: 'Error interno del servidor', details: err.message });
});

server.listen(port, () => {
  console.log(`Servidor iniciado en http://localhost:${port}`);
});