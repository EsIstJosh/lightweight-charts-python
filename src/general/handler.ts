import {
    AreaSeries,
    BarSeries,
    CandlestickSeries,
    ColorType,
    CrosshairMode,
    HistogramSeries,
    IChartApi,
    ISeriesApi,
    ISeriesPrimitive,
    LineSeries,
    LogicalRange,
    LogicalRangeChangeEventHandler,
    MouseEventHandler,
    MouseEventParams,
    SeriesType,
    Time,
    createChart,
    ChartOptions
} from "lightweight-charts";
import { FillArea } from "../fill-area/fill-area";
import { GlobalParams, globalParamInit, LegendItem, LegendPrimitive, LegendSeries } from "./global-params";
import { Legend } from "./legend";
import { ToolBox } from "./toolbox";
import { TopBar } from "./topbar";

import { TooltipPrimitive } from "../tooltip/tooltip";

import { ContextMenu } from "../context-menu/context-menu";

import { ensureExtendedSeries } from "../helpers/series";
// Define shared extended options

import {
    AreaSeriesOptions,
    BarSeriesOptions,
    HistogramSeriesOptions,
    ISeriesApiExtended,
    LineSeriesOptions,
    decorateSeries,

} from "../helpers/series";
import { ohlcSeriesOptions, ohlcdefaultOptions, ohlcSeries } from "../ohlc-series/ohlc-series";
import { isISeriesApi } from "../helpers/typeguards";
import { DefaultOptionsManager } from "./defaults";
// Import our helper to get built–in defaults for each series type
import { SupportedSeriesType, getDefaultSeriesOptions } from "../helpers/series";
import { ColorPicker } from "../context-menu/color-picker_";
import { PineScriptManager } from "./scripts";

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
    public volumeUpColor: string | null = null
    public volumeDownColor: string| null = null
    public legend: Legend;
    private _topBar: TopBar | undefined;
    public toolBox: ToolBox | undefined;
    public spinner: HTMLDivElement | undefined;
    public width : number | null = null
    public height : number | null = null
    public _seriesList: ISeriesApiExtended[] = [];
    public seriesMap: Map<string, ISeriesApiExtended> = new Map();
    public seriesMetadata: WeakMap<ISeriesApi<any>, { name: string; type: string }>;
    public colorPicker: ColorPicker|null = null  
    // Series context menu
    public ContextMenu!: ContextMenu;

    public currentMouseEventParams: MouseEventParams<any> | null = null;

    public defaultsManager: DefaultOptionsManager;
    public scriptsManager: PineScriptManager;
    // TODO find a better solution rather than the 'position' parameter
    constructor(
        chartId: string,
        innerWidth: number,
        innerHeight: number,
        position: string,
        autoSize: boolean,
    ) {
        this.reSize = this.reSize.bind(this);

        this.id = chartId;
        this.scale = {
            width: innerWidth,
            height: innerHeight,

        };        
        
        this.defaultsManager = new DefaultOptionsManager();
        this.scriptsManager = new PineScriptManager()
        Handler.handlers.set(chartId, this);

        this.wrapper = document.createElement('div');
        this.wrapper.classList.add("handler");
        this.wrapper.style.float = position;

        this.div = document.createElement('div');
        this.div.style.position = 'relative';

        this.wrapper.appendChild(this.div);
        window.containerDiv.append(this.wrapper);

        this.chart = this._createChart();
        this.ContextMenu = new ContextMenu(
            this,
            Handler.handlers, // handlers: Map<string, Handler>
            () => window.MouseEventParams ?? null // returns null if undefined
        );
        this.legend = new Legend(this);


        // Create series using merged options.
        this.series = this.createCandlestickSeries();
        this.volumeSeries = this.createVolumeSeries();

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
            window.MouseEventParams = this.currentMouseEventParams || null;
        });
        this.seriesMetadata = new WeakMap();

        this.reSize();
        if (!autoSize) return;
        window.addEventListener("resize", () => this.reSize());
        window.monaco = false
        // Additional MouseEventParams tracking
        this.chart.subscribeCrosshairMove((param: MouseEventParams) => {
            this.currentMouseEventParams = param;
        });
        
        
    }
    reSize() {
        let topBarOffset =
            this.scale.height !== 0 ? this._topBar?._div.offsetHeight || 0 : 0;
        this.width =             window.innerWidth * this.scale.width

        this.height =             window.innerHeight * this.scale.height - topBarOffset

        this.chart.resize(this.width,this.height,true);
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
                vertLine: { labelBackgroundColor: 'rgb(46, 46, 46)' },
                horzLine: { labelBackgroundColor: 'rgb(55, 55, 55)' }
            },
            grid: {
                vertLines: { color: 'rgba(29, 30, 38, 5)' },
                horzLines: { color: 'rgba(29, 30, 58, 5)' },
            },
            handleScroll: { vertTouchDrag: true },
        });
    }

    /**
     * Helper method to merge series options.
     * Merge order: { ...getDefaultSeriesOptions(type), ...fileDefaults, ...explicitOptions }
     *
     * @param type - The series type (SupportedSeriesType)
     * @param explicitOptions - Options provided explicitly
     */
    private mergeSeriesOptions<T>(type: SupportedSeriesType, explicitOptions: Partial<T>): T {
        // Get built–in defaults (base options)
        const baseOptions = getDefaultSeriesOptions(type) as T;
        // File defaults: lookup by lowercased type (e.g. "line", "area", etc.)
        const fileDefaults = this.defaultsManager.defaults.get(type.toLowerCase()) || {} as T;
        return { ...baseOptions, ...fileDefaults, ...explicitOptions };
    }

    /**
     * Creates a candlestick series using merged options.
     * (No explicit options provided; only built–in and file defaults are merged.)
     */
    createCandlestickSeries(): ISeriesApiExtended {
        const type: SupportedSeriesType = "Candlestick";
        // Merge built–in defaults and file defaults
        const baseOptions = getDefaultSeriesOptions(type);
        const fileDefaults = this.defaultsManager.defaults.get(type.toLowerCase()) || {};
        const mergedOptions = { ...baseOptions, ...fileDefaults } as Record<string, any>;

        const candleSeries = this.chart.addSeries(CandlestickSeries, mergedOptions);
        candleSeries.priceScale().applyOptions({ scaleMargins: { top: 0.2, bottom: 0.2 } });

        const decorated = decorateSeries(candleSeries, this.legend);
        decorated.applyOptions({ title: "OHLC" });
        this._seriesList.push(decorated);
        this.seriesMap.set("OHLC", decorated);


        const legendItem: LegendItem = {
            name: "OHLC",
            series: decorated,
            colors: [mergedOptions.upColor, mergedOptions.downColor],
            legendSymbol: ['⋰', '⋱'],
            seriesType: "Candlestick",
            group: undefined,
        };

        this.legend.addLegendItem(legendItem);
        return decorated;
    }

  
createVolumeSeries(pane?: number): ISeriesApiExtended {
    const volumeSeries = this.chart.addSeries(HistogramSeries, {
      color: "#26a69a",
      priceFormat: { type: "volume" },
      priceScaleId: "volume_scale",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0, bottom: 0.2 },
    });
    // Optionally, move the series to the desired pane.
    if (pane !== undefined) {
      volumeSeries.moveToPane(pane);
    }
  
    const decorated = decorateSeries(volumeSeries, this.legend);
    decorated.applyOptions({ title: "Volume" });
    return decorated;
  }
  
  /**
   * Creates a line series using merged options.
   * @param name The series title.
   * @param options Optional line series options.
   * @param pane Optional pane index to move the series to.
   */
  createLineSeries(name: string, options?: Partial<LineSeriesOptions>, pane?: number): { name: string; series: ISeriesApiExtended } {
    const mergedOptions = this.mergeSeriesOptions<LineSeriesOptions>("Line", options ?? {});
    
    const symbol = (() => {
      switch (mergedOptions.lineStyle) {
        case 0: return '―';
        case 1: return ':··';
        case 2: return '--';
        case 3: return '- -';
        case 4: return '· ·';
        default: return '~';
      }
    })();
  
    const { group, legendSymbol = symbol, ...lineOptions } = mergedOptions;
    const line = this.chart.addSeries(LineSeries, lineOptions);
  
    const decorated = decorateSeries(line, this.legend);
    decorated.applyOptions({ title: name });
    this._seriesList.push(decorated);
    this.seriesMap.set(name, decorated);
  
    const color = decorated.options().color || "rgba(255,0,0,1)";
    const solidColor = color.startsWith("rgba") ? color.replace(/[^,]+(?=\))/, "1") : color;
  
    const legendItem: LegendItem = {
      name,
      series: decorated,
      colors: [solidColor],
      legendSymbol: Array.isArray(legendSymbol) ? legendSymbol : [legendSymbol],
      seriesType: "Line",
      group,
    };
  
    this.legend.addLegendItem(legendItem);
    if (pane !== undefined) {
      decorated.moveToPane(pane);
    }
    return { name, series: decorated };
  }
  
  /**
   * Creates a histogram series using merged options.
   * @param name The series title.
   * @param options Optional histogram series options.
   * @param pane Optional pane index to move the series to.
   */
  createHistogramSeries(name: string, options?: Partial<HistogramSeriesOptions>, pane?: number): { name: string; series: ISeriesApiExtended } {
    const mergedOptions = this.mergeSeriesOptions<HistogramSeriesOptions>("Histogram", options ?? {});
    const { group, legendSymbol = "▨", ...histogramOptions } = mergedOptions;
    const histogram = this.chart.addSeries(HistogramSeries, histogramOptions);
  
    const decorated = decorateSeries(histogram, this.legend);
    decorated.applyOptions({ title: name });
    this._seriesList.push(decorated);
    this.seriesMap.set(name, decorated);
  
    const color = decorated.options().color || "rgba(255,0,0,1)";
    const solidColor = color.startsWith("rgba") ? color.replace(/[^,]+(?=\))/, "1") : color;
  
    const legendItem: LegendItem = {
      name,
      series: decorated,
      colors: [solidColor],
      legendSymbol: Array.isArray(legendSymbol) ? legendSymbol : [legendSymbol],
      seriesType: "Histogram",
      group,
    };
  
    this.legend.addLegendItem(legendItem);
    if (pane !== undefined) {
      decorated.moveToPane(pane);
    }
    return { name, series: decorated };
  }
  
  /**
   * Creates an area series using merged options.
   * @param name The series title.
   * @param options Optional area series options.
   * @param pane Optional pane index to move the series to.
   */
  createAreaSeries(name: string, options?: Partial<AreaSeriesOptions>, pane?: number): { name: string; series: ISeriesApiExtended } {
    const mergedOptions = this.mergeSeriesOptions<AreaSeriesOptions>("Area", options ?? {});
    const { group, legendSymbol = "▨", ...areaOptions } = mergedOptions;
    const area = this.chart.addSeries(AreaSeries, areaOptions);
  
    const decorated = decorateSeries(area, this.legend);
    this._seriesList.push(decorated);
    this.seriesMap.set(name, decorated);
  
    const color = decorated.options().lineColor || "rgba(255,0,0,1)";
    const solidColor = color.startsWith("rgba") ? color.replace(/[^,]+(?=\))/, "1") : color;
  
    const legendItem: LegendItem = {
      name,
      series: decorated,
      colors: [solidColor],
      legendSymbol: Array.isArray(legendSymbol) ? legendSymbol : [legendSymbol],
      seriesType: "Area",
      group,
    };
  
    this.legend.addLegendItem(legendItem);
    if (pane !== undefined) {
      decorated.moveToPane(pane);
    }
    return { name, series: decorated };
  }
  
  /**
   * Creates a bar series using merged options.
   * @param name The series title.
   * @param options Optional bar series options.
   * @param pane Optional pane index to move the series to.
   */
  createBarSeries(name: string, options?: Partial<BarSeriesOptions>, pane?: number): { name: string; series: ISeriesApiExtended } {
    const mergedOptions = this.mergeSeriesOptions<BarSeriesOptions>("Bar", options ?? {});
    const { group, legendSymbol = ['┌', '└'], ...barOptions } = mergedOptions;
    const bar = this.chart.addSeries(BarSeries, barOptions);
  
    const decorated = decorateSeries(bar, this.legend);
    decorated.applyOptions({ title: name });
    this._seriesList.push(decorated);
    this.seriesMap.set(name, decorated);
  
    const upColor = (decorated.options() as any).upColor || "rgba(0,255,0,1)";
    const downColor = (decorated.options() as any).downColor || "rgba(255,0,0,1)";
  
    const legendItem: LegendItem = {
      name,
      series: decorated,
      colors: [upColor, downColor],
      legendSymbol: Array.isArray(legendSymbol) ? legendSymbol : [legendSymbol],
      seriesType: "Bar",
      group,
    };
  
    this.legend.addLegendItem(legendItem);
    if (pane !== undefined) {
      decorated.moveToPane(pane);
    }
    return { name, series: decorated };
  }
  
  /**
   * Creates a custom OHLC series using merged options.
   * @param name The series title.
   * @param options Optional OHLC series options.
   * @param pane Optional pane index to move the series to.
   */
  createCustomOHLCSeries(name: string, options?: Partial<ohlcSeriesOptions>, pane?: number): { name: string; series: ISeriesApiExtended } {
    // Merge built–in defaults, file defaults, and explicit options for "Ohlc"
    const base = ohlcdefaultOptions;
    const fileDefaults = this.defaultsManager.defaults.get("ohlc") || {};
    
    const mergedOptions: ohlcSeriesOptions & { seriesType?: string; group?: string; legendSymbol?: string[] } = {
      ...base,
      ...fileDefaults,
      ...options,
      seriesType: 'Ohlc',
    };
  
    const { group, legendSymbol = ['⑃', '⑂'], seriesType: _, chandelierSize, ...filteredOptions } = mergedOptions;
  
    const Instance = new ohlcSeries();
    const ohlcCustomSeries = this.chart.addCustomSeries(Instance, {
      ...filteredOptions,
      chandelierSize,
      title: name
    });
  
    const decorated = decorateSeries(ohlcCustomSeries, this.legend);
    this._seriesList.push(decorated);
    this.seriesMap.set(name, decorated);
  
    const borderUpColor = mergedOptions.borderUpColor || mergedOptions.upColor;
    const borderDownColor = mergedOptions.borderDownColor || mergedOptions.downColor;
  
    const colorsArray = [borderUpColor, borderDownColor];
  
    const legendItem: LegendItem = {
      name,
      series: decorated,
      colors: colorsArray,
      legendSymbol: Array.isArray(legendSymbol) ? legendSymbol : legendSymbol ? [legendSymbol] : [],
      seriesType: 'Ohlc',
      group,
    };
  
    this.legend.addLegendItem(legendItem);
    if (pane !== undefined) {
      decorated.moveToPane(pane);
    }
    return { name, series: decorated };
  }
   // /**
   //  * Creates a trade series using merged options.
   //  */
   // createTradeSeries(name: string, options?: Partial<TradeSeriesOptions> = {}): { name: string; series: ISeriesApiExtended  } {
   //     const mergedoptions?: TradeSeriesOptions & { seriesType?: string; group?: string; legendSymbol?: string[] | string; } = {
   //         ...tradeDefaultOptions,
   //         ...this.defaultsManager.defaults.get("trade"),
   //         ...options,
   //         seriesType: 'Trade',
   //     };
//
   //     const { group, legendSymbol = ['$'], seriesType: _, ...filteredOptions } = mergedOptions;
//
   //     const instance = new TradeSeries();
   //     const tradeCustomSeries = this.chart.addCustomSeries(instance, filteredOptions);
//
   //     const decorated = decorateSeries(tradeCustomSeries, this.legend);
   //     this._seriesList.push(decorated);
   //     this.seriesMap.set(name ?? 'Trade', decorated);
//
   //     const colorsArray = [
   //         mergedOptions.backgroundColorStop,
   //         mergedOptions.backgroundColorTarget
   //     ];
   //     const finalLegendSymbol = Array.isArray(legendSymbol) ? legendSymbol : [legendSymbol];
//
   //     const legendItem: LegendItem = {
   //         name,
   //         series: decorated,
   //         colors: colorsArray,
   //         legendSymbol: finalLegendSymbol,
   //         seriesType: 'Trade',
   //         group,
   //     };
//
   //     this.legend.addLegendItem(legendItem);
//
   //     return { name, series: tradeCustomSeries };
   // }

    /**
     * Creates a fill area between two series.
     */
    createFillArea(name: string, origin: string, destination: string, originColor?: string, destinationColor?: string): ISeriesPrimitive | undefined {
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
        const extendedOriginSeries = ensureExtendedSeries(originSeries, this.legend);
        const fillArea = new FillArea(originSeries, destinationSeries, {
            originColor: originColor || null,
            destinationColor: destinationColor || null,
            lineWidth: null,
        });

        extendedOriginSeries.attachPrimitive(fillArea, name);

        return fillArea;
    }

    attachPrimitive(lineColor: string, primitiveType: "Tooltip" | "DeltaTooltip", series?: ISeriesApiExtended | ISeriesApi<SeriesType>, seriesName?: string): void {
        let _series = series;
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
        } catch (error) {
            console.error(`Failed to attach ${primitiveType}:`, error);
        }
    }

    removeSeries(series: string | ISeriesApiExtended): void {
        let seriesName: string | undefined;

        if (isISeriesApi(series)) {
            for (const [key, value] of this.seriesMap.entries()) {
                if (value === series) {
                    seriesName = key;
                    break;
                }
            }
        } else {
            seriesName = series;
            series = this.seriesMap.get(series) as ISeriesApiExtended;
        }

        if (!series || !seriesName) {
            console.warn(`❌ Series "${series}" does not exist and cannot be removed.`);
            return;
        }

        series = series as ISeriesApiExtended;

        if (series.primitives && series.primitives.length > 0) {
            series.primitives.forEach((primitive: ISeriesPrimitive) => {
                series.detachPrimitive(primitive);
                console.log(`✅ Detached primitive from series "${seriesName}".`);
            });
        }

        this._seriesList = this._seriesList.filter(s => s !== series);
        this.seriesMap.delete(seriesName);
        console.log(`✅ Series "${seriesName}" removed from internal maps.`);

        try {
            const legendItem = this.legend._items.find(
                (item) => (item as LegendSeries).series === series
            ) as LegendSeries | undefined;

            if (legendItem) {
                if (legendItem.primitives && legendItem.primitives.length > 0) {
                    legendItem.primitives.forEach((primitive: LegendPrimitive) => {
                        this.legend.removeLegendPrimitive(primitive);
                        console.log(`✅ Removed primitive from legend for series "${seriesName}".`);
                    });
                }
                this.legend.deleteLegendEntry(legendItem.name, legendItem.group ?? undefined);
                console.log(`✅ Removed series "${seriesName}" from legend.`);
            } else {
                console.warn(`⚠️ Legend item for series "${seriesName}" not found.`);
            }
        } catch (error) {
            console.error(`⚠️ Error removing legend entry for "${seriesName}":`, error);
        }

        this.chart.removeSeries(series);
        console.log(`✅ Series "${seriesName}" successfully removed.`);
    }

    createToolBox() {
        this.toolBox = new ToolBox(this, this.id, this.chart, this.series, this.commandFunctions);
        this.div.appendChild(this.toolBox.div);
    }

    createTopBar() {
        this._topBar = new TopBar(this);
        this.wrapper.prepend(this._topBar._div);
        return this._topBar;
    }


    //toJSON() {
    //    // Exclude the chart attribute from serialization
    //    const { chart, ...serialized } = this;
    //    return serialized;
    //}
    /**
     * Extracts data from a series in a format suitable for indicators.
     * @param series - The series to extract data from.
     * @returns An array of arrays containing `time` and `close` values.
     */
    public extractSeriesData(series: ISeriesApiExtended ): any[][] {
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

        function getPoint(series: ISeriesApiExtended , param: MouseEventParams) {
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
        const searchWindow = document.createElement('div');
        searchWindow.classList.add('searchbox');
        searchWindow.style.display = 'none';
      
        const magnifyingGlass = document.createElement('div');
        magnifyingGlass.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="24px" height="24px" viewBox="0 0 24 24" version="1.1"><path style="fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke:lightgray;stroke-opacity:1;stroke-miterlimit:4;" d="M 15 15 L 21 21 M 10 17 C 6.132812 17 3 13.867188 3 10 C 3 6.132812 6.132812 3 10 3 C 13.867188 3 17 6.132812 17 10 C 17 13.867188 13.867188 17 10 17 Z M 10 17 "/></svg>`;
      
        const sBox = document.createElement('input');
        sBox.type = 'text';
      
        searchWindow.appendChild(magnifyingGlass);
        searchWindow.appendChild(sBox);
        chart.div.appendChild(searchWindow);
      
        chart.commandFunctions.push((event: KeyboardEvent) => {
          // Only allow if window.monaco is explicitly false.
          if (window.monaco !== false) return false;
          if (window.handlerInFocus !== chart.id || window.textBoxFocused) return false;
          if (searchWindow.style.display === 'none') {
            if (/^[a-zA-Z0-9]$/.test(event.key)) {
              searchWindow.style.display = 'flex';
              sBox.focus();
              return true;
            } else {
              return false;
            }
          } else if (event.key === 'Enter' || event.key === 'Escape') {
            if (event.key === 'Enter') {
              window.callbackFunction(`search${chart.id}_~_${sBox.value}`);
            }
            searchWindow.style.display = 'none';
            sBox.value = '';
            return true;
          } else {
            return false;
          }
        });
      
        sBox.addEventListener('input', () => sBox.value = sBox.value.toUpperCase());
        return {
          window: searchWindow,
          box: sBox,
        };
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
/**
 * Serializes the Handler's state into a JSON object.
 *
 * The serialization includes:
 *  - Chart options from the internal chart instance.
 *  - Scale and precision values.
 *
 * @returns A JSON object representing the Handler’s state.
 */
public toJSON(): {
    id: string;
    options?: ChartOptions;
    scale?: Scale;
    precision?: number;
  } {
    return {
      id: this.id,
      options: this.chart.options(),
      scale: this.scale,
      precision: this.precision,
    };
  }
  
  /**
   * Restores the Handler’s state from a JSON object.
   *
   * This includes:
   *  - Updating the internal chart’s options via chart.applyOptions.
   *  - Restoring scale and precision.
   *
   * @param json The JSON object containing state.
   */
  public fromJSON(json: {
    id: string;
    options?: ChartOptions;
    scale?: Scale;
    precision?: number;
  }): void {
    if (!json) {
      console.warn("No JSON data provided for handler deserialization.");
      return;
    }
  
    // Update chart options by delegating to the Chart class.
    if (json.options) {
      this.chart.applyOptions(json.options);
    }
  
    // Restore scale and precision.
    if (json.scale !== undefined) {
      this.scale = json.scale;
    }
    if (json.precision !== undefined) {
      this.precision = json.precision;
    }
  }
  

  public _type: string = "chart"
  public title: string = "chart"
}
