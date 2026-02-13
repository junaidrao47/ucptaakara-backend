const bcrypt = require('bcryptjs');

/**
 * User Model
 * Manages user data and password hashing
 */
class User {
  constructor(id, email, password, name, role = 'user', createdAt = new Date()) {
    this.id = id;
    this.email = email;
    this.password = password; // Should be hashed
    this.name = name;
    this.role = role; // 'admin', 'user', 'moderator'
    this.createdAt = createdAt;
  }

  /**
   * Hash password using bcryptjs
   * @param {string} password - Plain text password
   * @returns {Promise<string>} - Hashed password
   */
  static async hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  }

  /**
   * Compare plain password with hashed password
   * @param {string} plainPassword - Plain text password
   * @param {string} hashedPassword - Hashed password from database
   * @returns {Promise<boolean>} - True if passwords match
   */
  static async comparePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Get user data without sensitive information
   * @returns {object} - Safe user object
   */
  getSafeUser() {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      role: this.role,
      createdAt: this.createdAt
    };
  }
}

module.exports = User;
