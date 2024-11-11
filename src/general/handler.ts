import {
    AreaStyleOptions,
    BarStyleOptions,
    ColorType,
    CrosshairMode,
    DeepPartial,
    HistogramStyleOptions,
    IChartApi,
    ISeriesApi,
    LineStyleOptions,
    LogicalRange,
    LogicalRangeChangeEventHandler,
    MouseEventHandler,
    MouseEventParams,
    SeriesOptionsCommon,
    SeriesType,
    Time,
    createChart
} from "lightweight-charts";

import { GlobalParams, globalParamInit } from "./global-params";
import { Legend } from "./legend";
import { ToolBox } from "./toolbox";
import { TopBar } from "./topbar";


export interface Scale{
    width: number,
    height: number,
}
// Define specific options interfaces with optional group and legendSymbol properties
interface LineSeriesOptions extends DeepPartial<LineStyleOptions & SeriesOptionsCommon> {
    group?: string;
    legendSymbol?: string;
}

interface HistogramSeriesOptions extends DeepPartial<HistogramStyleOptions & SeriesOptionsCommon> {
    group?: string;
    legendSymbol?: string;
}

interface AreaSeriesOptions extends DeepPartial<AreaStyleOptions & SeriesOptionsCommon> {
    group?: string;
    legendSymbol?: string;
}

interface BarSeriesOptions extends DeepPartial<BarStyleOptions & SeriesOptionsCommon> {
    group?: string;
    legendSymbol?: string[]; // Updated to an array of strings to support dual symbols
}


globalParamInit();
declare const window: GlobalParams;

export class Handler {
    public id: string;
    public commandFunctions: Function[] = [];

    public wrapper: HTMLDivElement;
    public div: HTMLDivElement;

    public chart: IChartApi;
    public scale: Scale;
    public precision: number = 2;

    public series: ISeriesApi<SeriesType>;
    public volumeSeries: ISeriesApi<SeriesType>;

    public legend: Legend;
    private _topBar: TopBar | undefined;
    public toolBox: ToolBox | undefined;
    public spinner: HTMLDivElement | undefined;

    public _seriesList: ISeriesApi<SeriesType>[] = [];

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
        }

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

        this.legend = new Legend(this)
        
        document.addEventListener('keydown', (event) => {
            for (let i = 0; i < this.commandFunctions.length; i++) {
                if (this.commandFunctions[i](event)) break
            }
        })
        window.handlerInFocus = this.id;
        this.wrapper.addEventListener('mouseover', () => window.handlerInFocus = this.id)

        this.reSize()
        if (!autoSize) return
        window.addEventListener('resize', () => this.reSize())
    }


    reSize() {
        let topBarOffset = this.scale.height !== 0 ? this._topBar?._div.offsetHeight || 0 : 0
        this.chart.resize(window.innerWidth * this.scale.width, (window.innerHeight * this.scale.height) - topBarOffset)
        this.wrapper.style.width = `${100 * this.scale.width}%`
        this.wrapper.style.height = `${100 * this.scale.height}%`
        
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

    private _createChart() {
        return createChart(this.div, {
            width: window.innerWidth * this.scale.width,
            height: window.innerHeight * this.scale.height,
            layout:{
                textColor: window.pane.color,
                background: {
                    color: '#000000',
                    type: ColorType.Solid,
                },
                fontSize: 12
            },
            rightPriceScale: {
                scaleMargins: {top: 0.3, bottom: 0.25},
            },
            timeScale: {timeVisible: true, secondsVisible: false},
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
                vertLines: {color: 'rgba(29, 30, 38, 5)'},
                horzLines: {color: 'rgba(29, 30, 58, 5)'},
            },
            handleScroll: {vertTouchDrag: true},
        })
    }

    createCandlestickSeries() {
        const up = 'rgba(39, 157, 130, 100)'
        const down = 'rgba(200, 97, 100, 100)'
        const candleSeries = this.chart.addCandlestickSeries({
            upColor: up, borderUpColor: up, wickUpColor: up,
            downColor: down, borderDownColor: down, wickDownColor: down
        });
        candleSeries.priceScale().applyOptions({
            scaleMargins: {top: 0.2, bottom: 0.2},
        });
        return candleSeries;
    }

    createVolumeSeries() {
        const volumeSeries = this.chart.addHistogramSeries({
            color: '#26a69a',
            priceFormat: {type: 'volume'},
            priceScaleId: 'volume_scale',
        })
        volumeSeries.priceScale().applyOptions({
            scaleMargins: {top: 0.8, bottom: 0},
        });
        return volumeSeries;
    }

    createLineSeries(
        name: string,
        options: LineSeriesOptions
    ): { name: string; series: ISeriesApi<SeriesType> } {
        const { group, legendSymbol = '▨', ...lineOptions } = options;
        const line = this.chart.addLineSeries(lineOptions);
        this._seriesList.push(line);
    
        const color = line.options().color || 'rgba(255,0,0,1)';
        const solidColor = color.startsWith('rgba') ? color.replace(/[^,]+(?=\))/, '1') : color;
    
        if (!group || group === '') {
            this.legend.makeSeriesRow(name, line, [legendSymbol], [solidColor]);
        } else {
            const existingGroup = this.legend._groups.find(g => g.name === group);
            if (existingGroup) {
                existingGroup.names.push(name);
                existingGroup.seriesList.push(line);
                existingGroup.solidColors.push(solidColor); // Single color
                existingGroup.legendSymbols.push(legendSymbol); // Single symbol
            } else {
                this.legend.makeSeriesGroup(group, [name], [line], [solidColor], [legendSymbol]);
            }
        }
    
        return { name, series: line };
    }
    
    createHistogramSeries(
        name: string,
        options: HistogramSeriesOptions
    ): { name: string; series: ISeriesApi<SeriesType> } {
        const { group, legendSymbol = '▨', ...histogramOptions } = options;
        const histogram = this.chart.addHistogramSeries(histogramOptions);
        this._seriesList.push(histogram);
    
        const color = histogram.options().color || 'rgba(255,0,0,1)';
        const solidColor = color.startsWith('rgba') ? color.replace(/[^,]+(?=\))/, '1') : color;
    
        if (!group || group === '') {
            this.legend.makeSeriesRow(name, histogram, [legendSymbol], [solidColor]);
        } else {
            const existingGroup = this.legend._groups.find(g => g.name === group);
            if (existingGroup) {
                existingGroup.names.push(name);
                existingGroup.seriesList.push(histogram);
                existingGroup.solidColors.push(solidColor); // Single color
                existingGroup.legendSymbols.push(legendSymbol); // Single symbol
            } else {
                this.legend.makeSeriesGroup(group, [name], [histogram], [solidColor], [legendSymbol]);
            }
        }
    
        return { name, series: histogram };
    }
    
    createAreaSeries(
        name: string,
        options: AreaSeriesOptions
    ): { name: string; series: ISeriesApi<SeriesType> } {
        const { group, legendSymbol = '▨', ...areaOptions } = options;
        const area = this.chart.addAreaSeries(areaOptions);
        this._seriesList.push(area);
    
        const color = area.options().color || 'rgba(255,0,0,1)';
        const solidColor = color.startsWith('rgba') ? color.replace(/[^,]+(?=\))/, '1') : color;
    
        if (!group || group === '') {
            this.legend.makeSeriesRow(name, area, [legendSymbol], [solidColor]);
        } else {
            const existingGroup = this.legend._groups.find(g => g.name === group);
            if (existingGroup) {
                existingGroup.names.push(name);
                existingGroup.seriesList.push(area);
                existingGroup.solidColors.push(solidColor); // Single color
                existingGroup.legendSymbols.push(legendSymbol); // Single symbol
            } else {
                this.legend.makeSeriesGroup(group, [name], [area], [solidColor], [legendSymbol]);
            }
        }
    
        return { name, series: area };
    }
    
    createBarSeries(
        name: string,
        options: BarSeriesOptions
    ): { name: string; series: ISeriesApi<SeriesType> } {
        const { group, legendSymbol = ['▨', '▨'], ...barOptions } = options;
        const bar = this.chart.addBarSeries(barOptions);
        this._seriesList.push(bar);
    
        // Extract upColor and downColor, with default values
        const upColor = (bar.options() as any).upColor || 'rgba(0,255,0,1)';    // Default green
        const downColor = (bar.options() as any).downColor || 'rgba(255,0,0,1)'; // Default red
    
        if (!group || group === '') {
            // Pass both symbols and colors to makeSeriesRow for standalone bars
            this.legend.makeSeriesRow(name, bar, legendSymbol, [upColor, downColor]);
        } else {
            const existingGroup = this.legend._groups.find(g => g.name === group);
            if (existingGroup) {
                existingGroup.names.push(name);
                existingGroup.seriesList.push(bar);
                existingGroup.solidColors.push(upColor, downColor); // Add both colors
                existingGroup.legendSymbols.push(legendSymbol[0], legendSymbol[1]); // Add both symbols
            } else {
                this.legend.makeSeriesGroup(
                    group,
                    [name],
                    [bar],
                    [upColor, downColor],  // Two colors for up/down
                    legendSymbol           // Two symbols for up/down
                );
            }
        }
    
        return { name, series: bar };
    }
    
        // Method to attach a TooltipPrimitive to a specified series
        attachTooltip(seriesName: string, lineColor: string): void {
            try {
                if (!seriesName) {
                    console.warn(`Series name is not provided.`);
                    return;
                }

                // Detach any existing tooltips from the chart
                this.clearAllTooltips();

                // Create a new TooltipPrimitive instance
                const tooltipPrimitive = new TooltipPrimitive({ lineColor });

                // Find the series by name in legend._lines
                const line = this.legend._lines.find(s => s.name === seriesName);
                if (!line || !line.series) {
                    console.warn(`Series with the name "${seriesName}" not found.`);
                    return;
                }

                // Attach the new tooltip primitive to the series
                line.series.attachPrimitive(tooltipPrimitive);
                this.tooltipPrimitives.set(seriesName, tooltipPrimitive); // Store the instance in the map
                console.log("Tooltip primitive attached to", seriesName);
            } catch (error) {
                console.error("Failed to attach TooltipPrimitive:", error);
            }
        }

        // Method to detach the TooltipPrimitive from a specified series
        detachTooltip(seriesName: string): void {
            const tooltipPrimitive = this.tooltipPrimitives.get(seriesName);

            if (tooltipPrimitive) {
                try {
                    tooltipPrimitive.detached(); // Call `detached` on TooltipPrimitive
                    this.tooltipPrimitives.delete(seriesName); // Remove from the map
                    console.log(`Tooltip primitive detached from ${seriesName}.`);
                } catch (error) {
                    console.error(`Failed to detach TooltipPrimitive from ${seriesName}:`, error);
                }
            } else {
                console.warn(`No TooltipPrimitive found for series "${seriesName}" to detach.`);
            }
        }
    
    
    createToolBox() {
        this.toolBox = new ToolBox(this.id, this.chart, this.series, this.commandFunctions);
        this.div.appendChild(this.toolBox.div);
    }

    
    createTopBar() {
        this._topBar = new TopBar(this);
        this.wrapper.prepend(this._topBar._div)
        return this._topBar;
    }

    toJSON() {
        // Exclude the chart attribute from serialization
        const {chart, ...serialized} = this;
        return serialized;
    }

    public static syncCharts(childChart:Handler, parentChart: Handler, crosshairOnly = false) {
        function crosshairHandler(chart: Handler, point: any) {//point: BarData | LineData) {
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
            if(timeRange) childTimeScale.setVisibleLogicalRange(timeRange);
        }
        const setParentRange = (timeRange: LogicalRange | null) => {
            if(timeRange) parentTimeScale.setVisibleLogicalRange(timeRange);
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
            otherRange: LogicalRangeChangeEventHandler)
        {
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
