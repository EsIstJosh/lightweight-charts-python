import datetime as dt
from lightweight_charts_esistjosh import Chart
import pandas as pd
from time import sleep


if __name__ == '__main__':
    import pandas as pd
    from time import sleep

    data = pd.read_csv('./ohlcv.csv')

    data['HL50'] = (data['high'] + data['low']) / 2
    #data['price'] = (data['close'] + data['open']) / 2
    midpoint = len(data) // 2
    df1 = data.iloc[:midpoint]
    df2 = data.iloc[midpoint+1:]
  

    chart = Chart(toolbox="default", debug=True, defaults= "./lightweight_charts_esistjosh/defaults", scripts= "./lightweight_charts_esistjosh/scripts")

    chart.legend(True)
    chart.set(df1)
    chart.topbar
    chart.topbar.textbox('symbol', 'Example')
    symbol_df = df1[['time', 'HL50']].copy()

    symbols_series = chart.create_symbol(name="HL50", shape='―', color='#ffffff')
    symbols_series.set(symbol_df)

    chart.show(block=True)
 #   for _, tick in df2.iterrows():
 #       chart.update(tick)
#
#
 #       if not pd.isna(tick['HL']):
 #           symbols_series.update(pd.Series(
  #              {'time': tick['time'], 'value': tick['HL']},
 #               name=tick['time']
 #           ))
#
  #      sleep(0.2)
