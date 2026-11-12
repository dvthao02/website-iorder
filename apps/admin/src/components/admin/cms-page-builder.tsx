"use client";

import { useState } from "react";
import { PageBlocksEditor, type PageBlocksEditorProps } from "./page-blocks-editor";
import { BuilderLivePreview } from "./builder-live-preview";

/** Một builder cho pages và offerings; form nghiệp vụ và nguồn dữ liệu không phụ thuộc slug. */
export function CmsPageBuilder({ document, documentId, ...props }: Omit<PageBlocksEditorProps, "layout" | "preview"> & { document: unknown; documentId: string | null }) {
  const [internal, setInternal] = useState<number | null>(props.blocks.length ? 0 : null);
  const selected = props.openIndex === undefined ? internal : props.openIndex;
  const select = (index: number | null) => { if (index !== null && index >= props.blocks.length) return; if (props.onOpenIndexChange) props.onOpenIndexChange(index); else setInternal(index); };
  return <PageBlocksEditor {...props} layout="builder" openIndex={selected} onOpenIndexChange={select} preview={<BuilderLivePreview document={document} documentId={documentId} onSelect={select} selectedIndex={selected} />} />;
}
