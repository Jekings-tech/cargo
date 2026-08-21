const jwt = require('jsonwebtoken');
const User = require('../models/User'); // ✅ ADD THIS

// ✅ KEEP YOUR EXISTING CREDENTIALS (as fallback)
const VALID_CREDENTIALS = {
    username: 'Wavepapi',
    password: 'Wavepapi123'
};

// ============================================================
// ✅ UPDATED: authenticateUser - Now checks database AND fallback
// ============================================================
const authenticateUser = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // ✅ TRY DATABASE FIRST
        try {
            const user = await User.findById(decoded.id).select('-password');
            if (user) {
                req.user = user;
                return next();
            }
        } catch (dbError) {
            // Database error - fallback to token data
            console.log('⚠️ Database lookup failed, using token data');
        }
        
        // ✅ FALLBACK: Use token data (for backward compatibility)
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// ============================================================
// ✅ UPDATED: validateLogin - Checks database FIRST, then fallback
// ============================================================
const validateLogin = async (username, password) => {
    // ✅ TRY DATABASE FIRST
    try {
        const user = await User.findOne({ username });
        if (user) {
            const isMatch = await user.comparePassword(password);
            if (isMatch) {
                return { success: true, userId: user._id };
            }
            return { success: false };
        }
    } catch (error) {
        console.log('⚠️ Database login error, using fallback:', error.message);
    }
    
    // ✅ FALLBACK: Use hardcoded credentials
    if (username === VALID_CREDENTIALS.username && 
        password === VALID_CREDENTIALS.password) {
        return { success: true, userId: null };
    }
    
    return { success: false };
};

// ============================================================
// ✅ UPDATED: generateToken - Now handles both userId and username
// ============================================================
const generateToken = (userId, username) => {
    return jwt.sign(
        { 
            id: userId,           // ✅ For database users
            username: username,   // ✅ For fallback users
            role: 'admin' 
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );
};

module.exports = { authenticateUser, validateLogin, generateToken };