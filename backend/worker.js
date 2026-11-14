const connectDB = require('./config/db');

const startWorker = async () => {
  try {
    await connectDB();
    const { ensureQueueReady } = require('./queue/analyzeQueue');
    await ensureQueueReady();
    console.log('ResumeIQ analysis worker is ready.');
  } catch (error) {
    console.error(`Worker startup failed: ${error.message}`);
    process.exitCode = 1;
  }
};

startWorker();
