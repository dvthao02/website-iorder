import type { ReactNode } from "react";

import { AdminCard } from "./admin-card";
import { AdminEditorActions } from "./admin-editor-actions";

export function ContentEditorPage({ sidebar, editor, actions }: { sidebar: ReactNode; editor: ReactNode; actions?: ReactNode }) {
  return (
    <div className="grid h-[calc(100dvh-7rem)] min-h-[32rem] gap-4 xl:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)]">
      <AdminCard className="min-w-0 overflow-hidden">{sidebar}</AdminCard>
      <AdminCard className="grid min-w-0 min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden"><div className="min-h-0 overflow-y-auto">{editor}</div>{actions ? <AdminEditorActions className="admin-editor-actions--panel">{actions}</AdminEditorActions> : null}</AdminCard>
    </div>
  );
}
