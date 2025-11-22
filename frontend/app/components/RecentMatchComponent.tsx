'use client';

import { FunctionComponent } from 'react';
import dayjsTz from '@/lib/dayjsTz';
import { MatchSummary } from '@/lib/api';

interface Props {
  recentMatches: MatchSummary[];
}

const RecentMatchComponent: FunctionComponent<Props> = ({ recentMatches }) => {
  return (
    <div className="space-y-3">
      {recentMatches.map((m) => {
        const teamA = m.players.filter((p) => p.team_side === 'A');
        const teamB = m.players.filter((p) => p.team_side === 'B');

        const teamAName = teamA.map((p) => p.name).join(' / ');
        const teamBName = teamB.map((p) => p.name).join(' / ');

        return (
          <div
            key={m.id}
            className="border border-gray-100 rounded-lg px-3 py-2 text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-2 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div>
              <p className="text-xs text-gray-400">
                {dayjsTz.utc(m.played_at).tz(dayjsTz.tz.guess()).format('DD MMM YYYY • HH:mm')} •{' '}
                {m.format.toUpperCase()}
              </p>
              <p className="font-medium text-gray-900">
                <span>{teamAName || 'Team A'}</span> <span className="mx-1 text-gray-400">vs</span>
                <span>{teamBName || 'Team B'}</span>
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Score: {m.scoreA} – {m.scoreB}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 md:justify-end">
              {m.players.map((p) => {
                const diff = p.rating_after - p.rating_before;
                const sign = diff > 0 ? '+' : '';

                return (
                  <span
                    key={p.player_id}
                    className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2 py-1 text-xs"
                  >
                    <span className="mr-1 text-gray-800">{p.name}</span>
                    <span className="text-gray-400 mr-1">({p.rating_after})</span>
                    {diff !== 0 && (
                      <span className={diff > 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {sign}
                        {diff}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RecentMatchComponent;
