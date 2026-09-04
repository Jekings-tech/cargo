const jwt = require('jsonwebtoken');
const User = require('../models/User');

const VALID_CREDENTIALS = {
    username: 'Wavepapi',
    password: 'Wavepapi123'
};

const authenticateUser = async (req, res, next) => {
    const authHeader = req.header('Authorization');
    console.log('🔑 Auth Header:', authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('❌ No Bearer token found');
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('🔑 Token received:', token.substring(0, 20) + '...');

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('✅ Token verified:', decoded);

        // ✅ ALWAYS set req.user from token
        req.user = {
            id: decoded.id || 'fallback-user',
            username: decoded.username || 'Wavepapi',
            role: decoded.role || 'admin'
        };

        // Try to get full user from database (optional)
        try {
            if (decoded.id && decoded.id !== 'fallback-user') {
                const user = await User.findById(decoded.id).select('-password');
                if (user) {
                    req.user = user;
                    console.log('✅ Full user loaded from DB:', user.username);
                }
            }
        } catch (dbError) {
            console.log('⚠️ DB lookup failed, using token data');
        }

        console.log('✅ req.user set:', req.user);
        next();
    } catch (error) {
        console.error('❌ Token verification failed:', error.message);
        return res.status(401).json({ error: 'Invalid token: ' + error.message });
    }
};

const validateLogin = async (username, password) => {
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
        console.log('⚠️ Database login error:', error.message);
    }
    
    if (username === VALID_CREDENTIALS.username && 
        password === VALID_CREDENTIALS.password) {
        return { success: true, userId: null };
    }
    
    return { success: false };
};

const generateToken = (userId, username) => {
    const id = userId || 'fallback-user';
    return jwt.sign(
        { 
            id: id,
            username: username,
            role: 'admin' 
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );
};

module.exports = { authenticateUser, validateLogin, generateToken };