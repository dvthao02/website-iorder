import type { CmsAction } from "@iorder/core/server/auth/permissions";

export type MatrixModule = { key: string; name: string; actions: readonly CmsAction[] };
export type CheckState = "all" | "some" | "none";

export const permissionCode = (module: MatrixModule, action: CmsAction) => `${module.key}.${action}`;

function codesOf(modules: readonly MatrixModule[], canGrant: (code: string) => boolean) {
  return modules.flatMap((module) => module.actions.map((action) => permissionCode(module, action))).filter(canGrant);
}

function stateOf(selected: ReadonlySet<string>, codes: string[]): CheckState {
  const checked = codes.filter((code) => selected.has(code)).length;
  return checked === 0 ? "none" : checked === codes.length ? "all" : "some";
}

// Group checkbox state over the permissions the actor may change.
export function moduleState(selected: ReadonlySet<string>, module: MatrixModule, canGrant: (code: string) => boolean = () => true) {
  return stateOf(selected, codesOf([module], canGrant));
}

export function allState(selected: ReadonlySet<string>, modules: readonly MatrixModule[], canGrant: (code: string) => boolean = () => true) {
  return stateOf(selected, codesOf(modules, canGrant));
}

export function setModules(selected: ReadonlySet<string>, modules: readonly MatrixModule[], checked: boolean, canGrant: (code: string) => boolean = () => true) {
  const next = new Set(selected);
  for (const code of codesOf(modules, canGrant)) {
    if (checked) next.add(code);
    else next.delete(code);
  }
  return next;
}

// Any action implies view; removing view removes the module's other actions.
export function setPermission(selected: ReadonlySet<string>, module: MatrixModule, action: CmsAction, checked: boolean, canGrant: (code: string) => boolean = () => true) {
  const next = new Set(selected);
  const code = permissionCode(module, action);
  if (!canGrant(code)) return next;
  if (checked) {
    next.add(code);
    const view = permissionCode(module, "view");
    if (module.actions.includes("view") && canGrant(view)) next.add(view);
  } else if (action === "view") {
    for (const other of module.actions) if (canGrant(permissionCode(module, other))) next.delete(permissionCode(module, other));
  } else {
    next.delete(code);
  }
  return next;
}
