import { auth } from '@/lib/auth/core';
import { Landing } from '@/components/marketing/Landing';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await auth();
  const authenticated = !!session?.user;
  return (
    <main id="main" tabIndex={-1} className="min-h-screen focus:outline-none">
      <Landing authenticated={authenticated} />
    </main>
  );
}
