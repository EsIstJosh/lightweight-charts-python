import asyncio
import json
import os
from base64 import b64decode
from datetime import datetime
from typing import Callable, Union, Literal, List, Optional, Any
import pandas as pd
from webview.errors import JavascriptException
import shutil
from typing import Optional
from .table import Table
from .toolbox import ToolBox
from .drawings import Box, HorizontalLine, RayLine, TrendLine, TwoPointDrawing, VerticalLine, VerticalSpan
from .topbar import TopBar
from .util import (
    BulkRunScript, Pane, Events, IDGen, as_enum, jbool, js_json, TIME, NUM, FLOAT,
    LINE_STYLE, MARKER_POSITION, MARKER_SHAPE, CANDLE_SHAPE, CROSSHAIR_MODE,
    PRICE_SCALE_MODE, marker_position, marker_shape, js_data,
)

current_dir = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(current_dir, 'js', 'index.html')


class Window:
    _id_gen = IDGen()
    handlers = {}

    def __init__(
        self,
        script_func: Optional[Callable] = None,
        js_api_code: Optional[str] = None,
        run_script: Optional[Callable] = None
    ):
        self.loaded = False
        self.script_func = script_func
        self.scripts = []
        self.final_scripts = []
        self.bulk_run = BulkRunScript(script_func)

        if run_script:
            self.run_script = run_script

        if js_api_code:
            self.run_script(f'window.callbackFunction = {js_api_code}')

    def on_js_load(self):
        if self.loaded:
            return
        self.loaded = True

        if hasattr(self, '_return_q'):
            while not self.run_script_and_get('document.readyState == "complete"'):
                continue    # scary, but works

        initial_script = ''
        self.scripts.extend(self.final_scripts)
        for script in self.scripts:
            initial_script += f'\n{script}'
        self.script_func(initial_script)

    def run_script(self, script: str, run_last: bool = False):
        """
        For advanced users; evaluates JavaScript within the Webview.
        """
        if self.script_func is None:
            raise AttributeError("script_func has not been set")
        if self.loaded:
            if self.bulk_run.enabled:
                self.bulk_run.add_script(script)
            else:
                self.script_func(script)
        elif run_last:
            self.final_scripts.append(script)
        else:
            self.scripts.append(script)

    def run_script_and_get(self, script: str):
        self.run_script(f'_~_~RETURN~_~_{script}')
        return self._return_q.get()

    def create_table(
        self,
        width: NUM,
        height: NUM,
        headings: tuple,
        widths: Optional[tuple] = None,
        alignments: Optional[tuple] = None,
        position: FLOAT = 'left',
        draggable: bool = False,
        background_color: str = '#121417',
        border_color: str = 'rgb(70, 70, 70)',
        border_width: int = 1,
        heading_text_colors: Optional[tuple] = None,
        heading_background_colors: Optional[tuple] = None,
        return_clicked_cells: bool = False,
        func: Optional[Callable] = None
    ) -> 'Table':
        return Table(*locals().values())

    def create_subchart(
        self,
        position: FLOAT = 'left',
        width: float = 0.5,
        height: float = 0.5,
        sync_id: Optional[str] = None,
        scale_candles_only: bool = False,
        sync_crosshairs_only: bool = False,
        toolbox: bool = False
    ) -> 'AbstractChart':
        subchart = AbstractChart(
            self,
            width,
            height,
            scale_candles_only,
            toolbox,
            position=position
        )
        if not sync_id:
            return subchart
        self.run_script(f'''
            Lib.Handler.syncCharts(
                {subchart.id},
                {sync_id},
                {jbool(sync_crosshairs_only)}
            )
        ''', run_last=True)
        return subchart

    def style(
        self,
        background_color: str = '#0c0d0f',
        hover_background_color: str = '#3c434c',
        click_background_color: str = '#50565E',
        active_background_color: str = 'rgba(0, 122, 255, 0.7)',
        muted_background_color: str = 'rgba(0, 122, 255, 0.3)',
        border_color: str = '#3C434C',
        color: str = '#d8d9db',
        active_color: str = '#ececed'
    ):
        self.run_script(f'Lib.Handler.setRootStyles({js_json(locals())});')


class SeriesCommon(Pane):
    def __init__(self, chart: 'AbstractChart', name: str = ''):
        super().__init__(chart.win)
        self._chart = chart
        if hasattr(chart, '_interval'):
            self._interval = chart._interval
        else:
            self._interval = 1
        self._last_bar = None
        self.name = name
        self.num_decimals = 2
        self.offset = 0
        self.data = pd.DataFrame()
        self.markers = {}

    def _set_interval(self, df: pd.DataFrame):
        if not pd.api.types.is_datetime64_any_dtype(df['time']):
            df['time'] = pd.to_datetime(df['time'])
        common_interval = df['time'].diff().value_counts()
        if common_interval.empty:
            return
        self._interval = common_interval.index[0].total_seconds()

        units = [
            pd.Timedelta(microseconds=df['time'].dt.microsecond.value_counts().index[0]),
            pd.Timedelta(seconds=df['time'].dt.second.value_counts().index[0]),
            pd.Timedelta(minutes=df['time'].dt.minute.value_counts().index[0]),
            pd.Timedelta(hours=df['time'].dt.hour.value_counts().index[0]),
            pd.Timedelta(days=df['time'].dt.day.value_counts().index[0]),
        ]
        self.offset = 0
        for value in units:
            value = value.total_seconds()
            if value == 0:
                continue
            elif value >= self._interval:
                break
            self.offset = value
            break

    @staticmethod
    def _format_labels(data, labels, index, exclude_lowercase):
        def rename(la, mapper):
            return [mapper[key] if key in mapper else key for key in la]
        if 'date' not in labels and 'time' not in labels:
            labels = labels.str.lower()
            if exclude_lowercase:
                labels = rename(labels, {exclude_lowercase.lower(): exclude_lowercase})
        if 'date' in labels:
            labels = rename(labels, {'date': 'time'})
        elif 'time' not in labels:
            data['time'] = index
            labels = [*labels, 'time']
        return labels

    def _df_datetime_format(self, df: pd.DataFrame, exclude_lowercase=None):
        df = df.copy()
        df.columns = self._format_labels(df, df.columns, df.index, exclude_lowercase)
        self._set_interval(df)
        if not pd.api.types.is_datetime64_any_dtype(df['time']):
            df['time'] = pd.to_datetime(df['time'])
        df['time'] = df['time'].astype('int64') // 10 ** 9
        return df

    def _series_datetime_format(self, series: pd.Series, exclude_lowercase=None):
        series = series.copy()
        series.index = self._format_labels(series, series.index, series.name, exclude_lowercase)
        series['time'] = self._single_datetime_format(series['time'])
        return series

    def _single_datetime_format(self, arg) -> float:
        if isinstance(arg, (str, int, float)) or not pd.api.types.is_datetime64_any_dtype(arg):
            try:
                arg = pd.to_datetime(arg, unit='ms')
            except ValueError:
                arg = pd.to_datetime(arg)
        arg = self._interval * (arg.timestamp() // self._interval)+self.offset
        return arg

    def set(self, df: Optional[pd.DataFrame] = None, format_cols: bool = True):
        if df is None or df.empty:
            self.run_script(f'{self.id}.series.setData([])')
            self.data = pd.DataFrame()
            return
        if format_cols:
            df = self._df_datetime_format(df, exclude_lowercase=self.name)
        if self.name:
            if self.name not in df:
                raise NameError(f'No column named "{self.name}".')
            df = df.rename(columns={self.name: 'value'})
        self.data = df.copy()
        self._last_bar = df.iloc[-1]
        self.run_script(f'{self.id}.series.setData({js_data(df)}); ')

    def update(self, series: pd.Series):
        series = self._series_datetime_format(series, exclude_lowercase=self.name)
        if self.name in series.index:
            series.rename({self.name: 'value'}, inplace=True)
        if self._last_bar is not None and series['time'] != self._last_bar['time']:
            self.data.loc[self.data.index[-1]] = self._last_bar
            self.data = pd.concat([self.data, series.to_frame().T], ignore_index=True)
        self._last_bar = series
        self.run_script(f'{self.id}.series.update({js_data(series)})')

    def _init_markers(self):
        """
        Creates a markers primitive once for this series,
        stored at `series.markers`.
        
        In the JS code, you need something like:
          import { createSeriesMarkers } from 'lightweight-charts';
        
        Then we do:
          series.markers = createSeriesMarkers(series, []);
        """
        self.run_script(f"""
            if (!{self.id}.series.markers) {{
                {self.id}.series.markers = createSeriesMarkers({self.id}.series, []);
            }}
        """)

    def _update_markers(self):
        """
        Replaces the old call '{self.id}.series.setMarkers(...)'
        with the new v5 call:
          '{self.id}.series.markers.setMarkers(...)'
        """
        markers_list = list(self.markers.values())  # from your Python dict
        markers_json = json.dumps(markers_list)
        self.run_script(f"""
            {self.id}.series.markers.setMarkers({markers_json});
        """)

    # ============ Everything else is mostly unchanged ============

    def marker_list(self, markers: list):
        """
        Creates multiple markers.
        `markers` is a list of dicts, for example:
          [
              {"time": "2021-01-21", "position": "below", "shape": "circle", "color": "#2196F3", "text": ""},
              ...
          ]
        Returns a list of new marker IDs.
        """
        markers = markers.copy()
        marker_ids = []
        for marker in markers:
            marker_id = self.win._id_gen.generate()
            self.markers[marker_id] = {
                "time": self._single_datetime_format(marker['time']),
                "position": marker_position(marker['position']),
                "color": marker['color'],
                "shape": marker_shape(marker['shape']),
                "text": marker['text'],
            }
            marker_ids.append(marker_id)
        self._update_markers()
        return marker_ids

    def marker(self,
               time: Optional[datetime] = None,
               position: str = 'below',
               shape: str = 'arrow_up',
               color: str = '#2196F3',
               text: str = '') -> str:
        """
        Creates a new marker.
        If no `time` is given, places it at the last bar.
        Returns the newly generated marker ID.
        """
        try:
            formatted_time = self._last_bar['time'] if not time else self._single_datetime_format(time)
        except TypeError:
            raise TypeError('Chart marker created before data was set.')
        marker_id = self.win._id_gen.generate()

        self.markers[marker_id] = {
            "time": formatted_time,
            "position": marker_position(position),
            "color": color,
            "shape": marker_shape(shape),
            "text": text,
        }
        self._update_markers()
        return marker_id

    def remove_marker(self, marker_id: str):
        """
        Removes the marker with the given id.
        """
        self.markers.pop(marker_id, None)
        self._update_markers()

    def clear_markers(self):
        """
        Clears all markers from this series.
        """
        self.markers.clear()
        self._update_markers()

    def horizontal_line(self, price: NUM, color: str = 'rgb(122, 146, 202)', width: int = 2,
                        style: LINE_STYLE = 'solid', text: str = '', axis_label_visible: bool = True,
                        func: Optional[Callable] = None
                        ) -> 'HorizontalLine':
        """
        Creates a horizontal line at the given price.
        """
        return HorizontalLine(self, price, color, width, style, text, axis_label_visible, func)

    def trend_line(
        self,
        start_time: TIME,
        start_value: NUM,
        end_time: TIME,
        end_value: NUM,
        round: bool = False,
        line_color: str = '#1E80F0',
        width: int = 2,
        style: LINE_STYLE = 'solid',
    ) -> TwoPointDrawing:
        return TrendLine(*locals().values())

    def box(
        self,
        start_time: TIME,
        start_value: NUM,
        end_time: TIME,
        end_value: NUM,
        round: bool = False,
        color: str = '#1E80F0',
        fill_color: str = 'rgba(255, 255, 255, 0.2)',
        width: int = 2,
        style: LINE_STYLE = 'solid',
    ) -> TwoPointDrawing:
        return Box(*locals().values())

    def ray_line(
        self,
        start_time: TIME,
        value: NUM,
        round: bool = False,
        color: str = '#1E80F0',
        width: int = 2,
        style: LINE_STYLE = 'solid',
        text: str = ''
    ) -> RayLine:
    # TODO
        return RayLine(*locals().values())

    def vertical_line(
        self,
        time: TIME,
        color: str = '#1E80F0',
        width: int = 2,
        style: LINE_STYLE ='solid',
        text: str = ''
    ) -> VerticalLine:
        return VerticalLine(*locals().values())

    def clear_markers(self):
        """
        Clears the markers displayed on the data.\n
        """
        self.markers.clear()
        self._update_markers()

    def price_line(self, label_visible: bool = True, line_visible: bool = True, title: str = ''):
        self.run_script(f'''
        {self.id}.series.applyOptions({{
            lastValueVisible: {jbool(label_visible)},
            priceLineVisible: {jbool(line_visible)},
            title: '{title}',
        }})''')

    def precision(self, precision: int):
        """
        Sets the precision and minMove.\n
        :param precision: The number of decimal places.
        """
        min_move = 1 / (10**precision)
        self.run_script(f'''
        {self.id}.series.applyOptions({{
            priceFormat: {{precision: {precision}, minMove: {min_move}}}
        }})''')
        self.num_decimals = precision

    def hide_data(self):
        self._toggle_data(False)

    def show_data(self):
        self._toggle_data(True)

    def _toggle_data(self, arg):
        self.run_script(f'''
        {self.id}.series.applyOptions({{visible: {jbool(arg)}}})
        if ('volumeSeries' in {self.id}) {self.id}.volumeSeries.applyOptions({{visible: {jbool(arg)}}})
        ''')

    def vertical_span(
        self,
        start_time: Union[TIME, tuple, list],
        end_time: Optional[TIME] = None,
        color: str = 'rgba(252, 219, 3, 0.2)',
        round: bool = False
    ):
        """
        Creates a vertical line or span across the chart.\n
        Start time and end time can be used together, or end_time can be
        omitted and a single time or a list of times can be passed to start_time.
        """
        if round:
            start_time = self._single_datetime_format(start_time)
            end_time = self._single_datetime_format(end_time) if end_time else None
        return VerticalSpan(self, start_time, end_time, color)


class Line(SeriesCommon):
    def __init__(
            self, chart, name, color, style, width, price_line, price_label, 
            group, legend_symbol, price_scale_id, crosshair_marker=True):
        super().__init__(chart, name)
        self.color = color
        self.group = group  # Store group for legend grouping
        self.legend_symbol = legend_symbol  # Store the legend symbol

        # Initialize series with configuration options
        self.run_script(f'''
            {self.id} = {self._chart.id}.createLineSeries(
                "{name}",
                {{
                    group: '{group}',
                    color: '{color}',
                    lineStyle: {as_enum(style, LINE_STYLE)},
                    lineWidth: {width},
                    lastValueVisible: {jbool(price_label)},
                    priceLineVisible: {jbool(price_line)},
                    crosshairMarkerVisible: {jbool(crosshair_marker)},
                    legendSymbol: '{legend_symbol}',
                    priceScaleId: {f'"{price_scale_id}"' if price_scale_id else 'undefined'}
                    {"""autoscaleInfoProvider: () => ({
                            priceRange: {
                                minValue: 1_000_000_000,
                                maxValue: 0,
                            },
                        }),
                    """ if chart._scale_candles_only else ''}
                }}
            )
        null''')

    def delete(self):
        """
        Irreversibly deletes the line, as well as the object that contains the line.
        """
        self._chart._lines.remove(self) if self in self._chart._lines else None
        self.run_script(f'''
            {self.id}legendItem = {self._chart.id}.legend._lines.find((line) => line.series == {self.id}.series)
            {self._chart.id}.legend._lines = {self._chart.id}.legend._lines.filter((item) => item != {self.id}legendItem)

            if ({self.id}legendItem) {{
                {self._chart.id}.legend.div.removeChild({self.id}legendItem.row)
            }}

            {self._chart.id}.chart.removeSeries({self.id}.series)
            delete {self.id}legendItem
            delete {self.id}
        ''')
class Symbols(SeriesCommon):
    """
    Represents a custom Symbol series, compatible with the createSymbolSeries JS method.
    """

    SYMBOL_MAP = {
        'circle': '●',
        'circles': '●',
        'cross': '✚',
        'triangleUp': '▲',
        'triangleDown': '▼',
        'arrowUp': '↑',
        'arrowDown': '↓'
    }

    def __init__(
        self,
        chart,
        name: str,
        color: str,
        shape: str,
        group: str,
        legend_symbol: str = None,
        price_scale_id: str = None,
        crosshair_marker: bool = True,
        price_line: bool = False,
        price_label: bool = False,
    ):
        """
        Initializes a Symbol series with configuration options.

        :param chart: The parent chart instance.
        :param name: Series title.
        :param color: Color of symbols.
        :param shape: Shape of the symbols (circle, cross, triangleUp, triangleDown, arrowUp, arrowDown).
        :param group: Legend group identifier.
        :param legend_symbol: Optional custom legend symbol; defaults to mapped shape symbol.
        :param price_scale_id: Optional price scale ID.
        :param crosshair_marker: Whether to display crosshair markers.
        :param price_line: Whether to display the price line.
        :param price_label: Whether to display the price label.
        """
        super().__init__(chart, name)
        self.color = color
        self.group = group
        self.shape = shape
        self.legend_symbol = legend_symbol or self.SYMBOL_MAP.get(shape, shape)

        self.run_script(f'''
            {self.id} = {self._chart.id}.createSymbolSeries(
                "{name}",
                {{
                    group: '{group}',
                    color: '{color}',
                    shape: '{shape}',
                    crosshairMarkerVisible: {str(crosshair_marker).lower()},
                    priceLineVisible: {str(price_line).lower()},
                    lastValueVisible: {str(price_label).lower()},
                    legendSymbol: '{self.legend_symbol}',
                    priceScaleId: {f'"{price_scale_id}"' if price_scale_id else 'undefined'}
                    {"""autoscaleInfoProvider: () => ({
                            priceRange: {
                                minValue: 1_000_000_000,
                                maxValue: 0,
                            },
                        }),""" if chart._scale_candles_only else ''}
                }}
            );
            null;
        ''')

    def delete(self):
        """
        Irreversibly deletes the symbol series, removing it from the chart and legend.
        """
        if self in self._chart._lines:
            self._chart._lines.remove(self)

        self.run_script(f'''
            const legendItem = {self._chart.id}.legend._lines.find(
                (line) => line.series === {self.id}.series
            );

            if (legendItem) {{
                {self._chart.id}.legend.div.removeChild(legendItem.row);
                {self._chart.id}.legend._lines = {self._chart.id}.legend._lines.filter(
                    (item) => item !== legendItem
                );
            }}

            {self._chart.id}.chart.removeSeries({self.id}.series);
            delete legendItem;
            delete {self.id};
        ''')


class Histogram(SeriesCommon):
    def __init__(
            self, chart, name, color, price_line, price_label, group, legend_symbol, scale_margin_top, scale_margin_bottom):
        super().__init__(chart, name)
        self.color = color
        self.group = group  # Store group for legend grouping
        self.legend_symbol = legend_symbol  # Store legend symbol

        self.run_script(f'''
        {self.id} = {chart.id}.createHistogramSeries(
            "{name}",
            {{
                group: '{group}',
                color: '{color}',
                lastValueVisible: {jbool(price_label)},
                priceLineVisible: {jbool(price_line)},
                legendSymbol: '{legend_symbol}',
                priceScaleId: '{self.id}',
                priceFormat: {{type: "volume"}}
            }},
            // precision: 2,
        )
        {self.id}.series.priceScale().applyOptions({{
            scaleMargins: {{top:{scale_margin_top}, bottom: {scale_margin_bottom}}}
        }})''')

    def delete(self):
        """
        Irreversibly deletes the histogram.
        """
        self.run_script(f'''
            {self.id}legendItem = {self._chart.id}.legend._lines.find((line) => line.series == {self.id}.series)
            {self._chart.id}.legend._lines = {self._chart.id}.legend._lines.filter((item) => item != {self.id}legendItem)

            if ({self.id}legendItem) {{
                {self._chart.id}.legend.div.removeChild({self.id}legendItem.row)
            }}

            {self._chart.id}.chart.removeSeries({self.id}.series)
            delete {self.id}legendItem
            delete {self.id}
        ''')

    def scale(self, scale_margin_top: float = 0.0, scale_margin_bottom: float = 0.0):
        self.run_script(f'''
        {self.id}.series.priceScale().applyOptions({{
            scaleMargins: {{top: {scale_margin_top}, bottom: {scale_margin_bottom}}}
        }})''')



class Area(SeriesCommon):
    def __init__(
            self, chart, name, top_color, bottom_color, invert, line_color,
            style, width, price_line, price_label, group, legend_symbol, price_scale_id, crosshair_marker=True):
        super().__init__(chart, name) 
        self.color = line_color
        self.topColor = top_color
        self.bottomColor = bottom_color
        self.group = group  # Store group for legend grouping
        self.legend_symbol = legend_symbol  # Store legend symbol

        self.run_script(f'''
            {self.id} = {self._chart.id}.createAreaSeries(
                "{name}",
                {{
                    group: '{group}',
                    topColor: '{top_color}',
                    bottomColor: '{bottom_color}',
                    invertFilledArea: {jbool(invert)},
                    color: '{line_color}',
                    lineColor: '{line_color}',
                    lineStyle: {as_enum(style, LINE_STYLE)},
                    lineWidth: {width},
                    lastValueVisible: {jbool(price_label)},
                    priceLineVisible: {jbool(price_line)},
                    crosshairMarkerVisible: {jbool(crosshair_marker)},
                    legendSymbol: '{legend_symbol}',
                    priceScaleId: {f'"{price_scale_id}"' if price_scale_id else 'undefined'}
                    {"""autoscaleInfoProvider: () => ({
                            priceRange: {
                                minValue: 1_000_000_000,
                                maxValue: 0,
                            },
                        }),
                    """ if chart._scale_candles_only else ''}
                }}
            )
        null''')
    def delete(self):
        """
        Irreversibly deletes the line, as well as the object that contains the line.
        """
        self._chart._lines.remove(self) if self in self._chart._lines else None
        self.run_script(f'''
            {self.id}legendItem = {self._chart.id}.legend._lines.find((line) => line.series == {self.id}.series)
            {self._chart.id}.legend._lines = {self._chart.id}.legend._lines.filter((item) => item != {self.id}legendItem)

            if ({self.id}legendItem) {{
                {self._chart.id}.legend.div.removeChild({self.id}legendItem.row)
            }}

            {self._chart.id}.chart.removeSeries({self.id}.series)
            delete {self.id}legendItem
            delete {self.id}
        ''')


class Bar(SeriesCommon):
    def __init__(
            self, chart, name, up_color, down_color, open_visible, thin_bars,
            price_line, price_label, group, legend_symbol, price_scale_id):
        super().__init__(chart, name)
        self.up_color = up_color
        self.down_color = down_color
        self.group = group  # Store group for legend grouping
        self.legend_symbol = legend_symbol if isinstance(legend_symbol, list) else [legend_symbol, legend_symbol]  # Store legend symbols

        self.run_script(f'''
        {self.id} = {chart.id}.createBarSeries(
            "{name}",
            {{
                group: '{group}',
                color: '{up_color}',
                upColor: '{up_color}',
                downColor: '{down_color}',
                openVisible: {jbool(open_visible)},
                thinBars: {jbool(thin_bars)},
                lastValueVisible: {jbool(price_label)},
                priceLineVisible: {jbool(price_line)},
                legendSymbol: {json.dumps(self.legend_symbol)},
                priceScaleId: {f'"{price_scale_id}"' if price_scale_id else 'undefined'}
            }}
            
        )''')
    def set(self, df: Optional[pd.DataFrame] = None):
        if df is None or df.empty:
            self.run_script(f'{self.id}.series.setData([])')
            self.candle_data = pd.DataFrame()
            return
        df = self._df_datetime_format(df)
        self.data = df.copy()
        self._last_bar = df.iloc[-1]
        self.run_script(f'{self.id}.series.setData({js_data(df)})')

    def update(self, series: pd.Series, _from_tick=False):
        """
        Updates the data from a bar;
        if series['time'] is the same time as the last bar, the last bar will be overwritten.\n
        :param series: labels: date/time, open, high, low, close, volume (if using volume).
        """
        series = self._series_datetime_format(series) if not _from_tick else series
        if series['time'] != self._last_bar['time']:
            self.data.loc[self.data.index[-1]] = self._last_bar
            self.data = pd.concat([self.data, series.to_frame().T], ignore_index=True)
            self._chart.events.new_bar._emit(self)

        self._last_bar = series
        self.run_script(f'{self.id}.series.update({js_data(series)})')
    def delete(self):
        """
        Irreversibly deletes the bar series.
        """
        self.run_script(f'''
            {self.id}legendItem = {self._chart.id}.legend._lines.find((line) => line.series == {self.id}.series)
            {self._chart.id}.legend._lines = {self._chart.id}.legend._lines.filter((item) => item != {self.id}legendItem)

            if ({self.id}legendItem) {{
                {self._chart.id}.legend.div.removeChild({self.id}legendItem.row)
            }}

            {self._chart.id}.chart.removeSeries({self.id}.series)
            delete {self.id}legendItem
            delete {self.id}
        ''')
        
class CustomCandle(SeriesCommon):
    def __init__(
            self,
            chart,
            name: str,
            up_color: str ,
            down_color: str ,
            border_up_color: str,
            border_down_color: str ,
            wick_up_color: str ,
            wick_down_color: str ,
            wick_visible: bool = True,
            border_visible: bool= True,
            bar_width: float = 0.8,
            radius: Optional[float] = .3,
            shape: str = 'Rectangle',
            combineCandles: int = 1,
            line_width: int = 1,
            line_style: LINE_STYLE = 'solid',
            price_line: bool = True,
            price_label: bool = True,
            group: str = '',
            legend_symbol: Union[str, List[str]] = ['⬤', '⬤'],
            price_scale_id: Optional[str] = None,

        ):
        super().__init__(chart, name)
        self.up_color = up_color
        self.down_color = down_color
        self.group = group  # Store group for legend grouping
        self.legend_symbol = legend_symbol if isinstance(legend_symbol, list) else [legend_symbol, legend_symbol]

        # Define the radius function as a JavaScript function string if none provided

        # Run the JavaScript to initialize the series with the provided options
        self.run_script(f'''
            {self.id} = {chart.id}.createCustomOHLCSeries(
                "{name}",
                {{
                    group: '{group}',
                    upColor: '{up_color}',
                    downColor: '{down_color}',
                    borderUpColor: '{border_up_color}',
                    borderDownColor: '{border_down_color}',
                    wickUpColor: '{wick_up_color or border_up_color}',
                    wickDownColor: '{wick_down_color or border_down_color}',
                    wickVisible: {jbool(wick_visible)},
                    borderVisible: {jbool(border_visible)},
                    barSpacing: {bar_width},
                    radius: {radius},
                    shape: '{shape}',
                    lastValueVisible: {jbool(price_label)},
                    priceLineVisible: {jbool(price_line)},
                    legendSymbol: {json.dumps(self.legend_symbol)},
                    priceScaleId: {f'"{price_scale_id}"' if price_scale_id else 'undefined'},
                    seriesType: "Ohlc",
                    chandelierSize: {combineCandles},
                    lineStyle: {as_enum(line_style, LINE_STYLE)},
                    lineWidth: {line_width},

                }}
            )
        null''')

    def set(self, df: Optional[pd.DataFrame] = None):
        if df is None or df.empty:
            self.run_script(f'{self.id}.series.setData([])')
            self.data = pd.DataFrame()
            return
        df = self._df_datetime_format(df)
        self.data = df.copy()
        self._last_bar = df.iloc[-1]
        self.run_script(f'{self.id}.series.setData({js_data(df)})')

    def update(self, series: pd.Series):
        series = self._series_datetime_format(series)
        if series['time'] != self._last_bar['time']:
            self.data.loc[self.data.index[-1]] = self._last_bar
            self.data = pd.concat([self.data, series.to_frame().T], ignore_index=True)
            self._chart.events.new_bar._emit(self)

        self._last_bar = series
        self.run_script(f'{self.id}.series.update({js_data(series)})')


class Candlestick(SeriesCommon):
    def __init__(self, chart: 'AbstractChart'):
        super().__init__(chart)
        self._volume_up_color = 'rgba(83,141,131,0.8)'
        self._volume_down_color = 'rgba(200,127,130,0.8)'

        self.candle_data = pd.DataFrame()

        # self.run_script(f'{self.id}.makeCandlestickSeries()')

    def set(self, df: Optional[pd.DataFrame] = None, keep_drawings=False):
        """
        Sets the initial data for the chart.\n
        :param df: columns: date/time, open, high, low, close, volume (if volume enabled).
        :param 6: keeps any drawings made through the toolbox. Otherwise, they will be deleted.
        """
        if df is None or df.empty:
            self.run_script(f'{self.id}.series.setData([])')
            self.run_script(f'{self.id}.volumeSeries.setData([])')
            self.candle_data = pd.DataFrame()
            return
        df = self._df_datetime_format(df)
        self.candle_data = df.copy()
        self._last_bar = df.iloc[-1]
        self.run_script(f'{self.id}.series.setData({js_data(df)})')

        if 'volume' not in df:
            return
        volume = df.drop(columns=['open', 'high', 'low', 'close']).rename(columns={'volume': 'value'})
        volume['color'] = self._volume_down_color
        volume.loc[df['close'] > df['open'], 'color'] = self._volume_up_color
        self.run_script(f'{self.id}.volumeSeries.setData({js_data(volume)})')

        for line in self._lines:
            if line.name not in df.columns:
                continue
            line.set(df[['time', line.name]], format_cols=False)
        # set autoScale to true in case the user has dragged the price scale
        self.run_script(f'''
            if (!{self.id}.chart.priceScale("right").options.autoScale)
                {self.id}.chart.priceScale("right").applyOptions({{autoScale: true}})
        ''')
        # TODO keep drawings doesn't work consistenly w
        if keep_drawings:
            self.run_script(f'{self._chart.id}.toolBox?._drawingTool.repositionOnTime()')
        else:
            self.run_script(f"{self._chart.id}.toolBox?.clearDrawings()")

    def update(self, series: pd.Series, _from_tick=False):
        """
        Updates the data from a bar;
        if series['time'] is the same time as the last bar, the last bar will be overwritten.\n
        :param series: labels: date/time, open, high, low, close, volume (if using volume).
        """
        series = self._series_datetime_format(series) if not _from_tick else series
        if series['time'] != self._last_bar['time']:
            self.candle_data.loc[self.candle_data.index[-1]] = self._last_bar
            self.candle_data = pd.concat([self.candle_data, series.to_frame().T], ignore_index=True)
            self._chart.events.new_bar._emit(self)

        self._last_bar = series
        self.run_script(f'{self.id}.series.update({js_data(series)})')
        if 'volume' not in series:
            return
        volume = series.drop(['open', 'high', 'low', 'close']).rename({'volume': 'value'})
        volume['color'] = self._volume_up_color if series['close'] > series['open'] else self._volume_down_color
        self.run_script(f'{self.id}.volumeSeries.update({js_data(volume)})')

    def update_from_tick(self, series: pd.Series, cumulative_volume: bool = False):
        """
        Updates the data from a tick.\n
        :param series: labels: date/time, price, volume (if using volume).
        :param cumulative_volume: Adds the given volume onto the latest bar.
        """
        series = self._series_datetime_format(series)
        if series['time'] < self._last_bar['time']:
            raise ValueError(f'Trying to update tick of time "{pd.to_datetime(series["time"])}", which occurs before the last bar time of "{pd.to_datetime(self._last_bar["time"])}".')
        bar = pd.Series(dtype='float64')
        if series['time'] == self._last_bar['time']:
            bar = self._last_bar
            bar['high'] = max(self._last_bar['high'], series['price'])
            bar['low'] = min(self._last_bar['low'], series['price'])
            bar['close'] = series['price']
            if 'volume' in series:
                if cumulative_volume:
                    bar['volume'] += series['volume']
                else:
                    bar['volume'] = series['volume']
        else:
            for key in ('open', 'high', 'low', 'close'):
                bar[key] = series['price']
            bar['time'] = series['time']
            if 'volume' in series:
                bar['volume'] = series['volume']
        self.update(bar, _from_tick=True)

    def price_scale(
        self,
        auto_scale: bool = True,
        mode: PRICE_SCALE_MODE = 'normal',
        invert_scale: bool = False,
        align_labels: bool = True,
        scale_margin_top: float = 0.2,
        scale_margin_bottom: float = 0.2,
        border_visible: bool = False,
        border_color: Optional[str] = None,
        text_color: Optional[str] = None,
        entire_text_only: bool = False,
        visible: bool = True,
        ticks_visible: bool = False,
        minimum_width: int = 0
    ):
        self.run_script(f'''
            {self.id}.series.priceScale().applyOptions({{
                autoScale: {jbool(auto_scale)},
                mode: {as_enum(mode, PRICE_SCALE_MODE)},
                invertScale: {jbool(invert_scale)},
                alignLabels: {jbool(align_labels)},
                scaleMargins: {{top: {scale_margin_top}, bottom: {scale_margin_bottom}}},
                borderVisible: {jbool(border_visible)},
                {f'borderColor: "{border_color}",' if border_color else ''}
                {f'textColor: "{text_color}",' if text_color else ''}
                entireTextOnly: {jbool(entire_text_only)},
                visible: {jbool(visible)},
                ticksVisible: {jbool(ticks_visible)},
                minimumWidth: {minimum_width}
            }})''')

    def candle_style(
            self, up_color: str = 'rgba(39, 157, 130, 100)', down_color: str = 'rgba(200, 97, 100, 100)',
            wick_visible: bool = True, border_visible: bool = True, border_up_color: str = '',
            border_down_color: str = '', wick_up_color: str = '', wick_down_color: str = ''):
        """
        Candle styling for each of its parts.\n
        If only `up_color` and `down_color` are passed, they will color all parts of the candle.
        """
        border_up_color = border_up_color if border_up_color else up_color
        border_down_color = border_down_color if border_down_color else down_color
        wick_up_color = wick_up_color if wick_up_color else up_color
        wick_down_color = wick_down_color if wick_down_color else down_color
        self.run_script(f"{self.id}.series.applyOptions({js_json(locals())})")

    def volume_config(self, scale_margin_top: float = 0.8, scale_margin_bottom: float = 0.0,
                      up_color='rgba(83,141,131,0.8)', down_color='rgba(200,127,130,0.8)'):
        """
        Configure volume settings.\n
        Numbers for scaling must be greater than 0 and less than 1.\n
        Volume colors must be applied prior to setting/updating the bars.\n
        """
        self._volume_up_color = up_color if up_color else self._volume_up_color
        self._volume_down_color = down_color if down_color else self._volume_down_color
        self.run_script(f'''
        {self.id}.volumeSeries.priceScale().applyOptions({{
            scaleMargins: {{
            top: {scale_margin_top},
            bottom: {scale_margin_bottom},
            }}
        }})
        {self.id}.volumeUpColor = "{self._volume_up_color}";
        {self.id}.volumeDownColor = "{self._volume_down_color}";
         ''')

class PositionPlot(SeriesCommon):
    def __init__(
        self,
        chart,
        name: str,
        side: str = "long",  # 'long' or 'short'
        mode: str = "relative",
        background_color_stop: str = "rgba(255,0,0,0.2)",
        background_color_target: str = "rgba(0,255,0,0.2)",
        price_line: bool = True,
        price_label: bool = True,
        group: str = "Position",
        legend_symbol: str = "⚑",
        auto: bool = True,
    ):
        super().__init__(chart, name)
        self.group = group
        self.legend_symbol = legend_symbol

        if side not in ("long", "short"):
            raise ValueError("side must be 'long' or 'short'")
        if mode not in ("relative", "absolute"):
            raise ValueError("mode must be 'relative' or 'absolute'")

        # Create trade series in the JS environment
        js_code = f"""
        {self.id} = {chart.id}.createTradeSeries("{name}", {{
            name: "{name}",
            group: "{group}",
            side: "{side}",
            mode: "{mode}",
            backgroundColorStop: "{background_color_stop}",
            backgroundColorTarget: "{background_color_target}",
            lastValueVisible: {str(price_label).lower()},
            priceLineVisible: {str(price_line).lower()},
            legendSymbol: "{legend_symbol}",
            auto: {str(auto).lower()}
        }});
        """
        try:
            self.run_script(js_code)
        except JavascriptException as e:
            raise RuntimeError(f"Failed to create trade series. JS Error: {e}")

    def set(self, df: Optional[pd.DataFrame] = None, format_cols: bool = True):
        if df is None or df.empty:
            self.run_script(f'''{self.id}.series.setData([])''')
            self.data = pd.DataFrame()
            return
        if format_cols:
            df = self._df_datetime_format(df, exclude_lowercase=self.name)
        if not df.empty:
           # if 'entry_price' not in df:
           #     raise NameError(f'No column named "{'entry_price'}".')
            df['value'] = df['entry']#.rename(columns={self.name: 'value'})
        self.data = df.copy()
        self._last_bar = df.iloc[-1]
        self.run_script(f'''{self.id}.series.setData({js_data(df)}); ''')
    def delete(self):
        """
        Irreversibly deletes the trade series.
        """
        self.run_script(f'''
            {self.id}legendItem = {self._chart.id}.legend._lines.find((line) => line.series == {self.id}.series)
            {self._chart.id}.legend._lines = {self._chart.id}.legend._lines.filter((item) => item != {self.id}legendItem)

            if ({self.id}legendItem) {{
                {self._chart.id}.legend.div.removeChild({self.id}legendItem.row)
            }}

            {self._chart.id}.chart.removeSeries({self.id}.series)
            delete {self.id}legendItem
            delete {self.id}
        ''')
    def initiate_trade(
        self,
        time: Optional[Any] = None,
        entry: float = 0.0,
        stop: Optional[float] = None,
        target: Optional[float] = None,
        action: str = "entry",
        amount: float = 1.0,
        display_info: str = "",
    ) -> None:
        """
        Initiates or updates a trade on the PositionPlot by inserting one new data point
        into the trade series. If `time` is not provided, this method attempts to fetch
        the last bar's time from the base series in the trade series' options.
        """
        time_str = self._get_time_or_last_bar(time)

        trade_point = {
            "time": time_str,
            "entry": entry,
            "stop": stop if stop is not None else None,
            "target": target if target is not None else None,
            "action": action,
            "amount": amount,
            "displayInfo": display_info,
        }

        trade_json = js_data([trade_point])[1:-1]  # turn list -> single object
        js_code = f"{self.id}.series.update({trade_json});"
        self.run_script(js_code)
    def close_trade(
        self,
        time: Optional[Any] = None,
        display_info: str = "",
    ) -> None:
        """
        Closes an existing trade on the PositionPlot by sending an update 
        with action='close'. If `time` is not provided, we attempt to fetch 
        the last bar's time from the base series in the trade series' options.

        :param time: The time at which the trade is closed. 
                    If None, fetch from the base series' latest bar or fallback to "now".
        :param display_info: Optional text info to display on the chart regarding the close.
        """
        time_str = self._get_time_or_last_bar(time)

        # 3) Build the trade point dictionary, with action='close'
        trade_point = {
            "time": time_str,
            "action": "close",
            "displayInfo": display_info,
        }

        # 4) Convert to JS object
        trade_json = js_data([trade_point])[1:-1]  # remove the surrounding [ ]

        # 5) Send the update to the trade series
        js_code = f"{self.id}.series.update({trade_json});"
        self.run_script(js_code)

    def _get_time_or_last_bar(self, time: Optional[Any]) -> str:
        """
        Returns a JS-friendly time string:
        - If `time` is provided, convert it.
        - Otherwise, fetch the last bar's time from baseSeries or fallback to "now".
        """
        if time is not None:
            return self._convert_time(time)

        # No time -> fetch from base series
        js_fetch_time = f"""
        (function() {{
            const baseSeries = {self.id}.series.options().baseSeries;
            if (!baseSeries) return null;
            const data = baseSeries.data();
            if (!data || data.length === 0) return null;
            return data[data.length - 1].time;
        }})();
        """
        last_bar_time = self.run_script(js_fetch_time)
        if last_bar_time is None:
            # fallback to "now"
            last_bar_time = pd.Timestamp.now().isoformat()

        return self._convert_time(last_bar_time)


class AbstractChart(Candlestick, Pane):
    def __init__(self, window: Window, width: float = 1.0, height: float = 1.0,
                 scale_candles_only: bool = False, toolbox: bool = False,
                 autosize: bool = True, position: FLOAT = 'left',
                 defaults: str = '../../src/general/defaults', scripts: str = '../../src/general/scripts'):
        Pane.__init__(self, window)
        Candlestick.__init__(self, self)
        self._lines = []
        self._scale_candles_only = scale_candles_only
        self._width = width
        self._height = height
        self.events: Events = Events(self)
        from lightweight_charts.polygon import PolygonAPI

        # Initialize PolygonAPI instance
        self.polygon: PolygonAPI = PolygonAPI(self)

        # Initialize Lib.Handler JavaScript instance
        self.run_script(
            f'{self.id} = new Lib.Handler("{self.id}", {width}, {height}, "{position}", {jbool(autosize)})'
        )

        self.topbar: TopBar = TopBar(self)
        if toolbox:
            self.toolbox: ToolBox = ToolBox(self)

        # Set and initialize defaults directory
        self.defaults = defaults or './defaults'
        if not os.path.exists(self.defaults):
            os.makedirs(self.defaults, exist_ok=True)
            if os.path.exists('../../src/general/defaults'):
                shutil.copytree('../../src/general/defaults', self.defaults, dirs_exist_ok=True)
        self.set_defaults(self.defaults)

        # Handlers for defaults
        self.win.handlers['save_defaults'] = self._save_defaults
        self.events.save_defaults += self._save_defaults

        # Set and initialize scripts directory
        self.scripts = scripts or './scripts'
        if not os.path.exists(self.scripts):
            os.makedirs(self.scripts, exist_ok=True)
            if os.path.exists('../../src/general/scripts'):
                shutil.copytree('../../src/general/scripts', self.scripts, dirs_exist_ok=True)
        self.set_scripts(self.scripts)

        # Handlers for scripts
        self.win.handlers['save_script'] = self._save_script
        self.events.save_script += self._save_script

    def _save_script(self, key: str, options: str) -> None:
        """Save script JSON data to memory and disk."""
        try:
            parsed_options = json.loads(options)
            if not hasattr(self, 'exportedScripts'):
                self.exportedScripts = {}
            self.exportedScripts[key] = parsed_options

            scripts_folder = self.scripts if isinstance(self.scripts, str) and self.scripts else "./scripts"
            if not os.path.exists(scripts_folder):
                os.makedirs(scripts_folder)

            file_path = os.path.join(scripts_folder, f"{key}.json")
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(parsed_options, f, indent=2)
            print(f"Script for key '{key}' written to disk at: {file_path}")
        except Exception as e:
            print(f"Error saving script for key '{key}': {e}")

    def _save_defaults(self, key: str, options: str) -> None:
        """Save defaults JSON data to memory and disk."""
        try:
            parsed_options = json.loads(options)
            if not hasattr(self, 'exportedDefaults'):
                self.exportedDefaults = {}
            self.exportedDefaults[key] = parsed_options

            defaults_folder = self.defaults if isinstance(self.defaults, str) else "./defaults"
            if not os.path.exists(defaults_folder):
                os.makedirs(defaults_folder)

            file_path = os.path.join(defaults_folder, f"{key}.json")
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(parsed_options, f, indent=2)
            print(f"Defaults for key '{key}' written to disk at: {file_path}")
        except Exception as e:
            print(f"Error saving defaults for key '{key}': {e}")

    def set_scripts(self, scripts_dir: str) -> None:
        """
        Load and apply JSON scripts from directory to the scriptsManager.
        """
        for root, _, files in os.walk(scripts_dir):
            for filename in files:
                if filename.endswith('.json'):
                    key = os.path.splitext(filename)[0]
                    file_path = os.path.join(root, filename)
                    try:
                        with open(file_path, 'r', encoding="utf-8") as f:
                            data = json.load(f)
                        json_data = json.dumps(data)
                        js_code = f'{self.id}.scriptsManager.set("{key}", {json_data});'
                        self.run_script(js_code)
                        print(f"Set script for key '{key}' successfully.")
                    except Exception as e:
                        print(f"Error processing script '{file_path}': {e}")

    def set_defaults(self, defaults_dir: str) -> None:
        """
        Load and apply JSON defaults from directory to the defaultsManager.
        Special handling for "chart.json".
        """
        for root, _, files in os.walk(defaults_dir):
            for filename in files:
                if filename.endswith('.json'):
                    key = os.path.splitext(filename)[0]
                    file_path = os.path.join(root, filename)
                    try:
                        with open(file_path, 'r', encoding="utf-8") as f:
                            data = json.load(f)
                        json_data = json.dumps(data)
                        js_code = f'{self.id}.defaultsManager.set("{key}", {json_data});'
                        self.run_script(js_code)
                        print(f"Set defaults for key '{key}' successfully.")

                        if key.lower() == "chart":
                            js_apply = f'{self.id}.chart.applyOptions({{ ...{self.id}.defaultsManager.get("chart") }});'
                            self.run_script(js_apply)
                            print("Applied chart defaults successfully.")
                    except Exception as e:
                        print(f"Error processing defaults '{file_path}': {e}")

    def fit(self):
        """
        Fits chart data within the viewport.
        """
        self.run_script(f'{self.id}.chart.timeScale().fitContent()')

    def create_line(
            self, 
            name: str = '', 
            color: str = 'rgba(214, 237, 255, 0.6)',
            style: LINE_STYLE = 'solid', lob/dev/run.py
            width: int = 2,
            price_line: bool = True, 
            price_label: bool = True, 
            group: str = '',
            legend_symbol: str = '', 
            price_scale_id: Optional[str] = None
        ) -> Line:
        """
        Creates and returns a Line object.
        """
        
        symbol_styles = {
            'solid':'―',
            'dotted':'··',
            'dashed':'--',
            'large_dashed':'- -',
            'sparse_dotted':"· ·",
        }
        if legend_symbol == '':
            legend_symbol = symbol_styles.get(style, '━')  # Default to 'solid' if style is unrecognized

        if not isinstance(legend_symbol, str):
            raise TypeError("legend_symbol must be a string for Line series.")
        
        self._lines.append(Line(
            self, name, color, style, width, price_line, price_label, 
            group, legend_symbol, price_scale_id
        ))
        return self._lines[-1]


    def create_symbol(
            self,
            name: str,
            color: str = 'rgba(214, 237, 255, 0.6)',
            shape: str = '*',
            group: str = '',
            legend_symbol: str = '',
            price_scale_id: Optional[str] = None,
            crosshair_marker: bool = True,
            price_line: bool = False,
            price_label: bool = False
        ) -> Symbols:
        """
        Creates and returns a Symbols series object.
        """

        symbol_map = {
            'circle': '●',
            'circles': '●',
            'cross': '✚',
            'triangleUp': '▲',
            'triangleDown': '▼',
            'arrowUp': '↑',
            'arrowDown': '↓'
        }

        if legend_symbol == '':
            legend_symbol = symbol_map.get(shape, shape)

        symbols_series = Symbols(
            self, name, color, shape, group, legend_symbol, price_scale_id,
            crosshair_marker, price_line, price_label
        )
        self._lines.append(symbols_series)
        return symbols_series

    def create_histogram(
            self, 
            name: str = '', 
            color: str = 'rgba(214, 237, 255, 0.6)',
            price_line: bool = True, 
            price_label: bool = True,
            group: str = '', 
            legend_symbol: str = '▥',
            scale_margin_top: float = 0.0, 
            scale_margin_bottom: float = 0.0
        ) -> Histogram:
        """
        Creates and returns a Histogram object.
        """
        if not isinstance(legend_symbol, str):
            raise TypeError("legend_symbol must be a string for Histogram series.")
        
        return Histogram(
            self, name, color, price_line, price_label, 
            group, legend_symbol, scale_margin_top, scale_margin_bottom
        )

    def create_area(
            self, 
            name: str = '', 
            top_color: str = 'rgba(0, 100, 0, 0.5)',
            bottom_color: str = 'rgba(138, 3, 3, 0.5)', 
            invert: bool = False, 
            color: str = 'rgba(0,0,255,1)', 
            style: LINE_STYLE = 'solid',
            width: int = 2, 
            price_line: bool = True, 
            price_label: bool = True, 
            group: str = '', 
            legend_symbol: str = '◪', 
            price_scale_id: Optional[str] = None
        ) -> Area:
        """
        Creates and returns an Area object.
        """
        if not isinstance(legend_symbol, str):
            raise TypeError("legend_symbol must be a string for Area series.")
        
        self._lines.append(Area(
            self, name, top_color, bottom_color, invert, color, style, 
            width, price_line, price_label, group, legend_symbol, price_scale_id
        ))
        return self._lines[-1]

    def create_bar(
            self, 
            name: str = '', 
            up_color: str = '#26a69a', 
            down_color: str = '#ef5350',
            open_visible: bool = True, 
            thin_bars: bool = True,
            price_line: bool = True, 
            price_label: bool = True,
            group: str = '', 
            legend_symbol: Union[str, List[str]] = ['┌', '└'],
            price_scale_id: Optional[str] = None
        ) -> Bar:
        """
        Creates and returns a Bar object.
        """
        if not isinstance(legend_symbol, (str, list)):
            raise TypeError("legend_symbol must be a string or list of strings for Bar series.")
        if isinstance(legend_symbol, list) and not all(isinstance(symbol, str) for symbol in legend_symbol):
            raise TypeError("Each item in legend_symbol list must be a string for Bar series.")
        
        return Bar(
            self, name, up_color, down_color, open_visible, thin_bars, 
            price_line, price_label, group, legend_symbol, price_scale_id
        )

    def create_custom_candle(
            self,
            name: str = '',
            up_color: str = None,
            down_color: str = None,
            border_up_color='rgba(0,255,0,1)',
            border_down_color='rgba(255,0,0,1)',
            wick_up_color='rgba(0,255,0,1)',
            wick_down_color='rgba(255,0,0,1)',
            wick_visible: bool = True,
            border_visible: bool = True,
            bar_width: float = 0.8,
            rounded_radius: Union[float, int] = 100,
            shape: Literal[CANDLE_SHAPE] = "Rectangle",
            combineCandles: int = 1,
            line_width: int = 1,
            line_style: LINE_STYLE = 'solid', 
            price_line: bool = True,
            price_label: bool = True,
            group: str = '',
            legend_symbol: Union[str, List[str]] = ['⑃', '⑂'],
            price_scale_id: Optional[str] = None,
        ) -> CustomCandle:
        """
        Creates and returns a CustomCandle object.
        """
        # Validate that legend_symbol is either a string or a list of two strings
        if not isinstance(legend_symbol, (str, list)):
            raise TypeError("legend_symbol must be a string or list of strings for CustomCandle series.")
        if isinstance(legend_symbol, list) and len(legend_symbol) != 2:
            raise ValueError("legend_symbol list must contain exactly two symbols for CustomCandle series.")

        return CustomCandle(
            self,
            name=name,
            up_color=up_color or border_up_color,
            down_color=down_color or border_down_color,
            border_up_color=border_up_color or up_color,
            border_down_color=border_down_color or down_color,
            wick_up_color=wick_up_color or border_up_color or border_up_color,
            wick_down_color=wick_down_color or border_down_color or border_down_color,
            wick_visible=wick_visible,
            border_visible=border_visible,
            bar_width=bar_width,
            radius=rounded_radius,
            shape=shape,
            combineCandles=combineCandles,
            line_style= line_style,
            line_width= line_width,
            price_line=price_line,
            price_label=price_label,
            group=group,
            legend_symbol=legend_symbol,
            price_scale_id=price_scale_id,
        )
        
    def plot_position(
            self,
            name: str = 'Position',
            side: str = 'long',
            mode: str = 'relative',
            background_color_stop: str = 'rgba(255,0,0,0.2)',
            background_color_target: str = 'rgba(0,255,0,0.2)',
            price_line: bool = True,
            price_label: bool = True,
            group: str = 'Position',
            legend_symbol: str = '$',
            auto: bool = 'true'
        ) -> 'PositionPlot':
            """
            Creates and returns a PositionPlot (Trade) object.

            :param name: Name of the trade series.
            :param side: 'long' or 'short'.
            :param mode: 'relative' or 'absolute'.
            :param background_color_stop: Gradient color for entry-stop line.
            :param background_color_target: Gradient color for entry-target line.
            :param price_line: Show the price line.
            :param price_label: Show the price label on the scale.
            :param group: Legend group.
            :param legend_symbol: Symbol for the legend.
            """
            self._lines.append(PositionPlot(
                self,
                name,
                side,
                mode,
                background_color_stop,
                background_color_target,
                price_line,
                price_label,
                group,
                legend_symbol,
                auto
            ))
            return self._lines[-1]


    
    def lines(self) -> List[Line]:
        """
        Returns all lines for the chart.
        """
        return self._lines.copy()

    def set_visible_range(self, start_time: TIME, end_time: TIME):
        self.run_script(f'''
        {self.id}.chart.timeScale().setVisibleRange({{
            from: {pd.to_datetime(start_time).timestamp()},
            to: {pd.to_datetime(end_time).timestamp()}
        }})
        ''')

    def resize(self, width: Optional[float] = None, height: Optional[float] = None):
        """
        Resizes the chart within the window.
        Dimensions should be given as a float between 0 and 1.
        """
        self._width = width if width is not None else self._width
        self._height = height if height is not None else self._height
        self.run_script(f'''
        {self.id}.scale.width = {self._width}
        {self.id}.scale.height = {self._height}
        {self.id}.reSize()
        ''')

    def time_scale(self, right_offset: int = 0, min_bar_spacing: float = 0.5,
                   visible: bool = True, time_visible: bool = True, seconds_visible: bool = False,
                   border_visible: bool = True, border_color: Optional[str] = None):
        """
        Options for the timescale of the chart.
        """
        self.run_script(f'''{self.id}.chart.applyOptions({{timeScale: {js_json(locals())}}})''')

    def layout(self, background_color: str = '#000000', text_color: Optional[str] = None,
               font_size: Optional[int] = None, font_family: Optional[str] = None):
        """
        Global layout options for the chart.
        """
        self.run_script(f"""
            document.getElementById('container').style.backgroundColor = '{background_color}'
            {self.id}.chart.applyOptions({{
            layout: {{
                background: {{color: "{background_color}"}},
                {f'textColor: "{text_color}",' if text_color else ''}
                {f'fontSize: {font_size},' if font_size else ''}
                {f'fontFamily: "{font_family}",' if font_family else ''}
            }}}})""")

    def grid(self, vert_enabled: bool = True, horz_enabled: bool = True,
             color: str = 'rgba(29, 30, 38, 5)', style: LINE_STYLE = 'solid'):
        """
        Grid styling for the chart.
        """
        self.run_script(f"""
           {self.id}.chart.applyOptions({{
           grid: {{
               vertLines: {{
                   visible: {jbool(vert_enabled)},
                   color: "{color}",
                   style: {as_enum(style, LINE_STYLE)},
               }},
               horzLines: {{
                   visible: {jbool(horz_enabled)},
                   color: "{color}",
                   style: {as_enum(style, LINE_STYLE)},
               }},
           }}
           }})""")

    def crosshair(
        self,
        mode: CROSSHAIR_MODE = 'normal',
        vert_visible: bool = True,
        vert_width: int = 1,
        vert_color: Optional[str] = None,
        vert_style: LINE_STYLE = 'large_dashed',
        vert_label_background_color: str = 'rgb(46, 46, 46)',
        horz_visible: bool = True,
        horz_width: int = 1,
        horz_color: Optional[str] = None,
        horz_style: LINE_STYLE = 'large_dashed',
        horz_label_background_color: str = 'rgb(55, 55, 55)'
    ):
        """
        Crosshair formatting for its vertical and horizontal axes.
        """
        self.run_script(f'''
        {self.id}.chart.applyOptions({{
            crosshair: {{
                mode: {as_enum(mode, CROSSHAIR_MODE)},
                vertLine: {{
                    visible: {jbool(vert_visible)},
                    width: {vert_width},
                    {f'color: "{vert_color}",' if vert_color else ''}
                    style: {as_enum(vert_style, LINE_STYLE)},
                    labelBackgroundColor: "{vert_label_background_color}"
                }},
                horzLine: {{
                    visible: {jbool(horz_visible)},
                    width: {horz_width},
                    {f'color: "{horz_color}",' if horz_color else ''}
                    style: {as_enum(horz_style, LINE_STYLE)},
                    labelBackgroundColor: "{horz_label_background_color}"
                }}
            }}
        }})''')

    def watermark(self, text: str, font_size: int = 44, color: str = 'rgba(180, 180, 200, 0.5)'):
        """
        Adds a watermark to the chart.
        """
        self.run_script(f'''
          {self.id}.chart.applyOptions({{
              watermark: {{
                  visible: true,
                  horzAlign: 'center',
                  vertAlign: 'center',
                  ...{js_json(locals())}
              }}
          }})''')

    def legend(self, visible: bool = False, ohlc: bool = True, percent: bool = True, lines: bool = True,
               color: str = 'rgb(191, 195, 203)', font_size: int = 11, font_family: str = 'Monaco',
               text: str = '', color_based_on_candle: bool = False):
        """
        Configures the legend of the chart.
        """
        l_id = f'{self.id}.legend'
        if not visible:
            self.run_script(f'''
            {l_id}.div.style.display = "none"
            {l_id}.ohlcEnabled = false
            {l_id}.percentEnabled = false
            {l_id}.linesEnabled = false
            ''')
            return
        self.run_script(f'''
        {l_id}.div.style.display = 'flex'
        {l_id}.ohlcEnabled = {jbool(ohlc)}
        {l_id}.percentEnabled = {jbool(percent)}
        {l_id}.linesEnabled = {jbool(lines)}
        {l_id}.colorBasedOnCandle = {jbool(color_based_on_candle)}
        {l_id}.div.style.color = '{color}'
        {l_id}.color = '{color}'
        {l_id}.div.style.fontSize = '{font_size}px'
        {l_id}.div.style.fontFamily = '{font_family}'
        {l_id}.text.innerText = '{text}'
        ''')

    def spinner(self, visible):
        self.run_script(f"{self.id}.spinner.style.display = '{'block' if visible else 'none'}'")

    def hotkey(self, modifier_key: Literal['ctrl', 'alt', 'shift', 'meta', None],
               keys: Union[str, tuple, int], func: Callable):
        if not isinstance(keys, tuple):
            keys = (keys,)
        for key in keys:
            key = str(key)
            if key.isalnum() and len(key) == 1:
                key_code = f'Digit{key}' if key.isdigit() else f'Key{key.upper()}'
                key_condition = f'event.code === "{key_code}"'
            else:
                key_condition = f'event.key === "{key}"'
            if modifier_key is not None:
                key_condition += f'&& event.{modifier_key}Key'

            self.run_script(f'''
                    {self.id}.commandFunctions.unshift((event) => {{
                        if ({key_condition}) {{
                            event.preventDefault()
                            window.callbackFunction(`{modifier_key, keys}_~_{key}`)
                            return true
                        }}
                        else return false
                    }})''')
        self.win.handlers[f'{modifier_key, keys}'] = func

    def create_table(
        self,
        width: NUM,
        height: NUM,
        headings: tuple,
        widths: Optional[tuple] = None,
        alignments: Optional[tuple] = None,
        position: FLOAT = 'left',
        draggable: bool = False,
        background_color: str = '#121417',
        border_color: str = 'rgb(70, 70, 70)',
        border_width: int = 1,
        heading_text_colors: Optional[tuple] = None,
        heading_background_colors: Optional[tuple] = None,
        return_clicked_cells: bool = False,
        func: Optional[Callable] = None
    ) -> Table:
        args = locals()
        del args['self']
        return self.win.create_table(*args.values())

    def screenshot(self) -> bytes:
        """
        Takes a screenshot. This method can only be used after the chart window is visible.
        :return: a bytes object containing a screenshot of the chart.
        """
        serial_data = self.win.run_script_and_get(f'{self.id}.chart.takeScreenshot().toDataURL()')
        return b64decode(serial_data.split(',')[1])

    def create_subchart(self, position: FLOAT = 'left', width: float = 0.5, height: float = 0.5,
                        sync: Optional[Union[str, bool]] = None, scale_candles_only: bool = False,
                        sync_crosshairs_only: bool = False,
                        toolbox: bool = False) -> 'AbstractChart':
        if sync is True:
            sync = self.id
        args = locals()
        del args['self']
        return self.win.create_subchart(*args.values())
