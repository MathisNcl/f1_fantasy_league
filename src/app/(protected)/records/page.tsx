import Link from "next/link";
import { auth } from "@/lib/auth";
import { getRecords } from "@/lib/records";
import { DRIVERS } from "@/lib/constants";

const driverName = (code: string) => DRIVERS.find((d) => d.code === code)?.name ?? code;

function raceLabel(race: { name: string; round: number; season: number }) {
  return `${race.name} · Round ${race.round} · ${race.season}`;
}

function formatLead(hours: number) {
  const abs = Math.abs(hours);
  if (abs < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}j`;
}

function RecordCard({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="text-2xl">{emoji}</span>
        <h2 className="text-base font-semibold text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="text-gray-600 text-sm">Pas encore de données.</p>;
}

function UserLine({
  userId,
  userName,
  value,
  suffix,
}: {
  userId: string;
  userName: string;
  value: string | number;
  suffix?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <Link href={`/joueur/${userId}`} className="text-white font-medium hover:text-red-400 transition-colors truncate">
        {userName}
      </Link>
      <span className="text-xl font-bold text-white shrink-0">
        {value}
        {suffix && <span className="text-sm text-gray-400 font-normal ml-1">{suffix}</span>}
      </span>
    </div>
  );
}

// Rend une liste d'entrées ex æquo, chacune séparée par une ligne quand il y en a plusieurs.
function Entries<T>({ items, render }: { items: T[]; render: (item: T, i: number) => React.ReactNode }) {
  if (items.length === 0) return <Empty />;
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className={i > 0 ? "pt-3 border-t border-gray-800" : ""}>
          {render(item, i)}
        </div>
      ))}
    </div>
  );
}

export default async function RecordsPage() {
  await auth();
  const records = await getRecords();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Records</h1>
        <p className="text-gray-400 mt-1">Le palmarès de la ligue, toutes saisons confondues</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RecordCard emoji="🏆" title="Meilleur score sur un GP">
          <Entries
            items={records.bestScore}
            render={(r) => (
              <>
                <UserLine userId={r.user.id} userName={r.user.name} value={r.value} suffix="pts" />
                <p className="text-gray-500 text-xs mt-1">{raceLabel(r.race)}</p>
              </>
            )}
          />
        </RecordCard>

        <RecordCard emoji="💀" title="Pire score sur un GP">
          <Entries
            items={records.worstScore}
            render={(r) => (
              <>
                <UserLine userId={r.user.id} userName={r.user.name} value={r.value} suffix="pts" />
                <p className="text-gray-500 text-xs mt-1">{raceLabel(r.race)}</p>
              </>
            )}
          />
        </RecordCard>

        <RecordCard emoji="🥇" title="Le plus de GP gagnés">
          <Entries
            items={records.mostWins}
            render={(r) => <UserLine userId={r.user.id} userName={r.user.name} value={r.count} suffix="victoires" />}
          />
        </RecordCard>

        <RecordCard emoji="🏅" title="Le plus de podiums">
          <Entries
            items={records.mostPodiums}
            render={(r) => <UserLine userId={r.user.id} userName={r.user.name} value={r.count} suffix="podiums" />}
          />
        </RecordCard>

        <RecordCard emoji="🎲" title="Meilleur coup de stratégie">
          <Entries
            items={records.bestStrategyGain}
            render={(r) => (
              <>
                <UserLine userId={r.user.id} userName={r.user.name} value={`+${r.gain}`} suffix="pts" />
                <p className="text-gray-500 text-xs mt-1">{r.strategy} · {raceLabel(r.race)}</p>
              </>
            )}
          />
        </RecordCard>

        <RecordCard emoji="🔪" title="Meilleur undercut">
          <Entries
            items={records.bestUndercut}
            render={(r) => (
              <>
                <UserLine userId={r.user.id} userName={r.user.name} value={`-${r.damage}`} suffix="pts infligés" />
                <p className="text-gray-500 text-xs mt-1">{raceLabel(r.race)}</p>
              </>
            )}
          />
        </RecordCard>

        <RecordCard emoji="📭" title="Le plus de GP loupés">
          <Entries
            items={records.mostMissedRaces}
            render={(r) => <UserLine userId={r.user.id} userName={r.user.name} value={r.count} suffix="GP" />}
          />
        </RecordCard>

        <RecordCard emoji="🔁" title="Fidélité à un pilote">
          <Entries
            items={records.mostPickedDriverByUser}
            render={(r) => (
              <>
                <UserLine userId={r.user.id} userName={r.user.name} value={r.count} suffix="fois" />
                <p className="text-gray-500 text-xs mt-1">avec {driverName(r.driverCode)}</p>
              </>
            )}
          />
        </RecordCard>

        <RecordCard emoji="⭐" title="Chouchou de la ligue">
          {records.chouchou.length > 0 ? (
            <div className="space-y-2">
              {records.chouchou.map((c) => (
                <div key={c.driverCode} className="flex items-baseline justify-between gap-3">
                  <span className="text-white font-medium">{driverName(c.driverCode)}</span>
                  <span className="text-xl font-bold text-white shrink-0">
                    {c.count}
                    <span className="text-sm text-gray-400 font-normal ml-1">picks</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Empty />
          )}
        </RecordCard>

        <RecordCard emoji="🐑" title="Moutons noirs">
          {records.moutonsNoirs.length > 0 ? (
            <p className="text-white text-sm leading-relaxed">
              {records.moutonsNoirs.map((code) => driverName(code)).join(", ")}
            </p>
          ) : (
            <p className="text-gray-500 text-sm">Tous les pilotes ont déjà été pickés au moins une fois.</p>
          )}
        </RecordCard>

        <RecordCard emoji="🚀" title="Meilleur comeback">
          <Entries
            items={records.bestComeback}
            render={(r) => (
              <>
                <UserLine userId={r.user.id} userName={r.user.name} value={`${r.fromRank}e → ${r.toRank}e`} />
                <p className="text-gray-500 text-xs mt-1">{raceLabel(r.race)}</p>
              </>
            )}
          />
        </RecordCard>

        <RecordCard emoji="🔥" title="Meilleure série dans le top 3">
          <Entries
            items={records.bestStreak}
            render={(r) => (
              <>
                <UserLine userId={r.user.id} userName={r.user.name} value={r.length} suffix="GP" />
                <p className="text-gray-500 text-xs mt-1">
                  {r.startRace.round === r.endRace.round
                    ? raceLabel(r.startRace)
                    : `du round ${r.startRace.round} au round ${r.endRace.round} (${r.season})`}
                </p>
              </>
            )}
          />
        </RecordCard>

        <RecordCard emoji="💥" title="Le plus d'abandons subis">
          <Entries
            items={records.mostDnf}
            render={(r) => <UserLine userId={r.user.id} userName={r.user.name} value={r.count} suffix="DNF" />}
          />
        </RecordCard>

        <RecordCard emoji="❤️" title="Fidèle à l'écurie">
          <Entries
            items={records.teamLoyalty}
            render={(r) => (
              <>
                <UserLine userId={r.user.id} userName={r.user.name} value={r.count} suffix="fois" />
                <p className="text-gray-500 text-xs mt-1">avec {r.team}</p>
              </>
            )}
          />
        </RecordCard>

        <RecordCard emoji="👑" title="Le patron">
          <Entries
            items={records.theBoss}
            render={(r) => <UserLine userId={r.user.id} userName={r.user.name} value={r.weeks} suffix="semaines en tête" />}
          />
        </RecordCard>

        <RecordCard emoji="🥬" title="Toujours dans les choux">
          <Entries
            items={records.alwaysLast}
            render={(r) => <UserLine userId={r.user.id} userName={r.user.name} value={r.weeks} suffix="semaines dernier" />}
          />
        </RecordCard>

        <RecordCard emoji="⏱️" title="Speedrunner">
          <Entries
            items={records.speedrunner}
            render={(r) => (
              <UserLine userId={r.user.id} userName={r.user.name} value={formatLead(r.avgHours)} suffix="avant deadline (moy.)" />
            )}
          />
        </RecordCard>

        <RecordCard emoji="🐌" title="Dernière minute">
          <Entries
            items={records.lastMinute}
            render={(r) => (
              <UserLine userId={r.user.id} userName={r.user.name} value={formatLead(r.avgHours)} suffix="avant deadline (moy.)" />
            )}
          />
        </RecordCard>

        <RecordCard emoji="📏" title="Mr Constance">
          <Entries
            items={records.mrConstance}
            render={(r) => (
              <>
                <UserLine userId={r.user.id} userName={r.user.name} value={r.stdDev.toFixed(1)} suffix="écart-type" />
                <p className="text-gray-500 text-xs mt-1">sur {r.races} GP notés</p>
              </>
            )}
          />
        </RecordCard>

        <RecordCard emoji="🎢" title="Montagnes russes">
          <Entries
            items={records.rollercoaster}
            render={(r) => (
              <>
                <UserLine userId={r.user.id} userName={r.user.name} value={r.stdDev.toFixed(1)} suffix="écart-type" />
                <p className="text-gray-500 text-xs mt-1">sur {r.races} GP notés</p>
              </>
            )}
          />
        </RecordCard>
      </div>
    </div>
  );
}
