import datetime as dt
import yfinance as yf
from lightweight_charts import Chart
import pandas as pd
from time import sleep

def get_bar_data(chart, symbol, timeframe):
    if timeframe in ('1m', '5m', '30m'):
        days = 7 if timeframe == '1m' else 60
        start_date = (dt.datetime.now() - dt.timedelta(days=days)).strftime('%Y-%m-%d')
    else:
        start_date = None

    chart.spinner(True)

    data = yf.download(symbol, start=start_date, interval=timeframe)

    chart.spinner(False)

    if data.empty:
        return False

    chart.set(data)
    return True

def on_search(chart, searched_string):
    if get_bar_data(chart, searched_string, chart.topbar['timeframe'].value):
        chart.topbar['symbol'].set(searched_string)

def on_timeframe_selection(chart):
    get_bar_data(chart, chart.topbar['symbol'].value, chart.topbar['timeframe'].value)

if __name__ == '__main__':
    import pandas as pd
    from time import sleep

    data = pd.read_csv('./ohlcv.csv')

    data['HL'] = (data['high'] + data['low']) / 2

    midpoint = data.shape[0] // 2
    df1 = data.iloc[:midpoint]
    df2 = data.iloc[midpoint+1:]

    chart = Chart(toolbox=True, debug=True)
    chart.legend(True)
    chart.set(df1)

    symbol_df = df1[['time', 'HL']].copy()

    symbols_series = chart.create_symbol(name="HL", shape='―', color='#ffffff')
    symbols_series.set(symbol_df)

    chart.events.search += on_search
    chart.show(block=False)
    for _, tick in df2.iterrows():
        chart.update(tick)

        if not pd.isna(tick['HL']):
            symbols_series.update(pd.Series(
                {'time': tick['time'], 'value': tick['HL']},
                name=tick['time']
            ))

        sleep(0.2)

