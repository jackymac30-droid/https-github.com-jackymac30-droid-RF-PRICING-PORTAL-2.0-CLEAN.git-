import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useRealtime<T>(
  table: string,
  onUpdate: () => void,
  filter?: { column: string; value: any }
) {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    let subscription = supabase
      .channel(`realtime-${table}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          ...(filter && { filter: `${filter.column}=eq.${filter.value}` }),
        },
        () => {
          onUpdate();
        }
      )
      .subscribe();

    setChannel(subscription);

    return () => {
      subscription.unsubscribe();
    };
  }, [table, filter?.column, filter?.value, onUpdate]);

  return channel;
}
