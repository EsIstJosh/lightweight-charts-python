// legend.ts
import { 
    AreaData,
    BarData,
    HistogramData,
    ISeriesApi,
    ISeriesPrimitive,
    LineData,
    Logical,
    MouseEventParams,
    PriceFormatBuiltIn,
    SeriesType,
} from "lightweight-charts";
import { Handler} from "./handler";
import { LegendItem, LegendSeries, LegendGroup, openEye, closedEye, LegendPrimitive } from "./global-params";
import { ISeriesApiExtended } from "../helpers/general";

type LegendEntry = LegendSeries | LegendGroup | LegendPrimitive;

// Cache to store the last data point for each series
const lastSeriesDataCache = new Map<ISeriesApi<SeriesType>, any>();

function getLastData(series: ISeriesApi<SeriesType>) {
    return lastSeriesDataCache.get(series) || null;
}

export class Legend {
    private handler: Handler;
    public div: HTMLDivElement;
    public seriesContainer: HTMLDivElement;

    private ohlcEnabled: boolean = false;
    private percentEnabled: boolean = false;
    private linesEnabled: boolean = false;
    private colorBasedOnCandle: boolean = false;

    private text: HTMLSpanElement;
    private candle: HTMLDivElement;
    private _items: LegendEntry[] = [];
    public _lines: LegendSeries[] = [];
    public _groups: LegendGroup[] = [];

    constructor(handler: Handler) {
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

    private setupLegend() {
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

    legendItemFormat(num: number | undefined, decimal: number): string {
        if (typeof num !== 'number' || isNaN(num)) {
            return '-';  // Default display when data is missing
        }
        return num.toFixed(decimal).toString().padStart(8, ' ');
    }

    shorthandFormat(num: number): string {
        const absNum = Math.abs(num);
        return absNum >= 1000000 ? (num / 1000000).toFixed(1) + 'M' :
               absNum >= 1000 ? (num / 1000).toFixed(1) + 'K' :
               num.toString().padStart(8, ' ');
    }

    private createSvgIcon(svgContent: string): SVGElement {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = svgContent.trim();
        const svgElement = tempContainer.querySelector('svg');
        return svgElement as SVGElement;
    }

    /**
     * Adds a LegendItem to the legend, either as a standalone series or within a group.
     * @param item The LegendItem to add.
     * @returns The HTMLDivElement representing the legend entry.
     */
    addLegendItem(item: LegendItem): HTMLDivElement {
        // Ensure `item` is a series and map it to the `LegendSeries` type
        const seriesItem = this.mapToSeries(item);

        if (seriesItem.group) {
            // If the series belongs to a group, add it to the group
            return this.addItemToGroup(seriesItem, seriesItem.group);
        } else {
            // If standalone, create a series row and add it to the container
            const seriesRow = this.makeSeriesRow(seriesItem, this.seriesContainer);

            // Add the series to `_lines` for tracking
            this._lines.push(seriesItem);

            // Add to `_items` for general legend tracking
            this._items.push(seriesItem);

            return seriesRow;
        }
    }
    public addLegendPrimitive(
        series:ISeriesApi<SeriesType>| ISeriesApiExtended, 
        primitive: ISeriesPrimitive, 
        name?: string
    ): HTMLDivElement|undefined {
        const primitiveName = name || primitive.constructor.name;
    
        // Check if the parent series row exists
        const seriesEntry = this._lines.find(line => line.series === series);
        if (!seriesEntry) {
            console.warn(`Parent series not found in legend for primitive: ${primitiveName}`);
            return;
        }
    
        // Ensure the primitives container exists
        let primitivesContainer = this.seriesContainer.querySelector(
            `[data-series-id="${seriesEntry.name}"] .primitives-container`
        ) as HTMLDivElement;
        if (!primitivesContainer) {
            // Create a new container for primitives
            primitivesContainer = document.createElement('div');
            primitivesContainer.classList.add('primitives-container');
            primitivesContainer.style.display = 'none'; // Initially hidden
            primitivesContainer.style.marginLeft = '20px'; // Indentation for hierarchy
            primitivesContainer.style.flexDirection = 'column';
    
            // Insert the container below the series row
            seriesEntry.row!.insertAdjacentElement('afterend', primitivesContainer);
        }
    
        // Check if the primitive already exists in the legend
        const existingPrimitiveRow = Array.from(primitivesContainer.children).find(
            row => row.getAttribute('data-primitive-type') === primitiveName
        );
        if (existingPrimitiveRow) {
            console.warn(`Primitive "${primitiveName}" already exists under the parent series.`);
            return existingPrimitiveRow as HTMLDivElement;
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
    
    
    private togglePrimitive(primitive: ISeriesPrimitive, visible: boolean): void {
        const options = (primitive as any).options;
        if (!options) {
            console.warn("Primitive has no options to update.");
            return;
        }
    
        const transparentColor = "rgba(0,0,0,0)";
        const originalColorsKey = "_originalColors";
    
        // Initialize storage for original colors if it doesn't exist
        if (!(primitive as any)[originalColorsKey]) {
            (primitive as any)[originalColorsKey] = {};
        }
    
        const originalColors = (primitive as any)[originalColorsKey];
        const updatedOptions: Record<string, any> = {};
    
        for (const key of Object.keys(options)) {
            if (key.toLowerCase().includes("color")) {
                if (!visible) {
                    // Store the original color if we're toggling visibility off
                    if (!originalColors[key]) {
                        originalColors[key] = options[key];
                    }
                    updatedOptions[key] = transparentColor;
                } else {
                    // Restore the original color if we're toggling visibility on
                    updatedOptions[key] = originalColors[key] || options[key];
                }
            }
        }
    
        // Apply the updated options
        if (Object.keys(updatedOptions).length > 0) {
            console.log(`Updating visibility for primitive: ${primitive.constructor.name}`);
            (primitive as any).applyOptions(updatedOptions);
    
            // Clear the original colors when visibility is restored
            if (visible) {
                delete (primitive as any)[originalColorsKey];
            }
        }
    }
    
    
    public findLegendPrimitive(series: ISeriesApi<SeriesType>, primitive: ISeriesPrimitive): HTMLDivElement | null {
        const seriesRow = this._lines.find(line => line.series === series)?.row;
        if (!seriesRow) {
            return null;
        }
    
        const primitivesContainer = seriesRow.querySelector('.primitives-container');
        if (!primitivesContainer) {
            return null;
        }
    
        const primitiveType = (primitive.constructor as any).type || primitive.constructor.name;
        return Array.from(primitivesContainer.children).find(
            row => row.getAttribute('data-primitive-type') === primitiveType
        ) as HTMLDivElement | null;
    }
    
    public removeLegendPrimitive(primitive: ISeriesPrimitive): void {
        const primitiveName = (primitive.constructor as any).type || primitive.constructor.name;
        console.log(`Removing legend entry for primitive: ${primitiveName}`);
    
        // Iterate through the series container to find and remove the primitive entry
        const rows = Array.from(this.seriesContainer.children) as HTMLDivElement[];
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
private mapToSeries(item: LegendItem): LegendSeries {
    return {
        name: item.name,
        series: item.series,
        group: item.group || undefined,
        legendSymbol: item.legendSymbol || [],
        colors: item.colors || ['#000'],
        seriesType: item.seriesType || 'Line',
        div: document.createElement('div'),    // Default element
        row: document.createElement('div'),    // Default element
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
    private addItemToGroup(item: LegendSeries, groupName: string): HTMLDivElement {
        let group = this._groups.find(g => g.name === groupName);
        if (!group) {
            // Create the group and append the series row to the group's container
            return this.makeSeriesGroup(groupName, [item]);
        } else {
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
    makeSeriesGroup(groupName: string, items: LegendSeries[]): HTMLDivElement {
        let group = this._groups.find(g => g.name === groupName);

        if (group) {
            group.seriesList.push(...items);
            // Append new series to the existing group div
            items.forEach(item => this.makeSeriesRow(item, group.div));
            return group.row;
        } else {
            const newGroup: LegendGroup = {
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
    makeSeriesRow(line: LegendSeries, container: HTMLDivElement): HTMLDivElement {
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
        } else {
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
        row.appendChild(div);    // Add text/info div
        row.appendChild(toggle); // Add visibility toggle
    
        container.appendChild(row); // Append to the provided container
    
        // Prevent context menu on the row
        row.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
    
        // Create LegendSeries and store it
        const legendSeries: LegendSeries = {
            ...line,
            div,     // Assign the created div
            row,     // Assign the created row
            toggle,  // Assign the created toggle
        };
    
        this._lines.push(legendSeries);
        return row;
    }
    
    

    /**
     * Deletes a legend entry, either a standalone series or an entire group.
     * @param seriesName The name of the series to delete.
     * @param groupName The name of the group to delete or from which to delete the series.
     */
    deleteLegendEntry(seriesName?: string, groupName?: string): void {
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
            } else {
                console.warn(`Legend group with name "${groupName}" not found.`);
            }
        } else if (seriesName) {
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
                        } else {
                            // Re-render the group to update its display
                            this.renderGroup(group, this.seriesContainer);
                        }

                        // Optionally, remove the series from the chart
                        // seriesItem.series.remove();

                        removed = true;
                        console.log(`Series "${seriesName}" removed from group "${groupName}".`);
                    }
                } else {
                    console.warn(`Legend group with name "${groupName}" not found.`);
                }
            }

            if (!removed) {
                // Remove from _lines (individual legend items)
                const seriesIndex = this._lines.findIndex(series => series.name === seriesName);
                if (seriesIndex !== -1) {
                    const legendSeries = this._lines[seriesIndex];

                    // Remove the DOM elements
                    this.seriesContainer.removeChild(legendSeries.row!);

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
        } else {
            console.warn(`No seriesName or groupName provided for deletion.`);
        }
    }

    /**
     * Retrieves the group name of a given series.
     * @param series The series to find the group for.
     * @returns The name of the group, or undefined if not found.
     */
    public getGroupOfSeries(series: ISeriesApi<SeriesType>): string | undefined {
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
    private findGroupOfSeriesRecursive(group: LegendGroup, targetSeries: ISeriesApi<SeriesType>): string | undefined {
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
    moveSeriesToGroup(seriesName: string, targetGroupName: string) {
        // Find the series in _lines (standalone)
        let foundSeriesIndex = this._lines.findIndex(s => s.name === seriesName);
        let foundSeries: LegendSeries | null = null;

        if (foundSeriesIndex !== -1) {
            foundSeries = this._lines[foundSeriesIndex];
        } else {
            // If not found in _lines, search within groups
            for (const group of this._groups) {
                const idx = group.seriesList.findIndex(item => item.name === seriesName);
                if (idx !== -1) {
                    foundSeries = group.seriesList[idx] as LegendSeries;
                    // Remove from current group
                    group.seriesList.splice(idx, 1);
                    // If group becomes empty, remove it
                    if (group.seriesList.length === 0) {
                        this.seriesContainer.removeChild(group.row);
                        this._groups = this._groups.filter(g => g !== group);
                        this._items = this._items.filter(entry => entry !== group);
                        console.log(`Group "${group.name}" is empty and has been removed.`);
                    } else {
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
            this.seriesContainer.removeChild(foundSeries.row!);
            this._lines.splice(foundSeriesIndex, 1);
            this._items = this._items.filter(entry => entry !== foundSeries);
        } else {
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
        } else {
            targetGroup.seriesList.push(foundSeries);
            // Append the series row to the group's div
            this.makeSeriesRow(foundSeries, targetGroup.div);
            // No need to re-render the entire group
        }

        this._items.push(foundSeries);
        console.log(`Series "${seriesName}" moved to group "${targetGroupName}".`);
    }
    private renderGroup(group: LegendGroup, container: HTMLDivElement): void {
        // Clear old row content
        group.row.innerHTML = '';
        group.row.style.display = 'flex';
        group.row.style.flexDirection = 'column';
        group.row.style.width = '100%';
    
        // Group header
        const header = document.createElement('div');
        header.classList.add('group-header'); // Add CSS class for styling
        header.style.display = 'flex';        // Set header layout to flex
        header.style.alignItems = 'center';   // Align items vertically
        header.style.justifyContent = 'space-between'; // Space between name and toggle icon
        header.style.cursor = 'pointer';     // Make the header clickable
    
        // Group name and aggregated symbols
        const groupNameSpan = document.createElement('span');
        groupNameSpan.style.fontWeight = 'bold';
        groupNameSpan.innerHTML = group.seriesList
            .map(series => series.legendSymbol.map((symbol, index) =>
                `<span style="color: ${series.colors[index] || series.colors[0]};">${symbol}</span>`
            ).join(' '))
            .join(' ') + ` ${group.name}`;
    
        // Custom toggle button (next to the group name)
        const toggleButton = document.createElement('span');
        toggleButton.classList.add('toggle-button'); // Add CSS class for styling
        toggleButton.style.marginLeft = 'auto';      // Push button to the far right
        toggleButton.style.fontSize = '1.2em';       // Make the icon size consistent
        toggleButton.style.cursor = 'pointer';       // Indicate it’s clickable
        toggleButton.innerHTML = '⌲';               // Default expanded state
        toggleButton.setAttribute('aria-expanded', 'true'); // Accessibility
    
        toggleButton.addEventListener('click', (event) => {
            event.stopPropagation();
            if (group.div.style.display === 'none') {
                group.div.style.display = 'block';
                toggleButton.innerHTML = '⌲'; // Expanded icon
                toggleButton.setAttribute('aria-expanded', 'true');
            } else {
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
    public legendHandler(param: MouseEventParams, usingPoint = false) {
        if (!this.ohlcEnabled && !this.linesEnabled && !this.percentEnabled) return;
        const options: any = this.handler.series.options()

        if (!param.time) {
            this.candle.style.color = '#ffffff'
            this.candle.innerHTML = this.candle.innerHTML.replace(options['upColor'], '').replace(options['downColor'], '')
            return
        }
    
        let data: any;
        let logical: Logical | null = null;
    
        if (usingPoint) {
            const timeScale = this.handler.chart.timeScale();
            let coordinate = timeScale.timeToCoordinate(param.time)
            if (coordinate)
                logical = timeScale.coordinateToLogical(coordinate.valueOf())
            if (logical)
                data = this.handler.series.dataByIndex(logical.valueOf())
        }
        else {
            data = param.seriesData.get(this.handler.series);
        }
    
        this.candle.style.color = ''
        let str = '<span style="line-height: 1.8;">'
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
    private updateSeriesDisplay(param: MouseEventParams, logical: Logical | null, usingPoint: boolean) {
        if (!this._lines || !this._lines.length) {
            console.error("No lines available to update legend.");
            return;
        }
    
        this._lines.forEach((e) => {
            const data = param.seriesData.get(e.series) || getLastData(e.series);
            if (!data) {
                e.div!.innerHTML = `${e.name}: -`;
                return;
            }
    
            const seriesType = e.seriesType || 'Line';
            const priceFormat = e.series.options().priceFormat as PriceFormatBuiltIn;
    
            if (seriesType === 'Line' || seriesType === 'Area') {
                const valueData = data as LineData | AreaData;
                if (valueData.value == null) {
                    e.div!.innerHTML = `${e.name}: -`;
                    return;
                }
    
                const value = this.legendItemFormat(valueData.value, priceFormat.precision);
                e.div!.innerHTML = `
                    <span style="color: ${e.colors[0]};">${e.legendSymbol[0] || '▨'}</span> 
                    ${e.name}: ${value}`;
            } else if (seriesType === 'Bar' || seriesType === 'Candlestick' || seriesType === 'Ohlc') {
                const { open, close } = data as BarData;
                if (open == null || close == null) {
                    e.div!.innerHTML = `${e.name}: -`;
                    return;
                }
    
                const openPrice = this.legendItemFormat(open, priceFormat.precision);
                const closePrice = this.legendItemFormat(close, priceFormat.precision);
                const isUp = close > open;
                const color = isUp ? e.colors[0] : e.colors[1];
                const symbol = isUp ? e.legendSymbol[0] : e.legendSymbol[1];
    
                e.div!.innerHTML = `
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
    private updateGroupDisplay(param: MouseEventParams, logical: Logical | null, usingPoint: boolean) {
        this._groups.forEach((group) => {
            if (!this.linesEnabled) {
                group.row.style.display = 'none';
                return;
            }
            group.row.style.display = 'flex';
        
            // Iterate through each series in the group and update its display
            group.seriesList.forEach((seriesItem: LegendSeries) => {
                const data = param.seriesData.get(seriesItem.series) || getLastData(seriesItem.series);
                if (!data) {
                    seriesItem.div!.innerHTML = `${seriesItem.name}: -`;
                    return;
                }
            
                const seriesType = seriesItem.seriesType || 'Line';
                const name = seriesItem.name;
                const priceFormat = seriesItem.series.options().priceFormat as PriceFormatBuiltIn;
            
                // Check if the series type supports OHLC values
                const isOHLC = ['Bar', 'Candlestick', 'Ohlc'].includes(seriesType);
                if (isOHLC) {
                    const { open, close, high, low } = data as BarData;
                    if (open == null || close == null || high == null || low == null) {
                        seriesItem.div!.innerHTML = `${name}: -`;
                        return;
                    }
                
                    const openPrice = this.legendItemFormat(open, priceFormat.precision);
                    const closePrice = this.legendItemFormat(close, priceFormat.precision);
                    const isUp = close > open;
                    const color = isUp ? seriesItem.colors[0] : seriesItem.colors[1];
                    const symbol = isUp ? seriesItem.legendSymbol[0] : seriesItem.legendSymbol[1];
                
                    seriesItem.div!.innerHTML = `
                        <span style="color: ${color};">${symbol || '▨'}</span>
                        ${name}: 
                        <span style="color: ${color};">O ${openPrice}</span>, 
                        <span style="color: ${color};">C ${closePrice}</span>
                    `;
                } else {
                    // Handle series types with a single 'value' property
                    const valueData = data as LineData | AreaData | HistogramData;
                    const value = 'value' in valueData ? valueData.value : undefined;
                    if (value == null) {
                        seriesItem.div!.innerHTML = `${name}: -`;
                        return;
                    }
                
                    const formattedValue = this.legendItemFormat(value, priceFormat.precision);
                    const color = seriesItem.colors[0];
                    const symbol = seriesItem.legendSymbol[0] || '▨';
                
                    seriesItem.div!.innerHTML = `
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
    private findGroup(groupName: string, groups: LegendGroup[] = this._groups): LegendGroup | undefined {
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
