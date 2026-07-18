const jwt = require('jsonwebtoken');

const VALID_CREDENTIALS = {
    username: 'swift',
    password: 'swift237$'
};

const authenticateUser = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

const validateLogin = (username, password) => {
    return username === VALID_CREDENTIALS.username && 
           password === VALID_CREDENTIALS.password;
};

const generateToken = (username) => {
    return jwt.sign(
        { username, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );
};

module.exports = { authenticateUser, validateLogin, generateToken };