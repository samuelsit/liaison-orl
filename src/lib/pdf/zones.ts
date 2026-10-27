/**
 * Zones imposées par Pingen pour une organisation française (fenêtre à droite, La Poste).
 * Coordonnées en mm depuis le coin haut gauche d'une page A4.
 * Source : Help Center Pingen « Layout requirements (French Organisations) », voir
 * docs/references/pingen-resend.md §9.2 ; marges et DMC précisés par le propriétaire du projet.
 */
export interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const PINGEN_ZONES = {
  /** Bord bloqué : rien d'imprimé à moins de 5 mm des bords, sur toutes les pages. */
  edge: 5,
  /**
   * Zone d'affranchissement / de sécurité La Poste (page 1) : seule l'adresse y est admise.
   * Hauteur retenue : 64 mm (documentation Pingen), plus stricte que les 58 mm du cahier des charges.
   */
  postage: { x: 90, y: 30, w: 115, h: 64 },
  /** Zone d'adresse du destinataire (page 1). */
  address: { x: 110, y: 50, w: 80, h: 28 },
  /** Marge intérieure du bloc adresse. */
  addressPadding: 2,
  /** Code DMC (Datamatrix) imprimé par Pingen en haut à droite de chaque page. */
  dmc: { x: 185, y: 5, w: 20, h: 20 },
  /** Zone DMC + 3 mm de garde : vide sur toutes les pages. */
  dmcGuard: { x: 182, y: 5, w: 23, h: 23 },
} as const satisfies Record<string, number | Zone>;

/** Zones bloquées des bords (toutes les pages). */
export function edgeZones(pageW = 210, pageH = 297): Zone[] {
  const e = PINGEN_ZONES.edge;
  return [
    { x: 0, y: 0, w: pageW, h: e },
    { x: 0, y: pageH - e, w: pageW, h: e },
    { x: 0, y: 0, w: e, h: pageH },
    { x: pageW - e, y: 0, w: e, h: pageH },
  ];
}

export function intersects(a: Zone, b: Zone, tolerance = 0): boolean {
  return (
    a.x < b.x + b.w - tolerance &&
    a.x + a.w > b.x + tolerance &&
    a.y < b.y + b.h - tolerance &&
    a.y + a.h > b.y + tolerance
  );
}

export function contains(outer: Zone, inner: Zone, tolerance = 0): boolean {
  return (
    inner.x >= outer.x - tolerance &&
    inner.y >= outer.y - tolerance &&
    inner.x + inner.w <= outer.x + outer.w + tolerance &&
    inner.y + inner.h <= outer.y + outer.h + tolerance
  );
}
