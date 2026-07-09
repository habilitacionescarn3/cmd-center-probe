import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { Role } from "@prisma/client";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";

import { serverEnv } from "@/env/server";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getGoogleOAuthConfig } from "@/server/integrations/service";

const DEFAULT_DOMAIN_WHITELIST = ["dafiti.com"];

const googleIntegration = await getGoogleOAuthConfig();

const googleProviderConfig =
  googleIntegration &&
  googleIntegration.clientId &&
  googleIntegration.clientSecret
    ? {
        clientId: googleIntegration.clientId,
        clientSecret: googleIntegration.clientSecret,
      }
    : serverEnv.GOOGLE_CLIENT_ID && serverEnv.GOOGLE_CLIENT_SECRET
      ? {
          clientId: serverEnv.GOOGLE_CLIENT_ID,
          clientSecret: serverEnv.GOOGLE_CLIENT_SECRET,
        }
      : null;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  events: {
    signIn(message) {
      logger.info({ event: "sign-in", userId: message.user.id }, "User signed in");
    },
    signOut({ session }) {
      logger.info(
        { event: "sign-out", userId: session?.user?.id },
        "User signed out",
      );
    },
  },
  pages: {
    signIn: "/auth/sign-in",
    error: "/auth/error",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) {
        return false;
      }

      if (account?.provider === "credentials") {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { isActive: true },
        });
        return dbUser?.isActive ?? false;
      }

      if (account?.provider === "google") {
        const [, domain = ""] = user.email.split("@");
        const config = await getGoogleOAuthConfig();
        const allowedDomains =
          config?.allowedDomains && config.allowedDomains.length > 0
            ? config.allowedDomains
            : DEFAULT_DOMAIN_WHITELIST;

        if (allowedDomains.length > 0 && !allowedDomains.includes(domain)) {
          logger.warn(
            { email: user.email, domain, event: "unauthorized-domain" },
            "Sign in blocked by domain whitelist",
          );
          return false;
        }
      }

      return true;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.id === "string" ? token.id : "";
        session.user.role =
          (token.role as Role | undefined) ??
          Role.GUEST;
        session.user.email =
          typeof token.email === "string" ? token.email : session.user.email;
        session.user.name =
          typeof token.name === "string" ? token.name : session.user.name;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = ((user as { role?: Role }).role as Role | undefined) ?? Role.GUEST;
        if ("email" in user && typeof user.email === "string") {
          token.email = user.email;
        }
        if ("name" in user && typeof user.name === "string") {
          token.name = user.name;
        }
      }
      return token;
    },
  },
  providers: [
    CredentialsProvider({
      name: "Credenciais",
      credentials: {
        email: {
          label: "E-mail",
          type: "email",
        },
        password: {
          label: "Senha",
          type: "password",
        },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            passwordHash: true,
            isActive: true,
          },
        });

        if (!user?.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash,
        );

        if (!isValid || !user.isActive) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
    ...(googleProviderConfig
      ? [
          GoogleProvider({
            clientId: googleProviderConfig.clientId,
            clientSecret: googleProviderConfig.clientSecret,
            allowDangerousEmailAccountLinking: false,
          }),
        ]
      : []),
  ],
  secret: serverEnv.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};
