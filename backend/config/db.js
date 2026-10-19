// config/db.js - MongoDB connection using Mongoose

const mongoose = require('mongoose');

const connectDB = async () => {
  // In unit / mock test environments, skip external database connection
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Safely sync unique partial indexes and create quota indexes without dropping unrelated production indexes
    const { syncAnalysisIndexes } = require('../models/Analysis');
    const UserDailyQuota = require('../models/UserDailyQuota');
    await syncAnalysisIndexes();
    await UserDailyQuota.createIndexes();
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
