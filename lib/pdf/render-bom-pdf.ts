import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { BomPdf, type BomPdfData } from "./BomPdf";

export async function renderBomPdf(data: BomPdfData): Promise<Buffer> {
  const el = createElement(BomPdf, { data }) as unknown as ReactElement<DocumentProps>;
  return await renderToBuffer(el);
}
