import React, { useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { appConfig } from '../config/appConfig';

interface LeafletMapProps {
  tileUrl: string;
  partnerCoords: { latitude: number; longitude: number } | null;
  pickupCoords?: { lat: number; lng: number } | null;
  dropoffCoords?: { lat: number; lng: number } | null;
  routeOrigin?: { lat: number; lng: number } | null;
  routeDestination?: { lat: number; lng: number } | null;
  polylinePoints?: { latitude: number; longitude: number }[];
  bottomPadding?: number;
}

export default function LeafletMap({ tileUrl, partnerCoords, pickupCoords, dropoffCoords, routeOrigin, routeDestination, polylinePoints, bottomPadding = 300 }: LeafletMapProps) {
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
      pickup: pickupCoords,
      dropoff: dropoffCoords,
      routeOrigin: routeOrigin ?? pickupCoords,
      routeDestination: routeDestination ?? dropoffCoords,
      polyline: polylinePoints ?? [],
    }));
  }, [partnerCoords, pickupCoords, dropoffCoords, routeOrigin, routeDestination, polylinePoints]);

  const onLoadEnd = () => {
    if (!webviewRef.current) return;
    webviewRef.current.injectJavaScript(buildJs({
      partner: partnerCoords,
      pickup: pickupCoords,
      dropoff: dropoffCoords,
      routeOrigin: routeOrigin ?? pickupCoords,
      routeDestination: routeDestination ?? dropoffCoords,
      polyline: polylinePoints ?? [],
    }));
  };

  const API_BASE = appConfig.apiBaseUrl;
  const BOTTOM_PAD = bottomPadding;

  const htmlContent = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;overflow:hidden;background:#e8e0d8}
#map{width:100%;height:100%}
.scooter-wrap{width:48px;height:48px;display:flex;align-items:center;justify-content:center;}
.scooter-bg{
  width:44px;height:44px;border-radius:50%;background:#E53935;
  box-shadow:0 3px 10px rgba(229,57,53,0.55);
  display:flex;align-items:center;justify-content:center;
  animation:pulse 1.5s ease-in-out infinite;
}
@keyframes pulse{
  0%,100%{box-shadow:0 3px 10px rgba(229,57,53,0.55);}
  50%{box-shadow:0 3px 20px rgba(229,57,53,0.9),0 0 0 8px rgba(229,57,53,0.15);}
}
.pin{display:flex;flex-direction:column;align-items:center;}
.pin-circle{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;box-shadow:0 3px 10px rgba(0,0,0,0.3);}
.pin-tail{width:5px;height:12px;border-radius:0 0 4px 4px;margin-top:-1px;}
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var API_BASE = '${API_BASE}';
var map = L.map('map',{zoomControl:false,attributionControl:false}).setView([19.0856,72.865],14);
L.tileLayer('${tileUrl}',{maxZoom:19}).addTo(map);

// ── ICONS ──────────────────────────────────────────────────────────────
var scooterIcon = L.divIcon({
  className:'', iconSize:[48,48], iconAnchor:[24,24],
  html:'<div class="scooter-wrap"><div class="scooter-bg"><svg width="28" height="20" viewBox="0 0 28 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="4" cy="15" r="3.5" stroke="white" stroke-width="1.8"/><circle cx="24" cy="15" r="3.5" stroke="white" stroke-width="1.8"/><path d="M7.5 15L10 7H18L22 12" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 7L20 4H24" stroke="white" stroke-width="1.8" stroke-linecap="round"/><rect x="9" y="4" width="7" height="5" rx="1" fill="white" opacity="0.9"/><path d="M20.5 12H23.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg></div></div>'
});
var restaurantIcon = L.divIcon({
  className:'', iconSize:[44,56], iconAnchor:[22,56],
  html:'<div class="pin"><div class="pin-circle" style="background:#FF6D00;">&#127860;</div><div class="pin-tail" style="background:#FF6D00;"></div></div>'
});
var houseIcon = L.divIcon({
  className:'', iconSize:[44,56], iconAnchor:[22,56],
  html:'<div class="pin"><div class="pin-circle" style="background:#1565C0;">&#127968;</div><div class="pin-tail" style="background:#1565C0;"></div></div>'
});

// ── POLYLINE DECODER (Google encoded polyline algorithm) ───────────────
function decodePolyline(encoded) {
  var points = [], index = 0, len = encoded.length, lat = 0, lng = 0;
  while (index < len) {
    var b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

// ── ROUTE DRAWING ─────────────────────────────────────────────────────
var routeCasing = null;   // white/dark border underneath
var routeLine = null;     // red main line

function clearRoute() {
  if (routeCasing) { map.removeLayer(routeCasing); routeCasing = null; }
  if (routeLine)   { map.removeLayer(routeLine);   routeLine = null; }
}

function drawRoute(latlngs) {
  if (!latlngs || latlngs.length < 2) return;
  clearRoute();
  // Zomato-style: dark shadow casing under the main line for depth
  routeCasing = L.polyline(latlngs, {
    color: '#9E1111', weight: 9, opacity: 0.45,
    lineJoin: 'round', lineCap: 'round'
  }).addTo(map);
  // Bright red main route
  routeLine = L.polyline(latlngs, {
    color: '#E53935', weight: 6, opacity: 1,
    lineJoin: 'round', lineCap: 'round'
  }).addTo(map);
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
        // Fit map to show full route
        if (pts.length > 0) {
          var allBounds = pts.slice();
          if (scooterMarker) allBounds.push(scooterMarker.getLatLng());
          map.fitBounds(L.latLngBounds(allBounds), {
            paddingTopLeft:[30,80], paddingBottomRight:[30,300], animate:true
          });
        }
      }
    })
    .catch(function(e){ console.warn('Route fetch failed:', e); });
}

// ── MARKERS ───────────────────────────────────────────────────────────
var scooterMarker = null, pickupMarker = null, dropoffMarker = null;
var lastPickup = null, lastDropoff = null;

window.updateMapState = function(s) {
  try {
    var st = JSON.parse(s);
    var bounds = [];

    if (st.partner && st.partner.latitude) {
      var ll = [st.partner.latitude, st.partner.longitude];
      if (!scooterMarker) scooterMarker = L.marker(ll,{icon:scooterIcon,zIndexOffset:1000}).addTo(map);
      else scooterMarker.setLatLng(ll);
      bounds.push(ll);
    }

    if (st.pickup && st.pickup.lat) {
      var ll = [st.pickup.lat, st.pickup.lng];
      if (!pickupMarker) pickupMarker = L.marker(ll,{icon:restaurantIcon}).addTo(map);
      bounds.push(ll);
    }

    if (st.dropoff && st.dropoff.lat) {
      var ll = [st.dropoff.lat, st.dropoff.lng];
      if (!dropoffMarker) dropoffMarker = L.marker(ll,{icon:houseIcon}).addTo(map);
      bounds.push(ll);
    }

    // Always draw polyline if provided by React Native props
    if (st.polyline && st.polyline.length > 1) {
      var lls = st.polyline.map(function(p){return[p.latitude,p.longitude];});
      drawRoute(lls);
      lls.forEach(function(l){ bounds.push(l); }); // Add polyline points to bounds to ensure it fits!
    } else if (st.routeOrigin && st.routeDestination) {
      // Fetch exact road route from backend API
      var fetchKey = st.routeOrigin.lat + ',' + st.routeOrigin.lng + '|' + st.routeDestination.lat + ',' + st.routeDestination.lng;
      if (fetchKey !== window._lastRouteFetchKey) {
        window._lastRouteFetchKey = fetchKey;
        fetchRoadRoute(st.routeOrigin, st.routeDestination);
      }
    }

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds),{
        paddingTopLeft:[30,40], paddingBottomRight:[30,${BOTTOM_PAD}], animate:true
      });
    }
  } catch(e){ console.error(e); }
};
</script>
</body></html>`;

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
