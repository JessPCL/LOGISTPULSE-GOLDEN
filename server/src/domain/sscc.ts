/** Genera un SSCC-18 válido a partir de 17 dígitos base. */
export function appendGs1CheckDigit(base17: string): string {
  if (!/^\d{17}$/.test(base17)) throw new Error("La base SSCC debe contener exactamente 17 dígitos.");
  const sum = [...base17]
    .reverse()
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
  return `${base17}${(10 - (sum % 10)) % 10}`;
}

export function buildSscc(sequence: number): string {
  const companyPrefixAndReference = `17861234${String(sequence).padStart(9, "0")}`.slice(0, 17);
  return appendGs1CheckDigit(companyPrefixAndReference);
}

export function isValidSscc(value: string): boolean {
  return /^\d{18}$/.test(value) && appendGs1CheckDigit(value.slice(0, 17)) === value;
}

