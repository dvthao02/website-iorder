"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, GripVertical, Pin, PinOff, RotateCcw, Settings2, X } from "lucide-react";
import { useAdminToast } from "./admin-feedback";

export type AdminDataTableColumn<Row> = {
  id: string;
  label: string;
  defaultWidth: number;
  minWidth?: number;
  align?: "left" | "right";
  cell: (row: Row) => ReactNode;
  /** Khóa sắp xếp gửi lên máy chủ (qua onSortChange) hoặc dùng cho sortValue khi sắp tại chỗ. */
  sortKey?: string;
  /** Giá trị để sắp xếp trong trình duyệt (danh sách nhỏ, không phân trang ở máy chủ). */
  sortValue?: (row: Row) => string | number | null | undefined;
  /** Chiều khi bấm lần đầu; cột ngày thường muốn mới nhất trước. */
  sortFirst?: SortDirection;
};

export type SortDirection = "asc" | "desc";
export type AdminTableSort = { key: string; dir: SortDirection } | null;

const selectColumnWidth = 40;
const collator = new Intl.Collator("vi", { numeric: true, sensitivity: "base" });

type TableSettings = {
  order: string[];
  hidden: string[];
  labels: Record<string, string>;
  pinned: string[];
  widths: Record<string, number>;
};

type ColumnDropTarget = { columnId: string; position: "before" | "after" };

type AdminDataTableProps<Row> = {
  tableId: string;
  columns: AdminDataTableColumn<Row>[];
  rows: Row[];
  getRowId: (row: Row) => string;
  emptyMessage: string;
  onRowClick?: (row: Row) => void;
  settingsOpen?: boolean;
  onSettingsOpenChange?: (isOpen: boolean) => void;
  showSettingsButton?: boolean;
  /** Sắp xếp do trang điều khiển (thường lưu trên URL và sắp ở máy chủ). */
  sort?: AdminTableSort;
  onSortChange?: (sort: AdminTableSort) => void;
  /** Chọn nhiều dòng: truyền selectedIds + onSelectionChange để hiện cột checkbox. */
  selectedIds?: readonly string[];
  onSelectionChange?: (ids: string[]) => void;
  isRowSelectable?: (row: Row) => boolean;
};

function nextSort(current: AdminTableSort, key: string, first: SortDirection): AdminTableSort {
  if (current?.key !== key) return { key, dir: first };
  if (current.dir === first) return { key, dir: first === "asc" ? "desc" : "asc" };
  return null;
}

function SelectAllCheckbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate: boolean; onChange: (checked: boolean) => void }) {
  return <input aria-label="Chọn tất cả dòng trên trang" checked={checked} onChange={(event) => onChange(event.target.checked)} ref={(element) => { if (element) element.indeterminate = indeterminate; }} type="checkbox" />;
}

function createDefaultSettings<Row>(columns: AdminDataTableColumn<Row>[]): TableSettings {
  return {
    order: columns.map((column) => column.id),
    hidden: [],
    labels: Object.fromEntries(columns.map((column) => [column.id, column.label])),
    pinned: [],
    widths: Object.fromEntries(columns.map((column) => [column.id, column.defaultWidth])),
  };
}

function normalizeSettings<Row>(columns: AdminDataTableColumn<Row>[], candidate: Partial<TableSettings> | undefined): TableSettings {
  const defaults = createDefaultSettings(columns);
  const validIds = new Set(defaults.order);
  const candidateOrder = (candidate?.order ?? []).filter((id) => validIds.has(id));
  const order = [...candidateOrder, ...defaults.order.filter((id) => !candidateOrder.includes(id))];

  return {
    order,
    hidden: (candidate?.hidden ?? []).filter((id) => validIds.has(id)),
    labels: Object.fromEntries(columns.map((column) => [column.id, candidate?.labels?.[column.id]?.trim() || column.label])),
    pinned: (candidate?.pinned ?? []).filter((id) => validIds.has(id)),
    widths: Object.fromEntries(columns.map((column) => {
      const width = candidate?.widths?.[column.id];
      return [column.id, Number.isFinite(width) ? Math.max(column.minWidth ?? 110, Math.round(width as number)) : column.defaultWidth];
    })),
  };
}

function storageKey(tableId: string) {
  return `iorder.cms.table.${tableId}`;
}

function loadSettings<Row>(tableId: string, columns: AdminDataTableColumn<Row>[]) {
  const defaults = createDefaultSettings(columns);
  try {
    const raw = window.localStorage.getItem(storageKey(tableId));
    return raw ? normalizeSettings(columns, JSON.parse(raw) as Partial<TableSettings>) : defaults;
  } catch {
    return defaults;
  }
}

export function AdminDataTable<Row>({ tableId, columns, rows, getRowId, emptyMessage, onRowClick, settingsOpen: controlledSettingsOpen, onSettingsOpenChange, showSettingsButton = true, sort: controlledSort, onSortChange, selectedIds, onSelectionChange, isRowSelectable }: AdminDataTableProps<Row>) {
  const { show: showToast } = useAdminToast();
  const columnSignature = columns.map((column) => `${column.id}:${column.label}:${column.defaultWidth}:${column.minWidth ?? ""}`).join("|");
  const columnsRef = useRef(columns);
  const [settings, setSettings] = useState<TableSettings>(() => createDefaultSettings(columns));
  const [draft, setDraft] = useState<TableSettings>(() => createDefaultSettings(columns));
  const [internalSettingsOpen, setInternalSettingsOpen] = useState(false);
  const [columnQuery, setColumnQuery] = useState("");
  const [draggedColumnId, setDraggedColumnId] = useState<string>();
  const [columnDropTarget, setColumnDropTarget] = useState<ColumnDropTarget>();
  const isSettingsOpen = controlledSettingsOpen ?? internalSettingsOpen;
  const [localSort, setLocalSort] = useState<AdminTableSort>(null);
  const activeSort = onSortChange ? controlledSort ?? null : localSort;
  const selectable = Boolean(selectedIds && onSelectionChange);
  const selected = useMemo(() => new Set(selectedIds ?? []), [selectedIds]);
  const selectableRowIds = selectable ? rows.filter((row) => isRowSelectable?.(row) ?? true).map(getRowId) : [];
  const selectedOnPage = selectableRowIds.filter((id) => selected.has(id)).length;

  function changeSort(column: AdminDataTableColumn<Row>) {
    const next = nextSort(activeSort, column.sortKey ?? column.id, column.sortFirst ?? "asc");
    if (onSortChange) onSortChange(next);
    else setLocalSort(next);
  }

  function togglePinned(columnId: string) {
    // Chỉ đổi danh sách ghim; thứ tự đã lưu giữ nguyên nên bỏ ghim thì cột về đúng chỗ cũ.
    setSettings((current) => ({ ...current, pinned: current.pinned.includes(columnId) ? current.pinned.filter((id) => id !== columnId) : [...current.pinned, columnId] }));
  }

  function toggleRow(id: string, checked: boolean) {
    onSelectionChange?.(checked ? [...new Set([...(selectedIds ?? []), id])] : (selectedIds ?? []).filter((item) => item !== id));
  }

  function togglePage(checked: boolean) {
    const pageIds = new Set(selectableRowIds);
    onSelectionChange?.(checked ? [...new Set([...(selectedIds ?? []), ...selectableRowIds])] : (selectedIds ?? []).filter((id) => !pageIds.has(id)));
  }

  function setSettingsOpen(next: boolean) {
    if (controlledSettingsOpen === undefined) setInternalSettingsOpen(next);
    onSettingsOpenChange?.(next);
  }

  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const restored = loadSettings(tableId, columnsRef.current);
      setSettings(restored);
      setDraft(restored);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [columnSignature, tableId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey(tableId), JSON.stringify(settings));
    } catch {
      // Cấu hình chỉ là tùy chọn cá nhân; bảng vẫn hoạt động khi trình duyệt chặn lưu trữ.
    }
  }, [settings, tableId]);

  const allColumns = useMemo(() => {
    const byId = new Map(columns.map((column) => [column.id, column]));
    return settings.order.map((id) => byId.get(id)).filter((column): column is AdminDataTableColumn<Row> => Boolean(column));
  }, [columns, settings.order]);
  // Cột Thao tác chỉ chứa nút biểu tượng: độ rộng cố định theo khai báo, không kéo/lưu.
  const widthOf = (column: AdminDataTableColumn<Row>) => column.id === "actions" ? column.defaultWidth : settings.widths[column.id] ?? column.defaultWidth;
  const shownColumns = allColumns.filter((column) => !settings.hidden.includes(column.id));
  // Cột ghim hiển thị trước các cột thường để phần dính bên trái liền nhau (thứ tự lưu không đổi).
  const visibleColumns = [...shownColumns.filter((column) => settings.pinned.includes(column.id)), ...shownColumns.filter((column) => !settings.pinned.includes(column.id))];
  const columnLayout = visibleColumns.reduce<Array<{ column: AdminDataTableColumn<Row>; width: number; pinned: boolean; left: number | undefined }>>((layout, column) => {
    const width = widthOf(column);
    const pinned = settings.pinned.includes(column.id);
    const left = pinned ? layout.filter((item) => item.pinned).reduce((total, item) => total + item.width, selectable ? selectColumnWidth : 0) : undefined;
    return [...layout, { column, width, pinned, left }];
  }, []);
  const minTableWidth = Math.max(620, columnLayout.reduce((total, item) => total + item.width, selectable ? selectColumnWidth : 0));
  // Sắp tại chỗ chỉ khi trang không tự điều khiển sắp xếp và cột có sortValue.
  const sortedRows = useMemo(() => {
    if (onSortChange || !localSort) return rows;
    const column = columns.find((item) => (item.sortKey ?? item.id) === localSort.key);
    const value = column?.sortValue;
    if (!value) return rows;
    const factor = localSort.dir === "asc" ? 1 : -1;
    return [...rows].sort((left, right) => {
      const a = value(left);
      const b = value(right);
      if (a === b) return 0;
      if (a === null || a === undefined || a === "") return 1;
      if (b === null || b === undefined || b === "") return -1;
      return factor * (typeof a === "number" && typeof b === "number" ? a - b : collator.compare(String(a), String(b)));
    });
  }, [columns, localSort, onSortChange, rows]);

  function openSettings() {
    setDraft(settings);
    setColumnQuery("");
    setSettingsOpen(true);
  }

  function updateDraft(next: Partial<TableSettings>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function moveDraftColumn(sourceId: string, targetId: string, position: ColumnDropTarget["position"]) {
    if (sourceId === targetId) return;
    setDraft((current) => {
      const order = current.order.filter((id) => id !== sourceId);
      const targetIndex = order.indexOf(targetId);
      const insertAt = targetIndex < 0 ? order.length : targetIndex + (position === "after" ? 1 : 0);
      order.splice(insertAt, 0, sourceId);
      return { ...current, order };
    });
  }

  function updateWidth(column: AdminDataTableColumn<Row>, width: number) {
    const nextWidth = Math.max(column.minWidth ?? 110, Math.round(width));
    setSettings((current) => ({ ...current, widths: { ...current.widths, [column.id]: nextWidth } }));
    setDraft((current) => ({ ...current, widths: { ...current.widths, [column.id]: nextWidth } }));
  }

  function startResize(event: ReactPointerEvent<HTMLButtonElement>, column: AdminDataTableColumn<Row>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = settings.widths[column.id] ?? column.defaultWidth;
    const move = (moveEvent: PointerEvent) => updateWidth(column, startWidth + moveEvent.clientX - startX);
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
  }

  function dragStart(event: DragEvent<HTMLDivElement>, columnId: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", columnId);
    setDraggedColumnId(columnId);
  }

  function getDropTarget(event: DragEvent<HTMLDivElement>, columnId: string): ColumnDropTarget | undefined {
    if (!draggedColumnId || draggedColumnId === columnId) return undefined;
    const bounds = event.currentTarget.getBoundingClientRect();
    return { columnId, position: event.clientY < bounds.top + bounds.height / 2 ? "before" : "after" };
  }

  const matchingDraftColumns = draft.order
    .map((id) => columns.find((column) => column.id === id))
    .filter((column): column is AdminDataTableColumn<Row> => Boolean(column))
    .filter((column) => (draft.labels[column.id] ?? column.label).toLocaleLowerCase("vi").includes(columnQuery.trim().toLocaleLowerCase("vi")));

  return <>
    <div className="admin-data-table">
      <div className="admin-data-table__scroll">
        <table style={{ minWidth: minTableWidth }}>
          <colgroup>{selectable ? <col style={{ width: selectColumnWidth }} /> : null}{columnLayout.map(({ column, width }) => <col key={column.id} style={{ width }} />)}</colgroup>
          <thead><tr>{selectable ? <th className="admin-data-table__select-cell admin-data-table__pinned-cell" style={{ left: 0, position: "sticky", zIndex: 4 }}><SelectAllCheckbox checked={selectableRowIds.length > 0 && selectedOnPage === selectableRowIds.length} indeterminate={selectedOnPage > 0 && selectedOnPage < selectableRowIds.length} onChange={togglePage} /></th> : null}{columnLayout.map(({ column, pinned, left }, index) => {
            const isActionsColumn = column.id === "actions";
            const style: CSSProperties = isActionsColumn ? { right: 0, position: "sticky", width: widthOf(column), zIndex: 5 } : pinned ? { left, position: "sticky", width: widthOf(column), zIndex: 3 } : { width: widthOf(column) };
            const className = [column.align === "right" && !isActionsColumn ? "admin-data-table__cell--right" : "", pinned ? "admin-data-table__pinned-cell" : "", isActionsColumn ? "admin-data-table__actions-cell" : ""].filter(Boolean).join(" ");
            const label = settings.labels[column.id] ?? column.label;
            const sortable = Boolean(onSortChange ? column.sortKey : column.sortValue);
            const sortDir = sortable && activeSort?.key === (column.sortKey ?? column.id) ? activeSort.dir : undefined;
            const SortIcon = sortDir === "asc" ? ArrowUp : sortDir === "desc" ? ArrowDown : ArrowUpDown;
            return <th aria-sort={sortDir === "asc" ? "ascending" : sortDir === "desc" ? "descending" : undefined} className={className || undefined} key={column.id} style={style}><div className="admin-data-table__head">
              {sortable ? <button className={sortDir ? "admin-data-table__sort admin-data-table__sort--active" : "admin-data-table__sort"} onClick={() => changeSort(column)} title={sortDir ? "Bấm để đổi chiều hoặc bỏ sắp xếp" : `Sắp xếp theo ${label}`} type="button"><span>{label}</span><SortIcon aria-hidden="true" size={13} /></button> : <span>{label}</span>}
              {isActionsColumn ? null : <button aria-label={pinned ? `Bỏ ghim cột ${label}` : `Ghim cột ${label}`} aria-pressed={pinned} className={pinned ? "admin-data-table__pin-toggle admin-data-table__pin-toggle--active" : "admin-data-table__pin-toggle"} onClick={() => togglePinned(column.id)} title={pinned ? "Bỏ ghim cột" : "Ghim cột bên trái khi cuộn ngang"} type="button">{pinned ? <PinOff aria-hidden="true" size={13} /> : <Pin aria-hidden="true" size={13} />}</button>}
            </div>{isActionsColumn ? null : <button aria-label={`Thay đổi độ rộng cột ${settings.labels[column.id] ?? column.label}`} className="admin-data-table__resize-handle" onPointerDown={(event) => startResize(event, column)} type="button" />}{showSettingsButton && index === columnLayout.length - 1 ? <button aria-label="Cài đặt cột" className="admin-data-table__settings-button" onClick={openSettings} title={`Cài đặt cột (${visibleColumns.length}/${columns.length} cột đang hiển thị)`} type="button"><Settings2 aria-hidden="true" size={15} /></button> : null}</th>;
          })}</tr></thead>
          <tbody>{sortedRows.map((row) => { const rowId = getRowId(row); const rowSelectable = selectable && (isRowSelectable?.(row) ?? true); return <tr aria-selected={selectable ? selected.has(rowId) : undefined} className={[onRowClick ? "admin-data-table__row--interactive" : "", selected.has(rowId) ? "admin-data-table__row--selected" : ""].filter(Boolean).join(" ") || undefined} key={rowId} onClick={(event) => {
            if (!onRowClick || event.target instanceof Element && event.target.closest("a, button, input, select, textarea, label")) return;
            onRowClick(row);
          }} onKeyDown={(event) => {
            if (!onRowClick || event.target !== event.currentTarget || event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onRowClick(row);
          }} tabIndex={onRowClick ? 0 : undefined}>{selectable ? <td className="admin-data-table__select-cell admin-data-table__pinned-cell" style={{ left: 0, position: "sticky", zIndex: 1 }}>{rowSelectable ? <input aria-label="Chọn dòng" checked={selected.has(rowId)} onChange={(event) => toggleRow(rowId, event.target.checked)} type="checkbox" /> : null}</td> : null}{columnLayout.map(({ column, pinned, left }) => {
            const isActionsColumn = column.id === "actions";
            const style: CSSProperties = isActionsColumn ? { right: 0, position: "sticky", width: widthOf(column), zIndex: 2 } : pinned ? { left, position: "sticky", width: widthOf(column), zIndex: 1 } : { width: widthOf(column) };
            const className = [column.align === "right" && !isActionsColumn ? "admin-data-table__cell--right" : "", pinned ? "admin-data-table__pinned-cell" : "", isActionsColumn ? "admin-data-table__actions-cell" : ""].filter(Boolean).join(" ");
            return <td className={className || undefined} key={column.id} style={style}>{column.cell(row)}</td>;
          })}</tr>; })}{rows.length === 0 ? <tr><td className="admin-data-table__empty" colSpan={Math.max(visibleColumns.length + (selectable ? 1 : 0), 1)}>{emptyMessage}</td></tr> : null}</tbody>
        </table>
      </div>
    </div>

    {isSettingsOpen ? <div className="admin-data-table__dialog-backdrop" onMouseDown={() => setSettingsOpen(false)} role="presentation">
      <section aria-labelledby={`${tableId}-column-settings-title`} aria-modal="true" className="admin-data-table__dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <header><div><h2 id={`${tableId}-column-settings-title`}>Cài đặt bảng</h2><p>Chọn cột hiển thị, đổi tên, độ rộng, thứ tự và cột cố định.</p></div><button aria-label="Đóng cài đặt bảng" onClick={() => setSettingsOpen(false)} type="button"><X aria-hidden="true" size={20} /></button></header>
        <div className="admin-data-table__dialog-actions"><label><span className="sr-only">Tìm kiếm cột</span><input onChange={(event) => setColumnQuery(event.target.value)} placeholder="Tìm kiếm cột" value={columnQuery} /></label><button onClick={() => setDraft(createDefaultSettings(columns))} type="button"><RotateCcw aria-hidden="true" size={15} />Trở về mặc định</button></div>
        <div className="admin-data-table__settings-list">
          <div className="admin-data-table__settings-heading"><span>Hiển thị & thứ tự</span><span>Tên cột trên giao diện</span><span>Độ rộng</span><span>Cố định</span></div>
          {matchingDraftColumns.map((column) => {
            const visible = !draft.hidden.includes(column.id);
            const pinned = draft.pinned.includes(column.id);
            const isDragSource = draggedColumnId === column.id;
            const dropPosition = columnDropTarget?.columnId === column.id ? columnDropTarget.position : undefined;
            const rowClassName = ["admin-data-table__settings-row", isDragSource ? "admin-data-table__settings-row--dragging" : "", dropPosition ? `admin-data-table__settings-row--drop-${dropPosition}` : ""].filter(Boolean).join(" ");
            return <div className={rowClassName} draggable key={column.id} onDragEnd={() => { setDraggedColumnId(undefined); setColumnDropTarget(undefined); }} onDragOver={(event) => { event.preventDefault(); setColumnDropTarget(getDropTarget(event, column.id)); }} onDragStart={(event) => dragStart(event, column.id)} onDrop={(event) => { const target = getDropTarget(event, column.id); if (draggedColumnId && target) moveDraftColumn(draggedColumnId, target.columnId, target.position); setDraggedColumnId(undefined); setColumnDropTarget(undefined); }}>
              <label><input checked={visible} onChange={(event) => updateDraft({ hidden: event.target.checked ? draft.hidden.filter((id) => id !== column.id) : [...draft.hidden, column.id] })} type="checkbox" /><GripVertical aria-hidden="true" size={17} /><span>{column.label}</span></label>
              <input aria-label={`Tên hiển thị cho cột ${column.label}`} onChange={(event) => updateDraft({ labels: { ...draft.labels, [column.id]: event.target.value } })} placeholder="Tên hiển thị" value={draft.labels[column.id] ?? column.label} />
              <input aria-label={`Độ rộng cột ${column.label}`} disabled={column.id === "actions"} min={column.minWidth ?? 110} onChange={(event) => updateDraft({ widths: { ...draft.widths, [column.id]: Math.max(column.minWidth ?? 110, Number(event.target.value) || column.defaultWidth) } })} placeholder="Độ rộng" type="number" value={draft.widths[column.id] ?? column.defaultWidth} />
              <label className="admin-data-table__pin"><input checked={pinned} onChange={(event) => updateDraft({ pinned: event.target.checked ? [...draft.pinned, column.id] : draft.pinned.filter((id) => id !== column.id) })} type="checkbox" /><span>Ghim</span></label>
            </div>;
          })}
        </div>
        <footer><button onClick={() => setSettingsOpen(false)} type="button">Thoát</button><button className="admin-data-table__save-button" onClick={() => { setSettings(normalizeSettings(columns, draft)); setSettingsOpen(false); showToast("Đã lưu cấu hình bảng.", "success"); }} type="button">Lưu</button></footer>
      </section>
    </div> : null}
  </>;
}
