import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { exportUserData } from '@documenso/lib/server-only/user/export-user-data';

import type { Route } from './+types/export-data';

/**
 * "Export my data" — PIPEDA cl. 4.9 access right and Quebec Law 25 s. 17
 * portability. Streams a machine-readable JSON archive of the personal
 * information held about the signed-in user. Document PDFs themselves are
 * downloaded separately from the documents UI (they are legal records and
 * can be large).
 */
export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await getSession(request);

  const data = await exportUserData({ userId: user.id });

  const filename = `northsign-data-export-${user.id}-${new Date().toISOString().slice(0, 10)}.json`;

  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
