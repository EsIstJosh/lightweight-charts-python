import {
    ColorType,
    CrosshairMode,
    IChartApi,
    ISeriesApi,
    ISeriesPrimitive,
    LogicalRange,
    LogicalRangeChangeEventHandler,
    MouseEventHandler,
    MouseEventParams,
    SeriesType,
    Time,
    createChart,


} from "lightweight-charts";
import { FillArea } from "../fill-area/fill-area";
import { GlobalParams, globalParamInit, LegendItem } from "./global-params";
import { Legend } from "./legend";
import { ToolBox } from "./toolbox";
import { TopBar } from "./topbar";

import { TooltipPrimitive } from "../tooltip/tooltip";

import { ContextMenu } from "../context-menu/context-menu";

import { ensureExtendedSeries } from "../helpers/typeguards";
// Define shared extended options

import {
    AreaSeriesOptions,
    BarSeriesOptions,
    HistogramSeriesOptions,
    ISeriesApiExtended,
    LineSeriesOptions,
    decorateSeries
} from "../helpers/general";
import { ohlcSeriesOptions, ohlcdefaultOptions, ohlcSeries } from "../ohlc-series/ohlc-series";
//import { TradeSeriesOptions, tradeDefaultOptions, TradeSeries } from "../tx-series/renderer";





globalParamInit();
declare const window: GlobalParams;
export interface Scale {
    width: number;
    height: number;
}

export class Handler {
    public id: string;
    public commandFunctions: Function[] = [];
    public static handlers: Map<string, Handler> = new Map();

    public seriesOriginMap: WeakMap<ISeriesApi<any>, ISeriesApi<any>> =
        new WeakMap();

    public wrapper: HTMLDivElement;
    public div: HTMLDivElement;

    public chart: IChartApi;
    public scale: Scale;
    public precision: number = 2;

    public series: ISeriesApiExtended;
    public volumeSeries: ISeriesApiExtended;

    public legend: Legend;
    private _topBar: TopBar | undefined;
    public toolBox: ToolBox | undefined;
    public spinner: HTMLDivElement | undefined;

    public _seriesList: ISeriesApi<SeriesType>[] = [];
    public seriesMap: Map<string, ISeriesApiExtended> = new Map();
    public seriesMetadata: WeakMap<
        ISeriesApi<any>,
        { name: string; type: string }
    >;

    // Add a property for the SeriesContextMenu
    public ContextMenu!: ContextMenu;

    public currentMouseEventParams: MouseEventParams<any> | null = null;

    // Map to store pending options for saving

    // TODO find a better solution rather than the 'position' parameter
    constructor(
        chartId: string,
        innerWidth: number,
        innerHeight: number,
        position: string,
        autoSize: boolean
    ) {
        this.reSize = this.reSize.bind(this)

        this.id = chartId
        this.scale = {
            width: innerWidth,
            height: innerHeight,

        };

        Handler.handlers.set(chartId, this);

        this.wrapper = document.createElement('div')
        this.wrapper.classList.add("handler");
        this.wrapper.style.float = position

        this.div = document.createElement('div')
        this.div.style.position = 'relative'

        this.wrapper.appendChild(this.div);
        window.containerDiv.append(this.wrapper)

        this.chart = this._createChart();
        this.series = this.createCandlestickSeries();
        this.volumeSeries = this.createVolumeSeries();
        this.series.applyOptions;
        this.legend = new Legend(this);
        // Inside Handler class constructor

        // Setup MouseEventParams tracking
        this.chart.subscribeCrosshairMove((param: MouseEventParams) => {
            this.currentMouseEventParams = param;
            window.MouseEventParams = param;
        });

        document.addEventListener("keydown", (event) => {
            for (let i = 0; i < this.commandFunctions.length; i++) {
                if (this.commandFunctions[i](event)) break;
            }
        });
        window.handlerInFocus = this.id;
        this.wrapper.addEventListener("mouseover", () => {
            window.handlerInFocus = this.id;
            window.MouseEventParams = this.currentMouseEventParams || null; // Default to null if undefined
        });
        this.seriesMetadata = new WeakMap();

        this.reSize();
        if (!autoSize) return;
        window.addEventListener("resize", () => this.reSize());

        // Setup MouseEventParams tracking
        this.chart.subscribeCrosshairMove((param: MouseEventParams) => {
            this.currentMouseEventParams = param;
        });
        this.ContextMenu = new ContextMenu(
            this,
            Handler.handlers, // handlers: Map<string, Handler>
            () => window.MouseEventParams ?? null // Ensure it returns null if undefined
        );
    }


    reSize() {
        let topBarOffset =
            this.scale.height !== 0 ? this._topBar?._div.offsetHeight || 0 : 0;
        this.chart.resize(
            window.innerWidth * this.scale.width,
            window.innerHeight * this.scale.height - topBarOffset
        );
        this.wrapper.style.width = `${100 * this.scale.width}%`;
        this.wrapper.style.height = `${100 * this.scale.height}%`;

        // TODO definitely a better way to do this
        if (this.scale.height === 0 || this.scale.width === 0) {
            // if (this.legend.div.style.display == 'flex') this.legend.div.style.display = 'none'
            if (this.toolBox) {
                this.toolBox.div.style.display = 'none'
            }
        }
        else {
            // this.legend.div.style.display = 'flex'
            if (this.toolBox) {
                this.toolBox.div.style.display = 'flex'
            }
        }
    }
    public primitives: Map<ISeriesApi<SeriesType>, ISeriesPrimitive> = new Map(); // Map of plugin primitive instances by series name
    private _createChart() {
        return createChart(this.div, {
            width: window.innerWidth * this.scale.width,
            height: window.innerHeight * this.scale.height,
            layout: {
                textColor: window.pane.color,
                background: {
                    color: '#000000',
                    type: ColorType.Solid,
                },
                fontSize: 12
            },
            rightPriceScale: {
                scaleMargins: { top: 0.3, bottom: 0.25 },
            },
            timeScale: { timeVisible: true, secondsVisible: false },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: {
                    labelBackgroundColor: 'rgb(46, 46, 46)'
                },
                horzLine: {
                    labelBackgroundColor: 'rgb(55, 55, 55)'
                }
            },
            grid: {
                vertLines: { color: 'rgba(29, 30, 38, 5)' },
                horzLines: { color: 'rgba(29, 30, 58, 5)' },
            },
            handleScroll: { vertTouchDrag: true },
        })
    }

    createCandlestickSeries() {
        const up = "rgba(39, 157, 130, 100)";
        const down = "rgba(200, 97, 100, 100)";
        const candleSeries = this.chart.addCandlestickSeries({
            upColor: up,
            borderUpColor: up,
            wickUpColor: up,
            downColor: down,
            borderDownColor: down,
            wickDownColor: down,
        });
        candleSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.2, bottom: 0.2 },
        });
        // Decorate and store info
        const decorated = decorateSeries(candleSeries, this.legend);
        decorated.applyOptions({ title: "candles" });


        return decorated; // Return the decorated series for further use
    }

    createVolumeSeries() {
        const volumeSeries = this.chart.addHistogramSeries({
            color: "#26a69a",
            priceFormat: { type: "volume" },
            priceScaleId: "volume_scale",
        });
        volumeSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
        });

        const decorated = decorateSeries(volumeSeries, this.legend);
        decorated.applyOptions({ title: "Volume" });

        return decorated;
    }

    createLineSeries(
        name: string,
        options: LineSeriesOptions
    ): { name: string; series: ISeriesApi<SeriesType> } {
        const { group, legendSymbol = "▨", ...lineOptions } = options;
        const line = this.chart.addLineSeries(lineOptions);

        const decorated = decorateSeries(line, this.legend);
        decorated.applyOptions({ title: name });
        this._seriesList.push(decorated);
        this.seriesMap.set(name, decorated);

        const color = decorated.options().color || "rgba(255,0,0,1)";
        const solidColor = color.startsWith("rgba")
            ? color.replace(/[^,]+(?=\))/, "1")
            : color;

        const legendItem: LegendItem = {
            name,
            series: decorated,
            colors: [solidColor],
            legendSymbol: Array.isArray(legendSymbol) ? legendSymbol : legendSymbol ? [legendSymbol] : [],
            seriesType: "Line",
            group,
        };

        this.legend.addLegendItem(legendItem);

        return { name, series: decorated };
    }

    createHistogramSeries(
        name: string,
        options: HistogramSeriesOptions
    ): { name: string; series: ISeriesApi<SeriesType> } {
        const { group, legendSymbol = "▨", ...histogramOptions } = options;
        const histogram = this.chart.addHistogramSeries(histogramOptions);

        // Decorate the series (if your implementation decorates series)
        const decorated = decorateSeries(histogram, this.legend);
        decorated.applyOptions({ title: name });
        this._seriesList.push(decorated);
        this.seriesMap.set(name, decorated);

        // Extract or determine the color for the legend
        const color = decorated.options().color || "rgba(255,0,0,1)";
        const solidColor = color.startsWith("rgba")
            ? color.replace(/[^,]+(?=\))/, "1") // Convert to solid color if rgba
            : color;

        // Create the legend item for the histogram
        const legendItem: LegendItem = {
            name,
            series: decorated,
            colors: [solidColor],
            legendSymbol: Array.isArray(legendSymbol) ? legendSymbol : [legendSymbol],
            seriesType: "Histogram", // Specify the series type
            group,
        };

        // Add the legend item to the legend
        this.legend.addLegendItem(legendItem);

        return { name, series: decorated };
    }


    createAreaSeries(
        name: string,
        options: AreaSeriesOptions
    ): { name: string; series: ISeriesApi<SeriesType> } {
        const { group, legendSymbol = "▨", ...areaOptions } = options;
        const area = this.chart.addAreaSeries(areaOptions);

        const decorated = decorateSeries(area, this.legend);

        this._seriesList.push(decorated);
        this.seriesMap.set(name, decorated);

        const color = decorated.options().lineColor || "rgba(255,0,0,1)";
        const solidColor = color.startsWith("rgba")
            ? color.replace(/[^,]+(?=\))/, "1")
            : color;

        const legendItem: LegendItem = {
            name,
            series: decorated,
            colors: [solidColor],
            legendSymbol: Array.isArray(legendSymbol) ? legendSymbol : legendSymbol ? [legendSymbol] : [],
            seriesType: "Area",
            group,
        };

        this.legend.addLegendItem(legendItem);

        return { name, series: decorated };
    }



    createBarSeries(
        name: string,
        options: BarSeriesOptions
    ): { name: string; series: ISeriesApi<SeriesType> } {
        const { group, legendSymbol = ["▨", "▨"], ...barOptions } = options;
        const bar = this.chart.addBarSeries(barOptions);

        const decorated = decorateSeries(bar, this.legend);
        decorated.applyOptions({ title: name });
        this._seriesList.push(decorated);
        this.seriesMap.set(name, decorated);

        const upColor = (decorated.options() as any).upColor || "rgba(0,255,0,1)";
        const downColor =
            (decorated.options() as any).downColor || "rgba(255,0,0,1)";

        const legendItem: LegendItem = {
            name,
            series: decorated,
            colors: [upColor, downColor],
            legendSymbol: Array.isArray(legendSymbol) ? legendSymbol : legendSymbol ? [legendSymbol] : [],
            seriesType: "Bar",
            group,
        };

        this.legend.addLegendItem(legendItem);

        return { name, series: bar };
    }

    createCustomOHLCSeries(
        name: string,
        options: Partial<ohlcSeriesOptions> = {}
    ): { name: string; series: ISeriesApi<SeriesType> } {
        const seriesType = 'Ohlc';

        const mergedOptions: ohlcSeriesOptions & {
            seriesType?: string;
            group?: string;
            legendSymbol?: string[];
        } = {
            ...ohlcdefaultOptions,
            ...options,
            seriesType,
        };

        const {
            group,
            legendSymbol = ['⑃', '⑂'],
            seriesType: _,
            chandelierSize = 1,
            ...filteredOptions
        } = mergedOptions;

        const Instance = new ohlcSeries();
        const ohlcCustomSeries = this.chart.addCustomSeries(Instance, {
            ...filteredOptions,
            chandelierSize,
        });

        const decorated = decorateSeries(ohlcCustomSeries, this.legend);
        this._seriesList.push(decorated);
        this.seriesMap.set(name, decorated);

        const borderUpColor = mergedOptions.borderUpColor || mergedOptions.upColor;
        const borderDownColor = mergedOptions.borderDownColor || mergedOptions.downColor;

        const colorsArray = [borderUpColor, borderDownColor];

        const legendSymbolsWithGrouping = legendSymbol.map((symbol, index) =>
            index === legendSymbol.length - 1 && chandelierSize > 1
                ? `${symbol} (${chandelierSize})`
                : symbol
        );

        const legendItem: LegendItem = {
            name,
            series: decorated,
            colors: colorsArray,
            legendSymbol: legendSymbolsWithGrouping,
            seriesType,
            group,
        };

        this.legend.addLegendItem(legendItem);

        return { name, series: ohlcCustomSeries };
    }

    //createTradeSeries(
    //    name: string,
    //    options: Partial<TradeSeriesOptions> = {}
    //): { name: string; series: ISeriesApi<SeriesType> } {
    //    const seriesType = 'Trade'; // A custom identifier for this series type
//
    //    // Merge provided options with default options
    //    const mergedOptions: TradeSeriesOptions & {
    //        seriesType?: string;
    //        group?: string;
    //        legendSymbol?: string[] | string;
    //    } = {
    //        ...tradeDefaultOptions,
    //        ...options,
    //        seriesType
    //    };
//
    //    const {
    //        group,
    //        legendSymbol = ['$'],
    //        seriesType: _,
    //        ...filteredOptions
    //    } = mergedOptions;
//
    //    // Create a new TradeSeries instance
    //    const instance = new TradeSeries();
    //    // Add the custom series to the chart
    //    const tradeCustomSeries = this.chart.addCustomSeries(instance, filteredOptions);
//
    //    // Decorate the series (assuming `decorateSeries` and `this.legend` are defined)
    //    const decorated = decorateSeries(tradeCustomSeries, this.legend);
    //    this._seriesList.push(decorated);
    //    this.seriesMap.set(name ?? 'Trade', decorated);
//
    //    // For the legend colors, now we only have backgroundColorStop and backgroundColorTarget.
    //    // We can provide these two as representative colors. If you want a third color, you may pick one of them again or define another logic.
    //    const colorsArray = [
    //        mergedOptions.backgroundColorStop,
    //        mergedOptions.backgroundColorTarget
    //    ];
//
    //    const finalLegendSymbol = Array.isArray(legendSymbol) ? legendSymbol : [legendSymbol];
//
    //    const legendItem: LegendItem = {
    //        name: name,
    //        series: decorated,
    //        colors: colorsArray,
    //        legendSymbol: finalLegendSymbol,
    //        seriesType,
    //        group,
    //    };
//
    //    // Add legend item
    //    this.legend.addLegendItem(legendItem);
//
    //    return { name, series: tradeCustomSeries };
    //}
//

    createFillArea(
        name: string,
        origin: string, // ID or key for the origin series
        destination: string, // ID or key for the destination series
        originColor?: string, // Optional; will use defaults if not provided
        destinationColor?: string, // Optional; will use defaults if not provided
    ): ISeriesPrimitive | undefined {
        // Find origin and destination series
        const originSeries = this._seriesList.find(s => (s as ISeriesApi<SeriesType>).options()?.title === origin);

        const destinationSeries = this._seriesList.find(s => (s as ISeriesApi<SeriesType>).options()?.title === destination);

        if (!originSeries) {
            console.warn(`Origin series with title "${origin}" not found.`);
            return undefined;
        }

        if (!destinationSeries) {
            console.warn(`Destination series with title "${destination}" not found.`);
            return undefined;
        }
        // Ensure the origin series is extended
        const extendedOriginSeries = ensureExtendedSeries(originSeries, this.legend);

        // Create a FillArea instance with the provided options
        const fillArea = new FillArea(originSeries, destinationSeries, {
            originColor: originColor || null, // Default to blue with 30% opacity
            destinationColor: destinationColor || null, // Default to red with 30% opacity
            lineWidth: null, // Default line width if not specified
        });

        // Attach the FillArea primitive to the origin series
        extendedOriginSeries.attachPrimitive(fillArea, name);


        // Return the created primitive
        return fillArea;
    }


    attachPrimitive(
        lineColor: string,
        primitiveType: "Tooltip" | "DeltaTooltip",
        series?: ISeriesApiExtended | ISeriesApi<SeriesType>,
        seriesName?: string
    ): void {
        let _series = series
        try {
            if (seriesName && !series) {
                _series = this.seriesMap.get(seriesName);
            }

            if (!_series) {
                console.warn(`Series with the name "${seriesName}" not found.`);
                return;
            }
            const extendedSeries = ensureExtendedSeries(_series, this.legend);
            let primitiveInstance: ISeriesPrimitive;
            switch (primitiveType) {
                case "Tooltip":
                    primitiveInstance = new TooltipPrimitive({ lineColor });
                    break;

                default:
                    console.warn(`Unknown primitive type: ${primitiveType}`);
                    return;
            }

            extendedSeries.attachPrimitive(primitiveInstance, "Tooltip");
            this.primitives.set(_series, primitiveInstance);
            //console.log(`${primitiveType} attached to`, seriesName);
        } catch (error) {
            console.error(`Failed to attach ${primitiveType}:`, error);
        }
    }
    removeSeries(seriesName: string): void {
        const series = this.seriesMap.get(seriesName);
        if (series) {
            // Remove the series from the chart
            this.chart.removeSeries(series);

            // Remove from _seriesList
            this._seriesList = this._seriesList.filter(s => s !== series);

            // Remove from seriesMap
            this.seriesMap.delete(seriesName);

            // Remove from legend
            this.legend.deleteLegendEntry(seriesName);



            console.log(`Series "${seriesName}" removed.`);


        }
    }

    createToolBox() {
        this.toolBox = new ToolBox(this, this.id, this.chart, this.series, this.commandFunctions);
        this.div.appendChild(this.toolBox.div);
    }

    createTopBar() {
        this._topBar = new TopBar(this);
        this.wrapper.prepend(this._topBar._div)
        return this._topBar;
    }

    toJSON() {
        // Exclude the chart attribute from serialization
        const { chart, ...serialized } = this;
        return serialized;
    }
    /**
     * Extracts data from a series in a format suitable for indicators.
     * @param series - The series to extract data from.
     * @returns An array of arrays containing `time` and `close` values.
     */
    public extractSeriesData(series: ISeriesApi<SeriesType>): any[][] {
        const seriesData = series.data(); // Ensure this retrieves the data from the series.
        if (!Array.isArray(seriesData)) {
            console.warn(
                "Failed to extract data: series data is not in array format."
            );
            return [];
        }

        // Convert data into an array of arrays
        return seriesData.map((point: any) => [
            point.time,
            point.value || point.close || 0,
        ]);
    }


    public static syncCharts(
        childChart: Handler,
        parentChart: Handler,
        crosshairOnly = false
    ) {
        function crosshairHandler(chart: Handler, point: any) {
            //point: BarData | LineData) {
            if (!point) {
                chart.chart.clearCrosshairPosition()
                return
            }
            // TODO fix any point ?
            chart.chart.setCrosshairPosition(point.value || point!.close, point.time, chart.series);
            chart.legend.legendHandler(point, true)
        }

        function getPoint(series: ISeriesApi<SeriesType>, param: MouseEventParams) {
            if (!param.time) return null;
            return param.seriesData.get(series) || null;
        }

        const childTimeScale = childChart.chart.timeScale();
        const parentTimeScale = parentChart.chart.timeScale();

        const setChildRange = (timeRange: LogicalRange | null) => {
            if (timeRange) childTimeScale.setVisibleLogicalRange(timeRange);
        }
        const setParentRange = (timeRange: LogicalRange | null) => {
            if (timeRange) parentTimeScale.setVisibleLogicalRange(timeRange);
        }

        const setParentCrosshair = (param: MouseEventParams) => {
            crosshairHandler(parentChart, getPoint(childChart.series, param))
        }
        const setChildCrosshair = (param: MouseEventParams) => {
            crosshairHandler(childChart, getPoint(parentChart.series, param))
        }

        let selected = parentChart
        function addMouseOverListener(
            thisChart: Handler,
            otherChart: Handler,
            thisCrosshair: MouseEventHandler<Time>,
            otherCrosshair: MouseEventHandler<Time>,
            thisRange: LogicalRangeChangeEventHandler,
            otherRange: LogicalRangeChangeEventHandler) {
            thisChart.wrapper.addEventListener('mouseover', () => {
                if (selected === thisChart) return
                selected = thisChart
                otherChart.chart.unsubscribeCrosshairMove(thisCrosshair)
                thisChart.chart.subscribeCrosshairMove(otherCrosshair)
                if (crosshairOnly) return;
                otherChart.chart.timeScale().unsubscribeVisibleLogicalRangeChange(thisRange)
                thisChart.chart.timeScale().subscribeVisibleLogicalRangeChange(otherRange)
            })
        }
        addMouseOverListener(
            parentChart,
            childChart,
            setParentCrosshair,
            setChildCrosshair,
            setParentRange,
            setChildRange
        )
        addMouseOverListener(
            childChart,
            parentChart,
            setChildCrosshair,
            setParentCrosshair,
            setChildRange,
            setParentRange
        )

        parentChart.chart.subscribeCrosshairMove(setChildCrosshair)

        const parentRange = parentTimeScale.getVisibleLogicalRange()
        if (parentRange) childTimeScale.setVisibleLogicalRange(parentRange)

        if (crosshairOnly) return;
        parentChart.chart.timeScale().subscribeVisibleLogicalRangeChange(setChildRange)
    }

    public static makeSearchBox(chart: Handler) {
        const searchWindow = document.createElement('div')
        searchWindow.classList.add('searchbox');
        searchWindow.style.display = 'none';

        const magnifyingGlass = document.createElement('div');
        magnifyingGlass.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="24px" height="24px" viewBox="0 0 24 24" version="1.1"><path style="fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke:lightgray;stroke-opacity:1;stroke-miterlimit:4;" d="M 15 15 L 21 21 M 10 17 C 6.132812 17 3 13.867188 3 10 C 3 6.132812 6.132812 3 10 3 C 13.867188 3 17 6.132812 17 10 C 17 13.867188 13.867188 17 10 17 Z M 10 17 "/></svg>`

        const sBox = document.createElement('input');
        sBox.type = 'text';

        searchWindow.appendChild(magnifyingGlass)
        searchWindow.appendChild(sBox)
        chart.div.appendChild(searchWindow);

        chart.commandFunctions.push((event: KeyboardEvent) => {
            if (window.handlerInFocus !== chart.id || window.textBoxFocused) return false
            if (searchWindow.style.display === 'none') {
                if (/^[a-zA-Z0-9]$/.test(event.key)) {
                    searchWindow.style.display = 'flex';
                    sBox.focus();
                    return true
                }
                else return false
            }
            else if (event.key === 'Enter' || event.key === 'Escape') {
                if (event.key === 'Enter') window.callbackFunction(`search${chart.id}_~_${sBox.value}`)
                searchWindow.style.display = 'none'
                sBox.value = ''
                return true
            }
            else return false
        })
        sBox.addEventListener('input', () => sBox.value = sBox.value.toUpperCase())
        return {
            window: searchWindow,
            box: sBox,
        }
    }

    public static makeSpinner(chart: Handler) {
        chart.spinner = document.createElement('div');
        chart.spinner.classList.add('spinner');
        chart.wrapper.appendChild(chart.spinner)

        // TODO below can be css (animate)
        let rotation = 0;
        const speed = 10;
        function animateSpinner() {
            if (!chart.spinner) return;
            rotation += speed
            chart.spinner.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`
            requestAnimationFrame(animateSpinner)
        }
        animateSpinner();
    }

    private static readonly _styleMap = {
        '--bg-color': 'backgroundColor',
        '--hover-bg-color': 'hoverBackgroundColor',
        '--click-bg-color': 'clickBackgroundColor',
        '--active-bg-color': 'activeBackgroundColor',
        '--muted-bg-color': 'mutedBackgroundColor',
        '--border-color': 'borderColor',
        '--color': 'color',
        '--active-color': 'activeColor',
    }
    public static setRootStyles(styles: any) {
        const rootStyle = document.documentElement.style;
        for (const [property, valueKey] of Object.entries(this._styleMap)) {
            rootStyle.setProperty(property, styles[valueKey]);
        }
    }

}
