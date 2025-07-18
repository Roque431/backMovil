const express = require('express');
const authMiddleware = require('../middleware/auth');
const Database = require('../database/database');

const router = express.Router();

// GET /api/users/profile - Obtener perfil del usuario autenticado
router.get('/profile', authMiddleware, (req, res) => {
  try {
    // El middleware auth ya agregó req.user
    res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al obtener perfil de usuario'
    });
  }
});

// PUT /api/users/profile - Actualizar perfil del usuario
router.put('/profile', authMiddleware, (req, res) => {
  try {
    const { name, email } = req.body;
    
    // Validación básica
    if (!name && !email) {
      return res.status(400).json({
        error: 'Datos requeridos',
        message: 'Debe proporcionar al menos un campo para actualizar'
      });
    }

    // Preparar datos para actualizar
    const updateData = {};
    if (name) updateData.name = name;
    if (email) {
      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          error: 'Email inválido',
          message: 'Por favor proporciona un email válido'
        });
      }
      
      // Verificar que el email no esté en uso por otro usuario
      const existingUser = Database.getUserByEmail(email);
      if (existingUser && existingUser.id !== req.user.id) {
        return res.status(409).json({
          error: 'Email ya en uso',
          message: 'Este email ya está registrado por otro usuario'
        });
      }
      
      updateData.email = email;
    }

    // Actualizar usuario
    const updatedUser = Database.updateUser(req.user.id, updateData);
    
    if (!updatedUser) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        message: 'No se pudo actualizar el usuario'
      });
    }

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      user: updatedUser
    });

  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al actualizar perfil'
    });
  }
});

// GET /api/users - Obtener todos los usuarios (solo para demo)
router.get('/', authMiddleware, (req, res) => {
  try {
    const users = Database.getAllUsers();
    
    res.json({
      success: true,
      users: users,
      count: users.length
    });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al obtener lista de usuarios'
    });
  }
});

module.exports = router;