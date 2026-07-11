import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async signIn({ user }) {
      // En production : insérer/mettre à jour dans la table `users` Supabase.
      // En mode mock : on accepte tout.
      return true;
    },
    async session({ session, token }) {
      // Propager le role dans la session (lu depuis custom claim)
      (session as any).role = (token as any).role ?? 'client';
      return session;
    },
    async jwt({ token, account, profile }) {
      if (profile?.email) {
        // En mock/dev on tag l'admin connu
        (token as any).role = profile.email === 'eaumaliksarl@gmail.com' ? 'admin' : 'client';
      }
      return token;
    },
  },
});

export { handler as GET, handler as POST };
