import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { QuotePdf, type QuotePdfData } from "./QuotePdf";
import { createElement, type ReactElement } from "react";

/**
 * Render the quote PDF to a Buffer on the server. Used by the email-me
 * endpoint to attach the PDF. Not edge-compatible (renderToBuffer is Node-only).
 *
 * The cast is required because @react-pdf/renderer's renderToBuffer types its
 * arg as ReactElement<DocumentProps>, but createElement(QuotePdf, ...) widens
 * to FunctionComponentElement which TS won't narrow on its own. The output of
 * QuotePdf is a <Document>, so the cast is safe.
 */
export async function renderQuotePdf(data: QuotePdfData): Promise<Buffer> {
  const el = createElement(QuotePdf, { data }) as unknown as ReactElement<DocumentProps>;
  return await renderToBuffer(el);
}
