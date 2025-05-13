var Lib = (function (exports, lightweightCharts) {
    'use strict';

    function ensureDefined(value) {
        if (value === undefined) {
            throw new Error('Value is undefined');
        }
        return value;
    }

    //* PluginBase is a useful base to build a plugin upon which
    //* already handles creating getters for the chart and series,
    //* and provides a requestUpdate method.
    class PluginBase {
        _chart = undefined;
        _series = undefined;
        requestUpdate() {
            if (this._requestUpdate)
                this._requestUpdate();
        }
        _requestUpdate;
        attached({ chart, series, requestUpdate, }) {
            this._chart = chart;
            this._series = series;
            this._series.subscribeDataChanged(this._fireDataUpdated);
            this._requestUpdate = requestUpdate;
            this.requestUpdate();
        }
        detached() {
            this._chart = undefined;
            this._series = undefined;
            this._requestUpdate = undefined;
        }
        get chart() {
            return ensureDefined(this._chart);
        }
        get series() {
            return ensureDefined(this._series);
        }
        _fireDataUpdated(scope) {
            if (this.dataUpdated) {
                this.dataUpdated(scope);
            }
        }
    }

    // Converts a hex color to RGBA with specified opacity
    function hexToRGBA$1(hex, opacity) {
        hex = hex.replace(/^#/, '');
        if (!/^([0-9A-F]{3}){1,2}$/i.test(hex)) {
            throw new Error("Invalid hex color format.");
        }
        const getRGB = (h) => {
            return h.length === 3
                ? [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)]
                : [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
        };
        const [r, g, b] = getRGB(hex);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    // Adjusts the opacity of a color (hex, rgb, or rgba)
    function setOpacity$1(color, newOpacity) {
        if (color.startsWith('#')) {
            return hexToRGBA$1(color, newOpacity);
        }
        else {
            // Match rgb or rgba
            const rgbRegex = /^rgb(a)?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:,\s*([\d.]+))?\)/i;
            const match = color.match(rgbRegex);
            if (match) {
                const r = match[2];
                const g = match[3];
                const b = match[4];
                // If alpha not specified, assume 1.0
                const a = match[1] ? (match[5] ?? '1') : '1';
                return `rgba(${r}, ${g}, ${b}, ${newOpacity ?? a})`;
            }
            else {
                throw new Error("Unsupported color format. Use hex, rgb, or rgba.");
            }
        }
    }

    class ClosestTimeIndexFinder {
        numbers;
        cache;
        constructor(sortedNumbers) {
            this.numbers = sortedNumbers;
            this.cache = new Map();
        }
        findClosestIndex(target, direction) {
            const cacheKey = `${target}:${direction}`;
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }
            const closestIndex = this._performSearch(target, direction);
            this.cache.set(cacheKey, closestIndex);
            return closestIndex;
        }
        _performSearch(target, direction) {
            let low = 0;
            let high = this.numbers.length - 1;
            if (target <= this.numbers[0].time)
                return 0;
            if (target >= this.numbers[high].time)
                return high;
            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                const num = this.numbers[mid].time;
                if (num === target) {
                    return mid;
                }
                else if (num > target) {
                    high = mid - 1;
                }
                else {
                    low = mid + 1;
                }
            }
            return direction === 'left' ? low : high;
        }
    }

    const tradeDefaultOptions = {
        ...lightweightCharts.customSeriesDefaultOptions,
        side: 'long',
        mode: 'relative',
        auto: false,
        entryColor: '#FFFF00',
        stopColor: '#FF0000',
        targetColor: '#00FF00',
        backgroundColorStop: 'rgba(255,0,0,0.25)',
        backgroundColorTarget: 'rgba(0,255,0,0.25)',
        lineWidth: 1,
        lineStyle: 3, // Default to solid
        partialClosureLineColor: '#FFFFFF',
        partialClosureLineWidth: 1,
        partialClosureLineDash: [4, 2],
        infoTextColor: '#FFFFFF',
        infoFont: '12px Arial',
        positionChangeColor: '#FFFFFF'
    };

    function getDefaultSeriesOptions(type //| "Ohlc" | "Trade"
    ) {
        const common = {
        // Define any common default options that apply to all series types here
        };
        switch (type) {
            case "Line":
                return {
                    ...common,
                    title: type,
                    color: "#195200",
                    lineWidth: 2,
                    crosshairMarkerVisible: true,
                };
            case "Histogram":
                return {
                    ...common,
                    title: type,
                    color: "#9ACF01",
                    base: 0,
                };
            case "Area":
                return {
                    ...common,
                    title: type,
                    lineColor: "#021698",
                    topColor: "rgba(9, 32, 210, 0.4)",
                    bottomColor: "rgba(0, 0, 0, 0.5)",
                };
            case "Bar":
                return {
                    ...common,
                    title: type,
                    upColor: "#006721",
                    downColor: "#6E0000",
                    borderUpColor: "#006721",
                    borderDownColor: "#6E0000",
                };
            case "Candlestick":
                return {
                    ...common,
                    title: type,
                    upColor: "rgba(0, 103, 33, 0.33)",
                    downColor: "rgba(110, 0, 0, 0.33)",
                    borderUpColor: "#006721",
                    borderDownColor: "#6E0000",
                    wickUpColor: "#006721",
                    wickDownColor: "#6E0000",
                };
            case "Ohlc":
                return {
                    ...common,
                    title: type,
                    upColor: "rgba(0, 103, 33, 0.33)",
                    downColor: "rgba(110, 0, 0, 0.33)",
                    borderUpColor: "#006721",
                    borderDownColor: "#6E0000",
                    wickUpColor: "#006721",
                    wickDownColor: "#6E0000",
                    shape: "Rounded",
                    chandelierSize: 1,
                    barSpacing: 0.777,
                    lineStyle: 0,
                    lineWidth: 1,
                };
            case "Trade":
                return {
                    ...common,
                    ...tradeDefaultOptions,
                };
            default:
                throw new Error(`Unsupported series type: ${type}`);
        }
    }
    /**
     * Converts one specific data item (by `index`) to the target series type.
     */
    function convertDataItem(series, targetType, index) {
        // 1) get the data array
        const data = series.data();
        if (!data || data.length === 0) {
            console.warn("No data available in the source series.");
            return null;
        }
        // 2) pick the individual item
        const item = data[index];
        // 3) switch on targetType, then use type guards on `item`
        switch (targetType) {
            // Single-value shapes: "Line", "Histogram", "Area"
            case "Line": {
                // line expects { time, value }
                if (isOHLCData(item)) {
                    // Use item.close for value
                    return {
                        time: item.time,
                        value: item.close,
                    };
                }
                else if (isSingleValueData(item)) {
                    // Already has { time, value }
                    return {
                        time: item.time,
                        value: item.value,
                    };
                }
                else if (isWhitespaceData(item)) {
                    // It's valid whitespace data => return as-is
                    return {
                        time: item.time,
                    };
                }
                // else it's something else => can't convert
                break;
            }
            case "Histogram": {
                // histogram expects { time, value }, possibly color
                if (isOHLCData(item)) {
                    return {
                        time: item.time,
                        value: item.close,
                    };
                }
                else if (isSingleValueData(item)) {
                    return {
                        time: item.time,
                        value: item.value,
                    };
                }
                else if (isWhitespaceData(item)) {
                    return {
                        time: item.time,
                    };
                }
                break;
            }
            case "Area": {
                // area expects { time, value }
                if (isOHLCData(item)) {
                    return {
                        time: item.time,
                        value: item.close,
                    };
                }
                else if (isSingleValueData(item)) {
                    return {
                        time: item.time,
                        value: item.value,
                    };
                }
                else if (isWhitespaceData(item)) {
                    return {
                        time: item.time,
                    };
                }
                break;
            }
            // OHLC shapes: "Bar", "Candlestick", "Ohlc"
            case "Bar": {
                // { time, open, high, low, close }
                if (isOHLCData(item)) {
                    return {
                        time: item.time,
                        open: item.open,
                        high: item.high,
                        low: item.low,
                        close: item.close,
                    };
                }
                else if (isWhitespaceData(item)) {
                    return {
                        time: item.time,
                    };
                }
                break;
            }
            case "Candlestick": {
                // shape = { time, open, high, low, close }
                if (isOHLCData(item)) {
                    return {
                        time: item.time,
                        open: item.open,
                        high: item.high,
                        low: item.low,
                        close: item.close,
                    };
                }
                else if (isWhitespaceData(item)) {
                    return {
                        time: item.time,
                    };
                }
                break;
            }
            case "Ohlc": {
                // your custom type or just treat it as BarData
                if (isOHLCData(item)) {
                    return {
                        time: item.time,
                        open: item.open,
                        high: item.high,
                        low: item.low,
                        close: item.close,
                    };
                }
                else if (isWhitespaceData(item)) {
                    return {
                        time: item.time,
                    };
                }
                break;
            }
            case "Trade": {
                return {
                    time: item.time,
                    action: item.action ?? undefined,
                };
            }
            default:
                console.error(`Unsupported target type: ${targetType}`);
                return null;
        }
        // If we reach here, no conversion was possible
        console.warn("Could not convert data to the target type.");
        return null;
    }
    /**
     * Clones an existing series into a new series of a specified type.
     *
     * @param series - The series to clone.
     * @param type - The target type for the cloned series.
     * @param options - Additional options to merge with default options.
     * @returns The cloned series, or null if cloning fails.
     */
    function cloneSeriesAsType(series, handler, type, options) {
        try {
            const defaultOptions = getDefaultSeriesOptions(type);
            const mergedOptions = { ...defaultOptions, ...options };
            let clonedSeries;
            console.log(`Cloning ${series.seriesType()} as ${type}...`);
            // Create the new series using a handler pattern you already have
            switch (type) {
                case 'Line':
                    clonedSeries = handler.createLineSeries(type, mergedOptions);
                    break;
                case 'Histogram':
                    clonedSeries = handler.createHistogramSeries(type, mergedOptions);
                    break;
                case 'Area':
                    clonedSeries = handler.createAreaSeries(type, mergedOptions);
                    break;
                case 'Bar':
                    clonedSeries = handler.createBarSeries(type, mergedOptions);
                    break;
                case 'Candlestick':
                    clonedSeries = {
                        name: options.name,
                        series: handler.createCandlestickSeries(),
                    };
                    break;
                case 'Ohlc':
                    clonedSeries = handler.createCustomOHLCSeries(type, mergedOptions);
                    break;
                default:
                    console.error(`Unsupported series type: ${type}`);
                    return null;
            }
            // ---------------------------
            // Use convertDataItem() to transform the existing data
            // ---------------------------
            const originalData = series.data();
            // Convert each bar in the original series
            let transformedData = originalData
                .map((_, i) => convertDataItem(series, type, i))
                .filter((item) => item !== null);
            // Apply the transformed data to the newly created series
            clonedSeries.series.setData(transformedData);
            // Hide the original series
            series.applyOptions({ visible: false });
            // ---------------------------
            // Subscribe to data changes on the original to keep the clone updated
            // ---------------------------
            series.subscribeDataChanged(() => {
                const updatedData = series.data();
                const newTransformed = updatedData
                    .map((_, i) => convertDataItem(series, type, i))
                    .filter((item) => item !== null);
                clonedSeries.series.setData(newTransformed);
                console.log(`Updated synced series of type ${type}`);
            });
            return clonedSeries.series;
        }
        catch (error) {
            console.error('Error cloning series:', error);
            return null;
        }
    }
    // series-types.ts
    var SeriesTypeEnum;
    (function (SeriesTypeEnum) {
        SeriesTypeEnum["Line"] = "Line";
        SeriesTypeEnum["Histogram"] = "Histogram";
        SeriesTypeEnum["Area"] = "Area";
        SeriesTypeEnum["Bar"] = "Bar";
        SeriesTypeEnum["Candlestick"] = "Candlestick";
        SeriesTypeEnum["Ohlc"] = "Ohlc";
        SeriesTypeEnum["Trade"] = "Trade";
    })(SeriesTypeEnum || (SeriesTypeEnum = {}));

    function decorateSeries(original, legend // Optional Legend instance to handle primitives
    ) {
        // Check if the series is already decorated
        if (original._isDecorated) {
            console.warn("Series is already decorated. Skipping decoration.");
            return original;
        }
        // Mark the series as decorated
        original._isDecorated = true;
        const decorated = true;
        const peers = [];
        const originalSetData = original.setData.bind(original);
        // Array to store attached primitives
        const primitives = [];
        // Reference to the most recently attached primitive
        let lastAttachedPrimitive = null;
        // Hook into the original `detachPrimitive` if it exists
        const originalDetachPrimitive = original.detachPrimitive?.bind(original);
        const originalAttachPrimitive = original.attachPrimitive?.bind(original);
        const originalData = original.data?.bind(original);
        /**
         * Helper function to convert data items.
         *
         * @param sourceItem - The raw source item (must contain a `time` property).
         * @param keys - Optional list of property names to copy. Defaults to ['time'].
         * @param copy - If true, copies all properties from sourceItem, overriding `keys`.
         * @returns A partial data item or null if `time` is missing.
         */
        function sync(series) {
            // 1) Determine the type from the series’ own options
            //    (Ensure "seriesType" is indeed on the options, otherwise provide fallback)
            const options = series.options();
            const targetType = options.seriesType ?? "Line"; // fallback to "Line" if undefined
            // 2) Perform initial synchronization from "originalData"
            const sourceData = originalData();
            if (!sourceData) {
                console.warn("Source data is missing for synchronization.");
                return;
            }
            const targetData = [...series.data()];
            for (let i = targetData.length; i < sourceData.length; i++) {
                // Now call your convertDataItem with the discovered type:
                const newItem = convertDataItem(series, targetType, i);
                if (newItem) {
                    if (newItem && 'time' in newItem && 'value' in newItem) {
                        targetData.push(newItem);
                    }
                    else {
                        console.warn('Invalid data item:', newItem);
                    }
                }
            }
            series.setData(targetData);
            console.log(`Synchronized series of type ${series.seriesType}`);
            // 3) Subscribe for future changes
            series.subscribeDataChanged(() => {
                const updatedSourceData = [...originalData()];
                if (!updatedSourceData || updatedSourceData.length === 0) {
                    console.warn("Source data is missing for synchronization.");
                    return;
                }
                // Get the last bar from the target series
                const lastTargetBar = series.data().slice(-1)[0];
                // The last index from updatedSourceData
                const lastSourceIndex = updatedSourceData.length - 1;
                // If the new item has a time >= last target bar’s time, we update/append
                if (!lastTargetBar ||
                    updatedSourceData[lastSourceIndex].time >= lastTargetBar.time) {
                    const newItem = convertDataItem(series, targetType, lastSourceIndex);
                    if (newItem) {
                        series.update(newItem);
                        console.log(`Updated/added bar via "update()" for series type ${series.seriesType}`);
                    }
                }
            });
        }
        function attachPrimitive(primitive, name, replace = true, addToLegend = false) {
            const primitiveType = primitive.constructor.type || primitive.constructor.name;
            // Detach existing primitives if `replace` is true
            if (replace) {
                detachPrimitives();
            }
            else {
                // Check if a primitive of the same type is already attached
                const existingIndex = primitives.findIndex((p) => p.constructor.type === primitiveType);
                if (existingIndex !== -1) {
                    detachPrimitive(primitives[existingIndex]);
                }
            }
            // Attach the primitive to the series
            if (originalAttachPrimitive) {
                originalAttachPrimitive(primitive);
            }
            // Add the new primitive to the list
            primitives.push(primitive);
            lastAttachedPrimitive = primitive;
            console.log(`Primitive of type "${primitiveType}" attached.`);
            // Add the primitive to the legend if required
            if (legend && addToLegend) {
                legend.addLegendPrimitive(original, primitive, name);
            }
        }
        function detachPrimitive(primitive) {
            const index = primitives.indexOf(primitive);
            if (index === -1) {
                return;
            }
            // Remove the primitive from the array
            primitives.splice(index, 1);
            if (lastAttachedPrimitive === primitive) {
                lastAttachedPrimitive = null;
            }
            // Detach the primitive using the original method
            if (originalDetachPrimitive) {
                originalDetachPrimitive(primitive);
            }
            // Remove the primitive from the legend if it exists
            if (legend) {
                const legendEntry = legend.findLegendPrimitive(original, primitive);
                if (legendEntry) {
                    legend.removeLegendPrimitive(primitive);
                    console.log(`Removed primitive of type "${primitive.constructor.name}" from legend.`);
                }
            }
        }
        function detachPrimitives() {
            console.log("Detaching all primitives.");
            while (primitives.length > 0) {
                const primitive = primitives.pop();
                detachPrimitive(primitive);
            }
            console.log("All primitives detached.");
        }
        function setData(data) {
            originalSetData(data);
            peers.forEach((peer) => peer.setData?.(data));
            console.log("Data updated on series and peers.");
        }
        function addPeer(peer) {
            peers.push(peer);
        }
        function removePeer(peer) {
            const index = peers.indexOf(peer);
            if (index !== -1)
                peers.splice(index, 1);
        }
        return Object.assign(original, {
            setData,
            addPeer,
            removePeer,
            peers,
            primitives,
            sync,
            attachPrimitive,
            detachPrimitive,
            detachPrimitives,
            decorated,
            get primitive() {
                return lastAttachedPrimitive;
            },
        });
    }

    /**
     * Enumeration for different candle shapes.
     */
    var CandleShape;
    (function (CandleShape) {
        CandleShape["Rectangle"] = "Rectangle";
        CandleShape["Rounded"] = "Rounded";
        CandleShape["Ellipse"] = "Ellipse";
        CandleShape["Arrow"] = "Arrow";
        CandleShape["Cube"] = "3d";
        CandleShape["Polygon"] = "Polygon";
    })(CandleShape || (CandleShape = {}));
    function parseCandleShape(input) {
        switch (input.trim().toLowerCase()) {
            case 'rectangle':
                return CandleShape.Rectangle;
            case 'rounded':
                return CandleShape.Rounded;
            case 'ellipse':
                return CandleShape.Ellipse;
            case 'arrow':
                return CandleShape.Arrow;
            case '3d':
                return CandleShape.Cube;
            case 'polygon':
                return CandleShape.Polygon;
            default:
                console.warn(`Unknown CandleShape: ${input}`);
                return CandleShape.Rectangle;
        }
    }

    function isSolidColor(background) {
        return background.type === lightweightCharts.ColorType.Solid;
    }
    function isVerticalGradientColor(background) {
        return background.type === lightweightCharts.ColorType.VerticalGradient;
    }
    // Type checks for data
    function isSingleValueData(data) {
        return "value" in data;
    }
    function isOHLCData(data) {
        return "close" in data && "open" in data && "high" in data && "low" in data;
    }
    function isWhitespaceData(data) {
        if (!data || typeof data !== "object") {
            return false;
        }
        // Must have time
        if (!("time" in data)) {
            return false;
        }
        // Must NOT have single-value or OHLC fields
        if ("value" in data ||
            "open" in data ||
            "close" in data ||
            "high" in data ||
            "low" in data) {
            return false;
        }
        return true;
    }
    function hasColorOption(series) {
        const seriesOptions = series.options();
        return 'lineColor' in seriesOptions || 'color' in seriesOptions;
    }
    function ensureExtendedSeries(series, legend // Assuming `Legend` is the type of the legend instance
    ) {
        // Type guard to check if the series is already extended
        const isExtendedSeries = (series) => {
            return series.primitives !== undefined;
        };
        // If the series is already extended, return it
        if (isExtendedSeries(series)) {
            return series;
        }
        // Otherwise, decorate the series dynamically
        console.log("Decorating the series dynamically.");
        return decorateSeries(series, legend);
    }
    // utils/typeGuards.ts
    /**
     * Type guard to check if a primitive is FillArea.
     *
     * @param primitive - The primitive to check.
     * @returns True if primitive is FillArea, else false.
     */
    function isFillArea(primitive) {
        return (primitive.options !== undefined &&
            primitive.options.originColor !== null &&
            primitive.options.destinationColor !== null &&
            primitive.options.lineWidth !== null);
    }
    function isCandleShape(value) {
        return Object.values(CandleShape).includes(value);
    }

    class FillArea extends PluginBase {
        static type = "Fill Area"; // Explicitly set the type name
        _paneViews;
        _originSeries;
        _destinationSeries;
        _bandsData = [];
        options;
        _timeIndices;
        constructor(originSeries, destinationSeries, options) {
            super();
            // Existing logic for setting colors
            const defaultOriginColor = setOpacity$1('#0000FF', 0.25); // Blue
            const defaultDestinationColor = setOpacity$1('#FF0000', 0.25); // Red
            const originSeriesColor = hasColorOption(originSeries)
                ? setOpacity$1(originSeries.options().lineColor || defaultOriginColor, 0.3)
                : setOpacity$1(defaultOriginColor, 0.3);
            const destinationSeriesColor = hasColorOption(destinationSeries)
                ? setOpacity$1(destinationSeries.options().lineColor || defaultDestinationColor, 0.3)
                : setOpacity$1(defaultDestinationColor, 0.3);
            this.options = {
                ...defaultFillAreaOptions,
                ...options,
                originColor: options.originColor ?? originSeriesColor,
                destinationColor: options.destinationColor ?? destinationSeriesColor,
            };
            this._paneViews = [new FillAreaPaneView(this)];
            this._timeIndices = new ClosestTimeIndexFinder([]);
            this._originSeries = originSeries;
            this._destinationSeries = destinationSeries;
            // Subscribe to data changes in both series
            this._originSeries.subscribeDataChanged(() => {
                console.log("Origin series data has changed. Recalculating bands.");
                this.dataUpdated('full');
                this.updateAllViews();
            });
            this._destinationSeries.subscribeDataChanged(() => {
                console.log("Destination series data has changed. Recalculating bands.");
                this.dataUpdated('full');
                this.updateAllViews();
            });
        }
        updateAllViews() {
            this._paneViews.forEach(pw => pw.update());
        }
        applyOptions(options) {
            const defaultOriginColor = '#0000FF'; // Blue
            const defaultDestinationColor = '#FF0000'; // Red
            const originSeriesColor = hasColorOption(this._originSeries)
                ? setOpacity$1(this._originSeries.options().lineColor || this._originSeries.options().color || defaultOriginColor, 0.3)
                : setOpacity$1(defaultOriginColor, 0.3);
            const destinationSeriesColor = hasColorOption(this._destinationSeries)
                ? setOpacity$1(this._destinationSeries.options().lineColor || this._destinationSeries.options().color || defaultDestinationColor, 0.3)
                : setOpacity$1(defaultDestinationColor, 0.3);
            this.options = {
                ...this.options,
                ...options,
                originColor: options.originColor || originSeriesColor,
                destinationColor: options.destinationColor || destinationSeriesColor,
            };
            this.calculateBands();
            this.updateAllViews();
            super.requestUpdate();
            console.log("FillArea options updated:", this.options);
        }
        paneViews() {
            return this._paneViews;
        }
        attached(p) {
            super.attached(p);
            this.dataUpdated('full');
        }
        dataUpdated(scope) {
            this.calculateBands();
            if (scope === 'full') {
                const originData = this._originSeries.data();
                this._timeIndices = new ClosestTimeIndexFinder([...originData]);
            }
        }
        calculateBands() {
            const originData = this._originSeries.data();
            const destinationData = this._destinationSeries.data();
            // Ensure both datasets have the same length
            const alignedData = this._alignDataLengths([...originData], [...destinationData]);
            const bandData = [];
            for (let i = 0; i < alignedData.origin.length; i++) {
                let points = extractPrices(alignedData.origin[i], alignedData.destination[i]);
                if (points?.originValue === undefined || points?.destinationValue === undefined)
                    continue;
                // Determine which series is upper and lower
                const upper = Math.max(points?.originValue, points?.destinationValue);
                const lower = Math.min(points?.originValue, points?.destinationValue);
                bandData.push({
                    time: alignedData.origin[i].time,
                    origin: points?.originValue,
                    destination: points?.destinationValue,
                    upper,
                    lower,
                });
            }
            this._bandsData = bandData;
        }
        _alignDataLengths(originData, destinationData) {
            const originLength = originData.length;
            const destinationLength = destinationData.length;
            if (originLength > destinationLength) {
                const lastKnown = destinationData[destinationLength - 1];
                while (destinationData.length < originLength) {
                    destinationData.push({ ...lastKnown });
                }
            }
            else if (destinationLength > originLength) {
                const lastKnown = originData[originLength - 1];
                while (originData.length < destinationLength) {
                    originData.push({ ...lastKnown });
                }
            }
            return { origin: originData, destination: destinationData };
        }
        autoscaleInfo(startTimePoint, endTimePoint) {
            const ts = this.chart.timeScale();
            const startTime = (ts.coordinateToTime(ts.logicalToCoordinate(startTimePoint) ?? 0) ?? 0);
            const endTime = (ts.coordinateToTime(ts.logicalToCoordinate(endTimePoint) ?? 5000000000) ?? 5000000000);
            const startIndex = this._timeIndices.findClosestIndex(startTime, 'left');
            const endIndex = this._timeIndices.findClosestIndex(endTime, 'right');
            const range = {
                minValue: Math.min(...this._bandsData.map(b => b.lower).slice(startIndex, endIndex + 1)),
                maxValue: Math.max(...this._bandsData.map(b => b.upper).slice(startIndex, endIndex + 1)),
            };
            return {
                priceRange: {
                    minValue: range.minValue,
                    maxValue: range.maxValue,
                },
            };
        }
    }
    class FillAreaPaneRenderer {
        _viewData;
        _options;
        constructor(data) {
            this._viewData = data;
            this._options = data.options;
        }
        draw() { }
        drawBackground(target) {
            const points = this._viewData.data;
            const options = this._options;
            if (points.length < 2)
                return; // Ensure there are enough points to draw
            target.useBitmapCoordinateSpace((scope) => {
                const ctx = scope.context;
                ctx.scale(scope.horizontalPixelRatio, scope.verticalPixelRatio);
                let currentPathStarted = false;
                let startIndex = 0;
                for (let i = 0; i < points.length - 1; i++) {
                    const current = points[i];
                    const next = points[i + 1];
                    if (!currentPathStarted || current.isOriginAbove !== points[i - 1]?.isOriginAbove) {
                        if (currentPathStarted) {
                            for (let j = i - 1; j >= startIndex; j--) {
                                ctx.lineTo(points[j].x, points[j].destination);
                            }
                            ctx.closePath();
                            ctx.fill();
                        }
                        ctx.beginPath();
                        ctx.moveTo(current.x, current.origin);
                        ctx.fillStyle = current.isOriginAbove
                            ? options.originColor || 'rgba(0, 0, 0, 0)' // Default to transparent if null
                            : options.destinationColor || 'rgba(0, 0, 0, 0)'; // Default to transparent if null
                        startIndex = i;
                        currentPathStarted = true;
                    }
                    ctx.lineTo(next.x, next.origin);
                    if (i === points.length - 2 || next.isOriginAbove !== current.isOriginAbove) {
                        for (let j = i + 1; j >= startIndex; j--) {
                            ctx.lineTo(points[j].x, points[j].destination);
                        }
                        ctx.closePath();
                        ctx.fill();
                        currentPathStarted = false;
                    }
                }
                if (options.lineWidth) {
                    ctx.lineWidth = options.lineWidth;
                    ctx.strokeStyle = options.originColor || 'rgba(0, 0, 0, 0)';
                    ctx.stroke();
                }
            });
        }
    }
    class FillAreaPaneView {
        _source;
        _data;
        constructor(source) {
            this._source = source;
            this._data = {
                data: [],
                options: this._source.options, // Pass the options for the renderer
            };
        }
        update() {
            const timeScale = this._source.chart.timeScale();
            this._data.data = this._source._bandsData.map((d) => ({
                x: timeScale.timeToCoordinate(d.time),
                origin: this._source._originSeries.priceToCoordinate(d.origin),
                destination: this._source._destinationSeries.priceToCoordinate(d.destination),
                isOriginAbove: d.origin > d.destination,
            }));
            // Ensure options are updated in the data
            this._data.options = this._source.options;
        }
        renderer() {
            return new FillAreaPaneRenderer(this._data);
        }
    }
    const defaultFillAreaOptions = {
        originColor: null,
        destinationColor: null,
        lineWidth: null,
    };
    function extractPrices(originPoint, destinationPoint) {
        let originPrice;
        let destinationPrice;
        // Extract origin price
        if (originPoint.close !== undefined) {
            const originBar = originPoint;
            originPrice = originBar.close; // Use close price for comparison
        }
        else if (originPoint.value !== undefined) {
            originPrice = originPoint.value; // Use value for LineData
        }
        // Extract destination price
        if (destinationPoint.close !== undefined) {
            const destinationBar = destinationPoint;
            destinationPrice = destinationBar.close; // Use close price for comparison
        }
        else if (destinationPoint.value !== undefined) {
            destinationPrice = destinationPoint.value; // Use value for LineData
        }
        // Ensure both prices are defined
        if (originPrice === undefined || destinationPrice === undefined) {
            return undefined;
        }
        // Handle mixed types and determine the appropriate values to return
        if (originPrice < destinationPrice) {
            // origin > destination: min(open, close) for BarData (if applicable), otherwise value
            const originValue = originPoint.close !== undefined
                ? Math.min(originPoint.open, originPoint.close)
                : originPrice;
            const destinationValue = destinationPoint.close !== undefined
                ? Math.max(destinationPoint.open, destinationPoint.close)
                : destinationPrice;
            return { originValue, destinationValue };
        }
        else {
            // origin <= destination: max(open, close) for BarData (if applicable), otherwise value
            const originValue = originPoint.close !== undefined
                ? Math.max(originPoint.open, originPoint.close)
                : originPrice;
            const destinationValue = destinationPoint.close !== undefined
                ? Math.min(destinationPoint.open, destinationPoint.close)
                : destinationPrice;
            return { originValue, destinationValue };
        }
    }

    const paneStyleDefault = {
        backgroundColor: '#0c0d0f',
        hoverBackgroundColor: '#3c434c',
        clickBackgroundColor: '#50565E',
        activeBackgroundColor: 'rgba(0, 122, 255, 0.7)',
        mutedBackgroundColor: 'rgba(0, 122, 255, 0.3)',
        borderColor: '#3C434C',
        color: '#d8d9db',
        activeColor: '#ececed',
    };
    function globalParamInit() {
        window.pane = {
            ...paneStyleDefault,
        };
        window.containerDiv = document.getElementById("container") || document.createElement('div');
        window.setCursor = (type) => {
            if (type)
                window.cursor = type;
            document.body.style.cursor = window.cursor;
        };
        window.cursor = 'default';
        window.textBoxFocused = false;
    }
    const setCursor = (type) => {
        if (type)
            window.cursor = type;
        document.body.style.cursor = window.cursor;
    };
    const openEye = `
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
    const closedEye = `
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

    // Cache to store the last data point for each series
    const lastSeriesDataCache = new Map();
    function getLastData(series) {
        return lastSeriesDataCache.get(series) || null;
    }
    class Legend {
        handler;
        div;
        seriesContainer;
        ohlcEnabled = false;
        percentEnabled = false;
        linesEnabled = false;
        colorBasedOnCandle = false;
        text;
        candle;
        _items = [];
        _lines = [];
        _groups = [];
        constructor(handler) {
            this.handler = handler;
            this.div = document.createElement('div');
            this.div.classList.add("legend");
            this.seriesContainer = document.createElement("div");
            this.text = document.createElement('span');
            this.candle = document.createElement('div');
            this.setupLegend();
            this.legendHandler = this.legendHandler.bind(this);
            handler.chart.subscribeCrosshairMove(this.legendHandler);
        }
        setupLegend() {
            this.div.style.maxWidth = `${(this.handler.scale.width * 100) - 8}vw`;
            this.div.style.display = 'none';
            const seriesWrapper = document.createElement('div');
            seriesWrapper.style.display = 'flex';
            seriesWrapper.style.flexDirection = 'row';
            this.seriesContainer.classList.add("series-container");
            this.text.style.lineHeight = '1.8';
            seriesWrapper.appendChild(this.seriesContainer);
            this.div.appendChild(this.text);
            this.div.appendChild(this.candle);
            this.div.appendChild(seriesWrapper);
            this.handler.div.appendChild(this.div);
        }
        legendItemFormat(num, decimal) {
            if (typeof num !== 'number' || isNaN(num)) {
                return '-'; // Default display when data is missing
            }
            return num.toFixed(decimal).toString().padStart(8, ' ');
        }
        shorthandFormat(num) {
            const absNum = Math.abs(num);
            return absNum >= 1000000 ? (num / 1000000).toFixed(1) + 'M' :
                absNum >= 1000 ? (num / 1000).toFixed(1) + 'K' :
                    num.toString().padStart(8, ' ');
        }
        createSvgIcon(svgContent) {
            const tempContainer = document.createElement('div');
            tempContainer.innerHTML = svgContent.trim();
            const svgElement = tempContainer.querySelector('svg');
            return svgElement;
        }
        /**
         * Adds a LegendItem to the legend, either as a standalone series or within a group.
         * @param item The LegendItem to add.
         * @returns The HTMLDivElement representing the legend entry.
         */
        addLegendItem(item) {
            // Ensure `item` is a series and map it to the `LegendSeries` type
            const seriesItem = this.mapToSeries(item);
            if (seriesItem.group) {
                // If the series belongs to a group, add it to the group
                return this.addItemToGroup(seriesItem, seriesItem.group);
            }
            else {
                // If standalone, create a series row and add it to the container
                const seriesRow = this.makeSeriesRow(seriesItem, this.seriesContainer);
                // Add the series to `_lines` for tracking
                this._lines.push(seriesItem);
                // Add to `_items` for general legend tracking
                this._items.push(seriesItem);
                return seriesRow;
            }
        }
        addLegendPrimitive(series, primitive, name) {
            const primitiveName = name || primitive.constructor.name;
            // Check if the parent series row exists
            const seriesEntry = this._lines.find(line => line.series === series);
            if (!seriesEntry) {
                console.warn(`Parent series not found in legend for primitive: ${primitiveName}`);
                return;
            }
            // Ensure the primitives container exists
            let primitivesContainer = this.seriesContainer.querySelector(`[data-series-id="${seriesEntry.name}"] .primitives-container`);
            if (!primitivesContainer) {
                // Create a new container for primitives
                primitivesContainer = document.createElement('div');
                primitivesContainer.classList.add('primitives-container');
                primitivesContainer.style.display = 'none'; // Initially hidden
                primitivesContainer.style.marginLeft = '20px'; // Indentation for hierarchy
                primitivesContainer.style.flexDirection = 'column';
                // Insert the container below the series row
                seriesEntry.row.insertAdjacentElement('afterend', primitivesContainer);
            }
            // Check if the primitive already exists in the legend
            const existingPrimitiveRow = Array.from(primitivesContainer.children).find(row => row.getAttribute('data-primitive-type') === primitiveName);
            if (existingPrimitiveRow) {
                console.warn(`Primitive "${primitiveName}" already exists under the parent series.`);
                return existingPrimitiveRow;
            }
            // Create a new row for the primitive
            const primitiveRow = document.createElement('div');
            primitiveRow.classList.add('legend-primitive-row');
            primitiveRow.setAttribute('data-primitive-type', primitiveName);
            primitiveRow.style.display = 'flex';
            primitiveRow.style.justifyContent = 'space-between';
            primitiveRow.style.marginTop = '4px';
            const primitiveLabel = document.createElement('span');
            primitiveLabel.innerText = primitiveName;
            // Add a visibility toggle for the primitive
            const toggle = document.createElement('div');
            toggle.style.cursor = 'pointer';
            toggle.style.display = 'flex';
            toggle.style.alignItems = 'center';
            const onIcon = this.createSvgIcon(openEye);
            const offIcon = this.createSvgIcon(closedEye);
            toggle.appendChild(onIcon.cloneNode(true)); // Start with visible icon
            let visible = true;
            toggle.addEventListener('click', () => {
                visible = !visible;
                toggle.innerHTML = ''; // Clear existing content
                toggle.appendChild(visible ? onIcon.cloneNode(true) : offIcon.cloneNode(true));
                // Toggle visibility by updating color options
                this.togglePrimitive(primitive, visible);
            });
            // Append elements to the primitive row
            primitiveRow.appendChild(primitiveLabel);
            primitiveRow.appendChild(toggle);
            // Append the primitive row to the primitives container
            primitivesContainer.appendChild(primitiveRow);
            // Ensure the primitives container is visible if it has content
            if (primitivesContainer.children.length > 0) {
                primitivesContainer.style.display = 'block';
            }
            return primitiveRow;
        }
        togglePrimitive(primitive, visible) {
            const options = primitive.options;
            if (!options) {
                console.warn("Primitive has no options to update.");
                return;
            }
            const transparentColor = "rgba(0,0,0,0)";
            const originalColorsKey = "_originalColors";
            // Initialize storage for original colors if it doesn't exist
            if (!primitive[originalColorsKey]) {
                primitive[originalColorsKey] = {};
            }
            const originalColors = primitive[originalColorsKey];
            const updatedOptions = {};
            for (const key of Object.keys(options)) {
                if (key.toLowerCase().includes("color")) {
                    if (!visible) {
                        // Store the original color if we're toggling visibility off
                        if (!originalColors[key]) {
                            originalColors[key] = options[key];
                        }
                        updatedOptions[key] = transparentColor;
                    }
                    else {
                        // Restore the original color if we're toggling visibility on
                        updatedOptions[key] = originalColors[key] || options[key];
                    }
                }
            }
            // Apply the updated options
            if (Object.keys(updatedOptions).length > 0) {
                console.log(`Updating visibility for primitive: ${primitive.constructor.name}`);
                primitive.applyOptions(updatedOptions);
                // Clear the original colors when visibility is restored
                if (visible) {
                    delete primitive[originalColorsKey];
                }
            }
        }
        findLegendPrimitive(series, primitive) {
            const seriesRow = this._lines.find(line => line.series === series)?.row;
            if (!seriesRow) {
                return null;
            }
            const primitivesContainer = seriesRow.querySelector('.primitives-container');
            if (!primitivesContainer) {
                return null;
            }
            const primitiveType = primitive.constructor.type || primitive.constructor.name;
            return Array.from(primitivesContainer.children).find(row => row.getAttribute('data-primitive-type') === primitiveType);
        }
        removeLegendPrimitive(primitive) {
            const primitiveName = primitive.constructor.type || primitive.constructor.name;
            console.log(`Removing legend entry for primitive: ${primitiveName}`);
            // Iterate through the series container to find and remove the primitive entry
            const rows = Array.from(this.seriesContainer.children);
            for (const row of rows) {
                // Check if the row represents the primitive
                if (row.textContent?.includes(`Primitive: ${primitiveName}`)) {
                    this.seriesContainer.removeChild(row);
                    console.log(`Legend entry for primitive "${primitiveName}" removed.`);
                    break; // Stop once the correct row is found and removed
                }
            }
        }
        /**
        * Converts a LegendItem into a LegendSeries.
        * @param item The LegendItem to map.
        * @returns The mapped LegendSeries object.
        */
        mapToSeries(item) {
            return {
                name: item.name,
                series: item.series,
                group: item.group || undefined,
                legendSymbol: item.legendSymbol || [],
                colors: item.colors || ['#000'],
                seriesType: item.seriesType || 'Line',
                div: document.createElement('div'), // Default element
                row: document.createElement('div'), // Default element
                toggle: document.createElement('div'), // Default element
                extraData: item.extraData || null
            };
        }
        /**
         * Adds a LegendItem to a specified group, creating the group if it doesn't exist.
         * @param item The LegendItem to add.
         * @param groupName The name of the group to add the item to.
         * @returns The HTMLDivElement representing the group's row.
        */
        addItemToGroup(item, groupName) {
            let group = this._groups.find(g => g.name === groupName);
            if (!group) {
                // Create the group and append the series row to the group's container
                return this.makeSeriesGroup(groupName, [item]);
            }
            else {
                group.seriesList.push(item);
                // Create and append the new series row to the group's container
                this.makeSeriesRow(item, group.div);
                return group.row;
            }
        }
        /**
         * Creates a group in the legend with the provided items.
         * @param groupName The name of the group.
         * @param items The LegendItems to include in the group.
         * @returns The HTMLDivElement representing the group's row.
         */
        makeSeriesGroup(groupName, items) {
            let group = this._groups.find(g => g.name === groupName);
            if (group) {
                group.seriesList.push(...items);
                // Append new series to the existing group div
                items.forEach(item => this.makeSeriesRow(item, group.div));
                return group.row;
            }
            else {
                const newGroup = {
                    name: groupName,
                    seriesList: items,
                    subGroups: [],
                    div: document.createElement('div'),
                    row: document.createElement('div'),
                    toggle: document.createElement('div'),
                };
                this._groups.push(newGroup);
                this.renderGroup(newGroup, this.seriesContainer);
                return newGroup.row;
            }
        }
        makeSeriesRow(line, container) {
            const row = document.createElement('div');
            row.classList.add('legend-series-row'); // Add CSS class for styling
            // Use flexbox for layout
            row.style.display = 'flex';
            row.style.alignItems = 'center'; // Vertically center items
            row.style.justifyContent = 'space-between'; // Add space between text and toggle icon
            row.style.marginBottom = '4px'; // Optional spacing between rows
            const div = document.createElement('div');
            div.classList.add('series-info'); // Add CSS class for styling
            div.style.flex = '1'; // Allow the text to take up available space
            const displayOCvalues = ['Bar', 'Candlestick', 'Ohlc'].includes(line.seriesType || '');
            if (displayOCvalues) {
                const openPrice = '-';
                const closePrice = '-';
                const upSymbol = line.legendSymbol[0] || '▨';
                const downSymbol = line.legendSymbol[1] || upSymbol;
                const upColor = line.colors[0] || '#00FF00';
                const downColor = line.colors[1] || '#FF0000';
                div.innerHTML = `
                <span style="color: ${upColor};">${upSymbol}</span>
                <span style="color: ${downColor};">${downSymbol}</span>
                ${line.name}: <span style="color: ${downColor};">O ${openPrice}</span>, 
                <span style="color: ${upColor};">C ${closePrice}</span>
            `;
            }
            else {
                div.innerHTML = line.legendSymbol
                    .map((symbol, index) => `<span style="color: ${line.colors[index] || line.colors[0]};">${symbol}</span>`)
                    .join(' ') + ` ${line.name}`;
            }
            // Toggle visibility icon
            const toggle = document.createElement('div');
            toggle.classList.add('legend-toggle-switch');
            toggle.style.cursor = 'pointer'; // Indicate that this is clickable
            // Use flex styling to keep the toggle inline
            toggle.style.display = 'flex';
            toggle.style.alignItems = 'center';
            const onIcon = this.createSvgIcon(openEye);
            const offIcon = this.createSvgIcon(closedEye);
            let visible = true;
            toggle.appendChild(onIcon.cloneNode(true));
            // Add click listener for toggling visibility
            toggle.addEventListener('click', (event) => {
                visible = !visible;
                line.series.applyOptions({ visible });
                toggle.innerHTML = '';
                toggle.appendChild(visible ? onIcon.cloneNode(true) : offIcon.cloneNode(true));
                // Update ARIA attribute
                toggle.setAttribute('aria-pressed', visible.toString());
                // Update toggle state class
                toggle.classList.toggle('inactive', !visible);
                event.stopPropagation();
            });
            // Set initial ARIA attributes
            toggle.setAttribute('role', 'button');
            toggle.setAttribute('aria-label', `Toggle visibility for ${line.name}`);
            toggle.setAttribute('aria-pressed', visible.toString());
            // Append elements to the row
            row.appendChild(div); // Add text/info div
            row.appendChild(toggle); // Add visibility toggle
            container.appendChild(row); // Append to the provided container
            // Prevent context menu on the row
            row.addEventListener('contextmenu', (event) => {
                event.preventDefault();
            });
            // Create LegendSeries and store it
            const legendSeries = {
                ...line,
                div, // Assign the created div
                row, // Assign the created row
                toggle, // Assign the created toggle
            };
            this._lines.push(legendSeries);
            return row;
        }
        /**
         * Deletes a legend entry, either a standalone series or an entire group.
         * @param seriesName The name of the series to delete.
         * @param groupName The name of the group to delete or from which to delete the series.
         */
        deleteLegendEntry(seriesName, groupName) {
            if (groupName && !seriesName) {
                // Remove entire group
                const groupIndex = this._groups.findIndex(group => group.name === groupName);
                if (groupIndex !== -1) {
                    const legendGroup = this._groups[groupIndex];
                    // Remove the group's DOM elements
                    this.seriesContainer.removeChild(legendGroup.row);
                    // Optionally, remove all series in the group from the chart
                    // legendGroup.seriesList.forEach(item => item.series.remove());
                    // Remove from the _groups array
                    this._groups.splice(groupIndex, 1);
                    // Also remove from _items array
                    this._items = this._items.filter(entry => entry !== legendGroup);
                    console.log(`Group "${groupName}" removed.`);
                }
                else {
                    console.warn(`Legend group with name "${groupName}" not found.`);
                }
            }
            else if (seriesName) {
                // Remove individual series
                let removed = false;
                if (groupName) {
                    // Remove from specific group
                    const group = this._groups.find(g => g.name === groupName);
                    if (group) {
                        const itemIndex = group.seriesList.findIndex(item => item.name === seriesName);
                        if (itemIndex !== -1) {
                            // Remove from the group's seriesList
                            group.seriesList.splice(itemIndex, 1);
                            // If the group is now empty, remove it
                            if (group.seriesList.length === 0) {
                                this.seriesContainer.removeChild(group.row);
                                this._groups = this._groups.filter(g => g !== group);
                                this._items = this._items.filter(entry => entry !== group);
                                console.log(`Group "${groupName}" is empty and has been removed.`);
                            }
                            else {
                                // Re-render the group to update its display
                                this.renderGroup(group, this.seriesContainer);
                            }
                            // Optionally, remove the series from the chart
                            // seriesItem.series.remove();
                            removed = true;
                            console.log(`Series "${seriesName}" removed from group "${groupName}".`);
                        }
                    }
                    else {
                        console.warn(`Legend group with name "${groupName}" not found.`);
                    }
                }
                if (!removed) {
                    // Remove from _lines (individual legend items)
                    const seriesIndex = this._lines.findIndex(series => series.name === seriesName);
                    if (seriesIndex !== -1) {
                        const legendSeries = this._lines[seriesIndex];
                        // Remove the DOM elements
                        this.seriesContainer.removeChild(legendSeries.row);
                        // Remove from the _lines array
                        this._lines.splice(seriesIndex, 1);
                        // Also remove from _items array
                        this._items = this._items.filter(entry => entry !== legendSeries);
                        // Optionally, remove the series from the chart
                        // legendSeries.series.remove();
                        removed = true;
                        console.log(`Series "${seriesName}" removed.`);
                    }
                }
                if (!removed) {
                    console.warn(`Legend item with name "${seriesName}" not found.`);
                }
            }
            else {
                console.warn(`No seriesName or groupName provided for deletion.`);
            }
        }
        /**
         * Retrieves the group name of a given series.
         * @param series The series to find the group for.
         * @returns The name of the group, or undefined if not found.
         */
        getGroupOfSeries(series) {
            for (const group of this._groups) {
                const foundGroupName = this.findGroupOfSeriesRecursive(group, series);
                if (foundGroupName) {
                    return foundGroupName;
                }
            }
            return undefined;
        }
        /**
         * Recursively searches for the group containing the target series.
         * @param group The current group to search within.
         * @param targetSeries The series to find.
         * @returns The group name if found, otherwise undefined.
         */
        findGroupOfSeriesRecursive(group, targetSeries) {
            for (const item of group.seriesList) {
                if (item.series === targetSeries) {
                    return group.name;
                }
            }
            for (const subGroup of group.subGroups) {
                const found = this.findGroupOfSeriesRecursive(subGroup, targetSeries);
                if (found) {
                    return found;
                }
            }
            return undefined;
        }
        /**
         * Moves a series from its current group (or standalone) to a target group.
         * If the series is already in a group, it will be moved from its current group to the new one.
         * If the series is standalone, its row is removed from the main container.
         * @param seriesName The name of the series to move.
         * @param targetGroupName The name of the group to move the series into.
         */
        moveSeriesToGroup(seriesName, targetGroupName) {
            // Find the series in _lines (standalone)
            let foundSeriesIndex = this._lines.findIndex(s => s.name === seriesName);
            let foundSeries = null;
            if (foundSeriesIndex !== -1) {
                foundSeries = this._lines[foundSeriesIndex];
            }
            else {
                // If not found in _lines, search within groups
                for (const group of this._groups) {
                    const idx = group.seriesList.findIndex(item => item.name === seriesName);
                    if (idx !== -1) {
                        foundSeries = group.seriesList[idx];
                        // Remove from current group
                        group.seriesList.splice(idx, 1);
                        // If group becomes empty, remove it
                        if (group.seriesList.length === 0) {
                            this.seriesContainer.removeChild(group.row);
                            this._groups = this._groups.filter(g => g !== group);
                            this._items = this._items.filter(entry => entry !== group);
                            console.log(`Group "${group.name}" is empty and has been removed.`);
                        }
                        else {
                            // Re-render the group to update its display
                            this.renderGroup(group, this.seriesContainer);
                        }
                        break;
                    }
                }
            }
            if (!foundSeries) {
                console.warn(`Series "${seriesName}" not found in legend.`);
                return;
            }
            // If found in _lines, remove it from there
            if (foundSeriesIndex !== -1) {
                // Remove from DOM
                this.seriesContainer.removeChild(foundSeries.row);
                this._lines.splice(foundSeriesIndex, 1);
                this._items = this._items.filter(entry => entry !== foundSeries);
            }
            else {
                // If found in a group, its removal was handled above
                this._items = this._items.filter(entry => entry !== foundSeries);
            }
            // Now add to the target group
            let targetGroup = this.findGroup(targetGroupName);
            if (!targetGroup) {
                // Create the target group if it doesn't exist
                targetGroup = {
                    name: targetGroupName,
                    seriesList: [foundSeries],
                    subGroups: [],
                    div: document.createElement('div'),
                    row: document.createElement('div'),
                    toggle: document.createElement('div'),
                };
                this._groups.push(targetGroup);
                this.renderGroup(targetGroup, this.seriesContainer);
            }
            else {
                targetGroup.seriesList.push(foundSeries);
                // Append the series row to the group's div
                this.makeSeriesRow(foundSeries, targetGroup.div);
                // No need to re-render the entire group
            }
            this._items.push(foundSeries);
            console.log(`Series "${seriesName}" moved to group "${targetGroupName}".`);
        }
        renderGroup(group, container) {
            // Clear old row content
            group.row.innerHTML = '';
            group.row.style.display = 'flex';
            group.row.style.flexDirection = 'column';
            group.row.style.width = '100%';
            // Group header
            const header = document.createElement('div');
            header.classList.add('group-header'); // Add CSS class for styling
            header.style.display = 'flex'; // Set header layout to flex
            header.style.alignItems = 'center'; // Align items vertically
            header.style.justifyContent = 'space-between'; // Space between name and toggle icon
            header.style.cursor = 'pointer'; // Make the header clickable
            // Group name and aggregated symbols
            const groupNameSpan = document.createElement('span');
            groupNameSpan.style.fontWeight = 'bold';
            groupNameSpan.innerHTML = group.seriesList
                .map(series => series.legendSymbol.map((symbol, index) => `<span style="color: ${series.colors[index] || series.colors[0]};">${symbol}</span>`).join(' '))
                .join(' ') + ` ${group.name}`;
            // Custom toggle button (next to the group name)
            const toggleButton = document.createElement('span');
            toggleButton.classList.add('toggle-button'); // Add CSS class for styling
            toggleButton.style.marginLeft = 'auto'; // Push button to the far right
            toggleButton.style.fontSize = '1.2em'; // Make the icon size consistent
            toggleButton.style.cursor = 'pointer'; // Indicate it’s clickable
            toggleButton.innerHTML = '⌲'; // Default expanded state
            toggleButton.setAttribute('aria-expanded', 'true'); // Accessibility
            toggleButton.addEventListener('click', (event) => {
                event.stopPropagation();
                if (group.div.style.display === 'none') {
                    group.div.style.display = 'block';
                    toggleButton.innerHTML = '⌲'; // Expanded icon
                    toggleButton.setAttribute('aria-expanded', 'true');
                }
                else {
                    group.div.style.display = 'none';
                    toggleButton.innerHTML = '☰'; // Collapsed icon
                    toggleButton.setAttribute('aria-expanded', 'false');
                }
            });
            // Add group name and toggle button to the header
            header.appendChild(groupNameSpan);
            header.appendChild(toggleButton);
            // Append header to the group row
            group.row.appendChild(header);
            // Container for the group's items (series rows)
            group.div = document.createElement('div');
            group.div.style.display = 'block';
            group.div.style.marginLeft = '10px'; // Indent for group items
            // Render each series within the group
            for (const s of group.seriesList) {
                this.makeSeriesRow(s, group.div);
                // Each series has its own row appended to group.div
            }
            // Render subgroups recursively
            for (const subG of group.subGroups) {
                const subContainer = document.createElement('div');
                subContainer.style.display = 'flex';
                subContainer.style.flexDirection = 'column';
                subContainer.style.paddingLeft = '5px'; // Indent for nested groups
                this.renderGroup(subG, subContainer);
                group.div.appendChild(subContainer);
            }
            // Append the group's items container to the group row
            group.row.appendChild(group.div);
            // Append the group row to the container if not already present
            if (!container.contains(group.row)) {
                container.appendChild(group.row);
            }
            // Prevent context menu on the group row
            group.row.oncontextmenu = (event) => {
                event.preventDefault();
            };
        }
        /**
         * Handles crosshair movement events to update the legend display.
         * @param param The mouse event parameters.
         * @param usingPoint Determines whether to use logical indexing.
         */
        legendHandler(param, usingPoint = false) {
            if (!this.ohlcEnabled && !this.linesEnabled && !this.percentEnabled)
                return;
            const options = this.handler.series.options();
            if (!param.time) {
                this.candle.style.color = '#ffffff';
                this.candle.innerHTML = this.candle.innerHTML.replace(options['upColor'], '').replace(options['downColor'], '');
                return;
            }
            let data;
            let logical = null;
            if (usingPoint) {
                const timeScale = this.handler.chart.timeScale();
                let coordinate = timeScale.timeToCoordinate(param.time);
                if (coordinate)
                    logical = timeScale.coordinateToLogical(coordinate.valueOf());
                if (logical)
                    data = this.handler.series.dataByIndex(logical.valueOf());
            }
            else {
                data = param.seriesData.get(this.handler.series);
            }
            this.candle.style.color = '';
            let str = '<span style="line-height: 1.8;">';
            if (data) {
                if (this.ohlcEnabled) {
                    str += `O ${this.legendItemFormat(data.open, this.handler.precision)} `;
                    str += `| H ${this.legendItemFormat(data.high, this.handler.precision)} `;
                    str += `| L ${this.legendItemFormat(data.low, this.handler.precision)} `;
                    str += `| C ${this.legendItemFormat(data.close, this.handler.precision)} `;
                }
                // Display percentage move if enabled
                if (this.percentEnabled) {
                    const percentMove = ((data.close - data.open) / data.open) * 100;
                    const color = percentMove > 0 ? options['upColor'] : options['downColor'];
                    const percentStr = `${percentMove >= 0 ? '+' : ''}${percentMove.toFixed(2)} %`;
                    str += this.colorBasedOnCandle ? `| <span style="color: ${color};">${percentStr}</span>` : `| ${percentStr}`;
                }
            }
            this.candle.innerHTML = str + '</span>';
            // Update group legend and series legend
            this.updateGroupDisplay(param, logical, usingPoint);
            this.updateSeriesDisplay(param, logical, usingPoint);
        }
        updateSeriesDisplay(param, logical, usingPoint) {
            if (!this._lines || !this._lines.length) {
                console.error("No lines available to update legend.");
                return;
            }
            this._lines.forEach((e) => {
                const data = param.seriesData.get(e.series) || getLastData(e.series);
                if (!data) {
                    e.div.innerHTML = `${e.name}: -`;
                    return;
                }
                const seriesType = e.seriesType || 'Line';
                const priceFormat = e.series.options().priceFormat;
                if (seriesType === 'Line' || seriesType === 'Area') {
                    const valueData = data;
                    if (valueData.value == null) {
                        e.div.innerHTML = `${e.name}: -`;
                        return;
                    }
                    const value = this.legendItemFormat(valueData.value, priceFormat.precision);
                    e.div.innerHTML = `
                    <span style="color: ${e.colors[0]};">${e.legendSymbol[0] || '▨'}</span> 
                    ${e.name}: ${value}`;
                }
                else if (seriesType === 'Bar' || seriesType === 'Candlestick' || seriesType === 'Ohlc') {
                    const { open, close } = data;
                    if (open == null || close == null) {
                        e.div.innerHTML = `${e.name}: -`;
                        return;
                    }
                    const openPrice = this.legendItemFormat(open, priceFormat.precision);
                    const closePrice = this.legendItemFormat(close, priceFormat.precision);
                    const isUp = close > open;
                    const color = isUp ? e.colors[0] : e.colors[1];
                    const symbol = isUp ? e.legendSymbol[0] : e.legendSymbol[1];
                    e.div.innerHTML = `
                    <span style="color: ${color};">${symbol || '▨'}</span>
                    ${e.name}: 
                    <span style="color: ${color};">O ${openPrice}</span>, 
                    <span style="color: ${color};">C ${closePrice}</span>`;
                }
            });
        }
        /**
         * Updates the display for grouped series based on the crosshair position.
         * @param param The mouse event parameters.
         * @param logical The logical index of the data point.
         * @param usingPoint Determines whether to use logical indexing.
         */
        updateGroupDisplay(param, logical, usingPoint) {
            this._groups.forEach((group) => {
                if (!this.linesEnabled) {
                    group.row.style.display = 'none';
                    return;
                }
                group.row.style.display = 'flex';
                // Iterate through each series in the group and update its display
                group.seriesList.forEach((seriesItem) => {
                    const data = param.seriesData.get(seriesItem.series) || getLastData(seriesItem.series);
                    if (!data) {
                        seriesItem.div.innerHTML = `${seriesItem.name}: -`;
                        return;
                    }
                    const seriesType = seriesItem.seriesType || 'Line';
                    const name = seriesItem.name;
                    const priceFormat = seriesItem.series.options().priceFormat;
                    // Check if the series type supports OHLC values
                    const isOHLC = ['Bar', 'Candlestick', 'Ohlc'].includes(seriesType);
                    if (isOHLC) {
                        const { open, close, high, low } = data;
                        if (open == null || close == null || high == null || low == null) {
                            seriesItem.div.innerHTML = `${name}: -`;
                            return;
                        }
                        const openPrice = this.legendItemFormat(open, priceFormat.precision);
                        const closePrice = this.legendItemFormat(close, priceFormat.precision);
                        const isUp = close > open;
                        const color = isUp ? seriesItem.colors[0] : seriesItem.colors[1];
                        const symbol = isUp ? seriesItem.legendSymbol[0] : seriesItem.legendSymbol[1];
                        seriesItem.div.innerHTML = `
                        <span style="color: ${color};">${symbol || '▨'}</span>
                        ${name}: 
                        <span style="color: ${color};">O ${openPrice}</span>, 
                        <span style="color: ${color};">C ${closePrice}</span>
                    `;
                    }
                    else {
                        // Handle series types with a single 'value' property
                        const valueData = data;
                        const value = 'value' in valueData ? valueData.value : undefined;
                        if (value == null) {
                            seriesItem.div.innerHTML = `${name}: -`;
                            return;
                        }
                        const formattedValue = this.legendItemFormat(value, priceFormat.precision);
                        const color = seriesItem.colors[0];
                        const symbol = seriesItem.legendSymbol[0] || '▨';
                        seriesItem.div.innerHTML = `
                        <span style="color: ${color};">${symbol}</span>
                        ${name}: ${formattedValue}
                    `;
                    }
                });
            });
        }
        /**
         * Finds a group by name within the legend hierarchy.
         * @param groupName The name of the group to find.
         * @param groups The current group list to search within.
         * @returns The LegendGroup if found, undefined otherwise.
         */
        findGroup(groupName, groups = this._groups) {
            for (const group of groups) {
                if (group.name === groupName) {
                    return group;
                }
                const foundInSub = this.findGroup(groupName, group.subGroups);
                if (foundInSub) {
                    return foundInSub;
                }
            }
            return undefined;
        }
    }

    const defaultOptions$2 = {
        lineColor: '#1E80F0',
        lineStyle: lightweightCharts.LineStyle.Solid,
        width: 4,
    };

    var InteractionState;
    (function (InteractionState) {
        InteractionState[InteractionState["NONE"] = 0] = "NONE";
        InteractionState[InteractionState["HOVERING"] = 1] = "HOVERING";
        InteractionState[InteractionState["DRAGGING"] = 2] = "DRAGGING";
        InteractionState[InteractionState["DRAGGINGP1"] = 3] = "DRAGGINGP1";
        InteractionState[InteractionState["DRAGGINGP2"] = 4] = "DRAGGINGP2";
        InteractionState[InteractionState["DRAGGINGP3"] = 5] = "DRAGGINGP3";
        InteractionState[InteractionState["DRAGGINGP4"] = 6] = "DRAGGINGP4";
    })(InteractionState || (InteractionState = {}));
    class Drawing extends PluginBase {
        _paneViews = [];
        _options;
        _points = [];
        _state = InteractionState.NONE;
        _startDragPoint = null;
        _latestHoverPoint = null;
        static _mouseIsDown = false;
        static hoveredObject = null;
        static lastHoveredObject = null;
        _listeners = [];
        constructor(options) {
            super();
            this._options = {
                ...defaultOptions$2,
                ...options,
            };
        }
        updateAllViews() {
            this._paneViews.forEach(pw => pw.update());
        }
        paneViews() {
            return this._paneViews;
        }
        applyOptions(options) {
            this._options = {
                ...this._options,
                ...options,
            };
            this.requestUpdate();
        }
        updatePoints(...points) {
            for (let i = 0; i < this.points.length; i++) {
                if (points[i] == null)
                    continue;
                this.points[i] = points[i];
            }
            this.requestUpdate();
        }
        detach() {
            this._options.lineColor = 'transparent';
            this.requestUpdate();
            this.series.detachPrimitive(this);
            for (const s of this._listeners) {
                document.body.removeEventListener(s.name, s.listener);
            }
        }
        get points() {
            return this._points;
        }
        _subscribe(name, listener) {
            document.body.addEventListener(name, listener);
            this._listeners.push({ name: name, listener: listener });
        }
        _unsubscribe(name, callback) {
            document.body.removeEventListener(name, callback);
            const toRemove = this._listeners.find((x) => x.name === name && x.listener === callback);
            this._listeners.splice(this._listeners.indexOf(toRemove), 1);
        }
        _handleHoverInteraction(param) {
            this._latestHoverPoint = param.point;
            if (Drawing._mouseIsDown) {
                this._handleDragInteraction(param);
            }
            else {
                if (this._mouseIsOverDrawing(param)) {
                    if (this._state != InteractionState.NONE)
                        return;
                    this._moveToState(InteractionState.HOVERING);
                    Drawing.hoveredObject = Drawing.lastHoveredObject = this;
                }
                else {
                    if (this._state == InteractionState.NONE)
                        return;
                    this._moveToState(InteractionState.NONE);
                    if (Drawing.hoveredObject === this)
                        Drawing.hoveredObject = null;
                }
            }
        }
        static _eventToPoint(param, series) {
            if (!series || !param.point || !param.logical)
                return null;
            const barPrice = series.coordinateToPrice(param.point.y);
            if (barPrice == null)
                return null;
            return {
                time: param.time || null,
                logical: param.logical,
                price: barPrice.valueOf(),
            };
        }
        static _getDiff(p1, p2) {
            const diff = {
                logical: p1.logical - p2.logical,
                price: p1.price - p2.price,
            };
            return diff;
        }
        _addDiffToPoint(point, logicalDiff, priceDiff) {
            if (!point)
                return;
            point.logical = point.logical + logicalDiff;
            point.price = point.price + priceDiff;
            point.time = this.series.dataByIndex(point.logical)?.time || null;
        }
        _handleMouseDownInteraction = () => {
            // if (Drawing._mouseIsDown) return;
            Drawing._mouseIsDown = true;
            this._onMouseDown();
        };
        _handleMouseUpInteraction = () => {
            // if (!Drawing._mouseIsDown) return;
            Drawing._mouseIsDown = false;
            this._moveToState(InteractionState.HOVERING);
        };
        _handleDragInteraction(param) {
            if (this._state != InteractionState.DRAGGING &&
                this._state != InteractionState.DRAGGINGP1 &&
                this._state != InteractionState.DRAGGINGP2 &&
                this._state != InteractionState.DRAGGINGP3 &&
                this._state != InteractionState.DRAGGINGP4) {
                return;
            }
            const mousePoint = Drawing._eventToPoint(param, this.series);
            if (!mousePoint)
                return;
            this._startDragPoint = this._startDragPoint || mousePoint;
            const diff = Drawing._getDiff(mousePoint, this._startDragPoint);
            this._onDrag(diff);
            this.requestUpdate();
            this._startDragPoint = mousePoint;
        }
    }

    class DrawingPaneRenderer {
        _options;
        constructor(options) {
            this._options = options;
        }
    }
    class TwoPointDrawingPaneRenderer extends DrawingPaneRenderer {
        _p1;
        _p2;
        _hovered;
        constructor(p1, p2, options, hovered) {
            super(options);
            this._p1 = p1;
            this._p2 = p2;
            this._hovered = hovered;
        }
        _getScaledCoordinates(scope) {
            if (this._p1.x === null || this._p1.y === null ||
                this._p2.x === null || this._p2.y === null)
                return null;
            return {
                x1: Math.round(this._p1.x * scope.horizontalPixelRatio),
                y1: Math.round(this._p1.y * scope.verticalPixelRatio),
                x2: Math.round(this._p2.x * scope.horizontalPixelRatio),
                y2: Math.round(this._p2.y * scope.verticalPixelRatio),
            };
        }
        // _drawTextLabel(scope: BitmapCoordinatesRenderingScope, text: string, x: number, y: number, left: boolean) {
        //  scope.context.font = '24px Arial';
        //  scope.context.beginPath();
        //  const offset = 5 * scope.horizontalPixelRatio;
        //  const textWidth = scope.context.measureText(text);
        //  const leftAdjustment = left ? textWidth.width + offset * 4 : 0;
        //  scope.context.fillStyle = this._options.labelBackgroundColor;
        //  scope.context.roundRect(x + offset - leftAdjustment, y - 24, textWidth.width + offset * 2,  24 + offset, 5);
        //  scope.context.fill();
        //  scope.context.beginPath();
        //  scope.context.fillStyle = this._options.labelTextColor;
        //  scope.context.fillText(text, x + offset * 2 - leftAdjustment, y);
        // }
        _drawEndCircle(scope, x, y) {
            const radius = 9;
            scope.context.fillStyle = '#000';
            scope.context.beginPath();
            scope.context.arc(x, y, radius, 0, 2 * Math.PI);
            scope.context.stroke();
            scope.context.fill();
            // scope.context.strokeStyle = this._options.lineColor;
        }
    }

    function setLineStyle(ctx, style) {
        const dashPatterns = {
            [lightweightCharts.LineStyle.Solid]: [],
            [lightweightCharts.LineStyle.Dotted]: [ctx.lineWidth, ctx.lineWidth],
            [lightweightCharts.LineStyle.Dashed]: [2 * ctx.lineWidth, 2 * ctx.lineWidth],
            [lightweightCharts.LineStyle.LargeDashed]: [6 * ctx.lineWidth, 6 * ctx.lineWidth],
            [lightweightCharts.LineStyle.SparseDotted]: [ctx.lineWidth, 4 * ctx.lineWidth],
        };
        const dashPattern = dashPatterns[style];
        ctx.setLineDash(dashPattern);
    }

    class HorizontalLinePaneRenderer extends DrawingPaneRenderer {
        _point = { x: null, y: null };
        constructor(point, options) {
            super(options);
            this._point = point;
        }
        draw(target) {
            target.useBitmapCoordinateSpace(scope => {
                if (this._point.y == null)
                    return;
                const ctx = scope.context;
                const scaledY = Math.round(this._point.y * scope.verticalPixelRatio);
                const scaledX = this._point.x ? this._point.x * scope.horizontalPixelRatio : 0;
                ctx.lineWidth = this._options.width;
                ctx.strokeStyle = this._options.lineColor;
                setLineStyle(ctx, this._options.lineStyle);
                ctx.beginPath();
                ctx.moveTo(scaledX, scaledY);
                ctx.lineTo(scope.bitmapSize.width, scaledY);
                ctx.stroke();
            });
        }
    }

    class DrawingPaneView {
        _source;
        constructor(source) {
            this._source = source;
        }
    }
    class TwoPointDrawingPaneView extends DrawingPaneView {
        _p1 = { x: null, y: null };
        _p2 = { x: null, y: null };
        _source;
        constructor(source) {
            super(source);
            this._source = source;
        }
        update() {
            if (!this._source.p1 || !this._source.p2)
                return;
            const series = this._source.series;
            const y1 = series.priceToCoordinate(this._source.p1.price);
            const y2 = series.priceToCoordinate(this._source.p2.price);
            const x1 = this._getX(this._source.p1);
            const x2 = this._getX(this._source.p2);
            this._p1 = { x: x1, y: y1 };
            this._p2 = { x: x2, y: y2 };
            if (!x1 || !x2 || !y1 || !y2)
                return;
        }
        _getX(p) {
            const timeScale = this._source.chart.timeScale();
            return timeScale.logicalToCoordinate(p.logical);
        }
    }

    class HorizontalLinePaneView extends DrawingPaneView {
        _source;
        _point = { x: null, y: null };
        constructor(source) {
            super(source);
            this._source = source;
        }
        update() {
            const point = this._source._point;
            const timeScale = this._source.chart.timeScale();
            const series = this._source.series;
            if (this._source._type == "RayLine") {
                this._point.x = point.time ? timeScale.timeToCoordinate(point.time) : timeScale.logicalToCoordinate(point.logical);
            }
            this._point.y = series.priceToCoordinate(point.price);
        }
        renderer() {
            return new HorizontalLinePaneRenderer(this._point, this._source._options);
        }
    }

    class HorizontalLineAxisView {
        _source;
        _y = null;
        _price = null;
        constructor(source) {
            this._source = source;
        }
        update() {
            if (!this._source.series || !this._source._point)
                return;
            this._y = this._source.series.priceToCoordinate(this._source._point.price);
            const priceFormat = this._source.series.options().priceFormat;
            const precision = priceFormat.precision;
            this._price = this._source._point.price.toFixed(precision).toString();
        }
        visible() {
            return true;
        }
        tickVisible() {
            return true;
        }
        coordinate() {
            return this._y ?? 0;
        }
        text() {
            return this._source._options?.text || this._price || '';
        }
        textColor() {
            return 'white';
        }
        backColor() {
            return this._source._options.lineColor;
        }
    }

    class HorizontalLine extends Drawing {
        _type = 'HorizontalLine';
        _paneViews;
        _point;
        _callbackName;
        _priceAxisViews;
        _startDragPoint = null;
        constructor(point, options, callbackName = null) {
            super(options);
            this._point = point;
            this._point.time = null; // time is null for horizontal lines
            this._paneViews = [new HorizontalLinePaneView(this)];
            this._priceAxisViews = [new HorizontalLineAxisView(this)];
            this._callbackName = callbackName;
        }
        get points() {
            return [this._point];
        }
        updatePoints(...points) {
            for (const p of points)
                if (p)
                    this._point.price = p.price;
            this.requestUpdate();
        }
        updateAllViews() {
            this._paneViews.forEach((pw) => pw.update());
            this._priceAxisViews.forEach((tw) => tw.update());
        }
        priceAxisViews() {
            return this._priceAxisViews;
        }
        _moveToState(state) {
            switch (state) {
                case InteractionState.NONE:
                    document.body.style.cursor = "default";
                    this._unsubscribe("mousedown", this._handleMouseDownInteraction);
                    break;
                case InteractionState.HOVERING:
                    document.body.style.cursor = "pointer";
                    this._unsubscribe("mouseup", this._childHandleMouseUpInteraction);
                    this._subscribe("mousedown", this._handleMouseDownInteraction);
                    this.chart.applyOptions({ handleScroll: true });
                    break;
                case InteractionState.DRAGGING:
                    document.body.style.cursor = "grabbing";
                    this._subscribe("mouseup", this._childHandleMouseUpInteraction);
                    this.chart.applyOptions({ handleScroll: false });
                    break;
            }
            this._state = state;
        }
        _onDrag(diff) {
            this._addDiffToPoint(this._point, 0, diff.price);
            this.requestUpdate();
        }
        _mouseIsOverDrawing(param, tolerance = 4) {
            if (!param.point)
                return false;
            const y = this.series.priceToCoordinate(this._point.price);
            if (!y)
                return false;
            return (Math.abs(y - param.point.y) < tolerance);
        }
        _onMouseDown() {
            this._startDragPoint = null;
            const hoverPoint = this._latestHoverPoint;
            if (!hoverPoint)
                return;
            return this._moveToState(InteractionState.DRAGGING);
        }
        _childHandleMouseUpInteraction = () => {
            this._handleMouseUpInteraction();
            if (!this._callbackName)
                return;
            window.callbackFunction(`${this._callbackName}_~_${this._point.price.toFixed(8)}`);
        };
    }

    class MeasurePaneRenderer extends TwoPointDrawingPaneRenderer {
        series; // Declare the property for the box
        chart; // Declare the property for the box
        constructor(series, chart, p1, p2, options, showCircles) {
            super(p1, p2, options, showCircles);
            this.series = series;
            this.chart = chart;
        }
        draw(target) {
            target.useBitmapCoordinateSpace(scope => {
                const ctx = scope.context;
                const scaled = this._getScaledCoordinates(scope);
                if (!scaled)
                    return;
                ctx.lineWidth = this._options.width;
                ctx.strokeStyle = this._options.lineColor;
                setLineStyle(ctx, this._options.lineStyle);
                // Declare variables at this scope level
                let mainX = 0, mainY = 0, width = 0, height = 0;
                let hasValidCoordinates = false;
                // Only proceed if both points have valid data
                if (this._p1 && this._p2) {
                    if (this._p1.y !== undefined && this._p1.y !== null &&
                        this._p2.y !== undefined && this._p2.y !== null &&
                        this._p1.x !== undefined && this._p1.x !== null &&
                        this._p2.x !== undefined && this._p2.x !== null) {
                        const price1 = this.series.coordinateToPrice(this._p1.y);
                        const price2 = this.series.coordinateToPrice(this._p2.y);
                        const time1 = this.chart.timeScale().coordinateToTime(this._p1.x);
                        const time2 = this.chart.timeScale().coordinateToTime(this._p2.x);
                        // Ensure prices and times are not null
                        if (price1 === null || price2 === null || time1 === null || time2 === null) {
                            return;
                        }
                        // Calculate Price Percentage Difference
                        const priceDiff_abs = price2 - price1;
                        const priceDiff_pct = (priceDiff_abs / price1) * 100;
                        if (priceDiff_abs > 0) {
                            ctx.fillStyle = 'rgba(5,180,5,0.1)'; // You can customize the color
                        }
                        else {
                            ctx.fillStyle = 'rgba(255,5,5,0.1)'; // You can customize the color
                        }
                        mainX = Math.min(scaled.x1, scaled.x2);
                        mainY = Math.min(scaled.y1, scaled.y2);
                        width = Math.abs(scaled.x1 - scaled.x2);
                        height = Math.abs(scaled.y1 - scaled.y2);
                        hasValidCoordinates = true;
                        // Draw the rectangle
                        ctx.strokeRect(mainX, mainY, width, height);
                        ctx.fillRect(mainX, mainY, width, height);
                        console.log(price1);
                        console.log(price2);
                        const priceDiffText = `${priceDiff_pct.toFixed(2)}%`;
                        const priceDiffText_abs = `${priceDiff_abs.toFixed(2)}`;
                        // Calculate Time Difference
                        const timeDiffMs = Math.abs((typeof time2 === 'number' ? time2 : 0) - (typeof time1 === 'number' ? time1 : 0));
                        const timeDiffText = `Time: ${this._formatTimeDifference(timeDiffMs)}`;
                        // Set text styles
                        ctx.font = "14px Arial";
                        ctx.fillStyle = "rgba(5,5,5,1)"; // You can customize the color
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        // Calculate positions
                        const centerX = mainX + width / 2;
                        const topY = mainY - 10; // 10 pixels above the top edge
                        const bottomY = mainY + height - 20; // 10 pixels below the bottom edge
                        // Draw Price Percentage Difference at the Top
                        ctx.fillText(priceDiffText, centerX, topY);
                        // Draw Price Absolute Difference at the Middle
                        ctx.fillText(priceDiffText_abs, centerX, topY + 20); // 20 pixels below the top edge
                        // Draw Time Difference at the Bottom
                        ctx.fillText(timeDiffText, centerX, bottomY);
                    }
                }
                // Only draw circles if we have valid coordinates and we're being hovered
                if (this._hovered && hasValidCoordinates) {
                    this._drawEndCircle(scope, mainX, mainY);
                    this._drawEndCircle(scope, mainX + width, mainY);
                    this._drawEndCircle(scope, mainX + width, mainY + height);
                    this._drawEndCircle(scope, mainX, mainY + height);
                }
            });
        }
        /**
         * Formats the time difference from milliseconds to a human-readable string.
         * You can adjust this function based on your application's requirements.
         * @param ms Time difference in milliseconds
         * @returns Formatted time difference string
         */
        _formatTimeDifference(ms) {
            const seconds = Math.floor(ms);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);
            if (days > 0)
                return `${days}d ${hours % 24}h`;
            if (hours > 0)
                return `${hours}h ${minutes % 60}m`;
            if (minutes > 0)
                return `${minutes}m ${seconds % 60}s`;
            return `${seconds}s`;
        }
    }

    class MeasurePaneView extends TwoPointDrawingPaneView {
        constructor(source) {
            super(source);
        }
        renderer() {
            return new MeasurePaneRenderer(this._source.series, // Use public accessor method
            this._source.chart, // Use public accessor method
            this._p1, this._p2, this._source._options, this._source.hovered);
        }
    }

    class TwoPointDrawing extends Drawing {
        _paneViews = [];
        _hovered = false;
        constructor(p1, p2, options) {
            super();
            this.points.push(p1);
            this.points.push(p2);
            this._options = {
                ...defaultOptions$2,
                ...options,
            };
        }
        setFirstPoint(point) {
            this.updatePoints(point);
        }
        setSecondPoint(point) {
            this.updatePoints(null, point);
        }
        get p1() { return this.points[0]; }
        get p2() { return this.points[1]; }
        get hovered() { return this._hovered; }
    }

    const defaultBoxOptions$1 = {
        fillEnabled: true,
        fillColor: 'rgba(100, 255, 100, 0.6)',
        lineColor: 'rgba(0, 0, 0, 0.6)',
        lineStyle: lightweightCharts.LineStyle.Dashed,
        width: 1,
    };
    class Measure extends TwoPointDrawing {
        _type = "Measure";
        isTemporary = true;
        constructor(p1, p2, options) {
            super(p1, p2, options);
            this._options = {
                ...defaultBoxOptions$1,
                ...options,
            };
            this._paneViews = [new MeasurePaneView(this)];
        }
        // autoscaleInfo(startTimePoint: Logical, endTimePoint: Logical): AutoscaleInfo | null {
        // const p1Index = this._pointIndex(this._p1);
        // const p2Index = this._pointIndex(this._p2);
        // if (p1Index === null || p2Index === null) return null;
        // if (endTimePoint < p1Index || startTimePoint > p2Index) return null;
        // return {
        //  priceRange: {
        //      minValue: this._minPrice,
        //      maxValue: this._maxPrice,
        //  },
        // };
        // }
        _moveToState(state) {
            switch (state) {
                case InteractionState.NONE:
                    document.body.style.cursor = "default";
                    this._hovered = false;
                    this._unsubscribe("mousedown", this._handleMouseDownInteraction);
                    break;
                case InteractionState.HOVERING:
                    document.body.style.cursor = "pointer";
                    this._hovered = true;
                    this._unsubscribe("mouseup", this._handleMouseUpInteraction);
                    this._subscribe("mousedown", this._handleMouseDownInteraction);
                    this.chart.applyOptions({ handleScroll: true });
                    break;
                case InteractionState.DRAGGINGP1:
                case InteractionState.DRAGGINGP2:
                case InteractionState.DRAGGINGP3:
                case InteractionState.DRAGGINGP4:
                case InteractionState.DRAGGING:
                    document.body.style.cursor = "grabbing";
                    document.body.addEventListener("mouseup", this._handleMouseUpInteraction);
                    this._subscribe("mouseup", this._handleMouseUpInteraction);
                    this.chart.applyOptions({ handleScroll: false });
                    break;
            }
            this._state = state;
        }
        _onDrag(diff) {
            if (this._state == InteractionState.DRAGGING || this._state == InteractionState.DRAGGINGP1) {
                this._addDiffToPoint(this.p1, diff.logical, diff.price);
            }
            if (this._state == InteractionState.DRAGGING || this._state == InteractionState.DRAGGINGP2) {
                this._addDiffToPoint(this.p2, diff.logical, diff.price);
            }
            if (this._state != InteractionState.DRAGGING) {
                if (this._state == InteractionState.DRAGGINGP3) {
                    this._addDiffToPoint(this.p1, diff.logical, 0);
                    this._addDiffToPoint(this.p2, 0, diff.price);
                }
                if (this._state == InteractionState.DRAGGINGP4) {
                    this._addDiffToPoint(this.p1, 0, diff.price);
                    this._addDiffToPoint(this.p2, diff.logical, 0);
                }
            }
        }
        _onMouseDown() {
            this._startDragPoint = null;
            const hoverPoint = this._latestHoverPoint;
            const p1 = this._paneViews[0]._p1;
            const p2 = this._paneViews[0]._p2;
            if (!p1.x || !p2.x || !p1.y || !p2.y)
                return this._moveToState(InteractionState.DRAGGING);
            const tolerance = 10;
            if (Math.abs(hoverPoint.x - p1.x) < tolerance && Math.abs(hoverPoint.y - p1.y) < tolerance) {
                this._moveToState(InteractionState.DRAGGINGP1);
            }
            else if (Math.abs(hoverPoint.x - p2.x) < tolerance && Math.abs(hoverPoint.y - p2.y) < tolerance) {
                this._moveToState(InteractionState.DRAGGINGP2);
            }
            else if (Math.abs(hoverPoint.x - p1.x) < tolerance && Math.abs(hoverPoint.y - p2.y) < tolerance) {
                this._moveToState(InteractionState.DRAGGINGP3);
            }
            else if (Math.abs(hoverPoint.x - p2.x) < tolerance && Math.abs(hoverPoint.y - p1.y) < tolerance) {
                this._moveToState(InteractionState.DRAGGINGP4);
            }
            else {
                this._moveToState(InteractionState.DRAGGING);
            }
        }
        _mouseIsOverDrawing(param, tolerance = 4) {
            if (!param.point)
                return false;
            const x1 = this._paneViews[0]._p1.x;
            const y1 = this._paneViews[0]._p1.y;
            const x2 = this._paneViews[0]._p2.x;
            const y2 = this._paneViews[0]._p2.y;
            if (!x1 || !x2 || !y1 || !y2)
                return false;
            const mouseX = param.point.x;
            const mouseY = param.point.y;
            const mainX = Math.min(x1, x2);
            const mainY = Math.min(y1, y2);
            const width = Math.abs(x1 - x2);
            const height = Math.abs(y1 - y2);
            const halfTolerance = tolerance / 2;
            return mouseX > mainX - halfTolerance && mouseX < mainX + width + halfTolerance &&
                mouseY > mainY - halfTolerance && mouseY < mainY + height + halfTolerance;
        }
    }

    class DrawingTool {
        _chart;
        _series;
        _finishDrawingCallback = null;
        _drawings = [];
        _activeDrawing = null;
        _isDrawing = false;
        _drawingType = null;
        _measureClickCount = 0;
        constructor(chart, series, finishDrawingCallback = null) {
            this._chart = chart;
            this._series = series;
            this._finishDrawingCallback = finishDrawingCallback;
            this._chart.subscribeClick(this._clickHandler);
            this._chart.subscribeCrosshairMove(this._moveHandler);
        }
        _clickHandler = (param) => this._onClick(param);
        _moveHandler = (param) => this._onMouseMove(param);
        beginDrawing(DrawingType) {
            this._drawingType = DrawingType;
            this._isDrawing = true;
            if (DrawingType === Measure) {
                this._measureClickCount = 0;
            }
        }
        stopDrawing() {
            this._isDrawing = false;
            this._activeDrawing = null;
            this._measureClickCount = 0;
        }
        get drawings() {
            return this._drawings;
        }
        addNewDrawing(drawing) {
            this._series.attachPrimitive(drawing);
            this._drawings.push(drawing);
        }
        delete(d) {
            if (d == null)
                return;
            const idx = this._drawings.indexOf(d);
            if (idx == -1)
                return;
            this._drawings.splice(idx, 1);
            d.detach();
        }
        clearDrawings() {
            for (const d of this._drawings)
                d.detach();
            this._drawings = [];
        }
        repositionOnTime() {
            for (const drawing of this.drawings) {
                const newPoints = [];
                for (const point of drawing.points) {
                    if (!point) {
                        newPoints.push(point);
                        continue;
                    }
                    const logical = point.time
                        ? this._chart.timeScale().coordinateToLogical(this._chart.timeScale().timeToCoordinate(point.time) || 0)
                        : point.logical;
                    newPoints.push({
                        time: point.time,
                        logical: logical,
                        price: point.price,
                    });
                }
                drawing.updatePoints(...newPoints);
            }
        }
        _onClick(param) {
            if (!this._isDrawing)
                return;
            const point = Drawing._eventToPoint(param, this._series);
            if (!point)
                return;
            // Gestion spéciale pour l'outil Measure
            if (this._drawingType === Measure) {
                // Premier clic : création de l'outil
                if (this._measureClickCount === 0) {
                    this._activeDrawing = new Measure(point, point);
                    this._series.attachPrimitive(this._activeDrawing);
                    this._measureClickCount++;
                    return;
                }
                // Deuxième clic : effacement de l'outil
                else if (this._measureClickCount === 1) {
                    if (this._activeDrawing) {
                        this._activeDrawing.detach();
                        this._activeDrawing = null;
                    }
                    this._measureClickCount = 0;
                    // Appeler le callback de fin de dessin
                    if (this._finishDrawingCallback) {
                        this._finishDrawingCallback();
                    }
                    return;
                }
            }
            // Gestion normale pour les autres outils
            else {
                if (this._activeDrawing == null) {
                    if (this._drawingType == null)
                        return;
                    this._activeDrawing = new this._drawingType(point, point);
                    this._series.attachPrimitive(this._activeDrawing);
                    // Si c'est un HorizontalLine, on continue comme avant
                    if (this._drawingType == HorizontalLine)
                        this._onClick(param);
                }
                else {
                    this._drawings.push(this._activeDrawing);
                    this.stopDrawing();
                    if (!this._finishDrawingCallback)
                        return;
                    this._finishDrawingCallback();
                }
            }
        }
        _onMouseMove(param) {
            if (!param)
                return;
            for (const t of this._drawings)
                t._handleHoverInteraction(param);
            if (!this._isDrawing || !this._activeDrawing)
                return;
            const point = Drawing._eventToPoint(param, this._series);
            if (!point)
                return;
            this._activeDrawing.updatePoints(null, point);
            // this._activeDrawing.setSecondPoint(point);
        }
    }

    class TrendLinePaneRenderer extends TwoPointDrawingPaneRenderer {
        constructor(p1, p2, options, hovered) {
            super(p1, p2, options, hovered);
        }
        draw(target) {
            target.useBitmapCoordinateSpace(scope => {
                if (this._p1.x === null ||
                    this._p1.y === null ||
                    this._p2.x === null ||
                    this._p2.y === null)
                    return;
                const ctx = scope.context;
                const scaled = this._getScaledCoordinates(scope);
                if (!scaled)
                    return;
                ctx.lineWidth = this._options.width;
                ctx.strokeStyle = this._options.lineColor;
                setLineStyle(ctx, this._options.lineStyle);
                ctx.beginPath();
                ctx.moveTo(scaled.x1, scaled.y1);
                ctx.lineTo(scaled.x2, scaled.y2);
                ctx.stroke();
                // this._drawTextLabel(scope, this._text1, x1Scaled, y1Scaled, true);
                // this._drawTextLabel(scope, this._text2, x2Scaled, y2Scaled, false);
                if (!this._hovered)
                    return;
                this._drawEndCircle(scope, scaled.x1, scaled.y1);
                this._drawEndCircle(scope, scaled.x2, scaled.y2);
            });
        }
    }

    class TrendLinePaneView extends TwoPointDrawingPaneView {
        constructor(source) {
            super(source);
        }
        renderer() {
            return new TrendLinePaneRenderer(this._p1, this._p2, this._source._options, this._source.hovered);
        }
    }

    class TrendLine extends TwoPointDrawing {
        _type = "TrendLine";
        constructor(p1, p2, options) {
            super(p1, p2, options);
            this._paneViews = [new TrendLinePaneView(this)];
        }
        _moveToState(state) {
            switch (state) {
                case InteractionState.NONE:
                    document.body.style.cursor = "default";
                    this._hovered = false;
                    this.requestUpdate();
                    this._unsubscribe("mousedown", this._handleMouseDownInteraction);
                    break;
                case InteractionState.HOVERING:
                    document.body.style.cursor = "pointer";
                    this._hovered = true;
                    this.requestUpdate();
                    this._subscribe("mousedown", this._handleMouseDownInteraction);
                    this._unsubscribe("mouseup", this._handleMouseDownInteraction);
                    this.chart.applyOptions({ handleScroll: true });
                    break;
                case InteractionState.DRAGGINGP1:
                case InteractionState.DRAGGINGP2:
                case InteractionState.DRAGGING:
                    document.body.style.cursor = "grabbing";
                    this._subscribe("mouseup", this._handleMouseUpInteraction);
                    this.chart.applyOptions({ handleScroll: false });
                    break;
            }
            this._state = state;
        }
        _onDrag(diff) {
            if (this._state == InteractionState.DRAGGING || this._state == InteractionState.DRAGGINGP1) {
                this._addDiffToPoint(this.p1, diff.logical, diff.price);
            }
            if (this._state == InteractionState.DRAGGING || this._state == InteractionState.DRAGGINGP2) {
                this._addDiffToPoint(this.p2, diff.logical, diff.price);
            }
        }
        _onMouseDown() {
            this._startDragPoint = null;
            const hoverPoint = this._latestHoverPoint;
            if (!hoverPoint)
                return;
            const p1 = this._paneViews[0]._p1;
            const p2 = this._paneViews[0]._p2;
            if (!p1.x || !p2.x || !p1.y || !p2.y)
                return this._moveToState(InteractionState.DRAGGING);
            const tolerance = 10;
            if (Math.abs(hoverPoint.x - p1.x) < tolerance && Math.abs(hoverPoint.y - p1.y) < tolerance) {
                this._moveToState(InteractionState.DRAGGINGP1);
            }
            else if (Math.abs(hoverPoint.x - p2.x) < tolerance && Math.abs(hoverPoint.y - p2.y) < tolerance) {
                this._moveToState(InteractionState.DRAGGINGP2);
            }
            else {
                this._moveToState(InteractionState.DRAGGING);
            }
        }
        _mouseIsOverDrawing(param, tolerance = 4) {
            if (!param.point)
                return false;
            const x1 = this._paneViews[0]._p1.x;
            const y1 = this._paneViews[0]._p1.y;
            const x2 = this._paneViews[0]._p2.x;
            const y2 = this._paneViews[0]._p2.y;
            if (!x1 || !x2 || !y1 || !y2)
                return false;
            const mouseX = param.point.x;
            const mouseY = param.point.y;
            if (mouseX <= Math.min(x1, x2) - tolerance ||
                mouseX >= Math.max(x1, x2) + tolerance) {
                return false;
            }
            const distance = Math.abs((y2 - y1) * mouseX - (x2 - x1) * mouseY + x2 * y1 - y2 * x1) / Math.sqrt((y2 - y1) ** 2 + (x2 - x1) ** 2);
            return distance <= tolerance;
        }
    }

    class BoxPaneRenderer extends TwoPointDrawingPaneRenderer {
        constructor(p1, p2, options, showCircles) {
            super(p1, p2, options, showCircles);
        }
        draw(target) {
            target.useBitmapCoordinateSpace(scope => {
                const ctx = scope.context;
                const scaled = this._getScaledCoordinates(scope);
                if (!scaled)
                    return;
                ctx.lineWidth = this._options.width;
                ctx.strokeStyle = this._options.lineColor;
                setLineStyle(ctx, this._options.lineStyle);
                ctx.fillStyle = this._options.fillColor;
                const mainX = Math.min(scaled.x1, scaled.x2);
                const mainY = Math.min(scaled.y1, scaled.y2);
                const width = Math.abs(scaled.x1 - scaled.x2);
                const height = Math.abs(scaled.y1 - scaled.y2);
                ctx.strokeRect(mainX, mainY, width, height);
                ctx.fillRect(mainX, mainY, width, height);
                if (!this._hovered)
                    return;
                this._drawEndCircle(scope, mainX, mainY);
                this._drawEndCircle(scope, mainX + width, mainY);
                this._drawEndCircle(scope, mainX + width, mainY + height);
                this._drawEndCircle(scope, mainX, mainY + height);
            });
        }
    }

    class BoxPaneView extends TwoPointDrawingPaneView {
        constructor(source) {
            super(source);
        }
        renderer() {
            return new BoxPaneRenderer(this._p1, this._p2, this._source._options, this._source.hovered);
        }
    }

    const defaultBoxOptions = {
        fillEnabled: true,
        fillColor: 'rgba(255, 255, 255, 0.2)',
        ...defaultOptions$2
    };
    class Box extends TwoPointDrawing {
        _type = "Box";
        constructor(p1, p2, options) {
            super(p1, p2, options);
            this._options = {
                ...defaultBoxOptions,
                ...options,
            };
            this._paneViews = [new BoxPaneView(this)];
        }
        // autoscaleInfo(startTimePoint: Logical, endTimePoint: Logical): AutoscaleInfo | null {
        // const p1Index = this._pointIndex(this._p1);
        // const p2Index = this._pointIndex(this._p2);
        // if (p1Index === null || p2Index === null) return null;
        // if (endTimePoint < p1Index || startTimePoint > p2Index) return null;
        // return {
        //  priceRange: {
        //      minValue: this._minPrice,
        //      maxValue: this._maxPrice,
        //  },
        // };
        // }
        _moveToState(state) {
            switch (state) {
                case InteractionState.NONE:
                    document.body.style.cursor = "default";
                    this._hovered = false;
                    this._unsubscribe("mousedown", this._handleMouseDownInteraction);
                    break;
                case InteractionState.HOVERING:
                    document.body.style.cursor = "pointer";
                    this._hovered = true;
                    this._unsubscribe("mouseup", this._handleMouseUpInteraction);
                    this._subscribe("mousedown", this._handleMouseDownInteraction);
                    this.chart.applyOptions({ handleScroll: true });
                    break;
                case InteractionState.DRAGGINGP1:
                case InteractionState.DRAGGINGP2:
                case InteractionState.DRAGGINGP3:
                case InteractionState.DRAGGINGP4:
                case InteractionState.DRAGGING:
                    document.body.style.cursor = "grabbing";
                    document.body.addEventListener("mouseup", this._handleMouseUpInteraction);
                    this._subscribe("mouseup", this._handleMouseUpInteraction);
                    this.chart.applyOptions({ handleScroll: false });
                    break;
            }
            this._state = state;
        }
        _onDrag(diff) {
            if (this._state == InteractionState.DRAGGING || this._state == InteractionState.DRAGGINGP1) {
                this._addDiffToPoint(this.p1, diff.logical, diff.price);
            }
            if (this._state == InteractionState.DRAGGING || this._state == InteractionState.DRAGGINGP2) {
                this._addDiffToPoint(this.p2, diff.logical, diff.price);
            }
            if (this._state != InteractionState.DRAGGING) {
                if (this._state == InteractionState.DRAGGINGP3) {
                    this._addDiffToPoint(this.p1, diff.logical, 0);
                    this._addDiffToPoint(this.p2, 0, diff.price);
                }
                if (this._state == InteractionState.DRAGGINGP4) {
                    this._addDiffToPoint(this.p1, 0, diff.price);
                    this._addDiffToPoint(this.p2, diff.logical, 0);
                }
            }
        }
        _onMouseDown() {
            this._startDragPoint = null;
            const hoverPoint = this._latestHoverPoint;
            const p1 = this._paneViews[0]._p1;
            const p2 = this._paneViews[0]._p2;
            if (!p1.x || !p2.x || !p1.y || !p2.y)
                return this._moveToState(InteractionState.DRAGGING);
            const tolerance = 10;
            if (Math.abs(hoverPoint.x - p1.x) < tolerance && Math.abs(hoverPoint.y - p1.y) < tolerance) {
                this._moveToState(InteractionState.DRAGGINGP1);
            }
            else if (Math.abs(hoverPoint.x - p2.x) < tolerance && Math.abs(hoverPoint.y - p2.y) < tolerance) {
                this._moveToState(InteractionState.DRAGGINGP2);
            }
            else if (Math.abs(hoverPoint.x - p1.x) < tolerance && Math.abs(hoverPoint.y - p2.y) < tolerance) {
                this._moveToState(InteractionState.DRAGGINGP3);
            }
            else if (Math.abs(hoverPoint.x - p2.x) < tolerance && Math.abs(hoverPoint.y - p1.y) < tolerance) {
                this._moveToState(InteractionState.DRAGGINGP4);
            }
            else {
                this._moveToState(InteractionState.DRAGGING);
            }
        }
        _mouseIsOverDrawing(param, tolerance = 4) {
            if (!param.point)
                return false;
            const x1 = this._paneViews[0]._p1.x;
            const y1 = this._paneViews[0]._p1.y;
            const x2 = this._paneViews[0]._p2.x;
            const y2 = this._paneViews[0]._p2.y;
            if (!x1 || !x2 || !y1 || !y2)
                return false;
            const mouseX = param.point.x;
            const mouseY = param.point.y;
            const mainX = Math.min(x1, x2);
            const mainY = Math.min(y1, y2);
            const width = Math.abs(x1 - x2);
            const height = Math.abs(y1 - y2);
            const halfTolerance = tolerance / 2;
            return mouseX > mainX - halfTolerance && mouseX < mainX + width + halfTolerance &&
                mouseY > mainY - halfTolerance && mouseY < mainY + height + halfTolerance;
        }
    }

    class RayLine extends HorizontalLine {
        _type = 'RayLine';
        constructor(point, options) {
            super({ ...point }, options);
            this._point.time = point.time;
        }
        updatePoints(...points) {
            for (const p of points)
                if (p)
                    this._point = p;
            this.requestUpdate();
        }
        _onDrag(diff) {
            this._addDiffToPoint(this._point, diff.logical, diff.price);
            this.requestUpdate();
        }
        _mouseIsOverDrawing(param, tolerance = 4) {
            if (!param.point)
                return false;
            const y = this.series.priceToCoordinate(this._point.price);
            const x = this._point.time ? this.chart.timeScale().timeToCoordinate(this._point.time) : null;
            if (!y || !x)
                return false;
            return (Math.abs(y - param.point.y) < tolerance && param.point.x > x - tolerance);
        }
    }

    class VerticalLinePaneRenderer extends DrawingPaneRenderer {
        _point = { x: null, y: null };
        constructor(point, options) {
            super(options);
            this._point = point;
        }
        draw(target) {
            target.useBitmapCoordinateSpace(scope => {
                if (this._point.x == null)
                    return;
                const ctx = scope.context;
                const scaledX = this._point.x * scope.horizontalPixelRatio;
                ctx.lineWidth = this._options.width;
                ctx.strokeStyle = this._options.lineColor;
                setLineStyle(ctx, this._options.lineStyle);
                ctx.beginPath();
                ctx.moveTo(scaledX, 0);
                ctx.lineTo(scaledX, scope.bitmapSize.height);
                ctx.stroke();
            });
        }
    }

    class VerticalLinePaneView extends DrawingPaneView {
        _source;
        _point = { x: null, y: null };
        constructor(source) {
            super(source);
            this._source = source;
        }
        update() {
            const point = this._source._point;
            const timeScale = this._source.chart.timeScale();
            const series = this._source.series;
            this._point.x = point.time ? timeScale.timeToCoordinate(point.time) : timeScale.logicalToCoordinate(point.logical);
            this._point.y = series.priceToCoordinate(point.price);
        }
        renderer() {
            return new VerticalLinePaneRenderer(this._point, this._source._options);
        }
    }

    class VerticalLineTimeAxisView {
        _source;
        _x = null;
        constructor(source) {
            this._source = source;
        }
        update() {
            if (!this._source.chart || !this._source._point)
                return;
            const point = this._source._point;
            const timeScale = this._source.chart.timeScale();
            this._x = point.time ? timeScale.timeToCoordinate(point.time) : timeScale.logicalToCoordinate(point.logical);
        }
        visible() {
            return !!this._source._options.text;
        }
        tickVisible() {
            return true;
        }
        coordinate() {
            return this._x ?? 0;
        }
        text() {
            return this._source._options.text || '';
        }
        textColor() {
            return "white";
        }
        backColor() {
            return this._source._options.lineColor;
        }
    }

    class VerticalLine extends Drawing {
        _type = 'VerticalLine';
        _paneViews;
        _timeAxisViews;
        _point;
        _callbackName;
        _startDragPoint = null;
        constructor(point, options, callbackName = null) {
            super(options);
            this._point = point;
            this._paneViews = [new VerticalLinePaneView(this)];
            this._callbackName = callbackName;
            this._timeAxisViews = [new VerticalLineTimeAxisView(this)];
        }
        updateAllViews() {
            this._paneViews.forEach(pw => pw.update());
            this._timeAxisViews.forEach(tw => tw.update());
        }
        timeAxisViews() {
            return this._timeAxisViews;
        }
        updatePoints(...points) {
            for (const p of points) {
                if (!p)
                    continue;
                if (!p.time && p.logical) {
                    p.time = this.series.dataByIndex(p.logical)?.time || null;
                }
                this._point = p;
            }
            this.requestUpdate();
        }
        get points() {
            return [this._point];
        }
        _moveToState(state) {
            switch (state) {
                case InteractionState.NONE:
                    document.body.style.cursor = "default";
                    this._unsubscribe("mousedown", this._handleMouseDownInteraction);
                    break;
                case InteractionState.HOVERING:
                    document.body.style.cursor = "pointer";
                    this._unsubscribe("mouseup", this._childHandleMouseUpInteraction);
                    this._subscribe("mousedown", this._handleMouseDownInteraction);
                    this.chart.applyOptions({ handleScroll: true });
                    break;
                case InteractionState.DRAGGING:
                    document.body.style.cursor = "grabbing";
                    this._subscribe("mouseup", this._childHandleMouseUpInteraction);
                    this.chart.applyOptions({ handleScroll: false });
                    break;
            }
            this._state = state;
        }
        _onDrag(diff) {
            this._addDiffToPoint(this._point, diff.logical, 0);
            this.requestUpdate();
        }
        _mouseIsOverDrawing(param, tolerance = 4) {
            if (!param.point)
                return false;
            const timeScale = this.chart.timeScale();
            let x;
            if (this._point.time) {
                x = timeScale.timeToCoordinate(this._point.time);
            }
            else {
                x = timeScale.logicalToCoordinate(this._point.logical);
            }
            if (!x)
                return false;
            return (Math.abs(x - param.point.x) < tolerance);
        }
        _onMouseDown() {
            this._startDragPoint = null;
            const hoverPoint = this._latestHoverPoint;
            if (!hoverPoint)
                return;
            return this._moveToState(InteractionState.DRAGGING);
        }
        _childHandleMouseUpInteraction = () => {
            this._handleMouseUpInteraction();
            if (!this._callbackName)
                return;
            window.callbackFunction(`${this._callbackName}_~_${this._point.price.toFixed(8)}`);
        };
    }

    class ToolBox {
        static MEASURE_SVG = '<rect x="12" y="4" width="1" height="20"/><rect x="4" y="12" width="20" height="1"/>';
        static TREND_SVG = '<rect x="3.84" y="13.67" transform="matrix(0.7071 -0.7071 0.7071 0.7071 -5.9847 14.4482)" width="21.21" height="1.56"/><path d="M23,3.17L20.17,6L23,8.83L25.83,6L23,3.17z M23,7.41L21.59,6L23,4.59L24.41,6L23,7.41z"/><path d="M6,20.17L3.17,23L6,25.83L8.83,23L6,20.17z M6,24.41L4.59,23L6,21.59L7.41,23L6,24.41z"/>';
        static HORZ_SVG = '<rect x="4" y="14" width="9" height="1"/><rect x="16" y="14" width="9" height="1"/><path d="M11.67,14.5l2.83,2.83l2.83-2.83l-2.83-2.83L11.67,14.5z M15.91,14.5l-1.41,1.41l-1.41-1.41l1.41-1.41L15.91,14.5z"/>';
        static RAY_SVG = '<rect x="8" y="14" width="17" height="1"/><path d="M3.67,14.5l2.83,2.83l2.83-2.83L6.5,11.67L3.67,14.5z M7.91,14.5L6.5,15.91L5.09,14.5l1.41-1.41L7.91,14.5z"/>';
        static BOX_SVG = '<rect x="8" y="6" width="12" height="1"/><rect x="9" y="22" width="11" height="1"/><path d="M3.67,6.5L6.5,9.33L9.33,6.5L6.5,3.67L3.67,6.5z M7.91,6.5L6.5,7.91L5.09,6.5L6.5,5.09L7.91,6.5z"/><path d="M19.67,6.5l2.83,2.83l2.83-2.83L22.5,3.67L19.67,6.5z M23.91,6.5L22.5,7.91L21.09,6.5l1.41-1.41L23.91,6.5z"/><path d="M19.67,22.5l2.83,2.83l2.83-2.83l-2.83-2.83L19.67,22.5z M23.91,22.5l-1.41,1.41l-1.41-1.41l1.41-1.41L23.91,22.5z"/><path d="M3.67,22.5l2.83,2.83l2.83-2.83L6.5,19.67L3.67,22.5z M7.91,22.5L6.5,23.91L5.09,22.5l1.41-1.41L7.91,22.5z"/><rect x="22" y="9" width="1" height="11"/><rect x="6" y="9" width="1" height="11"/>';
        static VERT_SVG = ToolBox.RAY_SVG;
        div;
        activeIcon = null;
        buttons = [];
        _commandFunctions;
        _handlerID;
        _drawingTool;
        handler;
        constructor(handler, handlerID, chart, series, commandFunctions) {
            this._handlerID = handlerID;
            this._commandFunctions = commandFunctions;
            this._drawingTool = new DrawingTool(chart, series, () => this.removeActiveAndSave());
            this.div = this._makeToolBox();
            this.handler = handler;
            this.handler.ContextMenu.setupDrawingTools(this.saveDrawings, this._drawingTool);
            commandFunctions.push((event) => {
                if ((event.metaKey || event.ctrlKey) && event.code === 'KeyZ') {
                    const drawingToDelete = this._drawingTool.drawings.pop();
                    if (drawingToDelete)
                        this._drawingTool.delete(drawingToDelete);
                    return true;
                }
                return false;
            });
        }
        toJSON() {
            // Exclude the chart attribute from serialization
            const { ...serialized } = this;
            return serialized;
        }
        _makeToolBox() {
            let div = document.createElement('div');
            div.classList.add('toolbox');
            this.buttons.push(this._makeToolBoxElement(Measure, 'KeyM', ToolBox.MEASURE_SVG));
            this.buttons.push(this._makeToolBoxElement(TrendLine, 'KeyT', ToolBox.TREND_SVG));
            this.buttons.push(this._makeToolBoxElement(HorizontalLine, 'KeyH', ToolBox.HORZ_SVG));
            this.buttons.push(this._makeToolBoxElement(RayLine, 'KeyR', ToolBox.RAY_SVG));
            this.buttons.push(this._makeToolBoxElement(Box, 'KeyB', ToolBox.BOX_SVG));
            this.buttons.push(this._makeToolBoxElement(VerticalLine, 'KeyV', ToolBox.VERT_SVG, true));
            for (const button of this.buttons) {
                div.appendChild(button);
            }
            return div;
        }
        _makeToolBoxElement(DrawingType, keyCmd, paths, rotate = false) {
            const elem = document.createElement('div');
            elem.classList.add("toolbox-button");
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("width", "29");
            svg.setAttribute("height", "29");
            const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
            group.innerHTML = paths;
            group.setAttribute("fill", window.pane.color);
            svg.appendChild(group);
            elem.appendChild(svg);
            const icon = { div: elem, group: group, type: DrawingType };
            elem.addEventListener('click', () => this._onIconClick(icon));
            this._commandFunctions.push((event) => {
                if (this._handlerID !== window.handlerInFocus)
                    return false;
                if (event.altKey && event.code === keyCmd) {
                    event.preventDefault();
                    this._onIconClick(icon);
                    return true;
                }
                return false;
            });
            if (rotate == true) {
                svg.style.transform = 'rotate(90deg)';
                svg.style.transformBox = 'fill-box';
                svg.style.transformOrigin = 'center';
            }
            return elem;
        }
        _onIconClick(icon) {
            if (this.activeIcon) {
                this.activeIcon.div.classList.remove('active-toolbox-button');
                window.setCursor('crosshair');
                this._drawingTool?.stopDrawing();
                if (this.activeIcon === icon) {
                    this.activeIcon = null;
                    return;
                }
            }
            this.activeIcon = icon;
            this.activeIcon.div.classList.add('active-toolbox-button');
            window.setCursor('crosshair');
            this._drawingTool?.beginDrawing(this.activeIcon.type);
        }
        removeActiveAndSave = () => {
            window.setCursor('default');
            if (this.activeIcon)
                this.activeIcon.div.classList.remove('active-toolbox-button');
            this.activeIcon = null;
            this.saveDrawings();
        };
        addNewDrawing(d) {
            this._drawingTool.addNewDrawing(d);
        }
        clearDrawings() {
            this._drawingTool.clearDrawings();
        }
        saveDrawings = () => {
            const drawingMeta = [];
            for (const d of this._drawingTool.drawings) {
                drawingMeta.push({
                    type: d._type,
                    points: d.points,
                    options: d._options
                });
            }
            const string = JSON.stringify(drawingMeta);
            window.callbackFunction(`save_drawings${this._handlerID}_~_${string}`);
        };
        loadDrawings(drawings) {
            drawings.forEach((d) => {
                switch (d.type) {
                    case "Box":
                        this._drawingTool.addNewDrawing(new Box(d.points[0], d.points[1], d.options));
                        break;
                    case "TrendLine":
                        this._drawingTool.addNewDrawing(new TrendLine(d.points[0], d.points[1], d.options));
                        break;
                    case "HorizontalLine":
                        this._drawingTool.addNewDrawing(new HorizontalLine(d.points[0], d.options));
                        break;
                    case "RayLine":
                        this._drawingTool.addNewDrawing(new RayLine(d.points[0], d.options));
                        break;
                    case "VerticalLine":
                        this._drawingTool.addNewDrawing(new VerticalLine(d.points[0], d.options));
                        break;
                }
            });
        }
    }

    class Menu {
        makeButton;
        callbackName;
        div;
        isOpen = false;
        widget;
        constructor(makeButton, callbackName, items, activeItem, separator, align) {
            this.makeButton = makeButton;
            this.callbackName = callbackName;
            this.div = document.createElement('div');
            this.div.classList.add('topbar-menu');
            this.widget = this.makeButton(activeItem + ' ↓', null, separator, true, align);
            this.updateMenuItems(items);
            this.widget.elem.addEventListener('click', () => {
                this.isOpen = !this.isOpen;
                if (!this.isOpen) {
                    this.div.style.display = 'none';
                    return;
                }
                let rect = this.widget.elem.getBoundingClientRect();
                this.div.style.display = 'flex';
                this.div.style.flexDirection = 'column';
                let center = rect.x + (rect.width / 2);
                this.div.style.left = center - (this.div.clientWidth / 2) + 'px';
                this.div.style.top = rect.y + rect.height + 'px';
            });
            document.body.appendChild(this.div);
        }
        updateMenuItems(items) {
            this.div.innerHTML = '';
            items.forEach(text => {
                let button = this.makeButton(text, null, false, false);
                button.elem.addEventListener('click', () => {
                    this._clickHandler(button.elem.innerText);
                });
                button.elem.style.margin = '4px 4px';
                button.elem.style.padding = '2px 2px';
                this.div.appendChild(button.elem);
            });
            this.widget.elem.innerText = items[0] + ' ↓';
        }
        _clickHandler(name) {
            this.widget.elem.innerText = name + ' ↓';
            window.callbackFunction(`${this.callbackName}_~_${name}`);
            this.div.style.display = 'none';
            this.isOpen = false;
        }
    }

    class TopBar {
        _handler;
        _div;
        left;
        right;
        constructor(handler) {
            this._handler = handler;
            this._div = document.createElement('div');
            this._div.classList.add('topbar');
            const createTopBarContainer = (justification) => {
                const div = document.createElement('div');
                div.classList.add('topbar-container');
                div.style.justifyContent = justification;
                this._div.appendChild(div);
                return div;
            };
            this.left = createTopBarContainer('flex-start');
            this.right = createTopBarContainer('flex-end');
        }
        makeSwitcher(items, defaultItem, callbackName, align = 'left') {
            const switcherElement = document.createElement('div');
            switcherElement.style.margin = '4px 12px';
            let activeItemEl;
            const createAndReturnSwitcherButton = (itemName) => {
                const button = document.createElement('button');
                button.classList.add('topbar-button');
                button.classList.add('switcher-button');
                button.style.margin = '0px 2px';
                button.innerText = itemName;
                if (itemName == defaultItem) {
                    activeItemEl = button;
                    button.classList.add('active-switcher-button');
                }
                const buttonWidth = TopBar.getClientWidth(button);
                button.style.minWidth = buttonWidth + 1 + 'px';
                button.addEventListener('click', () => widget.onItemClicked(button));
                switcherElement.appendChild(button);
                return button;
            };
            const widget = {
                elem: switcherElement,
                callbackName: callbackName,
                intervalElements: items.map(createAndReturnSwitcherButton),
                onItemClicked: (item) => {
                    if (item == activeItemEl)
                        return;
                    activeItemEl.classList.remove('active-switcher-button');
                    item.classList.add('active-switcher-button');
                    activeItemEl = item;
                    window.callbackFunction(`${widget.callbackName}_~_${item.innerText}`);
                }
            };
            this.appendWidget(switcherElement, align, true);
            return widget;
        }
        makeTextBoxWidget(text, align = 'left', callbackName = null) {
            if (callbackName) {
                const textBox = document.createElement('input');
                textBox.classList.add('topbar-textbox-input');
                textBox.value = text;
                textBox.style.width = `${(textBox.value.length + 2)}ch`;
                textBox.addEventListener('focus', () => {
                    window.textBoxFocused = true;
                });
                textBox.addEventListener('input', (e) => {
                    e.preventDefault();
                    textBox.style.width = `${(textBox.value.length + 2)}ch`;
                });
                textBox.addEventListener('keydown', (e) => {
                    if (e.key == 'Enter') {
                        e.preventDefault();
                        textBox.blur();
                    }
                });
                textBox.addEventListener('blur', () => {
                    window.callbackFunction(`${callbackName}_~_${textBox.value}`);
                    window.textBoxFocused = false;
                });
                this.appendWidget(textBox, align, true);
                return textBox;
            }
            else {
                const textBox = document.createElement('div');
                textBox.classList.add('topbar-textbox');
                textBox.innerText = text;
                this.appendWidget(textBox, align, true);
                return textBox;
            }
        }
        makeMenu(items, activeItem, separator, callbackName, align) {
            return new Menu(this.makeButton.bind(this), callbackName, items, activeItem, separator, align);
        }
        makeButton(defaultText, callbackName, separator, append = true, align = 'left', toggle = false) {
            let button = document.createElement('button');
            button.classList.add('topbar-button');
            // button.style.color = window.pane.color
            button.innerText = defaultText;
            document.body.appendChild(button);
            button.style.minWidth = button.clientWidth + 1 + 'px';
            document.body.removeChild(button);
            let widget = {
                elem: button,
                callbackName: callbackName
            };
            if (callbackName) {
                let handler;
                if (toggle) {
                    let state = false;
                    handler = () => {
                        state = !state;
                        window.callbackFunction(`${widget.callbackName}_~_${state}`);
                        button.style.backgroundColor = state ? 'var(--active-bg-color)' : '';
                        button.style.color = state ? 'var(--active-color)' : '';
                    };
                }
                else {
                    handler = () => window.callbackFunction(`${widget.callbackName}_~_${button.innerText}`);
                }
                button.addEventListener('click', handler);
            }
            if (append)
                this.appendWidget(button, align, separator);
            return widget;
        }
        makeSeparator(align = 'left') {
            const separator = document.createElement('div');
            separator.classList.add('topbar-seperator');
            const div = align == 'left' ? this.left : this.right;
            div.appendChild(separator);
        }
        appendWidget(widget, align, separator) {
            const div = align == 'left' ? this.left : this.right;
            if (separator) {
                if (align == 'left')
                    div.appendChild(widget);
                this.makeSeparator(align);
                if (align == 'right')
                    div.appendChild(widget);
            }
            else
                div.appendChild(widget);
            this._handler.reSize();
        }
        static getClientWidth(element) {
            document.body.appendChild(element);
            const width = element.clientWidth;
            document.body.removeChild(element);
            return width;
        }
    }

    const defaultOptions$1 = {
        title: '',
        followMode: 'tracking',
        horizontalDeadzoneWidth: 45,
        verticalDeadzoneHeight: 100,
        verticalSpacing: 20,
        topOffset: 20,
    };
    class TooltipElement {
        _chart;
        _element;
        _titleElement;
        _priceElement;
        _dateElement;
        _timeElement;
        _options;
        _lastTooltipWidth = null;
        constructor(chart, options) {
            this._options = {
                ...defaultOptions$1,
                ...options,
            };
            this._chart = chart;
            const element = document.createElement('div');
            applyStyle(element, {
                display: 'flex',
                'flex-direction': 'column',
                'align-items': 'center',
                position: 'absolute',
                transform: 'translate(calc(0px - 50%), 0px)',
                opacity: '0',
                left: '0%',
                top: '0',
                'z-index': '100',
                'background-color': 'white',
                'border-radius': '4px',
                padding: '5px 10px',
                'font-family': "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif",
                'font-size': '12px',
                'font-weight': '400',
                'box-shadow': '0px 2px 4px rgba(0, 0, 0, 0.2)',
                'line-height': '16px',
                'pointer-events': 'none',
                color: '#131722',
            });
            const titleElement = document.createElement('div');
            applyStyle(titleElement, {
                'font-size': '12px',
                'line-height': '24px',
                'font-weight': '590',
            });
            setElementText(titleElement, this._options.title);
            element.appendChild(titleElement);
            const priceElement = document.createElement('div');
            applyStyle(priceElement, {
                'font-size': '12px',
                'line-height': '18px',
                'font-weight': '590',
            });
            setElementText(priceElement, '');
            element.appendChild(priceElement);
            const dateElement = document.createElement('div');
            applyStyle(dateElement, {
                color: '#787B86',
            });
            setElementText(dateElement, '');
            element.appendChild(dateElement);
            const timeElement = document.createElement('div');
            applyStyle(timeElement, {
                color: '#787B86',
            });
            setElementText(timeElement, '');
            element.appendChild(timeElement);
            this._element = element;
            this._titleElement = titleElement;
            this._priceElement = priceElement;
            this._dateElement = dateElement;
            this._timeElement = timeElement;
            const chartElement = this._chart.chartElement();
            chartElement.appendChild(this._element);
            const chartElementParent = chartElement.parentElement;
            if (!chartElementParent) {
                console.error('Chart Element is not attached to the page.');
                return;
            }
            const position = getComputedStyle(chartElementParent).position;
            if (position !== 'relative' && position !== 'absolute') {
                console.error('Chart Element position is expected be `relative` or `absolute`.');
            }
        }
        destroy() {
            if (this._chart && this._element)
                this._chart.chartElement().removeChild(this._element);
        }
        applyOptions(options) {
            this._options = {
                ...this._options,
                ...options,
            };
        }
        options() {
            return this._options;
        }
        updateTooltipContent(tooltipContentData) {
            if (!this._element) {
                console.warn('Tooltip element not found.');
                return;
            }
            const tooltipMeasurement = this._element.getBoundingClientRect();
            this._lastTooltipWidth = tooltipMeasurement.width;
            if (tooltipContentData.title !== undefined && this._titleElement) {
                console.log(`Setting title: ${tooltipContentData.title}`); // Debug log
                setElementText(this._titleElement, tooltipContentData.title);
            }
            else {
                console.warn('Title element is missing or title data is undefined.');
            }
            setElementText(this._priceElement, tooltipContentData.price);
            setElementText(this._dateElement, tooltipContentData.date);
            setElementText(this._timeElement, tooltipContentData.time);
        }
        updatePosition(positionData) {
            if (!this._chart || !this._element)
                return;
            this._element.style.opacity = positionData.visible ? '1' : '0';
            if (!positionData.visible) {
                return;
            }
            const x = this._calculateXPosition(positionData, this._chart);
            const y = this._calculateYPosition(positionData);
            this._element.style.transform = `translate(${x}, ${y})`;
        }
        _calculateXPosition(positionData, chart) {
            const x = positionData.paneX + chart.priceScale('left').width();
            const deadzoneWidth = this._lastTooltipWidth
                ? Math.ceil(this._lastTooltipWidth / 2)
                : this._options.horizontalDeadzoneWidth;
            const xAdjusted = Math.min(Math.max(deadzoneWidth, x), chart.timeScale().width() - deadzoneWidth);
            return `calc(${xAdjusted}px - 50%)`;
        }
        _calculateYPosition(positionData) {
            if (this._options.followMode == 'top') {
                return `${this._options.topOffset}px`;
            }
            const y = positionData.paneY;
            const flip = y <= this._options.verticalSpacing + this._options.verticalDeadzoneHeight;
            const yPx = y + (flip ? 1 : -1) * this._options.verticalSpacing;
            const yPct = flip ? '' : ' - 100%';
            return `calc(${yPx}px${yPct})`;
        }
    }
    function setElementText(element, text) {
        if (!element || text === element.innerText)
            return;
        element.innerText = text;
        element.style.display = text ? 'block' : 'none';
    }
    function applyStyle(element, styles) {
        for (const [key, value] of Object.entries(styles)) {
            element.style.setProperty(key, value);
        }
    }

    function centreOffset(lineBitmapWidth) {
        return Math.floor(lineBitmapWidth * 0.5);
    }
    /**
     * Calculates the bitmap position for an item with a desired length (height or width), and centred according to
     * an position coordinate defined in media sizing.
     * @param positionMedia - position coordinate for the bar (in media coordinates)
     * @param pixelRatio - pixel ratio. Either horizontal for x positions, or vertical for y positions
     * @param desiredWidthMedia - desired width (in media coordinates)
     * @returns Position of of the start point and length dimension.
     */
    function positionsLine(positionMedia, pixelRatio, desiredWidthMedia = 1, widthIsBitmap) {
        const scaledPosition = Math.round(pixelRatio * positionMedia);
        const lineBitmapWidth = Math.round(desiredWidthMedia * pixelRatio);
        const offset = centreOffset(lineBitmapWidth);
        const position = scaledPosition - offset;
        return { position, length: lineBitmapWidth };
    }

    function convertTime(t) {
        if (lightweightCharts.isUTCTimestamp(t))
            return t * 1000;
        if (lightweightCharts.isBusinessDay(t))
            return new Date(t.year, t.month, t.day).valueOf();
        const [year, month, day] = t.split('-').map(parseInt);
        return new Date(year, month, day).valueOf();
    }
    function formattedDateAndTime(timestamp) {
        if (!timestamp)
            return ['', ''];
        const dateObj = new Date(timestamp);
        // Format date string
        const year = dateObj.getFullYear();
        const month = dateObj.toLocaleString('default', { month: 'short' });
        const date = dateObj.getDate().toString().padStart(2, '0');
        const formattedDate = `${date} ${month} ${year}`;
        // Format time string
        const hours = dateObj.getHours().toString().padStart(2, '0');
        const minutes = dateObj.getMinutes().toString().padStart(2, '0');
        const formattedTime = `${hours}:${minutes}`;
        return [formattedDate, formattedTime];
    }

    class TooltipCrosshairLinePaneRenderer {
        _data;
        constructor(data) {
            this._data = data;
        }
        draw(target) {
            if (!this._data.visible)
                return;
            target.useBitmapCoordinateSpace((scope) => {
                const ctx = scope.context;
                const crosshairPos = positionsLine(this._data.x, scope.horizontalPixelRatio, 1);
                ctx.fillStyle = this._data.color; // Use the color directly from _data
                ctx.fillRect(crosshairPos.position, this._data.topMargin * scope.verticalPixelRatio, crosshairPos.length, scope.bitmapSize.height);
            });
        }
    }
    class MultiTouchCrosshairPaneView {
        _data;
        constructor(data) {
            this._data = data;
        }
        update(data) {
            this._data = data;
        }
        renderer() {
            return new TooltipCrosshairLinePaneRenderer(this._data);
        }
        zOrder() {
            return 'bottom';
        }
    }
    const defaultOptions = {
        lineColor: 'rgba(0, 0, 0, 0.2)',
        priceExtractor: (data) => {
            if (data.value !== undefined) {
                return data.value.toFixed(2);
            }
            if (data.close !== undefined) {
                return data.close.toFixed(2);
            }
            return '';
        }
    };
    class TooltipPrimitive {
        _options;
        _tooltip = undefined;
        _paneViews;
        _data = {
            x: 0,
            visible: false,
            color: 'rgba(0, 0, 0, 0.2)',
            topMargin: 0,
        };
        _attachedParams;
        constructor(options) {
            this._options = {
                ...defaultOptions,
                ...options,
            };
            this._data.color = this._options.lineColor; // Set the initial color
            this._paneViews = [new MultiTouchCrosshairPaneView(this._data)];
        }
        attached(param) {
            this._attachedParams = param;
            const series = this.series();
            if (series) {
                const seriesOptions = series.options();
                const lineColor = seriesOptions.lineColor || seriesOptions.color || 'rgba(0,0,0,0.2)';
                if (this._options.autoColor) { // Apply the extracted lineColor to the primitive
                    this.applyOptions({
                        lineColor,
                    });
                }
            }
            this._setCrosshairMode();
            param.chart.subscribeCrosshairMove(this._moveHandler);
            this._createTooltipElement();
        }
        detached() {
            const chart = this.chart();
            if (chart) {
                chart.unsubscribeCrosshairMove(this._moveHandler);
            }
            this._hideCrosshair();
            this._hideTooltip();
        }
        paneViews() {
            return this._paneViews;
        }
        updateAllViews() {
            this._paneViews.forEach((pw) => pw.update(this._data));
        }
        setData(data) {
            this._data = data;
            this.updateAllViews();
            this._attachedParams?.requestUpdate();
        }
        currentColor() {
            return this._options.lineColor;
        }
        chart() {
            return this._attachedParams?.chart;
        }
        series() {
            return this._attachedParams?.series;
        }
        applyOptions(options) {
            this._options = {
                ...this._options,
                ...options,
            };
            // Update the data color to match the lineColor if provided
            if (options.lineColor) {
                this.setData({
                    ...this._data,
                    color: options.lineColor,
                });
            }
            // Update the tooltip if it exists
            if (this._tooltip) {
                this._tooltip.applyOptions({
                    ...this._options.tooltip,
                });
            }
            this._attachedParams?.requestUpdate();
        }
        _setCrosshairMode() {
            const chart = this.chart();
            if (!chart) {
                throw new Error('Unable to change crosshair mode because the chart instance is undefined');
            }
            chart.applyOptions({
                crosshair: {
                    mode: lightweightCharts.CrosshairMode.Magnet,
                    vertLine: {
                        visible: false,
                        labelVisible: false,
                    },
                    horzLine: {
                        visible: false,
                        labelVisible: false,
                    },
                },
            });
        }
        _moveHandler = (param) => this._onMouseMove(param);
        switch(series) {
            if (this.series() === series) {
                console.log('Tooltip is already attached to this series.');
                return;
            }
            this._hideCrosshair();
            series.attachPrimitive(this, 'Tooltip', true, false);
            const seriesOptions = series.options();
            const lineColor = seriesOptions.lineColor || seriesOptions.color || 'rgba(0,0,0,0.2)';
            if (this._options.autoColor) { // Apply the extracted lineColor to the primitive
                this.applyOptions({
                    lineColor,
                });
            }
            console.log('Switched tooltip to the new series.');
        }
        _hideCrosshair() {
            this._hideTooltip();
            this.setData({
                x: 0,
                visible: false,
                color: this._options.lineColor,
                topMargin: 0,
            });
        }
        _hideTooltip() {
            if (!this._tooltip)
                return;
            this._tooltip.updateTooltipContent({
                title: '',
                price: '',
                date: '',
                time: '',
            });
            this._tooltip.updatePosition({
                paneX: 0,
                paneY: 0,
                visible: false,
            });
        }
        _onMouseMove(param) {
            const chart = this.chart();
            const series = this.series();
            const logical = param.logical;
            if (!logical || !chart || !series) {
                this._hideCrosshair();
                return;
            }
            const data = param.seriesData.get(series);
            if (!data) {
                this._hideCrosshair();
                return;
            }
            const price = this._options.priceExtractor(data);
            const coordinate = chart.timeScale().logicalToCoordinate(logical);
            const [date, time] = formattedDateAndTime(param.time ? convertTime(param.time) : undefined);
            if (this._tooltip) {
                const title = series.options()?.title || 'Unknown Series';
                const tooltipOptions = this._tooltip.options();
                const topMargin = tooltipOptions.followMode === 'top' ? tooltipOptions.topOffset + 10 : 0;
                this.setData({
                    x: coordinate ?? 0,
                    visible: coordinate !== null,
                    color: this._options.lineColor,
                    topMargin,
                });
                this._tooltip.updateTooltipContent({
                    title, // Display the series title here
                    price,
                    date,
                    time,
                });
                this._tooltip.updatePosition({
                    paneX: param.point?.x ?? 0,
                    paneY: param.point?.y ?? 0,
                    visible: true,
                });
            }
        }
        _createTooltipElement() {
            const chart = this.chart();
            if (!chart)
                throw new Error('Unable to create Tooltip element. Chart not attached');
            this._tooltip = new TooltipElement(chart, {
                ...this._options.tooltip,
            });
        }
    }

    let ColorPicker$1 = class ColorPicker {
        colorOption;
        static colors = [
            '#EBB0B0', '#E9CEA1', '#E5DF80', '#ADEB97', '#A3C3EA', '#D8BDED',
            '#E15F5D', '#E1B45F', '#E2D947', '#4BE940', '#639AE1', '#D7A0E8',
            '#E42C2A', '#E49D30', '#E7D827', '#3CFF0A', '#3275E4', '#B06CE3',
            '#F3000D', '#EE9A14', '#F1DA13', '#2DFC0F', '#1562EE', '#BB00EF',
            '#B50911', '#E3860E', '#D2BD11', '#48DE0E', '#1455B4', '#6E009F',
            '#7C1713', '#B76B12', '#8D7A13', '#479C12', '#165579', '#51007E',
        ];
        _div;
        saveDrawings;
        opacity = 0;
        _opacitySlider;
        _opacityLabel;
        rgba;
        constructor(saveDrawings, colorOption) {
            this.colorOption = colorOption;
            this.saveDrawings = saveDrawings;
            this._div = document.createElement('div');
            this._div.classList.add('color-picker');
            let colorPicker = document.createElement('div');
            colorPicker.style.margin = '10px';
            colorPicker.style.display = 'flex';
            colorPicker.style.flexWrap = 'wrap';
            ColorPicker.colors.forEach((color) => colorPicker.appendChild(this.makeColorBox(color)));
            let separator = document.createElement('div');
            separator.style.backgroundColor = window.pane.borderColor;
            separator.style.height = '1px';
            separator.style.width = '130px';
            let opacity = document.createElement('div');
            opacity.style.margin = '10px';
            let opacityText = document.createElement('div');
            opacityText.style.color = 'lightgray';
            opacityText.style.fontSize = '12px';
            opacityText.innerText = 'Opacity';
            this._opacityLabel = document.createElement('div');
            this._opacityLabel.style.color = 'lightgray';
            this._opacityLabel.style.fontSize = '12px';
            this._opacitySlider = document.createElement('input');
            this._opacitySlider.type = 'range';
            this._opacitySlider.value = (this.opacity * 100).toString();
            this._opacityLabel.innerText = this._opacitySlider.value + '%';
            this._opacitySlider.oninput = () => {
                this._opacityLabel.innerText = this._opacitySlider.value + '%';
                this.opacity = parseInt(this._opacitySlider.value) / 100;
                this.updateColor();
            };
            opacity.appendChild(opacityText);
            opacity.appendChild(this._opacitySlider);
            opacity.appendChild(this._opacityLabel);
            this._div.appendChild(colorPicker);
            this._div.appendChild(separator);
            this._div.appendChild(opacity);
            window.containerDiv.appendChild(this._div);
        }
        _updateOpacitySlider() {
            this._opacitySlider.value = (this.opacity * 100).toString();
            this._opacityLabel.innerText = this._opacitySlider.value + '%';
        }
        makeColorBox(color) {
            const box = document.createElement('div');
            box.style.width = '18px';
            box.style.height = '18px';
            box.style.borderRadius = '3px';
            box.style.margin = '3px';
            box.style.boxSizing = 'border-box';
            box.style.backgroundColor = color;
            box.addEventListener('mouseover', () => box.style.border = '2px solid lightgray');
            box.addEventListener('mouseout', () => box.style.border = 'none');
            const rgba = ColorPicker.extractRGBA(color);
            box.addEventListener('click', () => {
                this.rgba = rgba;
                this.updateColor();
            });
            return box;
        }
        static extractRGBA(anyColor) {
            const dummyElem = document.createElement('div');
            dummyElem.style.color = anyColor;
            document.body.appendChild(dummyElem);
            const computedColor = getComputedStyle(dummyElem).color;
            document.body.removeChild(dummyElem);
            const rgb = computedColor.match(/\d+/g)?.map(Number);
            if (!rgb)
                return [];
            let isRgba = computedColor.includes('rgba');
            let opacity = isRgba ? parseFloat(computedColor.split(',')[3]) : 1;
            return [rgb[0], rgb[1], rgb[2], opacity];
        }
        updateColor() {
            if (!Drawing.lastHoveredObject || !this.rgba)
                return;
            const oColor = `rgba(${this.rgba[0]}, ${this.rgba[1]}, ${this.rgba[2]}, ${this.opacity})`;
            Drawing.lastHoveredObject.applyOptions({ [this.colorOption]: oColor });
            this.saveDrawings();
        }
        openMenu(rect) {
            if (!Drawing.lastHoveredObject)
                return;
            this.rgba = ColorPicker.extractRGBA(Drawing.lastHoveredObject._options[this.colorOption]);
            this.opacity = this.rgba[3];
            this._updateOpacitySlider();
            this._div.style.top = (rect.top - 30) + 'px';
            this._div.style.left = rect.right + 'px';
            this._div.style.display = 'flex';
            setTimeout(() => document.addEventListener('mousedown', (event) => {
                if (!this._div.contains(event.target)) {
                    this.closeMenu();
                }
            }), 10);
        }
        closeMenu() {
            document.body.removeEventListener('click', this.closeMenu);
            this._div.style.display = 'none';
        }
    };

    class ColorPicker {
        container;
        _opacitySlider;
        _opacity_label;
        exitButton;
        color = "#ff0000";
        rgba; // [R, G, B, A]
        opacity;
        applySelection;
        constructor(initialValue, applySelection) {
            this.applySelection = applySelection;
            this.rgba = ColorPicker.extractRGBA(initialValue);
            this.opacity = this.rgba[3];
            this.container = document.createElement("div");
            this.container.classList.add("color-picker");
            this.container.style.display = "flex";
            this.container.style.flexDirection = "column";
            this.container.style.width = "150px";
            this.container.style.height = "300px";
            this.container.style.position = "relative"; // Ensure proper positioning for the exit button.
            // Build UI elements
            const colorGrid = this.createColorGrid();
            const opacityUI = this.createOpacityUI();
            this.exitButton = this.createExitButton(); // Create the exit button.
            // Append elements to the container
            this.container.appendChild(colorGrid);
            this.container.appendChild(this.createSeparator());
            this.container.appendChild(this.createSeparator());
            this.container.appendChild(opacityUI);
            this.container.appendChild(this.exitButton); // Append the exit button last
        }
        createExitButton() {
            const button = document.createElement('div');
            button.innerText = '✕'; // Close icon
            button.title = 'Close';
            button.style.position = 'absolute';
            button.style.bottom = '5px'; // Move to the bottom
            button.style.right = '5px'; // Default bottom-right corner
            button.style.width = '20px';
            button.style.height = '20px';
            button.style.cursor = 'pointer';
            button.style.display = 'flex';
            button.style.justifyContent = 'center';
            button.style.alignItems = 'center';
            button.style.fontSize = '16px';
            button.style.backgroundColor = '#ccc';
            button.style.borderRadius = '50%';
            button.style.color = '#000';
            button.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
            // Add hover effect
            button.addEventListener('mouseover', () => {
                button.style.backgroundColor = '#e74c3c'; // Red hover color
                button.style.color = '#fff'; // White text on hover
            });
            button.addEventListener('mouseout', () => {
                button.style.backgroundColor = '#ccc';
                button.style.color = '#000';
            });
            // Close the menu when clicked
            button.addEventListener('click', () => {
                this.closeMenu();
            });
            return button;
        }
        createColorGrid() {
            const colorGrid = document.createElement('div');
            colorGrid.style.display = 'grid';
            colorGrid.style.gridTemplateColumns = 'repeat(7, 1fr)'; // 5 columns
            colorGrid.style.gap = '5px';
            colorGrid.style.overflowY = 'auto';
            colorGrid.style.flex = '1';
            const colors = ColorPicker.generateFullSpectrumColors(9); // Generate vibrant colors
            colors.forEach((color) => {
                const box = this.createColorBox(color);
                colorGrid.appendChild(box);
            });
            return colorGrid;
        }
        createColorBox(color) {
            const box = document.createElement("div");
            box.style.aspectRatio = "1"; // Maintain square shape
            box.style.borderRadius = "6px";
            box.style.backgroundColor = color;
            box.style.cursor = "pointer";
            box.addEventListener("click", () => {
                this.rgba = ColorPicker.extractRGBA(color);
                this.updateTargetColor();
            });
            return box;
        }
        static generateFullSpectrumColors(stepsPerTransition) {
            const colors = [];
            // Red to Green (255, 0, 0 → 255, 255, 0)
            for (let g = 0; g <= 255; g += Math.floor(255 / stepsPerTransition)) {
                colors.push(`rgba(255, ${g}, 0, 1)`);
            }
            // Green to Yellow-Green to Green-Blue (255, 255, 0 → 0, 255, 0)
            for (let r = 255; r >= 0; r -= Math.floor(255 / stepsPerTransition)) {
                colors.push(`rgba(${r}, 255, 0, 1)`);
            }
            // Green to Cyan (0, 255, 0 → 0, 255, 255)
            for (let b = 0; b <= 255; b += Math.floor(255 / stepsPerTransition)) {
                colors.push(`rgba(0, 255, ${b}, 1)`);
            }
            // Cyan to Blue (0, 255, 255 → 0, 0, 255)
            for (let g = 255; g >= 0; g -= Math.floor(255 / stepsPerTransition)) {
                colors.push(`rgba(0, ${g}, 255, 1)`);
            }
            // Blue to Magenta (0, 0, 255 → 255, 0, 255)
            for (let r = 0; r <= 255; r += Math.floor(255 / stepsPerTransition)) {
                colors.push(`rgba(${r}, 0, 255, 1)`);
            }
            // Magenta to Red (255, 0, 255 → 255, 0, 0)
            for (let b = 255; b >= 0; b -= Math.floor(255 / stepsPerTransition)) {
                colors.push(`rgba(255, 0, ${b}, 1)`);
            }
            // White to Black (255, 255, 255 → 0, 0, 0)
            for (let i = 255; i >= 0; i -= Math.floor(255 / stepsPerTransition)) {
                colors.push(`rgba(${i}, ${i}, ${i}, 1)`);
            }
            return colors;
        }
        createOpacityUI() {
            const opacityContainer = document.createElement("div");
            opacityContainer.style.margin = "10px";
            opacityContainer.style.display = "flex";
            opacityContainer.style.flexDirection = "column";
            opacityContainer.style.alignItems = "center";
            const opacityText = document.createElement("div");
            opacityText.style.color = "lightgray";
            opacityText.style.fontSize = "12px";
            opacityText.innerText = "Opacity";
            this._opacitySlider = document.createElement("input");
            this._opacitySlider.type = "range";
            this._opacitySlider.min = "0";
            this._opacitySlider.max = "100";
            this._opacitySlider.value = (this.opacity * 100).toString();
            this._opacitySlider.style.width = "80%";
            this._opacity_label = document.createElement("div");
            this._opacity_label.style.color = "lightgray";
            this._opacity_label.style.fontSize = "12px";
            this._opacity_label.innerText = `${this._opacitySlider.value}%`;
            this._opacitySlider.oninput = () => {
                this._opacity_label.innerText = `${this._opacitySlider.value}%`;
                this.opacity = parseInt(this._opacitySlider.value) / 100;
                this.updateTargetColor();
            };
            opacityContainer.appendChild(opacityText);
            opacityContainer.appendChild(this._opacitySlider);
            opacityContainer.appendChild(this._opacity_label);
            return opacityContainer;
        }
        createSeparator() {
            const separator = document.createElement("div");
            separator.style.height = "1px";
            separator.style.width = "100%";
            separator.style.backgroundColor = "#ccc";
            separator.style.margin = "5px 0";
            return separator;
        }
        openMenu(event, parentMenuWidth, // Width of the parent menu
        applySelection) {
            this.applySelection = applySelection;
            // Attach menu to the DOM temporarily to calculate dimensions
            this.container.style.display = 'block';
            document.body.appendChild(this.container);
            console.log('Menu attached:', this.container);
            // Calculate submenu dimensions
            const submenuWidth = this.container.offsetWidth || 150; // Default submenu width
            const submenuHeight = this.container.offsetHeight || 250; // Default submenu height
            console.log('Submenu dimensions:', { submenuWidth, submenuHeight });
            // Get mouse position
            const cursorX = event.clientX;
            const cursorY = event.clientY;
            console.log('Mouse position:', { cursorX, cursorY });
            // Get viewport dimensions
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            // Calculate position relative to the parent menu
            let left = cursorX + parentMenuWidth; // Offset by parent menu width
            let top = cursorY;
            // Adjust position to avoid overflowing viewport
            const adjustedLeft = left + submenuWidth > viewportWidth ? cursorX - submenuWidth : left;
            const adjustedTop = top + submenuHeight > viewportHeight ? viewportHeight - submenuHeight - 10 : top;
            console.log({ left, top, adjustedLeft, adjustedTop });
            // Apply calculated position
            this.container.style.left = `${adjustedLeft}px`;
            this.container.style.top = `${adjustedTop}px`;
            this.container.style.display = 'flex';
            this.container.style.position = 'absolute';
            // Ensure the exit button stays within bounds
            this.exitButton.style.bottom = '5px';
            this.exitButton.style.right = '5px';
            // Close menu when clicking outside
            document.addEventListener('mousedown', this._handleOutsideClick.bind(this), { once: true });
        }
        closeMenu() {
            this.container.style.display = 'none';
            document.removeEventListener('mousedown', this._handleOutsideClick);
        }
        _handleOutsideClick(event) {
            if (!this.container.contains(event.target)) {
                this.closeMenu();
            }
        }
        static extractRGBA(color) {
            const dummyElem = document.createElement('div');
            dummyElem.style.color = color;
            document.body.appendChild(dummyElem);
            const computedColor = getComputedStyle(dummyElem).color;
            document.body.removeChild(dummyElem);
            const rgb = computedColor.match(/\d+/g)?.map(Number) || [0, 0, 0];
            const opacity = computedColor.includes("rgba")
                ? parseFloat(computedColor.split(",")[3])
                : 1;
            return [rgb[0], rgb[1], rgb[2], opacity];
        }
        getElement() {
            return this.container;
        }
        // Dynamically updates the label and selection function
        update(initialValue, applySelection) {
            this.rgba = ColorPicker.extractRGBA(initialValue);
            this.opacity = this.rgba[3];
            this.applySelection = applySelection;
            this.updateTargetColor();
        }
        updateTargetColor() {
            this.color = `rgba(${this.rgba[0]}, ${this.rgba[1]}, ${this.rgba[2]}, ${this.opacity})`;
            this.applySelection(this.color); // Apply color selection immediately
        }
    }

    class StylePicker {
        static _styles = [
            { name: 'Solid', var: lightweightCharts.LineStyle.Solid },
            { name: 'Dotted', var: lightweightCharts.LineStyle.Dotted },
            { name: 'Dashed', var: lightweightCharts.LineStyle.Dashed },
            { name: 'Large Dashed', var: lightweightCharts.LineStyle.LargeDashed },
            { name: 'Sparse Dotted', var: lightweightCharts.LineStyle.SparseDotted },
        ];
        _div;
        _saveDrawings;
        constructor(saveDrawings) {
            this._saveDrawings = saveDrawings;
            this._div = document.createElement('div');
            this._div.classList.add('context-menu');
            StylePicker._styles.forEach((style) => {
                this._div.appendChild(this._makeTextBox(style.name, style.var));
            });
            window.containerDiv.appendChild(this._div);
        }
        _makeTextBox(text, style) {
            const item = document.createElement('span');
            item.classList.add('context-menu-item');
            item.innerText = text;
            item.addEventListener('click', () => {
                Drawing.lastHoveredObject?.applyOptions({ lineStyle: style });
                this._saveDrawings();
            });
            return item;
        }
        openMenu(rect) {
            this._div.style.top = (rect.top - 30) + 'px';
            this._div.style.left = rect.right + 'px';
            this._div.style.display = 'block';
            setTimeout(() => document.addEventListener('mousedown', (event) => {
                if (!this._div.contains(event.target)) {
                    this.closeMenu();
                }
            }), 10);
        }
        closeMenu() {
            document.removeEventListener('click', this.closeMenu);
            this._div.style.display = 'none';
        }
    }

    function buildOptions(optionPath, value) {
        const keys = optionPath.split(".");
        const options = {};
        let current = options;
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (i === keys.length - 1) {
                current[key] = value;
            }
            else {
                current[key] = {};
                current = current[key];
            }
        }
        return options;
    }
    /**
     * Utility function to convert camelCase to Title Case
     * @param inputString The camelCase string.
     * @returns The Title Case string.
     */
    function camelToTitle(inputString) {
        return inputString
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (str) => str.toUpperCase());
    }

    // ----------------------------------
    // External Library Imports
    // ----------------------------------
    // ----------------------------------
    // If you have actual code referencing commented-out or removed imports,
    // reintroduce them accordingly.
    // ----------------------------------
    let activeMenu = null;
    class ContextMenu {
        handler;
        handlerMap;
        getMouseEventParams;
        div;
        hoverItem;
        items = [];
        colorPicker = new ColorPicker("#ff0000", () => null);
        saveDrawings = null;
        drawingTool = null;
        ///private globalTooltipEnabled: boolean = false;
        ///private Tooltip: TooltipPrimitive | null = null;
        ///private currentTooltipSeries: ISeriesApiExtended | null = null;
        constraints = {
            baseline: { skip: true },
            title: { skip: true },
            PriceLineSource: { skip: true },
            tickInterval: { min: 0, max: 100 },
            lastPriceAnimation: { skip: true },
            lineType: { min: 0, max: 2 },
            seriesType: { skip: true },
        };
        setupDrawingTools(saveDrawings, drawingTool) {
            this.saveDrawings = saveDrawings;
            this.drawingTool = drawingTool;
        }
        shouldSkipOption(optionName) {
            const constraints = this.constraints[optionName] || {};
            return !!constraints.skip;
        }
        separator() {
            const separator = document.createElement("div");
            separator.style.width = "90%";
            separator.style.height = "1px";
            separator.style.margin = "3px 0px";
            separator.style.backgroundColor = window.pane.borderColor;
            this.div.appendChild(separator);
            this.items.push(separator);
        }
        menuItem(text, action, hover = null) {
            const item = document.createElement("span");
            item.classList.add("context-menu-item");
            this.div.appendChild(item);
            const elem = document.createElement("span");
            elem.innerText = text;
            elem.style.pointerEvents = "none";
            item.appendChild(elem);
            if (hover) {
                let arrow = document.createElement("span");
                arrow.innerText = `►`;
                arrow.style.fontSize = "8px";
                arrow.style.pointerEvents = "none";
                item.appendChild(arrow);
            }
            item.addEventListener("mouseover", () => {
                if (this.hoverItem && this.hoverItem.closeAction)
                    this.hoverItem.closeAction();
                this.hoverItem = { elem: elem, action: action, closeAction: hover };
            });
            if (!hover)
                item.addEventListener("click", (event) => {
                    action(event);
                    this.div.style.display = "none";
                });
            else {
                let timeout;
                item.addEventListener("mouseover", () => (timeout = setTimeout(() => action(item.getBoundingClientRect()), 100)));
                item.addEventListener("mouseout", () => clearTimeout(timeout));
            }
            this.items.push(item);
        }
        constructor(handler, handlerMap, getMouseEventParams) {
            this.handler = handler;
            this.handlerMap = handlerMap;
            this.getMouseEventParams = getMouseEventParams;
            this.div = document.createElement("div");
            this.div.classList.add("context-menu");
            document.body.appendChild(this.div);
            this.div.style.overflowY = "scroll";
            this.hoverItem = null;
            document.body.addEventListener("contextmenu", this._onRightClick.bind(this));
            document.body.addEventListener("click", this._onClick.bind(this));
            //this.handler.chart.subscribeCrosshairMove((param: MouseEventParams) => {
            //  this.handleCrosshairMove(param);
            //});
            this.setupMenu();
        }
        _onClick(ev) {
            const target = ev.target;
            const menus = [this.colorPicker];
            menus.forEach((menu) => {
                if (!menu.getElement().contains(target)) {
                    menu.closeMenu();
                }
            });
        }
        // series-context-menu.ts
        _onRightClick(event) {
            event.preventDefault(); // Prevent the browser's context menu
            const mouseEventParams = this.getMouseEventParams();
            const seriesFromProximity = this.getProximitySeries(this.getMouseEventParams());
            const drawingFromProximity = this.getProximityDrawing(); // Implement this method based on your drawing logic
            console.log("Mouse Event Params:", mouseEventParams);
            console.log("Proximity Series:", seriesFromProximity);
            console.log("Proximity Drawing:", drawingFromProximity);
            this.clearMenu(); // Clear existing menu items
            this.clearAllMenus(); // Clear other menus if necessary
            if (seriesFromProximity) {
                // Right-click on a series
                console.log("Right-click detected on a series (proximity).");
                this.populateSeriesMenu(seriesFromProximity, event);
            }
            else if (drawingFromProximity) {
                // Right-click on a drawing
                console.log("Right-click detected on a drawing.");
                this.populateDrawingMenu(drawingFromProximity, event);
            }
            else if (mouseEventParams?.hoveredSeries) {
                // Fallback to hovered series
                console.log("Right-click detected on a series (hovered).");
                this.populateSeriesMenu(mouseEventParams.hoveredSeries, event);
            }
            else {
                // Right-click on chart background
                console.log("Right-click detected on the chart background.");
                this.populateChartMenu(event);
            }
            // Position the menu at cursor location
            this.showMenu(event);
            event.preventDefault();
            event.stopPropagation(); // Prevent event bubbling
        }
        // series-context-menu.ts
        getProximityDrawing() {
            // Implement your logic to determine if a drawing is under the cursor
            // For example:
            if (Drawing.hoveredObject) {
                return Drawing.hoveredObject;
            }
            return null;
        }
        getProximitySeries(param) {
            if (!param || !param.seriesData) {
                console.warn("No mouse event parameters or series data available.");
                return null;
            }
            if (!param.point) {
                console.warn("No point data in MouseEventParams.");
                return null;
            }
            const cursorY = param.point.y;
            let sourceSeries = null;
            const referenceSeries = this.handler._seriesList[0];
            if (this.handler.series) {
                sourceSeries = this.handler.series;
                console.log(`Using handler.series for coordinate conversion.`);
            }
            else if (referenceSeries) {
                sourceSeries = referenceSeries;
                console.log(`Using referenceSeries for coordinate conversion.`);
            }
            else {
                console.warn("No handler.series or referenceSeries available.");
                return null;
            }
            const cursorPrice = sourceSeries.coordinateToPrice(cursorY);
            console.log(`Converted chart Y (${cursorY}) to Price: ${cursorPrice}`);
            if (cursorPrice === null) {
                console.warn("Cursor price is null. Unable to determine proximity.");
                return null;
            }
            const seriesByDistance = [];
            param.seriesData.forEach((data, series) => {
                let refPrice;
                if (isSingleValueData(data)) {
                    refPrice = data.value;
                }
                else if (isOHLCData(data)) {
                    refPrice = data.close;
                }
                if (refPrice !== undefined && !isNaN(refPrice)) {
                    const distance = Math.abs(refPrice - cursorPrice);
                    const percentageDifference = (distance / cursorPrice) * 100;
                    if (percentageDifference <= 3.33) {
                        seriesByDistance.push({ distance, series });
                    }
                }
            });
            // Sort series by proximity (distance)
            seriesByDistance.sort((a, b) => a.distance - b.distance);
            if (seriesByDistance.length > 0) {
                console.log("Closest series found.");
                return seriesByDistance[0].series;
            }
            console.log("No series found within the proximity threshold.");
            return null;
        }
        showMenu(event) {
            const x = event.clientX;
            const y = event.clientY;
            this.div.style.position = "absolute";
            this.div.style.zIndex = "1000";
            this.div.style.left = `${x}px`;
            this.div.style.top = `${y}px`;
            this.div.style.width = "250px";
            this.div.style.maxHeight = `400px`;
            this.div.style.overflowY = "hidden";
            this.div.style.display = "block";
            this.div.style.overflowX = "hidden";
            console.log("Displaying Menu at:", x, y);
            activeMenu = this.div;
            console.log("Displaying Menu", x, y);
            document.addEventListener("mousedown", this.hideMenuOnOutsideClick.bind(this), { once: true });
        }
        hideMenuOnOutsideClick(event) {
            if (!this.div.contains(event.target)) {
                this.hideMenu();
            }
        }
        hideMenu() {
            this.div.style.display = "none";
            if (activeMenu === this.div) {
                activeMenu = null;
            }
        }
        clearAllMenus() {
            this.handlerMap.forEach((handler) => {
                if (handler.ContextMenu) {
                    handler.ContextMenu.clearMenu();
                }
            });
        }
        setupMenu() {
            if (!this.div.querySelector(".chart-options-container")) {
                const chartOptionsContainer = document.createElement("div");
                chartOptionsContainer.classList.add("chart-options-container");
                this.div.appendChild(chartOptionsContainer);
            }
            if (!this.div.querySelector(".context-menu-item.close-menu")) {
                this.addMenuItem("Close Menu", () => this.hideMenu());
            }
        }
        addNumberInput(label, defaultValue, onChange, min, max, step) {
            return this.addMenuInput(this.div, {
                type: "number",
                label,
                value: defaultValue,
                onChange,
                min,
                max,
                step
            });
        }
        addCheckbox(label, defaultValue, onChange) {
            return this.addMenuInput(this.div, {
                type: "boolean",
                label,
                value: defaultValue,
                onChange,
            });
        }
        addSelectInput(label, currentValue, options, onSelectChange) {
            return this.addMenuInput(this.div, {
                type: "select",
                label,
                value: currentValue,
                onChange: onSelectChange,
                options,
            });
        }
        addMenuInput(parent, config, idPrefix = "") {
            const container = document.createElement("div");
            container.classList.add("context-menu-item");
            container.style.display = "flex";
            container.style.alignItems = "center";
            container.style.justifyContent = "space-around";
            container.style.width = "90%";
            if (config.label) {
                const labelElem = document.createElement("label");
                labelElem.innerText = config.label;
                labelElem.htmlFor = `${idPrefix}${config.label.toLowerCase()}`;
                labelElem.style.flex = "0.8";
                labelElem.style.whiteSpace = "nowrap";
                container.appendChild(labelElem);
            }
            let inputElem;
            switch (config.type) {
                case "hybrid": {
                    if (!config.hybridConfig) {
                        throw new Error("Hybrid type requires hybridConfig.");
                    }
                    const hybridContainer = document.createElement("div");
                    hybridContainer.classList.add("context-menu-item");
                    hybridContainer.style.position = "relative";
                    hybridContainer.style.cursor = "pointer";
                    hybridContainer.style.display = "flex";
                    hybridContainer.style.textAlign = "center";
                    hybridContainer.style.marginLeft = "auto";
                    hybridContainer.style.marginRight = "8px";
                    const labelElem = document.createElement("span");
                    labelElem.innerText = config.label ? "Axis" : "Action";
                    labelElem.style.flex = "1";
                    hybridContainer.appendChild(labelElem);
                    const dropdownIndicator = document.createElement("span");
                    dropdownIndicator.innerText = "▼";
                    dropdownIndicator.style.marginLeft = "8px";
                    dropdownIndicator.style.color = "#fff";
                    hybridContainer.appendChild(dropdownIndicator);
                    const dropdown = document.createElement("div");
                    dropdown.style.position = "absolute";
                    dropdown.style.backgroundColor = "#2b2b2b";
                    dropdown.style.color = "#fff";
                    dropdown.style.border = "1px solid #444";
                    dropdown.style.borderRadius = "4px";
                    dropdown.style.minWidth = "100px";
                    dropdown.style.boxShadow = "0px 2px 5px rgba(0, 0, 0, 0.5)";
                    dropdown.style.zIndex = "1000";
                    dropdown.style.display = "none";
                    hybridContainer.appendChild(dropdown);
                    // Populate dropdown with options
                    config.hybridConfig.options.forEach((option) => {
                        const optionElem = document.createElement("div");
                        optionElem.innerText = option.name;
                        optionElem.style.cursor = "pointer";
                        optionElem.style.padding = "5px 10px";
                        // Handle clicks on the dropdown options
                        optionElem.addEventListener("click", (event) => {
                            event.stopPropagation(); // Prevent propagation to the container
                            dropdown.style.display = "none"; // Close dropdown
                            option.action(); // Execute the action for the option
                        });
                        optionElem.addEventListener("mouseenter", () => {
                            optionElem.style.backgroundColor = "#444";
                        });
                        optionElem.addEventListener("mouseleave", () => {
                            optionElem.style.backgroundColor = "#2b2b2b";
                        });
                        dropdown.appendChild(optionElem);
                    });
                    // Clicking the hybrid container toggles the dropdown
                    hybridContainer.addEventListener("click", (event) => {
                        event.stopPropagation(); // Prevent triggering the default action
                        dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
                    });
                    // Ensure the default action happens when clicking outside the hybrid container
                    const menuItem = document.createElement("div");
                    menuItem.classList.add("context-menu-item");
                    menuItem.style.display = "flex";
                    menuItem.style.alignItems = "center";
                    menuItem.style.justifyContent = "space-between";
                    menuItem.style.cursor = "pointer";
                    menuItem.addEventListener("click", () => {
                        config.hybridConfig.defaultAction(); // Execute the default action
                    });
                    // Add the hybrid container to the menu item
                    menuItem.appendChild(hybridContainer);
                    // Close dropdown when clicking outside
                    document.addEventListener("click", () => {
                        dropdown.style.display = "none";
                    });
                    inputElem = menuItem;
                    break;
                }
                case "number": {
                    const input = document.createElement("input");
                    input.type = "number";
                    input.value = config.value !== undefined ? config.value.toString() : "";
                    input.style.backgroundColor = "#2b2b2b"; // Darker gray background
                    input.style.color = "#fff"; // White text
                    input.style.border = "1px solid #444"; // Subtle border
                    input.style.borderRadius = "4px";
                    input.style.textAlign = "center";
                    input.style.marginLeft = "auto"; // Adds margin to the right of the input
                    input.style.marginRight = "8px"; // Adds margin to the right of the input
                    input.style.width = "40px"; // Ensures a consistent width
                    // Set min/max if provided
                    if (config.min !== undefined)
                        input.min = config.min.toString();
                    if (config.max !== undefined)
                        input.max = config.max.toString();
                    // NEW: Set step if provided, default to 1 if not
                    if (config.step !== undefined && !isNaN(config.step)) {
                        input.step = config.step.toString();
                    }
                    else {
                        input.step = "1"; // Or any other default
                    }
                    input.addEventListener("input", (event) => {
                        const target = event.target;
                        let newValue = parseFloat(target.value);
                        if (!isNaN(newValue)) {
                            config.onChange(newValue);
                        }
                    });
                    inputElem = input;
                    break;
                }
                case "boolean": {
                    const input = document.createElement("input");
                    input.type = "checkbox";
                    input.checked = config.value ?? false;
                    input.style.marginLeft = "auto";
                    input.style.marginRight = "8px";
                    input.addEventListener("change", (event) => {
                        const target = event.target;
                        config.onChange(target.checked);
                    });
                    inputElem = input;
                    break;
                }
                case "select": {
                    const select = document.createElement("select");
                    select.id = `${idPrefix}${config.label ? config.label.toLowerCase() : "select"}`;
                    select.style.backgroundColor = "#2b2b2b"; // Darker gray background
                    select.style.color = "#fff"; // White text
                    select.style.border = "1px solid #444"; // Subtle border
                    select.style.borderRadius = "4px";
                    select.style.marginLeft = "auto";
                    select.style.marginRight = "8px"; // Adds margin to the right of the dropdown
                    select.style.width = "80px"; // Ensures consistent width for dropdown
                    config.options?.forEach((optionValue) => {
                        const option = document.createElement("option");
                        option.value = optionValue;
                        option.text = optionValue;
                        option.style.whiteSpace = "normal"; // Allow wrapping within dropdown
                        option.style.textAlign = "right";
                        if (optionValue === config.value)
                            option.selected = true;
                        select.appendChild(option);
                    });
                    select.addEventListener("change", (event) => {
                        const target = event.target;
                        config.onChange(target.value);
                    });
                    inputElem = select;
                    break;
                }
                case "string": {
                    const input = document.createElement("input");
                    input.type = "text";
                    input.value = config.value ?? "";
                    input.style.backgroundColor = "#2b2b2b"; // Darker gray background
                    input.style.color = "#fff"; // White text
                    input.style.border = "1px solid #444"; // Subtle border
                    input.style.borderRadius = "4px";
                    input.style.marginLeft = "auto";
                    input.style.textAlign = "center";
                    input.style.marginRight = "8px"; // Adds margin to the right of the text input
                    input.style.width = "60px"; // Ensures consistent width
                    input.addEventListener("input", (event) => {
                        const target = event.target;
                        config.onChange(target.value);
                    });
                    inputElem = input;
                    break;
                }
                case "color": {
                    const input = document.createElement("input");
                    input.type = "color";
                    input.value = config.value ?? "#000000";
                    input.style.marginLeft = "auto";
                    input.style.cursor = "pointer";
                    input.style.marginRight = "8px"; // Adds margin to the right of the input
                    input.style.width = "100px"; // Ensures a consistent width
                    input.addEventListener("input", (event) => {
                        const target = event.target;
                        config.onChange(target.value);
                    });
                    inputElem = input;
                    break;
                }
                default:
                    throw new Error("Unsupported input type");
            }
            //inputElem.style.padding= "2px 10px 2px 10px";
            container.style.padding = "2px 10px 2px 10px";
            container.appendChild(inputElem);
            parent.appendChild(container);
            return container;
        }
        addMenuItem(text, action, shouldHide = true, hasSubmenu = false, submenuLevel = 1) {
            const item = document.createElement("span");
            item.classList.add("context-menu-item");
            item.innerText = text;
            if (hasSubmenu) {
                const defaultArrow = document.createElement("span");
                defaultArrow.classList.add("submenu-arrow");
                defaultArrow.innerText = "ː".repeat(submenuLevel);
                item.appendChild(defaultArrow);
            }
            item.addEventListener("click", (event) => {
                event.stopPropagation();
                action();
                if (shouldHide) {
                    this.hideMenu();
                }
            });
            const arrows = ["➩", "➯", "➱", "➬", "➫"];
            item.addEventListener("mouseenter", () => {
                item.style.backgroundColor = "royalblue";
                item.style.color = "white";
                if (!item.querySelector(".hover-arrow")) {
                    const hoverArrow = document.createElement("span");
                    hoverArrow.classList.add("hover-arrow");
                    const randomIndex = Math.floor(Math.random() * arrows.length);
                    const selectedArrow = arrows[randomIndex];
                    hoverArrow.innerText = selectedArrow;
                    hoverArrow.style.marginLeft = "auto";
                    hoverArrow.style.fontSize = "8px";
                    hoverArrow.style.color = "white";
                    item.appendChild(hoverArrow);
                }
            });
            item.addEventListener("mouseleave", () => {
                item.style.backgroundColor = "";
                item.style.color = "";
                const hoverArrow = item.querySelector(".hover-arrow");
                if (hoverArrow) {
                    item.removeChild(hoverArrow);
                }
            });
            this.div.appendChild(item);
            this.items.push(item);
            return item;
        }
        clearMenu() {
            const dynamicItems = this.div.querySelectorAll(".context-menu-item:not(.close-menu), .context-submenu");
            dynamicItems.forEach((item) => item.remove());
            this.items = [];
        }
        /**
         * Unified color picker menu item.
         * @param label Display label for the menu item
         * @param currentColor The current color value
         * @param optionPath The dot-separated path to the option
         * @param optionTarget The chart or series to apply the color to
         */
        addColorPickerMenuItem(label, currentColor, optionPath, optionTarget) {
            const menuItem = document.createElement("span");
            menuItem.classList.add("context-menu-item");
            menuItem.innerText = label;
            this.div.appendChild(menuItem);
            const applyColor = (newColor) => {
                const options = buildOptions(optionPath, newColor);
                optionTarget.applyOptions(options);
                console.log(`Updated ${optionPath} to ${newColor}`);
            };
            menuItem.addEventListener("click", (event) => {
                event.stopPropagation();
                if (!this.colorPicker) {
                    this.colorPicker = new ColorPicker(currentColor ?? '#000000', applyColor);
                }
                this.colorPicker.openMenu(event, 225, applyColor);
            });
            return menuItem;
        }
        // Class-level arrays to store current options for width and style.
        currentWidthOptions = [];
        currentStyleOptions = [];
        /**
         * Populates the clone series submenu.
         *
         * @param series - The original series to clone.
         * @param event - The mouse event triggering the context menu.
         */
        populateSeriesMenu(series, event) {
            // Type guard to check if series is extended
            const _series = ensureExtendedSeries(series, this.handler.legend);
            // Now `series` is guaranteed to be extended
            const seriesOptions = series.options();
            if (!seriesOptions) {
                console.warn("No options found for the selected series.");
                return;
            }
            this.div.innerHTML = "";
            const colorOptions = [];
            const visibilityOptions = [];
            const otherOptions = [];
            // Temporary arrays before assigning to class-level variables
            const tempWidthOptions = [];
            const tempStyleOptions = [];
            for (const optionName of Object.keys(seriesOptions)) {
                const optionValue = seriesOptions[optionName];
                if (this.shouldSkipOption(optionName))
                    continue;
                if (optionName.toLowerCase().includes("base"))
                    continue;
                const lowerOptionName = camelToTitle(optionName).toLowerCase();
                const isWidthOption = lowerOptionName.includes("width") ||
                    lowerOptionName === "radius" ||
                    lowerOptionName.includes("radius");
                if (lowerOptionName.includes("color")) {
                    // Color options
                    if (typeof optionValue === "string") {
                        colorOptions.push({ label: optionName, value: optionValue });
                    }
                    else {
                        console.warn(`Expected string value for color option "${optionName}".`);
                    }
                }
                else if (isWidthOption) {
                    if (typeof optionValue === 'number') {
                        let minVal = 1;
                        let maxVal = 10;
                        let step = 1;
                        // If this property is specifically "radius", make it 0..1
                        if (lowerOptionName.includes('radius')) {
                            minVal = 0;
                            maxVal = 1;
                            step = 0.1;
                        }
                        // Add it to your "width" options array with the specialized range
                        tempWidthOptions.push({
                            name: optionName,
                            label: optionName,
                            value: optionValue,
                            min: minVal,
                            max: maxVal,
                            step: step
                        });
                    }
                }
                else if (lowerOptionName.includes("visible") ||
                    lowerOptionName.includes("visibility")) {
                    // Visibility options
                    if (typeof optionValue === "boolean") {
                        visibilityOptions.push({ label: optionName, value: optionValue });
                    }
                    else {
                        console.warn(`Expected boolean value for visibility option "${optionName}".`);
                    }
                }
                else if (optionName === "lineType") {
                    // lineType is a style option
                    // LineType: Simple=0, WithSteps=1
                    const possibleLineTypes = this.getPredefinedOptions(camelToTitle(optionName));
                    tempStyleOptions.push({
                        name: optionName,
                        label: optionName,
                        value: optionValue,
                        options: possibleLineTypes,
                    });
                }
                else if (optionName === "crosshairMarkerRadius") {
                    // crosshairMarkerRadius should appear under Width Options
                    if (typeof optionValue === "number") {
                        tempWidthOptions.push({
                            name: optionName,
                            label: optionName,
                            value: optionValue,
                            min: 1,
                            max: 50,
                        });
                    }
                    else {
                        console.warn(`Expected number value for crosshairMarkerRadius option "${optionName}".`);
                    }
                }
                else if (lowerOptionName.includes("style")) {
                    // Style options (e.g. lineStyle)
                    if (typeof optionValue === "string" ||
                        Object.values(lightweightCharts.LineStyle).includes(optionValue) ||
                        typeof optionValue === "number") {
                        const possibleStyles = [
                            "Solid",
                            "Dotted",
                            "Dashed",
                            "Large Dashed",
                            "Sparse Dotted",
                        ];
                        tempStyleOptions.push({
                            name: optionName,
                            label: optionName,
                            value: optionValue,
                            options: possibleStyles,
                        });
                    }
                } // Example: handle shape if "shape" is in the name
                else if (lowerOptionName.includes('shape')) {
                    // If we confirm it's a recognized CandleShape
                    if (isCandleShape(optionValue)) {
                        const predefinedShapes = ['Rectangle', 'Rounded', 'Ellipse', 'Arrow', '3d', 'Polygon'];
                        if (predefinedShapes) {
                            tempStyleOptions.push({
                                name: optionName,
                                label: optionName,
                                value: optionValue, // This is guaranteed CandleShape now
                                options: predefinedShapes,
                            });
                        }
                    }
                }
                else {
                    // Other options go directly to otherOptions
                    otherOptions.push({ label: optionName, value: optionValue });
                }
            }
            // Assign the temp arrays to class-level arrays for use in submenus
            this.currentWidthOptions = tempWidthOptions;
            this.currentStyleOptions = tempStyleOptions;
            // Inside populateSeriesMenu (already in your code above)
            this.addMenuItem("Clone Series ▸", () => {
                this.populateCloneSeriesMenu(series, event);
            }, false, true);
            // Add main menu items only if these arrays have content
            if (visibilityOptions.length > 0) {
                this.addMenuItem("Visibility Options ▸", () => {
                    this.populateVisibilityMenu(event, series);
                }, false, true);
            }
            if (this.currentStyleOptions.length > 0) {
                this.addMenuItem("Style Options ▸", () => {
                    this.populateStyleMenu(event, series);
                }, false, true);
            }
            if (this.currentWidthOptions.length > 0) {
                this.addMenuItem("Width Options ▸", () => {
                    this.populateWidthMenu(event, series);
                }, false, true);
            }
            if (colorOptions.length > 0) {
                this.addMenuItem("Color Options ▸", () => {
                    this.populateColorOptionsMenu(colorOptions, series, event);
                }, false, true);
            }
            // Add other options dynamically
            otherOptions.forEach((option) => {
                const optionLabel = camelToTitle(option.label); // Human-readable label
                // Skip if explicitly marked as skippable
                if (this.constraints[option.label]?.skip) {
                    return;
                }
                if (typeof option.value === "boolean") {
                    // Add a menu item with a checkbox for boolean options
                    this.addMenuItem(`${optionLabel} ▸`, () => {
                        this.div.innerHTML = ""; // Clear existing menu items
                        const newValue = !option.value; // Toggle the value
                        const options = buildOptions(option.label, newValue);
                        series.applyOptions(options);
                        console.log(`Toggled ${option.label} to ${newValue}`);
                        // Repopulate the menu dynamically
                    }, option.value // The checkbox state matches the current value
                    );
                }
                else if (typeof option.value === "string") {
                    // Add a submenu or text input for string options
                    const predefinedOptions = this.getPredefinedOptions(option.label);
                    if (predefinedOptions && predefinedOptions.length > 0) {
                        this.addMenuItem(`${optionLabel} ▸`, () => {
                            this.div.innerHTML = ""; // Clear existing menu items
                            this.addSelectInput(optionLabel, option.value, predefinedOptions, (newValue) => {
                                const options = buildOptions(option.label, newValue);
                                series.applyOptions(options);
                                console.log(`Updated ${option.label} to ${newValue}`);
                                // Repopulate the menu dynamically
                            });
                        }, false, true // Mark as a submenu
                        );
                    }
                    else {
                        this.addMenuItem(`${optionLabel} ▸`, () => {
                            this.div.innerHTML = ""; // Clear existing menu items
                            this.addTextInput(optionLabel, option.value, (newValue) => {
                                const options = buildOptions(option.label, newValue);
                                series.applyOptions(options);
                                console.log(`Updated ${option.label} to ${newValue}`);
                                // Repopulate the menu dynamically
                            });
                        }, false, true // Mark as a submenu
                        );
                    }
                }
                else if (typeof option.value === "number") {
                    // Add a submenu or number input for numeric options
                    const min = this.constraints[option.label]?.min;
                    const max = this.constraints[option.label]?.max;
                    this.addMenuItem(`${optionLabel} ▸`, () => {
                        this.div.innerHTML = ""; // Clear existing menu items
                        this.addNumberInput(optionLabel, option.value, (newValue) => {
                            const options = buildOptions(option.label, newValue);
                            series.applyOptions(options);
                            console.log(`Updated ${option.label} to ${newValue}`);
                            // Repopulate the menu dynamically
                        }, min, max);
                    }, false, true // Mark as a submenu
                    );
                }
                else {
                    return; // Skip unsupported data types
                }
            });
            // Add "Fill Area Between" menu option
            this.addMenuItem("Fill Area Between", () => {
                this.startFillAreaBetween(event, _series); // Define the method below
            }, false, false);
            // Access the primitives
            const primitives = _series.primitives;
            // Debugging output
            console.log("Primitives:", primitives);
            // Add "Customize Fill Area" option if `FillArea` is present
            const hasFillArea = primitives?.FillArea ?? primitives?.pt;
            if (primitives["FillArea"]) {
                this.addMenuItem("Customize Fill Area", () => {
                    this.customizeFillAreaOptions(event, hasFillArea);
                }, false, true);
            }
            // Add remaining existing menu items
            this.addMenuItem("⤝ Main Menu", () => {
                this.populateChartMenu(event);
            }, false, false);
            this.showMenu(event);
        }
        populateDrawingMenu(drawing, event) {
            this.div.innerHTML = ""; // Clear existing menu items
            // Add drawing-specific menu items
            for (const optionName of Object.keys(drawing._options)) {
                let subMenu;
                if (optionName.toLowerCase().includes("color")) {
                    subMenu = new ColorPicker$1(this.saveDrawings, optionName);
                }
                else if (optionName === "lineStyle") {
                    subMenu = new StylePicker(this.saveDrawings);
                }
                else {
                    continue;
                }
                const onClick = (rect) => subMenu.openMenu(rect);
                this.menuItem(camelToTitle(optionName), onClick, () => {
                    document.removeEventListener("click", subMenu.closeMenu);
                    subMenu._div.style.display = "none";
                });
            }
            const onClickDelete = () => this.drawingTool.delete(drawing);
            this.separator();
            this.menuItem("Delete Drawing", onClickDelete);
            // Optionally, add a back button or main menu option
            this.addMenuItem("⤝ Main Menu", () => {
                this.populateChartMenu(event);
            }, false, false);
            this.showMenu(event);
        }
        populateChartMenu(event) {
            this.div.innerHTML = "";
            console.log(`Displaying Menu Options: Chart`);
            this.addResetViewOption();
            this.addMenuItem(" ~ Series List", () => {
                this.populateSeriesListMenu(event, false, (destinationSeries) => {
                    this.populateSeriesMenu(destinationSeries, event);
                });
            }, false, true);
            // Layout menu
            this.addMenuItem("⌯ Layout Options        ", () => this.populateLayoutMenu(event), false, true);
            this.addMenuItem("⌗ Grid Options          ", () => this.populateGridMenu(event), false, true);
            this.addMenuItem("⊹ Crosshair Options     ", () => this.populateCrosshairOptionsMenu(event), false, true);
            this.addMenuItem("ⴵ Time Scale Options    ", () => this.populateTimeScaleMenu(event), false, true);
            this.addMenuItem("$ Price Scale Options   ", () => this.populatePriceScaleMenu(event, "right"), false, true);
            this.showMenu(event);
        }
        populateLayoutMenu(event) {
            // Clear the menu
            this.div.innerHTML = "";
            // Text Color Option
            const textColorOption = { name: "Text Color", valuePath: "layout.textColor" };
            const initialTextColor = this.getCurrentOptionValue(textColorOption.valuePath) ||
                "#000000";
            this.addColorPickerMenuItem(camelToTitle(textColorOption.name), initialTextColor, textColorOption.valuePath, this.handler.chart);
            // Background Color Options Based on Current Background Type
            const currentBackground = this.handler.chart.options().layout?.background;
            if (isSolidColor(currentBackground)) {
                // Solid Background Color
                this.addColorPickerMenuItem("Background Color", currentBackground.color || "#FFFFFF", "layout.background.color", this.handler.chart);
            }
            else if (isVerticalGradientColor(currentBackground)) {
                // Gradient Background Colors
                this.addColorPickerMenuItem("Top Color", currentBackground.topColor || "rgba(255,0,0,0.33)", "layout.background.topColor", this.handler.chart);
                this.addColorPickerMenuItem("Bottom Color", currentBackground.bottomColor || "rgba(0,255,0,0.33)", "layout.background.bottomColor", this.handler.chart);
            }
            else {
                console.warn("Unknown background type; no color options displayed.");
            }
            // Switch Background Type Option
            this.addMenuItem("Switch Background Type", () => {
                this.toggleBackgroundType(event);
            }, false, true);
            // Back to Main Menu Option
            this.addMenuItem("⤝ Main Menu", () => {
                this.populateChartMenu(event);
            }, false, false);
            // Display the updated menu
            this.showMenu(event);
        }
        toggleBackgroundType(event) {
            const currentBackground = this.handler.chart.options().layout?.background;
            let updatedBackground;
            // Toggle between Solid and Vertical Gradient
            if (isSolidColor(currentBackground)) {
                updatedBackground = {
                    type: lightweightCharts.ColorType.VerticalGradient,
                    topColor: "rgba(255,0,0,0.2)",
                    bottomColor: "rgba(0,255,0,0.2)",
                };
            }
            else {
                updatedBackground = {
                    type: lightweightCharts.ColorType.Solid,
                    color: "#000000",
                };
            }
            // Apply the updated background type
            this.handler.chart.applyOptions({ layout: { background: updatedBackground } });
            // Repopulate the Layout Menu with the new background type's options
            this.populateLayoutMenu(event);
        }
        populateWidthMenu(event, series) {
            this.div.innerHTML = ""; // Clear current menu
            // Use the stored currentWidthOptions array
            this.currentWidthOptions.forEach((option) => {
                if (typeof option.value === "number") {
                    this.addNumberInput(camelToTitle(option.label), option.value, (newValue) => {
                        const options = buildOptions(option.name, newValue);
                        series.applyOptions(options);
                        console.log(`Updated ${option.label} to ${newValue}`);
                    }, option.min, option.max);
                }
            });
            this.addMenuItem("⤝ Back to Series Options", () => {
                this.populateSeriesMenu(series, event);
            }, false, false);
            this.showMenu(event);
        }
        populateStyleMenu(event, series) {
            this.div.innerHTML = ""; // Clear the current menu
            this.currentStyleOptions.forEach((option) => {
                const predefinedOptions = this.getPredefinedOptions(option.name);
                if (predefinedOptions) {
                    this.addSelectInput(camelToTitle(option.name), option.value.toString(), predefinedOptions, (newValue) => {
                        let finalValue = newValue;
                        // If the option name indicates it's a line style, map string => numeric
                        if (option.name.toLowerCase().includes("style")) {
                            const lineStyleMap = {
                                "Solid": 0,
                                "Dotted": 1,
                                "Dashed": 2,
                                "Large Dashed": 3,
                                "Sparse Dotted": 4
                            };
                            finalValue = lineStyleMap[newValue] ?? 0; // fallback to Solid (0)
                        }
                        // If the option name indicates it's a line type, map string => numeric
                        else if (option.name.toLowerCase().includes("linetype")) {
                            const lineTypeMap = {
                                "Simple": 0,
                                "WithSteps": 1,
                                "Curved": 2
                            };
                            finalValue = lineTypeMap[newValue] ?? 0; // fallback to Simple (0)
                        }
                        // Build the updated options object
                        const updatedOptions = buildOptions(option.name, finalValue);
                        series.applyOptions(updatedOptions);
                        console.log(`Updated ${option.name} to "${newValue}" =>`, finalValue);
                    });
                }
                else {
                    console.warn(`No predefined options found for "${option.name}".`);
                }
            });
            // Add a Back option
            this.addMenuItem("⤝ Back", () => {
                this.populateSeriesMenu(series, event);
            });
            this.showMenu(event);
        }
        populateCloneSeriesMenu(series, event) {
            this.div.innerHTML = "";
            // Fetch the current data from the series
            const data = series.data();
            // Basic clone targets for any data
            const cloneOptions = ["Line", "Histogram", "Area"];
            if (data && data.length > 0) {
                // Check if any bar is recognized as OHLC
                const hasOHLC = data.some((bar) => isOHLCData(bar));
                // If so, we push "Bar" and "Candlestick" to the menu
                if (hasOHLC) {
                    cloneOptions.push("Bar", "Candlestick", "Ohlc");
                }
            }
            // Generate the menu items for each clone option
            cloneOptions.forEach((type) => {
                this.addMenuItem(`Clone as ${type}`, () => {
                    const clonedSeries = cloneSeriesAsType(series, this.handler, type, {});
                    if (clonedSeries) {
                        console.log(`Cloned series as ${type}:`, clonedSeries);
                    }
                    else {
                        console.warn(`Failed to clone as ${type}.`);
                    }
                }, false);
            });
            // Back to Series Options
            this.addMenuItem("⤝ Series Options", () => {
                this.populateSeriesMenu(series, event);
            }, false, false);
            this.showMenu(event);
        }
        addTextInput(label, defaultValue, onChange) {
            const container = document.createElement("div");
            container.classList.add("context-menu-item");
            container.style.display = "flex";
            container.style.alignItems = "center";
            container.style.justifyContent = "space-between";
            const labelElem = document.createElement("label");
            labelElem.innerText = label;
            labelElem.htmlFor = `${label.toLowerCase()}-input`;
            labelElem.style.marginRight = "8px";
            labelElem.style.flex = "1"; // Ensure the label takes up available space
            container.appendChild(labelElem);
            const input = document.createElement("input");
            input.type = "text";
            input.value = defaultValue;
            input.id = `${label.toLowerCase()}-input`;
            input.style.flex = "0 0 100px"; // Fixed width for input
            input.style.marginLeft = "auto"; // Right-align
            input.style.backgroundColor = "#2b2b2b"; // Darker gray background
            input.style.color = "#fff"; // White text color for contrast
            input.style.border = "1px solid #444"; // Subtle border
            input.style.borderRadius = "4px";
            input.style.cursor = "pointer";
            input.addEventListener("input", (event) => {
                const target = event.target;
                onChange(target.value);
            });
            container.appendChild(input);
            this.div.appendChild(container);
            return container;
        }
        populateColorOptionsMenu(colorOptions, series, event) {
            this.div.innerHTML = "";
            colorOptions.forEach((option) => {
                this.addColorPickerMenuItem(camelToTitle(option.label), option.value, option.label, series);
            });
            this.addMenuItem("⤝ Back to Series Options", () => {
                this.populateSeriesMenu(series, event);
            }, false, false);
            this.showMenu(event);
        }
        populateVisibilityMenu(event, series) {
            this.div.innerHTML = "";
            const seriesOptions = series.options();
            const visibilityOptionNames = ["visible", "crosshairMarkerVisible", "priceLineVisible"];
            visibilityOptionNames.forEach((optionName) => {
                const optionValue = seriesOptions[optionName];
                if (typeof optionValue === "boolean") {
                    this.addCheckbox(camelToTitle(optionName), optionValue, (newValue) => {
                        const options = buildOptions(optionName, newValue);
                        series.applyOptions(options);
                        console.log(`Toggled ${optionName} to ${newValue}`);
                    });
                }
            });
            this.addMenuItem("⤝ Back to Series Options", () => {
                this.populateSeriesMenu(series, event);
            }, false, false);
            this.showMenu(event);
        }
        populateBackgroundTypeMenu(event) {
            this.div.innerHTML = "";
            const backgroundOptions = [
                {
                    text: "Solid",
                    action: () => this.setBackgroundType(event, lightweightCharts.ColorType.Solid),
                },
                {
                    text: "Vertical Gradient",
                    action: () => this.setBackgroundType(event, lightweightCharts.ColorType.VerticalGradient),
                },
            ];
            backgroundOptions.forEach((option) => {
                // Use shouldHide = false if you want to move to another menu without closing
                this.addMenuItem(option.text, option.action, false, // don't hide immediately if you want subsequent menus
                false, 1);
            });
            // Back to Chart Menu
            this.addMenuItem("⤝ Chart Menu", () => {
                this.populateChartMenu(event);
            }, false);
            this.showMenu(event);
        }
        populateGradientBackgroundMenuInline(event, gradientBackground) {
            this.div.innerHTML = "";
            this.addColorPickerMenuItem(camelToTitle("Top Color"), gradientBackground.topColor, "layout.background.topColor", this.handler.chart);
            this.addColorPickerMenuItem(camelToTitle("Bottom Color"), gradientBackground.bottomColor, "layout.background.bottomColor", this.handler.chart);
            // Back to Background Type Menu
            this.addMenuItem("⤝ Background Type & Colors", () => {
                this.populateBackgroundTypeMenu(event);
            }, false);
            this.showMenu(event);
        }
        populateGridMenu(event) {
            this.div.innerHTML = ""; // Clear the menu
            // Configuration for grid options
            const gridOptions = [
                {
                    name: "Vertical Line Color",
                    type: "color",
                    valuePath: "grid.vertLines.color",
                    defaultValue: "#D6DCDE",
                },
                {
                    name: "Horizontal Line Color",
                    type: "color",
                    valuePath: "grid.horzLines.color",
                    defaultValue: "#D6DCDE",
                },
                {
                    name: "Vertical Line Style",
                    type: "select",
                    valuePath: "grid.vertLines.style",
                    options: ["Solid", "Dashed", "Dotted", "LargeDashed"],
                    defaultValue: "Solid",
                },
                {
                    name: "Horizontal Line Style",
                    type: "select",
                    valuePath: "grid.horzLines.style",
                    options: ["Solid", "Dashed", "Dotted", "LargeDashed"],
                    defaultValue: "Solid",
                },
                {
                    name: "Show Vertical Lines",
                    type: "boolean",
                    valuePath: "grid.vertLines.visible",
                    defaultValue: true,
                },
                {
                    name: "Show Horizontal Lines",
                    type: "boolean",
                    valuePath: "grid.horzLines.visible",
                    defaultValue: true,
                },
            ];
            // Iterate over the grid options and dynamically add inputs
            gridOptions.forEach((option) => {
                const currentValue = this.getCurrentOptionValue(option.valuePath) ?? option.defaultValue;
                if (option.type === "color") {
                    this.addColorPickerMenuItem(camelToTitle(option.name), currentValue, option.valuePath, this.handler.chart);
                }
                else if (option.type === "select") {
                    this.addSelectInput(camelToTitle(option.name), currentValue, option.options, (newValue) => {
                        const selectedIndex = option.options.indexOf(newValue);
                        const updatedOptions = buildOptions(option.valuePath, selectedIndex);
                        this.handler.chart.applyOptions(updatedOptions);
                        console.log(`Updated ${option.name} to: ${newValue}`);
                    });
                }
                else if (option.type === "boolean") {
                    this.addCheckbox(camelToTitle(option.name), currentValue, (newValue) => {
                        const updatedOptions = buildOptions(option.valuePath, newValue);
                        this.handler.chart.applyOptions(updatedOptions);
                        console.log(`Updated ${option.name} to: ${newValue}`);
                    });
                }
            });
            // Back to Main Menu
            this.addMenuItem("⤝ Main Menu", () => {
                this.populateChartMenu(event);
            }, false);
            this.showMenu(event); // Display the updated menu
        }
        populateBackgroundMenu(event) {
            this.div.innerHTML = "";
            this.addMenuItem("Type & Colors", () => {
                this.populateBackgroundTypeMenu(event);
            }, false, true);
            this.addMenuItem("Options", () => {
                this.populateBackgroundOptionsMenu(event);
            }, false, true);
            this.addMenuItem("⤝ Layout Options", () => {
                this.populateLayoutMenu(event);
            }, false);
            this.showMenu(event);
        }
        populateBackgroundOptionsMenu(event) {
            this.div.innerHTML = "";
            const backgroundOptions = [
                { name: "Background Color", valuePath: "layout.background.color" },
                { name: "Background Top Color", valuePath: "layout.background.topColor" },
                {
                    name: "Background Bottom Color",
                    valuePath: "layout.background.bottomColor",
                },
            ];
            backgroundOptions.forEach((option) => {
                const initialColor = this.getCurrentOptionValue(option.valuePath) || "#FFFFFF";
                this.addColorPickerMenuItem(camelToTitle(option.name), initialColor, option.valuePath, this.handler.chart);
            });
            // Back to Background Menu
            this.addMenuItem("⤝ Background", () => {
                this.populateBackgroundMenu(event);
            }, false);
            this.showMenu(event);
        }
        populateSolidBackgroundMenuInline(event, solidBackground) {
            this.div.innerHTML = "";
            this.addColorPickerMenuItem(camelToTitle("Background Color"), solidBackground.color, "layout.background.color", this.handler.chart);
            // Back to Type & Colors
            this.addMenuItem("⤝ Type & Colors", () => {
                this.populateBackgroundTypeMenu(event);
            }, false);
            this.showMenu(event);
        }
        populateCrosshairOptionsMenu(event) {
            this.div.innerHTML = "";
            const crosshairOptions = [
                { name: "Line Color", valuePath: "crosshair.lineColor" },
                { name: "Vertical Line Color", valuePath: "crosshair.vertLine.color" },
                { name: "Horizontal Line Color", valuePath: "crosshair.horzLine.color" },
            ];
            crosshairOptions.forEach((option) => {
                const initialColor = this.getCurrentOptionValue(option.valuePath) || "#000000";
                this.addColorPickerMenuItem(camelToTitle(option.name), initialColor, option.valuePath, this.handler.chart);
            });
            this.addMenuItem("⤝ Main Menu", () => {
                this.populateChartMenu(event);
            }, false);
            this.showMenu(event);
        }
        populateTimeScaleMenu(event) {
            this.div.innerHTML = ""; // Clear current menu
            // TimeScaleOptions configuration
            const timeScaleOptions = [
                {
                    name: "Right Offset",
                    type: "number",
                    valuePath: "timeScale.rightOffset",
                    min: 0,
                    max: 100,
                },
                {
                    name: "Bar Spacing",
                    type: "number",
                    valuePath: "timeScale.barSpacing",
                    min: 1,
                    max: 100,
                },
                {
                    name: "Min Bar Spacing",
                    type: "number",
                    valuePath: "timeScale.minBarSpacing",
                    min: 0.1,
                    max: 10,
                    step: 0.1
                },
                {
                    name: "Fix Left Edge",
                    type: "boolean",
                    valuePath: "timeScale.fixLeftEdge",
                },
                {
                    name: "Fix Right Edge",
                    type: "boolean",
                    valuePath: "timeScale.fixRightEdge",
                },
                {
                    name: "Lock Visible Range on Resize",
                    type: "boolean",
                    valuePath: "timeScale.lockVisibleTimeRangeOnResize",
                },
                {
                    name: "Visible",
                    type: "boolean",
                    valuePath: "timeScale.visible",
                },
                {
                    name: "Border Visible",
                    type: "boolean",
                    valuePath: "timeScale.borderVisible",
                },
                {
                    name: "Border Color",
                    type: "color",
                    valuePath: "timeScale.borderColor",
                },
            ];
            // Iterate over options and dynamically add inputs based on type
            timeScaleOptions.forEach((option) => {
                if (option.type === "number") {
                    const currentValue = this.getCurrentOptionValue(option.valuePath);
                    this.addNumberInput(camelToTitle(option.name), currentValue, (newValue) => {
                        const updatedOptions = buildOptions(option.valuePath, newValue);
                        this.handler.chart.applyOptions(updatedOptions);
                        console.log(`Updated TimeScale ${option.name} to: ${newValue}`);
                    }, option.min, option.max);
                }
                else if (option.type === "boolean") {
                    const currentValue = this.getCurrentOptionValue(option.valuePath);
                    this.addCheckbox(camelToTitle(option.name), currentValue, (newValue) => {
                        const updatedOptions = buildOptions(option.valuePath, newValue);
                        this.handler.chart.applyOptions(updatedOptions);
                        console.log(`Updated TimeScale ${option.name} to: ${newValue}`);
                    });
                }
                else if (option.type === "color") {
                    const currentColor = this.getCurrentOptionValue(option.valuePath) || "#000000";
                    this.addColorPickerMenuItem(camelToTitle(option.name), currentColor, option.valuePath, this.handler.chart);
                }
            });
            // Back to Main Menu
            this.addMenuItem("⤝ Main Menu", () => {
                this.populateChartMenu(event);
            }, false);
            this.showMenu(event); // Display the updated menu
        }
        populatePriceScaleMenu(event, priceScaleId = "right", series) {
            this.div.innerHTML = ""; // Clear current menu
            if (series) {
                // Option to switch the price scale for the series
                this.addMenuItem("Switch Series Price Scale", () => {
                    const newPriceScaleId = priceScaleId === "left" ? "right" : "left";
                    series.applyOptions({ priceScaleId: newPriceScaleId });
                    console.log(`Series price scale switched to: ${newPriceScaleId}`);
                    this.populatePriceScaleMenu(event, newPriceScaleId, series);
                }, false, false);
            }
            // Dropdown for Price Scale Mode
            const currentMode = this.handler.chart.priceScale(priceScaleId).options().mode ?? lightweightCharts.PriceScaleMode.Normal;
            const modeOptions = [
                { label: "Normal", value: lightweightCharts.PriceScaleMode.Normal },
                { label: "Logarithmic", value: lightweightCharts.PriceScaleMode.Logarithmic },
                { label: "Percentage", value: lightweightCharts.PriceScaleMode.Percentage },
                { label: "Indexed To 100", value: lightweightCharts.PriceScaleMode.IndexedTo100 },
            ];
            const modeLabels = modeOptions.map((opt) => opt.label);
            this.addSelectInput("Price Scale Mode", modeOptions.find((opt) => opt.value === currentMode)?.label || "Normal", // Current value label
            modeLabels, // Dropdown options (labels)
            (newLabel) => {
                const selectedOption = modeOptions.find((opt) => opt.label === newLabel);
                if (selectedOption) {
                    this.applyPriceScaleOptions(priceScaleId, { mode: selectedOption.value });
                    console.log(`Price scale (${priceScaleId}) mode set to: ${newLabel}`);
                    this.populatePriceScaleMenu(event, priceScaleId, series); // Refresh the menu
                }
            });
            // Additional Price Scale Options
            const options = this.handler.chart.priceScale(priceScaleId).options();
            const additionalOptions = [
                {
                    name: "Auto Scale",
                    value: options.autoScale ?? true,
                    action: (newValue) => {
                        this.applyPriceScaleOptions(priceScaleId, { autoScale: newValue });
                        console.log(`Price scale (${priceScaleId}) autoScale set to: ${newValue}`);
                    },
                },
                {
                    name: "Invert Scale",
                    value: options.invertScale ?? false,
                    action: (newValue) => {
                        this.applyPriceScaleOptions(priceScaleId, { invertScale: newValue });
                        console.log(`Price scale (${priceScaleId}) invertScale set to: ${newValue}`);
                    },
                },
                {
                    name: "Align Labels",
                    value: options.alignLabels ?? true,
                    action: (newValue) => {
                        this.applyPriceScaleOptions(priceScaleId, { alignLabels: newValue });
                        console.log(`Price scale (${priceScaleId}) alignLabels set to: ${newValue}`);
                    },
                },
                {
                    name: "Border Visible",
                    value: options.borderVisible ?? true,
                    action: (newValue) => {
                        this.applyPriceScaleOptions(priceScaleId, { borderVisible: newValue });
                        console.log(`Price scale (${priceScaleId}) borderVisible set to: ${newValue}`);
                    },
                },
                {
                    name: "Ticks Visible",
                    value: options.ticksVisible ?? false,
                    action: (newValue) => {
                        this.applyPriceScaleOptions(priceScaleId, { ticksVisible: newValue });
                        console.log(`Price scale (${priceScaleId}) ticksVisible set to: ${newValue}`);
                    },
                },
            ];
            additionalOptions.forEach((opt) => {
                this.addMenuItem(`${opt.name}: ${opt.value ? "On" : "Off"}`, () => {
                    const newValue = !opt.value; // Toggle the current value
                    opt.action(newValue);
                    this.populatePriceScaleMenu(event, priceScaleId, series); // Refresh the menu
                }, false, false);
            });
            // Back to Main Menu
            this.addMenuItem("⤝ Main Menu", () => {
                this.populateChartMenu(event);
            }, false);
            this.showMenu(event); // Display the updated menu
        }
        applyPriceScaleOptions(priceScaleId, options) {
            // Access the price scale from the chart using its ID
            const priceScale = this.handler.chart.priceScale(priceScaleId);
            if (!priceScale) {
                console.warn(`Price scale with ID "${priceScaleId}" not found.`);
                return;
            }
            // Apply the provided options to the price scale
            priceScale.applyOptions(options);
            console.log(`Applied options to price scale "${priceScaleId}":`, options);
        }
        getCurrentOptionValue(optionPath) {
            const keys = optionPath.split(".");
            let options = this.handler.chart.options();
            for (const key of keys) {
                if (options && key in options) {
                    options = options[key];
                }
                else {
                    console.warn(`Option path "${optionPath}" is invalid.`);
                    return null;
                }
            }
            return options;
        }
        setBackgroundType(event, type) {
            const currentBackground = this.handler.chart.options().layout?.background;
            let updatedBackground;
            if (type === lightweightCharts.ColorType.Solid) {
                updatedBackground = isSolidColor(currentBackground)
                    ? { type: lightweightCharts.ColorType.Solid, color: currentBackground.color }
                    : { type: lightweightCharts.ColorType.Solid, color: "#000000" };
            }
            else if (type === lightweightCharts.ColorType.VerticalGradient) {
                updatedBackground = isVerticalGradientColor(currentBackground)
                    ? {
                        type: lightweightCharts.ColorType.VerticalGradient,
                        topColor: currentBackground.topColor,
                        bottomColor: currentBackground.bottomColor,
                    }
                    : {
                        type: lightweightCharts.ColorType.VerticalGradient,
                        topColor: "rgba(255,0,0,.2)",
                        bottomColor: "rgba(0,255,0,.2)",
                    };
            }
            else {
                console.error(`Unsupported ColorType: ${type}`);
                return;
            }
            this.handler.chart.applyOptions({
                layout: {
                    background: updatedBackground,
                },
            });
            if (type === lightweightCharts.ColorType.Solid) {
                this.populateSolidBackgroundMenuInline(event, updatedBackground);
            }
            else if (type === lightweightCharts.ColorType.VerticalGradient) {
                this.populateGradientBackgroundMenuInline(event, updatedBackground);
            }
        }
        startFillAreaBetween(event, originSeries) {
            console.log("Fill Area Between started. Origin series set:", originSeries.options().title);
            // Ensure the series is decorated
            // Populate the Series List Menu
            this.populateSeriesListMenu(event, false, (destinationSeries) => {
                if (destinationSeries && destinationSeries !== originSeries) {
                    console.log("Destination series selected:", destinationSeries.options().title);
                    // Ensure the destination series is also decorated
                    // Instantiate and attach the FillArea
                    originSeries.primitives["FillArea"] = new FillArea(originSeries, destinationSeries, {
                        ...defaultFillAreaOptions,
                    });
                    originSeries.attachPrimitive(originSeries.primitives['FillArea'], `Fill Area ⥵ ${destinationSeries.options().title}`, false, true);
                    // Attach the FillArea as a primitive
                    //if (!originSeries.primitives['FillArea']) {
                    //  originSeries.attachPrimitive(originSeries.primitives["FillArea"])
                    //}
                    console.log("Fill Area successfully added between selected series.");
                    alert(`Fill Area added between ${originSeries.options().title} and ${destinationSeries.options().title}`);
                }
                else {
                    alert("Invalid selection. Please choose a different series as the destination.");
                }
            });
        }
        getPredefinedOptions(label) {
            const predefined = {
                "Series Type": ["Line", "Histogram", "Area", "Bar", "Candlestick"],
                "Line Style": [
                    "Solid",
                    "Dotted",
                    "Dashed",
                    "Large Dashed",
                    "Sparse Dotted",
                ],
                "Line Type": ["Simple", "WithSteps", "Curved"],
                "seriesType": ["Line", "Histogram", "Area", "Bar", "Candlestick"],
                "lineStyle": [
                    "Solid",
                    "Dotted",
                    "Dashed",
                    "Large Dashed",
                    "Sparse Dotted",
                ],
                "Price Line Style": [
                    "Solid",
                    "Dotted",
                    "Dashed",
                    "Large Dashed",
                    "Sparse Dotted",
                ],
                "lineType": ["Simple", "WithSteps", "Curved"],
                "Shape": ['Rectangle', 'Rounded', 'Ellipse', 'Arrow', '3d', 'Polygon'],
                "Candle Shape": ['Rectangle', 'Rounded', 'Ellipse', 'Arrow', '3d', 'Polygon']
            };
            return predefined[camelToTitle(label)] || null;
        }
        /**
         * Populates the Series List Menu for selecting the destination series.
         * @param onSelect Callback when a series is selected.
         */
        populateSeriesListMenu(event, hideMenu, onSelect) {
            this.div.innerHTML = ""; // Clear the current menu
            // 1) Gather all series from your `handler.seriesMap`.
            const mappedSeries = Array.from(this.handler.seriesMap.entries()).map(([seriesName, series]) => ({
                label: seriesName,
                value: series,
            }));
            // 2) Optionally prepend `this.handler.series` if it exists
            let seriesOptions = mappedSeries;
            if (this.handler.series) {
                // Only prepend if `this.handler.series` is truthy
                const mainSeriesItem = {
                    label: "Main Series",
                    value: this.handler.series,
                };
                seriesOptions = [mainSeriesItem, ...mappedSeries];
            }
            // 3) Display series in the menu
            seriesOptions.forEach((option) => {
                this.addMenuItem(option.label, () => {
                    onSelect(option.value);
                    if (hideMenu) {
                        this.hideMenu();
                    }
                    else {
                        this.div.innerHTML = ""; // Clear the current menu
                        this.populateSeriesMenu(option.value, event); // Open the series menu
                        this.showMenu(event);
                    }
                }, false, true);
            });
            // Add a "Cancel" option to go back or exit
            this.addMenuItem("Cancel", () => {
                console.log("Operation canceled.");
                this.hideMenu();
            });
            // Show the menu at the current mouse position
            this.showMenu(event);
        }
        customizeFillAreaOptions(event, FillArea) {
            this.div.innerHTML = ""; // Clear current menu
            if (isFillArea(FillArea)) {
                // Add color pickers for each color-related option
                this.addColorPickerMenuItem("Origin Top Color", FillArea.options.originColor, "originColor", FillArea);
                this.addColorPickerMenuItem("Destination Top Color", FillArea.options.destinationColor, "destinationColor", FillArea);
                // Back to main menu
                this.addMenuItem("⤝ Back to Main Menu", () => this.populateChartMenu(event), false);
                this.showMenu(event);
            }
        }
        addResetViewOption() {
            const resetMenuItem = this.addMenuInput(this.div, {
                type: "hybrid",
                label: "∟ Reset",
                hybridConfig: {
                    defaultAction: () => {
                        this.handler.chart.timeScale().resetTimeScale();
                        this.handler.chart.timeScale().fitContent();
                    },
                    options: [
                        {
                            name: "⥗ Time Scale",
                            action: () => this.handler.chart.timeScale().resetTimeScale(),
                        },
                        {
                            name: "⥘ Price Scale",
                            action: () => this.handler.chart.timeScale().fitContent(),
                        },
                    ],
                },
            });
            this.div.appendChild(resetMenuItem);
        }
    }

    // Converts a hex color to RGBA with specified opacity
    function hexToRGBA(hex, opacity) {
        hex = hex.replace(/^#/, '');
        if (!/^([0-9A-F]{3}){1,2}$/i.test(hex)) {
            throw new Error("Invalid hex color format.");
        }
        const getRGB = (hex) => {
            return hex.length === 3
                ? [parseInt(hex[0] + hex[0], 16), parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16)]
                : [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
        };
        const [r, g, b] = getRGB(hex);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    // Adjusts the opacity of a color (hex, rgb, or rgba)
    function setOpacity(color, newOpacity) {
        if (color.startsWith('#')) {
            return hexToRGBA(color, newOpacity);
        }
        else if (color.startsWith('rgba') || color.startsWith('rgb')) {
            return color.replace(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/, `rgba($1, $2, $3, ${newOpacity})`);
        }
        else {
            throw new Error("Unsupported color format. Use hex, rgb, or rgba.");
        }
    }
    // Darkens a color (hex or rgba) by a specified amount
    function darkenColor(color, amount = 0.2) {
        const hexToRgb = (hex) => {
            hex = hex.replace(/^#/, '');
            return hex.length === 3
                ? [parseInt(hex[0] + hex[0], 16), parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16)]
                : [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
        };
        const rgbaToArray = (rgba) => rgba.match(/\d+(\.\d+)?/g).map(Number);
        let [r, g, b, a = 1] = color.startsWith('#')
            ? [...hexToRgb(color), 1]
            : rgbaToArray(color);
        r = Math.max(0, Math.min(255, r * (1 - amount)));
        g = Math.max(0, Math.min(255, g * (1 - amount)));
        b = Math.max(0, Math.min(255, b * (1 - amount)));
        return color.startsWith('#')
            ? `#${((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1)}`
            : `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
    }

    /**
     * Default grid / crosshair line width in Bitmap sizing
     * @param horizontalPixelRatio - horizontal pixel ratio
     * @returns default grid / crosshair line width in Bitmap sizing
     */
    function gridAndCrosshairBitmapWidth(horizontalPixelRatio) {
        return Math.max(1, Math.floor(horizontalPixelRatio));
    }
    /**
     * Default grid / crosshair line width in Media sizing
     * @param horizontalPixelRatio - horizontal pixel ratio
     * @returns default grid / crosshair line width in Media sizing
     */
    function gridAndCrosshairMediaWidth(horizontalPixelRatio) {
        return (gridAndCrosshairBitmapWidth(horizontalPixelRatio) / horizontalPixelRatio);
    }

    // -------------------------------------
    // Imports
    // -------------------------------------
    // -------------------------------------
    // Constants
    // -------------------------------------
    /**
     * Default color for upward-moving candles.
     * Format: RGBA with 33.3% opacity.
     */
    /**
     * Default color for downward-moving candles.
     * Format: RGBA with 33.3% opacity.
     */
    /**
     * Default line style for candle borders.
     * 1 represents a solid line.
     */
    const DEFAULT_LINE_STYLE = 1;
    /**
     * Default line width for candle borders.
     * 1 pixel.
     */
    const DEFAULT_LINE_WIDTH = 1;
    // -------------------------------------
    // BarDataAggregator Class
    // -------------------------------------
    /**
     * Aggregates raw bar data into grouped bar items based on specified options.
     * Handles the styling and property consolidation for candle rendering.
     */
    class BarDataAggregator {
        /**
         * Configuration options for data aggregation and candle styling.
         */
        _options;
        /**
         * Constructs a new BarDataAggregator instance.
         * @param options - Aggregation and styling options. Can be null to use defaults.
         */
        constructor(options) {
            this._options = options;
        }
        /**
         * Aggregates an array of BarItem objects into grouped BarItem objects.
         * @param data - The raw bar data to aggregate.
         * @param priceToCoordinate - Function to convert price values to canvas coordinates.
         * @returns An array of aggregated BarItem objects.
         */
        aggregate(data, priceToCoordinate) {
            // Determine the number of bars to group based on chandelierSize.
            const groupSize = this._options?.chandelierSize ?? 1;
            const aggregatedBars = [];
            // Iterate over the data in increments of groupSize to create buckets.
            for (let i = 0; i < data.length; i += groupSize) {
                const bucket = data.slice(i, i + groupSize);
                const isInProgress = bucket.length < groupSize && i + bucket.length === data.length;
                // Warn and skip if an empty bucket is encountered.
                if (bucket.length === 0) {
                    console.warn('Empty bucket encountered during aggregation.');
                    continue;
                }
                // Aggregate the current bucket into a single BarItem.
                const aggregatedBar = this._chandelier(bucket, i, i + bucket.length - 1, priceToCoordinate, isInProgress);
                aggregatedBars.push(aggregatedBar);
            }
            return aggregatedBars;
        }
        /**
         * Aggregates a single bucket of BarItem objects into one consolidated BarItem.
         * @param bucket - The group of BarItem objects to aggregate.
         * @param startIndex - The starting index of the bucket in the original data array.
         * @param endIndex - The ending index of the bucket in the original data array.
         * @param priceToCoordinate - Function to convert price values to canvas coordinates.
         * @param isInProgress - Indicates if the aggregation is currently in progress.
         * @returns A single aggregated BarItem.
         * @throws Will throw an error if the bucket is empty.
         */
        _chandelier(bucket, startIndex, endIndex, priceToCoordinate, isInProgress = false) {
            if (bucket.length === 0) {
                throw new Error('Bucket cannot be empty in _chandelier method.');
            }
            // Extract open and close prices from the first and last bars in the bucket.
            const openPrice = bucket[0].originalData?.open ?? bucket[0].open ?? 0;
            const closePrice = bucket[bucket.length - 1].originalData?.close ??
                bucket[bucket.length - 1].close ??
                0;
            // Convert open and close prices to canvas coordinates.
            const open = priceToCoordinate(openPrice) ?? 0;
            const close = priceToCoordinate(closePrice) ?? 0;
            // Extract high and low prices from all bars in the bucket.
            const highPrices = bucket.map((bar) => bar.originalData?.high ?? bar.high);
            const lowPrices = bucket.map((bar) => bar.originalData?.low ?? bar.low);
            // Determine the highest and lowest prices in the bucket.
            const highPrice = highPrices.length > 0 ? Math.max(...highPrices) : 0;
            const lowPrice = lowPrices.length > 0 ? Math.min(...lowPrices) : 0;
            // Convert high and low prices to canvas coordinates.
            const high = priceToCoordinate(highPrice) ?? 0;
            const low = priceToCoordinate(lowPrice) ?? 0;
            // Position of the aggregated bar on the x-axis.
            const x = bucket[0].x;
            // Determine if the aggregated bar represents an upward movement.
            const isUp = closePrice > openPrice;
            // Explicitly map colors based on `isUp` status.
            const color = isUp
                ? (this._options?.upColor || 'rgba(0,255,0,0.333)')
                : (this._options?.downColor || 'rgba(255,0,0,0.333)');
            const borderColor = isUp
                ? (this._options?.borderUpColor || setOpacity(color, 1))
                : (this._options?.borderDownColor || setOpacity(color, 1));
            const wickColor = isUp
                ? (this._options?.wickUpColor || borderColor)
                : (this._options?.wickDownColor || borderColor);
            // Aggregate lineStyle similarly to other properties.
            const lineStyle = bucket.reduce((style, bar) => bar.lineStyle ?? bar.originalData?.lineStyle ?? style, this._options?.lineStyle ?? DEFAULT_LINE_STYLE);
            // Aggregate lineWidth similarly to other properties.
            const lineWidth = bucket.reduce((currentWidth, bar) => bar.lineWidth ?? bar.originalData?.lineWidth ?? currentWidth, this._options?.lineWidth ?? DEFAULT_LINE_WIDTH);
            // Aggregate shape similarly to other properties.
            const shape = bucket.reduce((currentShape, bar) => {
                const parsedShape = bar.shape
                    ? parseCandleShape(bar.shape)
                    : bar.originalData?.shape
                        ? parseCandleShape(bar.originalData.shape)
                        : undefined;
                // If parsing fails, retain the current shape.
                return parsedShape ?? currentShape;
            }, this._options?.shape ?? CandleShape.Rectangle);
            // Ensure that `shape` is never undefined. If it is, default to Rectangle.
            const finalShape = shape || CandleShape.Rectangle;
            // Return the aggregated BarItem with all consolidated properties.
            return {
                open,
                high,
                low,
                close,
                x,
                isUp,
                startIndex,
                endIndex,
                isInProgress,
                color,
                borderColor,
                wickColor,
                shape: finalShape,
                lineStyle,
                lineWidth,
            };
        }
    }
    // -------------------------------------
    // ohlcSeriesRenderer Class
    // -------------------------------------
    /**
     * Custom renderer for candle series, implementing various candle shapes and styles.
     * Utilizes BarDataAggregator for data aggregation and rendering logic for different candle shapes.
     * @template TData - The type of custom candle series data.
     */
    class ohlcSeriesRenderer {
        /**
         * The current data to be rendered.
         */
        _data = null;
        /**
         * The current rendering options.
         */
        _options = null;
        /**
         * The data aggregator instance.
         */
        _aggregator = null;
        /**
         * Draws the candle series onto the provided canvas target.
         * @param target - The canvas rendering target.
         * @param priceConverter - Function to convert price values to canvas coordinates.
         */
        draw(target, priceConverter) {
            target.useBitmapCoordinateSpace((scope) => this._drawImpl(scope, priceConverter));
        }
        /**
         * Updates the renderer with new data and options.
         * @param data - The custom series data to render.
         * @param options - The custom series options for styling and behavior.
         */
        update(data, options) {
            this._data = data;
            this._options = options;
            this._aggregator = new BarDataAggregator(options);
        }
        /**
         * Internal implementation of the drawing logic.
         * Processes data, aggregates bars, and delegates drawing to specific methods.
         * @param renderingScope - The rendering scope containing canvas context and scaling information.
         * @param priceToCoordinate - Function to convert price values to canvas coordinates.
         */
        _drawImpl(renderingScope, priceToCoordinate) {
            // Exit early if there's no data or options to render.
            if (!this._data ||
                this._data.bars.length === 0 ||
                !this._data.visibleRange ||
                !this._options) {
                return;
            }
            // Transform raw data into BarItem objects with initial styling.
            const bars = this._data.bars.map((bar, index) => ({
                open: bar.originalData?.open ?? 0,
                high: bar.originalData?.high ?? 0,
                low: bar.originalData?.low ?? 0,
                close: bar.originalData?.close ?? 0,
                x: bar.x,
                shape: (bar.originalData?.shape ??
                    this._options?.shape ??
                    'Rectangle'),
                lineStyle: bar.originalData?.lineStyle ??
                    this._options?.lineStyle ??
                    1,
                lineWidth: bar.originalData?.lineWidth ??
                    this._options?.lineWidth ??
                    1,
                isUp: (bar.originalData?.close ?? 0) >=
                    (bar.originalData?.open ?? 0),
                color: this._options?.color ?? 'rgba(0,0,0,0)',
                borderColor: this._options?.borderColor ?? 'rgba(0,0,0,0)',
                wickColor: this._options?.wickColor ?? 'rgba(0,0,0,0)',
                startIndex: index,
                endIndex: index,
            }));
            // Aggregate the bars using the BarDataAggregator.
            const aggregatedBars = this._aggregator?.aggregate(bars, priceToCoordinate) ?? [];
            // Determine the radius for rounded shapes and candle width based on scaling.
            const radius = this._options.radius;
            const { horizontalPixelRatio, verticalPixelRatio } = renderingScope;
            const candleWidth = this._data.barSpacing * horizontalPixelRatio;
            // Delegate drawing of candle bodies and wicks.
            this._drawCandles(renderingScope, aggregatedBars, this._data.visibleRange, radius, candleWidth, horizontalPixelRatio, verticalPixelRatio);
            this._drawWicks(renderingScope, aggregatedBars, this._data.visibleRange);
        }
        /**
         * Draws the wicks (high-low lines) for each aggregated candle.
         * Skips rendering if the candle shape is '3d'.
         * @param renderingScope - The rendering scope containing canvas context and scaling information.
         * @param bars - Array of aggregated BarItem objects to draw wicks for.
         * @param visibleRange - The range of visible bars to render.
         */
        _drawWicks(renderingScope, bars, visibleRange) {
            // Exit early if there's no data or options.
            if (this._data === null || this._options === null) {
                return;
            }
            // Skip wick drawing if the candle shape is '3d'.
            if (this._options.shape === '3d') {
                return;
            }
            const { context: ctx, horizontalPixelRatio, verticalPixelRatio } = renderingScope;
            const candleWidth = this._data.barSpacing * horizontalPixelRatio;
            const wickWidth = gridAndCrosshairMediaWidth(horizontalPixelRatio);
            // Iterate over each aggregated bar to draw its wicks.
            for (const bar of bars) {
                // Skip bars outside the visible range.
                if (bar.startIndex < visibleRange.from ||
                    bar.endIndex > visibleRange.to) {
                    continue;
                }
                // Calculate pixel positions for high, low, open, and close.
                const low = bar.low * verticalPixelRatio;
                const high = bar.high * verticalPixelRatio;
                const openCloseTop = Math.min(bar.open, bar.close) * verticalPixelRatio;
                const openCloseBottom = Math.max(bar.open, bar.close) * verticalPixelRatio;
                // Determine the X position for the wick.
                let wickX = bar.x * horizontalPixelRatio;
                const groupSize = bar.endIndex - bar.startIndex;
                if (groupSize && groupSize > 1) {
                    wickX += candleWidth * Math.max(1, groupSize) / 2;
                }
                // Adjust wick heights for 'Polygon' shape candles.
                let upperWickTop = high;
                let upperWickBottom = openCloseTop;
                let lowerWickTop = openCloseBottom;
                let lowerWickBottom = low;
                if (this._options.shape === 'Polygon') {
                    // For 'Polygon' candles, set halfway points.
                    upperWickBottom = (high + openCloseTop) / 2;
                    lowerWickTop = (low + openCloseBottom) / 2;
                }
                // Set fill and stroke styles for the wick.
                ctx.fillStyle = bar.color;
                ctx.strokeStyle = bar.wickColor ?? bar.color;
                /**
                 * Draws a rounded rectangle or a standard rectangle as a wick.
                 * @param x - The X-coordinate of the top-left corner.
                 * @param y - The Y-coordinate of the top-left corner.
                 * @param width - The width of the rectangle.
                 * @param height - The height of the rectangle.
                 * @param radius - The corner radius for rounded rectangles.
                 */
                const drawRoundedRect = (x, y, width, height, radius) => {
                    if (ctx.roundRect) {
                        ctx.roundRect(x, y, width, height, radius);
                    }
                    else {
                        ctx.rect(x, y, width, height);
                    }
                };
                // Draw the upper wick.
                const upperWickHeight = upperWickBottom - upperWickTop;
                if (upperWickHeight > 0) {
                    ctx.beginPath();
                    drawRoundedRect(wickX - Math.floor(wickWidth / 2), upperWickTop, wickWidth, upperWickHeight, wickWidth / 2 // Radius for rounded corners.
                    );
                    ctx.fill();
                    ctx.stroke();
                }
                // Draw the lower wick.
                const lowerWickHeight = lowerWickBottom - lowerWickTop;
                if (lowerWickHeight > 0) {
                    ctx.beginPath();
                    drawRoundedRect(wickX - Math.floor(wickWidth / 2), lowerWickTop, wickWidth, lowerWickHeight, wickWidth / 2 // Radius for rounded corners.
                    );
                    ctx.fill();
                    ctx.stroke();
                }
            }
        }
        /**
         * Draws the candle bodies based on their specified shapes.
         * Supports multiple shapes like Rectangle, Rounded, Ellipse, Arrow, 3D, and Polygon.
         * @param renderingScope - The rendering scope containing canvas context and scaling information.
         * @param bars - Array of aggregated BarItem objects to draw candles for.
         * @param visibleRange - The range of visible bars to render.
         * @param radius - The radius for rounded candle shapes.
         * @param candleWidth - The width of the candle in pixels.
         * @param horizontalPixelRatio - Scaling factor for horizontal dimensions.
         * @param verticalPixelRatio - Scaling factor for vertical dimensions.
         */
        _drawCandles(renderingScope, bars, visibleRange, radius, candleWidth, horizontalPixelRatio, verticalPixelRatio) {
            const { context: ctx } = renderingScope;
            const barSpace = this._options?.barSpacing ?? 0.8;
            // Save the current canvas state before drawing.
            ctx.save();
            // Iterate over each aggregated bar to draw its body.
            for (const bar of bars) {
                const groupSize = bar.endIndex - bar.startIndex;
                // Calculate the horizontal span of the candle based on grouping.
                const barHorizontalSpan = this._options?.chandelierSize !== 1
                    ? candleWidth * Math.max(1, groupSize + 1) -
                        (1 - barSpace) * candleWidth
                    : candleWidth * barSpace;
                // Determine the X position for the candle.
                const barHorizontalPos = bar.x * horizontalPixelRatio;
                // Calculate the actual width of the candle body.
                const candleBodyWidth = candleWidth * barSpace;
                // Skip rendering if the bar is outside the visible range.
                if (bar.startIndex < visibleRange.from ||
                    bar.endIndex > visibleRange.to) {
                    continue;
                }
                // Calculate vertical positions for the candle body.
                const barVerticalMax = Math.min(bar.open, bar.close) * verticalPixelRatio;
                const barVerticalMin = Math.max(bar.open, bar.close) * verticalPixelRatio;
                const barVerticalSpan = barVerticalMax - barVerticalMin;
                const barY = (barVerticalMax + barVerticalMin) / 2;
                // Precompute common X coordinates for drawing.
                const leftSide = barHorizontalPos - candleBodyWidth / 2;
                const rightSide = leftSide + barHorizontalSpan;
                const middle = leftSide + barHorizontalSpan / 2;
                // Set fill and stroke styles from bar properties.
                ctx.fillStyle =
                    bar.color ?? this._options?.color ?? 'rgba(255,255,255,1)';
                ctx.strokeStyle =
                    bar.borderColor ??
                        this._options?.borderColor ??
                        bar.color ??
                        'rgba(255,255,255,1)';
                setLineStyle(ctx, bar.lineStyle);
                ctx.lineWidth = bar.lineWidth ?? DEFAULT_LINE_WIDTH;
                // Draw the candle based on its specified shape.
                switch (bar.shape) {
                    case 'Rectangle':
                        this._drawCandle(ctx, leftSide, rightSide, barY, barVerticalSpan);
                        break;
                    case 'Rounded':
                        this._drawRounded(ctx, leftSide, rightSide, barY, barVerticalSpan, radius);
                        break;
                    case 'Ellipse':
                        this._drawEllipse(ctx, leftSide, rightSide, middle, barY, barVerticalSpan);
                        break;
                    case 'Arrow':
                        this._drawArrow(ctx, leftSide, rightSide, middle, barY, barVerticalSpan, bar.high * verticalPixelRatio, bar.low * verticalPixelRatio, bar.isUp);
                        break;
                    case '3d':
                        this._draw3d(ctx, barHorizontalPos, bar.high * verticalPixelRatio, bar.low * verticalPixelRatio, bar.open * verticalPixelRatio, bar.close * verticalPixelRatio, candleBodyWidth, barHorizontalSpan, bar.color, bar.borderColor, bar.isUp, barSpace);
                        break;
                    case 'Polygon':
                        this._drawPolygon(ctx, leftSide, rightSide, barY, barVerticalSpan, bar.high * verticalPixelRatio, bar.low * verticalPixelRatio, bar.isUp);
                        break;
                    default:
                        // Fallback to rectangle shape if unknown shape is specified.
                        this._drawCandle(ctx, leftSide, rightSide, barY, barVerticalSpan);
                        break;
                }
            }
            // Restore the canvas state after drawing.
            ctx.restore();
        }
        /**
         * Draws a rectangle-shaped candle.
         * @param ctx - The canvas rendering context.
         * @param leftSide - The X-coordinate of the left edge of the candle.
         * @param rightSide - The X-coordinate of the right edge of the candle.
         * @param yCenter - The Y-coordinate of the center of the candle.
         * @param candleHeight - The height of the candle in pixels.
         */
        _drawCandle(ctx, leftSide, rightSide, yCenter, candleHeight) {
            const topEdge = yCenter - candleHeight / 2;
            const bottomEdge = yCenter + candleHeight / 2;
            // Begin drawing the candle rectangle.
            ctx.beginPath();
            ctx.moveTo(leftSide, topEdge);
            ctx.lineTo(leftSide, bottomEdge);
            ctx.lineTo(rightSide, bottomEdge);
            ctx.lineTo(rightSide, topEdge);
            ctx.closePath();
            // Fill and stroke the rectangle.
            ctx.fill();
            ctx.stroke();
        }
        /**
     * Draws a rounded rectangle-shaped candle with clamped corner radius.
     * @param ctx - The canvas rendering context.
     * @param leftSide - The X-coordinate of the left edge of the candle.
     * @param rightSide - The X-coordinate of the right edge of the candle.
     * @param yCenter - The Y-coordinate of the center of the candle.
     * @param candleHeight - The height of the candle in pixels.
     * @param radius - A float from 0..1 that we clamp to an appropriate max.
     */
        _drawRounded(ctx, leftSide, rightSide, yCenter, candleHeight, radius) {
            const width = rightSide - leftSide;
            // Optionally clamp radius if it's supposed to be 0..1
            const rawRadius = radius * Math.min(Math.abs(width), Math.abs(candleHeight));
            const effectiveRadius = Math.abs(Math.min(rawRadius, width / 2, candleHeight / 2));
            const topEdge = yCenter - candleHeight / 2;
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(leftSide, topEdge, width, candleHeight, effectiveRadius);
            }
            else {
                // Fallback: manually draw arcs or just do rect
                ctx.rect(leftSide, topEdge, width, candleHeight);
            }
            ctx.fill();
            ctx.stroke();
        }
        /**
         * Draws an ellipse-shaped candle.
         * @param ctx - The canvas rendering context.
         * @param leftSide - The X-coordinate of the left edge of the ellipse.
         * @param rightSide - The X-coordinate of the right edge of the ellipse.
         * @param middle - The X-coordinate of the center of the ellipse.
         * @param yCenter - The Y-coordinate of the center of the ellipse.
         * @param candleHeight - The height of the ellipse in pixels.
         * @param barSpacing - The spacing factor between bars.
         */
        _drawEllipse(ctx, leftSide, rightSide, middle, yCenter, candleHeight) {
            // Calculate radii based on candle dimensions and spacing.
            const xRadius = (rightSide - leftSide) / 2;
            const yRadius = candleHeight / 2;
            const adjustedXCenter = middle;
            // Begin drawing the ellipse.
            ctx.beginPath();
            ctx.ellipse(adjustedXCenter, // X-coordinate of the center.
            yCenter, // Y-coordinate of the center.
            Math.abs(xRadius), // Horizontal radius.
            Math.abs(yRadius), // Vertical radius.
            0, // Rotation angle.
            0, // Start angle.
            Math.PI * 2 // End angle.
            );
            ctx.fill();
            ctx.stroke();
        }
        /**
         * Draws a 3D-shaped candle, providing a depth effect.
         * @param ctx - The canvas rendering context.
         * @param leftSide - The X-coordinate of the front left edge of the candle.
         * @param rightSide - The X-coordinate of the front right edge of the candle.
         * @param middle - The X-coordinate of the center depth.
         * @param yCenter - The Y-coordinate of the center of the candle.
         * @param candleHeight - The height of the candle in pixels.
         * @param highY - The Y-coordinate of the highest point of the candle.
         * @param lowY - The Y-coordinate of the lowest point of the candle.
         * @param openY - The Y-coordinate of the opening price.
         * @param closeY - The Y-coordinate of the closing price.
         * @param fillColor - The fill color of the candle.
         * @param borderColor - The border color of the candle.
         * @param isUp - Indicates if the candle is upward-moving.
         * @param barSpacing - The spacing factor between bars.
         */
        _draw3d(ctx, xCenter, high, low, open, close, candleWidth, combinedWidth, fillColor, borderColor, isUp, barSpacing) {
            const xOffset = -Math.max(combinedWidth, 1) * (1 - barSpacing);
            const insideColor = darkenColor(fillColor, 0.666); // Darker side color
            const sideColor = darkenColor(fillColor, 0.333);
            const topColor = darkenColor(fillColor, 0.2); // Slightly lighter top face
            // Calculate front face X coordinates using candleWidth
            const frontLeftX = xCenter - candleWidth / 2;
            const frontRightX = (xCenter - candleWidth / 2) + (combinedWidth) + xOffset;
            // Calculate back face X coordinates with combined width for depth effect
            const backLeftX = frontLeftX - xOffset;
            const backRightX = frontRightX - xOffset;
            // Set Y coordinates for front and back faces based on candle direction
            let frontTop, frontBottom, backTop, backBottom;
            if (!isUp) {
                // Up candle: front face uses open/high, back face uses low/close
                frontTop = open;
                frontBottom = high;
                backTop = low;
                backBottom = close;
            }
            else {
                // Down candle: front face uses open/low, back face uses high/close
                frontTop = open;
                frontBottom = low;
                backTop = high;
                backBottom = close;
            }
            // Draw back (shadow) rectangle
            ctx.fillStyle = sideColor;
            ctx.strokeStyle = borderColor;
            //ctx.beginPath();
            //ctx.rect(backLeftX, backTop, (combinedWidth)+xOffset-(candleWidth/2), backBottom - backTop);
            //ctx.fill();
            //ctx.stroke();
            // Draw top face between front and back
            ctx.fillStyle = topColor;
            if (isUp) {
                // Draw bottom face first for up candles
                ctx.fillStyle = insideColor;
                ctx.beginPath();
                ctx.moveTo(frontLeftX, frontBottom); // Bottom-left corner at the front
                ctx.lineTo(backLeftX, backBottom); // Bottom-left corner at the back
                ctx.lineTo(backRightX, backBottom); // Bottom-right corner at the back
                ctx.lineTo(frontRightX, frontBottom); // Bottom-right corner at the front
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                // Draw left side face for up candles
                ctx.fillStyle = insideColor;
                ctx.beginPath();
                ctx.moveTo(frontLeftX, frontTop); // Top-left corner at the front
                ctx.lineTo(backLeftX, backTop); // Top-left corner at the back
                ctx.lineTo(backLeftX, backBottom); // Bottom-left corner at the back
                ctx.lineTo(frontLeftX, frontBottom); // Bottom-left corner at the front
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                // Draw right side face for up candles
                ctx.fillStyle = insideColor;
                ctx.beginPath();
                ctx.moveTo(frontRightX, frontTop); // Top-right corner at the front
                ctx.lineTo(backRightX, backTop); // Top-right corner at the back
                ctx.lineTo(backRightX, backBottom); // Bottom-right corner at the back
                ctx.lineTo(frontRightX, frontBottom); // Bottom-right corner at the front
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                // Draw top face last for up candles
                ctx.fillStyle = topColor;
                ctx.beginPath();
                ctx.moveTo(frontLeftX, frontTop); // Top-left corner at the front
                ctx.lineTo(backLeftX, backTop); // Top-left corner at the back
                ctx.lineTo(backRightX, backTop); // Top-right corner at the back
                ctx.lineTo(frontRightX, frontTop); // Top-right corner at the front
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
            else {
                // Draw top face first for down candles
                ctx.fillStyle = topColor;
                ctx.beginPath();
                ctx.moveTo(frontLeftX, frontTop); // Top-left corner at the front
                ctx.lineTo(backLeftX, backTop); // Top-left corner at the back
                ctx.lineTo(backRightX, backTop); // Top-right corner at the back
                ctx.lineTo(frontRightX, frontTop); // Top-right corner at the front
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                // Draw right side face for down candles
                ctx.fillStyle = sideColor;
                ctx.beginPath();
                ctx.moveTo(frontRightX, frontTop); // Top-right corner at the front
                ctx.lineTo(backRightX, backTop); // Top-right corner at the back
                ctx.lineTo(backRightX, backBottom); // Bottom-right corner at the back
                ctx.lineTo(frontRightX, frontBottom); // Bottom-right corner at the front
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                // Draw left side face for down candles
                ctx.fillStyle = sideColor;
                ctx.beginPath();
                ctx.moveTo(frontLeftX, frontTop); // Top-left corner at the front
                ctx.lineTo(backLeftX, backTop); // Top-left corner at the back
                ctx.lineTo(backLeftX, backBottom); // Bottom-left corner at the back
                ctx.lineTo(frontLeftX, frontBottom); // Bottom-left corner at the front
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                // Draw bottom face last for down candles
                ctx.fillStyle = sideColor;
                ctx.beginPath();
                ctx.moveTo(frontLeftX, frontBottom); // Bottom-left corner at the front
                ctx.lineTo(backLeftX, backBottom); // Bottom-left corner at the back
                ctx.lineTo(backRightX, backBottom); // Bottom-right corner at the back
                ctx.lineTo(frontRightX, frontBottom); // Bottom-right corner at the front
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
        }
        /**
         * Draws a polygon-shaped candle.
         * @param ctx - The canvas rendering context.
         * @param leftSide - The X-coordinate of the left edge of the polygon.
         * @param rightSide - The X-coordinate of the right edge of the polygon.
         * @param middle - The X-coordinate of the center depth.
         * @param yCenter - The Y-coordinate of the center of the polygon.
         * @param candleHeight - The height of the polygon in pixels.
         * @param highY - The Y-coordinate of the highest point of the polygon.
         * @param lowY - The Y-coordinate of the lowest point of the polygon.
         * @param isUp - Indicates if the polygon points upwards.
         */
        _drawPolygon(ctx, leftSide, rightSide, yCenter, candleHeight, highY, lowY, isUp) {
            const openCloseTop = yCenter + candleHeight / 2;
            const openCloseBottom = yCenter - candleHeight / 2;
            // Save the current canvas state before drawing.
            ctx.save();
            ctx.beginPath();
            if (isUp) {
                // Define the path for an upward-pointing polygon.
                ctx.moveTo(leftSide, openCloseTop);
                ctx.lineTo(rightSide, highY);
                ctx.lineTo(rightSide, openCloseBottom);
                ctx.lineTo(leftSide, lowY);
            }
            else {
                // Define the path for a downward-pointing polygon.
                ctx.moveTo(leftSide, highY);
                ctx.lineTo(rightSide, openCloseTop);
                ctx.lineTo(rightSide, lowY);
                ctx.lineTo(leftSide, openCloseBottom);
            }
            // Complete the path and apply styles.
            ctx.closePath();
            ctx.stroke();
            ctx.fill();
            // Restore the canvas state after drawing.
            ctx.restore();
        }
        /**
         * Draws an arrow-shaped candle.
         * @param ctx - The canvas rendering context.
         * @param leftSide - The X-coordinate of the left edge of the arrow.
         * @param rightSide - The X-coordinate of the right edge of the arrow.
         * @param middle - The X-coordinate of the tip of the arrow.
         * @param yCenter - The Y-coordinate of the center of the arrow.
         * @param candleHeight - The height of the arrow in pixels.
         * @param highY - The Y-coordinate of the highest point of the arrow.
         * @param lowY - The Y-coordinate of the lowest point of the arrow.
         * @param isUp - Indicates if the arrow points upwards.
         */
        _drawArrow(ctx, leftSide, rightSide, middle, yCenter, candleHeight, highY, lowY, isUp) {
            // Save the current canvas state before drawing.
            ctx.save();
            ctx.beginPath();
            if (isUp) {
                // Define the path for an upward-pointing arrow.
                ctx.moveTo(leftSide, lowY);
                ctx.lineTo(leftSide, yCenter + candleHeight / 2);
                ctx.lineTo(middle, highY);
                ctx.lineTo(rightSide, yCenter + candleHeight / 2);
                ctx.lineTo(rightSide, lowY);
                ctx.lineTo(middle, yCenter - candleHeight / 2);
                ctx.lineTo(leftSide, lowY);
            }
            else {
                // Define the path for a downward-pointing arrow.
                ctx.moveTo(leftSide, highY);
                ctx.lineTo(leftSide, yCenter - candleHeight / 2);
                ctx.lineTo(middle, lowY);
                ctx.lineTo(rightSide, yCenter - candleHeight / 2);
                ctx.lineTo(rightSide, highY);
                ctx.lineTo(middle, yCenter + candleHeight / 2);
                ctx.lineTo(leftSide, highY);
            }
            // Complete the path and apply styles.
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // Restore the canvas state after drawing.
            ctx.restore();
        }
    }

    //upperUpColor: string|undefined
    //upperDownColor: string|undefined
    //lowerUpColor: string|undefined
    //lowerDownColor: string|undefined
    const ohlcdefaultOptions = {
        ...lightweightCharts.customSeriesDefaultOptions,
        upColor: '#26a69a',
        downColor: '#ef5350',
        wickVisible: true,
        borderVisible: true,
        borderColor: '#378658',
        borderUpColor: '#26a69a',
        borderDownColor: '#ef5350',
        wickColor: '#737375',
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
        radius: .6,
        shape: 'Rounded', // Default shape
        chandelierSize: 1,
        barSpacing: 0.8,
        lineStyle: 0,
        lineWidth: 2
    };
    //upperUpColor: undefined,
    //upperDownColor: undefined,
    //lowerUpColor: undefined,
    //lowerDownColor: undefined,
    class ohlcSeries {
        _renderer;
        constructor() {
            this._renderer = new ohlcSeriesRenderer();
        }
        priceValueBuilder(plotRow) {
            return [plotRow.high, plotRow.low, plotRow.close];
        }
        renderer() {
            return this._renderer;
        }
        isWhitespace(data) {
            return data.close === undefined;
        }
        update(data, options) {
            this._renderer.update(data, options);
        }
        defaultOptions() {
            return ohlcdefaultOptions;
        }
    }
    // ./types.ts

    //import { TradeSeriesOptions, tradeDefaultOptions, TradeSeries } from "../tx-series/renderer";
    globalParamInit();
    class Handler {
        id;
        commandFunctions = [];
        static handlers = new Map();
        seriesOriginMap = new WeakMap();
        wrapper;
        div;
        chart;
        scale;
        precision = 2;
        series;
        volumeSeries;
        legend;
        _topBar;
        toolBox;
        spinner;
        _seriesList = [];
        seriesMap = new Map();
        seriesMetadata;
        // Add a property for the SeriesContextMenu
        ContextMenu;
        currentMouseEventParams = null;
        // Map to store pending options for saving
        // TODO find a better solution rather than the 'position' parameter
        constructor(chartId, innerWidth, innerHeight, position, autoSize) {
            this.reSize = this.reSize.bind(this);
            this.id = chartId;
            this.scale = {
                width: innerWidth,
                height: innerHeight,
            };
            Handler.handlers.set(chartId, this);
            this.wrapper = document.createElement('div');
            this.wrapper.classList.add("handler");
            this.wrapper.style.float = position;
            this.div = document.createElement('div');
            this.div.style.position = 'relative';
            this.wrapper.appendChild(this.div);
            window.containerDiv.append(this.wrapper);
            this.chart = this._createChart();
            this.series = this.createCandlestickSeries();
            this.volumeSeries = this.createVolumeSeries();
            this.series.applyOptions;
            this.legend = new Legend(this);
            // Inside Handler class constructor
            // Setup MouseEventParams tracking
            this.chart.subscribeCrosshairMove((param) => {
                this.currentMouseEventParams = param;
                window.MouseEventParams = param;
            });
            document.addEventListener("keydown", (event) => {
                for (let i = 0; i < this.commandFunctions.length; i++) {
                    if (this.commandFunctions[i](event))
                        break;
                }
            });
            window.handlerInFocus = this.id;
            this.wrapper.addEventListener("mouseover", () => {
                window.handlerInFocus = this.id;
                window.MouseEventParams = this.currentMouseEventParams || null; // Default to null if undefined
            });
            this.seriesMetadata = new WeakMap();
            this.reSize();
            if (!autoSize)
                return;
            window.addEventListener("resize", () => this.reSize());
            // Setup MouseEventParams tracking
            this.chart.subscribeCrosshairMove((param) => {
                this.currentMouseEventParams = param;
            });
            this.ContextMenu = new ContextMenu(this, Handler.handlers, // handlers: Map<string, Handler>
            () => window.MouseEventParams ?? null // Ensure it returns null if undefined
            );
        }
        reSize() {
            let topBarOffset = this.scale.height !== 0 ? this._topBar?._div.offsetHeight || 0 : 0;
            this.chart.resize(window.innerWidth * this.scale.width, window.innerHeight * this.scale.height - topBarOffset);
            this.wrapper.style.width = `${100 * this.scale.width}%`;
            this.wrapper.style.height = `${100 * this.scale.height}%`;
            // TODO definitely a better way to do this
            if (this.scale.height === 0 || this.scale.width === 0) {
                // if (this.legend.div.style.display == 'flex') this.legend.div.style.display = 'none'
                if (this.toolBox) {
                    this.toolBox.div.style.display = 'none';
                }
            }
            else {
                // this.legend.div.style.display = 'flex'
                if (this.toolBox) {
                    this.toolBox.div.style.display = 'flex';
                }
            }
        }
        primitives = new Map(); // Map of plugin primitive instances by series name
        _createChart() {
            return lightweightCharts.createChart(this.div, {
                width: window.innerWidth * this.scale.width,
                height: window.innerHeight * this.scale.height,
                layout: {
                    textColor: window.pane.color,
                    background: {
                        color: '#000000',
                        type: lightweightCharts.ColorType.Solid,
                    },
                    fontSize: 12
                },
                rightPriceScale: {
                    scaleMargins: { top: 0.3, bottom: 0.25 },
                },
                timeScale: { timeVisible: true, secondsVisible: false },
                crosshair: {
                    mode: lightweightCharts.CrosshairMode.Normal,
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
            });
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
        createLineSeries(name, options) {
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
            const legendItem = {
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
        createHistogramSeries(name, options) {
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
            const legendItem = {
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
        createAreaSeries(name, options) {
            const { group, legendSymbol = "▨", ...areaOptions } = options;
            const area = this.chart.addAreaSeries(areaOptions);
            const decorated = decorateSeries(area, this.legend);
            this._seriesList.push(decorated);
            this.seriesMap.set(name, decorated);
            const color = decorated.options().lineColor || "rgba(255,0,0,1)";
            const solidColor = color.startsWith("rgba")
                ? color.replace(/[^,]+(?=\))/, "1")
                : color;
            const legendItem = {
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
        createBarSeries(name, options) {
            const { group, legendSymbol = ["▨", "▨"], ...barOptions } = options;
            const bar = this.chart.addBarSeries(barOptions);
            const decorated = decorateSeries(bar, this.legend);
            decorated.applyOptions({ title: name });
            this._seriesList.push(decorated);
            this.seriesMap.set(name, decorated);
            const upColor = decorated.options().upColor || "rgba(0,255,0,1)";
            const downColor = decorated.options().downColor || "rgba(255,0,0,1)";
            const legendItem = {
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
        createCustomOHLCSeries(name, options = {}) {
            const seriesType = 'Ohlc';
            const mergedOptions = {
                ...ohlcdefaultOptions,
                ...options,
                seriesType,
            };
            const { group, legendSymbol = ['⑃', '⑂'], seriesType: _, chandelierSize = 1, ...filteredOptions } = mergedOptions;
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
            const legendSymbolsWithGrouping = legendSymbol.map((symbol, index) => index === legendSymbol.length - 1 && chandelierSize > 1
                ? `${symbol} (${chandelierSize})`
                : symbol);
            const legendItem = {
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
        createFillArea(name, origin, // ID or key for the origin series
        destination, // ID or key for the destination series
        originColor, // Optional; will use defaults if not provided
        destinationColor) {
            // Find origin and destination series
            const originSeries = this._seriesList.find(s => s.options()?.title === origin);
            const destinationSeries = this._seriesList.find(s => s.options()?.title === destination);
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
        attachPrimitive(lineColor, primitiveType, series, seriesName) {
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
                let primitiveInstance;
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
            }
            catch (error) {
                console.error(`Failed to attach ${primitiveType}:`, error);
            }
        }
        removeSeries(seriesName) {
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
            this.wrapper.prepend(this._topBar._div);
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
        extractSeriesData(series) {
            const seriesData = series.data(); // Ensure this retrieves the data from the series.
            if (!Array.isArray(seriesData)) {
                console.warn("Failed to extract data: series data is not in array format.");
                return [];
            }
            // Convert data into an array of arrays
            return seriesData.map((point) => [
                point.time,
                point.value || point.close || 0,
            ]);
        }
        static syncCharts(childChart, parentChart, crosshairOnly = false) {
            function crosshairHandler(chart, point) {
                //point: BarData | LineData) {
                if (!point) {
                    chart.chart.clearCrosshairPosition();
                    return;
                }
                // TODO fix any point ?
                chart.chart.setCrosshairPosition(point.value || point.close, point.time, chart.series);
                chart.legend.legendHandler(point, true);
            }
            function getPoint(series, param) {
                if (!param.time)
                    return null;
                return param.seriesData.get(series) || null;
            }
            const childTimeScale = childChart.chart.timeScale();
            const parentTimeScale = parentChart.chart.timeScale();
            const setChildRange = (timeRange) => {
                if (timeRange)
                    childTimeScale.setVisibleLogicalRange(timeRange);
            };
            const setParentRange = (timeRange) => {
                if (timeRange)
                    parentTimeScale.setVisibleLogicalRange(timeRange);
            };
            const setParentCrosshair = (param) => {
                crosshairHandler(parentChart, getPoint(childChart.series, param));
            };
            const setChildCrosshair = (param) => {
                crosshairHandler(childChart, getPoint(parentChart.series, param));
            };
            let selected = parentChart;
            function addMouseOverListener(thisChart, otherChart, thisCrosshair, otherCrosshair, thisRange, otherRange) {
                thisChart.wrapper.addEventListener('mouseover', () => {
                    if (selected === thisChart)
                        return;
                    selected = thisChart;
                    otherChart.chart.unsubscribeCrosshairMove(thisCrosshair);
                    thisChart.chart.subscribeCrosshairMove(otherCrosshair);
                    if (crosshairOnly)
                        return;
                    otherChart.chart.timeScale().unsubscribeVisibleLogicalRangeChange(thisRange);
                    thisChart.chart.timeScale().subscribeVisibleLogicalRangeChange(otherRange);
                });
            }
            addMouseOverListener(parentChart, childChart, setParentCrosshair, setChildCrosshair, setParentRange, setChildRange);
            addMouseOverListener(childChart, parentChart, setChildCrosshair, setParentCrosshair, setChildRange, setParentRange);
            parentChart.chart.subscribeCrosshairMove(setChildCrosshair);
            const parentRange = parentTimeScale.getVisibleLogicalRange();
            if (parentRange)
                childTimeScale.setVisibleLogicalRange(parentRange);
            if (crosshairOnly)
                return;
            parentChart.chart.timeScale().subscribeVisibleLogicalRangeChange(setChildRange);
        }
        static makeSearchBox(chart) {
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
            chart.commandFunctions.push((event) => {
                if (window.handlerInFocus !== chart.id || window.textBoxFocused)
                    return false;
                if (searchWindow.style.display === 'none') {
                    if (/^[a-zA-Z0-9]$/.test(event.key)) {
                        searchWindow.style.display = 'flex';
                        sBox.focus();
                        return true;
                    }
                    else
                        return false;
                }
                else if (event.key === 'Enter' || event.key === 'Escape') {
                    if (event.key === 'Enter')
                        window.callbackFunction(`search${chart.id}_~_${sBox.value}`);
                    searchWindow.style.display = 'none';
                    sBox.value = '';
                    return true;
                }
                else
                    return false;
            });
            sBox.addEventListener('input', () => sBox.value = sBox.value.toUpperCase());
            return {
                window: searchWindow,
                box: sBox,
            };
        }
        static makeSpinner(chart) {
            chart.spinner = document.createElement('div');
            chart.spinner.classList.add('spinner');
            chart.wrapper.appendChild(chart.spinner);
            // TODO below can be css (animate)
            let rotation = 0;
            const speed = 10;
            function animateSpinner() {
                if (!chart.spinner)
                    return;
                rotation += speed;
                chart.spinner.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
                requestAnimationFrame(animateSpinner);
            }
            animateSpinner();
        }
        static _styleMap = {
            '--bg-color': 'backgroundColor',
            '--hover-bg-color': 'hoverBackgroundColor',
            '--click-bg-color': 'clickBackgroundColor',
            '--active-bg-color': 'activeBackgroundColor',
            '--muted-bg-color': 'mutedBackgroundColor',
            '--border-color': 'borderColor',
            '--color': 'color',
            '--active-color': 'activeColor',
        };
        static setRootStyles(styles) {
            const rootStyle = document.documentElement.style;
            for (const [property, valueKey] of Object.entries(this._styleMap)) {
                rootStyle.setProperty(property, styles[valueKey]);
            }
        }
    }

    class Table {
        _div;
        callbackName;
        borderColor;
        borderWidth;
        table;
        rows = {};
        headings;
        widths;
        alignments;
        footer;
        header;
        constructor(width, height, headings, widths, alignments, position, draggable = false, tableBackgroundColor, borderColor, borderWidth, textColors, backgroundColors) {
            this._div = document.createElement('div');
            this.callbackName = null;
            this.borderColor = borderColor;
            this.borderWidth = borderWidth;
            if (draggable) {
                this._div.style.position = 'absolute';
                this._div.style.cursor = 'move';
            }
            else {
                this._div.style.position = 'relative';
                this._div.style.float = position;
            }
            this._div.style.zIndex = '2000';
            this.reSize(width, height);
            this._div.style.display = 'flex';
            this._div.style.flexDirection = 'column';
            // this._div.style.justifyContent = 'space-between'
            this._div.style.borderRadius = '5px';
            this._div.style.color = 'white';
            this._div.style.fontSize = '12px';
            this._div.style.fontVariantNumeric = 'tabular-nums';
            this.table = document.createElement('table');
            this.table.style.width = '100%';
            this.table.style.borderCollapse = 'collapse';
            this._div.style.overflow = 'hidden';
            this.headings = headings;
            this.widths = widths.map((width) => `${width * 100}%`);
            this.alignments = alignments;
            let head = this.table.createTHead();
            let row = head.insertRow();
            for (let i = 0; i < this.headings.length; i++) {
                let th = document.createElement('th');
                th.textContent = this.headings[i];
                th.style.width = this.widths[i];
                th.style.letterSpacing = '0.03rem';
                th.style.padding = '0.2rem 0px';
                th.style.fontWeight = '500';
                th.style.textAlign = 'center';
                if (i !== 0)
                    th.style.borderLeft = borderWidth + 'px solid ' + borderColor;
                th.style.position = 'sticky';
                th.style.top = '0';
                th.style.backgroundColor = backgroundColors.length > 0 ? backgroundColors[i] : tableBackgroundColor;
                th.style.color = textColors[i];
                row.appendChild(th);
            }
            let overflowWrapper = document.createElement('div');
            overflowWrapper.style.overflowY = 'auto';
            overflowWrapper.style.overflowX = 'hidden';
            overflowWrapper.style.backgroundColor = tableBackgroundColor;
            overflowWrapper.appendChild(this.table);
            this._div.appendChild(overflowWrapper);
            window.containerDiv.appendChild(this._div);
            if (!draggable)
                return;
            let offsetX, offsetY;
            let onMouseDown = (event) => {
                offsetX = event.clientX - this._div.offsetLeft;
                offsetY = event.clientY - this._div.offsetTop;
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            };
            let onMouseMove = (event) => {
                this._div.style.left = (event.clientX - offsetX) + 'px';
                this._div.style.top = (event.clientY - offsetY) + 'px';
            };
            let onMouseUp = () => {
                // Remove the event listeners for dragging
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
            this._div.addEventListener('mousedown', onMouseDown);
        }
        divToButton(div, callbackString) {
            div.addEventListener('mouseover', () => div.style.backgroundColor = 'rgba(60, 60, 60, 0.6)');
            div.addEventListener('mouseout', () => div.style.backgroundColor = 'transparent');
            div.addEventListener('mousedown', () => div.style.backgroundColor = 'rgba(60, 60, 60)');
            div.addEventListener('click', () => window.callbackFunction(callbackString));
            div.addEventListener('mouseup', () => div.style.backgroundColor = 'rgba(60, 60, 60, 0.6)');
        }
        newRow(id, returnClickedCell = false) {
            let row = this.table.insertRow();
            row.style.cursor = 'default';
            for (let i = 0; i < this.headings.length; i++) {
                let cell = row.insertCell();
                cell.style.width = this.widths[i];
                cell.style.textAlign = this.alignments[i];
                cell.style.border = this.borderWidth + 'px solid ' + this.borderColor;
                if (returnClickedCell) {
                    this.divToButton(cell, `${this.callbackName}_~_${id};;;${this.headings[i]}`);
                }
            }
            if (!returnClickedCell) {
                this.divToButton(row, `${this.callbackName}_~_${id}`);
            }
            this.rows[id] = row;
        }
        deleteRow(id) {
            this.table.deleteRow(this.rows[id].rowIndex);
            delete this.rows[id];
        }
        clearRows() {
            let numRows = Object.keys(this.rows).length;
            for (let i = 0; i < numRows; i++)
                this.table.deleteRow(-1);
            this.rows = {};
        }
        _getCell(rowId, column) {
            return this.rows[rowId].cells[this.headings.indexOf(column)];
        }
        updateCell(rowId, column, val) {
            this._getCell(rowId, column).textContent = val;
        }
        styleCell(rowId, column, styleAttribute, value) {
            const style = this._getCell(rowId, column).style;
            style[styleAttribute] = value;
        }
        makeSection(id, type, numBoxes, func = false) {
            let section = document.createElement('div');
            section.style.display = 'flex';
            section.style.width = '100%';
            section.style.padding = '3px 0px';
            section.style.backgroundColor = 'rgb(30, 30, 30)';
            type === 'footer' ? this._div.appendChild(section) : this._div.prepend(section);
            const textBoxes = [];
            for (let i = 0; i < numBoxes; i++) {
                let textBox = document.createElement('div');
                section.appendChild(textBox);
                textBox.style.flex = '1';
                textBox.style.textAlign = 'center';
                if (func) {
                    this.divToButton(textBox, `${id}_~_${i}`);
                    textBox.style.borderRadius = '2px';
                }
                textBoxes.push(textBox);
            }
            if (type === 'footer') {
                this.footer = textBoxes;
            }
            else {
                this.header = textBoxes;
            }
        }
        reSize(width, height) {
            this._div.style.width = width <= 1 ? width * 100 + '%' : width + 'px';
            this._div.style.height = height <= 1 ? height * 100 + '%' : height + 'px';
        }
    }

    class SynchronizedTooltip {
        _mainChart;
        _seriesInfos = [];
        _tooltipElement;
        _options;
        _crosshairSubscriptions = new Set();
        _isEnabled = false;
        constructor(mainChart, options) {
            this._mainChart = mainChart;
            this._options = {
                displayMode: 'floating',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                textColor: '#333',
                fontFamily: 'Arial, sans-serif',
                fontSize: '12px',
                padding: '8px',
                borderColor: '#ccc',
                borderRadius: '4px',
                showOHLC: true,
                ...options,
            };
            // Create tooltip DOM element
            this._tooltipElement = document.createElement('div');
            this._applyTooltipStyles();
            document.body.appendChild(this._tooltipElement);
            // Subscribe to crosshair movement on the main chart
            this._subscribeToCrosshair(mainChart);
        }
        setEnabled(enabled) {
            this._isEnabled = enabled;
            if (!enabled) {
                this._hideTooltip();
            }
        }
        toggleVisibility() {
            this.setEnabled(!this._isEnabled);
        }
        /**
         * Add a series from a chart to be displayed in the tooltip
         */
        addSeries(chart, series, name) {
            // Extract color from series if possible
            const seriesOptions = series.options();
            let color = 'rgba(0, 0, 0, 1)';
            if ('color' in seriesOptions) {
                color = seriesOptions.color;
            }
            else if ('lineColor' in seriesOptions) {
                color = seriesOptions.lineColor;
            }
            else if ('upColor' in seriesOptions) {
                color = seriesOptions.upColor;
            }
            this._seriesInfos.push({
                chart,
                series,
                name,
                color
            });
            // Subscribe to this chart's crosshair events if we haven't already
            this._subscribeToCrosshair(chart);
        }
        _subscribeToCrosshair(chart) {
            // Only subscribe once per chart
            if (this._crosshairSubscriptions.has(chart)) {
                return;
            }
            chart.subscribeCrosshairMove(this._handleCrosshairMove);
            this._crosshairSubscriptions.add(chart);
        }
        /**
         * Remove all series from the tooltip
         */
        clearAllSeries() {
            this._seriesInfos.length = 0;
        }
        /**
         * Dispose the tooltip and clean up resources
         */
        dispose() {
            // Unsubscribe from all crosshair events
            this._crosshairSubscriptions.forEach(chart => {
                chart.unsubscribeCrosshairMove(this._handleCrosshairMove);
            });
            this._crosshairSubscriptions.clear();
            if (this._tooltipElement.parentNode) {
                this._tooltipElement.parentNode.removeChild(this._tooltipElement);
            }
        }
        _applyTooltipStyles() {
            const styles = {
                position: 'absolute',
                left: '0',
                top: '0',
                display: 'none',
                backgroundColor: this._options.backgroundColor,
                color: this._options.textColor,
                fontFamily: this._options.fontFamily,
                fontSize: this._options.fontSize,
                padding: this._options.padding,
                border: `1px solid ${this._options.borderColor}`,
                borderRadius: this._options.borderRadius,
                pointerEvents: 'none',
                zIndex: '1000',
                boxShadow: '0 2px 5px rgba(0, 0, 0, 0.2)',
                whiteSpace: 'nowrap',
                boxSizing: 'border-box'
            };
            Object.entries(styles).forEach(([key, value]) => {
                this._tooltipElement.style[key] = value || '';
            });
        }
        _handleCrosshairMove = (param) => {
            if (!this._isEnabled) {
                return;
            }
            if (!param.point || !param.time) {
                this._hideTooltip();
                return;
            }
            // Calculate common time for all series
            const time = param.time;
            const timestamp = time ? convertTime(time) : undefined;
            // Gather all series values at this time point
            const tooltipContent = [];
            // Ajouter la date/heure seulement si showDateTime est true ou non défini
            if (this._options.showDateTime !== false) {
                const [dateStr, timeStr] = formattedDateAndTime(timestamp);
                tooltipContent.push(`<div style="font-weight: bold; margin-bottom: 5px; text-align: center;">${dateStr} ${timeStr}</div>`);
            }
            let hasData = false;
            // Pour chaque série enregistrée
            this._seriesInfos.forEach(info => {
                // Vérifier si les données sont disponibles pour cette série
                let seriesData = param.seriesData.get(info.series);
                // Si les données ne sont pas disponibles directement, essayons de les récupérer
                // depuis la série en utilisant le temps actuel
                if (!seriesData && info.series) {
                    try {
                        // data est une méthode, pas une propriété - il faut l'appeler avec ()
                        const visibleData = info.series.data();
                        if (visibleData && visibleData.length > 0) {
                            // Utiliser dataByIndex pour obtenir les données
                            const timeValue = convertTime(time);
                            // Ajouter un type à 'item' pour éviter l'erreur "implicit any"
                            const dataPoint = visibleData.find((item) => {
                                const itemTime = convertTime(item.time);
                                return itemTime === timeValue;
                            });
                            if (dataPoint) {
                                seriesData = dataPoint;
                            }
                        }
                    }
                    catch (e) {
                        console.log("Error fetching series data:", e);
                    }
                }
                if (seriesData) {
                    hasData = true;
                    // Le reste du code existant pour l'affichage des valeurs...
                    if (this._options.showOHLC && 'open' in seriesData && 'high' in seriesData && 'low' in seriesData && 'close' in seriesData) ;
                    else {
                        let valueText = '';
                        if ('value' in seriesData && seriesData.value !== undefined) {
                            valueText = seriesData.value.toFixed(2);
                        }
                        else if ('close' in seriesData && seriesData.close !== undefined) {
                            valueText = seriesData.close.toFixed(2);
                        }
                        if (valueText) {
                            tooltipContent.push(`
                            <div style="display: flex; align-items: center; margin: 4px 0;">
                                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${info.color}; margin-right: 6px;"></span>
                                <span style="font-weight: bold; margin-right: 5px;">${info.name}:</span>
                                <span>${valueText}</span>
                            </div>
                        `);
                        }
                    }
                }
            });
            // Le reste du code pour l'affichage du tooltip...
            // Don't show tooltip if no data available
            if (!hasData) {
                this._hideTooltip();
                return;
            }
            // Update tooltip content
            this._tooltipElement.innerHTML = tooltipContent.join('');
            // Position the tooltip
            if (param.point) {
                const chartElement = this._mainChart.chartElement();
                if (chartElement) {
                    const chartRect = chartElement.getBoundingClientRect();
                    const left = chartRect.left + param.point.x + 15;
                    const top = chartRect.top + param.point.y - 15;
                    this._tooltipElement.style.left = `${left}px`;
                    this._tooltipElement.style.top = `${top}px`;
                }
            }
            this._tooltipElement.style.display = 'block';
        };
        _hideTooltip() {
            this._tooltipElement.style.display = 'none';
        }
    }

    class PointMarkerPaneRenderer extends DrawingPaneRenderer {
        _point;
        _hovered;
        constructor(point, options, hovered) {
            super(options);
            this._point = point;
            this._hovered = hovered;
        }
        draw(target) {
            if (this._point.x === null || this._point.y === null)
                return;
            const options = this._options;
            target.useBitmapCoordinateSpace(scope => {
                const ctx = scope.context;
                const x = Math.round((this._point.x ?? 0) * scope.horizontalPixelRatio);
                const y = Math.round((this._point.y ?? 0) * scope.verticalPixelRatio);
                // Draw the marker
                ctx.beginPath();
                const radius = options.radius * scope.horizontalPixelRatio;
                ctx.arc(x, y, radius, 0, 2 * Math.PI);
                // Fill
                ctx.fillStyle = options.fillColor;
                ctx.fill();
                // Border
                ctx.lineWidth = 1 * scope.horizontalPixelRatio;
                ctx.strokeStyle = options.lineColor;
                ctx.stroke();
                // If hovered, draw a highlight
                if (this._hovered) {
                    ctx.beginPath();
                    ctx.arc(x, y, radius + 2 * scope.horizontalPixelRatio, 0, 2 * Math.PI);
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                    ctx.lineWidth = 1 * scope.horizontalPixelRatio;
                    ctx.stroke();
                }
            });
        }
    }

    class PointMarkerPaneView extends DrawingPaneView {
        _point = { x: null, y: null };
        _source;
        constructor(source) {
            super(source);
            this._source = source;
        }
        update() {
            if (!this._source.point)
                return;
            const series = this._source.series;
            const point = this._source.point;
            const y = series.priceToCoordinate(point.price);
            let x;
            if (point.time) {
                x = this._source.chart.timeScale().timeToCoordinate(point.time);
            }
            else {
                x = this._source.chart.timeScale().logicalToCoordinate(point.logical);
            }
            this._point = { x, y };
        }
        renderer() {
            return new PointMarkerPaneRenderer(this._point, this._source._options, this._source.isHovered() // Use the public method instead
            );
        }
    }

    const defaultPointMarkerOptions = {
        ...defaultOptions$2,
        radius: 5,
        fillColor: '#000000',
    };
    class PointMarker extends Drawing {
        _type = 'PointMarker';
        constructor(point, options) {
            super({
                ...defaultPointMarkerOptions,
                ...options,
            });
            this._points.push(point);
            // We'll set the pane view after constructor to avoid circular dependency
            // this._paneViews = [new PointMarkerPaneView(this)]; 
        }
        // Add this method to be called after construction
        initializeViews() {
            this._paneViews = [new PointMarkerPaneView(this)];
        }
        get point() { return this.points[0]; }
        _onMouseDown() {
            this._moveToState(InteractionState.DRAGGING);
        }
        _onDrag(diff) {
            this._addDiffToPoint(this.points[0], diff.logical, diff.price);
            this.requestUpdate();
        }
        _moveToState(state) {
            switch (state) {
                case InteractionState.NONE:
                    document.body.style.cursor = "default";
                    this._unsubscribe("mousedown", this._handleMouseDownInteraction);
                    break;
                case InteractionState.HOVERING:
                    document.body.style.cursor = "pointer";
                    this._subscribe("mousedown", this._handleMouseDownInteraction);
                    this.chart.applyOptions({ handleScroll: true });
                    break;
                case InteractionState.DRAGGING:
                    document.body.style.cursor = "grabbing";
                    this._subscribe("mouseup", this._handleMouseUpInteraction);
                    this.chart.applyOptions({ handleScroll: false });
                    break;
            }
            this._state = state;
        }
        _mouseIsOverDrawing(param) {
            if (!param.point || !this.points[0])
                return false;
            const point = this.points[0];
            const y = this.series.priceToCoordinate(point.price);
            if (!y)
                return false;
            // Get x-coordinate from time or logical index
            let x;
            if (point.time) {
                x = this.chart.timeScale().timeToCoordinate(point.time);
            }
            else {
                x = this.chart.timeScale().logicalToCoordinate(point.logical);
            }
            if (!x)
                return false;
            // Check if mouse is over the marker (circular area)
            const options = this._options;
            const radius = options.radius;
            const tolerance = 4; // Extra pixels for easier interaction
            const dx = param.point.x - x;
            const dy = param.point.y - y;
            return (dx * dx + dy * dy) <= ((radius + tolerance) * (radius + tolerance));
        }
        // Add this method to the PointMarker class
        isHovered() {
            return this._state !== InteractionState.NONE;
        }
    }

    exports.Box = Box;
    exports.FillArea = FillArea;
    exports.Handler = Handler;
    exports.HorizontalLine = HorizontalLine;
    exports.Legend = Legend;
    exports.PointMarker = PointMarker;
    exports.RayLine = RayLine;
    exports.SynchronizedTooltip = SynchronizedTooltip;
    exports.Table = Table;
    exports.ToolBox = ToolBox;
    exports.TooltipPrimitive = TooltipPrimitive;
    exports.TopBar = TopBar;
    exports.TrendLine = TrendLine;
    exports.VerticalLine = VerticalLine;
    exports.closedEye = closedEye;
    exports.defaultFillAreaOptions = defaultFillAreaOptions;
    exports.defaultPointMarkerOptions = defaultPointMarkerOptions;
    exports.globalParamInit = globalParamInit;
    exports.ohlcSeries = ohlcSeries;
    exports.ohlcdefaultOptions = ohlcdefaultOptions;
    exports.openEye = openEye;
    exports.paneStyleDefault = paneStyleDefault;
    exports.setCursor = setCursor;

    return exports;

})({}, LightweightCharts);
//# sourceMappingURL=bundle.js.map
