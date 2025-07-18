const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuración de la conexión MySQL
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'practica12_db',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Crear pool de conexiones
const pool = mysql.createPool(dbConfig);

class Database {
  
  // Inicializar tablas (ejecutar una vez)
  static async initTables() {
    try {
      const connection = await pool.getConnection();
      
      // Crear tabla users si no existe
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      // 🆕 Crear tabla medicaments si no existe
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS medicaments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          dose VARCHAR(255) NOT NULL,
          time VARCHAR(255) NOT NULL,
          image_url VARCHAR(500),
          user_id INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Insertar usuarios de prueba si la tabla está vacía
      const [rows] = await connection.execute('SELECT COUNT(*) as count FROM users');
      if (rows[0].count === 0) {
        await connection.execute(`
          INSERT INTO users (name, email, password) VALUES 
          ('Admin User', 'admin@example.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'),
          ('Test User', 'test@example.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi')
        `);
        console.log('✅ Usuarios de prueba creados');
      }

      connection.release();
      console.log('✅ Base de datos inicializada correctamente');
    } catch (error) {
      console.error('❌ Error al inicializar base de datos:', error);
      throw error;
    }
  }

  // === MÉTODOS DE USUARIOS ===
  
  static async getAllUsers() {
    try {
      const [rows] = await pool.execute(
        'SELECT id, name, email, created_at FROM users ORDER BY created_at DESC'
      );
      return rows;
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      throw error;
    }
  }

  static async getUserById(id) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM users WHERE id = ?', 
        [id]
      );
      return rows[0] || null;
    } catch (error) {
      console.error('Error al obtener usuario por ID:', error);
      throw error;
    }
  }

  static async getUserByEmail(email) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM users WHERE email = ?', 
        [email]
      );
      return rows[0] || null;
    } catch (error) {
      console.error('Error al obtener usuario por email:', error);
      throw error;
    }
  }

  static async createUser(userData) {
    try {
      const { name, email, password } = userData;
      
      const [result] = await pool.execute(
        'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
        [name, email, password]
      );

      const [rows] = await pool.execute(
        'SELECT id, name, email, created_at FROM users WHERE id = ?',
        [result.insertId]
      );

      return rows[0];
    } catch (error) {
      console.error('Error al crear usuario:', error);
      throw error;
    }
  }

  static async updateUser(id, userData) {
    try {
      const fields = [];
      const values = [];

      if (userData.name) {
        fields.push('name = ?');
        values.push(userData.name);
      }
      if (userData.email) {
        fields.push('email = ?');
        values.push(userData.email);
      }
      if (userData.password) {
        fields.push('password = ?');
        values.push(userData.password);
      }

      if (fields.length === 0) return null;

      values.push(id);

      await pool.execute(
        `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      const [rows] = await pool.execute(
        'SELECT id, name, email, created_at FROM users WHERE id = ?',
        [id]
      );

      return rows[0] || null;
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      throw error;
    }
  }

  static async deleteUser(id) {
    try {
      const [result] = await pool.execute(
        'DELETE FROM users WHERE id = ?', 
        [id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      throw error;
    }
  }

  static async emailExists(email, excludeId = null) {
    try {
      let query = 'SELECT COUNT(*) as count FROM users WHERE email = ?';
      let params = [email];

      if (excludeId) {
        query += ' AND id != ?';
        params.push(excludeId);
      }

      const [rows] = await pool.execute(query, params);
      return rows[0].count > 0;
    } catch (error) {
      console.error('Error al verificar email:', error);
      throw error;
    }
  }

  // === 🆕 MÉTODOS DE MEDICAMENTOS ===
  
  static async getMedicamentsByUserId(userId) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM medicaments WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );
      return rows;
    } catch (error) {
      console.error('Error al obtener medicamentos por usuario:', error);
      throw error;
    }
  }

  static async getMedicamentById(id, userId) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM medicaments WHERE id = ? AND user_id = ?',
        [id, userId]
      );
      return rows[0] || null;
    } catch (error) {
      console.error('Error al obtener medicamento por ID:', error);
      throw error;
    }
  }

  static async createMedicament(medicamentData) {
    try {
      const { name, dose, time, image_url, user_id } = medicamentData;
      
      const [result] = await pool.execute(
        'INSERT INTO medicaments (name, dose, time, image_url, user_id) VALUES (?, ?, ?, ?, ?)',
        [name, dose, time, image_url, user_id]
      );

      const [rows] = await pool.execute(
        'SELECT * FROM medicaments WHERE id = ?',
        [result.insertId]
      );

      return rows[0];
    } catch (error) {
      console.error('Error al crear medicamento:', error);
      throw error;
    }
  }

  static async updateMedicament(id, medicamentData) {
    try {
      const fields = [];
      const values = [];

      if (medicamentData.name) {
        fields.push('name = ?');
        values.push(medicamentData.name);
      }
      if (medicamentData.dose) {
        fields.push('dose = ?');
        values.push(medicamentData.dose);
      }
      if (medicamentData.time) {
        fields.push('time = ?');
        values.push(medicamentData.time);
      }
      if (medicamentData.image_url !== undefined) {
        fields.push('image_url = ?');
        values.push(medicamentData.image_url);
      }

      if (fields.length === 0) return null;

      values.push(id);

      await pool.execute(
        `UPDATE medicaments SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      const [rows] = await pool.execute(
        'SELECT * FROM medicaments WHERE id = ?',
        [id]
      );

      return rows[0] || null;
    } catch (error) {
      console.error('Error al actualizar medicamento:', error);
      throw error;
    }
  }

  static async deleteMedicament(id) {
    try {
      const [result] = await pool.execute(
        'DELETE FROM medicaments WHERE id = ?',
        [id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error al eliminar medicamento:', error);
      throw error;
    }
  }

  // Cerrar pool de conexiones
  static async closePool() {
    try {
      await pool.end();
      console.log('✅ Pool de conexiones cerrado');
    } catch (error) {
      console.error('Error al cerrar pool:', error);
    }
  }
}

module.exports = Database;