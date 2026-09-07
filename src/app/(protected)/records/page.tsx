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
          {records.bestScore ? (
            <>
              <UserLine
                userId={records.bestScore.user.id}
                userName={records.bestScore.user.name}
                value={records.bestScore.value}
                suffix="pts"
              />
              <p className="text-gray-500 text-xs mt-1">{raceLabel(records.bestScore.race)}</p>
            </>
          ) : (
            <Empty />
          )}
        </RecordCard>

        <RecordCard emoji="💀" title="Pire score sur un GP">
          {records.worstScore ? (
            <>
              <UserLine
                userId={records.worstScore.user.id}
                userName={records.worstScore.user.name}
                value={records.worstScore.value}
                suffix="pts"
              />
              <p className="text-gray-500 text-xs mt-1">{raceLabel(records.worstScore.race)}</p>
            </>
          ) : (
            <Empty />
          )}
        </RecordCard>

        <RecordCard emoji="🎲" title="Meilleur coup de stratégie">
          {records.bestStrategyGain ? (
            <>
              <UserLine
                userId={records.bestStrategyGain.user.id}
                userName={records.bestStrategyGain.user.name}
                value={`+${records.bestStrategyGain.gain}`}
                suffix="pts"
              />
              <p className="text-gray-500 text-xs mt-1">
                {records.bestStrategyGain.strategy} · {raceLabel(records.bestStrategyGain.race)}
              </p>
            </>
          ) : (
            <Empty />
          )}
        </RecordCard>

        <RecordCard emoji="🔪" title="Meilleur undercut">
          {records.bestUndercut ? (
            <>
              <UserLine
                userId={records.bestUndercut.user.id}
                userName={records.bestUndercut.user.name}
                value={`-${records.bestUndercut.damage}`}
                suffix="pts infligés"
              />
              <p className="text-gray-500 text-xs mt-1">{raceLabel(records.bestUndercut.race)}</p>
            </>
          ) : (
            <Empty />
          )}
        </RecordCard>

        <RecordCard emoji="📭" title="Le plus de GP loupés">
          {records.mostMissedRaces ? (
            <UserLine
              userId={records.mostMissedRaces.user.id}
              userName={records.mostMissedRaces.user.name}
              value={records.mostMissedRaces.count}
              suffix="GP"
            />
          ) : (
            <Empty />
          )}
        </RecordCard>

        <RecordCard emoji="🔁" title="Fidélité à un pilote">
          {records.mostPickedDriverByUser ? (
            <>
              <UserLine
                userId={records.mostPickedDriverByUser.user.id}
                userName={records.mostPickedDriverByUser.user.name}
                value={records.mostPickedDriverByUser.count}
                suffix="fois"
              />
              <p className="text-gray-500 text-xs mt-1">
                avec {driverName(records.mostPickedDriverByUser.driverCode)}
              </p>
            </>
          ) : (
            <Empty />
          )}
        </RecordCard>

        <RecordCard emoji="⭐" title="Chouchou de la ligue">
          {records.chouchou ? (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-white font-medium">{driverName(records.chouchou.driverCode)}</span>
              <span className="text-xl font-bold text-white shrink-0">
                {records.chouchou.count}
                <span className="text-sm text-gray-400 font-normal ml-1">picks</span>
              </span>
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
          {records.bestComeback ? (
            <>
              <UserLine
                userId={records.bestComeback.user.id}
                userName={records.bestComeback.user.name}
                value={`${records.bestComeback.fromRank}e → ${records.bestComeback.toRank}e`}
              />
              <p className="text-gray-500 text-xs mt-1">{raceLabel(records.bestComeback.race)}</p>
            </>
          ) : (
            <Empty />
          )}
        </RecordCard>

        <RecordCard emoji="🔥" title="Meilleure série dans le top 3">
          {records.bestStreak ? (
            <>
              <UserLine
                userId={records.bestStreak.user.id}
                userName={records.bestStreak.user.name}
                value={records.bestStreak.length}
                suffix="GP"
              />
              <p className="text-gray-500 text-xs mt-1">
                {records.bestStreak.startRace.round === records.bestStreak.endRace.round
                  ? raceLabel(records.bestStreak.startRace)
                  : `du round ${records.bestStreak.startRace.round} au round ${records.bestStreak.endRace.round} (${records.bestStreak.season})`}
              </p>
            </>
          ) : (
            <Empty />
          )}
        </RecordCard>

        <RecordCard emoji="💥" title="Le plus d'abandons subis">
          {records.mostDnf ? (
            <UserLine
              userId={records.mostDnf.user.id}
              userName={records.mostDnf.user.name}
              value={records.mostDnf.count}
              suffix="DNF"
            />
          ) : (
            <Empty />
          )}
        </RecordCard>

        <RecordCard emoji="❤️" title="Fidèle à l'écurie">
          {records.teamLoyalty ? (
            <>
              <UserLine
                userId={records.teamLoyalty.user.id}
                userName={records.teamLoyalty.user.name}
                value={records.teamLoyalty.count}
                suffix="fois"
              />
              <p className="text-gray-500 text-xs mt-1">avec {records.teamLoyalty.team}</p>
            </>
          ) : (
            <Empty />
          )}
        </RecordCard>

        <RecordCard emoji="👑" title="Le patron">
          {records.theBoss ? (
            <UserLine
              userId={records.theBoss.user.id}
              userName={records.theBoss.user.name}
              value={records.theBoss.weeks}
              suffix="semaines en tête"
            />
          ) : (
            <Empty />
          )}
        </RecordCard>

        <RecordCard emoji="🥬" title="Toujours dans les choux">
          {records.alwaysLast ? (
            <UserLine
              userId={records.alwaysLast.user.id}
              userName={records.alwaysLast.user.name}
              value={records.alwaysLast.weeks}
              suffix="semaines dernier"
            />
          ) : (
            <Empty />
          )}
        </RecordCard>

        <RecordCard emoji="⏱️" title="Speedrunner">
          {records.speedrunner ? (
            <>
              <UserLine
                userId={records.speedrunner.user.id}
                userName={records.speedrunner.user.name}
                value={formatLead(records.speedrunner.avgHours)}
                suffix="avant deadline (moy.)"
              />
            </>
          ) : (
            <Empty />
          )}
        </RecordCard>

        <RecordCard emoji="🐌" title="Dernière minute">
          {records.lastMinute ? (
            <UserLine
              userId={records.lastMinute.user.id}
              userName={records.lastMinute.user.name}
              value={formatLead(records.lastMinute.avgHours)}
              suffix="avant deadline (moy.)"
            />
          ) : (
            <Empty />
          )}
        </RecordCard>

        <RecordCard emoji="📏" title="Mr Constance">
          {records.mrConstance ? (
            <>
              <UserLine
                userId={records.mrConstance.user.id}
                userName={records.mrConstance.user.name}
                value={records.mrConstance.stdDev.toFixed(1)}
                suffix="écart-type"
              />
              <p className="text-gray-500 text-xs mt-1">sur {records.mrConstance.races} GP notés</p>
            </>
          ) : (
            <Empty />
          )}
        </RecordCard>

        <RecordCard emoji="🎢" title="Montagnes russes">
          {records.rollercoaster ? (
            <>
              <UserLine
                userId={records.rollercoaster.user.id}
                userName={records.rollercoaster.user.name}
                value={records.rollercoaster.stdDev.toFixed(1)}
                suffix="écart-type"
              />
              <p className="text-gray-500 text-xs mt-1">sur {records.rollercoaster.races} GP notés</p>
            </>
          ) : (
            <Empty />
          )}
        </RecordCard>
      </div>
    </div>
  );
}
