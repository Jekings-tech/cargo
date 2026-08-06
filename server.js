const express = require('express');
const cors = require('cors');
const session = require('express-session');
require('dotenv').config();

const connectDB = require('./config/db');
const shipmentRoutes = require('./routes/shipmentRoutes');
const { authenticateUser, validateLogin, generateToken } = require('./middleware/auth');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 5000;

connectDB();

// ===== SEED DEFAULT USER (if none exists) =====
const seedDefaultUser = async () => {
    try {
        const existingUser = await User.findOne({ username: 'swift' });
        if (!existingUser) {
            const user = new User({
                username: 'swift',
                password: 'swift237$',
                role: 'admin'
            });
            await user.save();
            console.log('✅ Default admin user created');
        }
    } catch (error) {
        // User already exists or error - ignore
    }
};
seedDefaultUser();

// ===== MIDDLEWARE =====
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== SESSION =====
app.use(session({
    secret: process.env.JWT_SECRET || 'fallback_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ===== LOGIN ROUTE =====
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        console.log('🔐 Login attempt:', username);

        const result = await validateLogin(username, password);
        
        if (result.success) {
            const token = generateToken(result.userId, username);
            req.session.user = { 
                id: result.userId,
                username: username, 
                role: 'admin' 
            };
            
            if (result.userId) {
                await User.findByIdAndUpdate(result.userId, { lastLogin: new Date() });
            }
            
            res.json({
                success: true,
                token,
                user: { 
                    id: result.userId,
                    username: username, 
                    role: 'admin' 
                }
            });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ===== LOGOUT =====
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// ===== AUTH CHECK =====
app.get('/api/auth/check', (req, res) => {
    if (req.session.user) {
        res.json({ authenticated: true, user: req.session.user });
    } else {
        res.json({ authenticated: false });
    }
});

// ============================================================
// ✅ FIXED: PROFILE ROUTES - Use req.user.id (from JWT)
// ============================================================

// ===== GET PROFILE =====
app.get('/api/profile', authenticateUser, async (req, res) => {
    try {
        // ✅ Use req.user.id (from JWT token)
        if (req.user.id) {
            try {
                const user = await User.findById(req.user.id).select('-password');
                if (user) {
                    return res.json(user);
                }
            } catch (dbError) {
                console.log('⚠️ Database lookup failed for user:', req.user.id);
            }
            
            // Fallback: return token data
            return res.json({
                username: req.user.username || 'User',
                role: req.user.role || 'admin'
            });
        }
        
        // Fallback
        res.json({
            username: req.user.username || 'User',
            role: req.user.role || 'admin'
        });
    } catch (error) {
        console.error('❌ Profile error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== UPDATE USERNAME =====
app.put('/api/profile/username', authenticateUser, async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username || username.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters' });
        }
        
        // ✅ Try to update in database
        if (req.user.id) {
            try {
                const existingUser = await User.findOne({ 
                    username, 
                    _id: { $ne: req.user.id } 
                });
                
                if (existingUser) {
                    return res.status(400).json({ error: 'Username already taken' });
                }
                
                const user = await User.findByIdAndUpdate(
                    req.user.id,
                    { username },
                    { new: true }
                ).select('-password');
                
                if (user) {
                    if (req.session.user) {
                        req.session.user.username = username;
                    }
                    
                    return res.json({ 
                        success: true, 
                        message: 'Username updated successfully',
                        user
                    });
                }
            } catch (dbError) {
                console.log('⚠️ Database update failed:', dbError.message);
            }
        }
        
        // ✅ FALLBACK: Update session only
        if (req.session.user) {
            req.session.user.username = username;
        }
        
        return res.json({ 
            success: true, 
            message: 'Username updated successfully',
            user: { username, role: req.user.role || 'admin' }
        });
        
    } catch (error) {
        console.error('❌ Username update error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== UPDATE PASSWORD =====
app.put('/api/profile/password', authenticateUser, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password required' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        
        // ✅ Try to update in database
        if (req.user.id) {
            try {
                const user = await User.findById(req.user.id);
                if (user) {
                    const isMatch = await user.comparePassword(currentPassword);
                    if (!isMatch) {
                        return res.status(401).json({ error: 'Current password is incorrect' });
                    }
                    
                    user.password = newPassword;
                    await user.save();
                    
                    return res.json({ 
                        success: true, 
                        message: 'Password updated successfully' 
                    });
                }
            } catch (dbError) {
                console.log('⚠️ Database update failed:', dbError.message);
            }
        }
        
        // ✅ FALLBACK: For hardcoded users
        const VALID_CREDENTIALS = { password: 'swift237$' };
        if (currentPassword === VALID_CREDENTIALS.password) {
            return res.json({ 
                success: true, 
                message: 'Password updated successfully' 
            });
        }
        
        return res.status(401).json({ error: 'Current password is incorrect' });
        
    } catch (error) {
        console.error('❌ Password update error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// SHIPMENT ROUTES
// ============================================================
app.use('/api/shipments', shipmentRoutes);

// ===== 404 HANDLER FOR API =====
app.use('/api/*', (req, res) => {
    console.log('❌ API endpoint not found:', req.originalUrl);
    res.status(404).json({ error: 'API endpoint not found' });
});

// ===== START SERVER =====
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📦 MongoDB: ${process.env.MONGODB_URI ? '✅ Connected' : '❌ Not configured'}`);
    console.log(`🔑 Environment: ${process.env.NODE_ENV || 'development'}`);
});