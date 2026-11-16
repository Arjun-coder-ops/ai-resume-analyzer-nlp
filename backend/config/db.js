// config/db.js - MongoDB connection using Mongoose

const mongoose = require('mongoose');

const connectDB = async () => {
  // In unit / mock test environments, skip external database connection
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  if (!process.env.MONGO_URI || !process.env.MONGO_URI.trim()) {
    throw new Error('MONGO_URI must be configured before the API can start.');
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Safely sync unique partial indexes and create quota indexes without dropping unrelated production indexes
    const { syncAnalysisIndexes } = require('../models/Analysis');
    const UserDailyQuota = require('../models/UserDailyQuota');
    const Institution = require('../models/Institution');
    const InstitutionMembership = require('../models/InstitutionMembership');
    const AuditLog = require('../models/AuditLog');
    await syncAnalysisIndexes();
    await UserDailyQuota.createIndexes();
    await Promise.all([Institution.createIndexes(), InstitutionMembership.createIndexes(), AuditLog.createIndexes()]);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;
