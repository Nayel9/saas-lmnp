import { describe, it, expect } from 'vitest';
import { guessAccountCode } from './guessAccountCode';

describe('guessAccountCode', () => {
  it('vente standard -> 7061', () => {
    expect(guessAccountCode({ type: 'vente', isDeposit: false, designation: 'Loyer juillet' }).code).toBe('7061');
  });
  it('vente caution -> 165', () => {
    expect(guessAccountCode({ type: 'vente', isDeposit: true, designation: 'Caution locataire' }).code).toBe('165');
  });
  it('achat assurance -> 616', () => {
    expect(guessAccountCode({ type: 'achat', isDeposit: false, designation: 'Prime assurance multirisque' }).code).toBe('616');
  });
  it('achat banque -> 627', () => {
    expect(guessAccountCode({ type: 'achat', isDeposit: false, designation: 'Frais bancaires stripe' }).code).toBe('627');
  });
  it('achat défaut -> 606', () => {
    expect(guessAccountCode({ type: 'achat', isDeposit: false, designation: 'Divers' }).code).toBe('606');
  });
});

