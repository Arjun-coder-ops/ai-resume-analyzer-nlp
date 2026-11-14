// middleware/errorMiddleware.js - Global error handling middleware
const errorMiddleware = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  const responseStatus = err.status || statusCode;
  
  // Avoid putting potentially sensitive provider/database details in logs.
  console.error(`[Error] ${req.method} ${req.url} (${responseStatus}): ${err.name || 'Error'}`);

  res.status(responseStatus).json({
    success: false,
    message: responseStatus >= 500 ? 'An unexpected error occurred. Please try again later.' : (err.message || 'Request failed.'),
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
