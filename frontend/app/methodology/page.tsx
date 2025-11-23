// app/methodology/page.tsx

const archetypes = [
  {
    name: "Playmaker",
    axis: "Offense",
    role: "Creates chances",
    description:
      "The court general. You win more points than you lose and tilt close matches in your team’s favour with smart, well-timed winners.",
    logic:
      "Requires ≥ 5 matches, CI ≥ 0.55 and net winners per match ≳ +5.0.",
  },
  {
    name: "Savage Attacker",
    axis: "Offense",
    role: "Pure aggression",
    description:
      "The sword that never stays sheathed. You swing often, hit hard, and drive a large share of your team’s points from outright winners.",
    logic:
      "Requires ≥ 5 matches, avg winners per match ≥ 5.0 and CI ≥ 0.60.",
  },
  {
    name: "Team Carry",
    axis: "Offense",
    role: "Primary scorer",
    description:
      "The hero of the box score. Over time you both win a lot and convert that into match victories for whichever side you stand on.",
    logic:
      "Requires ≥ 5 matches, CI ≥ 0.65 and win rate ≥ 55%.",
  },

  {
    name: "Reliable Defender",
    axis: "Defense",
    role: "Low-error stabilizer",
    description:
      "The steady shield. You still take some risks, but you keep your errors modest and help your team hold the line.",
    logic:
      "Requires ≥ 5 matches, avg errors per match between ~0.7 and 1.0, LI ≤ 0.35 and win rate ≥ 50%.",
  },
  {
    name: "The Wall",
    axis: "Defense",
    role: "Almost no errors",
    description:
      "An unbroken bulwark. You rarely give away free points, and your team tends to win when you are on court.",
    logic:
      "Requires ≥ 5 matches, avg errors per match ≤ 0.7, LI ≤ 0.25 and win rate ≥ 65%.",
  },

  {
    name: "Reckless Attacker",
    axis: "Variance",
    role: "High winners & errors",
    description:
      "The glass cannon. You produce fireworks on both sides of the ledger—huge winners and costly mistakes in equal measure.",
    logic:
      "Requires ≥ 5 matches, avg winners per match ≥ 4.0 and avg errors per match ≥ 3.0.",
  },
  {
    name: "Wildcard",
    axis: "Variance",
    role: "Big swings, big risk",
    description:
      "The coin-flip knight. When you show up, you can swing matches all by yourself—for good or ill.",
    logic:
      "Requires ≥ 5 matches, CI ≥ 0.55 and LI ≥ 0.35 (you help a lot and hurt a lot).",
  },
  {
    name: "Team Liability",
    axis: "Variance",
    role: "Hurts team outcomes",
    description:
      "The over-eager squire. You may mean well, but a large share of your team’s lost points come from your errors, and the results show it.",
    logic: "Requires ≥ 5 matches, LI ≥ 0.50 and win rate ≤ 50%.",
  },

  {
    name: "Closer",
    axis: "Mentality",
    role: "Wins the big points",
    description:
      "The finisher. When the set is on a knife’s edge, you tend to be the one landing the final blows.",
    logic:
      "Requires ≥ 5 matches, win rate ≥ 65% and net winners per match ≥ +1.5.",
  },
  {
    name: "Team Player",
    axis: "Mentality",
    role: "Balanced & steady",
    description:
      "The reliable companion. You play close to even on winners vs errors and keep your team hovering around a balanced record.",
    logic:
      "Requires ≥ 5 matches, net winners per match between −0.5 and +0.5, and win rate between 45% and 60%.",
  },

  {
    name: "Singles Specialist",
    axis: "Format",
    role: "Shines in singles",
    description:
      "The duelist. You thrive when it is just you, your blade, and one opponent across the net.",
    logic:
      "Requires ≥ 3 singles games, singles win rate ≥ 60% and at least 10 percentage points higher than your doubles win rate.",
  },
  {
    name: "Doubles Specialist",
    axis: "Format",
    role: "Shines in doubles",
    description:
      "The tactician of teams. You read spacing, cover lanes, and shine most when fighting alongside a partner.",
    logic:
      "Requires ≥ 3 doubles games, doubles win rate ≥ 60% and at least 10 percentage points higher than your singles win rate.",
  },
  {
    name: "Versatile",
    axis: "Format",
    role: "Strong in both",
    description:
      "The all-round champion. Whether it’s a duel or a skirmish, you carry your weight in any format.",
    logic:
      "Requires ≥ 3 singles and ≥ 3 doubles games, both singles and doubles win rates ≥ 55%, and within 10 percentage points of each other.",
  },
];

export default function MethodologyPage() {
  return (
    <main
      className="min-h-screen px-4 py-8 md:px-12 lg:px-24 space-y-10 text-justify"
      style={{ background: "transparent" }}
    >
      {/* Header */}
      <section className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
          The Math Behind the System
        </h1>
        <p className="text-sm md:text-base text-gray-600">
          How the throne keeps its books: ratings, contribution, liability, and
          the archetypes that emerge from your games.
        </p>
      </section>

      {/* Elo System */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-900">
          The Elo Rating System
        </h2>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
          <p className="text-sm md:text-base text-gray-600">
            Every player begins with the same standing:{" "}
            <span className="font-semibold">1000 Elo</span>. From there, each
            match is a duel that either raises or lowers your standing in the
            eyes of the court. Beat stronger opponents and you gain more glory;
            lose to weaker opponents and the scribes of Elo mark you down more
            harshly.
          </p>

          <p className="text-sm md:text-base text-gray-600">
            Under the hood, we use the standard Elo expected score formula. Your
            chance to win a match is computed from the rating difference between
            you (or your team, in a doubles match) and your opponents. If you
            outperform that expectation, your rating rises; if you underperform,
            it falls. The bigger the upset, the bigger the swing.
          </p>

          <ul className="list-disc list-inside text-sm md:text-base text-gray-600 space-y-1">
            <li>
              <span className="font-semibold">Singles:</span> Uses a higher base
              K compared to the doubles, so one-on-one duels move ratings more.
            </li>
            <li>
              <span className="font-semibold">Doubles:</span> Team ratings are
              the average of the two players. The team&apos;s rating change is
              split between partners by means of points won or lost: in a
              winning pair, the one who won more points enjoys a greater rating
              increase than the other. In a losing pair, the one who lost more
              points suffers a greater rating drop than the other.
            </li>
            <li>
              <span className="font-semibold">Margin of victory:</span> A close
              11–9 feels different from an 11–1 rout. We apply a{" "}
              <span className="font-semibold">margin-of-victory multiplier</span>{" "}
              so blowouts move ratings more, while tight matches move them less.
            </li>
          </ul>

          <p className="text-sm md:text-base text-gray-600">
            In short: Elo is the court&apos;s ledger of reputation. It does not
            care about style, only about who wins, who loses, and how surprising
            each result was.
          </p>
        </div>
      </section>

      {/* CI / LI */}
      <section className="grid gap-6 md:grid-cols-2">
        {/* CI */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
          <h3 className="text-xl font-semibold text-gray-900">
            Contribution Index (CI)
          </h3>
          <p className="text-sm md:text-base text-gray-600">
            Elo measures outcomes. The{" "}
            <span className="font-semibold">Contribution Index (CI)</span>{" "}
            measures how much of your team&apos;s success flows directly from
            your paddle. It looks at how many points you personally win and how
            cleanly you tend to come out ahead in your rallies.
          </p>

          <p className="text-sm md:text-base text-gray-600">
            For each player, we track:
          </p>
          <ul className="list-disc list-inside text-sm md:text-base text-gray-600 space-y-1">
            <li>
              <span className="font-semibold">Winners:</span> points you win
              directly.
            </li>
            <li>
              <span className="font-semibold">Errors:</span> points you lose
              directly.
            </li>
            <li>
              <span className="font-semibold">Team points won:</span> total
              points your team scored on the board while you were on that side.
            </li>
          </ul>

          <p className="text-sm md:text-base text-gray-600">
            First, we compute your{" "}
            <span className="font-semibold">winner share</span>:
          </p>
          <div className="mt-1 inline-block rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
            <p className="text-xs md:text-sm font-mono text-gray-700">
              winner_share = your_total_winners ÷ your_team_total_points_won
            </p>
          </div>
          <p className="text-sm md:text-base text-gray-600">
            This is &ldquo;how much of your team&apos;s points came from you.&rdquo;
          </p>

          <p className="text-sm md:text-base text-gray-600">
            We also look at{" "}
            <span className="font-semibold">net winners per match</span>:
          </p>
          <div className="mt-1 inline-block rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
            <p className="text-xs md:text-sm font-mono text-gray-700">
              net_winners_per_match = (winners − errors) ÷ total_matches
            </p>
          </div>
          <p className="text-sm md:text-base text-gray-600">
            This can be understood as the amount of points you won, subtracted
            from the amount of points you lost. We assume typical players live
            in a range from about −4 to +4 net winners per match, and compress
            that into a 0–1 scale so that:
          </p>

          <div className="mt-1 inline-block rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
            <p className="text-xs md:text-sm font-mono text-gray-700">
              norm_net_winners = clamp((net_winners_per_match + 4) ÷ 8, 0, 1)
            </p>
          </div>

          <p className="text-sm md:text-base text-gray-600">
            Finally, CI is a blend of your share of the team&apos;s points and
            how far above (or below) even you usually trade:
          </p>
          <div className="mt-1 inline-block rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
            <p className="text-xs md:text-sm font-mono text-gray-700">
              CI = 0.60 × winner_share + 0.40 × norm_net_winners
            </p>
          </div>

          <p className="text-xs text-gray-500">
            Intuition: CI is high for players who both{" "}
            <span className="font-semibold">
              win a large share of their team&apos;s points
            </span>{" "}
            and{" "}
            <span className="font-semibold">
              consistently come out ahead in rallies over many matches
            </span>
            . In the language of the realm, CI measures how much you tip the
            battlefield in your allies&apos; favour.
          </p>
        </div>

        {/* LI */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
          <h3 className="text-xl font-semibold text-gray-900">
            Liability Index (LI)
          </h3>
          <p className="text-sm md:text-base text-gray-600">
            The{" "}
            <span className="font-semibold">Liability Index (LI)</span> is the
            mirror image of CI. Instead of asking &ldquo;How much glory do you
            win for us?&rdquo;, it asks, &ldquo;How often do your fuck-ups cost
            us the points?&rdquo;
          </p>

          <p className="text-sm md:text-base text-gray-600">
            For LI, we look at:
          </p>
          <ul className="list-disc list-inside text-sm md:text-base text-gray-600 space-y-1">
            <li>
              <span className="font-semibold">Errors:</span> the points you give
              away.
            </li>
            <li>
              <span className="font-semibold">Team points lost:</span> total
              points your team concedes on the scoreboard while you are on that
              side.
            </li>
          </ul>

          <p className="text-sm md:text-base text-gray-600">
            We compute your{" "}
            <span className="font-semibold">error share</span>:
          </p>
          <div className="mt-1 inline-block rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
            <p className="text-xs md:text-sm font-mono text-gray-700">
              error_share = your_total_errors ÷ your_team_total_points_lost
            </p>
          </div>

          <p className="text-sm md:text-base text-gray-600">
            Your <span className="font-semibold">LI</span> is simply:
          </p>
          <div className="mt-1 inline-block rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
            <p className="text-xs md:text-sm font-mono text-gray-700">
              LI = error_share
            </p>
          </div>

          <p className="text-xs text-gray-500">
            Intuition: LI is high when{" "}
            <span className="font-semibold">
              a large fraction of the points your team loses can be traced
              directly to your errors
            </span>
            . A low LI means you rarely hand the opponent free gifts; a high LI
            means you may be dragging your banner through the mud, even if you
            also have bright moments.
          </p>

          <p className="text-xs text-gray-500">
            CI and LI together give a two-sided view of your impact: the sword
            you bring to the fight, and the holes that might be in your shield.
          </p>

          <p className="text-xs text-gray-500">
            Disclaimer: When live tracking is not employed in doubles, the court
            cannot see who struck each winner or who committed each error. In
            such cases, winners and errors are assigned equally between
            partners at the end of the game, which smooths out some extremes of
            individual play.
          </p>
        </div>
      </section>

      {/* Archetypes */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-900">
          Player Archetypes
        </h2>

        <p className="text-sm md:text-base text-gray-600">
          Over time, certain patterns of play repeat themselves. Some players
          are fearless attackers, others quiet defenders, others still walking
          chaos. Once you have at least{" "}
          <span className="font-semibold">5 recorded matches</span>, the system
          scans your record and assigns one or more{" "}
          <span className="font-semibold">archetypes</span> based on your CI,
          LI, win rates, and how you perform in singles vs doubles.
        </p>

        <p className="text-sm md:text-base text-gray-600">
          Think of these not as fixed titles, but as how people might describe
          your style of battle.
        </p>

        <div className="overflow-x-auto bg-white border border-gray-200 rounded-xl shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-gray-600 text-xs uppercase border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2">Archetype</th>
                <th className="text-left px-4 py-2">Axis</th>
                <th className="text-left px-4 py-2">Role</th>
                <th className="text-left px-4 py-2">Description</th>
                <th className="text-left px-4 py-2 whitespace-nowrap">
                  Logic (stats thresholds)
                </th>
              </tr>
            </thead>

            <tbody>
              {archetypes.map((a) => (
                <tr
                  key={a.name}
                  className="border-b border-gray-100 last:border-none align-top"
                >
                  <td className="px-4 py-2 font-medium text-gray-800">
                    {a.name}
                  </td>
                  <td className="px-4 py-2 text-gray-700">{a.axis}</td>
                  <td className="px-4 py-2 text-gray-700">{a.role}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {a.description}
                  </td>
                  <td className="px-4 py-2 text-gray-600 text-xs md:text-[0.8rem]">
                    {a.logic}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500">
          Note: All archetype checks only run once you have at least 5 total
          matches in the ledger, and some format-based archetypes (Singles
          Specialist, Doubles Specialist, Versatile) require minimum numbers of
          singles or doubles games.
        </p>
      </section>
    </main>
  );
}
