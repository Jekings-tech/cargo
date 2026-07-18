const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI;
        if (!mongoURI) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }
        
        console.log('🔍 Attempting to connect to MongoDB...');
        await mongoose.connect(mongoURI);
        console.log('✅ MongoDB Atlas Connected Successfully');
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error.message);
        process.exit(1);
    }
};

module.exports = connectDB;