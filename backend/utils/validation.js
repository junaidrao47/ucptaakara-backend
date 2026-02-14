/**
 * Validation Utilities
 * Input validation rules with error messages
 */

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) {
    return { valid: false, message: 'Email is required' };
  }
  if (!emailRegex.test(email)) {
    return { valid: false, message: 'Invalid email format' };
  }
  if (email.length > 100) {
    return { valid: false, message: 'Email is too long' };
  }
  return { valid: true };
};

const validatePassword = (password) => {
  if (!password) {
    return { valid: false, message: 'Password is required' };
  }
  if (password.length < 6) {
    return { valid: false, message: 'Password must be at least 6 characters' };
  }
  if (password.length > 100) {
    return { valid: false, message: 'Password is too long' };
  }
  return { valid: true };
};

const validateName = (name) => {
  if (!name) {
    return { valid: false, message: 'Name is required' };
  }
  if (name.trim().length < 2) {
    return { valid: false, message: 'Name must be at least 2 characters' };
  }
  if (name.length > 50) {
    return { valid: false, message: 'Name is too long' };
  }
  return { valid: true };
};

const validateRole = (role) => {
  const validRoles = ['user', 'admin', 'support'];
  if (!role) {
    return { valid: true }; // Default role is 'user'
  }
  if (!validRoles.includes(role.toLowerCase())) {
    return { 
      valid: false, 
      message: `Role must be one of: ${validRoles.join(', ')}` 
    };
  }
  return { valid: true };
};

const validateRegisterInput = (email, password, name, role) => {
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    return emailValidation;
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return passwordValidation;
  }

  const nameValidation = validateName(name);
  if (!nameValidation.valid) {
    return nameValidation;
  }

  const roleValidation = validateRole(role);
  if (!roleValidation.valid) {
    return roleValidation;
  }

  return { valid: true };
};

const validateLoginInput = (email, password) => {
  if (!email) {
    return { valid: false, message: 'Email is required' };
  }
  if (!password) {
    return { valid: false, message: 'Password is required' };
  }
  return { valid: true };
};

module.exports = {
  validateEmail,
  validatePassword,
  validateName,
  validateRole,
  validateRegisterInput,
  validateLoginInput
};
