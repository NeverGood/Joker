import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'crypto';

const prisma = new PrismaClient();

const PLAYERS = ['Бутка', 'Печун', 'Бардак', 'Монай', 'Ржавый', 'Пронька', 'Цыплак'];
const DEFAULT_PASSWORD = process.env.JOKER_DEFAULT_PLAYER_PASSWORD;
const PLAYER_PASSWORDS = {
  Бутка: process.env.JOKER_BUTKA_PASSWORD
};
const PASSWORD_KEY_LENGTH = 64;

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString('hex');

  return `scrypt$${salt}$${hash}`;
}

async function main() {
  const existingUsers = await prisma.user.findMany({
    where: {
      username: {
        in: PLAYERS
      }
    },
    select: {
      username: true
    }
  });
  const existingUsernames = new Set(existingUsers.map((user) => user.username));

  await Promise.all(
    PLAYERS.map((username) => {
      const password = PLAYER_PASSWORDS[username] || DEFAULT_PASSWORD;

      if (!existingUsernames.has(username) && !password) {
        throw new Error(
          `Set JOKER_DEFAULT_PLAYER_PASSWORD${username === 'Бутка' ? ' or JOKER_BUTKA_PASSWORD' : ''} before seeding ${username}.`
        );
      }

      return prisma.user.upsert({
        where: { username },
        update: {
          isAdmin: username === 'Бутка',
          ...(password ? { passwordHash: hashPassword(password) } : {})
        },
        create: {
          username,
          passwordHash: hashPassword(password),
          isAdmin: username === 'Бутка'
        }
      });
    })
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
