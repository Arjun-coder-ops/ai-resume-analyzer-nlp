// middleware/errorMiddleware.js - Global error handling middleware
const errorMiddleware = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  // Log the error stack for the developer
  console.error(`[Error] ${req.method} ${req.url}:`, err.stack);

  res.status(err.status || statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    // Only show stack trace in development mode
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      details: err.details || null 
    }),
  });
};

// 404 Not Found Middleware
const notFound = (req, res, next) => {
  const error = new Error(`Route Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

module.exports = { errorMiddleware, notFound };
