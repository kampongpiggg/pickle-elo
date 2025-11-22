'use client';

import { KingResponse } from '@/lib/api';
import dayjsTz from '@/lib/dayjsTz';
import { FunctionComponent } from 'react';

interface Props {
  kingData: KingResponse;
}

const CrownedComponent: FunctionComponent<Props> = ({ kingData }) => {
  return (
    <div className="flex flex-col gap-1 text-xs text-gray-500 mt-1">
      <span>Crowned since {dayjsTz.utc(kingData?.since).tz(dayjsTz.tz.guess()).format('LLL')}</span>
      <span>
        Held for <strong>{kingData?.days}</strong> days
      </span>
    </div>
  );
};

export default CrownedComponent;
