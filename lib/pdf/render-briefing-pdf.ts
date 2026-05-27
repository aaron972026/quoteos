import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { BriefingPdf, type BriefingPdfData } from "./BriefingPdf";

/**
 * Render the estimator briefing PDF to a Buffer. Same pattern as
 * render-quote-pdf — Node runtime only, sent as an email attachment.
 */
export async function renderBriefingPdf(data: BriefingPdfData): Promise<Buffer> {
  const el = createElement(BriefingPdf, { data }) as unknown as ReactElement<DocumentProps>;
  return await renderToBuffer(el);
}
