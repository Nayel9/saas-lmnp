import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      role?: string;
      plan?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      phone?: string | null;
    };
  }
  interface User {
    role?: string;
    plan?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    role?: string;
    plan?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
  }
}
