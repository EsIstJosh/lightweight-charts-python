import {
	DataChangedScope,
	IChartApi,
	ISeriesApi,
	ISeriesPrimitive,
	SeriesAttachedParameter,
	SeriesOptionsMap,
	Time,
} from 'lightweight-charts';
import { ensureDefined } from './helpers/assertions';
import { PluginRegistry } from './helpers/general';

//* PluginBase is a useful base to build a plugin upon which
//* already handles creating getters for the chart and series,
//* and provides a requestUpdate method.
export abstract class PluginBase implements ISeriesPrimitive<Time> {
	private _chart: IChartApi | undefined = undefined;
	private _series: ISeriesApi<keyof SeriesOptionsMap> | undefined = undefined;

	protected dataUpdated?(scope: DataChangedScope): void;
	protected requestUpdate(): void {
		if (this._requestUpdate) this._requestUpdate();
	}
	private _requestUpdate?: () => void;

	public attached({
		chart,
		series,
		requestUpdate,
	}: SeriesAttachedParameter<Time>) {
		this._chart = chart;
		this._series = series;
		this._series.subscribeDataChanged(this._fireDataUpdated);
		this._requestUpdate = requestUpdate;
		this.requestUpdate();
	}

	public detached() {
		this._chart = undefined;
		this._series = undefined;
		this._requestUpdate = undefined;
	}

	public get chart(): IChartApi {
		return ensureDefined(this._chart);
	}

	public get series(): ISeriesApi<keyof SeriesOptionsMap> {
		return ensureDefined(this._series);
	}

	private _fireDataUpdated(scope: DataChangedScope) {
		if (this.dataUpdated) {
			this.dataUpdated(scope);
		}
	}
  /**
   * Serializes the plugin state.
   * Default implementation returns an empty object.
   * Subclasses should override this method to export any relevant state.
   *
   * @returns A JSON-compatible representation of the plugin state.
   */
  public toJSON(): any {
    return {};
  }

  /**
   * Restores the plugin state from the provided JSON.
   * Default implementation does nothing.
   * Subclasses should override this method to restore their state.
   *
   * @param json - The JSON object representing the plugin state.
   */
  public fromJSON(json: any): void {
    // Default implementation: do nothing.
  }
}
