/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "pdfmake/build/pdfmake" {
  const pdfMake: {
    vfs: Record<string, string>;
    createPdf: (docDef: any) => { download: (filename: string) => void };
  };
  export default pdfMake;
}

declare module "pdfmake/build/vfs_fonts" {
  const pdfFonts: { vfs: Record<string, string> };
  export default pdfFonts;
}

declare module "react-simple-maps" {
  import type { ReactNode, MouseEvent, CSSProperties, ReactElement } from "react";

  export interface ComposableMapProps {
    projection?: string;
    style?: CSSProperties;
    children?: ReactNode;
  }
  export function ComposableMap(props: ComposableMapProps): ReactElement;

  export interface ZoomableGroupProps {
    zoom?: number;
    center?: [number, number];
    children?: ReactNode;
  }
  export function ZoomableGroup(props: ZoomableGroupProps): ReactElement;

  export interface RSMGeography {
    rsmKey: string;
    geometry: unknown;
    properties: Record<string, unknown>;
  }

  export interface GeographiesRenderProps {
    geographies: RSMGeography[];
  }

  export interface GeographiesProps {
    geography: string | Record<string, unknown>;
    children: (args: GeographiesRenderProps) => ReactNode;
  }
  export function Geographies(props: GeographiesProps): ReactElement;

  export interface GeographyStyleEntry {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    outline?: string;
  }

  export interface GeographyProps {
    key?: string;
    geography: RSMGeography;
    style?: {
      default?: GeographyStyleEntry;
      hover?: GeographyStyleEntry;
      pressed?: GeographyStyleEntry;
    };
  }
  export function Geography(props: GeographyProps): ReactElement;

  export interface MarkerProps {
    coordinates: [number, number];
    onMouseEnter?: (event: MouseEvent<SVGGElement>) => void;
    onMouseLeave?: (event: MouseEvent<SVGGElement>) => void;
    children?: ReactNode;
  }
  export function Marker(props: MarkerProps): ReactElement;
}
