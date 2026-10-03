"use client";

export type AdminEditorTab = {
  id: string;
  label: string;
};

export function AdminEditorTabs({ activeId, onChange, tabs }: { activeId: string; onChange: (id: string) => void; tabs: AdminEditorTab[] }) {
  return <nav aria-label="Các phần chỉnh sửa" className="admin-editor-tabs" role="tablist">
    {tabs.map((tab) => <button aria-selected={activeId === tab.id} className={activeId === tab.id ? "admin-editor-tabs__tab admin-editor-tabs__tab--active" : "admin-editor-tabs__tab"} key={tab.id} onClick={() => onChange(tab.id)} role="tab" type="button">{tab.label}</button>)}
  </nav>;
}
