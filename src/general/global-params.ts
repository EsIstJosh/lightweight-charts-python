import { MouseEventParams,  ISeriesPrimitive } from "lightweight-charts";
import { ISeriesApiExtended } from "../helpers/general";
export interface GlobalParams extends Window {
    pane: paneStyle;    // TODO shouldnt need this cause of css variables
    handlerInFocus: string;
    textBoxFocused: boolean;
    callbackFunction: Function;
    containerDiv: HTMLElement;
    setCursor: Function;
    cursor: string;
    MouseEventParams?: MouseEventParams| null; // Allow null values
}

interface paneStyle {
    backgroundColor: string;
    hoverBackgroundColor: string;
    clickBackgroundColor: string;
    activeBackgroundColor: string;
    mutedBackgroundColor: string;
    borderColor: string;
    color: string;
    activeColor: string;
}

export const paneStyleDefault: paneStyle = {
    backgroundColor: '#0c0d0f',
    hoverBackgroundColor: '#3c434c',
    clickBackgroundColor: '#50565E',
    activeBackgroundColor: 'rgba(0, 122, 255, 0.7)',
    mutedBackgroundColor: 'rgba(0, 122, 255, 0.3)',
    borderColor: '#3C434C',
    color: '#d8d9db',
    activeColor: '#ececed',
}

declare const window: GlobalParams;

export function globalParamInit() {
    window.pane = {
        ...paneStyleDefault,
    }
    window.containerDiv = document.getElementById("container") || document.createElement('div');
    window.setCursor = (type: string | undefined) => {
        if (type) window.cursor = type;
        document.body.style.cursor = window.cursor;
    }
    window.cursor = 'default';
    window.textBoxFocused = false;
}

export const setCursor = (type: string | undefined) => {
    if (type) window.cursor = type;
    document.body.style.cursor = window.cursor;
}
export interface LegendItem<T = unknown> {
    name: string;
    series: ISeriesApiExtended;
    colors: string[];
    legendSymbol: string[];
    seriesType?: string;
    group?: string;  // Optional attribute to indicate the group the item belongs to
    extraData?: T;   // Optional field for additional data of any type
    primitives?: LegendPrimitive[]; // Attached primitives

}

export interface LegendGroup {
    name: string;
    seriesList: LegendSeries[];
    subGroups: LegendGroup[];      // Allow nested groups
    div: HTMLDivElement;
    row: HTMLDivElement;
    toggle: HTMLDivElement;
    isVersionGroup?: boolean;       // Indicates if this group handles versioned (peer) series
    cycleLeft?: HTMLDivElement;     // Arrow to cycle left
    cycleRight?: HTMLDivElement;    // Arrow to cycle right
    currentPeerIndex?: number;      // Current peer index for version groups
}

export interface LegendSeries extends LegendItem {
    div?: HTMLDivElement;
    row?: HTMLDivElement;
    toggle?: HTMLDivElement;
    contains?:HTMLDivElement
}


export interface LegendPrimitive {
    name: string;
    primitive: ISeriesPrimitive;
    div?: HTMLDivElement; // Primitive info container
    row?: HTMLDivElement; // Row in the legend
    toggle?: HTMLDivElement; // Visibility toggle
}

export const openEye = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="18" viewBox="0 0 24 24">
    <path style="fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke:#000;stroke-opacity:1;stroke-miterlimit:4;" 
          d="M 21.998437 12 C 21.998437 12 18.998437 18 12 18 
             C 5.001562 18 2.001562 12 2.001562 12 
             C 2.001562 12 5.001562 6 12 6 
             C 18.998437 6 21.998437 12 21.998437 12 Z" />
    <path style="fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke:#000;stroke-opacity:1;stroke-miterlimit:4;" 
          d="M 15 12 
             C 15 13.654687 13.654687 15 12 15 
             C 10.345312 15 9 13.654687 9 12 
             C 9 10.345312 10.345312 9 12 9 
             C 13.654687 9 15 10.345312 15 12 Z" />
</svg>
`;

export const closedEye = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="18" viewBox="0 0 24 24">
 <path style="fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke:#000;stroke-opacity:1;stroke-miterlimit:4;" 
          d="M 3 3 L 21 21" />
    <path style="fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke:#000;stroke-opacity:1;stroke-miterlimit:4;" 
          d="M 21.998437 12 
             C 21.998437 12 18.998437 18 12 18 
             C 5.001562 18 2.001562 12 2.001562 12 
             C 2.001562 12 5.001562 6 12 6 
             C 14.211 6 16.106 6.897 17.7 8.1" />
    <path style="fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke:#000;stroke-opacity:1;stroke-miterlimit:4;" 
          d="M 9.9 9.9 
             C 9.367 10.434 9 11.178 9 12 
             C 9 13.654687 10.345312 15 12 15 
             C 12.822 15 13.566 14.633 14.1 14.1" />
</svg>
`;

