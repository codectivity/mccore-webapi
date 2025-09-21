import express from 'express';
import cors from 'cors';
import path from 'path';
import session from 'express-session';
import publicRouter from './routes/public';
import adminRouter from './routes/admin';
import setupRouter from './routes/setup';
import webRouter from './routes/web';
import { initializeDatabase } from './database';

const app = express();

const currentVersion: string = 'v2';

// Initialize database
initializeDatabase().catch(console.error);

// Setup EJS view engine for web UI
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files for web UI
app.use('/static', express.static(path.join(__dirname, 'public')));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || (() => {
    console.warn('⚠️  WARNING: Using fallback session secret. Set SESSION_SECRET environment variable for production.');
    return 'fallback-secret-change-in-production-' + Math.random().toString(36).substring(2);
  })(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Enable JSON parsing
app.use(express.json());
// Enable URL-encoded form parsing for the admin interface
app.use(express.urlencoded({ extended: true }));

// Setup routes (no authentication required)
app.use(`/${currentVersion}/setup`, cors(), setupRouter);

// Enable CORS for public routes only
app.use(`/${currentVersion}/public`, cors(), publicRouter);

// Admin routes (protected by API key authentication)
app.use(`/${currentVersion}/admin`, adminRouter);

// Web UI routes
app.use('/', webRouter);

export default app;