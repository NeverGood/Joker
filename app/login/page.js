import { redirect } from 'next/navigation';
import LoginForm from '../../components/LoginForm';
import ScoreboardShell from '../../components/ScoreboardShell';
import { getCurrentUser } from '../../lib/auth';

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect('/');
  }

  return (
    <ScoreboardShell active="login">
      <section className="loginPanel">
        <LoginForm />
      </section>
    </ScoreboardShell>
  );
}
