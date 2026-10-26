/**
 * Données de démonstration ENTIÈREMENT FICTIVES (patients, prescripteurs, numéros RPPS,
 * e-mails en .test). Les numéros de téléphone utilisent les plages réservées à la fiction.
 */
import type { PrescriberCivility } from "@/lib/schemas/common";

export interface SeedCentre {
  key: string;
  name: string;
  line1: string;
  postalCode: string;
  city: string;
  phone: string;
  region: "idf" | "normandie";
}

export const CENTRES: SeedCentre[] = [
  { key: "pierrefitte", name: "Pierrefitte-sur-Seine", line1: "129 boulevard Jean Mermoz", postalCode: "93380", city: "Pierrefitte-sur-Seine", phone: "01 80 89 34 53", region: "idf" },
  { key: "saint-denis", name: "Saint-Denis", line1: "18 rue de la République", postalCode: "93200", city: "Saint-Denis", phone: "01 99 00 12 01", region: "idf" },
  { key: "sarcelles", name: "Sarcelles", line1: "4 avenue Paul Valéry", postalCode: "95200", city: "Sarcelles", phone: "01 99 00 12 02", region: "idf" },
  { key: "enghien", name: "Enghien-les-Bains", line1: "37 rue du Général de Gaulle", postalCode: "95880", city: "Enghien-les-Bains", phone: "01 99 00 12 03", region: "idf" },
  { key: "montmorency", name: "Montmorency", line1: "2 place Roger Levanneur", postalCode: "95160", city: "Montmorency", phone: "01 99 00 12 04", region: "idf" },
  { key: "saint-ouen", name: "Saint-Ouen-sur-Seine", line1: "61 avenue Gabriel Péri", postalCode: "93400", city: "Saint-Ouen-sur-Seine", phone: "01 99 00 12 05", region: "idf" },
  { key: "aubervilliers", name: "Aubervilliers", line1: "12 rue du Moutier", postalCode: "93300", city: "Aubervilliers", phone: "01 99 00 12 06", region: "idf" },
  { key: "rouen", name: "Rouen", line1: "45 rue Jeanne d'Arc", postalCode: "76000", city: "Rouen", phone: "02 61 91 20 01", region: "normandie" },
  { key: "le-havre", name: "Le Havre", line1: "120 avenue René Coty", postalCode: "76600", city: "Le Havre", phone: "02 61 91 20 02", region: "normandie" },
  { key: "caen", name: "Caen", line1: "8 rue Saint-Pierre", postalCode: "14000", city: "Caen", phone: "02 61 91 20 03", region: "normandie" },
  { key: "evreux", name: "Évreux", line1: "22 rue Chartraine", postalCode: "27000", city: "Évreux", phone: "02 61 91 20 04", region: "normandie" },
];

export interface SeedUser {
  email: string;
  firstName: string;
  lastName: string;
  title: string;
  role: "admin" | "audioprothesiste" | "assistant";
  centres: string[] | "all";
  canSend?: boolean;
  signature?: boolean;
}

export const USERS: SeedUser[] = [
  { email: "direction@demo.test", firstName: "Sophie", lastName: "Laurent", title: "Directrice des centres", role: "admin", centres: "all" },
  { email: "claire.morel@demo.test", firstName: "Claire", lastName: "Morel", title: "Audioprothésiste D.E", role: "audioprothesiste", centres: ["pierrefitte", "saint-denis", "sarcelles"], signature: true },
  { email: "karim.haddad@demo.test", firstName: "Karim", lastName: "Haddad", title: "Audioprothésiste D.E", role: "audioprothesiste", centres: ["enghien", "montmorency", "saint-ouen", "aubervilliers"], signature: true },
  { email: "julien.bernard@demo.test", firstName: "Julien", lastName: "Bernard", title: "Audioprothésiste D.E", role: "audioprothesiste", centres: ["rouen", "le-havre", "caen", "evreux"], signature: true },
  { email: "lea.petit@demo.test", firstName: "Léa", lastName: "Petit", title: "Assistante", role: "assistant", centres: ["pierrefitte", "saint-denis"] },
  { email: "nadia.roux@demo.test", firstName: "Nadia", lastName: "Roux", title: "Assistante", role: "assistant", centres: ["rouen", "le-havre"], canSend: true },
];

export interface SeedPrescriber {
  civility: PrescriberCivility;
  firstName: string;
  lastName: string;
  specialty: string;
  practiceName: string;
  line1: string;
  line2?: string;
  postalCode: string;
  city: string;
  email: string;
  phone: string;
  channel: "email" | "courrier" | "both";
  salutation: string;
  centres: string[];
  favoriteOf?: string[];
}

export const PRESCRIBERS: SeedPrescriber[] = [
  { civility: "Dr", firstName: "Antoine", lastName: "Lefèvre", specialty: "ORL", practiceName: "Cabinet ORL de la Basilique", line1: "5 rue Gabriel Péri", postalCode: "93200", city: "Saint-Denis", email: "a.lefevre@cabinet-orl.test", phone: "01 99 00 31 01", channel: "email", salutation: "Cher Confrère", centres: ["saint-denis", "pierrefitte"], favoriteOf: ["claire.morel@demo.test"] },
  { civility: "Dr", firstName: "Hélène", lastName: "Garnier", specialty: "ORL", practiceName: "Centre ORL Pierrefitte", line1: "22 avenue Lénine", postalCode: "93380", city: "Pierrefitte-sur-Seine", email: "h.garnier@orl-pierrefitte.test", phone: "01 99 00 31 02", channel: "both", salutation: "Chère Consœur", centres: ["pierrefitte"], favoriteOf: ["claire.morel@demo.test", "lea.petit@demo.test"] },
  { civility: "Dr", firstName: "Marc", lastName: "Dubois", specialty: "ORL", practiceName: "Clinique de l'Estrée", line1: "35 rue d'Amiens", line2: "Service ORL — 2e étage", postalCode: "93240", city: "Stains", email: "", phone: "01 99 00 31 03", channel: "courrier", salutation: "Cher Docteur", centres: ["pierrefitte", "saint-denis"], favoriteOf: ["claire.morel@demo.test"] },
  { civility: "Pr", firstName: "Isabelle", lastName: "Fontaine", specialty: "ORL", practiceName: "Hôpital Delafontaine — Service ORL", line1: "2 rue du Docteur Delafontaine", postalCode: "93200", city: "Saint-Denis", email: "secretariat.orl@ch-delafontaine.test", phone: "01 99 00 31 04", channel: "email", salutation: "Chère Professeure", centres: ["saint-denis"] },
  { civility: "Dr", firstName: "Philippe", lastName: "Mercier", specialty: "ORL", practiceName: "Cabinet ORL Sarcelles Village", line1: "14 rue Pierre Brossolette", postalCode: "95200", city: "Sarcelles", email: "p.mercier@orl-sarcelles.test", phone: "01 99 00 31 05", channel: "email", salutation: "Cher Confrère", centres: ["sarcelles"], favoriteOf: ["claire.morel@demo.test"] },
  { civility: "Dr", firstName: "Nathalie", lastName: "Roussel", specialty: "ORL", practiceName: "Cabinet du Lac", line1: "8 boulevard Cotte", postalCode: "95880", city: "Enghien-les-Bains", email: "n.roussel@cabinet-dulac.test", phone: "01 99 00 31 06", channel: "both", salutation: "Chère Docteure", centres: ["enghien", "montmorency"], favoriteOf: ["karim.haddad@demo.test"] },
  { civility: "Dr", firstName: "Olivier", lastName: "Chevalier", specialty: "ORL", practiceName: "Cabinet ORL Montmorency", line1: "3 rue de Pontoise", postalCode: "95160", city: "Montmorency", email: "o.chevalier@orl-montmorency.test", phone: "01 99 00 31 07", channel: "email", salutation: "Cher Confrère", centres: ["montmorency"] },
  { civility: "Dr", firstName: "Sarah", lastName: "Benali", specialty: "ORL", practiceName: "Pôle Santé des Docks", line1: "27 rue des Bateliers", postalCode: "93400", city: "Saint-Ouen-sur-Seine", email: "s.benali@pole-docks.test", phone: "01 99 00 31 08", channel: "email", salutation: "Chère Consœur", centres: ["saint-ouen"], favoriteOf: ["karim.haddad@demo.test"] },
  { civility: "Dr", firstName: "François", lastName: "Lambert", specialty: "ORL", practiceName: "Cabinet ORL Aubervilliers", line1: "41 avenue Jean Jaurès", postalCode: "93300", city: "Aubervilliers", email: "f.lambert@orl-auber.test", phone: "01 99 00 31 09", channel: "courrier", salutation: "Cher Docteur", centres: ["aubervilliers"] },
  { civility: "Dr", firstName: "Camille", lastName: "Girard", specialty: "ORL", practiceName: "Centre médical de la Plaine", line1: "10 avenue du Stade de France", postalCode: "93210", city: "Saint-Denis", email: "c.girard@cm-plaine.test", phone: "01 99 00 31 10", channel: "email", salutation: "Chère Docteure", centres: ["saint-denis", "saint-ouen"] },
  { civility: "Dr", firstName: "Thomas", lastName: "Renaud", specialty: "ORL", practiceName: "Cabinet ORL d'Épinay", line1: "6 rue de Paris", postalCode: "93800", city: "Épinay-sur-Seine", email: "t.renaud@orl-epinay.test", phone: "01 99 00 31 11", channel: "email", salutation: "Cher Confrère", centres: ["pierrefitte", "enghien"] },
  { civility: "Dr", firstName: "Valérie", lastName: "Blanc", specialty: "Médecin généraliste", practiceName: "Maison de santé Jean Mermoz", line1: "140 boulevard Jean Mermoz", postalCode: "93380", city: "Pierrefitte-sur-Seine", email: "v.blanc@msp-mermoz.test", phone: "01 99 00 31 12", channel: "email", salutation: "Chère Consœur", centres: ["pierrefitte"] },
  { civility: "Dr", firstName: "Laurent", lastName: "Masson", specialty: "Médecin généraliste", practiceName: "Cabinet médical du Centre", line1: "9 place de la Gare", postalCode: "95200", city: "Sarcelles", email: "", phone: "01 99 00 31 13", channel: "courrier", salutation: "Cher Docteur", centres: ["sarcelles"] },
  { civility: "Dr", firstName: "Émilie", lastName: "Faure", specialty: "ORL", practiceName: "Clinique ORL du Parc", line1: "52 avenue de la Division Leclerc", postalCode: "95170", city: "Deuil-la-Barre", email: "e.faure@clinique-parc.test", phone: "01 99 00 31 14", channel: "both", salutation: "Chère Docteure", centres: ["montmorency", "enghien"] },
  { civility: "Dr", firstName: "Bruno", lastName: "Leroy", specialty: "Gériatre", practiceName: "EHPAD Les Tilleuls", line1: "15 rue des Tilleuls", postalCode: "93300", city: "Aubervilliers", email: "b.leroy@ehpad-tilleuls.test", phone: "01 99 00 31 15", channel: "email", salutation: "Cher Docteur", centres: ["aubervilliers"] },
  { civility: "Dr", firstName: "Pierre", lastName: "Lemoine", specialty: "ORL", practiceName: "Cabinet ORL Jeanne d'Arc", line1: "88 rue Jeanne d'Arc", postalCode: "76000", city: "Rouen", email: "p.lemoine@orl-rouen.test", phone: "02 61 91 41 01", channel: "email", salutation: "Cher Confrère", centres: ["rouen"], favoriteOf: ["julien.bernard@demo.test", "nadia.roux@demo.test"] },
  { civility: "Pr", firstName: "Anne", lastName: "Marchand", specialty: "ORL", practiceName: "CHU de Rouen — Service ORL", line1: "1 rue de Germont", postalCode: "76000", city: "Rouen", email: "orl.secretariat@chu-rouen.test", phone: "02 61 91 41 02", channel: "both", salutation: "Chère Professeure", centres: ["rouen", "evreux"], favoriteOf: ["julien.bernard@demo.test"] },
  { civility: "Dr", firstName: "Guillaume", lastName: "Perrin", specialty: "ORL", practiceName: "Cabinet ORL de la Rive Gauche", line1: "17 avenue de Bretagne", postalCode: "76100", city: "Rouen", email: "g.perrin@orl-rivegauche.test", phone: "02 61 91 41 03", channel: "email", salutation: "Cher Confrère", centres: ["rouen"] },
  { civility: "Dr", firstName: "Juliette", lastName: "Morin", specialty: "ORL", practiceName: "Centre ORL Océane", line1: "64 rue de Paris", postalCode: "76600", city: "Le Havre", email: "j.morin@orl-oceane.test", phone: "02 61 91 41 04", channel: "email", salutation: "Chère Consœur", centres: ["le-havre"], favoriteOf: ["julien.bernard@demo.test"] },
  { civility: "Dr", firstName: "Nicolas", lastName: "Gauthier", specialty: "ORL", practiceName: "Groupe Hospitalier du Havre — ORL", line1: "29 avenue Pierre Mendès France", postalCode: "76290", city: "Montivilliers", email: "", phone: "02 61 91 41 05", channel: "courrier", salutation: "Cher Docteur", centres: ["le-havre"] },
  { civility: "Dr", firstName: "Aurélie", lastName: "Dumont", specialty: "ORL", practiceName: "Cabinet ORL Saint-Pierre", line1: "3 rue Écuyère", postalCode: "14000", city: "Caen", email: "a.dumont@orl-caen.test", phone: "02 61 91 41 06", channel: "email", salutation: "Chère Docteure", centres: ["caen"] },
  { civility: "Pr", firstName: "Jean-Michel", lastName: "Robert", specialty: "ORL", practiceName: "CHU de Caen — Service ORL", line1: "Avenue de la Côte de Nacre", postalCode: "14000", city: "Caen", email: "orl@chu-caen.test", phone: "02 61 91 41 07", channel: "both", salutation: "Cher Professeur", centres: ["caen"] },
  { civility: "Dr", firstName: "Stéphanie", lastName: "Noël", specialty: "ORL", practiceName: "Cabinet ORL de l'Iton", line1: "11 rue Joséphine", postalCode: "27000", city: "Évreux", email: "s.noel@orl-iton.test", phone: "02 61 91 41 08", channel: "email", salutation: "Chère Consœur", centres: ["evreux"] },
  { civility: "Dr", firstName: "Christophe", lastName: "Fournier", specialty: "Médecin généraliste", practiceName: "Maison médicale du Vieux-Marché", line1: "7 place du Vieux-Marché", postalCode: "76000", city: "Rouen", email: "c.fournier@mm-vieuxmarche.test", phone: "02 61 91 41 09", channel: "email", salutation: "Cher Confrère", centres: ["rouen"] },
  { civility: "Dr", firstName: "Delphine", lastName: "Carpentier", specialty: "ORL", practiceName: "Clinique Mathilde", line1: "7 boulevard de l'Europe", postalCode: "76100", city: "Rouen", email: "d.carpentier@clinique-mathilde.test", phone: "02 61 91 41 10", channel: "email", salutation: "Chère Docteure", centres: ["rouen", "le-havre"] },
  { civility: "Dr", firstName: "Mathieu", lastName: "Rolland", specialty: "ORL", practiceName: "Cabinet ORL des Quais", line1: "45 quai George V", postalCode: "76600", city: "Le Havre", email: "m.rolland@orl-quais.test", phone: "02 61 91 41 11", channel: "email", salutation: "Cher Confrère", centres: ["le-havre"] },
  { civility: "Dr", firstName: "Karine", lastName: "Lucas", specialty: "Pédiatre", practiceName: "Cabinet de pédiatrie Saint-Jean", line1: "19 rue Saint-Jean", postalCode: "14000", city: "Caen", email: "k.lucas@pedia-stjean.test", phone: "02 61 91 41 12", channel: "email", salutation: "Chère Docteure", centres: ["caen"] },
  { civility: "Dr", firstName: "Patrick", lastName: "Henry", specialty: "Neurologue", practiceName: "Centre de neurologie de la Seine", line1: "30 rue du Gros-Horloge", postalCode: "76000", city: "Rouen", email: "p.henry@neuro-seine.test", phone: "02 61 91 41 13", channel: "courrier", salutation: "Cher Docteur", centres: ["rouen"] },
  { civility: "Dr", firstName: "Sylvie", lastName: "Brunet", specialty: "ORL", practiceName: "Cabinet ORL Navarre", line1: "2 rue de Navarre", postalCode: "27000", city: "Évreux", email: "s.brunet@orl-navarre.test", phone: "02 61 91 41 14", channel: "both", salutation: "Chère Docteure", centres: ["evreux"] },
  { civility: "Dr", firstName: "Yann", lastName: "Le Gall", specialty: "ORL", practiceName: "Cabinet ORL Garibaldi", line1: "16 rue Garibaldi", postalCode: "93400", city: "Saint-Ouen-sur-Seine", email: "y.legall@rejet.test", phone: "01 99 00 31 16", channel: "email", salutation: "Cher Confrère", centres: ["saint-ouen", "aubervilliers"] },
];

export interface SeedPatient {
  civility: "Mme" | "M.";
  firstName: string;
  lastName: string;
  birthDate: string;
  centre: string;
  prescriberIndex: number;
}

export const PATIENTS: SeedPatient[] = [
  { civility: "Mme", firstName: "Jeanne", lastName: "Durand", birthDate: "1946-03-12", centre: "pierrefitte", prescriberIndex: 1 },
  { civility: "M.", firstName: "Robert", lastName: "Martin", birthDate: "1941-11-02", centre: "pierrefitte", prescriberIndex: 0 },
  { civility: "Mme", firstName: "Monique", lastName: "Lefort", birthDate: "1950-07-25", centre: "pierrefitte", prescriberIndex: 2 },
  { civility: "M.", firstName: "Gérard", lastName: "Petitjean", birthDate: "1938-01-30", centre: "saint-denis", prescriberIndex: 3 },
  { civility: "Mme", firstName: "Fatima", lastName: "Belkacem", birthDate: "1955-05-18", centre: "saint-denis", prescriberIndex: 0 },
  { civility: "M.", firstName: "André", lastName: "Moreau", birthDate: "1944-09-09", centre: "sarcelles", prescriberIndex: 4 },
  { civility: "Mme", firstName: "Colette", lastName: "Vasseur", birthDate: "1949-12-01", centre: "sarcelles", prescriberIndex: 12 },
  { civility: "M.", firstName: "Bernard", lastName: "Simon", birthDate: "1947-04-14", centre: "enghien", prescriberIndex: 5 },
  { civility: "Mme", firstName: "Odette", lastName: "Leclerc", birthDate: "1936-06-21", centre: "montmorency", prescriberIndex: 6 },
  { civility: "M.", firstName: "Mohamed", lastName: "Amrani", birthDate: "1958-02-03", centre: "saint-ouen", prescriberIndex: 7 },
  { civility: "Mme", firstName: "Lucienne", lastName: "Barbier", birthDate: "1942-10-17", centre: "aubervilliers", prescriberIndex: 8 },
  { civility: "M.", firstName: "Jacques", lastName: "Hubert", birthDate: "1945-08-28", centre: "rouen", prescriberIndex: 15 },
  { civility: "Mme", firstName: "Simone", lastName: "Guérin", birthDate: "1939-03-05", centre: "rouen", prescriberIndex: 16 },
  { civility: "M.", firstName: "Daniel", lastName: "Royer", birthDate: "1952-11-11", centre: "rouen", prescriberIndex: 17 },
  { civility: "Mme", firstName: "Yvette", lastName: "Leblanc", birthDate: "1948-01-19", centre: "le-havre", prescriberIndex: 18 },
  { civility: "M.", firstName: "Michel", lastName: "Caron", birthDate: "1943-07-07", centre: "le-havre", prescriberIndex: 19 },
  { civility: "Mme", firstName: "Paulette", lastName: "Joly", birthDate: "1951-09-23", centre: "caen", prescriberIndex: 20 },
  { civility: "M.", firstName: "Alain", lastName: "Gaillard", birthDate: "1940-05-02", centre: "caen", prescriberIndex: 21 },
  { civility: "Mme", firstName: "Denise", lastName: "Picard", birthDate: "1953-02-27", centre: "evreux", prescriberIndex: 22 },
  { civility: "M.", firstName: "René", lastName: "Aubert", birthDate: "1937-12-15", centre: "saint-ouen", prescriberIndex: 29 },
];
