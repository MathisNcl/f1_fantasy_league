import { STRATEGIES } from "@/lib/constants";

const STRATEGY_BADGE_COLORS: Record<string, string> = {
  red: "bg-red-900 text-red-300 border border-red-700",
  yellow: "bg-yellow-900 text-yellow-300 border border-yellow-700",
  gray: "bg-gray-800 text-gray-300 border border-gray-600",
  white: "bg-gray-700 text-white border border-gray-500",
  orange: "bg-orange-900 text-orange-300 border border-orange-700",
  blue: "bg-blue-900 text-blue-300 border border-blue-700",
  purple: "bg-purple-900 text-purple-300 border border-purple-700",
  green: "bg-green-900 text-green-300 border border-green-700",
  cyan: "bg-cyan-900 text-cyan-300 border border-cyan-700",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-gray-800 last:border-0">
      <div className="flex-1 min-w-0">
        <span className="text-gray-300 text-sm">{label}</span>
        {sub && <p className="text-gray-500 text-xs mt-0.5 break-words">{sub}</p>}
      </div>
      <span className="text-white font-bold text-sm whitespace-nowrap shrink-0">{value}</span>
    </div>
  );
}

export default function ReglesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Règles du jeu</h1>
        <p className="text-gray-400 mt-1">
          Saison 2026 — Picks soumis avant le début de chaque qualif
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Picks */}
        <Section title="Picks par week-end">
          <ul className="space-y-2 text-sm text-gray-300">
            <li className="flex gap-2">
              <span className="text-red-400 font-bold shrink-0">•</span>
              <span>Choisis <strong className="text-white">2 pilotes</strong> et <strong className="text-white">1 écurie</strong> chaque week-end</span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-400 font-bold shrink-0">•</span>
              <span>Chaque pilote a une <strong className="text-white">énergie</strong> (0–100%) qui multiplie ses points positifs</span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-400 font-bold shrink-0">•</span>
              <span>Choisis aussi <strong className="text-white">1 stratégie</strong> parmi les options disponibles</span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-400 font-bold shrink-0">•</span>
              <span>Deadline : <strong className="text-white">fin des Essais Libres 3</strong> (vendredi soir / samedi matin)</span>
            </li>
            <li className="flex gap-2 bg-purple-950 border border-purple-800 rounded-lg px-3 py-2">
              <span className="text-purple-400 font-bold shrink-0">•</span>
              <span>Week-end Sprint : qualifications sprint + course sprint inclus dans le score (en plus de la course principale)</span>
            </li>
          </ul>
        </Section>

        {/* Qualifications */}
        <Section title="Points — Qualifications principales">
          <p className="text-gray-500 text-xs mb-3">Par pilote choisi</p>
          <Row label="Pole Position (P1)" value="+12 pts" />
          <Row label="P2" value="+10 pts" />
          <Row label="P3" value="+8 pts" />
          <Row label="P4" value="+6 pts" />
          <Row label="P5 à P10 (Q3)" value="+5 pts" />
          <Row label="Éliminé en Q2 (P11-P16)" value="+2 pts" />
          <Row label="Éliminé en Q1 (P17-P22)" value="0 pt" />
        </Section>

        {/* Course */}
        <Section title="Points — Course principale">
          <p className="text-gray-500 text-xs mb-3">Par pilote choisi</p>
          <Row label="Points F1 officiels" value="Selon classement" sub="P1=25, P2=18, P3=15, P4=12, P5=10, P6=8, P7=6, P8=4, P9=2, P10=1" />
          <Row label="Places remontées vs grille" value="+1 pt / place" sub="Maximum +10 pts" />
          <Row label="Positions perdues vs grille" value="-2 pts (fixe)" />
          <Row label="Abandon (DNF)" value="-5 pts" />
          <Row label="Meilleur tour en course" value="+2 pts" />
          <Row label="Dernier finisher (hors DNF)" value="-3 pts" />
          <Row label="Avant-dernier finisher (hors DNF)" value="-2 pts" />
          <Row label="3e depuis la fin (hors DNF)" value="-1 pt" />
        </Section>

        {/* Sprint */}
        <Section title="Points — Week-end Sprint">
          <p className="text-gray-500 text-xs mb-3">Sprint Qualifying + Sprint Race (par pilote choisi)</p>
          <div className="mb-3">
            <p className="text-gray-400 text-xs font-medium mb-2">Sprint Qualifying</p>
            <Row label="P1" value="+6 pts" />
            <Row label="P2" value="+5 pts" />
            <Row label="P3" value="+4 pts" />
            <Row label="P4" value="+3 pts" />
            <Row label="P5 à P10 (SQ3)" value="+2 pts" />
            <Row label="Éliminé en SQ2 (P11-P16)" value="+1 pt" />
            <Row label="Éliminé en SQ1 (P17+)" value="0 pt" />
          </div>
          <div>
            <p className="text-gray-400 text-xs font-medium mb-2">Sprint Race (barème F1 officiel, sans bonus/malus)</p>
            <Row label="P1" value="+8 pts" />
            <Row label="P2" value="+7 pts" />
            <Row label="P3" value="+6 pts" />
            <Row label="P4" value="+5 pts" />
            <Row label="P5" value="+4 pts" />
            <Row label="P6" value="+3 pts" />
            <Row label="P7" value="+2 pts" />
            <Row label="P8" value="+1 pt" />
            <Row label="P9 et au-delà / Abandon" value="0 pt" />
          </div>
        </Section>

        {/* Écurie */}
        <Section title="Points — Écurie">
          <p className="text-gray-300 text-sm mb-3">
            Les points écurie correspondent à la <strong className="text-white">moyenne des points F1 officiels</strong> des 2 pilotes de l&apos;écurie choisie sur cette course.
          </p>
          <div className="bg-gray-800 rounded-lg px-4 py-3 text-sm text-gray-400">
            Exemple : McLaren — NOR finit P1 (25 pts) + PIA finit P3 (15 pts) = (25+15) ÷ 2 = <span className="text-white font-bold">20 pts écurie</span>
          </div>
          <p className="text-gray-500 text-xs mt-2">
            Sur les week-ends sprint, les points écurie sprint utilisent également la moyenne des points sprint F1 officiels.
          </p>
        </Section>

        {/* Bonus */}
        <Section title="Points Bonus">
          <Row
            label="Pilote 1 devant Pilote 2"
            value="+5 pts"
            sub="Votre pilote 1 termine devant votre pilote 2 (course principale)"
          />
          <Row
            label="Double podium P1+P2"
            value="+20 pts"
            sub="Vos 2 pilotes terminent 1er et 2e (dans n'importe quel ordre)"
          />
          <div className="mt-3 bg-gray-800 rounded-lg px-4 py-3 text-xs text-gray-400">
            Ces deux bonus se cumulent : si votre pilote 1 est P1 et pilote 2 est P2 → <span className="text-white font-bold">+25 pts</span>
          </div>
        </Section>

        {/* Énergie */}
        <Section title="Système d'énergie ⚡">
          <div className="space-y-3 text-sm text-gray-300">
            <p>
              Chaque pilote possède une <strong className="text-white">énergie (0–100%)</strong> par joueur, remise à 100% en début de saison. Elle multiplie <em>uniquement les points positifs</em> du pilote.
            </p>
            <div className="bg-gray-800 rounded-lg px-4 py-3 text-xs text-gray-400">
              Exemple : un pilote à 80% qui marque 30 pts bruts → <span className="text-white font-bold">24 pts</span> effectifs
            </div>
            <p className="text-gray-400 text-xs font-medium mt-2 mb-1">Évolution après chaque course :</p>
            <div className="space-y-1.5">
              {[
                { label: "Pilote sélectionné", effect: "−20%", color: "text-red-400" },
                { label: "Pilote perdant parmi vos 2 (course principale)", effect: "−5% suppl.", color: "text-red-400" },
                { label: "Pilote de l'écurie choisie", effect: "−5%", color: "text-orange-400" },
                { label: "Pilote non sélectionné (hors écurie choisie)", effect: "+5% (max 100%)", color: "text-green-400" },
              ].map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-2 bg-gray-800/60 rounded px-3 py-1.5">
                  <span className="text-gray-300 text-xs flex-1 min-w-0">{item.label}</span>
                  <span className={`font-bold text-xs shrink-0 ${item.color}`}>{item.effect}</span>
                </div>
              ))}
            </div>
            <p className="text-gray-500 text-xs mt-1">
              L&apos;énergie est planchée à <strong className="text-gray-300">0%</strong> et plafonnée à <strong className="text-gray-300">100%</strong>. La stratégie <span className="text-cyan-400">Changement de moteur</span> supprime les pénalités de fatigue (−20% et −5% perdant) pour ce week-end.
            </p>
          </div>
        </Section>

      </div>

      {/* Stratégies */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-lg font-bold text-white mb-1">Stratégies</h2>
        <p className="text-gray-400 text-sm mb-5">
          Choisissez 1 stratégie par week-end. Chaque stratégie a un nombre d&apos;utilisations limité par saison.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {STRATEGIES.map((s) => {
            const colorClass = STRATEGY_BADGE_COLORS[s.color] ?? STRATEGY_BADGE_COLORS.gray;
            return (
              <div
                key={s.code}
                className="flex items-start gap-3 bg-gray-800/60 rounded-lg border border-gray-700 p-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-white font-semibold text-sm">{s.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>
                      {s.tokens === 5 ? "∞ illimité" : `${s.tokens}× par saison`}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs leading-relaxed">{s.description}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-300">
          <strong>FIA :</strong> Si un joueur joue la carte FIA ce week-end, <strong>toutes les stratégies sont annulées</strong> pour tout le monde.
        </div>
      </div>
    </div>
  );
}
