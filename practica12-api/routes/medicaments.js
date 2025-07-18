const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Database = require('../database/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Configuración de almacenamiento con multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/medicaments');
    // Crear directorio si no existe
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generar nombre único: timestamp + userId + extensión original
    const uniqueName = `${Date.now()}_${req.user.id}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

// Filtro para validar tipos de archivo
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes (JPEG, PNG, GIF, WebP)'), false);
  }
};

// Configuración de multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB máximo
  }
});

// GET /api/medicaments - Obtener todos los medicamentos del usuario
router.get('/', authMiddleware, async (req, res) => {
  try {
    // 🔍 DEBUG: Verificar req.user
    console.log('🔍 req.user en medicaments:', req.user);
    console.log('🔍 req.user.id:', req.user ? req.user.id : 'UNDEFINED');
    
    if (!req.user || !req.user.id) {
      console.log('❌ req.user o req.user.id es undefined');
      return res.status(401).json({
        error: 'Usuario no autenticado',
        message: 'No se pudo obtener información del usuario'
      });
    }
    
    const medicaments = await Database.getMedicamentsByUserId(req.user.id);
    console.log('✅ Medicamentos obtenidos:', medicaments.length);
    
    // ✅ CAMBIO: URL fija en lugar de req.get('host')
    const medicamentsWithImages = medicaments.map(med => ({
      ...med,
      image_url: med.image_url ? 
        (med.image_url.startsWith('http') ? 
          med.image_url : 
          `http://52.201.63.254/uploads/medicaments/${path.basename(med.image_url)}`
        ) : null
    }));
    
    res.json({
      success: true,
      medicaments: medicamentsWithImages
    });
  } catch (error) {
    console.error('❌ Error al obtener medicamentos:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al obtener medicamentos'
    });
  }
});

// GET /api/medicaments/:id - Obtener medicamento por ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const medicament = await Database.getMedicamentById(id, req.user.id);
    
    if (!medicament) {
      return res.status(404).json({
        error: 'Medicamento no encontrado',
        message: 'El medicamento no existe o no pertenece al usuario'
      });
    }
    
    // ✅ CAMBIO: URL fija en lugar de req.get('host')
    const medicamentWithImage = {
      ...medicament,
      image_url: medicament.image_url ? 
        (medicament.image_url.startsWith('http') ? 
          medicament.image_url : 
          `http://52.201.63.254/uploads/medicaments/${path.basename(medicament.image_url)}`
        ) : null
    };
    
    res.json({
      success: true,
      medicament: medicamentWithImage
    });
  } catch (error) {
    console.error('Error al obtener medicamento:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al obtener medicamento'
    });
  }
});

// POST /api/medicaments - Crear nuevo medicamento (con imagen opcional o URL)
router.post('/', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const { name, dose, time, image_url } = req.body;

    console.log('📝 Datos recibidos:', { name, dose, time, image_url });
    console.log('📁 Archivo recibido:', req.file ? req.file.filename : 'No hay archivo');

    // Validaciones
    if (!name || !dose || !time) {
      // Si hay archivo subido pero falla la validación, eliminar el archivo
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        error: 'Campos requeridos',
        message: 'Nombre, dosis y hora son obligatorios'
      });
    }

    // Determinar la URL de la imagen
    let finalImageUrl = null;
    let imagePathForDB = null;
    
    if (req.file) {
      // ✅ CAMBIO: URL fija en lugar de req.get('host')
      console.log('✅ Usando archivo subido:', req.file.filename);
      finalImageUrl = `http://52.201.63.254/uploads/medicaments/${req.file.filename}`;
      imagePathForDB = req.file.path;
    } else if (image_url && image_url.trim() !== '') {
      // Si se proporcionó una URL externa, usarla
      console.log('✅ Usando URL externa:', image_url);
      finalImageUrl = image_url;
      imagePathForDB = image_url;
    } else {
      console.log('ℹ️ No se proporcionó imagen');
    }

    const newMedicament = await Database.createMedicament({
      name,
      dose,
      time,
      image_url: imagePathForDB, // Guardar ruta local o URL externa
      user_id: req.user.id
    });

    // Preparar respuesta con URL completa
    const medicamentResponse = {
      ...newMedicament,
      image_url: finalImageUrl
    };

    console.log('🎉 Medicamento creado con imagen:', finalImageUrl);

    res.status(201).json({
      success: true,
      message: 'Medicamento creado exitosamente',
      medicament: medicamentResponse
    });

  } catch (error) {
    console.error('Error al crear medicamento:', error);
    
    // Si hay archivo subido y ocurre un error, eliminar el archivo
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al crear medicamento'
    });
  }
});

// PUT /api/medicaments/:id - Actualizar medicamento (con imagen opcional o URL)
router.put('/:id', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, dose, time, image_url } = req.body;

    if (!name && !dose && !time && !req.file && !image_url) {
      return res.status(400).json({
        error: 'Datos requeridos',
        message: 'Debe proporcionar al menos un campo para actualizar'
      });
    }

    const existingMedicament = await Database.getMedicamentById(id, req.user.id);
    if (!existingMedicament) {
      // Si hay archivo subido pero el medicamento no existe, eliminar el archivo
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({
        error: 'Medicamento no encontrado',
        message: 'El medicamento no existe o no pertenece al usuario'
      });
    }

    // Determinar la nueva imagen
    let newImageUrl = existingMedicament.image_url;
    let finalImageUrl = null;
    
    if (req.file) {
      // Si se sube nueva imagen de archivo, eliminar la anterior (solo si es archivo local)
      if (existingMedicament.image_url && !existingMedicament.image_url.startsWith('http') && fs.existsSync(existingMedicament.image_url)) {
        fs.unlinkSync(existingMedicament.image_url);
      }
      newImageUrl = req.file.path;
      // ✅ CAMBIO: URL fija en lugar de req.get('host')
      finalImageUrl = `http://52.201.63.254/uploads/medicaments/${req.file.filename}`;
    } else if (image_url && image_url.trim() !== '') {
      // Si se proporciona URL externa, eliminar imagen anterior (solo si es archivo local)
      if (existingMedicament.image_url && !existingMedicament.image_url.startsWith('http') && fs.existsSync(existingMedicament.image_url)) {
        fs.unlinkSync(existingMedicament.image_url);
      }
      newImageUrl = image_url;
      finalImageUrl = image_url;
    } else {
      // ✅ CAMBIO: URL fija en lugar de req.get('host')
      finalImageUrl = existingMedicament.image_url ? 
        (existingMedicament.image_url.startsWith('http') ? 
          existingMedicament.image_url : 
          `http://52.201.63.254/uploads/medicaments/${path.basename(existingMedicament.image_url)}`
        ) : null;
    }

    const updatedMedicament = await Database.updateMedicament(id, {
      name: name || existingMedicament.name,
      dose: dose || existingMedicament.dose,
      time: time || existingMedicament.time,
      image_url: newImageUrl
    });

    // Preparar respuesta con URL completa
    const medicamentResponse = {
      ...updatedMedicament,
      image_url: finalImageUrl
    };

    res.json({
      success: true,
      message: 'Medicamento actualizado exitosamente',
      medicament: medicamentResponse
    });

  } catch (error) {
    console.error('Error al actualizar medicamento:', error);
    
    // Si hay archivo subido y ocurre un error, eliminar el archivo
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al actualizar medicamento'
    });
  }
});

// DELETE /api/medicaments/:id - Eliminar medicamento
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const existingMedicament = await Database.getMedicamentById(id, req.user.id);
    if (!existingMedicament) {
      return res.status(404).json({
        error: 'Medicamento no encontrado',
        message: 'El medicamento no existe o no pertenece al usuario'
      });
    }

    // Eliminar imagen asociada si existe y es archivo local (no URL externa)
    if (existingMedicament.image_url && !existingMedicament.image_url.startsWith('http') && fs.existsSync(existingMedicament.image_url)) {
      fs.unlinkSync(existingMedicament.image_url);
    }

    const deleted = await Database.deleteMedicament(id);
    
    if (deleted) {
      res.json({
        success: true,
        message: 'Medicamento eliminado exitosamente'
      });
    } else {
      res.status(500).json({
        error: 'Error al eliminar',
        message: 'No se pudo eliminar el medicamento'
      });
    }

  } catch (error) {
    console.error('Error al eliminar medicamento:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al eliminar medicamento'
    });
  }
});

// Middleware para manejar errores de multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'Archivo demasiado grande',
        message: 'El archivo no puede ser mayor a 5MB'
      });
    }
    return res.status(400).json({
      error: 'Error de carga',
      message: error.message
    });
  }
  
  if (error.message.includes('Tipo de archivo no permitido')) {
    return res.status(400).json({
      error: 'Tipo de archivo no válido',
      message: 'Solo se permiten imágenes (JPEG, PNG, GIF, WebP)'
    });
  }
  
  next(error);
});

module.exports = router;