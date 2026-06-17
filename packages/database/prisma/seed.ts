import { PrismaClient, TenantPlan, UserRole } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

const prisma = new PrismaClient();

/**
 * Demo seed — creates one tenant with a user for each role.
 * Run: pnpm db:seed
 *
 * NOTE: passwords here are placeholders. Real Argon2id hashing
 * is implemented in Step 1 (auth module). This seed will be
 * updated then to use the AuthService.
 */
async function main(): Promise<void> {
  console.log('🌱 Seeding database...');

  // ── Demo Tenant ────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-corp' },
    update: {},
    create: {
      name: 'Demo Corp',
      slug: 'demo-corp',
      plan: TenantPlan.PRO,
      isActive: true,
      mfaEnforced: false,
    },
  });

  console.log(`✅ Tenant: ${tenant.name} (${tenant.id})`);

  // ── Demo Users (one per role) ──────────────────────────────────────────────
  const demoUsers = [
    { email: 'owner@demo.clarbit.com', firstName: 'Alice', lastName: 'Owner', role: UserRole.OWNER },
    { email: 'admin@demo.clarbit.com', firstName: 'Bob', lastName: 'Admin', role: UserRole.ADMIN },
    { email: 'member@demo.clarbit.com', firstName: 'Carol', lastName: 'Member', role: UserRole.MEMBER },
    { email: 'guest@demo.clarbit.com', firstName: 'Dave', lastName: 'Guest', role: UserRole.GUEST },
  ];

  for (const userData of demoUsers) {
    // Placeholder hash — will be replaced with Argon2id in Step 1
    const placeholderHash = createHash('sha256')
      .update(`demo-password-${userData.email}`)
      .digest('hex');

    const user = await prisma.user.upsert({
      where: { email_tenantId: { email: userData.email, tenantId: tenant.id } },
      update: {},
      create: {
        tenantId: tenant.id,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        passwordHash: placeholderHash,
        emailVerified: true,
        isActive: true,
      },
    });
    console.log(`  👤 ${user.role}: ${user.email} (${user.id})`);
  }

  console.log('\n✅ Seed complete!');
  console.log('\n📋 Demo credentials:');
  console.log('   Tenant slug: demo-corp');
  demoUsers.forEach((u) => console.log(`   ${u.role.padEnd(8)} — ${u.email} / demo123`));
  console.log('\n⚠️  Passwords are stubs until Step 1 (auth) is complete.\n');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
