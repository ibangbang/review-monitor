import 'dotenv/config';
import 'reflect-metadata';
import { hash } from 'bcryptjs';
import { ulid } from 'ulid';
import { AppDataSource } from './data-source';
import { AdminUser, User, Workspace, WorkspaceMember } from './entities';

async function main(): Promise<void> {
  await AppDataSource.initialize();
  try {
    const email = (process.env.ADMIN_EMAIL ?? 'admin@reviewmonitor.local').toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!password) throw new Error('ADMIN_PASSWORD is required to seed the administrator');

    const admins = AppDataSource.getRepository(AdminUser);
    const existing = await admins.findOne({ where: { email } });
    if (existing) {
      console.log(`Admin ${email} already exists`);
    } else {
      await admins.save(
        admins.create({
          publicId: ulid(),
          email,
          passwordHash: await hash(password, 12),
          displayName: 'ReviewMonitor Admin',
          status: 'active',
        }),
      );
      console.log(`Admin ${email} created`);
    }

    if (process.env.SEED_DEMO === 'true') {
      await seedDemo();
    }
  } finally {
    await AppDataSource.destroy();
  }
}

async function seedDemo(): Promise<void> {
  const users = AppDataSource.getRepository(User);
  const email = 'demo@reviewmonitor.local';
  const existing = await users.findOne({ where: { email } });
  if (existing) {
    console.log(`Demo user ${email} already exists`);
    return;
  }
  const passwordHash = await hash('demo12345', 12);
  await AppDataSource.transaction(async (manager) => {
    const user = manager.create(User, {
      publicId: ulid(),
      email,
      passwordHash,
      displayName: 'Demo User',
      status: 'active',
    });
    await manager.save(user);
    const workspace = manager.create(Workspace, {
      publicId: ulid(),
      name: 'Demo Workspace',
      ownerUserId: user.id,
      status: 'active',
    });
    await manager.save(workspace);
    await manager.save(
      manager.create(WorkspaceMember, {
        workspaceId: workspace.id,
        userId: user.id,
        role: 'owner',
        status: 'active',
        joinedAt: new Date(),
      }),
    );
  });
  console.log(`Demo user ${email} created (password demo12345)`);
}

void main();
