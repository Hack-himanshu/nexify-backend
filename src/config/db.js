const mongoose = require('mongoose');

/**
 * Establishes connection to MongoDB Atlas.
 * Exits process on failure since the app cannot function without a DB connection.
 */
const connectDB = async () => {
  try {
    mongoose.set('strictQuery', true);

    const conn = await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 10000,
    });

    console.log(`[DB] MongoDB connected: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      console.error(`[DB] Connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[DB] MongoDB disconnected');
    });

    return conn;
  } catch (error) {
    console.error(`[DB] Failed to connect: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
