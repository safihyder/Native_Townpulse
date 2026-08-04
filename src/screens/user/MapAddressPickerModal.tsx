import React, { useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import WebView from 'react-native-webview';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelectLocation: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
};

export function MapAddressPickerModal({ visible, onClose, onSelectLocation, initialLat = 28.6139, initialLng = 77.2090 }: Props) {
  const [loading, setLoading] = useState(true);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number, lng: number } | null>(null);

  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; }
        #map { height: 100vh; width: 100vw; }
        .center-marker {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -100%);
          z-index: 1000;
          pointer-events: none;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <svg class="center-marker" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3"></circle>
      </svg>
      <script>
        var map = L.map('map', { zoomControl: false }).setView([${initialLat}, ${initialLng}], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap'
        }).addTo(map);

        map.on('moveend', function() {
          var center = map.getCenter();
          window.ReactNativeWebView.postMessage(JSON.stringify({
            event: 'onRegionChangeComplete',
            lat: center.lat,
            lng: center.lng
          }));
        });
        
        // Initial center
        window.ReactNativeWebView.postMessage(JSON.stringify({
          event: 'onRegionChangeComplete',
          lat: ${initialLat},
          lng: ${initialLng}
        }));
      </script>
    </body>
    </html>
  `;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>Pick a location</Text>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeTxt}>Close</Text>
          </TouchableOpacity>
        </View>
        <View style={s.mapContainer}>
          {loading && <ActivityIndicator size="large" color="#F5A623" style={s.loader} />}
          <WebView
            source={{ html: mapHtml }}
            onLoadEnd={() => setLoading(false)}
            onMessage={(event) => {
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.event === 'onRegionChangeComplete') {
                  setSelectedCoords({ lat: data.lat, lng: data.lng });
                }
              } catch (e) {}
            }}
            style={s.webview}
          />
        </View>
        <View style={s.footer}>
          <TouchableOpacity 
            style={[s.confirmBtn, !selectedCoords && s.disabledBtn]} 
            onPress={() => {
              if (selectedCoords) onSelectLocation(selectedCoords.lat, selectedCoords.lng);
            }}
            disabled={!selectedCoords}
          >
            <Text style={s.confirmTxt}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', marginTop: 50, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#F3F4F6' },
  title: { fontSize: 18, fontWeight: '700', color: '#1C2434' },
  closeBtn: { padding: 4 },
  closeTxt: { color: '#EF4444', fontWeight: '600' },
  mapContainer: { flex: 1, backgroundColor: '#E5E7EB', position: 'relative' },
  loader: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -18 }, { translateY: -18 }], zIndex: 1 },
  webview: { flex: 1, backgroundColor: 'transparent' },
  footer: { padding: 20, backgroundColor: '#FFF', borderTopWidth: 1, borderColor: '#F3F4F6' },
  confirmBtn: { backgroundColor: '#F5A623', padding: 16, borderRadius: 12, alignItems: 'center' },
  disabledBtn: { backgroundColor: '#FCD34D' },
  confirmTxt: { color: '#FFF', fontWeight: '800', fontSize: 16 },
});
