import GameBoard from '../components/GameBoard';
import { getCurrentUser } from '../lib/auth';
import { prisma } from '../lib/prisma';

export default async function HomePage() {
  const user = await getCurrentUser();
  const users = user
    ? await prisma.user.findMany({
        orderBy: {
          username: 'asc'
        },
        select: {
          id: true,
          username: true
        }
      })
    : [];

  return <GameBoard registeredPlayers={users} readOnly={!user} />;
}
