import { prisma } from "@/lib/prisma";

type VerifiableUser = {
  id: string;
  verificationToken: string | null;
  isEmailVerified: boolean;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return new Response("Verification token is required", { status: 400 });
  }

  const user = await (prisma.user as any).findFirst({
    where: { verificationToken: token },
  }) as VerifiableUser | null;

  if (!user) {
    return new Response("Invalid or expired verification token", { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      isEmailVerified: true,
      verificationToken: null,
    },
  });

  return new Response("Email verified successfully. You can now log in.", { status: 200 });
}
