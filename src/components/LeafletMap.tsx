import React, { useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { appConfig } from '../config/appConfig';

interface LeafletMapProps {
  tileUrl?: string;
  partnerCoords: { latitude: number; longitude: number } | null;
  partnerHeading?: number;
  pickupCoords?: { lat: number; lng: number } | null;
  dropoffCoords?: { lat: number; lng: number } | null;
  routeOrigin?: { lat: number; lng: number } | null;
  routeDestination?: { lat: number; lng: number } | null;
  polylinePoints?: { latitude: number; longitude: number }[];
  bottomPadding?: number;
}

export default function LeafletMap({ tileUrl, partnerCoords, partnerHeading = 0, pickupCoords, dropoffCoords, routeOrigin, routeDestination, polylinePoints, bottomPadding = 300 }: LeafletMapProps) {
  const webviewRef = useRef<WebView>(null);

  const buildJs = (payload: object): string => {
    const s = JSON.stringify(payload)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'");
    return `if(window.updateMapState){window.updateMapState('${s}');}true;`;
  };

  useEffect(() => {
    if (!webviewRef.current) return;
    webviewRef.current.injectJavaScript(buildJs({
      partner: partnerCoords,
      heading: partnerHeading,
      pickup: pickupCoords,
      dropoff: dropoffCoords,
      routeOrigin: routeOrigin ?? pickupCoords,
      routeDestination: routeDestination ?? dropoffCoords,
      polyline: polylinePoints ?? [],
    }));
  }, [partnerCoords, partnerHeading, pickupCoords, dropoffCoords, routeOrigin, routeDestination, polylinePoints]);

  const onLoadEnd = () => {
    if (!webviewRef.current) return;
    webviewRef.current.injectJavaScript(buildJs({
      partner: partnerCoords,
      heading: partnerHeading,
      pickup: pickupCoords,
      dropoff: dropoffCoords,
      routeOrigin: routeOrigin ?? pickupCoords,
      routeDestination: routeDestination ?? dropoffCoords,
      polyline: polylinePoints ?? [],
    }));
  };

  const API_BASE = appConfig.apiBaseUrl;
  const BOTTOM_PAD = bottomPadding;
  // 🟢 FIX: Compute HTML content ONLY ONCE!
  // If `htmlContent` changes, the WebView completely reloads, causing a massive blinking/jhatka effect.
  const htmlContent = useMemo(() => {
    const initLat = pickupCoords?.lat ?? 20.5937;
    const initLng = pickupCoords?.lng ?? 78.9629;
    const finalTileUrl = tileUrl || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;overflow:hidden;background:#f2efe9}
#map{width:100%;height:100%}

/* ── Scooter marker (replaces blue dot) ────────────────────────────── */
.scooter-wrap{width:52px;height:72px;position:relative;}
.scooter-glow{
  position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  width:64px;height:64px;border-radius:50%;
  background:radial-gradient(circle,rgba(255,160,0,0.30) 0%,rgba(255,160,0,0) 70%);
  animation:scooterPulse 2.5s ease-in-out infinite;
}
@keyframes scooterPulse{
  0%,100%{transform:translate(-50%,-50%) scale(1);opacity:0.9;}
  50%{transform:translate(-50%,-50%) scale(1.5);opacity:0.25;}
}
.scooter-shadow{
  position:absolute;bottom:-2px;left:50%;transform:translateX(-50%);
  width:36px;height:10px;border-radius:50%;
  background:rgba(0,0,0,0.18);filter:blur(3px);
}
.scooter-img{
  position:absolute;top:50%;left:50%;
  width:40px;height:60px;
  object-fit:contain;
  filter:drop-shadow(0 3px 6px rgba(0,0,0,0.35));
  transition:transform 0.5s ease-out;
}

/* ── Destination / restaurant pins ──────────────────────────────────── */
.pin{display:flex;flex-direction:column;align-items:center;}
.pin-circle{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;box-shadow:0 3px 10px rgba(0,0,0,0.3);}
.pin-tail{width:5px;height:12px;border-radius:0 0 4px 4px;margin-top:-1px;}

/* ── Remaining distance label ───────────────────────────────────────── */
.dist-label{
  background:rgba(0,0,0,0.75);color:#fff;font-size:11px;font-weight:700;
  padding:3px 8px;border-radius:10px;white-space:nowrap;
  box-shadow:0 1px 4px rgba(0,0,0,0.3);
}
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var API_BASE = '${API_BASE}';
var SCOOTER_B64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAABaCAYAAADkUTU1AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAf40lEQVR4nN18CVgUV9pu9VJVvVSvbILsIiAIKKjsmwrG36hZfiaZLDOJo8bEmGsyZk+GmMS4JkaN4zgxGmMWNS6JiVsUCIsIsjXIquLGTkQBZe2qeu9zqhtlMvf+98lMZmTueZ6Pqj5VdJ33nO/7zrdVU9S/raXLyd+IyMj/iktMvhKfnNIfm5BcFBo6abz9Bun6/y9NRv6ERYWNjoiK+So6IXlhdHzSrOiEpPemxMRuH7o+7Pif3famUQqAkoWGpmiDghK54eBCU1K0CxdG0AAlJ/dQ/+kNuM2qsunTIwzp6ZQ8LS1NkZiYqCSdc2ICdHEhISbp3vT/cNCwg337efcQy16HA9mfOR8Z7TfpwXsjIjSkn3Gc7L9kfsCSqv2ONT985Pza9AhfA+knk0L9p7W9eykFOX633nVBWwbXh0YatYcNhf7jk9bOnRtmJNe8g5Nm/P6hoE+ECqYbdRpU7zeXr385wPs/DvReO9i9q90e6j6tBaqMVlwIwbmMqJwxQXFr7gCOT300LXjHYKm+SyzT8DjHoP6w2ZIa5G62f9XIZ2/YZTAtauzoK8f1jahzxGBN6iAaIlF5eEyB77iYdXPnJkqAfQITUp5+MnTFQCnXgwoDhFJuADUq/Pix03rpu+wTN6Ib7IPM/8w5HTUchNo4q7UiSECtEtUHdWd8g2Jus7TPuMTpzzwRvLy/mOmBhYHVYhZQqkbLUc31pY94+o541oZ9dadNm+zQeIy9gjp/8JVhwmCxXMA5FlXfGiXAaalBEsv6BcanLn4i5O2BErYHFQx4i0ZEmYMVRSrkb3V6dcSvMuyDO77J/HuUcBCqw3jBooW1lJYAV35rLBozMenttJfTJG3sGT576rMLJ6QPFLM9OMtAKGNEq8UgwKLBxa91ZykqSj2iZRn2Fa7ewx1DtQv4sx68UCqD1cIKaGJh+ZYrM9KjH/+dlg5eRVHuTpTTjAUPuS/rr1EPoJaFUMqIvEUDlHLCreMsdr3ukjRkuFAjraXbZe2VJz19W4+ou1HpBmuZTkSlCryFRs/HclQ+HdBfPD/tavWbT/dWL3+ut/DZR29l/XdMa/NyrTiYqQDq1BBKyf0aHkUs8jea145YtoZ9UIfWmp9EkRZWi0ngzzIYOEWjYbEbGjatR1f9RYj8IKyARIIoYKCjDQ3796N+fhy6diiBGjX4MpZHGYuLu3RFFIWRaWcDNsDlOwy7UEHYU2VFDY2WZU5o3HMINwF09dxCZ2encOP6dXGIOru7hZuiFT9dasKlP8ShP0MBvooVUUKjdY+6Z/UTo8febW0tG0Y2sLfPIzSXdusrUaGEcJYVxAIlrqaNwc22VnRDQFd3N7q6utDVSajTdk76enrQB6Bp2QJc20gB5zXgixlBPKHBoTcdZg83Zn42jn8PwJ+3odlfs8RjTPu3mgFYFLAW0qJQzOLqIwzOpUxHV/YJ9Ha0orunCzcHe9E92Ieb/bdwq7MDNytLcGXp/4IlRIe+QxoIBUpYi2geBSxy1zq8S747K52SnI1/K3tHRETQo/wmOAUHT/IIsXs45OFbF0bQ5OSz1xxm8yfV4POVIl+ggVChQd8PKlz6nRLVQWpUTPLHuf+aipr770Xtg3NQN2cGquPCUOWvR8VUGW7sUgHlLIQCFaw5DI/TClRs1n5Hvrt4K0WeIU2sl5eXyjfU15mi/mYSfpUmCwgI0I0dO3bcuHHjpoeFBSeFBAZGRURGxoWFhd/v7u6uHu4VnfnUtA0WDnyJjhcsOghlLIRCBcQqFn2n1GjfpkTLuzI0vChD4zIKzX+i0PaREt3HVBCqNeBLGAglLASLGtZinYgSPRr3m24884C313BOCg4OTg4PD4l6Pi1NDUA+5Gr+02ATExOVwcHBHqGhoc5paZIRMJyV5D4+PqHkJCIiOFbnFFD61Yeel3HJgIFilciXMeArlIJYQfMopXlUKHjU0Twu0DzqVSLq1UC9SsB5lkeVkkcZzYulDC9YWJ4nBkgJC1RxuHjMhZ8wMfCqT0DQavIsV19XTz+/UU5DY5QmPD1d8rEJURShX0fBybe+nBZ3astT6+s+fy7jN/cmfec1NrBrbFBw3djAwBsOboGtLz3t0YwaBoNlKvCljIhSBjilxuAJDQZ+UGPgmAr9x9ToO8IIfUcU/MAxNfqPqjF4VIX+oyoImWqgmAVKabG/RCWiRomMHeZ+F8/A6/6BgfyYwHH17t6+t6ZMCSuwfP7C4cKtC3YdWPGHByjKj/2n0fn7+ztGRETFRsUnLo2Iit716VuPF9w8+adBseBtoGI1Xl04u442uq0OGDd+kfe4sQnkf/663GGutUIDVNKDZPCVfzYWffOG+XcZq5xiTq52jT+6wjG+aKN5yrLHx76+4MHA7V8vd56Wsc4phvRnr3KKObrcaUb2Goft7bu1vShkBVygUfSFwwGKCmImTvQJ9QsIeETj4P7S3JTITBSvBgrfEQez3xYyNz1VGR8f8/WESVNeDQ+fMtXDI8DtFwMe4ze2NmRCOALHT7ROiZzYfO3E6wLy/iQKma8N4NRbuHrgj4eDqCBm+JbxwVLX2PYDRvHSXzRY9ZjhOzJQ+9fd1vJ6d3fz5Nipl2OS7kHQxJg5pM/Gindk9LF484PbF3O93d9wOLTG5ZUhw4awLjmv/HzpGuSlQ8h6Y4D/8U88zqzCf8+Mb3MfE3gzcHwoPHzGHPnFgL38AqN8/f2nURznRDkE6BoO/rEep9LBZ7wuilmv8yhfi8y/LF48NODHUkK1+Vvdy96YYyxJ9VGVTBylfkoCcUeeZEOfJ0+evDMqJvpcYnREoP3a38mcp8EQMTvE8PKOl0Z9981ar4eH+t9eNGfi9ex3gJw/gc98Q0R2Oq59/6qwctE9EymKYr29vcO8vLykqMk/1IgWJMe6vS/txpn3wJ98YwCn3sb5r14oX3p/vKv9NhmQLl94n+eLaRO0xxdGqi/8IVLV/Fi4OuvZWHbf9MjAbZPjkj8MnTZtU3DqjA/CkpM3T0hM/CQ0JWV92MxZG6dMnb5xyqTwjfOiDXueiWQPLIpSH38hQVXwxHhFZ+EmB5TsH/uWNJYsmzY+vXXBTuQth5Dx5iDy38XVAy9XURRl2zH+HzbD/9QUZN/NSrc95MSH8x5E/tvAqRUDQtZKHFi1YCbpH7q+Y4eXMXeL29nlKQyem6QQl0bSeGsag3eTlUhNnoiEqTOwZMJkfBQQhq/9Q3AgIASfBobgjfHhmJM4FeEJ8Vgaz2HFNBqvxzN4NZbGC5Pl1ty1etQf9ZEAV+61iUj64ofdWg++2YlTK0SUrUb5zsW2CcFeacz/lJZOTU01J6fOCpszI+GFIx8+hbbDT/LITMH37wU/Q64Xb7UZHSufdwqr/85TeCVWKW56WCOc+bNWvHxQzV/4TssvT/W1HtG5W294eFlvBgdYu8OD+O4pIXzPpBBrV4C/tdzsan3J1896Yr2Zb9rN8FVb1PzBpRrhxUiFNeNdR1w6On7tcMBrn/Cc2n4wQWg//KiYtXUpFj48+92wqPgp999/v7t92L98hUNDQ7XJ06c/Pi0ldUXqrFkL77vvvsRxk5ODg/yd7rn8Bdtz8UtdljSrWTZr5+vNPqG1B8bzB1/lMFCiFVHFABdp9GzRoclsRtf4cWiZOAYNniY0uBslavQ2oyXIA9eDfdCod8S1p3VAHQOxQglYVKj8K2st/MgHloMxJDtBXcryUkmTvNm08to+DWZEGh6gPKa7zZnzX5GpM2f+bsbMWctTZsx8ITExcdQvBhweHn5/XFxcImXXjI6eEa60MfzR+Y/67u4+xfU27NF0PZTocls5/PnVcfE3sscTowOwKMGfpXHrGw6XHcxo8/VG8xgXNI7i0OSuR5OHAS2eBjR7GtAyWocmTwPaAt1xiXPE9Q85CDUs+CIGqJBZUe6N4n0pEmBAEh9Z7Q5NPoo1eG+Z536z68QlBsMUn6FxzJgxOzhs8uQnfjFgyi4HkycHOvgHRzydmjIhZ/9HnrhVpBNRoORxVIV96YbbX7z2j+Nm9hZNAMqUolBMQ6xVoeV+HVqcR6PVzwktzlq0jjKg1WxAi1GPFqMRrY4GtI42os1Dj2YvI1rdRqMp3AChjAQCWPAlcivOeaH8u/skwKStm+/m375b24fTSlgtnJD7uTvS5oyvHDtuysqImOAxtrtsi/RLmyQHcXF+ThSVaj70gcts5DHAcbl14HvaSiIS1XuNu4du3vjSuJm9xVHgi2lRrGIwmKNFk68Z7X7uaHHVodVoQovShBaFEa2MCW2MES1yI1ppE9oI+NE6tPo64IrRhI4dHHBBBWuR3IpaX1QffeQ24B8+clyAfGKdKXj+mGwARTTKdxgXU9Tz6hnxgdKukW7nyn+oDRkD7y90DvnpMCfijBLWUlZAHY2WHP1P8x6xGfYb/xg4q7doMlCtFPtqNDj5pAFNjk645u+GJrURzZQjWjQGtLlxaPfUos1Th3ZXDm1qPVopM1o5E1o89WgzGrApQIfyb/XABbkV571QfeThHUPjqf7GvAcXWFhLaJ4vpAUhT4sdrzk9+H/xmf9xwAvTIgxNmTrJVhZIUK6c5lGjxZEtTpK23vmu/9yO3ARc3qcVN7/A4XWTBp1OJrToTWiWmW1gvTRo89Gi3YtDu5ceP3nr0ObJoUVDJsSMJoMRXc4mrNdr8GSSFrVfqK09uX6o/eGhneQZSxcGujZl6FpQRcNawgqooHEjX4e97/uG/JrBPtnQSf1RYwZhNb6MeDXE62Fw7og5j1z76l3fmfUHQvGAPy2mjlVitaca1zUmNMlNaFU4oM1Vj1ZvHVq97OStRxshHz3aXQxoVpjRSJvRxRnxsYsas4NpJLnIrTtfckfzjwmfk2cc2uz2JIitXkoL1hJGQA2Ltiz91cQIf0dy/VfLPMK+9ZTsc1mB82oQsIKFaFEavaUcPnnH9beZKwyb+o9osCRJJcwIUOAtTwN+UpjQLDejVW1EuydZTZ0N5M+o3UOHFtaEJoUZnTIT3ndywqxQFe71YYTs1Wq07NFdfjLOefrVDGM+CefypazAl7I8GUvd96aTdrDyXz85ttFlan+ZFiinRaGcgUhAV7LitUydOHCQBX9ShTdmaxA/Vo1nPTzQIScrbEYbZ0K7l01uyepKIH0MdwB76dGiMUv33pQZ8YazJyYFm/GbQBpVn2qATBrXvtcSt1MUSxlJg4sksnlOi+wvnF781UO5uM3WodqrmcYqkuXjyxhBsLAQylQQKlgRZxih4i8mpI1TInK8E95x9ka3zIhGuRntWqMktz8HLJE3kWUDWjQmNCjM0v9scBmDwBAfpHrJsf1pNVDEiHwZLRAfWyhlwJewIipZXMvT96x/adS4f0lUE/YwbN6XzumElSQ5JiGcMhaDJDpRq0LxZy6YO4bFGH9vbHBylwbfpHBAK2OU2LbN+2eAvQ02GXbXo5k2oVHpgBsyI3Y6e8IjOAyx7hz2v6kFqllYiwlQGkIpTUJBPNElVd867LWP7dcP4abbZ/Cp344e25Jt6iSmo7WEFSXQZKUtNFClQsHHOkyK8sObOjfckBvQpDSjRe6ANrMB7b7c37F0u48OLXqDxM5NtAM6ZAasN7pjYlQoDn1ghJS5KCNACSsT0IxIMo1dBTp+5zuucRLgf1XMGvZVLtw9ag0uaEgY5/YqixYVJEVWy+DyKSP2TTOijuLQpnRAi8KMFoUJrY56tBHAPjoJKGHnNrMRzUozmpTEGHFAHaXD3hgzzmc5SN9FYmNEVwhldsBlrBX1WpTud/7MPib5vz7Zneg1qiHTdNmmMVWCNBgLC7GcIQF0yWlo/lCLTEqFq7QBbQqzBEoCrjGh1WhEG7G8NLY+wgWtSgc0smacpFhcfk8LXGYweMb2nYTIpEp7by2Dhkxjyx/tBs+/vAhmr10b7t/k9nBfkQ4oYXjewohDAxMJ8LMq9GZqkTlKjXxKbVs9hYMEjGw9ZKtqJp/tE9GqJHuwCfkyDU44aXHrBw7iWcI19u8kE1mqIoqKv1VswJ61br8ZPpZ/eYP9QdnbnNahUEUMgUHBwopiOW1fDQa4oEbdU0YcoVicZjS4qLAbIGSllWZp1dslsCbUKw04zahxmGJQvUgPnLM5D7YJVNnBEvtdi6wNLm/dlYwi7LJTum3UR8hVQ7TQvLWMgLatDMnoDxRocTqMw3GKRRajQpFSiyqFDnUKPerkBlQpOBQqtcigNThGMcifqMVAIQexgiH7rATYWiptQbxYqEXGSocNw5/97wVMkTiW7cFZq8yrbmVI24dIHAtpZcpUQBWLWye0yA/jcJRS4aSMxUk5iwxaJdFJhQrHZCyOUiwKJmjQe4JU/NiVIGHjMlpADSN25urEw2+Z3xwG9u6kTmEDLbHWxy86zr9ySAecV4kSexODpFRFLDEMFGpx/lk9TrlzOClT4wdKhRMUix/kKuR6aHD+WU66h2x1RBNLWplwSb2Kb88yYPNS13XDTdy72mCfbQeK0s0OUp878RdTlVCuEgSJtW2gpZDNeQb9eVpc+5RD00odmt7jcO1TDfryNMA5Yq0R2VeBmKx8OS0Sr6z6kEPF/RO43imumj+QZyQmjgDAlB3wCxGcY6o30+DnqLv34h5dDQkQWIn5WU5LRom0chWsBI5YSTivAjFRxUr7NUkjk3tZoEApth/UYt4c5zlJXsq6e/zYp8kz0qgRUPqQbg8FPRbl5PfQBK1VS2lT1i123YXjLPjTSl4kYMvs2nuYASGRtH/f2XqIsrIW0zwylCjYoM+iqHvYOYFM2+9iHNNHzAqn28269552n/xMoh7hLtrFju5+idWfcG3IVWCwlL6zR/+PRIMnYpCn4G/s1+A3Ka7vUhTn+MB4tuftx7xXSs8aCYD32qMM327ySHnrAQOiXdjFlCo4Zk6y68XuQxoBxQoMEmNk+Er+HbHgLUoSthGQxWLtIpcaSuu9IsDH/dHfRrCDnyx13SwBTh8JgPfaAJ/+wvPB9b/nMMHV8FnQhIifdI4eVxbOcWnuPqLhiQLiSWmhZAvbWJl8JudDfaihBeSx2Pyc80251vXRgLCw98cF+h+aH83g4DvOO/8PZQ93p2XZB1H0lesfti7WYLKb4cyUuIT+wODgRs7Rs2lmrPtPxdt1PWI1K2lqVCtBYlIS1dAQz9NEiYlXD+nEVx4ZVa82jt7m4e27blJsfNd4f7+CZSkMCj+xOQojCvDlw+7zv35Dg+jRup7ImFghJiEZAUHB/Xpnz95Roz2uPf6Aa9/uDx1uWg4ahUs/6HD5hA613xtw9GOHgZcXuXUG+3vmKHSjPx4TMPaDyOi46zHJ0xHkNbp95W9YlH3mIKU/R0S1fJbdGOjINsw/tYFDgpeaj4yORmzSNMQmJA+EhUcMePiO4XWOHv0ak8fNUe4egn+gJ8YFecHTxwM6s0ePxuTZ4ezquT84NKQyKi5RjE+aJkYlJosTPJz5vy5i0HLUOPIAd+cZ5td8rsd0H5aPigxHTNJ0xCYmIz55OqLjExAWEX7Lf1xgp9eYsRjl7i26uPuI7t5j4BcQ0BkyIax5cnSMEJc0VYxNnCrGJCSJUfHxmORhsu55VYVrGdzIA9x+0jC/47gecwOUfGx4kASYDDw2cSrikqZJwMkxOj4JUXEJEpFz0pcwNYUcxZiEZELSREXFxSByNMfnbtCg7cRtwPIRA7j+kGk+X6jFwliGjw72RGxyCgGMIQBDFJdkmwAbTQWZENJP7hsi0hcdFYE4DxV/cZ8OV7/TjqAVTrcBzttmWoAqLZY/xPDRPg6ITZpqB0CONmC3j4l/e81GQ5+TEZM0DVETAjF3PG0ltnb9Ac0BO2DFiAH85SrHBaQo7YtlGj52tAbR0VMQS1Y4LgExcfF2sp1Hx9poqD86NuHOZ3KMT0Sk32gsTWGsOKVF8Tbj9mHVeHe3pdsBb1hsmt/8pRoXtrFC9goVstcakP2+GTnvm5G9zoQcO2W/b6Mfb/cZpevZawmZpWPWGhN+fFeDyo0q642vVNjzonHfiNiH0+129JJUp5jCD7Q/8UeU4E8oRGQrgBwZkE0BP1JAJgVk2Yn0kWs/EhrWL32W2e6V7pdBOCmDcEwpNn+uxZanDLbQzl0uI6Yoyl2d/Z7egnwGQqZc4POV4Ato8IV3yFpAk+paWAsZ6Rr5zBcwt/ul++39VlJJS4gkvE/TsP4oF8kEXdmlEV+eZbh7rwTstT80/UFDUtuXKiBLLpAB22LUJMSjhFCmvG0733YFy+6Q5C5KJOWK7HFn2kalNj9ZyjZkyQeRyeLwG7rNd+2VgHS7PP11vv7R/sMq4JTCKjnyBLBEtERSoJ5EIEl2opTEllWkcFQUSpUCOVpLVNL9pIhlCPTfEAGfp+CRrUTuKv3hu7Y9ZQ0pq3m6eYNHWCBfYSWDI2kQCajF5vTbgnHEO6JFUh2AiyykSloS8SDHcyQDKVUVkKyCbYKGk4WGNV/JI0eJU6u4o3cf8BPDAJfaAGOYr0tKgYVqRiRhnfqjeuzbaGr96zuOlz5f43T6s9UOLZk7DF3tOZyUjCNxMJtI3CESIuIJ4Fwl8laPKMDyQSKnwx19KykhPs+gMUdvXfWia/GS37te/PQ9x46sT7ius/u5jtxPtX0HNjp0rXvZqf/bTY4D/aVaoPJnYZ9yGtZTNsC5q7XH7hrgdDvg9RJgBjgtGxyKXdnA0iIp/y352tg9d9ro5v0fOF7nLWrpDVKxhvjFxOlnpEI0vkwtFuwyi1+/74TuQk7ikCHQt1k6V4mc1dyxEbLCKsLStwFLEYw6BlXfG/vuvce1ruakvgdtSgg1CvDVtCjUSmBFoZIFX8uKYh0DNNDoKOFQdMgF1iqNTSzskUyJpXMUyLmbK5w1HPBRO2CyxZTbaj/6SrTC0vmu2YXvm7vxjRrdOzVi75cc+nZr0f+VFr171Og/oUbfF1r0faVFz5da8F+rcOMzIzq+MALlqjvBvVMjDjBrk2HCfkRu6xns32y6+MGjrnW93kZcoPRCg8yAK5QBl+V6XKT0aJhsQOMMIy5TeqnvKqXHFUqPRpkeDZQBPy0yQKwhgXwaQp6SJ9Zb7ohg6Xm6eVYiw/nyQfKOoUC2nwoNnl/oXFm1xdh16xUN2p/Ri02MEY3OJlx7UY+OZVrc2GJEy5NmtD5ixPUXtbj+vBY3XuXQfp8BjZQRzXFGiLUki8hAOKUYQSs8TzfPepi8zCEflGS3lsHFH7jelxe4Voln1RBblOhaq5NWsONpE9DMQmxi0PGcHg20CTd36IBuJcRGGrjJ4MZbRjRQetx4nQPO24wV27Y0Qlb4I2mFWRtgCyPgAoP2PL1l/wanLURxDRSqhaYAIxpoA/oOcUA1jYHjWjQ5kEIWIzpeMaF7pQ6dK7W48ZIejXoDGt0MuL7OANiT4ny+YmgfPjai9mGeyO85GqX7DV2rn3esxlUWnRs58TKlQ9t9egjVKhANff1FnY1tFSZcoYgcG3BZZsBlyogmfwOaZzigNU0nVeRKVTt2ls5dORJY+gndPKukpWWDxOAnK3j5uK7/tadGXcE5DVoSOFyhONzapQOZjMHTGjSN0aOBM6JzlR49H2lxc6Matz7U4NYnGvQd06FRr0PHQoOUdBNKyArbtPSIYOkNt7clmSTDxBSERY1XlrjU13xovNmuMKAlWi8K5SQtyqJ7A5FnA356yABcVUOsZSCQKnhSQd9M48ZyTtLcPds5WxqVvEBNWHrEAT4tk/ZhnpQoVDEo+d7xWkm0uec6xaHzA70oktUtU6Nxsk2B3fpaB7GGBnkDlS8kdjSNwRwODU46NAQaYC1V22s8mBG2D88jLD20D9sSYySxjRq1ePV9M/KXOQs4q5bcvMFCNW7+WY/eT3USeMlHJmVOpNKuXIuWaSZpMrq3kMIWu6tYrhyBltYRYkvLB6WCUzuRAtSeAq24e4mbULPPGWhgIFTZ80t1xAtiQcp/Uc+i7ySH1iQD6ik9ri3RQ6xTQxyq4iln7bY0YekRA5gFTiuswwFLRS2VDPqOaHHucQfceJND7/dqCCUaCOVq8MUa9O7XoGMRh6sGHa7IDLj+vA5CNSlPttd7DTki+fQIA3zY7g8PByxFOMh7wUTLqtDxnA4N4Xo0jtWh2U+HRic9GuQmXJLr0RpnkLS4cI6UPxGR+Fmi3M7SI8If/uQp7W/7v2eBPDn/N4DL78izWEHqOlgM5mlwa6sWna9x6HxZi651HPqOcOCrVRBrhkJBd9zC22UQ9ohH3kr93ctA7B0K4s1xTGjdrRbxo1zkz9C2whXJ0xkie/SCgCGW03kWuKgCCfVI59VD14f/j52kyh4SuVRYkc3g0Cu6bXfzdz1ktkOaIn+tIRcFNJClGLDmMwJfRIgViQYWSNSxiIZwhoFwhgVfQIpdGFjtxJPQLekn14tYaZuStqpiVuDPMII1W25Frlxo+EKLV+91mDZ8su9aIH7RNMeJxet1LchhgRyliDw5CbKLyJBZ+Qy5gFwZkCeDdMyV24459r5hJGTJRP6EghczZDxyZKKYSwP5tNB5UIu/LNSvHREJtXQ76LQpBp+vlhm2FH2orSreoG6+uE3Tbz2kRvdeVry0TsVfXq0SLqxSiedWq1C3SoXaVSyq16hQs0aF82tUQv0qFd++XSUMHGLRc0CFmq3qzorN2is5K7lTqx43PWJ7ZXcEZA9JIwMZGoyfH3kfn3N6aZbLlJNrHDYULjWdv6gyok1uEskrPQ0yI67KjbgiM+GSTC9RA2MSWygTSqcbb1l26jMPve74wqwQ8ntanqbbL1qPtN/VSie/WEheW7cDHypJTKYor10sd/gIo6/YzRrbt6uN2M4axO0qg/ipSo8vWP3No4y+4ltGX/oaw0lvmA17q1xKgv+addH/G7Nya4PaH4w9AAAAAElFTkSuQmCC';
var map = L.map('map',{zoomControl:false,attributionControl:false}).setView([${initLat},${initLng}],16);
L.tileLayer('${finalTileUrl}',{maxZoom:19,subdomains:'abc'}).addTo(map);

// ── STATE ──────────────────────────────────────────────────────────────
var currentHeading = 0;
var targetHeading = 0;
var isFollowing = true;
var hasInitialFit = false;
var _isProgrammaticMove = false; // flag so our own panTo doesn't break follow

// Disable following only on USER drag/zoom (not our programmatic pans)
map.on('dragstart', function(){ if(!_isProgrammaticMove) isFollowing = false; });
map.on('zoomstart', function(){ if(!_isProgrammaticMove) isFollowing = false; });
// Re-enable following quickly (3s) so delivery boy snaps back to center
var reFollowTimer = null;
function scheduleReFollow(){
  clearTimeout(reFollowTimer);
  reFollowTimer = setTimeout(function(){ isFollowing = true; }, 3000);
}
map.on('moveend', function(){ if(!isFollowing) scheduleReFollow(); });

// ── ICONS ──────────────────────────────────────────────────────────────
function makeScooterHtml(heading) {
  return '<div class="scooter-wrap">'
    + '<div class="scooter-glow"></div>'
    + '<div class="scooter-shadow"></div>'
    + '<img class="scooter-img" src="' + SCOOTER_B64 + '" style="transform:translate(-50%,-50%) rotate(' + heading + 'deg)" />'
    + '</div>';
}

var navIcon = L.divIcon({
  className:'', iconSize:[52,72], iconAnchor:[26,36],
  html: makeScooterHtml(0)
});
var restaurantIcon = L.divIcon({
  className:'', iconSize:[44,56], iconAnchor:[22,56],
  html:'<div class="pin"><div class="pin-circle" style="background:#FF6D00;">&#127860;</div><div class="pin-tail" style="background:#FF6D00;"></div></div>'
});
var houseIcon = L.divIcon({
  className:'', iconSize:[44,56], iconAnchor:[22,56],
  html:'<div class="pin"><div class="pin-circle" style="background:#1565C0;">&#127968;</div><div class="pin-tail" style="background:#1565C0;"></div></div>'
});

// ── ROUTE DRAWING ─────────────────────────────────────────────────────
var routeCasing = null;
var routeLine = null;
var routeTraversed = null;

function clearRoute() {
  if (routeCasing)    { map.removeLayer(routeCasing);    routeCasing = null; }
  if (routeLine)      { map.removeLayer(routeLine);      routeLine = null; }
  if (routeTraversed) { map.removeLayer(routeTraversed); routeTraversed = null; }
}

function drawRoute(latlngs) {
  if (!latlngs || latlngs.length < 2) return;
  clearRoute();
  routeCasing = L.polyline(latlngs, {
    color: '#1a73e8', weight: 8, opacity: 0.2,
    lineJoin: 'round', lineCap: 'round'
  }).addTo(map);
  routeLine = L.polyline(latlngs, {
    color: '#4285F4', weight: 5, opacity: 1,
    lineJoin: 'round', lineCap: 'round'
  }).addTo(map);
  window._routePoints = latlngs;
}

// ── FETCH ROAD ROUTE FROM BACKEND ─────────────────────────────────────
function fetchRoadRoute(pickup, dropoff) {
  var from = pickup.lat + ',' + pickup.lng;
  var to   = dropoff.lat + ',' + dropoff.lng;
  fetch(API_BASE + '/api/maps/route?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to))
    .then(function(r){ return r.json(); })
    .then(function(data){
      if (data.success && data.polyline) {
        var pts = decodePolyline(data.polyline);
        drawRoute(pts);
        if (pts.length > 0 && !hasInitialFit) {
          hasInitialFit = true;
          var allBounds = pts.slice();
          if (navMarker) allBounds.push([navMarker.getLatLng().lat, navMarker.getLatLng().lng]);
          map.fitBounds(L.latLngBounds(allBounds), {
            paddingTopLeft:[30,80], paddingBottomRight:[30,${BOTTOM_PAD}], animate:true
          });
        }
      }
    })
    .catch(function(e){ console.warn('Route fetch failed:', e); });
}

// ── SYNCED SMOOTH ANIMATION ENGINE ────────────────────────────────────
// Animates marker + map pan + heading rotation all in one RAF loop
// so everything moves together with zero jitter.
var _animAF = null;

function smoothMoveSync(marker, newLat, newLng, newHeading, duration) {
  var oldLl = marker.getLatLng();
  var startLat = oldLl.lat, startLng = oldLl.lng;
  var dLat = newLat - startLat, dLng = newLng - startLng;

  // Shortest-path heading interpolation (handles 359° → 1° wrap)
  var startH = currentHeading;
  var dH = newHeading - startH;
  if (dH > 180) dH -= 360;
  if (dH < -180) dH += 360;

  var startTime = performance.now();
  if (_animAF) cancelAnimationFrame(_animAF);

  function step(now) {
    var elapsed = now - startTime;
    var t = Math.min(elapsed / duration, 1);
    // Ease-out cubic for smooth deceleration
    var ease = 1 - Math.pow(1 - t, 3);

    var curLat = startLat + dLat * ease;
    var curLng = startLng + dLng * ease;
    var curH = startH + dH * ease;

    // 1) Move marker
    marker.setLatLng([curLat, curLng]);

    // 2) Rotate scooter smoothly
    var el = marker.getElement();
    if (el) {
      var img = el.querySelector('.scooter-img');
      if (img) img.style.transform = 'translate(-50%,-50%) rotate(' + curH + 'deg)';
    }

    // 3) Pan map to keep scooter centered (only if following)
    if (isFollowing && t < 1) {
      _isProgrammaticMove = true;
      map.panTo([curLat, curLng], {animate: false});
      _isProgrammaticMove = false;
    }

    if (t < 1) {
      _animAF = requestAnimationFrame(step);
    } else {
      currentHeading = newHeading;
      // Final snap to exact position
      if (isFollowing) {
        _isProgrammaticMove = true;
        map.panTo([newLat, newLng], {animate: false});
        _isProgrammaticMove = false;
      }
    }
  }
  _animAF = requestAnimationFrame(step);
}

// ── MARKERS ───────────────────────────────────────────────────────────
var navMarker = null, pickupMarker = null, dropoffMarker = null;
var distLabel = null;

function haversineKm(lat1, lng1, lat2, lng2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

window.updateMapState = function(s) {
  try {
    var st = JSON.parse(s);
    var bounds = [];

    // ── Partner scooter ─────────────────────────────────────────────
    if (st.partner && st.partner.latitude) {
      var lat = st.partner.latitude, lng = st.partner.longitude;
      var heading = st.heading || 0;

      if (!navMarker) {
        navMarker = L.marker([lat, lng], {icon: navIcon, zIndexOffset: 1000}).addTo(map);
        currentHeading = heading;
        // Instant center on first load — zoom to street level
        map.setView([lat, lng], 17, {animate: false});
        window._lastTargetLat = lat;
        window._lastTargetLng = lng;
        // Set initial rotation
        var el = navMarker.getElement();
        if(el){var img=el.querySelector('.scooter-img');if(img)img.style.transform='translate(-50%,-50%) rotate('+heading+'deg)';}
      } else {
        var coordsChanged = (window._lastTargetLat !== lat || window._lastTargetLng !== lng);
        var headingChanged = (heading !== currentHeading);

        if (coordsChanged || headingChanged) {
          window._lastTargetLat = lat;
          window._lastTargetLng = lng;
          // Single synced animation: marker + pan + rotation all together
          smoothMoveSync(navMarker, lat, lng, heading, 1200);
        }
      }

      bounds.push([lat, lng]);

      // Update distance label to next destination
      var dest = st.routeDestination || st.dropoff || st.pickup;
      if (dest && dest.lat) {
        var distKm = haversineKm(lat, lng, dest.lat, dest.lng);
        var distText = distKm < 1 ? Math.round(distKm * 1000) + ' m' : distKm.toFixed(1) + ' km';
        if (!distLabel) {
          distLabel = L.marker([dest.lat, dest.lng], {
            icon: L.divIcon({ className:'', html:'<div class="dist-label">' + distText + '</div>', iconSize:[80,20], iconAnchor:[40,-10] }),
            zIndexOffset: 500
          }).addTo(map);
        } else {
          distLabel.setLatLng([dest.lat, dest.lng]);
          var el = distLabel.getElement();
          if (el) { var d = el.querySelector('.dist-label'); if(d) d.textContent = distText; }
        }
      }
    }

    // ── Restaurant pin ──────────────────────────────────────────────
    if (st.pickup && st.pickup.lat) {
      var ll = [st.pickup.lat, st.pickup.lng];
      if (!pickupMarker) pickupMarker = L.marker(ll,{icon:restaurantIcon}).addTo(map);
      else pickupMarker.setLatLng(ll);
      bounds.push(ll);
    }

    // ── Customer pin ────────────────────────────────────────────────
    if (st.dropoff && st.dropoff.lat) {
      var ll = [st.dropoff.lat, st.dropoff.lng];
      if (!dropoffMarker) dropoffMarker = L.marker(ll,{icon:houseIcon}).addTo(map);
      else dropoffMarker.setLatLng(ll);
      bounds.push(ll);
    }

    // ── Route polyline ──────────────────────────────────────────────
    if (st.polyline && st.polyline.length > 1) {
      var lls = st.polyline.map(function(p){return[p.latitude,p.longitude];});
      drawRoute(lls);
      lls.forEach(function(l){ bounds.push(l); });
    } else if (st.routeOrigin && st.routeDestination) {
      var fetchKey = st.routeOrigin.lat + ',' + st.routeOrigin.lng + '|' + st.routeDestination.lat + ',' + st.routeDestination.lng;
      if (fetchKey !== window._lastRouteFetchKey) {
        window._lastRouteFetchKey = fetchKey;
        fetchRoadRoute(st.routeOrigin, st.routeDestination);
      }
    }

    // Initial fit (only once)
    if (bounds.length > 1 && !hasInitialFit) {
      hasInitialFit = true;
      map.fitBounds(L.latLngBounds(bounds),{
        paddingTopLeft:[30,40], paddingBottomRight:[30,${BOTTOM_PAD}], animate:true
      });
    }
  } catch(e){ console.error(e); }
};
</script>
</body></html>`;
  }, []);

  return (
    <View style={StyleSheet.absoluteFill}>
      <WebView
        ref={webviewRef}
        source={{ html: htmlContent }}
        style={StyleSheet.absoluteFill}
        scrollEnabled={false}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        onLoadEnd={onLoadEnd}
      />
    </View>
  );
}
