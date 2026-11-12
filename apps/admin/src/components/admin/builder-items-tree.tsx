"use client";

import { CopyPlus, Eye, EyeOff, GripVertical, Trash2 } from "lucide-react";
import { useRef, type ReactNode } from "react";
import type { PageBlock } from "@iorder/shared/server/pages/pages.contract";
import { builderItemCollections, builderItemLabel, replaceBuilderItems, type BuilderItemCollection, type BuilderItemSelection } from "./ui/builder-item-model";
import { reorder, useDragReorder } from "./ui/use-drag-reorder";
import { useAdminConfirm } from "./ui/admin-confirm-dialog";
import { AdminButton } from "./ui/admin-button";

function ItemCollection({ collection, block, active, disabled, readOnly, onChange, onSelect, renderChildren, bare = false }: { collection: BuilderItemCollection; block: PageBlock; active: BuilderItemSelection | null; disabled?: boolean; readOnly?: boolean; onChange: (block: PageBlock) => void; onSelect: (selection: BuilderItemSelection | null) => void; renderChildren?: (index: number) => ReactNode; bare?: boolean }) {
  const { confirm } = useAdminConfirm();
  const locked = disabled || readOnly;
  const { items } = collection;
  const list = useRef<HTMLOListElement>(null);
  const details = useRef<HTMLDetailsElement>(null);
  const select = (index: number, focus = true) => onSelect({ path: collection.path, index, heading: collection.heading, tab: collection.tab, parentIndex: collection.parentIndex, focus });
  const update = (next: typeof items) => onChange(replaceBuilderItems(block, collection.path, next));
  const drag = useDragReorder({ touch: true, canDrag: () => !locked, onDrop: (from, to, position) => { const next = reorder(items, from, to, position); update(next); select(next.indexOf(items[from]), false); } });
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (locked || target < 0 || target >= items.length) return;
    const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; update(next); select(target, false);
    requestAnimationFrame(() => list.current?.querySelectorAll<HTMLElement>(":scope > li > .admin-builder-item__row > [data-drag-handle]")[target]?.focus());
  }
  return <div className="admin-builder-collection" data-builder-path={collection.path} onDragStart={event => event.stopPropagation()} onDragOver={event => event.stopPropagation()} onDrop={event => event.stopPropagation()}><details className="admin-builder-items" open={items.length > 0} ref={details}>
    <summary className={bare ? "sr-only" : undefined}>{collection.label} ({items.length})</summary>
    <ol ref={list}>{items.map((item, index) => {
      const selected = active?.path === collection.path && active.index === index;
      const label = builderItemLabel(item, index);
      return <li key={index} {...drag.itemProps(index)} className={selected ? "admin-builder-item admin-builder-item--selected" : "admin-builder-item"}>
        <div className="admin-builder-item__row"><button aria-label={`Sắp xếp ${label}`} className="admin-drag-handle" disabled={locked} {...drag.handleProps(index)} onKeyDown={event => { if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) { event.preventDefault(); move(index, event.key === "ArrowUp" ? -1 : 1); } }} title="Kéo để sắp xếp; bàn phím dùng Alt + phím lên/xuống" type="button"><GripVertical aria-hidden="true" size={13} /></button><button aria-current={selected ? "true" : undefined} className="admin-builder-item__select" disabled={disabled} onClick={() => select(index)} title={label} type="button">{item.isEnabled === false ? <EyeOff aria-hidden="true" size={12} /> : null}<span>{collection.path === "panels" ? <small className="admin-builder-slide-label">Mục trượt {index + 2}</small> : null}{label}</span></button></div>
        {selected ? <div className="admin-builder-item__tools">
          {collection.kind !== "text" ? <button aria-label={`${item.isEnabled === false ? "Hiện" : "Ẩn"} ${label}`} aria-pressed={item.isEnabled === false} className="admin-builder-item__tool" disabled={locked} onClick={() => update(items.map((current, currentIndex) => currentIndex === index ? { ...current, isEnabled: current.isEnabled === false } : current))} title={item.isEnabled === false ? "Hiện mục" : "Ẩn mục"} type="button">{item.isEnabled === false ? <EyeOff size={14} /> : <Eye size={14} />}</button> : null}
          <button aria-label={`Nhân bản ${label}`} className="admin-builder-item__tool" disabled={locked || items.length >= collection.max} onClick={() => { const copy = structuredClone(item); if ("highlighted" in copy) copy.highlighted = false; update([...items.slice(0, index + 1), copy, ...items.slice(index + 1)]); select(index + 1); }} title="Nhân bản mục" type="button"><CopyPlus size={14} /></button>
          <button aria-label={`Xóa ${label}`} className="admin-builder-item__tool" disabled={locked || items.length <= collection.min} onClick={async () => { if (locked || !await confirm({ title: `Xóa ${collection.noun}`, message: `Xóa “${label}” khỏi thành phần? Thay đổi chỉ áp dụng lên website sau khi lưu.`, confirmLabel: "Xóa mục", tone: "danger" })) return; update(items.filter((_, current) => current !== index)); onSelect(null); }} title="Xóa mục" type="button"><Trash2 size={14} /></button>
        </div> : null}
        {renderChildren ? <div className="admin-builder-item__children">{renderChildren(index)}</div> : null}
      </li>;
    })}</ol>
    </details><AdminButton disabled={locked || items.length >= collection.max} onClick={() => { if (details.current) details.current.open = true; update([...items, collection.create()]); select(items.length); }} size="sm" title={items.length >= collection.max ? `Tối đa ${collection.max} ${collection.noun}.` : undefined} variant="ghost">+ Thêm {collection.noun}</AdminButton>
  </div>;
}

export function BuilderItemsTree({ block, active, disabled, readOnly, onChange, onSelect }: { block: PageBlock; active: BuilderItemSelection | null; disabled?: boolean; readOnly?: boolean; onChange: (block: PageBlock) => void; onSelect: (selection: BuilderItemSelection | null) => void }) {
  const collections = builderItemCollections(block);
  const renderCollection = (collection: BuilderItemCollection): ReactNode => <ItemCollection key={collection.path} collection={collection.path.includes(".") ? { ...collection, label: collection.path.endsWith(".highlights") ? "Điểm nổi bật" : collection.path.endsWith(".items") ? "Các mục" : collection.label } : collection} block={block} active={active} disabled={disabled} readOnly={readOnly} onChange={onChange} onSelect={onSelect} bare={block.type === "hero" && collection.path === "panels"} renderChildren={collection.path === "panels" || collection.path === "groups" || collection.path === "plans" ? index => collections.filter(child => child.path.startsWith(`${collection.path}.${index}.`)).map(renderCollection) : undefined} />;
  if (block.type === "hero" && block.data.layout !== "slider") {
    const points = collections.find(collection => collection.path === "highlights");
    const panels = collections.find(collection => collection.path === "panels");
    return <div className="admin-builder-items-tree">
      <button aria-current={active?.path === "hero.layout" || !active ? "true" : undefined} className="admin-builder-item__select" disabled={disabled} onClick={() => onSelect({ path: "hero.layout", index: 0, heading: "", tab: "media" })} type="button">Bố cục khối</button>
      <div className="admin-builder-slide" data-builder-slide="primary">
        <button aria-label="Mục trượt 1" aria-current={active?.path === "hero.primary" ? "true" : undefined} className="admin-builder-item__select" disabled={disabled} onClick={() => onSelect({ path: "hero.primary", index: 0, heading: "Mục trượt 1", tab: "content" })} type="button"><span><strong className="admin-builder-slide-label">Mục trượt 1</strong>{block.data.title}</span></button>
        <div className="admin-builder-item__children">{points ? renderCollection(points) : null}</div>
      </div>
      {panels ? renderCollection(panels) : null}
    </div>;
  }
  return <div className="admin-builder-items-tree"><button aria-current={!active || active.path === "component.settings" ? "true" : undefined} className="admin-builder-item__select" disabled={disabled} onClick={() => onSelect({ path: "component.settings", index: 0, heading: "", tab: "content" })} type="button">Thiết lập chung</button>{collections.filter(collection => !collection.path.includes(".")).map(renderCollection)}</div>;
}
