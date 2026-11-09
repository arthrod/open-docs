/** @jsxImportSource https://esm.sh/react@18.2.0 */
/**
 * The Plate editor surface. Kept to a minimum — the interesting part of this
 * demo is the DOCX bridge in `docx.ts`, not toolbar chrome.
 */
import React, { useMemo, useRef } from "https://esm.sh/react@18.2.0";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client";
import {
  Plate,
  PlateContent,
  usePlateEditor,
} from "https://esm.sh/platejs@53.5.2/react?bundle-deps&external=react,react-dom,react/jsx-runtime,react-dom/client";
import type { Descendant } from "https://esm.sh/platejs@53.5.2?bundle-deps&external=react,react-dom";

export interface PlateHandle {
  getValue(): Descendant[];
  setValue(value: Descendant[]): void;
  editor: any;
}

function Editor({
  initialValue,
  onReady,
}: {
  initialValue: Descendant[];
  onReady: (handle: PlateHandle) => void;
}) {
  const editor = usePlateEditor({ plugins: [], value: initialValue });
  const readyRef = useRef(false);
  const initial = useMemo(() => initialValue, []);

  if (!readyRef.current) {
    readyRef.current = true;
    queueMicrotask(() =>
      onReady({
        getValue: () => editor.children as Descendant[],
        setValue: (value) => {
          // Replace the whole value through Plate's transform API so the change
          // is a single undoable step.
          editor.tf.replaceNodes(value as any, { at: [] });
        },
        editor,
      })
    );
  }

  return (
    <Plate editor={editor}>
      <PlateContent
        placeholder="Start writing, or use the agent panel to rewrite this document."
        style={{
          outline: "none",
          minHeight: "60vh",
          padding: "20px 8px",
          fontSize: 15,
          lineHeight: 1.7,
          maxWidth: 720,
          margin: "0 auto",
        }}
      />
    </Plate>
  );
}

export function mountPlate(
  container: HTMLElement,
  initialValue: Descendant[],
  onReady: (handle: PlateHandle) => void,
) {
  createRoot(container).render(
    <Editor initialValue={initialValue} onReady={onReady} />,
  );
}
