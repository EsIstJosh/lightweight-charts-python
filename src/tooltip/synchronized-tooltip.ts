import { IChartApi, MouseEventParams, ISeriesApi, Time } from 'lightweight-charts';
import { convertTime, formattedDateAndTime } from '../helpers/time';

export interface SeriesInfo {
    chart: IChartApi;
    series: ISeriesApi<any>;
    name: string;
    color?: string;
}

export interface SynchronizedTooltipOptions {
    displayMode?: 'floating' | 'fixed';
    backgroundColor?: string;
    textColor?: string;
    fontFamily?: string;
    fontSize?: string;
    padding?: string;
    borderColor?: string;
    borderRadius?: string;
    showOHLC?: boolean;
    showDateTime?: boolean; // Nouvelle option pour contrôler l'affichage de la date/heure
}

export class SynchronizedTooltip {
    private readonly _mainChart: IChartApi;
    private readonly _seriesInfos: SeriesInfo[] = [];
    private readonly _tooltipElement: HTMLDivElement;
    private readonly _options: SynchronizedTooltipOptions;
    private readonly _crosshairSubscriptions: Set<IChartApi> = new Set();
    private _isEnabled: boolean = false;
    

    constructor(mainChart: IChartApi, options?: SynchronizedTooltipOptions) {
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

    public setEnabled(enabled: boolean): void {
        this._isEnabled = enabled;
        if (!enabled) {
            this._hideTooltip();
        }
    }
    public toggleVisibility(): void {
        this.setEnabled(!this._isEnabled);
    }


    /**
     * Add a series from a chart to be displayed in the tooltip
     */
    public addSeries(chart: IChartApi, series: ISeriesApi<any>, name: string): void {
        // Extract color from series if possible
        const seriesOptions = series.options();
        let color = 'rgba(0, 0, 0, 1)';
        
        if ('color' in seriesOptions) {
            color = seriesOptions.color as string;
        } else if ('lineColor' in seriesOptions) {
            color = seriesOptions.lineColor as string;
        } else if ('upColor' in seriesOptions) {
            color = seriesOptions.upColor as string;
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

    private _subscribeToCrosshair(chart: IChartApi): void {
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
    public clearAllSeries(): void {
        this._seriesInfos.length = 0;
    }

    /**
     * Dispose the tooltip and clean up resources
     */
    public dispose(): void {
        // Unsubscribe from all crosshair events
        this._crosshairSubscriptions.forEach(chart => {
            chart.unsubscribeCrosshairMove(this._handleCrosshairMove);
        });
        this._crosshairSubscriptions.clear();
        
        if (this._tooltipElement.parentNode) {
            this._tooltipElement.parentNode.removeChild(this._tooltipElement);
        }
    }

    private _applyTooltipStyles(): void {
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
            this._tooltipElement.style[key as any] = value || '';
        });
    }

    private _handleCrosshairMove = (param: MouseEventParams): void => {
        if (!this._isEnabled) {
            return;
        }

        if (!param.point || !param.time) {
            this._hideTooltip();
            return;
        }
    
        // Calculate common time for all series
        const time = param.time as Time;
        const timestamp = time ? convertTime(time) : undefined;
        
        // Gather all series values at this time point
        const tooltipContent: string[] = [];
        
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
                        const dataPoint = visibleData.find((item: { time: Time }) => {
                            const itemTime = convertTime(item.time);
                            return itemTime === timeValue;
                        });                        
                        if (dataPoint) {
                            seriesData = dataPoint;
                        }
                    }
                } catch (e) {
                    console.log("Error fetching series data:", e);
                }
            }
    
            if (seriesData) {
                hasData = true;
                
                // Le reste du code existant pour l'affichage des valeurs...
                if (this._options.showOHLC && 'open' in seriesData && 'high' in seriesData && 'low' in seriesData && 'close' in seriesData) {
                    // Code pour les données OHLC...
                } else {
                    let valueText = '';
                    
                    if ('value' in seriesData && seriesData.value !== undefined) {
                        valueText = seriesData.value.toFixed(2);
                    } else if ('close' in seriesData && seriesData.close !== undefined) {
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
    }

    private _hideTooltip(): void {
        this._tooltipElement.style.display = 'none';
    }
}