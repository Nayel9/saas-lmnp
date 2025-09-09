export function shouldShowLmnpBanner(params: {
  revenues: number;
  expenses: number;
  amort: number;
}): boolean {
  const { revenues, expenses, amort } = params;
  const ebe = (Number(revenues) || 0) - (Number(expenses) || 0);
  return (Number(amort) || 0) > ebe;
}

export function ackKey(propertyId: string, year: number) {
  return `lmnp_banner_ack:${propertyId}:${year}`;
}
