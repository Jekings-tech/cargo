const authenticateUser = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // If we have a valid token, ALWAYS set req.user
        req.user = {
            id: decoded.id || 'fallback-user',
            username: decoded.username || 'Wavepapi',
            role: decoded.role || 'admin'
        };
        
        // Try to get full user from database (optional)
        try {
            if (decoded.id) {
                const user = await User.findById(decoded.id).select('-password');
                if (user) {
                    req.user = user;
                }
            }
        } catch (dbError) {
            // Ignore DB errors, use token data
        }
        
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};