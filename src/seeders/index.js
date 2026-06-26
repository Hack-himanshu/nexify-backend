require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Plan = require('../models/Plan');

const seedPlans = async () => {
  const plans = [
    {
      name: 'Free',
      slug: 'free',
      description: 'Get started with a basic online store',
      priceMonthly: 0,
      priceYearly: 0,
      limits: {
        maxProducts: 25,
        maxStaffAccounts: 1,
        maxStorageMB: 250,
        customDomainAllowed: false,
        abandonedCartRecovery: false,
        advancedAnalytics: false,
      },
      features: ['25 products', 'Subdomain storefront', 'Basic analytics'],
      transactionFeePercent: 3,
      isDefault: true,
      trialDays: 0,
    },
    {
      name: 'Growth',
      slug: 'growth',
      description: 'For growing businesses ready to scale',
      priceMonthly: 1499,
      priceYearly: 14990,
      limits: {
        maxProducts: 1000,
        maxStaffAccounts: 5,
        maxStorageMB: 5000,
        customDomainAllowed: true,
        abandonedCartRecovery: true,
        advancedAnalytics: true,
      },
      features: [
        '1,000 products',
        'Custom domain',
        'Abandoned cart recovery',
        'Advanced analytics',
        '5 staff accounts',
      ],
      transactionFeePercent: 1.5,
      trialDays: 14,
    },
    {
      name: 'Enterprise',
      slug: 'enterprise',
      description: 'Unlimited scale with priority support',
      priceMonthly: 4999,
      priceYearly: 49990,
      limits: {
        maxProducts: 100000,
        maxStaffAccounts: 50,
        maxStorageMB: 50000,
        customDomainAllowed: true,
        abandonedCartRecovery: true,
        advancedAnalytics: true,
      },
      features: [
        'Unlimited products',
        'Custom domain',
        'Priority support',
        'Advanced analytics',
        '50 staff accounts',
      ],
      transactionFeePercent: 0.5,
      trialDays: 14,
    },
  ];

  for (const plan of plans) {
    await Plan.findOneAndUpdate({ slug: plan.slug }, plan, { upsert: true, new: true });
  }
  console.log('[SEED] Plans seeded');
};

const seedSuperAdmin = async () => {
  const email = process.env.SUPER_ADMIN_EMAIL || 'admin@platform.com';
  const password = process.env.SUPER_ADMIN_PASSWORD || 'ChangeMe123!';

  const existing = await User.findOne({ email, role: 'super_admin' });
  if (existing) {
    console.log('[SEED] Super admin already exists, skipping');
    return;
  }

  await User.create({
    name: 'Platform Super Admin',
    email,
    password,
    role: 'super_admin',
    isEmailVerified: true,
  });

  console.log(`[SEED] Super admin created: ${email}`);
  console.log('[SEED] IMPORTANT: log in and change this password immediately.');
};

const run = async () => {
  await connectDB();
  await seedPlans();
  await seedSuperAdmin();
  await mongoose.connection.close();
  console.log('[SEED] Done.');
  process.exit(0);
};

run().catch((err) => {
  console.error('[SEED] Failed:', err);
  process.exit(1);
});
