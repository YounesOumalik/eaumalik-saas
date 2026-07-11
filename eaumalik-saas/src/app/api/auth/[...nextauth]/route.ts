import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { readUsers } from '@/data/localDb';

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const users = readUsers();
        const user = users.find(
          u => u.email.toLowerCase() === credentials.email.toLowerCase() && u.password === credentials.password
        );
        if (user) {
          return { id: user.id, name: user.full_name, email: user.email, role: user.role };
        }
        return null;
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async signIn({ user }) {
      return true;
    },
    async session({ session, token }) {
      (session as any).role = (token as any).role ?? 'client';
      if (session.user) {
        (session.user as any).id = (token as any).id;
      }
      return session;
    },
    async jwt({ token, user, profile }) {
      if (user) {
        (token as any).role = (user as any).role ?? 'client';
        (token as any).id = user.id;
      } else if (profile?.email) {
        (token as any).role = profile.email === 'eaumaliksarl@gmail.com' ? 'admin' : 'client';
      }
      return token;
    },
  },
});

export { handler as GET, handler as POST };
