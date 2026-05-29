'use client';

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAppDispatch, useAppSelector } from '@/lib/store/store';
import { addCustomPlaceReport } from '@/lib/store/slices/placesSlice';
import { setSelectedPlaceId } from '@/lib/store/slices/uiSlice';

interface BevcoOutlet {
  District: string;
  ShopCode: string;
  ShopName: string;
  Category: string;
  Address: string;
  Phone: string;
  GoogleMapsLink: string;
  Latitude: string;
  Longitude: string;
}

export default function BevcoMap() {
  const dispatch = useAppDispatch();
  const mapRef = useRef<L.Map | null>(null);
  const markerClusterGroupRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Record<string, L.CircleMarker>>({});
  
  const [outlets, setOutlets] = useState<BevcoOutlet[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [activeOutlet, setActiveOutlet] = useState<BevcoOutlet | null>(null);

  // Select custom reported places from Redux store
  const reduxPlaces = useAppSelector((state) => state.places.items);

  // Fetch the outlets data from public directory
  useEffect(() => {
    fetch('/bevco_outlets_kerala.json')
      .then((res) => res.json())
      .then((data: BevcoOutlet[]) => {
        // Clean coordinates and store
        const validData = data.filter(
          (o) => o.Latitude && o.Longitude && !isNaN(Number(o.Latitude)) && !isNaN(Number(o.Longitude))
        );
        setOutlets(validData);
        
        // Extract distinct districts for filter dropdown
        const uniqDistricts = Array.from(new Set(validData.map((o) => o.District))).sort();
        setDistricts(uniqDistricts);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load bevco outlets:', err);
        setLoading(false);
      });
  }, []);

  // Filter outlets
  const filteredOutlets = React.useMemo(() => {
    return outlets.filter((o) => {
      const matchDistrict = selectedDistrict === 'all' || o.District === selectedDistrict;
      const matchSearch =
        o.ShopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.Address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.ShopCode.toLowerCase().includes(searchQuery.toLowerCase());
      return matchDistrict && matchSearch;
    });
  }, [outlets, selectedDistrict, searchQuery]);

  // Initialize Map
  useEffect(() => {
    if (mapRef.current) return; // Already initialized

    // Kerala bounds centering roughly at (10.5, 76.5)
    const map = L.map('bevco-leaflet-map', {
      center: [10.52, 76.55],
      zoom: 7.5,
      zoomControl: true,
      attributionControl: false,
    });

    // Dark-mode premium tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 18,
    }).addTo(map);

    // 1. Fetch and draw Kerala state outer boundary bold outline
    fetch('/kerala_state.geojson')
      .then((res) => res.json())
      .then((stateData) => {
        if (mapRef.current && mapRef.current === map) {
          L.geoJSON(stateData, {
            style: {
              color: '#ef4444',       // Bold Red outline matching the dots theme
              weight: 3.5,            // Strong, distinct bigger outline
              opacity: 0.8,           // Glowing state boundary line
              fillColor: 'transparent',
              fillOpacity: 0
            },
            interactive: false        // Completely pass through clicks to outlet dots
          }).addTo(map);
        }
      })
      .catch((err) => {
        console.error('Failed to load Kerala state outer GeoJSON overlay:', err);
      });

    // 2. Fetch and draw Kerala district boundaries (extremely faint and thin, passive)
    fetch('/kerala_districts.geojson')
      .then((res) => res.json())
      .then((geoData) => {
        if (mapRef.current && mapRef.current === map) {
          L.geoJSON(geoData, {
            style: {
              color: '#ef4444',       // Clear red outline matching the state theme
              weight: 1.0,            // Small, visible outline
              opacity: 0.35,          // Clean visible opacity
              fillColor: 'transparent',
              fillOpacity: 0
            },
            interactive: false        // Passthrough interactions
          }).addTo(map);
        }
      })
      .catch((err) => {
        console.error('Failed to load Kerala districts GeoJSON boundary overlay:', err);
      });

    markerClusterGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update dots when filters change or when Redux custom places change
  useEffect(() => {
    const map = mapRef.current;
    const group = markerClusterGroupRef.current;
    if (!map || !group) return;

    // Clear previous markers
    group.clearLayers();
    markersRef.current = {};

    // Add dynamic ticker handler for open popups
    const handlePopupOpen = (e: L.PopupEvent) => {
      const popup = e.popup;
      const element = popup.getElement();
      if (!element) return;

      const timerSpan = element.querySelector('.popup-timer') as HTMLSpanElement | null;
      if (!timerSpan) return;

      const timestamp = Number(timerSpan.getAttribute('data-timestamp'));
      if (!timestamp) return;

      const updateTimer = () => {
        const expiresAt = timestamp + 10 * 60 * 1000;
        const remaining = expiresAt - Date.now();
        if (remaining <= 0) {
          timerSpan.innerText = 'Expired';
          popup.close();
          clearInterval(intervalId);
        } else {
          const minutes = Math.floor(remaining / 1000 / 60);
          const seconds = Math.floor((remaining / 1000) % 60);
          timerSpan.innerText = `${minutes}m ${seconds}s`;
        }
      };

      updateTimer();
      const intervalId = setInterval(updateTimer, 1000);

      // Clean up when closed
      map.once('popupclose', () => {
        clearInterval(intervalId);
      });
    };

    map.on('popupopen', handlePopupOpen);

    // Add new circles
    filteredOutlets.forEach((outlet) => {
      const lat = Number(outlet.Latitude);
      const lng = Number(outlet.Longitude);

      // Match with reported place in Redux
      const pin = outlet.Address.match(/\b\d{6}\b/)?.[0] || '682016';
      const cleanName = `BEVCO Outlet, ${outlet.ShopName}`;
      const cleanId = 'custom-' + cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + pin;
      
      const reported = reduxPlaces.find(
        (p) => (p.id === cleanId || 
               p.id === `bevco-${outlet.ShopCode.toLowerCase()}` ||
               (outlet.ShopCode === '1002' && p.id === 'bevco-tvm') || // East Fort mapping
               (outlet.ShopCode === '7012' && p.id === 'bevco-ekm') || // Ernakulam mapping
               p.name.toLowerCase().includes(outlet.ShopName.toLowerCase())) &&
               p.reportedAtTimestamp !== undefined
      );

      // Create marker: green if reported, red if unreported
      const circle = L.circleMarker([lat, lng], {
        radius: reported ? 2.2 : 1.5,
        fillColor: reported ? '#10b981' : '#ef4444', // Green for reported, Red for unreported
        color: reported ? '#047857' : '#b91c1c',     // Border darker
        weight: reported ? 0.6 : 0.4,
        opacity: reported ? 1 : 0.85,
        fillOpacity: reported ? 0.95 : 0.85,
        className: reported ? 'pulse-marker' : '',
      });

      // Simple tooltip info on hover
      circle.bindTooltip(`<strong>${outlet.ShopName}</strong> (${outlet.District})<br/><span style="font-size:9px;color:${reported ? '#34d399' : '#f87171'};">${reported ? '🟢 Reported Data' : '🔴 No Active Reports'}</span>`, {
        direction: 'top',
        offset: [0, -5],
        className: 'custom-map-tooltip',
      });

      // Popup box details on click
      const container = document.createElement('div');
      container.className = 'custom-leaflet-popup-container';
      container.innerHTML = `
        <div style="font-family: inherit; min-width: 170px; padding: 4px 2px;">
          <span style="font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: ${reported ? '#34d399' : '#f87171'};">
            ${reported ? '🟢 Active Crowd Data' : '🔴 Unreported Location'}
          </span>
          <h4 style="font-size: 13px; font-weight: 800; margin: 4px 0 2px 0; color: #f4f4f5; line-height: 1.3;">
            ${outlet.ShopName}
          </h4>
          <p style="font-size: 9px; margin: 0 0 8px 0; color: #71717a;">
            District: ${outlet.District} &bull; Code: ${outlet.ShopCode}
          </p>
          <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.05); padding: 8px; border-radius: 6px; font-size: 10px; display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #71717a;">Crowd Density:</span>
              <strong style="color: ${reported ? '#34d399' : '#f4f4f5'};">${reported ? reported.crowdStatus.toUpperCase() : 'N/A'}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #71717a;">Queue Wait:</span>
              <strong style="color: #e4e4e7;">${reported ? reported.waitMinutes : 0} minutes</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #71717a;">Reports Count:</span>
              <strong style="color: #e4e4e7;">${reported ? reported.reportsCount : 0}</strong>
            </div>
          </div>
          ${reported && reported.reportedAtTimestamp ? `
          <div style="margin-top: 6px; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.15); padding: 6px; border-radius: 4px; font-size: 9.5px; text-align: center; color: #34d399; font-weight: 500;">
            ⏳ Data Expires in: <span class="popup-timer" data-timestamp="${reported.reportedAtTimestamp}">10m 00s</span>
          </div>
          ` : `
          <p style="font-size: 8.5px; color: #a1a1aa; margin: 8px 0 0 0; text-align: center;">
            Click to select & submit updates
          </p>
          `}
        </div>
      `;

      circle.bindPopup(container, {
        className: 'custom-leaflet-popup',
        maxWidth: 240,
        closeButton: false,
      });

      // Bind detailed popup & select on click — does NOT seed Redux (only form submissions should mark green)
      circle.on('click', () => {
        setActiveOutlet(outlet);
        map.setView([lat, lng], 13);
        dispatch(setSelectedPlaceId(cleanId));
      });

      circle.addTo(group);
      markersRef.current[cleanId] = circle;
      if (reported) {
        markersRef.current[reported.id] = circle;
      }
    });

    // Draw custom outlets from Redux that are NOT already in the catalog (i.e. truly custom added by pincode)
    const customBevcos = reduxPlaces.filter(p => {
      if (p.category !== 'bevco' || !p.latitude || !p.longitude) return false;
      
      const isAlreadyInCatalog = filteredOutlets.some(outlet => {
        if (!outlet.ShopName) return false;
        const pin = outlet.Address.match(/\b\d{6}\b/)?.[0] || '';
        const cleanName = `BEVCO Outlet, ${outlet.ShopName}`;
        const cleanId = 'custom-' + cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + pin;
        return p.id === cleanId || 
               p.id === `bevco-${outlet.ShopCode.toLowerCase()}` ||
               (outlet.ShopCode === '1002' && p.id === 'bevco-tvm') ||
               (outlet.ShopCode === '7012' && p.id === 'bevco-ekm');
      });
      
      return !isAlreadyInCatalog;
    });
    customBevcos.forEach((place) => {
      const lat = place.latitude!;
      const lng = place.longitude!;

      // Draw custom reported outlet as a special glowing/pulsing green circle with dark green border!
      const circle = L.circleMarker([lat, lng], {
        radius: 2.4,
        fillColor: '#10b981', // GREEN
        color: '#047857',     // Dark green border
        weight: 0.6,
        opacity: 1,
        fillOpacity: 0.95,
        className: 'pulse-marker',
      });

      circle.bindTooltip(`<strong>${place.name}</strong><br/><span style="color:#a1a1aa;">${place.address}</span><br/><strong style="color:#34d399;">Status: ${place.crowdStatus.toUpperCase()}</strong>`, {
        direction: 'top',
        offset: [0, -6],
        className: 'custom-map-tooltip',
      });

      // Bind detailed popup on click for custom outlets too!
      const container = document.createElement('div');
      container.className = 'custom-leaflet-popup-container';
      container.innerHTML = `
        <div style="font-family: inherit; min-width: 170px; padding: 4px 2px;">
          <span style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #34d399;">
            🟢 Custom User Report
          </span>
          <h4 style="font-size: 13px; font-weight: 800; margin: 4px 0 2px 0; color: #f4f4f5; line-height: 1.3;">
            ${place.name}
          </h4>
          <p style="font-size: 9px; margin: 0 0 8px 0; color: #71717a;">
            ${place.address}
          </p>
          <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.05); padding: 8px; border-radius: 6px; font-size: 10px; display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #71717a;">Crowd Density:</span>
              <strong style="color: #34d399;">${place.crowdStatus.toUpperCase()}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #71717a;">Queue Wait:</span>
              <strong style="color: #e4e4e7;">${place.waitMinutes} minutes</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #71717a;">Reports Count:</span>
              <strong style="color: #e4e4e7;">${place.reportsCount}</strong>
            </div>
          </div>
          <div style="margin-top: 6px; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.15); padding: 6px; border-radius: 4px; font-size: 9.5px; text-align: center; color: #34d399; font-weight: 500;">
            ⏳ Data Expires in: <span class="popup-timer" data-timestamp="${place.reportedAtTimestamp || Date.now()}">10m 00s</span>
          </div>
        </div>
      `;

      circle.bindPopup(container, {
        className: 'custom-leaflet-popup',
        maxWidth: 240,
        closeButton: false,
      });

      circle.on('click', () => {
        const mockOutlet: BevcoOutlet = {
          District: place.address.split(',')[1]?.trim() || 'Kerala',
          ShopCode: 'CUSTOM',
          ShopName: place.name,
          Category: 'bevco',
          Address: place.address,
          Phone: 'N/A',
          GoogleMapsLink: '',
          Latitude: String(lat),
          Longitude: String(lng)
        };
        setActiveOutlet(mockOutlet);
        map.setView([lat, lng], 13);
        dispatch(setSelectedPlaceId(place.id));
      });

      circle.addTo(group);
      markersRef.current[place.id] = circle;
    });

    // Fit bounds if filtered is not empty and not 'all' to ease zooming
    if (selectedDistrict !== 'all' && filteredOutlets.length > 0) {
      const coords = filteredOutlets.map((o) => [Number(o.Latitude), Number(o.Longitude)] as [number, number]);
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [30, 30] });
    }

    return () => {
      map.off('popupopen', handlePopupOpen);
    };
  }, [filteredOutlets, selectedDistrict, reduxPlaces, dispatch]);

  // Center on single outlet
  const handleLocateOutlet = (outlet: BevcoOutlet) => {
    const map = mapRef.current;
    if (!map) return;
    setActiveOutlet(outlet);
    map.setView([Number(outlet.Latitude), Number(outlet.Longitude)], 14);
  };

  return (
    <div className="glass p-5 rounded-2xl flex flex-col gap-5 border border-red-500/10">
      
      {/* Map Header and Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            Interactive Kerala BEVCO Outlets Map
          </h2>
          <p className="text-xs text-zinc-400">
            Geographic directory of {outlets.length} outlets. Plotted as small red dots.
          </p>
        </div>

        {/* Dynamic Outlet Counter */}
        <div className="bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-lg text-xs text-red-400 font-semibold shrink-0">
          Showing {filteredOutlets.length} of {outlets.length} Outlets
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* District Selector */}
        <div className="md:col-span-4 flex flex-col gap-1">
          <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
            Filter by District
          </label>
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="w-full bg-zinc-900/60 text-zinc-200 border border-zinc-800 rounded-lg p-2 text-xs focus:outline-none focus:border-red-500 cursor-pointer"
          >
            <option value="all">All Districts (Entire Kerala)</option>
            {districts.map((dist) => (
              <option key={dist} value={dist}>
                {dist}
              </option>
            ))}
          </select>
        </div>

        {/* Search Input */}
        <div className="md:col-span-8 flex flex-col gap-1">
          <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
            Search Outlet Name or Address
          </label>
          <input
            type="text"
            placeholder="Type shop name, code, address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900/60 text-zinc-200 border border-zinc-800 rounded-lg p-2 text-xs focus:outline-none focus:border-red-500"
          />
        </div>
      </div>

      {/* Main Grid: Leaflet Container and detail overlay */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Leaflet Map Div (9 Cols) */}
        <div className="lg:col-span-8 relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950">
          {loading && (
            <div className="absolute inset-0 bg-zinc-950/80 z-20 flex items-center justify-center text-zinc-400 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping mr-2" />
              Loading Kerala coordinates...
            </div>
          )}

          {/* Floating LIVE Ticker Overlay directly on the map canvas! */}
          <div className="absolute top-3 right-3 z-[999] bg-zinc-950/85 backdrop-blur-md border border-zinc-800/80 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-2xl pointer-events-none select-none">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span className="text-[8.5px] font-black uppercase tracking-widest text-red-500">Live</span>
          </div>

          <div
            id="bevco-leaflet-map"
            className="w-full h-[480px] z-10"
            style={{ minHeight: '400px' }}
          />
        </div>

        {/* Details & Listing Sidebar (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          
          {/* Active Detail Display */}
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4 flex flex-col gap-3 min-h-[160px] relative overflow-hidden">
            {activeOutlet ? (
              <>
                <div className="absolute top-0 right-0 p-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-lg shadow-red-500" />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-red-400 uppercase tracking-widest">
                    Selected Outlet ({activeOutlet.ShopCode})
                  </span>
                  <h3 className="font-bold text-zinc-100 text-sm mt-0.5">{activeOutlet.ShopName}</h3>
                  <p className="text-[10px] text-zinc-500">{activeOutlet.District} District</p>
                </div>
                <div className="text-xs text-zinc-300 bg-zinc-950/60 p-2.5 rounded border border-zinc-800/40">
                  <strong className="text-zinc-500 block mb-0.5 text-[9px] uppercase">Address</strong>
                  {activeOutlet.Address}
                </div>

                {/* Not Available Items — pulled from Redux reported data */}
                {(() => {
                  const pin = activeOutlet.Address.match(/\b\d{6}\b/)?.[0] || '';
                  const cleanName = `BEVCO Outlet, ${activeOutlet.ShopName}`;
                  const cleanId = 'custom-' + cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + pin;
                  const reduxEntry = reduxPlaces.find(p =>
                    p.id === cleanId ||
                    p.name.toLowerCase().includes(activeOutlet.ShopName.toLowerCase())
                  );
                  const items = reduxEntry?.notAvailableItems ?? [];
                  return items.length > 0 ? (
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5">
                      <strong className="text-[9px] font-bold uppercase tracking-wider text-amber-400/80 block mb-1.5">
                        ⚠ Not Available
                      </strong>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((item, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 font-medium"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}

                <div className="flex gap-2 mt-1">
                  <a
                    href={activeOutlet.GoogleMapsLink}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full text-center bg-red-600/10 text-red-400 border border-red-500/20 text-[10px] font-semibold py-1.5 rounded hover:bg-red-600 hover:text-white transition-all"
                  >
                    Google Maps
                  </a>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-zinc-500">
                <svg className="w-8 h-8 text-zinc-700 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                <p className="text-xs font-medium">Click on any red dot map marker to inspect outlet details</p>
              </div>
            )}
          </div>

          {/* Quick List of Outlets in Current Filter */}
          <div className="flex flex-col gap-2">
            <h4 className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 px-1">
              Quick Navigation List ({filteredOutlets.slice(0, 15).length} shown)
            </h4>
            <div className="flex flex-col gap-1.5 max-h-[260px] overflow-y-auto pr-1">
              {filteredOutlets.slice(0, 50).map((outlet) => (
                <div
                  key={outlet.ShopCode}
                  onClick={() => handleLocateOutlet(outlet)}
                  className={`p-2 rounded bg-zinc-900/30 border text-left cursor-pointer transition-all ${
                    activeOutlet?.ShopCode === outlet.ShopCode
                      ? 'border-red-500/40 bg-red-500/[0.02]'
                      : 'border-zinc-800/40 hover:bg-zinc-800/40 hover:border-zinc-700/60'
                  }`}
                >
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-200 truncate">{outlet.ShopName}</span>
                    <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 shrink-0 uppercase font-mono">
                      {outlet.ShopCode}
                    </span>
                  </div>
                  <p className="text-[9px] text-zinc-500 truncate mt-0.5">{outlet.Address}</p>
                </div>
              ))}
              {filteredOutlets.length > 50 && (
                <div className="text-center text-[9px] text-zinc-600 pt-1 italic">
                  + {filteredOutlets.length - 50} more. Refine your search to filter.
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>
      
      {/* Custom Styles for Tooltips inside map */}
      <style jsx global>{`
        .custom-map-tooltip {
          background: #09090b !important;
          color: #f4f4f5 !important;
          border: 1px solid #3f3f46 !important;
          border-radius: 6px !important;
          padding: 4px 8px !important;
          font-family: system-ui, sans-serif !important;
          font-size: 11px !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5) !important;
        }
        .custom-district-tooltip {
          background: #09090b !important;
          color: #ef4444 !important;
          border: 1px solid rgba(239, 68, 68, 0.3) !important;
          border-radius: 6px !important;
          padding: 4px 8px !important;
          font-family: system-ui, sans-serif !important;
          font-size: 11px !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6) !important;
        }
        .leaflet-popup-content-wrapper {
          background: #09090b !important;
          color: #f4f4f5 !important;
          border: 1px solid #27272a !important;
          border-radius: 8px !important;
          }
        .custom-leaflet-popup .leaflet-popup-content {
          margin: 12px 14px !important;
          line-height: inherit !important;
        }
        .leaflet-popup-tip {
          background: #27272a !important;
        }
        .leaflet-bar {
          border: 1px solid #27272a !important;
          background: #09090b !important;
          border-radius: 6px !important;
          overflow: hidden;
        }
        .leaflet-bar a {
          background-color: #18181b !important;
          color: #f4f4f5 !important;
          border-bottom: 1px solid #27272a !important;
        }
        .leaflet-bar a:hover {
          background-color: #27272a !important;
          color: #white !important;
        }
      `}</style>
    </div>
  );
}
