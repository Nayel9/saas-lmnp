import {NextRequest} from 'next/server';
import {prisma} from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import {z} from 'zod';
import {generateVerificationToken, sendVerificationEmail} from '@/lib/mailer/brevo';
import {storePlainVerificationToken} from '@/lib/auth/emailVerificationStore';
import {normalizePhone} from '@/lib/phone';

export const runtime = 'nodejs';

const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    firstName: z.string().min(1).max(50),
    lastName: z.string().min(1).max(60),
    phone: z.string().trim().min(5).max(30).regex(/^[+0-9 ()-]*$/, {message: 'Format téléphone invalide'})
}).transform(d => ({...d, phone: d.phone ? d.phone : null}));

// Rate limit simple en mémoire: 1 création / 30s / IP
const SIGNUP_WINDOW_MS = 30_000;
const signupRL = new Map<string, number>();

export async function POST(req: NextRequest) {
    try {
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'ip';
        const now = Date.now();
        const last = signupRL.get(ip);
        if (last && (now - last) < SIGNUP_WINDOW_MS) {
            return new Response('Trop de tentatives, réessayez plus tard', {status: 429});
        }
        const body = await req.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) return new Response('Validation', {status: 400});
        const {email, password, firstName, lastName} = parsed.data;
        let {phone} = parsed.data;
        phone = normalizePhone(phone);
        if(!phone) return new Response('Validation', {status: 400});
        const existing = await prisma.user.findUnique({where: {email}});
        if (existing) return new Response('Existe déjà', {status: 409});
        const hash = await bcrypt.hash(password, 10);
        await prisma.user.create({
            data: {
                email,
                password: hash,
                role: 'user',
                emailVerified: null,
                firstName,
                lastName,
                phone
            }
        });
        signupRL.set(ip, now);
        // Invalidation anciens tokens (sécurité ré-inscription rare race)
        await prisma.verificationToken.deleteMany({where: {identifier: email}}).catch(() => {
        });
        const {token, hash: tokenHash, expires} = generateVerificationToken();
        await prisma.verificationToken.create({data: {identifier: email, token: tokenHash, expires}});
        storePlainVerificationToken(email, token);
        const verifyUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/verify?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
        await sendVerificationEmail({email, verifyUrl, firstName, lastName});
        return new Response(JSON.stringify({
            success: true,
            message: 'Vérifiez votre email pour activer votre compte'
        }), {status: 201, headers: {'Content-Type': 'application/json'}});
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown';
        console.error('[signup][error]', e);
        return new Response('Erreur:' + msg, {status: 500});
    }
}
