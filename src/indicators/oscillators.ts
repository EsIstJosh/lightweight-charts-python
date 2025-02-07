/* 
  Partial Integration of KLineCharts' Indicators with Lightweight Charts
  ===============================================================

*/

import {
  Time,
  OhlcData,
  BarData,
  CandlestickData,
  HistogramData,
  SingleValueData
} from 'lightweight-charts';
import { getATR, getHighest, getLowest, getAvg, getRound, getSma, getLinreg, getEma, getRsi, getBarssince, getVwap, setHistogramColors, getParams, getNumericArray, pickParam } from './functions';
import { IndicatorDefinition, IndicatorFigure } from './indicators';


/************************************************
 * Oscillator Indicators (other than MACD)
 ************************************************/

/* 1) awesomeOscillator */
export const awesomeOscillator: IndicatorDefinition = {
  name: "Awesome Oscillator",
  shortName: "AO",
  shouldOhlc: true,
  paramMap: {
    shortPeriod: { defaultValue: [5], type: "numberArray", min: 1, max: 100 },
    longPeriod: { defaultValue: [34], type: "numberArray", min: 1, max: 200 },
  },
  calc(dataList, overrideParams) {
    const shortArr = getNumericArray(overrideParams, "shortPeriod", [5]);
    const longArr = getNumericArray(overrideParams, "longPeriod", [34]);
    const figureCount = Math.max(shortArr.length, longArr.length);
    const results: IndicatorFigure[] = [];
    for (let i = 0; i < figureCount; i++) {
      const shortP = pickParam(shortArr, i);
      const longP = pickParam(longArr, i);
      const maxP = Math.max(shortP, longP);
      let shortSum = 0, longSum = 0;
      const aoArr: SingleValueData[] = [];
      dataList.forEach((bar, idx) => {
        const mid = (bar.high + bar.low) / 2;
        shortSum += mid;
        longSum += mid;
        let sMa = NaN, lMa = NaN;
        if (idx >= shortP - 1) {
          sMa = shortSum / shortP;
          const removeVal = (dataList[idx - (shortP - 1)].high + dataList[idx - (shortP - 1)].low) / 2;
          shortSum -= removeVal;
        }
        if (idx >= longP - 1) {
          lMa = longSum / longP;
          const removeVal = (dataList[idx - (longP - 1)].high + dataList[idx - (longP - 1)].low) / 2;
          longSum -= removeVal;
        }
        let aoVal = NaN;
        if (idx >= maxP - 1) {
          aoVal = sMa - lMa;
        }
        aoArr.push({ time: bar.time, value: aoVal });
      });
      const suffix = figureCount > 1 ? `_${i + 1}` : "";
      const key = "ao" + suffix;
      const title = "AO" + pickParam(shortArr, i) + (figureCount > 1 ? ` #${i + 1}` : "");
      // Optional color parameters remain unchanged.
      const upColor = overrideParams?.upColor ?? "green";
      const downColor = overrideParams?.downColor ?? "red";
      setHistogramColors(aoArr, upColor, downColor);
      results.push({
        key,
        title,
        type: "histogram",
        data: aoArr,
        pane: 1
      });
    }
    return results;
  },
};

/* 2) Average True Range (ATR) */
export const averageTrueRange: IndicatorDefinition = {
  name: "Average True Range",
  shortName: "ATR",
  shouldOhlc: true,
  paramMap: {
    length: { defaultValue: [14], type: "numberArray", min: 1, max: 100 },
  },
  calc(dataList, overrideParams) {
    const arr = getNumericArray(overrideParams, "length", [14]);
    const results: IndicatorFigure[] = [];
    arr.forEach((length, i) => {
      const atrArr: SingleValueData[] = [];
      let sumTR = 0;
      const trValues: number[] = [];
      dataList.forEach((bar, idx) => {
        if (idx === 0) {
          atrArr.push({ time: bar.time, value: NaN });
          return;
        }
        const prevClose = dataList[idx - 1].close;
        const tr = Math.max(
          bar.high - bar.low,
          Math.abs(bar.high - prevClose),
          Math.abs(bar.low - prevClose)
        );
        trValues.push(tr);
        sumTR += tr;
        if (trValues.length > length) {
          sumTR -= trValues.shift()!;
        }
        const atrVal = trValues.length >= length ? sumTR / length : NaN;
        atrArr.push({ time: bar.time, value: atrVal });
      });
      const suffix = arr.length > 1 ? `_${i + 1}` : "";
      results.push({
        key: "atr" + suffix,
        title: "ATR" + length + (arr.length > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: atrArr,
        pane: 1

      });
    });
    return results;
  },
};

/* 3) Bias */
export const bias: IndicatorDefinition = {
  name: "Bias",
  shortName: "BIAS",
  shouldOhlc: true,
  paramMap: {
    period1: { defaultValue: [6], type: "numberArray", min: 1, max: 999 },
    period2: { defaultValue: [12], type: "numberArray", min: 1, max: 999 },
    period3: { defaultValue: [24], type: "numberArray", min: 1, max: 999 },
  },
  calc(dataList, overrideParams) {
    const p1Arr = getNumericArray(overrideParams, "period1", [6]);
    const p2Arr = getNumericArray(overrideParams, "period2", [12]);
    const p3Arr = getNumericArray(overrideParams, "period3", [24]);
    const figureCount = Math.max(p1Arr.length, p2Arr.length, p3Arr.length);
    const results: IndicatorFigure[] = [];
    for (let i = 0; i < figureCount; i++) {
      const p1 = pickParam(p1Arr, i);
      const p2 = pickParam(p2Arr, i);
      const p3 = pickParam(p3Arr, i);
      const arrP = [p1, p2, p3];
      const sums = arrP.map(() => 0);
      // Produce three lines in one set
      const figs: IndicatorFigure[] = arrP.map((val, idx) => ({
        key: `bias${idx + 1}` + (figureCount > 1 ? `_${i + 1}` : ""),
        title: `BIAS${val}` + (figureCount > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: [],
        pane: 1

      }));
      dataList.forEach((bar, idx) => {
        const c = bar.close;
        arrP.forEach((period, j) => {
          sums[j] += c;
          if (idx >= period - 1) {
            const mean = sums[j] / period;
            const biasVal = ((c - mean) / mean) * 100;
            figs[j].data.push({ time: bar.time, value: biasVal });
            sums[j] -= dataList[idx - (period - 1)].close;
          } else {
            figs[j].data.push({ time: bar.time, value: NaN });
          }
        });
      });
      results.push(...figs);
    }
    return results;
  },
};

/* 4) BRAR (Buy-Ratio Analysis) */
export const brar: IndicatorDefinition = {
  name: "Buy-Ratio Analysis",
  shortName: "BRAR",
  shouldOhlc: true,
  paramMap: {
    length: { defaultValue: [26], type: "numberArray", min: 1 },
  },
  calc(dataList, overrideParams) {
    const arr = getNumericArray(overrideParams, "length", [26]);
    const results: IndicatorFigure[] = [];
    arr.forEach((length, i) => {
      let hcy = 0, cyl = 0, ho = 0, ol = 0;
      const brData: SingleValueData[] = [];
      const arData: SingleValueData[] = [];
      dataList.forEach((bar, idx) => {
        const prev = idx - 1 >= 0 ? dataList[idx - 1] : bar;
        ho += bar.high - bar.open;
        ol += bar.open - bar.low;
        hcy += bar.high - prev.close;
        cyl += prev.close - bar.low;
        if (idx >= length - 1) {
          const brVal = cyl !== 0 ? (hcy / cyl) * 100 : 0;
          const arVal = ol !== 0 ? (ho / ol) * 100 : 0;
          brData.push({ time: bar.time, value: brVal });
          arData.push({ time: bar.time, value: arVal });
          const oldBar = dataList[idx - (length - 1)];
          const oldPrev = idx - length >= 0 ? dataList[idx - length] : oldBar;
          hcy -= (oldBar.high - oldPrev.close);
          cyl -= (oldPrev.close - oldBar.low);
          ho -= (oldBar.high - oldBar.open);
          ol -= (oldBar.open - oldBar.low);
        } else {
          brData.push({ time: bar.time, value: NaN });
          arData.push({ time: bar.time, value: NaN });
        }
      });
      const suffix = arr.length > 1 ? `_${i + 1}` : "";
      results.push({
        key: "br" + suffix,
        title: "BR" + length + (arr.length > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: brData,
        pane: 1

      });
      results.push({
        key: "ar" + suffix,
        title: "AR" + length + (arr.length > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: arData,
        pane: 1

      });
    });
    return results;
  },
};

/* 5) Bull and Bear Index (BBI) */
export const bullAndBearIndex: IndicatorDefinition = {
  name: "Bull and Bear Index",
  shortName: "BBI",
  shouldOhlc: true,
  paramMap: {
    p1: { defaultValue: [3], type: "numberArray", min: 1 },
    p2: { defaultValue: [6], type: "numberArray", min: 1 },
    p3: { defaultValue: [12], type: "numberArray", min: 1 },
    p4: { defaultValue: [24], type: "numberArray", min: 1 },
  },
  calc(dataList, overrideParams) {
    const p1Arr = getNumericArray(overrideParams, "p1", [3]);
    const p2Arr = getNumericArray(overrideParams, "p2", [6]);
    const p3Arr = getNumericArray(overrideParams, "p3", [12]);
    const p4Arr = getNumericArray(overrideParams, "p4", [24]);
    const figureCount = Math.max(p1Arr.length, p2Arr.length, p3Arr.length, p4Arr.length);
    const results: IndicatorFigure[] = [];
    for (let i = 0; i < figureCount; i++) {
      const p1 = pickParam(p1Arr, i);
      const p2 = pickParam(p2Arr, i);
      const p3 = pickParam(p3Arr, i);
      const p4 = pickParam(p4Arr, i);
      const params = [p1, p2, p3, p4];
      const sums = [0, 0, 0, 0];
      const mas = [0, 0, 0, 0];
      const bbiArr: SingleValueData[] = [];
      dataList.forEach((bar, idx) => {
        const c = bar.close;
        params.forEach((pVal, j) => {
          sums[j] += c;
          if (idx >= pVal - 1) {
            mas[j] = sums[j] / pVal;
            sums[j] -= dataList[idx - (pVal - 1)].close;
          }
        });
        if (idx >= Math.max(...params) - 1) {
          const val = (mas[0] + mas[1] + mas[2] + mas[3]) / 4;
          bbiArr.push({ time: bar.time, value: val });
        } else {
          bbiArr.push({ time: bar.time, value: NaN });
        }
      });
      const suffix = figureCount > 1 ? `_${i + 1}` : "";
      results.push({
        key: "bbi" + suffix,
        title: "BBI" + [p1, p2, p3, p4].join(",") + (figureCount > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: bbiArr,
        pane: 1

      });
    }
    return results;
  },
};

/* 6) Commodity Channel Index (CCI) */
export const commodityChannelIndex: IndicatorDefinition = {
  name: "Commodity Channel Index",
  shortName: "CCI",
  shouldOhlc: true,
  paramMap: {
    length: { defaultValue: [20], type: "numberArray", min: 1 },
  },
  calc(dataList, overrideParams) {
    const arr = getNumericArray(overrideParams, "length", [20]);
    const results: IndicatorFigure[] = [];
    arr.forEach((length, i) => {
      let tpSum = 0;
      const tpList: number[] = [];
      const cciArr: SingleValueData[] = [];
      dataList.forEach((bar, idx) => {
        const tp = (bar.high + bar.low + bar.close) / 3;
        tpSum += tp;
        tpList.push(tp);
        if (idx >= length - 1) {
          const maTp = tpSum / length;
          let sumAbs = 0;
          for (let j = idx - (length - 1); j <= idx; j++) {
            sumAbs += Math.abs(tpList[j] - maTp);
          }
          const md = sumAbs / length;
          const cciVal = md !== 0 ? ((tp - maTp) / (md * 0.015)) : 0;
          cciArr.push({ time: bar.time, value: cciVal });
          const agoTp = (dataList[idx - (length - 1)].high +
                         dataList[idx - (length - 1)].low +
                         dataList[idx - (length - 1)].close) / 3;
          tpSum -= agoTp;
        } else {
          cciArr.push({ time: bar.time, value: NaN });
        }
      });
      const suffix = arr.length > 1 ? `_${i + 1}` : "";
      results.push({
        key: "cci" + suffix,
        title: "CCI" + length + (arr.length > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: cciArr,
        pane: 1
      });
    });
    return results;
  },
};

/* 7) Current Ratio (CR) */
export const currentRatio: IndicatorDefinition = {
  name: "Current Ratio",
  shortName: "CR",
  shouldOhlc: true,
  paramMap: {
    length: { defaultValue: [26], type: "numberArray", min: 1 },
  },
  calc(dataList, overrideParams) {
    const arr = getNumericArray(overrideParams, "length", [26]);
    const results: IndicatorFigure[] = [];
    arr.forEach((length, i) => {
      let sumNum = 0, sumDen = 0;
      const queueNum: number[] = [];
      const queueDen: number[] = [];
      const crArr: SingleValueData[] = [];
      dataList.forEach((bar, idx) => {
        const prev = idx - 1 >= 0 ? dataList[idx - 1] : bar;
        const mid = (prev.high + prev.low) / 2;
        const highSubMid = Math.max(0, bar.high - mid);
        const midSubLow = Math.max(0, mid - bar.low);
        sumNum += highSubMid;
        sumDen += midSubLow;
        queueNum.push(highSubMid);
        queueDen.push(midSubLow);
        let crVal = NaN;
        if (idx >= length - 1) {
          crVal = sumDen !== 0 ? (sumNum / sumDen) * 100 : 0;
          sumNum -= queueNum[idx - (length - 1)];
          sumDen -= queueDen[idx - (length - 1)];
        }
        crArr.push({ time: bar.time, value: crVal });
      });
      const suffix = arr.length > 1 ? `_${i + 1}` : "";
      results.push({
        key: "cr" + suffix,
        title: "CR" + length + (arr.length > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: crArr,
        pane: 1
      });
    });
    return results;
  },
};

/* 8) Difference of Moving Average (DMA)
   Parameters: n1, n2, m */
export const differentOfMovingAverage: IndicatorDefinition = {
  name: "Difference of Moving Average",
  shortName: "DMA",
  shouldOhlc: true,
  paramMap: {
    n1: { defaultValue: [10], type: "numberArray", min: 1 },
    n2: { defaultValue: [50], type: "numberArray", min: 1 },
    m: { defaultValue: [10], type: "numberArray", min: 1 },
  },
  calc(dataList, overrideParams) {
    const n1Arr = getNumericArray(overrideParams, "n1", [10]);
    const n2Arr = getNumericArray(overrideParams, "n2", [50]);
    const mArr = getNumericArray(overrideParams, "m", [10]);
    const figureCount = Math.max(n1Arr.length, n2Arr.length, mArr.length);
    const results: IndicatorFigure[] = [];
    for (let i = 0; i < figureCount; i++) {
      const n1 = pickParam(n1Arr, i);
      const n2 = pickParam(n2Arr, i);
      const mVal = pickParam(mArr, i);
      const maxP = Math.max(n1, n2);
      let sum1 = 0, sum2 = 0, dmaSum = 0;
      const dmaArr: SingleValueData[] = [];
      const amaArr: SingleValueData[] = [];
      const resultsDma: number[] = [];
      dataList.forEach((bar, idx) => {
        sum1 += bar.close;
        sum2 += bar.close;
        let ma1 = NaN, ma2 = NaN;
        if (idx >= n1 - 1) {
          ma1 = sum1 / n1;
          sum1 -= dataList[idx - (n1 - 1)].close;
        }
        if (idx >= n2 - 1) {
          ma2 = sum2 / n2;
          sum2 -= dataList[idx - (n2 - 1)].close;
        }
        if (idx >= maxP - 1) {
          const dif = ma1 - ma2;
          resultsDma.push(dif);
          dmaArr.push({ time: bar.time, value: dif });
          dmaSum += dif;
          if (resultsDma.length > mVal) {
            dmaSum -= resultsDma[resultsDma.length - 1 - mVal];
            const amaVal = dmaSum / mVal;
            amaArr.push({ time: bar.time, value: amaVal });
          } else {
            amaArr.push({ time: bar.time, value: NaN });
          }
        } else {
          dmaArr.push({ time: bar.time, value: NaN });
          amaArr.push({ time: bar.time, value: NaN });
        }
      });
      const suffix = figureCount > 1 ? `_${i + 1}` : "";
      results.push({
        key: "dma" + suffix,
        title: "DMA" + n1 + "-" + n2 + (figureCount > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: dmaArr,
        pane: 1
      });
      results.push({
        key: "ama" + suffix,
        title: "AMA" + n1 + "-" + n2 + (figureCount > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: amaArr,
        pane: 1
      });
    }
    return results;
  },
};

/* 9) Directional Movement Index (DMI)
   Parameters: n, mm */
export const directionalMovementIndex: IndicatorDefinition = {
  name: "Directional Movement Index",
  shortName: "DMI",
  shouldOhlc: true,
  paramMap: {
    n: { defaultValue: [14], type: "numberArray", min: 1 },
    mm: { defaultValue: [6], type: "numberArray", min: 1 },
  },
  calc(dataList, overrideParams) {
    const nArr = getNumericArray(overrideParams, "n", [14]);
    const mmArr = getNumericArray(overrideParams, "mm", [6]);
    const figureCount = Math.max(nArr.length, mmArr.length);
    const results: IndicatorFigure[] = [];
    for (let i = 0; i < figureCount; i++) {
      const N = pickParam(nArr, i);
      const MM = pickParam(mmArr, i);
      let tr = 0, dmp = 0, dmm = 0;
      let adx = 0;
      let outAdxStarted = false;
      const pdiArr: SingleValueData[] = [];
      const mdiArr: SingleValueData[] = [];
      const adxArr: SingleValueData[] = [];
      const adxrArr: SingleValueData[] = [];
      dataList.forEach((bar, idx) => {
        const prev = idx - 1 >= 0 ? dataList[idx - 1] : bar;
        const highDiff = bar.high - prev.high;
        const lowDiff = prev.low - bar.low;
        const cTr = Math.max(
          bar.high - bar.low,
          Math.abs(bar.high - prev.close),
          Math.abs(prev.close - bar.low)
        );
        let cDmp = 0, cDmm = 0;
        if (highDiff > 0 && highDiff > lowDiff) cDmp = highDiff;
        if (lowDiff > 0 && lowDiff > highDiff) cDmm = lowDiff;
        if (idx === 0) {
          tr = cTr;
          dmp = cDmp;
          dmm = cDmm;
        } else {
          tr = (tr * (N - 1) + cTr) / N;
          dmp = (dmp * (N - 1) + cDmp) / N;
          dmm = (dmm * (N - 1) + cDmm) / N;
        }
        let pdi = NaN, mdi = NaN;
        if (tr !== 0) {
          pdi = (dmp / tr) * 100;
          mdi = (dmm / tr) * 100;
        }
        pdiArr.push({ time: bar.time, value: pdi });
        mdiArr.push({ time: bar.time, value: mdi });
        let dx = NaN;
        if (!isNaN(pdi) && !isNaN(mdi) && (pdi + mdi) !== 0) {
          dx = (Math.abs(mdi - pdi) / (mdi + pdi)) * 100;
        }
        if (idx < N - 1) {
          adxArr.push({ time: bar.time, value: NaN });
          adxrArr.push({ time: bar.time, value: NaN });
        } else {
          if (!outAdxStarted) {
            adx = dx;
            outAdxStarted = true;
          } else {
            adx = (adx * (N - 1) + dx) / N;
          }
          adxArr.push({ time: bar.time, value: adx });
          if (idx < N - 1 + MM) {
            adxrArr.push({ time: bar.time, value: NaN });
          } else {
            const olderAdx = adxArr[adxArr.length - 1 - MM];
            if (olderAdx) {
              const val = (adx + olderAdx.value) / 2;
              adxrArr.push({ time: bar.time, value: val });
            } else {
              adxrArr.push({ time: bar.time, value: NaN });
            }
          }
        }
      });
      const suffix = figureCount > 1 ? `_${i + 1}` : "";
      results.push({
        key: "pdi" + suffix,
        title: "PDI" + N + (figureCount > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: pdiArr,
        pane: 1
      });
      results.push({
        key: "mdi" + suffix,
        title: "MDI" + N + (figureCount > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: mdiArr,
        pane: 1
      });
      results.push({
        key: "adx" + suffix,
        title: "ADX" + N + (figureCount > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: adxArr,
        pane: 1
      });
      results.push({
        key: "adxr" + suffix,
        title: "ADXR" + N + (figureCount > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: adxrArr,
        pane: 1
      });
    }
    return results;
  },
};

/* 10) Momentum (MTM)
   Parameters: n, m
*/
export const momentum: IndicatorDefinition = {
  name: "Momentum",
  shortName: "MTM",
  shouldOhlc: true,
  paramMap: {
    n: { defaultValue: [12], type: "numberArray", min: 1 },
    m: { defaultValue: [6], type: "numberArray", min: 1 },
  },
  calc(dataList, overrideParams) {
    const nArr = getNumericArray(overrideParams, "n", [12]);
    const mArr = getNumericArray(overrideParams, "m", [6]);
    const figureCount = Math.max(nArr.length, mArr.length);
    const figs: IndicatorFigure[] = [];
    for (let i = 0; i < figureCount; i++) {
      const N = pickParam(nArr, i);
      const M = pickParam(mArr, i);
      const mtmArr: SingleValueData[] = [];
      const maMtmArr: SingleValueData[] = [];
      let sumMtm = 0;
      const mtmBuffer: number[] = [];
      dataList.forEach((bar, idx) => {
        if (idx >= N) {
          const oldBar = dataList[idx - N];
          const val = bar.close - oldBar.close;
          mtmArr.push({ time: bar.time, value: val });
          mtmBuffer.push(val);
          sumMtm += val;
          if (mtmBuffer.length > M) {
            sumMtm -= mtmBuffer[mtmBuffer.length - 1 - M];
          }
          const maVal = mtmBuffer.length >= M ? sumMtm / M : NaN;
          maMtmArr.push({ time: bar.time, value: maVal });
        } else {
          mtmArr.push({ time: bar.time, value: NaN });
          maMtmArr.push({ time: bar.time, value: NaN });
        }
      });
      const suffix = figureCount > 1 ? `_${i + 1}` : "";
      figs.push({
        key: "mtm" + suffix,
        title: "MTM" + N + (figureCount > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: mtmArr,
        pane: 1
      });
      figs.push({
        key: "maMtm" + suffix,
        title: "MAMTM" + N + (figureCount > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: maMtmArr,
        pane: 1
      });
    }
    return figs;
  },
};

/* 11) Psychological Line (PSY)
   Parameters: n, m
*/
export const psychologicalLine: IndicatorDefinition = {
  name: "Psychological Line",
  shortName: "PSY",
  shouldOhlc: true,
  paramMap: {
    n: { defaultValue: [12], type: "numberArray", min: 1 },
    m: { defaultValue: [6], type: "numberArray", min: 1 },
  },
  calc(dataList, overrideParams) {
    const nArr = getNumericArray(overrideParams, "n", [12]);
    const mArr = getNumericArray(overrideParams, "m", [6]);
    const figureCount = Math.max(nArr.length, mArr.length);
    const figs: IndicatorFigure[] = [];
    for (let i = 0; i < figureCount; i++) {
      const N = pickParam(nArr, i);
      const M = pickParam(mArr, i);
      let upCount = 0;
      const upQueue: number[] = [];
      let psySum = 0;
      const psyArr: SingleValueData[] = [];
      const maPsyArr: SingleValueData[] = [];
      const psyBuffer: number[] = [];
      dataList.forEach((bar, idx) => {
        const prev = idx - 1 >= 0 ? dataList[idx - 1] : bar;
        const upFlag = bar.close > prev.close ? 1 : 0;
        upQueue.push(upFlag);
        upCount += upFlag;
        if (idx >= N - 1) {
          const ratio = (upCount / N) * 100;
          psyArr.push({ time: bar.time, value: ratio });
          psyBuffer.push(ratio);
          psySum += ratio;
          if (psyBuffer.length > M) {
            psySum -= psyBuffer[psyBuffer.length - 1 - M];
          }
          const maVal = psyBuffer.length >= M ? psySum / M : NaN;
          maPsyArr.push({ time: bar.time, value: maVal });
          upCount -= upQueue[idx - (N - 1)];
        } else {
          psyArr.push({ time: bar.time, value: NaN });
          maPsyArr.push({ time: bar.time, value: NaN });
        }
      });
      const suffix = figureCount > 1 ? `_${i + 1}` : "";
      figs.push({
        key: "psy" + suffix,
        title: "PSY" + N + (figureCount > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: psyArr,
        pane:1
      });
      figs.push({
        key: "maPsy" + suffix,
        title: "MAPSY" + N + (figureCount > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: maPsyArr,
        pane:1
      });
    }
    return figs;
  },
};

/* 12) Rate of Change (ROC)
   Parameters: n, m
*/
export const rateOfChange: IndicatorDefinition = {
  name: "Rate of Change",
  shortName: "ROC",
  shouldOhlc: true,
  paramMap: {
    n: { defaultValue: [12], type: "numberArray", min: 1 },
    m: { defaultValue: [6], type: "numberArray", min: 1 },
  },
  calc(dataList, overrideParams) {
    const nArr = getNumericArray(overrideParams, "n", [12]);
    const mArr = getNumericArray(overrideParams, "m", [6]);
    const figureCount = Math.max(nArr.length, mArr.length);
    const figs: IndicatorFigure[] = [];
    for (let i = 0; i < figureCount; i++) {
      const N = pickParam(nArr, i);
      const M = pickParam(mArr, i);
      const rocArr: SingleValueData[] = [];
      const maRocArr: SingleValueData[] = [];
      let rocSum = 0;
      const buffer: number[] = [];
      dataList.forEach((bar, idx) => {
        if (idx >= N) {
          const ago = dataList[idx - N];
          const prevClose = ago.close;
          let rocVal = 0;
          if (prevClose !== 0) {
            rocVal = ((bar.close - prevClose) / prevClose) * 100;
          }
          rocArr.push({ time: bar.time, value: rocVal });
          buffer.push(rocVal);
          rocSum += rocVal;
          if (buffer.length > M) {
            rocSum -= buffer[buffer.length - 1 - M];
          }
          const maVal = buffer.length >= M ? rocSum / M : NaN;
          maRocArr.push({ time: bar.time, value: maVal });
        } else {
          rocArr.push({ time: bar.time, value: NaN });
          maRocArr.push({ time: bar.time, value: NaN });
        }
      });
      const suffix = figureCount > 1 ? `_${i + 1}` : "";
      figs.push({
        key: "roc" + suffix,
        title: "ROC" + N + (figureCount > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: rocArr,
        pane: 1

      });
      figs.push({
        key: "maRoc" + suffix,
        title: "MAROC" + N + (figureCount > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: maRocArr,
        pane: 1
      });
    }
    return figs;
  },
};

/* 13) Relative Strength Index (RSI)
   Parameters: p1, p2, p3
*/
export const relativeStrengthIndex: IndicatorDefinition = {
  name: "Relative Strength Index",
  shortName: "RSI",
  shouldOhlc: true,
  paramMap: {
    p1: { defaultValue: [6], type: "numberArray", min: 1 },
    p2: { defaultValue: [12], type: "numberArray", min: 1 },
    p3: { defaultValue: [24], type: "numberArray", min: 1 },
  },
  calc(dataList, overrideParams) {
    const p1Arr = getNumericArray(overrideParams, "p1", [6]);
    const p2Arr = getNumericArray(overrideParams, "p2", [12]);
    const p3Arr = getNumericArray(overrideParams, "p3", [24]);
    const figureCount = Math.max(p1Arr.length, p2Arr.length, p3Arr.length);
    const figs: IndicatorFigure[] = [];
    for (let i = 0; i < figureCount; i++) {
      const p1 = pickParam(p1Arr, i);
      const p2 = pickParam(p2Arr, i);
      const p3 = pickParam(p3Arr, i);
      const arrP = [p1, p2, p3];
      const upSums = arrP.map(() => 0);
      const downSums = arrP.map(() => 0);
      const lines: IndicatorFigure[] = arrP.map((val, j) => ({
        key: `rsi${j + 1}` + (figureCount > 1 ? `_${i + 1}` : ""),
        title: `RSI${val}` + (figureCount > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: [],
        pane:1
      }));
      dataList.forEach((bar, idx) => {
        const prev = idx - 1 >= 0 ? dataList[idx - 1] : bar;
        const diff = bar.close - prev.close;
        arrP.forEach((period, j) => {
          if (diff > 0) {
            upSums[j] += diff;
          } else {
            downSums[j] += Math.abs(diff);
          }
          if (idx >= period - 1) {
            const rsiVal = downSums[j] !== 0 ? (100 - 100 / (1 + upSums[j] / downSums[j])) : 100;
            lines[j].data.push({ time: bar.time, value: rsiVal });
            const oldDiff = dataList[idx - (period - 1)].close - (dataList[idx - period]?.close || 0);
            if (oldDiff > 0) {
              upSums[j] -= oldDiff;
            } else {
              downSums[j] -= Math.abs(oldDiff);
            }
          } else {
            lines[j].data.push({ time: bar.time, value: NaN });
          }
        });
      });
      figs.push(...lines);
    }
    return figs;
  },
};

/* 14) Stochastic (KDJ)
   Parameters: n, kPeriod, dPeriod
*/
export const stoch: IndicatorDefinition = {
  name: "Stochastic",
  shortName: "KDJ",
  shouldOhlc: true,
  paramMap: {
    n: { defaultValue: [9], type: "numberArray", min: 1 },
    kPeriod: { defaultValue: [3], type: "numberArray", min: 1 },
    dPeriod: { defaultValue: [3], type: "numberArray", min: 1 },
  },
  calc(dataList, overrideParams) {
    const nArr = getNumericArray(overrideParams, "n", [9]);
    const kArr = getNumericArray(overrideParams, "kPeriod", [3]);
    const dArr = getNumericArray(overrideParams, "dPeriod", [3]);
    const figureCount = Math.max(nArr.length, kArr.length, dArr.length);
    const results: IndicatorFigure[] = [];
    for (let i = 0; i < figureCount; i++) {
      const nVal = pickParam(nArr, i);
      const kPeriod = pickParam(kArr, i);
      const dPeriod = pickParam(dArr, i);
      let prevK = 50, prevD = 50;
      const kArrOut: SingleValueData[] = [];
      const dArrOut: SingleValueData[] = [];
      const jArrOut: SingleValueData[] = [];
      dataList.forEach((bar, idx) => {
        if (idx < nVal - 1) {
          kArrOut.push({ time: bar.time, value: NaN });
          dArrOut.push({ time: bar.time, value: NaN });
          jArrOut.push({ time: bar.time, value: NaN });
          return;
        }
        const slice = dataList.slice(idx - (nVal - 1), idx + 1);
        const highN = Math.max(...slice.map(b => b.high));
        const lowN = Math.min(...slice.map(b => b.low));
        const rsv = highN === lowN ? 100 : ((bar.close - lowN) / (highN - lowN)) * 100;
        const kVal = ((kPeriod - 1) * prevK + rsv) / kPeriod;
        const dVal = ((dPeriod - 1) * prevD + kVal) / dPeriod;
        const jVal = 3 * kVal - 2 * dVal;
        kArrOut.push({ time: bar.time, value: kVal });
        dArrOut.push({ time: bar.time, value: dVal });
        jArrOut.push({ time: bar.time, value: jVal });
        prevK = kVal;
        prevD = dVal;
      });
      const suffix = figureCount > 1 ? `_${i + 1}` : "";
      results.push({
        key: "k" + suffix,
        title: "K" + nVal + (figureCount > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: kArrOut,
        pane:1
      });
      results.push({
        key: "d" + suffix,
        title: "D" + nVal + (figureCount > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: dArrOut,
        pane:1
      });
      results.push({
        key: "j" + suffix,
        title: "J" + nVal + (figureCount > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: jArrOut,
        pane:1
      });
    }
    return results;
  },
};

/* 15) Variance
   Parameter: length
*/
export const variance: IndicatorDefinition = {
  name: "Variance",
  shortName: "Variance",
  shouldOhlc: true,
  paramMap: {
    length: { defaultValue: [14], type: "numberArray", min: 1, max: 100 },
  },
  calc(dataList, overrideParams) {
    const arr = getNumericArray(overrideParams, "length", [14]);
    const results: IndicatorFigure[] = [];
    arr.forEach((length, i) => {
      const varArr: SingleValueData[] = [];
      dataList.forEach((bar, idx) => {
        if (idx < length - 1) {
          varArr.push({ time: bar.time, value: NaN });
          return;
        }
        const subset = dataList.slice(idx - (length - 1), idx + 1).map(b => b.close);
        const mean = subset.reduce((sum, val) => sum + val, 0) / subset.length;
        const variance = subset.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / subset.length;
        varArr.push({ time: bar.time, value: variance });
      });
      const suffix = arr.length > 1 ? `_${i + 1}` : "";
      results.push({
        key: "variance" + suffix,
        title: "Variance" + length + (arr.length > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: varArr,
        pane:1
      });
    });
    return results;
  },
};

/* 16) Williams %R (WR)
   Parameters: p1, p2, p3
*/
export const williamsR: IndicatorDefinition = {
  name: "Williams %R",
  shortName: "WR",
  shouldOhlc: true,
  paramMap: {
    p1: { defaultValue: [6], type: "numberArray", min: 1 },
    p2: { defaultValue: [10], type: "numberArray", min: 1 },
    p3: { defaultValue: [14], type: "numberArray", min: 1 },
  },
  calc(dataList, overrideParams) {
    const p1Arr = getNumericArray(overrideParams, "p1", [6]);
    const p2Arr = getNumericArray(overrideParams, "p2", [10]);
    const p3Arr = getNumericArray(overrideParams, "p3", [14]);
    const figureCount = Math.max(p1Arr.length, p2Arr.length, p3Arr.length);
    const results: IndicatorFigure[] = [];
    for (let i = 0; i < figureCount; i++) {
      const p1 = pickParam(p1Arr, i);
      const p2 = pickParam(p2Arr, i);
      const p3 = pickParam(p3Arr, i);
      const arrP = [p1, p2, p3];
      const lines: IndicatorFigure[] = arrP.map((val, j) => ({
        key: `wr${j + 1}` + (figureCount > 1 ? `_${i + 1}` : ""),
        title: `WR${val}` + (figureCount > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: [],
        pane:1
      }));
      dataList.forEach((bar, idx) => {
        arrP.forEach((period, j) => {
          if (idx >= period - 1) {
            let highest = -Infinity, lowest = Infinity;
            for (let k = idx - (period - 1); k <= idx; k++) {
              highest = Math.max(highest, dataList[k].high);
              lowest = Math.min(lowest, dataList[k].low);
            }
            const wrVal = highest !== lowest ? ((bar.close - highest) / (highest - lowest)) * 100 : 0;
            lines[j].data.push({ time: bar.time, value: wrVal });
          } else {
            lines[j].data.push({ time: bar.time, value: NaN });
          }
        });
      });
      results.push(...lines);
    }
    return results;
  },
};

/* 17) Change
   Parameter: length
*/
export const change: IndicatorDefinition = {
  name: "Change",
  shortName: "Change",
  shouldOhlc: true,
  paramMap: {
    length: { defaultValue: [1], type: "numberArray", min: 1, max: 100 },
  },
  calc(dataList, overrideParams) {
    const arr = getNumericArray(overrideParams, "length", [1]);
    const results: IndicatorFigure[] = [];
    arr.forEach((length, i) => {
      const chArr: SingleValueData[] = [];
      dataList.forEach((bar, idx) => {
        if (idx < length) {
          chArr.push({ time: bar.time, value: NaN });
          return;
        }
        const prevClose = dataList[idx - length].close;
        chArr.push({ time: bar.time, value: bar.close - prevClose });
      });
      const suffix = arr.length > 1 ? `_${i + 1}` : "";
      results.push({
        key: "change" + suffix,
        title: "Change" + length + (arr.length > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: chArr,
        pane:1
      });
    });
    return results;
  },
};

/* 18) Range
   Parameter: length
*/
export const range: IndicatorDefinition = {
  name: "Range",
  shortName: "Range",
  shouldOhlc: true,
  paramMap: {
    length: { defaultValue: [14], type: "numberArray", min: 1, max: 100 },
  },
  calc(dataList, overrideParams) {
    const arr = getNumericArray(overrideParams, "length", [14]);
    const results: IndicatorFigure[] = [];
    arr.forEach((length, i) => {
      const rArr: SingleValueData[] = [];
      dataList.forEach((bar, idx) => {
        if (idx < length - 1) {
          rArr.push({ time: bar.time, value: NaN });
          return;
        }
        const subset = dataList.slice(idx - (length - 1), idx + 1);
        const highest = Math.max(...subset.map(b => b.high));
        const lowest = Math.min(...subset.map(b => b.low));
        rArr.push({ time: bar.time, value: highest - lowest });
      });
      const suffix = arr.length > 1 ? `_${i + 1}` : "";
      results.push({
        key: "range" + suffix,
        title: "Range" + length + (arr.length > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: rArr,
        pane:1
      });
    });
    return results;
  },
};

/* 19) Standard Deviation
   Parameter: length
*/
export const standardDeviation: IndicatorDefinition = {
  name: "Standard Deviation",
  shortName: "StdDev",
  shouldOhlc: true,
  paramMap: {
    length: { defaultValue: [14], type: "numberArray", min: 1, max: 100 },
  },
  calc(dataList, overrideParams) {
    const arr = getNumericArray(overrideParams, "length", [14]);
    const results: IndicatorFigure[] = [];
    arr.forEach((length, i) => {
      const sdArr: SingleValueData[] = [];
      dataList.forEach((bar, idx) => {
        if (idx < length - 1) {
          sdArr.push({ time: bar.time, value: NaN });
          return;
        }
        const subset = dataList.slice(idx - (length - 1), idx + 1).map(b => b.close);
        const mean = subset.reduce((sum, val) => sum + val, 0) / subset.length;
        const variance = subset.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / subset.length;
        const stdDev = Math.sqrt(variance);
        sdArr.push({ time: bar.time, value: stdDev });
      });
      const suffix = arr.length > 1 ? `_${i + 1}` : "";
      results.push({
        key: "stdDev" + suffix,
        title: "StdDev" + length + (arr.length > 1 ? ` #${i + 1}` : ""),
        type: "line",
        data: sdArr,
        pane:1
      });
    });
    return results;
  },
};


// =====================================================================
// 15) Moving Average Convergence Divergence (MACD) - MACD Series Modified
// =====================================================================
const movingAverageConvergenceDivergence: IndicatorDefinition = {
  name: 'Moving Average Convergence Divergence',
  shortName: 'MACD',
  shouldOhlc: true,
  paramMap: {
    shortPeriod: { defaultValue: 12, type: 'number', min: 1 },
    longPeriod: { defaultValue: 26, type: 'number', min: 1 },
    signalPeriod: { defaultValue: 9, type: 'number', min: 1 },
  },
  calc(dataList, overrideParams) {
    const pm = getParams(this, overrideParams);
    const shortP = pm.shortPeriod;
    const longP = pm.longPeriod;
    const signalP = pm.signalPeriod;

    let emaShort = 0,
      emaLong = 0;
    let dif = 0,
      dea = 0;
    let difSum = 0;

    const difArr: SingleValueData[] = [];
    const deaArr: SingleValueData[] = [];
    const macdArr: HistogramData[] = [];

    let sumClose = 0;

    dataList.forEach((bar, i) => {
      sumClose += bar.close;
      // Initialize short EMA
      if (i === shortP - 1) {
        emaShort = sumClose / shortP;
      } else if (i > shortP - 1) {
        emaShort =
          (bar.close * 2 + (shortP - 1) * emaShort) / (shortP + 1);
      }
      // Initialize long EMA
      if (i === longP - 1) {
        emaLong = sumClose / longP;
      } else if (i > longP - 1) {
        emaLong =
          (bar.close * 2 + (longP - 1) * emaLong) / (longP + 1);
      }

      if (i >= Math.max(shortP, longP) - 1) {
        dif = emaShort - emaLong;
        difArr.push({ time: bar.time, value: dif });
        difSum += dif;
        if (difArr.length === signalP) {
          dea = difSum / signalP;
        } else if (difArr.length > signalP) {
          dea = (dif * 2 + (signalP - 1) * dea) / (signalP + 1);
        }
        if (difArr.length >= signalP) {
          deaArr.push({ time: bar.time, value: dea });
          macdArr.push({
            time: bar.time,
            value: (dif - dea) * 2,
          });
        } else {
          deaArr.push({ time: bar.time, value: NaN });
          macdArr.push({ time: bar.time, value: NaN });
        }
      } else {
        difArr.push({ time: bar.time, value: NaN });
        deaArr.push({ time: bar.time, value: NaN });
        macdArr.push({ time: bar.time, value: NaN });
      }
    });

    // Extract optional color parameters with defaults.
    const upColor: string = overrideParams?.upColor ?? 'green';
    const downColor: string = overrideParams?.downColor ?? 'red';
    setHistogramColors(macdArr, upColor, downColor);

    return [
      { key: 'dif', title: 'DIF', type: 'line', data: difArr, pane: 1},
      { key: 'dea', title: 'DEA', type: 'line', data: deaArr, pane: 1},
      { key: 'macd', title: 'MACD', type: 'histogram', data: macdArr, pane: 1},
    ];
  },
};

// You can continue adding other indicators below as needed.

// =====================================================================
//  INDICATORS (collect them in one array)
// =====================================================================
export const OSCILLATORS: IndicatorDefinition[] = [

    // Oscillator Indicators
    awesomeOscillator,
    averageTrueRange,
    bias,
    brar,
    bullAndBearIndex,
    commodityChannelIndex,
    currentRatio,
    differentOfMovingAverage,
    directionalMovementIndex,
    momentum,
    movingAverageConvergenceDivergence,
    psychologicalLine,
    rateOfChange,
    relativeStrengthIndex,
    stoch,
    variance,
    williamsR,
    change,
    range,
    standardDeviation,

];


