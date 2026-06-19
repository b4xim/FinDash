// ============================================================
// NextAuth catch-all route — handles /api/auth/signin, callback, etc.
// ============================================================

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
