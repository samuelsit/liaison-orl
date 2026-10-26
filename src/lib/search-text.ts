import { normalizeSearch } from "./text";

export function prescriberSearchText(p: {
  civility: string;
  firstName: string;
  lastName: string;
  practiceName: string;
  specialty: string;
  email: string;
  address: { city: string; postalCode: string };
}): string {
  return normalizeSearch([p.lastName, p.firstName, p.practiceName, p.specialty, p.address.city, p.address.postalCode, p.email].join(" "));
}

export function patientSearchText(p: { firstName: string; lastName: string; birthDate: string }): string {
  const birth = p.birthDate ? p.birthDate.split("-").reverse().join("/") : "";
  return normalizeSearch([p.lastName, p.firstName, birth, p.birthDate].join(" "));
}
