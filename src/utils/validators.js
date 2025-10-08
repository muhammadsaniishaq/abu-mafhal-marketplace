// src/utils/validators.js

// Validate product form
export const validateProductForm = (data) => {
  const errors = {};

  if (!data.name || data.name.trim().length < 3) {
    errors.name = 'Product name must be at least 3 characters';
  }

  if (!data.description || data.description.trim().length < 10) {
    errors.description = 'Description must be at least 10 characters';
  }

  if (!data.category) {
    errors.category = 'Please select a category';
  }

  if (!data.price || data.price <= 0) {
    errors.price = 'Price must be greater than 0';
  }

  if (!data.stock || data.stock < 0) {
    errors.stock = 'Stock cannot be negative';
  }

  if (!data.images || data.images.length === 0) {
    errors.images = 'Please add at least one product image';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Validate order form
export const validateOrderForm = (data) => {
  const errors = {};

  if (!data.shippingAddress) {
    errors.shippingAddress = 'Shipping address is required';
  } else {
    if (!data.shippingAddress.street) {
      errors.street = 'Street address is required';
    }
    if (!data.shippingAddress.city) {
      errors.city = 'City is required';
    }
    if (!data.shippingAddress.state) {
      errors.state = 'State is required';
    }
    if (!data.shippingAddress.phone) {
      errors.phone = 'Phone number is required';
    }
  }

  if (!data.paymentMethod) {
    errors.paymentMethod = 'Please select a payment method';
  }

  if (!data.items || data.items.length === 0) {
    errors.items = 'Cart is empty';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Validate profile form
export const validateProfileForm = (data) => {
  const errors = {};

  if (!data.name || data.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters';
  }

  if (data.email && !isValidEmail(data.email)) {
    errors.email = 'Invalid email address';
  }

  if (data.phone && !isValidPhone(data.phone)) {
    errors.phone = 'Invalid phone number';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Validate vendor application
export const validateVendorApplication = (data) => {
  const errors = {};

  if (!data.businessName || data.businessName.trim().length < 3) {
    errors.businessName = 'Business name must be at least 3 characters';
  }

  if (!data.businessDescription || data.businessDescription.trim().length < 20) {
    errors.businessDescription = 'Business description must be at least 20 characters';
  }

  if (!data.businessAddress) {
    errors.businessAddress = 'Business address is required';
  }

  if (!data.businessPhone) {
    errors.businessPhone = 'Business phone is required';
  } else if (!isValidPhone(data.businessPhone)) {
    errors.businessPhone = 'Invalid phone number';
  }

  if (!data.businessEmail) {
    errors.businessEmail = 'Business email is required';
  } else if (!isValidEmail(data.businessEmail)) {
    errors.businessEmail = 'Invalid email address';
  }

  if (!data.bankDetails || !data.bankDetails.accountNumber) {
    errors.bankAccountNumber = 'Bank account number is required';
  }

  if (!data.bankDetails || !data.bankDetails.bankName) {
    errors.bankName = 'Bank name is required';
  }

  if (!data.bankDetails || !data.bankDetails.accountName) {
    errors.accountName = 'Account name is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Validate review form
export const validateReviewForm = (data) => {
  const errors = {};

  if (!data.rating || data.rating < 1 || data.rating > 5) {
    errors.rating = 'Please select a rating';
  }

  if (!data.comment || data.comment.trim().length < 10) {
    errors.comment = 'Review must be at least 10 characters';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Validate dispute form
export const validateDisputeForm = (data) => {
  const errors = {};

  if (!data.reason) {
    errors.reason = 'Please select a reason';
  }

  if (!data.description || data.description.trim().length < 20) {
    errors.description = 'Description must be at least 20 characters';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Validate coupon form
export const validateCouponForm = (data) => {
  const errors = {};

  if (!data.code || data.code.trim().length < 3) {
    errors.code = 'Coupon code must be at least 3 characters';
  }

  if (!data.discountType) {
    errors.discountType = 'Please select discount type';
  }

  if (!data.discountValue || data.discountValue <= 0) {
    errors.discountValue = 'Discount value must be greater than 0';
  }

  if (data.discountType === 'percentage' && data.discountValue > 100) {
    errors.discountValue = 'Percentage cannot exceed 100%';
  }

  if (!data.expiryDate) {
    errors.expiryDate = 'Expiry date is required';
  } else {
    const expiryDate = new Date(data.expiryDate);
    if (expiryDate < new Date()) {
      errors.expiryDate = 'Expiry date must be in the future';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Email validation
export const isValidEmail = (email) => {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email);
};

// Phone validation (Nigerian)
export const isValidPhone = (phone) => {
  const pattern = /^(\+234|0)[789][01]\d{8}$/;
  return pattern.test(phone);
};

// URL validation
export const isValidUrl = (url) => {
  const pattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
  return pattern.test(url);
};

// Password validation
export const isValidPassword = (password) => {
  // At least 6 characters, contains letters and numbers
  const pattern = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{6,}$/;
  return pattern.test(password);
};

// Number validation
export const isValidNumber = (value, min = null, max = null) => {
  const num = Number(value);
  if (isNaN(num)) return false;
  if (min !== null && num < min) return false;
  if (max !== null && num > max) return false;
  return true;
};

// Date validation
export const isValidDate = (date) => {
  const d = new Date(date);
  return d instanceof Date && !isNaN(d);
};

// Future date validation
export const isFutureDate = (date) => {
  const d = new Date(date);
  return d > new Date();
};

// Past date validation
export const isPastDate = (date) => {
  const d = new Date(date);
  return d < new Date();
};

// Credit card validation (Luhn algorithm)
export const isValidCreditCard = (cardNumber) => {
  const cleaned = cardNumber.replace(/\s/g, '');
  
  if (!/^\d{13,19}$/.test(cleaned)) return false;
  
  let sum = 0;
  let isEven = false;
  
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i]);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
};

// Bank account number validation (Nigerian - 10 digits)
export const isValidBankAccount = (accountNumber) => {
  const pattern = /^\d{10}$/;
  return pattern.test(accountNumber);
};

// Sanitize input (remove HTML tags)
export const sanitizeInput = (input) => {
  const temp = document.createElement('div');
  temp.textContent = input;
  return temp.innerHTML;
};

// Validate file upload
export const validateFileUpload = (file, options = {}) => {
  const {
    maxSize = 5 * 1024 * 1024, // 5MB default
    allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
  } = options;

  const errors = [];

  if (file.size > maxSize) {
    errors.push(`File size must be less than ${maxSize / (1024 * 1024)}MB`);
  }

  if (!allowedTypes.includes(file.type)) {
    errors.push(`File type must be one of: ${allowedTypes.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Validate multiple files
export const validateMultipleFiles = (files, options = {}) => {
  const {
    maxFiles = 5,
    maxSize = 5 * 1024 * 1024,
    allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
  } = options;

  const errors = [];

  if (files.length > maxFiles) {
    errors.push(`Maximum ${maxFiles} files allowed`);
  }

  files.forEach((file, index) => {
    const validation = validateFileUpload(file, { maxSize, allowedTypes });
    if (!validation.isValid) {
      errors.push(`File ${index + 1}: ${validation.errors.join(', ')}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Validate shipping address
export const validateShippingAddress = (address) => {
  const errors = {};

  if (!address.street || address.street.trim().length < 5) {
    errors.street = 'Street address must be at least 5 characters';
  }

  if (!address.city || address.city.trim().length < 2) {
    errors.city = 'City is required';
  }

  if (!address.state) {
    errors.state = 'State is required';
  }

  if (!address.phone) {
    errors.phone = 'Phone number is required';
  } else if (!isValidPhone(address.phone)) {
    errors.phone = 'Invalid phone number';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};