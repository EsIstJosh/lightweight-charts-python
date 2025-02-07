import {
  Time,
  OhlcData,
  BarData,
  CandlestickData,
  HistogramData,
  SingleValueData
} from "lightweight-charts";
import {
  getATR,
  getHighest,
  getLowest,
  getAvg,
  getRound,
  getSma,
  getLinreg,
  getEma,
  getRsi,
  getBarssince,
  getVwap,
  setHistogramColors,
  getNumericArray,
  pickParam,
  getVwma,
  getWma,
  getVwapNumeric,
  getVwmaNumeric
} from "./functions";
import { IndicatorDefinition, IndicatorFigure } from "./indicators";
import { ohlcSeriesOptions } from "../ohlc-series/ohlc-series";
import { BarDataAggregator } from "../helpers/series";
import { BarItem } from "../helpers/series";


/************************************************
 * 1) Arnaud Legoux Moving Average (ALMA)
 *    Parameters: length, offset, sigma
 *    Title is set as ALMA{length} (e.g. "ALMA9")
 ************************************************/
export const arnaudLegouxMovingAverage: IndicatorDefinition = {
  name: "Arnaud Legoux Moving Average",
  shortName: "ALMA",
  shouldOhlc: false,
  paramMap: {
    length: { defaultValue: [9], type: "numberArray" },
    offset: { defaultValue: [0.85], type: "numberArray" },
    sigma: { defaultValue: [6], type: "numberArray" },
  },
  calc(dataList, overrideParams) {
    const defLength = this.paramMap.length.defaultValue as number[];
    const defOffset = this.paramMap.offset.defaultValue as number[];
    const defSigma = this.paramMap.sigma.defaultValue as number[];
    const lenArr = getNumericArray(overrideParams, "length", defLength);
    const offArr = getNumericArray(overrideParams, "offset", defOffset);
    const sigArr = getNumericArray(overrideParams, "sigma", defSigma);
    const figureCount = Math.max(lenArr.length, offArr.length, sigArr.length);
    const results: IndicatorFigure[] = [];

    for (let i = 0; i < figureCount; i++) {
      const length = pickParam(lenArr, i);
      const offset = pickParam(offArr, i);
      const sigma = pickParam(sigArr, i);

      const almaArr: SingleValueData[] = [];
      dataList.forEach((bar, idx) => {
        if (idx < length - 1) {
          almaArr.push({ time: bar.time, value: NaN });
          return;
        }
        let norm = 0, sum = 0;
        const m = offset * (length - 1);
        const s = length / sigma;
        for (let j = 0; j < length; j++) {
          const weight = Math.exp(-Math.pow(j - m, 2) / (2 * Math.pow(s, 2)));
          norm += weight;
          const index2 = idx - (length - 1) + j;
          sum += dataList[index2].close * weight;
        }
        almaArr.push({ time: bar.time, value: sum / norm });
      });

      const suffix = figureCount > 1 ? `_${i + 1}` : "";
      // Title follows the old EMA logic: ALMA + the length value (e.g. "ALMA9")
      const key = "alma" + suffix;
      const title = "ALMA" + length + (figureCount > 1 ? ` #${i + 1}` : "");
      results.push({
        key,
        title,
        type: "line",
        data: almaArr,
      });
    }
    return results;
  },
};

/************************************************
 * 2) Bollinger Bands (BOLL)
 *    Parameters: length, multiplier
 *    For each figure, 3 lines are produced (UP, MID, DN).
 *    Titles are set as BOLL_UP{length} etc.
 ************************************************/
const getBollMd = (subset: (BarData | CandlestickData)[], mid: number): number => {
  let sum = 0;
  subset.forEach(bar => {
    const diff = bar.close - mid;
    sum += diff * diff;
  });
  return Math.sqrt(sum / subset.length);
};

export const bollingerBands: IndicatorDefinition = {
  name: "Bollinger Bands",
  shortName: "BOLL",
  shouldOhlc: true,
  paramMap: {
    length: { defaultValue: [20], type: "numberArray" },
    multiplier: { defaultValue: [2], type: "numberArray" },
  },
  calc(dataList, overrideParams) {
    const pArr = getNumericArray(overrideParams, "length", this.paramMap.length.defaultValue as number[]);
    const mArr = getNumericArray(overrideParams, "multiplier", this.paramMap.multiplier.defaultValue as number[]);
    const figureCount = Math.max(pArr.length, mArr.length);
    const allFigs: IndicatorFigure[] = [];

    for (let i = 0; i < figureCount; i++) {
      const length = pickParam(pArr, i);
      const multiplier = pickParam(mArr, i);

      let closeSum = 0;
      const upArr: SingleValueData[] = [];
      const midArr: SingleValueData[] = [];
      const dnArr: SingleValueData[] = [];

      dataList.forEach((bar, idx) => {
        closeSum += bar.close;
        if (idx >= length - 1) {
          const mid = closeSum / length;
          const windowData = dataList.slice(idx - (length - 1), idx + 1);
          const md = getBollMd(windowData, mid);
          upArr.push({ time: bar.time, value: mid + multiplier * md });
          midArr.push({ time: bar.time, value: mid });
          dnArr.push({ time: bar.time, value: mid - multiplier * md });
          closeSum -= dataList[idx - (length - 1)].close;
        } else {
          upArr.push({ time: bar.time, value: NaN });
          midArr.push({ time: bar.time, value: NaN });
          dnArr.push({ time: bar.time, value: NaN });
        }
      });

      const suffix = figureCount > 1 ? `_${i + 1}` : "";
      allFigs.push({
        key: `boll_up${suffix}`,
        title: `BOLL_UP${length}${suffix}`,
        type: "line",
        data: upArr,
      });
      allFigs.push({
        key: `boll_mid${suffix}`,
        title: `BOLL_MID${length}${suffix}`,
        type: "line",
        data: midArr,
      });
      allFigs.push({
        key: `boll_dn${suffix}`,
        title: `BOLL_DN${length}${suffix}`,
        type: "line",
        data: dnArr,
      });
    }
    return allFigs;
  },
};

/************************************************
 * 3) Exponential Moving Average (EMA)
 *    Parameter: length (array)
 *    Title: "EMA" concatenated with the length value (e.g. "EMA12")
 ************************************************/
export const exponentialMovingAverage: IndicatorDefinition = {
  name: "Exponential Moving Average",
  shortName: "EMA",
  shouldOhlc: true,
  paramMap: {
    length: { defaultValue: [6, 12, 20], type: "numberArray" },
  },
  calc(dataList, overrideParams) {
    const arr = getNumericArray(overrideParams, "length", this.paramMap.length.defaultValue as number[]);
    const figs: IndicatorFigure[] = [];
    arr.forEach((val, i) => {
      let emaVal = 0, sum = 0;
      const dataOut: SingleValueData[] = [];
      dataList.forEach((bar, idx) => {
        sum += bar.close;
        if (idx === val - 1) {
          emaVal = sum / val;
        } else if (idx > val - 1) {
          const multiplier = 2 / (val + 1);
          emaVal = (bar.close - emaVal) * multiplier + emaVal;
        }
        if (idx >= val - 1) {
          dataOut.push({ time: bar.time, value: emaVal });
          sum -= dataList[idx - (val - 1)].close;
        } else {
          dataOut.push({ time: bar.time, value: NaN });
        }
      });
      const suffix = arr.length > 1 ? `_${i + 1}` : "";
      const key = "ema" + suffix;
      // Title is the short name followed immediately by the length value
      const title = "EMA" + val + (arr.length > 1 ? ` #${i + 1}` : "");
      figs.push({ key, title, type: "line", data: dataOut });
    });
    return figs;
  },
};

/************************************************
 * 4) Highest High (HH)
 *    Parameter: length (array)
 *    Title: "HH" concatenated with the length value (e.g. "HH14")
 ************************************************/
export const highestHigh: IndicatorDefinition = {
  name: "Highest High",
  shortName: "HH",
  shouldOhlc: true,
  paramMap: {
    length: { defaultValue: [14], type: "numberArray" },
  },
  calc(dataList, overrideParams) {
    const arr = getNumericArray(overrideParams, "length", this.paramMap.length.defaultValue as number[]);
    const out: IndicatorFigure[] = [];
    arr.forEach((val, i) => {
      const hhArr: SingleValueData[] = [];
      dataList.forEach((bar, idx) => {
        if (idx < val - 1) {
          hhArr.push({ time: bar.time, value: NaN });
          return;
        }
        let highest = -Infinity;
        for (let j = idx - (val - 1); j <= idx; j++) {
          highest = Math.max(highest, dataList[j].high);
        }
        hhArr.push({ time: bar.time, value: highest });
      });
      const suffix = arr.length > 1 ? `_${i + 1}` : "";
      const key = "hh" + suffix;
      const title = "HH" + val + (arr.length > 1 ? ` #${i + 1}` : "");
      out.push({ key, title, type: "line", data: hhArr });
    });
    return out;
  },
};

/************************************************
 * 5) Linear Regression (LINREG)
 *    Parameter: length (array)
 *    Title: "LINREG" concatenated with the length value (e.g. "LINREG14")
 ************************************************/
export const linRegIndicator: IndicatorDefinition = {
  name: "Linear Regression",
  shortName: "LINREG",
  shouldOhlc: true,
  paramMap: {
    length: { defaultValue: [14], type: "numberArray" },
  },
  calc(dataList, overrideParams) {
    const arr = getNumericArray(overrideParams, "length", this.paramMap.length.defaultValue as number[]);
    const closeArr: number[] = dataList.map(b => b.close);
    const figs: IndicatorFigure[] = [];
    arr.forEach((val, i) => {
      const linRegArr: SingleValueData[] = [];
      dataList.forEach((bar, idx) => {
        if (idx < val - 1) {
          linRegArr.push({ time: bar.time, value: NaN });
          return;
        }
        const slice = closeArr.slice(idx - (val - 1), idx + 1);
        const linVal = getLinreg(slice, val, 0);
        linRegArr.push({ time: bar.time, value: linVal });
      });
      const suffix = arr.length > 1 ? `_${i + 1}` : "";
      const key = "linreg" + suffix;
      const title = "LINREG" + val + (arr.length > 1 ? ` #${i + 1}` : "");
      figs.push({ key, title, type: "line", data: linRegArr });
    });
    return figs;
  },
};

/************************************************
 * 6) Lowest Low (LL)
 *    Parameter: length (array)
 *    Title: "LL" concatenated with the length value (e.g. "LL14")
 ************************************************/
export const lowestLow: IndicatorDefinition = {
  name: "Lowest Low",
  shortName: "LL",
  shouldOhlc: true,
  paramMap: {
    length: { defaultValue: [14], type: "numberArray" },
  },
  calc(dataList, overrideParams) {
    const arr = getNumericArray(overrideParams, "length", this.paramMap.length.defaultValue as number[]);
    const figs: IndicatorFigure[] = [];
    arr.forEach((val, i) => {
      const llArr: SingleValueData[] = [];
      dataList.forEach((bar, idx) => {
        if (idx < val - 1) {
          llArr.push({ time: bar.time, value: NaN });
          return;
        }
        let lowest = Infinity;
        for (let j = idx - (val - 1); j <= idx; j++) {
          lowest = Math.min(lowest, dataList[j].low);
        }
        llArr.push({ time: bar.time, value: lowest });
      });
      const suffix = arr.length > 1 ? `_${i + 1}` : "";
      const key = "ll" + suffix;
      const title = "LL" + val + (arr.length > 1 ? ` #${i + 1}` : "");
      figs.push({ key, title, type: "line", data: llArr });
    });
    return figs;
  },
};

/************************************************
 * 7) Median
 *    Parameter: length (array)
 *    Title: "Median" concatenated with the length value (e.g. "Median14")
 ************************************************/
export const median: IndicatorDefinition = {
  name: "Median",
  shortName: "Median",
  shouldOhlc: true,
  paramMap: {
    length: { defaultValue: [14], type: "numberArray" },
  },
  calc(dataList, overrideParams) {
    const arr = getNumericArray(overrideParams, "length", this.paramMap.length.defaultValue as number[]);
    const figs: IndicatorFigure[] = [];
    arr.forEach((val, i) => {
      const medArr: SingleValueData[] = [];
      dataList.forEach((bar, idx) => {
        if (idx < val - 1) {
          medArr.push({ time: bar.time, value: NaN });
          return;
        }
        const subset = dataList.slice(idx - (val - 1), idx + 1).map(b => b.close);
        subset.sort((a, b) => a - b);
        const mid = Math.floor(subset.length / 2);
        const medianVal = subset.length % 2 === 0
          ? (subset[mid - 1] + subset[mid]) / 2
          : subset[mid];
        medArr.push({ time: bar.time, value: medianVal });
      });
      const suffix = arr.length > 1 ? `_${i + 1}` : "";
      const key = "median" + suffix;
      const title = "Median" + val + (arr.length > 1 ? ` #${i + 1}` : "");
      figs.push({ key, title, type: "line", data: medArr });
    });
    return figs;
  },
};

/************************************************
 * 8) Moving Average (MA)
 *    Parameter: length (array) (4 values originally)
 *    Title: "MA" concatenated with the length value (e.g. "MA5")
 ************************************************/
export const movingAverage: IndicatorDefinition = {
  name: "Moving Average",
  shortName: "MA",
  shouldOhlc: true,
  paramMap: {
    length: { defaultValue: [5, 10, 30, 60], type: "numberArray" },
  },
  calc(dataList, overrideParams) {
    const arr = getNumericArray(overrideParams, "length", this.paramMap.length.defaultValue as number[]);
    const figs: IndicatorFigure[] = [];
    arr.forEach((val, i) => {
      const maArr: SingleValueData[] = [];
      let sum = 0;
      dataList.forEach((bar, idx) => {
        sum += bar.close;
        if (idx >= val - 1) {
          const avg = sum / val;
          maArr.push({ time: bar.time, value: avg });
          sum -= dataList[idx - (val - 1)].close;
        } else {
          maArr.push({ time: bar.time, value: NaN });
        }
      });
      const suffix = arr.length > 1 ? `_${i + 1}` : "";
      const key = "ma" + suffix;
      const title = "MA" + val + (arr.length > 1 ? ` #${i + 1}` : "");
      figs.push({ key, title, type: "line", data: maArr });
    });
    return figs;
  },
};

/************************************************
 * 9) Rolling Moving Average (RMA)
 *    Parameter: length (array)
 *    Title: "RMA" concatenated with the length value (e.g. "RMA14")
 ************************************************/
export const rollingMovingAverage: IndicatorDefinition = {
  name: "Rolling Moving Average",
  shortName: "RMA",
  shouldOhlc: false,
  paramMap: {
    length: { defaultValue: [14], type: "numberArray" },
  },
  calc(dataList, overrideParams) {
    const arr = getNumericArray(overrideParams, "length", this.paramMap.length.defaultValue as number[]);
    const figs: IndicatorFigure[] = [];
    arr.forEach((val, i) => {
      const alpha = 1 / val;
      let sum = 0;
      const rmaArr: SingleValueData[] = [];
      dataList.forEach((bar, idx) => {
        if (idx === 0) {
          sum = bar.close;
        } else {
          sum = alpha * bar.close + (1 - alpha) * sum;
        }
        rmaArr.push({ time: bar.time, value: sum });
      });
      const suffix = arr.length > 1 ? `_${i + 1}` : "";
      const key = "rma" + suffix;
      const title = "RMA" + val + (arr.length > 1 ? ` #${i + 1}` : "");
      figs.push({ key, title, type: "line", data: rmaArr });
    });
    return figs;
  },
};

/************************************************
 * 10) Simple Moving Average (SMA)
 *    Parameters: n, k (both as arrays)
 *    Title: "SMA" concatenated with n value (e.g. "SMA12,2")
 ************************************************/
export const simpleMovingAverage: IndicatorDefinition = {
  name: "Simple Moving Average",
  shortName: "SMA",
  shouldOhlc: true,
  paramMap: {
    n: { defaultValue: [12], type: "numberArray" },
    k: { defaultValue: [2], type: "numberArray" },
  },
  calc(dataList, overrideParams) {
    const nArr = getNumericArray(overrideParams, "n", this.paramMap.n.defaultValue as number[]);
    const kArr = getNumericArray(overrideParams, "k", this.paramMap.k.defaultValue as number[]);
    const figureCount = Math.max(nArr.length, kArr.length);
    const figs: IndicatorFigure[] = [];
    for (let i = 0; i < figureCount; i++) {
      const nVal = pickParam(nArr, i);
      const kVal = pickParam(kArr, i);
      let closeSum = 0;
      let smaVal = 0;
      const smaArr: SingleValueData[] = [];
      dataList.forEach((bar, idx) => {
        closeSum += bar.close;
        if (idx >= nVal - 1) {
          if (idx === nVal - 1) {
            smaVal = closeSum / nVal;
          } else {
            smaVal = (bar.close * kVal + smaVal * (nVal - kVal)) / nVal;
          }
          closeSum -= dataList[idx - (nVal - 1)].close;
          smaArr.push({ time: bar.time, value: smaVal });
        } else {
          smaArr.push({ time: bar.time, value: NaN });
        }
      });
      const suffix = figureCount > 1 ? `_${i + 1}` : "";
      const key = "sma" + suffix;
      const title = "SMA" + nVal + "," + kVal + (figureCount > 1 ? ` #${i + 1}` : "");
      figs.push({ key, title, type: "line", data: smaArr });
    }
    return figs;
  },
};

/************************************************
 * 11) Stop and Reverse (SAR)
 *    Parameters: accStart, accStep, accMax (arrays)
 *    Title: "SAR" concatenated with accStart value (e.g. "SAR0.02,0.02,0.20")
 ************************************************/
export const stopAndReverse: IndicatorDefinition = {
  name: "Stop and Reverse",
  shortName: "SAR",
  shouldOhlc: true,
  paramMap: {
    accStart: { defaultValue: [0.02], type: "numberArray" },
    accStep: { defaultValue: [0.02], type: "numberArray" },
    accMax: { defaultValue: [0.20], type: "numberArray" },
  },
  calc(dataList, overrideParams) {
    const startArr = getNumericArray(
      overrideParams,
      "accStart",
      this.paramMap.accStart.defaultValue as number[]
    );
    const stepArr = getNumericArray(
      overrideParams,
      "accStep",
      this.paramMap.accStep.defaultValue as number[]
    );
    const maxArr = getNumericArray(
      overrideParams,
      "accMax",
      this.paramMap.accMax.defaultValue as number[]
    );
    const figureCount = Math.max(startArr.length, stepArr.length, maxArr.length);
    const figs: IndicatorFigure[] = [];
    for (let i = 0; i < figureCount; i++) {
      const accStart = pickParam(startArr, i);
      const accStep = pickParam(stepArr, i);
      const accMax = pickParam(maxArr, i);
  
      let af = accStart;
      let ep = 0;
      let sarVal = 0;
      let isUp = false;
      const sarArr: SingleValueData[] = [];
      dataList.forEach((bar, idx) => {
        if (idx === 0) {
          sarArr.push({ time: bar.time, value: NaN });
          return;
        }
        if (idx === 1) {
          isUp = bar.close > dataList[0].close;
          ep = isUp ? bar.high : bar.low;
          sarVal = isUp ? dataList[0].low : dataList[0].high;
          sarArr.push({ time: dataList[0].time, value: sarVal });
        }
        sarVal = sarVal + af * (ep - sarVal);
        if (isUp) {
          if (bar.low < sarVal) {
            isUp = false;
            sarVal = ep;
            af = accStart;
            ep = bar.low;
          } else {
            if (bar.high > ep) {
              ep = bar.high;
              af = Math.min(af + accStep, accMax);
            }
          }
        } else {
          if (bar.high > sarVal) {
            isUp = true;
            sarVal = ep;
            af = accStart;
            ep = bar.high;
          } else {
            if (bar.low < ep) {
              ep = bar.low;
              af = Math.min(af + accStep, accMax);
            }
          }
        }
        sarArr.push({ time: bar.time, value: sarVal });
      });
      const suffix = figureCount > 1 ? `_${i + 1}` : "";
      const key = "sar" + suffix;
      const title = "SAR" + accStart + "," + accStep + "," + accMax + (figureCount > 1 ? ` #${i + 1}` : "");
      figs.push({ key, title, type: "line", data: sarArr });
    }
    return figs;
  },
};

/************************************************
 * 12) Super Trend
 *    Parameters: factor, atrPeriod (arrays)
 *    Title: "SuperTrend" concatenated with factor (e.g. "SuperTrend3")
 *    (Note: Two lines are produced per figure: one for the trend and one for the direction.)
 ************************************************/
export const superTrend: IndicatorDefinition = {
  name: "Super Trend",
  shortName: "SuperTrend",
  shouldOhlc: true,
  paramMap: {
    factor: { defaultValue: [3], type: "numberArray" },
    atrPeriod: { defaultValue: [10], type: "numberArray" },
  },
  calc(dataList, overrideParams) {
    const factorArr = getNumericArray(overrideParams, "factor", this.paramMap.factor.defaultValue as number[]);
    const atrArr = getNumericArray(overrideParams, "atrPeriod", this.paramMap.atrPeriod.defaultValue as number[]);
    const figureCount = Math.max(factorArr.length, atrArr.length);
    const figs: IndicatorFigure[] = [];
  
    for (let i = 0; i < figureCount; i++) {
      const factor = pickParam(factorArr, i);
      const length = pickParam(atrArr, i); // atrPeriod renamed to length here for unification
      const stArr: SingleValueData[] = [];
      const dirArr: SingleValueData[] = [];
      let prevSuperTrend = NaN;
      let prevUpperBand = NaN;
      let prevLowerBand = NaN;
      let direction = NaN;
      dataList.forEach((bar, idx) => {
        if (idx < length - 1) {
          stArr.push({ time: bar.time, value: NaN });
          dirArr.push({ time: bar.time, value: NaN });
          return;
        }
        // Compute ATR over the last 'length' bars
        let sumTR = 0;
        for (let k = idx - (length - 1); k <= idx; k++) {
          const prevClose = dataList[k - 1]?.close ?? dataList[k].close;
          const cTr = Math.max(
            dataList[k].high - dataList[k].low,
            Math.abs(dataList[k].high - prevClose),
            Math.abs(dataList[k].low - prevClose)
          );
          sumTR += cTr;
        }
        const atr = sumTR / length;
        const src = (bar.high + bar.low) / 2;
        let upperBand = src + factor * atr;
        let lowerBand = src - factor * atr;
        if (!isNaN(prevLowerBand)) {
          lowerBand = lowerBand > prevLowerBand || dataList[idx - 1].close < prevLowerBand
            ? lowerBand
            : prevLowerBand;
        }
        if (!isNaN(prevUpperBand)) {
          upperBand = upperBand < prevUpperBand || dataList[idx - 1].close > prevUpperBand
            ? upperBand
            : prevUpperBand;
        }
        if (isNaN(prevSuperTrend)) {
          direction = 1;
        } else if (prevSuperTrend === prevUpperBand) {
          direction = bar.close > upperBand ? -1 : 1;
        } else {
          direction = bar.close < lowerBand ? 1 : -1;
        }
        const stVal = direction === -1 ? lowerBand : upperBand;
        stArr.push({ time: bar.time, value: stVal });
        dirArr.push({ time: bar.time, value: direction });
        prevSuperTrend = stVal;
        prevUpperBand = upperBand;
        prevLowerBand = lowerBand;
      });
      const suffix = figureCount > 1 ? `_${i + 1}` : "";
      figs.push({
        key: "superTrend" + suffix,
        title: "SuperTrend" + factor + (figureCount > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: stArr,
      });
      figs.push({
        key: "direction" + suffix,
        title: "Direction" + (figureCount > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: dirArr,
      });
    }
    return figs;
  },
};

/************************************************
 * 13) Symmetric Weighted Moving Average (SWMA)
 *    Parameter: window (array)
 *    Title: "SWMA" concatenated with the window (e.g. "SWMA4")
 ************************************************/
export const symmetricWeightedMovingAverage: IndicatorDefinition = {
  name: "Symmetrically Weighted Moving Average",
  shortName: "SWMA",
  shouldOhlc: false,
  paramMap: {
    window: { defaultValue: [4], type: "numberArray" },
  },
  calc(dataList, overrideParams) {
    const windowArr = getNumericArray(overrideParams, "window", this.paramMap.window.defaultValue as number[]);
    const figs: IndicatorFigure[] = [];
    windowArr.forEach((win, i) => {
      const swmaArr: SingleValueData[] = [];
      dataList.forEach((bar, idx) => {
        if (idx < win - 1) {
          swmaArr.push({ time: bar.time, value: NaN });
          return;
        }
        let numerator = 0, denominator = 0;
        for (let j = 0; j < win; j++) {
          const weight = j + 1;
          numerator += dataList[idx - (win - 1) + j].close * weight;
          denominator += weight;
        }
        swmaArr.push({ time: bar.time, value: numerator / denominator });
      });
      const suffix = windowArr.length > 1 ? `_${i + 1}` : "";
      const key = "swma" + suffix;
      const title = "SWMA" + win + (windowArr.length > 1 ? ` #${i + 1}` : "");
      figs.push({ key, title, type: "line", data: swmaArr });
    });
    return figs;
  },
};

/************************************************
 * 14) Triple Exponentially Smoothed Average (TRIX)
 *    Parameters: n, m (arrays)
 *    Title: "TRIX" concatenated with n value (e.g. "TRIX12")
 *    Produces 2 lines: one for TRIX and one for its moving average ("MATRIX")
 ************************************************/
export const tripleExponentiallySmoothedAverage: IndicatorDefinition = {
  name: "TRIX",
  shortName: "TRIX",
  shouldOhlc: true,
  paramMap: {
    n: { defaultValue: [12], type: "numberArray" },
    m: { defaultValue: [9], type: "numberArray" },
  },
  calc(dataList, overrideParams) {
    const nArr = getNumericArray(overrideParams, "n", this.paramMap.n.defaultValue as number[]);
    const mArr = getNumericArray(overrideParams, "m", this.paramMap.m.defaultValue as number[]);
    const figureCount = Math.max(nArr.length, mArr.length);
    const figs: IndicatorFigure[] = [];
    for (let i = 0; i < figureCount; i++) {
      const N = pickParam(nArr, i);
      const M = pickParam(mArr, i);
      let ema1 = 0, ema2 = 0, ema3 = 0;
      let sumClose = 0;
      const trixArr: SingleValueData[] = [];
      const maTrixArr: SingleValueData[] = [];
      let trixSum = 0;
      const buffer: number[] = [];
      dataList.forEach((bar, idx) => {
        sumClose += bar.close;
        if (idx === N - 1) {
          ema1 = sumClose / N;
        } else if (idx > N - 1) {
          ema1 = (bar.close * 2 + (N - 1) * ema1) / (N + 1);
        }
        if (idx >= N - 1) {
          if (idx === 2 * N - 2) {
            ema2 = ema1;
          } else if (idx > 2 * N - 2) {
            ema2 = (ema1 * 2 + (N - 1) * ema2) / (N + 1);
          }
        }
        let trVal = NaN;
        if (idx >= 2 * N - 2) {
          if (idx === 3 * N - 3) {
            ema3 = ema2;
          } else if (idx > 3 * N - 3) {
            const old = ema3;
            ema3 = (ema2 * 2 + (N - 1) * old) / (N + 1);
            trVal = ((ema3 - old) / old) * 100;
          }
        }
        trixArr.push({ time: bar.time, value: trVal });
        buffer.push(trVal);
        trixSum += isNaN(trVal) ? 0 : trVal;
        if (buffer.length > M) {
          const oldest = buffer[buffer.length - 1 - M];
          trixSum -= isNaN(oldest) ? 0 : oldest;
        }
        const maVal = buffer.length >= M && !isNaN(trVal) ? trixSum / M : NaN;
        maTrixArr.push({ time: bar.time, value: maVal });
      });
      const suffix = figureCount > 1 ? `_${i + 1}` : "";
      figs.push({
        key: "trix" + suffix,
        title: "TRIX" + N + (figureCount > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: trixArr,
      });
      figs.push({
        key: "maTrix" + suffix,
        title: figureCount > 1 ? `MATRIX #${i + 1}` : "MATRIX",
        type: "line",
        data: maTrixArr,
      });
    }
    return figs;
  },
};

/************************************************
 * 15) Volume Weighted Average Price (VWAP)
 *    Parameter: anchorInterval (array)
 *    Title: "VWAP" concatenated with anchorInterval (e.g. "VWAP1")
 ************************************************/
export const volumeWeightedAveragePrice: IndicatorDefinition = {
  name: "Volume Weighted Average Price",
  shortName: "VWAP",
  shouldOhlc: true,
  paramMap: {
    anchorInterval: { defaultValue: [1], type: "numberArray" },
  },
  calc(dataList, overrideParams, volumeData) {
    if (!volumeData) {
      return [
        { key: "vwap", title: "VWAP", type: "line", data: [] }
      ];
    }
    const arr = getNumericArray(
      overrideParams,
      "anchorInterval",
      this.paramMap.anchorInterval.defaultValue as number[]
    );
    const figs: IndicatorFigure[] = [];
    arr.forEach((val, i) => {
      let cumulativeVolume = 0,
        cumulativeVWAP = 0;
      const vwapArr: SingleValueData[] = [];
      dataList.forEach((bar, idx) => {
        if (idx % val === 0) {
          cumulativeVolume = 0;
          cumulativeVWAP = 0;
        }
        const volume = volumeData[idx]?.value ?? 0;
        const typicalPrice = (bar.high + bar.low + bar.close) / 3;
        cumulativeVWAP += typicalPrice * volume;
        cumulativeVolume += volume;
        const vwapVal = cumulativeVolume !== 0 ? cumulativeVWAP / cumulativeVolume : NaN;
        vwapArr.push({ time: bar.time, value: vwapVal });
      });
      const suffix = arr.length > 1 ? `_${i + 1}` : "";
      figs.push({
        key: "vwap" + suffix,
        title: "VWAP" + val + (arr.length > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: vwapArr,
      });
    });
    return figs;
  },
};

/************************************************
 * 16) Volume Weighted Moving Average (VWMA)
 *    Parameter: length (array)
 *    Title: "VWMA" concatenated with the length value (e.g. "VWMA20")
 ************************************************/
export const volumeWeightedMovingAverage: IndicatorDefinition = {
  name: "Volume Weighted Moving Average",
  shortName: "VWMA",
  shouldOhlc: true,
  paramMap: {
    length: { defaultValue: [20], type: "numberArray" },
  },
  calc(dataList, overrideParams, volumeData) {
    if (!volumeData) {
      return [
        { key: "vwma", title: "VWMA", type: "line", data: [] }
      ];
    }
    const arr = getNumericArray(
      overrideParams,
      "length",
      this.paramMap.length.defaultValue as number[]
    );
    const figs: IndicatorFigure[] = [];
    arr.forEach((val, i) => {
      let sumVolumePrice = 0,
        sumVolume = 0;
      const vwmaArr: SingleValueData[] = [];
      dataList.forEach((bar, idx) => {
        const volume = volumeData[idx]?.value ?? 0;
        sumVolumePrice += bar.close * volume;
        sumVolume += volume;
        if (idx >= val - 1) {
          const avg = sumVolume !== 0 ? sumVolumePrice / sumVolume : NaN;
          vwmaArr.push({ time: bar.time, value: avg });
          const oldVolume = volumeData[idx - (val - 1)].value ?? 0;
          sumVolumePrice -= dataList[idx - (val - 1)].close * oldVolume;
          sumVolume -= oldVolume;
        } else {
          vwmaArr.push({ time: bar.time, value: NaN });
        }
      });
      const suffix = arr.length > 1 ? `_${i + 1}` : "";
      figs.push({
        key: "vwma" + suffix,
        title: "VWMA" + val + (arr.length > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: vwmaArr,
      });
    });
    return figs;
  },
};

/************************************************
 * 17) Weighted Moving Average (WMA)
 *    Parameter: length (array)
 *    Title: "WMA" concatenated with the length value (e.g. "WMA9")
 ************************************************/
export const weightedMovingAverage: IndicatorDefinition = {
  name: "Weighted Moving Average",
  shortName: "WMA",
  shouldOhlc: false,
  paramMap: {
    length: { defaultValue: [9], type: "numberArray" },
  },
  calc(dataList, overrideParams) {
    const arr = getNumericArray(
      overrideParams,
      "length",
      this.paramMap.length.defaultValue as number[]
    );
    const figs: IndicatorFigure[] = [];
    arr.forEach((val, i) => {
      const wmaArr: SingleValueData[] = [];
      dataList.forEach((bar, idx) => {
        if (idx < val - 1) {
          wmaArr.push({ time: bar.time, value: NaN });
          return;
        }
        let norm = 0,
          sum = 0;
        for (let j = 0; j < val; j++) {
          const weight = val - j;
          norm += weight;
          sum += dataList[idx - j].close * weight;
        }
        wmaArr.push({ time: bar.time, value: sum / norm });
      });
      const suffix = arr.length > 1 ? `_${i + 1}` : "";
      figs.push({
        key: "wma" + suffix,
        title: "WMA" + val + (arr.length > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: wmaArr,
      });
    });
    return figs;
  },
};
export const highestHighLowestLow: IndicatorDefinition = {
  name: "High & Low",
  shortName: "HHLL",
  shouldOhlc: true,
  paramMap: {
    length: { defaultValue: [14], type: "numberArray" },
  },
  calc(dataList, overrideParams) {
    // Get the length values (as an array of numbers)
    const arr = getNumericArray(
      overrideParams,
      "length",
      this.paramMap.length.defaultValue as number[]
    );
    const figs: IndicatorFigure[] = [];
    
    arr.forEach((val, i) => {
      const hhArr: SingleValueData[] = [];
      const llArr: SingleValueData[] = [];
      
      // Iterate through each data bar to compute both HH and LL
      dataList.forEach((bar, idx) => {
        if (idx < val - 1) {
          hhArr.push({ time: bar.time, value: NaN });
          llArr.push({ time: bar.time, value: NaN });
          return;
        }
        
        let highest = -Infinity;
        let lowest = Infinity;
        for (let j = idx - (val - 1); j <= idx; j++) {
          highest = Math.max(highest, dataList[j].high);
          lowest = Math.min(lowest, dataList[j].low);
        }
        
        hhArr.push({ time: bar.time, value: highest });
        llArr.push({ time: bar.time, value: lowest });
      });
      
      const suffix = arr.length > 1 ? `_${i + 1}` : "";
      figs.push({
        key: "hh" + suffix,
        title: "HH" + val + (arr.length > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: hhArr,
      });
      figs.push({
        key: "ll" + suffix,
        title: "LL" + val + (arr.length > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: llArr,
      });
    });
    
    return figs;
  },
};



export const OVERLAYS : IndicatorDefinition[] = [
  // Overlay Indicators
  arnaudLegouxMovingAverage,
  bollingerBands,
  exponentialMovingAverage,
  highestHigh,
  highestHighLowestLow,
  linRegIndicator,
  lowestLow,
  median,
  movingAverage,
  rollingMovingAverage,
  simpleMovingAverage,
  stopAndReverse,
  superTrend,
  symmetricWeightedMovingAverage,
  tripleExponentiallySmoothedAverage,
  volumeWeightedAveragePrice,
  volumeWeightedMovingAverage,
  weightedMovingAverage,
  // Oscillator Indicators (unchanged)

];
