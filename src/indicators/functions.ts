import { BarData, CandlestickData, HistogramData, OhlcData, SingleValueData } from "lightweight-charts";
import { IndicatorDefinition } from "./indicators";

 // Helper export function to calculate ATR
  export function getATR(dataList: (BarData | CandlestickData)[], index: number, period: number): number {
    if (index < period - 1) return NaN;
  
    let sum = 0;
    for (let i = index - period + 1; i <= index; i++) {
      const tr = Math.max(
        dataList[i].high - dataList[i].low,
        Math.abs(dataList[i].high - dataList[i - 1]?.close || dataList[i].high),
        Math.abs(dataList[i].low - dataList[i - 1]?.close || dataList[i].low)
      );
      sum += tr;
    }
  
    return sum / period;
  }
 // Helper export functions
 export function getHighest(data: number[], period: number): number {
  if (data.length < period) return NaN;
  return Math.max(...data.slice(data.length - period));
}

export function getLowest(data: number[], period: number): number {
  if (data.length < period) return NaN;
  return Math.min(...data.slice(data.length - period));
}

export function getRound(value: number): number {
  return Math.round(value);
}

export function getSma(data: number[], period: number): number {
  if (data.length < period) return NaN;
  const subset = data.slice(data.length - period);
  return subset.reduce((sum, val) => sum + val, 0) / period;
}

export function getEma(data: number[], period: number): number {
  if (data.length < period) return NaN;
  const k = 2 / (period + 1);
  let emaVal = getSma(data, period);
  for (let i = data.length - period + 1; i < data.length; i++) {
    emaVal = data[i] * k + emaVal * (1 - k);
  }
  return emaVal;
}

/**
 * Calculates the Weighted Moving Average (WMA) for the given data over the specified period.
 * The weights are assigned such that the oldest data point has weight 1 and the newest has weight equal to period.
 *
 * @param data - The numeric price series.
 * @param period - The period over which to calculate the WMA.
 * @returns The WMA value or NaN if insufficient data.
 */
export function getWma(data: number[], period: number): number {
  if (data.length < period) return NaN;
  const windowData = data.slice(data.length - period);
  let weightedSum = 0;
  let weightSum = 0;
  // Assign weight 1 to the oldest value, increasing up to 'period' for the most recent.
  for (let i = 0; i < windowData.length; i++) {
    const weight = i + 1;
    weightedSum += windowData[i] * weight;
    weightSum += weight;
  }
  return weightedSum / weightSum;
}

export function getLinreg(data: number[], period: number, offset: number = 0): number {
  if (data.length < period) return NaN;
  const subset = data.slice(data.length - period);
  const n = period;
  const sumX = (n * (n - 1)) / 2;
  const sumY = subset.reduce((sum, val) => sum + val, 0);
  const sumXY = subset.reduce((sum, val, idx) => sum + idx * val, 0);
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return slope * (n - 1) / 2 + intercept + offset;
}

export function getAvg(...values: number[]): number {
  if (!values.length) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

// Helper export functions
export function getRsi(data: number[], period: number): number[] {
  const rsiArr: number[] = [];
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < data.length; i++) {
    const delta = data[i] - data[i - 1];
    if (delta > 0) {
      gain += delta;
    } else {
      loss -= delta;
    }
    if (i < period) {
      rsiArr.push(NaN);
    } else if (i === period) {
      const avgGain = gain / period;
      const avgLoss = loss / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsiArr.push(100 - (100 / (1 + rs)));
    } else {
      const avgGain = (rsiArr[i - 1 - 1] * (period - 1) + (data[i] - data[i - 1] > 0 ? data[i] - data[i - 1] : 0)) / period;
      const avgLoss = (rsiArr[i - 1 - 1] * (period - 1) + (data[i] - data[i - 1] < 0 ? -(data[i] - data[i - 1]) : 0)) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsiArr.push(100 - (100 / (1 + rs)));
    }
  }
  rsiArr.unshift(NaN); // Align with dataList index
  return rsiArr;
}

export function getBarssince(conditionArray: boolean[]): number {
  for (let i = conditionArray.length - 1; i >= 0; i--) {
    if (conditionArray[i]) {
      return conditionArray.length - 1 - i;
    }
  }
  return conditionArray.length;
}


export function getVwap(data: (BarData | CandlestickData | OhlcData)[], volumeData: SingleValueData[]): number {
  let sumPriceVolume = 0;
  let sumVolume = 0;
  data.forEach((bar,i) => {
    const typicalPrice = (bar.high + bar.low + bar.close) / 3;
    sumPriceVolume += typicalPrice * (volumeData[i].value || 0);
    sumVolume += (volumeData[i].value || 0);
  });
  return sumVolume !== 0 ? sumPriceVolume / sumVolume : 0};
/**
 * Calculates the Volume-Weighted Moving Average (VWMA) for the given data and volume arrays.
 * It uses the last `period` values from both data and volume arrays.
 *
 * @param data - The numeric price series.
 * @param volume - The corresponding volume series.
 * @param period - The period over which to calculate the VWMA.
 * @returns The VWMA value or NaN if insufficient data.
 */
export function getVwma(data: number[], volume: number[], period: number): number {
  if (data.length < period || volume.length < period) return NaN;
  const windowData = data.slice(data.length - period);
  const windowVol = volume.slice(data.length - period);
  const priceVolumeSum = windowData.reduce((acc, price, idx) => acc + price * windowVol[idx], 0);
  const volumeSum = windowVol.reduce((acc, vol) => acc + vol, 0);
  return volumeSum !== 0 ? priceVolumeSum / volumeSum : NaN;
}

  /**
   * Returns the median of the entire array.
   * @param arr - Array of numbers.
   * @returns The median value.
   */
  export function getMedian(arr: number[]): number {
    if (arr.length === 0) return NaN;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
  
  /**
   * Returns the mode of the entire array.
   * If multiple values have the same frequency, the smallest one is returned.
   * @param arr - Array of numbers.
   * @returns The mode value.
   */
  export function getMode(arr: number[]): number {
    if (arr.length === 0) return NaN;
    const frequency: Record<number, number> = {};
    let maxFreq = 0;
    let mode = arr[0];
    arr.forEach(val => {
      frequency[val] = (frequency[val] || 0) + 1;
      if (frequency[val] > maxFreq) {
        maxFreq = frequency[val];
        mode = val;
      }
    });
    return mode;
  }
  
  /**
   * Returns the maximum value of the entire array.
   * @param arr - Array of numbers.
   * @returns The maximum value.
   */
  export function getMax(arr: number[]): number {
    return arr.length ? Math.max(...arr) : NaN;
  }
  
  /**
   * Returns the minimum value of the entire array.
   * @param arr - Array of numbers.
   * @returns The minimum value.
   */
  export function getMin(arr: number[]): number {
    return arr.length ? Math.min(...arr) : NaN;
  }
  
  /**
   * Calculates the Stochastic Oscillator %K for given high, low, and close arrays over the specified period.
   * %K = (close - lowestLow) / (highestHigh - lowestLow) * 100
   * @param high - Array of high values.
   * @param low - Array of low values.
   * @param close - Array of close values.
   * @param period - Lookback period.
   * @returns An array of %K values.
   */
  export function getStochastic(high: number[], low: number[], close: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < close.length; i++) {
      if (i < period - 1) {
        result.push(NaN);
      } else {
        const highestHigh = Math.max(...high.slice(i - period + 1, i + 1));
        const lowestLow = Math.min(...low.slice(i - period + 1, i + 1));
        const denominator = highestHigh - lowestLow;
        const k = denominator === 0 ? 0 : ((close[i] - lowestLow) / denominator) * 100;
        result.push(k);
      }
    }
    return result;
  }
  
  /**
   * Computes a sine wave study based on a given wave height and a dynamic or constant wave duration.
   *
   * When wave_durationOrSeries is a number, it is used as a constant duration.
   * When it is an array, each element represents the period at that index.
   *
   * @param wave_height - The amplitude of the sine wave.
   * @param wave_durationOrSeries - Either a constant wave duration (number) or an array for dynamic period.
   * @param length - Optional: the number of points to compute (defaults to 100 if constant period, or the array length if dynamic).
   * @returns An array of sine wave values.
   */
  export function getSineWave(wave_height: number, wave_durationOrSeries: number | number[], length?: number): number[] {
    const pi = Math.PI;
    const result: number[] = [];
    if (typeof wave_durationOrSeries === "number") {
      const wave_duration = wave_durationOrSeries;
      const len = length || 100;
      const w = 2 * pi / wave_duration;
      for (let n = 0; n < len; n++) {
        result.push(wave_height * Math.sin(w * n));
      }
    } else if (Array.isArray(wave_durationOrSeries)) {
      const len = length || wave_durationOrSeries.length;
      for (let n = 0; n < len; n++) {
        const wave_duration = wave_durationOrSeries[n];
        const w = 2 * pi / wave_duration;
        result.push(wave_height * Math.sin(w * n));
      }
    }
    return result;
  }
  

  /**
 * Applies color attributes to each data point in a histogram series.
 * For the first point, the upColor is used.
 * For each subsequent point, if the current value is greater than or equal
 * to the previous value, upColor is used; otherwise, downColor is used.
 *
 * @param data - Array of data points with at least { time, value }.
 * @param upColor - Color to use when the value is rising (default: 'green').
 * @param downColor - Color to use when the value is falling (default: 'red').
 */
export function setHistogramColors(
  data: HistogramData[],
  upColor: string,
  downColor: string
): void {
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      data[i].color = upColor;
    } else {
      const currentValue = data[i].value;
      const previousValue = data[i - 1].value;
      if (!isNaN(currentValue) && !isNaN(previousValue)) {
        data[i].color = currentValue >= previousValue ? upColor : downColor;
      } else {
        data[i].color = upColor;
      }
    }
  }
}
/************************************************
 * Helper: getNumericArray
 * Ensures the override for a param is an array of numbers.
 * If the user passes a single number, we wrap it.
 ************************************************/
export function getNumericArray(
  overrideParams: Record<string, any> | undefined,
  paramName: string,
  defaultArr: number[]
): number[] {
  const val = overrideParams && paramName in overrideParams
    ? overrideParams[paramName]
    : defaultArr;
  return Array.isArray(val) ? val.map(x => Number(x)) : [Number(val)];
}

/************************************************
 * Helper: pickParam
 * For figure index i (0-based), pick arr[i] if exists; otherwise, repeat last.
 ************************************************/
export function pickParam<T extends number>(arr: T[], i: number): T {
  return i < arr.length ? arr[i] : arr[arr.length - 1];
}
/** 
 * A helper function to retrieve (paramMap + overrideParams) for each param key. 
 */
export function getParams(
  definition: IndicatorDefinition,
  overrideParams?: Record<string, any>
): Record<string, any> {
  const combined: Record<string, any> = {};
  for (const [paramName, spec] of Object.entries(definition.paramMap)) {
    const val = overrideParams?.[paramName] ?? spec.defaultValue;
    combined[paramName] = val;
  }
  return combined;
}
/**
 * Computes a numeric Volume-Weighted Moving Average (VWMA) for a series of numbers.
 * @param data - The price series as an array of numbers.
 * @param period - The period over which to calculate the VWMA.
 * @param volume - The volume series as an array of numbers.
 * @returns The VWMA value, or NaN if there is insufficient data.
 */
export function getVwmaNumeric(data: number[], period: number, volume: number[]): number {
  if (data.length < period || volume.length < period) return NaN;
  const windowData = data.slice(data.length - period);
  const windowVol = volume.slice(data.length - period);
  const priceVolSum = windowData.reduce((acc, price, i) => acc + price * windowVol[i], 0);
  const volSum = windowVol.reduce((acc, vol) => acc + vol, 0);
  return volSum !== 0 ? priceVolSum / volSum : NaN;
}

/**
 * Computes a numeric VWAP for a series of numbers.
 * @param data - The price series as an array of numbers.
 * @param volume - The volume series as an array of numbers.
 * @returns The VWAP value, or NaN if there is insufficient data.
 */
export function getVwapNumeric(data: number[], volume: number[]): number {
  if (data.length === 0 || volume.length !== data.length) return NaN;
  let sumPriceVolume = 0;
  let sumVolume = 0;
  for (let i = 0; i < data.length; i++) {
    sumPriceVolume += data[i] * volume[i];
    sumVolume += volume[i];
  }
  return sumVolume !== 0 ? sumPriceVolume / sumVolume : NaN;
}
