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

// ===== MIDDLEWARE =====
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.JWT_SECRET || 'fallback_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ===== LOGIN =====
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

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/auth/check', (req, res) => {
    if (req.session.user) {
        res.json({ authenticated: true, user: req.session.user });
    } else {
        res.json({ authenticated: false });
    }
});

// ============================================================
// ✅ PROFILE ROUTES - CLEAN, NO FALLBACKS
// ============================================================

app.get('/api/profile', authenticateUser, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('❌ Profile error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/profile/username', authenticateUser, async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username || username.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters' });
        }
        
        // Check if username already taken
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
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Update session
        if (req.session.user) {
            req.session.user.username = username;
        }
        
        res.json({ 
            success: true, 
            message: 'Username updated successfully',
            user
        });
        
    } catch (error) {
        console.error('❌ Username update error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== FIXED: Password Update - NO FALLBACKS =====
app.put('/api/profile/password', authenticateUser, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password required' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        
        // Get user from database
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Verify current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        // Update password (will be hashed by pre-save hook)
        user.password = newPassword;
        await user.save();
        
        res.json({ 
            success: true, 
            message: 'Password updated successfully' 
        });
        
    } catch (error) {
        console.error('❌ Password update error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// SHIPMENT ROUTES
// ============================================================
app.use('/api/shipments', shipmentRoutes);

app.use('/api/*', (req, res) => {
    console.log('❌ API endpoint not found:', req.originalUrl);
    res.status(404).json({ error: 'API endpoint not found' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📦 MongoDB: ${process.env.MONGODB_URI ? '✅ Connected' : '❌ Not configured'}`);
    console.log(`🔑 Environment: ${process.env.NODE_ENV || 'development'}`);
});