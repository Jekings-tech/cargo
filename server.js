const express = require('express');
const cors = require('cors');
const session = require('express-session');
require('dotenv').config();

const connectDB = require('./config/db');
const shipmentRoutes = require('./routes/shipmentRoutes');
const { validateLogin, generateToken } = require('./middleware/auth');

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

// ===== LOGIN ROUTE (MUST BE BEFORE ANY CATCH-ALL) =====
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    console.log('🔐 Login attempt:', username);
    
    if (validateLogin(username, password)) {
        const token = generateToken(username);
        req.session.user = { username, role: 'admin' };
        res.json({
            success: true,
            token,
            user: { username, role: 'admin' }
        });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
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

// ===== SHIPMENT ROUTES =====
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