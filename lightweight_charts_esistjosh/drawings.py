import asyncio
import json
import pandas as pd

from typing import Union, Optional

from lightweight_charts_esistjosh.util import js_json

from .util import NUM, Pane, as_enum, LINE_STYLE, TIME, snake_to_camel

def make_js_point(chart, time, price):
    formatted_time = chart._single_datetime_format(time)
    return f'''{{
        "time": {formatted_time},
        "logical": {chart.id}.chart.timeScale()
                    .coordinateToLogical(
                        {chart.id}.chart.timeScale()
                        .timeToCoordinate({formatted_time})
                    ),
        "price": {price}
    }}'''

class Drawing(Pane):
    def __init__(self, chart, func=None):
        super().__init__(chart.win)
        self.chart = chart

    def update(self, *points):
        formatted_points = []
        for i in range(0, len(points), 2):
            formatted_points.append(make_js_point(self.chart, points[i], points[i + 1]))
        self.run_script(f'{self.id}.updatePoints({", ".join(formatted_points)})')
        print(f'{self.id}.updatePoints({", ".join(formatted_points)})')

    def delete(self):
        """
        Irreversibly deletes the drawing.
        """
        self.run_script(f'{self.id}.detach()')

    def options(self, color='#1E80F0', style='solid', width=4):
        self.run_script(f'''{self.id}.applyOptions({{
            lineColor: '{color}',
            lineStyle: {as_enum(style, LINE_STYLE)},
            width: {width},
        }})''')

class TwoPointDrawing(Drawing):
    def __init__(
        self,
        drawing_type,
        chart,
        start_time: TIME,
        start_value: NUM,
        end_time: TIME,
        end_value: NUM,
        round: bool,
        options: dict,
        func=None
    ):
        super().__init__(chart, func)



        options_string = '\n'.join(f'{key}: {val},' for key, val in options.items())

        self.run_script(f'''
        {self.id} = new Lib.{drawing_type}(
            {make_js_point(self.chart, start_time, start_value)},
            {make_js_point(self.chart, end_time, end_value)},
            {{
                {options_string}
            }}
        )
        {chart.id}.series.attachPrimitive({self.id})
        ''')


class HorizontalLine(Drawing):
    def __init__(self, chart, price, color, width, style, text, axis_label_visible, func):
        super().__init__(chart, func)
        self.price = price
        self.run_script(f'''

        {self.id} = new Lib.HorizontalLine(
            {{price: {price}}},
            {{
                lineColor: '{color}',
                lineStyle: {as_enum(style, LINE_STYLE)},
                width: {width},
                text: `{text}`,
            }},
            callbackName={f"'{self.id}'" if func else 'null'}
        )
        {chart.id}.series.attachPrimitive({self.id})
        ''')
        if not func:
            return

        def wrapper(p):
            self.price = float(p)
            func(chart, self)

        async def wrapper_async(p):
            self.price = float(p)
            await func(chart, self)

        self.win.handlers[self.id] = wrapper_async if asyncio.iscoroutinefunction(func) else wrapper
        self.run_script(f'{chart.id}.toolBox?.addNewDrawing({self.id})')

    def update(self, price: float):
        """
        Moves the horizontal line to the given price.
        """
        self.run_script(f'{self.id}.updatePoints({{price: {price}}})')
        # self.run_script(f'{self.id}.updatePrice({price})')
        self.price = price

    def options(self, color='#1E80F0', style='solid', width=4, text=''):
        super().options(color, style, width)
        self.run_script(f'{self.id}.applyOptions({{text: `{text}`}})')



class VerticalLine(Drawing):
    def __init__(self, chart, time, color, width, style, text, func=None):
        super().__init__(chart, func)
        self.time = time
        self.run_script(f'''

        {self.id} = new Lib.VerticalLine(
            {{time: {self.chart._single_datetime_format(time)}}},
            {{
                lineColor: '{color}',
                lineStyle: {as_enum(style, LINE_STYLE)},
                width: {width},
                text: `{text}`,
            }},
            callbackName={f"'{self.id}'" if func else 'null'}
        )
        {chart.id}.series.attachPrimitive({self.id})
        ''')

    def update(self, time: TIME):
        self.run_script(f'{self.id}.updatePoints({{time: {time}}})')
        # self.run_script(f'{self.id}.updatePrice({price})')
        self.price = price

    def options(self, color='#1E80F0', style='solid', width=4, text=''):
        super().options(color, style, width)
        self.run_script(f'{self.id}.applyOptions({{text: `{text}`}})')


class RayLine(Drawing):
    def __init__(self,
        chart,
        start_time: TIME,
        value: NUM,
        round: bool = False,
        color: str = '#1E80F0',
        width: int = 2,
        style: LINE_STYLE = 'solid',
        text: str = '',
        func = None,
    ):
        super().__init__(chart, func)
        self.run_script(f'''
        {self.id} = new Lib.RayLine(
            {{time: {self.chart._single_datetime_format(start_time)}, price: {value}}},
            {{
                lineColor: '{color}',
                lineStyle: {as_enum(style, LINE_STYLE)},
                width: {width},
                text: `{text}`,
            }},
            callbackName={f"'{self.id}'" if func else 'null'}
        )
        {chart.id}.series.attachPrimitive({self.id})
        ''')




class Box(TwoPointDrawing):
    def __init__(self,
        chart,
        start_time: TIME,
        start_value: NUM,
        end_time: TIME,
        end_value: NUM,
        round: bool,
        line_color: str,
        fill_color: str,
        width: int,
        style: LINE_STYLE,
        func=None):

        super().__init__(
            "Box",
            chart,
            start_time,
            start_value,
            end_time,
            end_value,
            round,
            {
                "lineColor": f'"{line_color}"',
                "fillColor": f'"{fill_color}"',
                "width": width,
                "lineStyle": as_enum(style, LINE_STYLE)
            },
            func
        )


class TrendLine(TwoPointDrawing):
    def __init__(self,
        chart,
        start_time: TIME,
        start_value: NUM,
        end_time: TIME,
        end_value: NUM,
        round: bool,
        line_color: str,
        width: int,
        style: LINE_STYLE,
        func=None):

        super().__init__(
            "TrendLine",
            chart,
            start_time,
            start_value,
            end_time,
            end_value,
            round,
            {
                "lineColor": f'"{line_color}"',
                "width": width,
                "lineStyle": as_enum(style, LINE_STYLE)
            },
            func
        )

# TODO reimplement/fix
class VerticalSpan(Pane):
    def __init__(self, series: 'SeriesCommon', start_time: Union[TIME, tuple, list], end_time: Optional[TIME] = None,
                 color: str = 'rgba(252, 219, 3, 0.2)'):
        self._chart = series._chart
        super().__init__(self._chart.win)
        start_time, end_time = pd.to_datetime(start_time), pd.to_datetime(end_time)
        self.run_script(f'''
        {self.id} = {self._chart.id}.chart.addSeries(HistogramSeries,{{
                color: '{color}',
                priceFormat: {{type: 'volume'}},
                priceScaleId: 'vertical_line',
                lastValueVisible: false,
                priceLineVisible: false,
        }})
        {self.id}.priceScale('').applyOptions({{
            scaleMargins: {{top: 0, bottom: 0}}
        }})
        ''')
        if end_time is None:
            if isinstance(start_time, pd.DatetimeIndex):
                data = [{'time': time.timestamp(), 'value': 1} for time in start_time]
            else:
                data = [{'time': start_time.timestamp(), 'value': 1}]
            self.run_script(f'{self.id}.setData({data})')
        else:
            self.run_script(f'''
            {self.id}.setData(calculateTrendLine(
            {start_time.timestamp()}, 1, {end_time.timestamp()}, 1, {series.id}))
            ''')

    def delete(self):
        """
        Irreversibly deletes the vertical span.
        """
        self.run_script(f'{self._chart.id}.chart.removeSeries({self.id})')



class TrendTrace(TwoPointDrawing):
    """
    Inherits from TwoPointDrawing("Box", …) to get p1/p2,
    then looks up the series in Lib.Handler.seriesMap by name,
    and does:
      series.primitives["TrendTrace"] = new Lib.TrendTrace(...)
    """
    def __init__(
        self,
        chart: any,
        series_name: str,
        start_time: TIME,
        start_value: NUM,
        end_time: TIME,
        end_value: NUM,
        rounded: bool,
        line_color: str = "#00000000",
        fill_color: str = "#00000000",
        width: float = 0.5,
        style: LINE_STYLE = "solid",
        js_options: str = "{}",
        offset: Optional[int] = None,
        func: Optional[any] = None,
    ) -> None:
        # 1) Draw a transparent Box to source p1/p2
        super().__init__(
            "Box",
            chart,
            start_time,
            start_value,
            end_time,
            end_value,
            rounded,
            {
                "lineColor": f'"{line_color}"',
                "fillColor": f'"{fill_color}"',
                "width": width,
                "lineStyle": as_enum(style, LINE_STYLE),
            },
            func,
        )

        off = offset if offset is not None else "undefined"
        script = f"""
;(function() {{
  const box    = window.{self.id};
  const p1     = box.p1;
  const p2     = box.p2;
  const series = Lib.Handler.seriesMap["{series_name}"];
  if (!series) {{
    console.error("TrendTrace: no series '{series_name}'");
    return;
  }}

  // overwrite the primitive with a fresh TrendTrace
  series.primitives["TrendTrace"] = new Lib.TrendTrace(
    Lib.Handler,
    series,
    p1,
    p2,
    {js_options},
    {off}
  );

  series.attachPrimitive(
    series.primitives["TrendTrace"],
    `${{p1.logical}} ⥵ ${{p2.logical}}`,
    false,
    true
  );

  box.linkedObjects.push(series.primitives["TrendTrace"]);
  window.{self.id}_trace = series.primitives["TrendTrace"];
  }})();
  """

        self.run_script(script)

    def apply_options(self, trend_options: str) -> None:
        """
        Update the trace’s options by calling
        series.primitives["TrendTrace"].applyOptions(...)
        """
        script = f"""
;(function() {{
  const series = Lib.Handler.seriesMap["{self.series_name}"];
  if (series && series.primitives["TrendTrace"]) {{
    series.primitives["TrendTrace"].applyOptions({trend_options});
  }}
}})();
"""
        self.run_script(script)


    def detach(self) -> None:
        """
        Detach (remove) the TrendTrace via
        series.primitives["TrendTrace"].detach()
        """
        script = f"""
;(function() {{
  const series = Lib.Handler.seriesMap["{self.series_name}"];
  if (series && series.primitives["TrendTrace"]) {{
    series.primitives["TrendTrace"].detach();
  }}
}})();
"""
        self.run_script(script)