// models/UserDailyQuota.js - Atomic daily analysis quota tracking per user with reservation ownership

const mongoose = require('mongoose');

const DAILY_LIMIT = 5;

const userDailyQuotaSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    dateKey: {
      type: String, // 'YYYY-MM-DD' in local server day
      required: true,
    },
    count: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    activeReservations: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index: exactly one quota document per user per day
userDailyQuotaSchema.index({ user: 1, dateKey: 1 }, { unique: true });

/**
 * Returns 'YYYY-MM-DD' date string for the given date in local server time.
 */
const getLocalDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Returns midnight-to-midnight boundary Date objects for the given date in local server time.
 */
const getLocalDayBounds = (date = new Date()) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(24, 0, 0, 0);
  return { startOfDay, endOfDay };
};

/**
 * Atomically reserves 1 quota slot for the user for the given date.
 * Assigns a unique reservationId and records it in activeReservations.
 * Returns { quotaDoc, reservationId } if reserved, or null if quota is exhausted.
 */
const reserveDailyQuota = async (userId, date = new Date(), limit = DAILY_LIMIT) => {
  const UserDailyQuota = mongoose.model('UserDailyQuota');
  const Analysis = mongoose.model('Analysis');
  const dateKey = getLocalDateKey(date);
  const { startOfDay, endOfDay } = getLocalDayBounds(date);
  const reservationId = new mongoose.Types.ObjectId().toString();

  // 1. Ensure document exists. If creating for the first time today, seed with count of non-failed analyses.
  const existingTodayAnalyses = await Analysis.countDocuments({
    user: userId,
    status: { $ne: 'failed' },
    createdAt: { $gte: startOfDay, $lt: endOfDay },
  });

  await UserDailyQuota.updateOne(
    { user: userId, dateKey },
    { $setOnInsert: { user: userId, dateKey, count: existingTodayAnalyses, activeReservations: [] } },
    { upsert: true }
  );

  // 2. Atomically increment count and add reservationId strictly if count < limit
  const reservedDoc = await UserDailyQuota.findOneAndUpdate(
    {
      user: userId,
      dateKey,
      count: { $lt: limit },
    },
    {
      $inc: { count: 1 },
      $push: { activeReservations: reservationId },
    },
    {
      new: true,
    }
  );

  if (!reservedDoc) {
    return null;
  }

  return {
    quotaDoc: reservedDoc,
    reservationId,
  };
};

/**
 * Seals a quota reservation once submission and queue enqueue succeed.
 * Removes reservationId from activeReservations so it can never be rolled back.
 * The slot count remains consumed.
 */
const commitDailyQuota = async (userId, reservationId, date = new Date()) => {
  if (!reservationId) return null;
  const UserDailyQuota = mongoose.model('UserDailyQuota');
  const dateKey = getLocalDateKey(date);

  return await UserDailyQuota.findOneAndUpdate(
    {
      user: userId,
      dateKey,
      activeReservations: reservationId,
    },
    {
      $pull: { activeReservations: reservationId },
    },
    {
      new: true,
    }
  );
};

/**
 * Atomically decrements (refunds) 1 quota slot strictly verifying reservation ownership.
 * Only the specific reservationId can be refunded, and it can be refunded at most once.
 * Once pulled from activeReservations, subsequent calls are no-ops.
 */
const rollbackDailyQuota = async (userId, reservationId, date = new Date()) => {
  if (!reservationId) return null;
  const UserDailyQuota = mongoose.model('UserDailyQuota');
  const dateKey = getLocalDateKey(date);

  return await UserDailyQuota.findOneAndUpdate(
    {
      user: userId,
      dateKey,
      activeReservations: reservationId,
      count: { $gt: 0 },
    },
    {
      $pull: { activeReservations: reservationId },
      $inc: { count: -1 },
    },
    {
      new: true,
    }
  );
};

/**
 * Retrieves the current quota usage and remaining trials for a user.
 */
const getDailyQuotaUsage = async (userId, date = new Date(), limit = DAILY_LIMIT) => {
  const UserDailyQuota = mongoose.model('UserDailyQuota');
  const Analysis = mongoose.model('Analysis');
  const dateKey = getLocalDateKey(date);
  const { startOfDay, endOfDay } = getLocalDayBounds(date);

  let quotaDoc = await UserDailyQuota.findOne({ user: userId, dateKey });
  if (!quotaDoc) {
    const existingCount = await Analysis.countDocuments({
      user: userId,
      status: { $ne: 'failed' },
      createdAt: { $gte: startOfDay, $lt: endOfDay },
    });

    quotaDoc = await UserDailyQuota.findOneAndUpdate(
      { user: userId, dateKey },
      { $setOnInsert: { user: userId, dateKey, count: existingCount, activeReservations: [] } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  const trialsUsed = quotaDoc ? quotaDoc.count : 0;
  const trialsRemaining = Math.max(0, limit - trialsUsed);

  return {
    dailyLimit: limit,
    trialsUsed,
    trialsRemaining,
    resetsAt: endOfDay,
  };
};

/**
 * Atomically refunds 1 quota slot when an analysis fails terminally.
 * Decrements count strictly if count > 0.
 */
const refundFailedAnalysisQuota = async (userId, date = new Date()) => {
  if (!userId) return null;
  const UserDailyQuota = mongoose.model('UserDailyQuota');
  const dateKey = getLocalDateKey(date);

  return await UserDailyQuota.findOneAndUpdate(
    {
      user: userId,
      dateKey,
      count: { $gt: 0 },
    },
    {
      $inc: { count: -1 },
    },
    {
      new: true,
    }
  );
};

const UserDailyQuota = mongoose.model('UserDailyQuota', userDailyQuotaSchema);

module.exports = UserDailyQuota;
module.exports.DAILY_LIMIT = DAILY_LIMIT;
module.exports.getLocalDateKey = getLocalDateKey;
module.exports.getLocalDayBounds = getLocalDayBounds;
module.exports.reserveDailyQuota = reserveDailyQuota;
module.exports.commitDailyQuota = commitDailyQuota;
module.exports.rollbackDailyQuota = rollbackDailyQuota;
module.exports.getDailyQuotaUsage = getDailyQuotaUsage;
module.exports.refundFailedAnalysisQuota = refundFailedAnalysisQuota;
