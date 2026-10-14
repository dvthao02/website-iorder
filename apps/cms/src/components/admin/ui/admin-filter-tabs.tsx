type AdminFilterTab<Value extends string> = {
  label: string;
  value: Value;
};

type AdminFilterTabsProps<Value extends string> = {
  ariaLabel: string;
  items: AdminFilterTab<Value>[];
  onValueChange: (value: Value) => void;
  value: Value;
  disabled?: boolean;
  restoreNavigationFocus?: boolean;
};

export function AdminFilterTabs<Value extends string>({ ariaLabel, items, onValueChange, value, disabled = false, restoreNavigationFocus = false }: AdminFilterTabsProps<Value>) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!restoreNavigationFocus || disabled || !consumeNavigationFocus(window.location.href)) return;
    if (document.activeElement !== document.body) return;
    container.current?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true });
  }, [restoreNavigationFocus, disabled, value]);
  return <div ref={container}>{AdminFilterTabsContent({ ariaLabel, items, onValueChange, value, disabled })}</div>;
}

export function AdminFilterTabsContent<Value extends string>({ ariaLabel, items, onValueChange, value, disabled = false }: AdminFilterTabsProps<Value>) {
  function handleKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (disabled || items.length === 0) return;
    let target: number;
    switch (event.key) {
      case "ArrowRight": target = (index + 1) % items.length; break;
      case "ArrowLeft": target = (index + items.length - 1) % items.length; break;
      case "Home": target = 0; break;
      case "End": target = items.length - 1; break;
      default: return;
    }
    event.preventDefault();
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[target]?.focus();
    onValueChange(items[target].value);
  }
  const selectedIndex = Math.max(0, items.findIndex(item => item.value === value));
  return <div aria-label={ariaLabel} aria-orientation="horizontal" className="admin-filter-tabs" role="tablist">
    {items.map((item, index) => <button disabled={disabled} tabIndex={index === selectedIndex ? 0 : -1} aria-selected={item.value === value} className={item.value === value ? "admin-filter-tabs__tab admin-filter-tabs__tab--active" : "admin-filter-tabs__tab"} key={item.value} onKeyDown={event => handleKey(event, index)} onClick={() => onValueChange(item.value)} role="tab" type="button">{item.label}</button>)}
  </div>;
}
import React, { useEffect, useRef, type KeyboardEvent } from "react";
import { consumeNavigationFocus } from "./navigation-focus";

