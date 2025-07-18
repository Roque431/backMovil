const jwt = require('jsonwebtoken');
const Database = require('../database/database');

const authMiddleware = async (req, res, next) => {
  try {
    // 🔍 DEBUG: Ver todos los headers
    console.log('🔍 Headers recibidos:', req.headers);
    
    // 🔧 ARREGLO: Buscar Authorization en diferentes casos
    const authHeader = req.header('Authorization') || 
                      req.header('authorization') || 
                      req.headers['Authorization'] ||
                      req.headers['authorization'];
                      
    console.log('🔍 Authorization header:', authHeader);
    
    if (!authHeader) {
      console.log('❌ No hay Authorization header en ningún formato');
      return res.status(401).json({ 
        error: 'Token no proporcionado',
        message: 'Se requiere autenticación'
      });
    }

    // Extraer token del header
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    console.log('🔍 Token extraído:', token ? `${token.substring(0, 20)}...` : 'Token vacío');

    if (!token) {
      console.log('❌ Token vacío después de extraer');
      return res.status(401).json({ 
        error: 'Token inválido',
        message: 'Formato de token incorrecto'
      });
    }

    // Verificar y decodificar token
    console.log('🔍 Verificando token con JWT_SECRET...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('🔍 Token decodificado exitosamente:', decoded);
    
    // Buscar usuario en la base de datos
    console.log('🔍 Buscando usuario con ID:', decoded.userId);
    const user = await Database.getUserById(decoded.userId);
    console.log('🔍 Usuario encontrado:', user ? `ID: ${user.id}, Name: ${user.name}` : 'No encontrado');
    
    if (!user) {
      console.log('❌ Usuario no encontrado en base de datos');
      return res.status(401).json({ 
        error: 'Usuario no encontrado',
        message: 'Token válido pero usuario no existe'
      });
    }

    // Agregar usuario al request para uso en rutas
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email
    };
    
    console.log('✅ Usuario autenticado correctamente:', req.user);
    
    // Continuar con la siguiente función
    next();
    
  } catch (error) {
    console.error('❌ Error en auth middleware:', error.message);
    console.error('❌ Error completo:', error);
    
    if (error.name === 'JsonWebTokenError') {
      console.log('❌ Error: Token malformado');
      return res.status(401).json({ 
        error: 'Token inválido',
        message: 'Token malformado o corrupto'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      console.log('❌ Error: Token expirado');
      return res.status(401).json({ 
        error: 'Token expirado',
        message: 'Por favor inicia sesión nuevamente'
      });
    }

    // Error genérico
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: 'Error al verificar autenticación'
    });
  }
};

module.exports = authMiddleware;