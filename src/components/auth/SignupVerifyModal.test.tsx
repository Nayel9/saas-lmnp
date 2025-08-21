import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import SignupVerifyModal from './SignupVerifyModal';

// Mock router + notifications
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));

describe('SignupVerifyModal', () => {
  const email = 'test@example.com';

  it('affiche email, loader, bouton renvoi', () => {
    render(<MantineProvider><SignupVerifyModal opened email={email} onClose={() => {}} /></MantineProvider>);
    expect(screen.getByText(/Vérifiez vos emails/)).toBeInTheDocument();
    expect(screen.getByText(email)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Renvoyer l'email/i })).toBeInTheDocument();
  });

  it('déclenche fetch et cooldown après clic renvoi', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ success: true }) } as unknown as Response);
    render(<MantineProvider><SignupVerifyModal opened email={email} onClose={() => {}} enablePolling={false} /></MantineProvider>);
    const btn = screen.getAllByTestId('resend-btn')[0];
    btn.click();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(btn).toBeDisabled();
    fetchMock.mockRestore();
  });
});
