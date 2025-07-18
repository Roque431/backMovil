const express = require('express');
const cors = require('cors');
const path = require('path'); // 🆕 NUEVA LÍNEA para servir archivos estáticos
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const medicamentRoutes = require('./routes/medicaments');

const Database = require('./database/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // 🆕 NUEVA LÍNEA para form-data

// 🆕 NUEVA LÍNEA: Servir archivos estáticos (imágenes subidas)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/medicaments', medicamentRoutes);

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({
    message: 'API funcionando correctamente!',
    database: 'MySQL',
    timestamp: new Date().toISOString(),
    uploads: 'Habilitado' // 🆕 NUEVA LÍNEA
  });
});

// Manejo de errores 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint no encontrado',
    path: req.originalUrl
  });
});

// Manejo global de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: err.message
  });
});

// Inicializar servidor
async function startServer() {
  try {
    // Verificar conexión y crear tablas
    await Database.initTables();
    
    // 🆕 NUEVA LÍNEA: Crear carpeta de uploads si no existe
    const fs = require('fs');
    const uploadsDir = path.join(__dirname, 'uploads', 'medicaments');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('📁 Carpeta uploads/medicaments creada');
    }
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
      console.log(`🗄️ Base de datos: MySQL`);
      console.log(`📁 Archivos estáticos: http://localhost:${PORT}/uploads`); // 🆕 NUEVA LÍNEA
      console.log(`📋 Endpoints disponibles:`);
      console.log(`   POST http://localhost:${PORT}/api/auth/login`);
      console.log(`   POST http://localhost:${PORT}/api/auth/register`);
      console.log(`   GET  http://localhost:${PORT}/api/users/profile`);
      console.log(`   GET  http://localhost:${PORT}/api/medicaments`);
      console.log(`   POST http://localhost:${PORT}/api/medicaments (con upload)`); // 🆕 MODIFICADA
      console.log(`   PUT  http://localhost:${PORT}/api/medicaments/:id (con upload)`); // 🆕 NUEVA LÍNEA
      console.log(`   DELETE http://localhost:${PORT}/api/medicaments/:id`); // 🆕 NUEVA LÍNEA
      console.log(`   GET  http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar servidor:', error);
    process.exit(1);
  }
}

// Manejar cierre graceful
process.on('SIGINT', async () => {
  console.log('\n🔄 Cerrando servidor...');
  await Database.closePool();
  process.exit(0);
});

// Iniciar aplicación
startServer();