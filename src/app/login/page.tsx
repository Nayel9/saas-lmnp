import type { Metadata } from 'next';
import LoginPageClient from './LoginPageClient';

export const metadata: Metadata = {
  title: 'Connexion / Authentification – LMNP App',
  description: 'Se connecter, créer un compte ou recevoir un lien magique pour accéder au tableau de bord LMNP.',
};

export default function Page() {
  return <LoginPageClient />;
}
