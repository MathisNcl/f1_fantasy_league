import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Calendrier F1 2026 officiel — 24 Grands Prix, 6 weekends Sprint
// Toutes les heures sont en UTC (converties depuis l'heure française CET/CEST).
// CET = UTC+1  (jan–mars 29, oct 25–déc)
// CEST = UTC+2 (mars 30–oct 25)
// deadline = heure de début des Qualifs (ou Qualifs Sprint pour les weekends sprint)
const RACES_2026 = [
  {
    round: 1,
    name: "Grand Prix d'Australie",
    location: "Melbourne",
    date:     new Date("2026-03-08T04:00:00Z"), // Course     : 08 mars 05:00 CET
    deadline: new Date("2026-03-07T05:00:00Z"), // Qualifs    : 07 mars 06:00 CET
    season: 2026,
    hasSprint: false,
  },
  {
    round: 2,
    name: "Grand Prix de Chine",
    location: "Shanghai",
    date:     new Date("2026-03-15T07:00:00Z"), // Course     : 15 mars 08:00 CET
    deadline: new Date("2026-03-13T07:30:00Z"), // Qualifs S  : 13 mars 08:30 CET
    season: 2026,
    hasSprint: true,
  },
  {
    round: 3,
    name: "Grand Prix du Japon",
    location: "Suzuka",
    date:     new Date("2026-03-29T05:00:00Z"), // Course     : 29 mars 07:00 CEST
    deadline: new Date("2026-03-28T06:00:00Z"), // Qualifs    : 28 mars 07:00 CET
    season: 2026,
    hasSprint: false,
  },
  {
    round: 4,
    name: "Grand Prix de Bahreïn",
    location: "Sakhir",
    date:     new Date("2026-04-12T15:00:00Z"), // Course     : 12 avr 17:00 CEST
    deadline: new Date("2026-04-11T16:00:00Z"), // Qualifs    : 11 avr 18:00 CEST
    season: 2026,
    hasSprint: false,
  },
  {
    round: 5,
    name: "Grand Prix d'Arabie Saoudite",
    location: "Jeddah",
    date:     new Date("2026-04-19T17:00:00Z"), // Course     : 19 avr 19:00 CEST
    deadline: new Date("2026-04-18T17:00:00Z"), // Qualifs    : 18 avr 19:00 CEST
    season: 2026,
    hasSprint: false,
  },
  {
    round: 6,
    name: "Grand Prix de Miami",
    location: "Miami",
    date:     new Date("2026-05-03T20:00:00Z"), // Course     : 03 mai 22:00 CEST
    deadline: new Date("2026-05-01T20:30:00Z"), // Qualifs S  : 01 mai 22:30 CEST
    season: 2026,
    hasSprint: true,
  },
  {
    round: 7,
    name: "Grand Prix du Canada",
    location: "Montréal",
    date:     new Date("2026-05-24T20:00:00Z"), // Course     : 24 mai 22:00 CEST
    deadline: new Date("2026-05-22T20:30:00Z"), // Qualifs S  : 22 mai 22:30 CEST
    season: 2026,
    hasSprint: true,
  },
  {
    round: 8,
    name: "Grand Prix de Monaco",
    location: "Monaco",
    date:     new Date("2026-06-07T13:00:00Z"), // Course     : 07 juin 15:00 CEST
    deadline: new Date("2026-06-06T14:00:00Z"), // Qualifs    : 06 juin 16:00 CEST
    season: 2026,
    hasSprint: false,
  },
  {
    round: 9,
    name: "Grand Prix de Barcelone-Catalogne",
    location: "Barcelone",
    date:     new Date("2026-06-14T13:00:00Z"), // Course     : 14 juin 15:00 CEST
    deadline: new Date("2026-06-13T14:00:00Z"), // Qualifs    : 13 juin 16:00 CEST
    season: 2026,
    hasSprint: false,
  },
  {
    round: 10,
    name: "Grand Prix d'Autriche",
    location: "Spielberg",
    date:     new Date("2026-06-28T13:00:00Z"), // Course     : 28 juin 15:00 CEST
    deadline: new Date("2026-06-27T14:00:00Z"), // Qualifs    : 27 juin 16:00 CEST
    season: 2026,
    hasSprint: false,
  },
  {
    round: 11,
    name: "Grand Prix de Grande-Bretagne",
    location: "Silverstone",
    date:     new Date("2026-07-05T14:00:00Z"), // Course     : 05 juil 16:00 CEST
    deadline: new Date("2026-07-03T15:30:00Z"), // Qualifs S  : 03 juil 17:30 CEST
    season: 2026,
    hasSprint: true,
  },
  {
    round: 12,
    name: "Grand Prix de Belgique",
    location: "Spa-Francorchamps",
    date:     new Date("2026-07-19T13:00:00Z"), // Course     : 19 juil 15:00 CEST
    deadline: new Date("2026-07-18T14:00:00Z"), // Qualifs    : 18 juil 16:00 CEST
    season: 2026,
    hasSprint: false,
  },
  {
    round: 13,
    name: "Grand Prix de Hongrie",
    location: "Budapest",
    date:     new Date("2026-07-26T13:00:00Z"), // Course     : 26 juil 15:00 CEST
    deadline: new Date("2026-07-25T14:00:00Z"), // Qualifs    : 25 juil 16:00 CEST
    season: 2026,
    hasSprint: false,
  },
  {
    round: 14,
    name: "Grand Prix des Pays-Bas",
    location: "Zandvoort",
    date:     new Date("2026-08-23T13:00:00Z"), // Course     : 23 août 15:00 CEST
    deadline: new Date("2026-08-21T14:30:00Z"), // Qualifs S  : 21 août 16:30 CEST
    season: 2026,
    hasSprint: true,
  },
  {
    round: 15,
    name: "Grand Prix d'Italie",
    location: "Monza",
    date:     new Date("2026-09-06T13:00:00Z"), // Course     : 06 sept 15:00 CEST
    deadline: new Date("2026-09-05T14:00:00Z"), // Qualifs    : 05 sept 16:00 CEST
    season: 2026,
    hasSprint: false,
  },
  {
    round: 16,
    name: "Grand Prix d'Espagne",
    location: "Madrid",
    date:     new Date("2026-09-13T13:00:00Z"), // Course     : 13 sept 15:00 CEST
    deadline: new Date("2026-09-12T14:00:00Z"), // Qualifs    : 12 sept 16:00 CEST
    season: 2026,
    hasSprint: false,
  },
  {
    round: 17,
    name: "Grand Prix d'Azerbaïdjan",
    location: "Bakou",
    date:     new Date("2026-09-26T11:00:00Z"), // Course     : 26 sept 13:00 CEST
    deadline: new Date("2026-09-25T12:00:00Z"), // Qualifs    : 25 sept 14:00 CEST
    season: 2026,
    hasSprint: false,
  },
  {
    round: 18,
    name: "Grand Prix de Singapour",
    location: "Marina Bay",
    date:     new Date("2026-10-11T12:00:00Z"), // Course     : 11 oct 14:00 CEST
    deadline: new Date("2026-10-09T12:30:00Z"), // Qualifs S  : 09 oct 14:30 CEST
    season: 2026,
    hasSprint: true,
  },
  {
    round: 19,
    name: "Grand Prix des États-Unis",
    location: "Austin",
    date:     new Date("2026-10-25T20:00:00Z"), // Course     : 25 oct 21:00 CET  (après changement d'heure)
    deadline: new Date("2026-10-24T21:00:00Z"), // Qualifs    : 24 oct 23:00 CEST (avant changement d'heure)
    season: 2026,
    hasSprint: false,
  },
  {
    round: 20,
    name: "Grand Prix du Mexique",
    location: "Mexico City",
    date:     new Date("2026-11-01T20:00:00Z"), // Course     : 01 nov 21:00 CET
    deadline: new Date("2026-10-31T21:00:00Z"), // Qualifs    : 31 oct 22:00 CET
    season: 2026,
    hasSprint: false,
  },
  {
    round: 21,
    name: "Grand Prix de São Paulo",
    location: "São Paulo",
    date:     new Date("2026-11-08T17:00:00Z"), // Course     : 08 nov 18:00 CET
    deadline: new Date("2026-11-07T18:00:00Z"), // Qualifs    : 07 nov 19:00 CET
    season: 2026,
    hasSprint: false,
  },
  {
    round: 22,
    name: "Grand Prix de Las Vegas",
    location: "Las Vegas",
    date:     new Date("2026-11-22T04:00:00Z"), // Course     : 22 nov 05:00 CET
    deadline: new Date("2026-11-21T04:00:00Z"), // Qualifs    : 21 nov 05:00 CET
    season: 2026,
    hasSprint: false,
  },
  {
    round: 23,
    name: "Grand Prix du Qatar",
    location: "Lusail",
    date:     new Date("2026-11-29T16:00:00Z"), // Course     : 29 nov 17:00 CET
    deadline: new Date("2026-11-28T18:00:00Z"), // Qualifs    : 28 nov 19:00 CET
    season: 2026,
    hasSprint: false,
  },
  {
    round: 24,
    name: "Grand Prix d'Abu Dhabi",
    location: "Yas Marina",
    date:     new Date("2026-12-06T13:00:00Z"), // Course     : 06 déc 14:00 CET
    deadline: new Date("2026-12-05T14:00:00Z"), // Qualifs    : 05 déc 15:00 CET
    season: 2026,
    hasSprint: false,
  },
];

async function main() {
  console.log("Seeding database — Saison 2026...");

  // Compte admin par défaut
  const rawPassword = process.env.ADMIN_PASSWORD;
  if (!rawPassword) throw new Error("Variable d'environnement ADMIN_PASSWORD manquante");
  const adminPassword = await bcrypt.hash(rawPassword, 12);
  const admin = await prisma.user.upsert({
    where: { email: "mathis.nicoli@gmail.com" },
    update: { password: adminPassword },
    create: {
      name: "Mathos le boss",
      email: "mathis.nicoli@gmail.com",
      password: adminPassword,
      role: "ADMIN",
    },
  });
  console.log(`Admin : ${admin.email}`);

  // GPs 2026
  for (const race of RACES_2026) {
    await prisma.race.upsert({
      where: { round_season: { round: race.round, season: race.season } },
      update: {
        name: race.name,
        location: race.location,
        date: race.date,
        deadline: race.deadline,
        hasSprint: race.hasSprint,
      },
      create: race,
    });
  }

  const sprintRaces = RACES_2026.filter((r) => r.hasSprint);
  console.log(`\n${RACES_2026.length} GPs insérés dont ${sprintRaces.length} weekends Sprint :`);
  sprintRaces.forEach((r) => console.log(`  - R${r.round} ${r.name} (${r.location})`));

  console.log("\nSeed terminé !");
  console.log("  Login : admin@f1fantasy.local");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
