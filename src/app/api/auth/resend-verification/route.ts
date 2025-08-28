import {NextRequest} from 'next/server';
import {prisma} from '@/lib/prisma';
import {generateVerificationToken, sendVerificationEmail} from '@/lib/mailer/brevo';
import {storePlainVerificationToken} from '@/lib/auth/emailVerificationStore';
import { ensureRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    const limited = ensureRateLimit(req, 'resend-verification');
    if (limited) {
        return new Response(JSON.stringify({
            success: true,
            message: 'Si un compte existe, un email a été envoyé.'
        }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }

    let email: string | undefined;
    try {
        const body = await req.json();
        email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : undefined;
    } catch { /* ignore parse */ }

    if (!email) {
        return new Response(JSON.stringify({
            success: true,
            message: 'Si un compte existe, un email a été envoyé.'
        }), {status: 200, headers: {'Content-Type': 'application/json'}});
    }

    try {
        const user = await prisma.user.findUnique({where: {email}});
        if (user && !user.emailVerified) {
            await prisma.verificationToken.deleteMany({where: {identifier: email}});
            const {token, hash, expires} = generateVerificationToken();
            await prisma.verificationToken.create({data: {identifier: email, token: hash, expires}});
            storePlainVerificationToken(email, token);
            const verifyUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/verify?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
            await sendVerificationEmail({email, verifyUrl, firstName: user.firstName, lastName: user.lastName});
        }
    } catch (e) {
        console.error('[resend-verification][error]', e);
    }

    return new Response(JSON.stringify({
        success: true,
        message: 'Si un compte existe, un email a été envoyé.'
    }), {status: 200, headers: {'Content-Type': 'application/json'}});
}
