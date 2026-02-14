export const validateEmail = (value = '') => /\S+@\S+\.\S+/.test(value);
export const validateRequired = (value) => value !== undefined && value !== null && String(value).trim() !== '';