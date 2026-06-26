const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const xss = require('xss-clean');
const passport = require('./config/passport');
const { apiLimiter } = require('./middleware/rateLimiter');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const storeRoutes = require('./routes/storeRoutes');
const productRoutes = require('./routes/productRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const brandRoutes = require('./routes/brandRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
    origin: (origin, callback) => {
        const platformDomain = process.env.PLATFORM_DOMAIN || 'platform.com';
        const allowed = !origin ||
            origin === process.env.CLIENT_URL ||
            origin.endsWith(`.${platformDomain}`) ||
            origin.includes('localhost');
        callback(allowed ? null : new Error('Not allowed by CORS'), allowed);
    },
    credentials: true,
}));
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(compression());

if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

app.use(passport.initialize());
app.use('/api', apiLimiter);

app.get('/health', (req, res) => {
    res.status(200).json({ success: true, message: 'OK', timestamp: new Date().toISOString() });
});

const API_PREFIX = '/api/v1';
app.use(`${API_PREFIX}/auth`, authRoutes);
const storefrontRoutes = require('./routes/storefrontRoutes');
app.use(`${API_PREFIX}/storefront`, storefrontRoutes);
app.use(`${API_PREFIX}/stores/:storeId/products`, productRoutes);
app.use(`${API_PREFIX}/stores/:storeId/categories`, categoryRoutes);
app.use(`${API_PREFIX}/stores/:storeId/brands`, brandRoutes);
app.use(`${API_PREFIX}/stores`, storeRoutes);
app.use(`${API_PREFIX}/admin`, adminRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;