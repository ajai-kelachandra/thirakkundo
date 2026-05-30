'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useAppDispatch, useAppSelector } from '@/lib/store/store';

const BevcoMap = dynamic(() => import('./components/BevcoMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] bg-zinc-900/40 rounded-2xl flex flex-col items-center justify-center border border-zinc-800 text-zinc-400 gap-2">
      <span className="flex h-3.5 w-3.5 relative">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 animate-pulse"></span>
      </span>
      <span className="text-xs font-semibold">Loading Interactive Kerala Map...</span>
    </div>
  )
});

import {
  setFilterCategory,
  setSearchQuery,
  reportCrowdStatus,
  addCustomPlaceReport,
  cleanExpiredReports,
  syncFromDatabase,
  loadLocalReports,
  Place,
  CrowdStatus,
  WaitReport
} from '@/lib/store/slices/placesSlice';
import {
  setSelectedPlaceId,
  setReportModalOpen
} from '@/lib/store/slices/uiSlice';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { LOCAL_PINCODES } from './data/localPincodes';

// Helper Icons as inline SVGs
const SearchIcon = () => (
  <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const ClockIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const LocationIcon = () => (
  <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-5 h-5 text-emerald-400 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const FirebaseIcon = () => (
  <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
    <path d="M16 11.53L12.56 5c-.15-.28-.56-.28-.71 0L10.02 8.4 6.78 2.27c-.16-.31-.62-.26-.7.1L3 17.5l9 5a1.14 1.14 0 001.07 0l8.93-5-2-5.97z"/>
  </svg>
);

// Redesigned premium Category Icons with HSL glowing backgrounds
const CategoryIcons: Record<string, React.ReactNode> = {
  bevco: (
    <span className="p-3 bg-gradient-to-br from-red-500/20 to-purple-600/10 text-red-400 rounded-xl border border-red-500/20 shadow-md shadow-red-500/5 transition-transform duration-300 group-hover:scale-105">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    </span>
  ),
  cafe: (
    <span className="p-3 bg-gradient-to-br from-amber-500/20 to-orange-600/10 text-amber-400 rounded-xl border border-amber-500/20 shadow-md shadow-amber-500/5 transition-transform duration-300 group-hover:scale-105">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
      </svg>
    </span>
  ),
  supermarket: (
    <span className="p-3 bg-gradient-to-br from-emerald-500/20 to-teal-600/10 text-emerald-400 rounded-xl border border-emerald-500/20 shadow-md shadow-emerald-500/5 transition-transform duration-300 group-hover:scale-105">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    </span>
  ),
  transit: (
    <span className="p-3 bg-gradient-to-br from-blue-500/20 to-cyan-600/10 text-blue-400 rounded-xl border border-blue-500/20 shadow-md shadow-blue-500/5 transition-transform duration-300 group-hover:scale-105">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    </span>
  ),
  government: (
    <span className="p-3 bg-gradient-to-br from-rose-500/20 to-pink-600/10 text-rose-400 rounded-xl border border-rose-500/20 shadow-md shadow-rose-500/5 transition-transform duration-300 group-hover:scale-105">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    </span>
  ),
};

export default function Dashboard() {
  const dispatch = useAppDispatch();
  
  // Select values from Redux
  const places = useAppSelector((state) => state.places.items);
  const filterCategory = useAppSelector((state) => state.places.filterCategory);
  const searchQuery = useAppSelector((state) => state.places.searchQuery);
  const recentReports = useAppSelector((state) => state.places.recentReports);
  const selectedPlaceId = useAppSelector((state) => state.ui.selectedPlaceId);

  // Local state for tracking overall historical database report count
  const [dbReportCount, setDbReportCount] = useState<number>(131); // Default to local mock catalog sum (42 + 89)

  // Sync historical total report count from Supabase
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    
    const fetchHistoricalCount = () => {
      supabase
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .then(({ count, error }: any) => {
          if (!error && count !== null) {
            setDbReportCount(count);
          }
        });
    };

    fetchHistoricalCount();
    const interval = setInterval(fetchHistoricalCount, 30000); // refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Load persisted custom user reports from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('thirakkundo_user_reports');
        if (raw) {
          const loaded: Place[] = JSON.parse(raw);
          // Filter out reports that are older than 10 minutes
          const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
          const activeLocalReports = loaded.filter(
            (p) => p.reportedAtTimestamp && p.reportedAtTimestamp > tenMinutesAgo
          );
          if (activeLocalReports.length > 0) {
            dispatch(loadLocalReports(activeLocalReports));
          }
        }
      } catch (err) {
        console.error('Failed to load local reports from localStorage:', err);
      }
    }
  }, [dispatch]);

  // Auto-persist active custom user reports to localStorage on state changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const userReports = places.filter(
          (p) => p.reportedAtTimestamp && (Date.now() - p.reportedAtTimestamp < 10 * 60 * 1000)
        );
        localStorage.setItem('thirakkundo_user_reports', JSON.stringify(userReports));
      } catch (err) {
        console.error('Failed to save user reports to localStorage:', err);
      }
    }
  }, [places]);
  
  // Load official BEVCO outlets catalog on mount (Declared at the top to be available to all hooks)
  const [allBevcoOutlets, setAllBevcoOutlets] = useState<any[]>([]);
  useEffect(() => {
    if (isSupabaseConfigured) {
      supabase
        .from('outlets')
        .select('*')
        .then(({ data, error }: any) => {
          if (error) {
            console.error('Failed to load outlets from Supabase:', error);
            fetch('/bevco_outlets_kerala.json')
              .then((res) => res.json())
              .then((d) => setAllBevcoOutlets(d));
          } else if (data) {
            const mapped = data.map((row: any) => ({
              ShopCode: row.id.replace('bevco-', '').toUpperCase(),
              ShopName: row.name.replace('BEVCO Outlet, ', ''),
              Address: row.address,
              District: row.district,
              Latitude: String(row.latitude || ''),
              Longitude: String(row.longitude || ''),
            }));
            setAllBevcoOutlets(mapped);
          }
        });
    } else {
      fetch('/bevco_outlets_kerala.json')
        .then((res) => res.json())
        .then((data) => setAllBevcoOutlets(data))
        .catch((err) => console.error('Failed to load outlet dataset:', err));
    }
  }, []);

  // Automatic Geolocation tracking & nearest district quick nav shift
  useEffect(() => {
    if (allBevcoOutlets.length === 0) return;
    
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLat = position.coords.latitude;
          const userLng = position.coords.longitude;
          
          // Haversine distance calculator
          const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
            const R = 6371; // km
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = 
              Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
          };

          let nearestOutlet: any = null;
          let minDistance = Infinity;

          allBevcoOutlets.forEach((outlet) => {
            const lat = Number(outlet.Latitude);
            const lng = Number(outlet.Longitude);
            if (!isNaN(lat) && !isNaN(lng)) {
              const dist = getDistance(userLat, userLng, lat, lng);
              if (dist < minDistance) {
                minDistance = dist;
                nearestOutlet = outlet;
              }
            }
          });

          if (nearestOutlet) {
            const cleanName = `BEVCO Outlet, ${nearestOutlet.ShopName}`;
            const pin = nearestOutlet.Address.match(/\b\d{6}\b/)?.[0] || '682016';
            const cleanId = 'custom-' + cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + pin;

            // Check if already in redux places
            const existing = places.find(
              (p) => p.id === cleanId || 
                     p.id === `bevco-${nearestOutlet.ShopCode.toLowerCase()}` ||
                     p.name.toLowerCase().includes(nearestOutlet.ShopName.toLowerCase())
            );

            const targetId = existing ? existing.id : `bevco-${nearestOutlet.ShopCode.toLowerCase()}`;
            dispatch(setSelectedPlaceId(targetId));
            console.log(`Automatically shifted to closest local outlet: ${cleanName} in ${nearestOutlet.District} district.`);
          }
        },
        (error) => {
          console.warn('Geolocation lookup skipped/denied. Defaulting to pre-seeded locations.', error);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    }
  }, [allBevcoOutlets, dispatch, places]);

  // Periodic background check to expire crowd reports after 10 minutes
  useEffect(() => {
    dispatch(cleanExpiredReports());
    const timer = setInterval(() => {
      dispatch(cleanExpiredReports());
    }, 5000); // Check every 5 seconds
    return () => clearInterval(timer);
  }, [dispatch]);

  // Periodic React state refresh tick to update elapsed time labels every 15 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshTick(prev => prev + 1);
    }, 15000); // Trigger state update/refresh every 15 seconds
    return () => clearInterval(timer);
  }, []);

  // Poll live reports and statuses from Supabase and synchronize Redux store
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const fetchLiveStatuses = () => {
      supabase
        .from('live_outlet_status')
        .select('*')
        .then(({ data, error }: any) => {
          if (error) {
            console.error('Failed to sync live statuses from Supabase:', error);
          } else if (data) {
            const mappedPlaces: Place[] = data.map((row: any) => {
              let lastUpdatedText = 'No active reports';
              let ts = row.reported_at_timestamp ? Number(row.reported_at_timestamp) : undefined;
              
              // If the timestamp is in seconds (e.g. less than 10 billion), convert it to milliseconds
              if (ts && ts < 10000000000) {
                ts = ts * 1000;
              }

              const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
              const isExpired = ts && ts < tenMinutesAgo;

              if (ts && !isExpired) {
                const diffMs = Date.now() - ts;
                const diffMin = Math.floor(diffMs / 60000);
                lastUpdatedText = diffMin < 1 ? 'Just now' : `${diffMin}m ago`;
              }
              
              const id = row.id;
              if (isExpired || !ts) {
                // Revert to defaults
                let crowdStatus = 'moderate';
                let waitMinutes = 15;
                let reportsCount = 0;
                
                if (id === 'bevco-ekm') {
                  crowdStatus = 'busy';
                  waitMinutes = 45;
                  reportsCount = 42;
                } else if (id === 'bevco-tvm') {
                  crowdStatus = 'packed';
                  waitMinutes = 80;
                  reportsCount = 89;
                }

                return {
                  id: id,
                  name: row.name,
                  category: row.category as any,
                  address: row.address,
                  crowdStatus: crowdStatus as any,
                  waitMinutes: waitMinutes,
                  reportsCount: reportsCount,
                  lastUpdated: isExpired ? 'Expired' : 'No active reports',
                  hourlyWait: [10, 15, 20, 30, 45, 55, 60, 75, 80, 85, 90, 85, 80, 70, 75, 85, 95, 90, 80, 60, 45, 30, 20, 10],
                  latitude: row.latitude,
                  longitude: row.longitude,
                  notAvailableItems: [],
                  reportedAtTimestamp: undefined
                };
              }

              return {
                id: id,
                name: row.name,
                category: row.category as any,
                address: row.address,
                crowdStatus: row.crowd_status as any,
                waitMinutes: row.wait_minutes,
                reportsCount: row.reports_count,
                lastUpdated: lastUpdatedText,
                hourlyWait: [10, 15, 20, 30, 45, 55, 60, 75, 80, 85, 90, 85, 80, 70, 75, 85, 95, 90, 80, 60, 45, 30, 20, 10],
                latitude: row.latitude,
                longitude: row.longitude,
                notAvailableItems: row.not_available_items || [],
                reportedAtTimestamp: ts
              };
            });
            
            dispatch(syncFromDatabase(mappedPlaces));
          }
        });
    };

    fetchLiveStatuses();
    const interval = setInterval(fetchLiveStatuses, 15000); // Poll every 15 seconds
    return () => clearInterval(interval);
  }, [dispatch]);

  const lastUpdatedPlace = useMemo(() => {
    const getMinutes = (str: string) => {
      if (!str) return 999999;
      if (str.toLowerCase().includes('just now')) return 0;
      const match = str.match(/(\d+)\s*min/);
      if (match) return parseInt(match[1], 10);
      return 999999;
    };
    // Only consider seed/catalog places — exclude user crowd reports (they have reportedAtTimestamp)
    const seedPlaces = places.filter(p => !p.reportedAtTimestamp);
    if (seedPlaces.length === 0) return null;
    return [...seedPlaces].sort((a, b) => getMinutes(a.lastUpdated) - getMinutes(b.lastUpdated))[0];
  }, [places]);

  const totalSubmissions = useMemo(() => {
    // Sum up the overall historical count + any active custom local reports not yet in db
    const activeLocalCustomReportsCount = places.filter(
      (p) => p.category === 'bevco' && p.reportedAtTimestamp && p.id.startsWith('custom-')
    ).length;
    return dbReportCount + activeLocalCustomReportsCount;
  }, [places, dbReportCount]);

  const crowdStats = useMemo(() => {
    const active = places.filter(
      (p) => p.category === 'bevco' && p.reportedAtTimestamp
    );
    const busyPacked = active.filter(p => p.crowdStatus === 'busy' || p.crowdStatus === 'packed').length;
    const emptyModerate = active.filter(p => p.crowdStatus === 'empty' || p.crowdStatus === 'moderate').length;
    return {
      activeCount: active.length,
      busyPacked,
      emptyModerate,
    };
  }, [places]);

  const selectedPlace = useMemo(() => {
    if (!selectedPlaceId) return null;

    const cleanStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Collect all matches in Redux (supporting fuzzy name and alternate ID matching)
    const matches = places.filter((p) => {
      if (p.id === selectedPlaceId) return true;

      // If selecting official ID (e.g. bevco-7023), match user-submitted custom reports for the same shop
      if (selectedPlaceId.startsWith('bevco-')) {
        const code = selectedPlaceId.replace('bevco-', '');
        const officialOutlet = allBevcoOutlets.find(o => o.ShopCode.toLowerCase() === code);
        if (officialOutlet) {
          const officialClean = cleanStr(officialOutlet.ShopName).replace('bevcooutlet', '');
          const pClean = cleanStr(p.name).replace('bevcooutlet', '');
          const officialPin = officialOutlet.Address.match(/\b\d{6}\b/)?.[0] || '';
          const pPin = p.address.match(/\b\d{6}\b/)?.[0] || '';
          return (pClean.includes(officialClean) || officialClean.includes(pClean)) && officialPin === pPin;
        }
      }

      // If selecting a custom ID (e.g. custom-karukachal-686540), match reported official places
      if (selectedPlaceId.startsWith('custom-')) {
        const pin = selectedPlaceId.split('-').pop() || '';
        const cleanSelectedId = selectedPlaceId.replace('bevco-outlet-', '').replace('custom-', '').replace(`-${pin}`, '');
        const pPin = (p.address || '').match(/\b\d{6}\b/)?.[0] || '';
        const pClean = cleanStr(p.name).replace('bevcooutlet', '');
        return (pClean.includes(cleanSelectedId) || cleanSelectedId.includes(pClean)) && pPin === pin;
      }

      return false;
    });

    if (matches.length > 0) {
      // Priority 1: Pick the match that has an active wait time report
      const reportedMatch = matches.find(p => (p.reportsCount || 0) > 0 || !!p.reportedAtTimestamp);
      if (reportedMatch) return reportedMatch;

      // Priority 2: Fallback to exact selected ID match
      const exactMatch = matches.find(p => p.id === selectedPlaceId);
      if (exactMatch) return exactMatch;

      // Priority 3: Fallback to the first match
      return matches[0];
    }

    // 2. If not in Redux, check if it is a catalog outlet ID
    if (allBevcoOutlets.length > 0) {
      const outlet = allBevcoOutlets.find((o) => {
        const pin = o.Address.match(/\b\d{6}\b/)?.[0] || '682016';
        const cleanName = `BEVCO Outlet, ${o.ShopName}`;
        const cleanId = 'custom-' + cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + pin;
        return (
          selectedPlaceId === cleanId ||
          selectedPlaceId === `bevco-${o.ShopCode.toLowerCase()}`
        );
      });

      if (outlet) {
        const pin = outlet.Address.match(/\b\d{6}\b/)?.[0] || '682016';
        return {
          id: selectedPlaceId,
          name: `BEVCO Outlet, ${outlet.ShopName}`,
          category: 'bevco' as const,
          address: outlet.Address,
          crowdStatus: 'moderate' as const,
          waitMinutes: 15,
          reportsCount: 0,
          lastUpdated: 'No active reports',
          hourlyWait: [10, 15, 20, 30, 45, 55, 60, 75, 80, 85, 90, 85, 80, 70, 75, 85, 95, 90, 80, 60, 45, 30, 20, 10],
          latitude: Number(outlet.Latitude),
          longitude: Number(outlet.Longitude),
          notAvailableItems: [] as string[],
          reportedAtTimestamp: undefined as number | undefined
        };
      }
    }

    return null;
  }, [places, selectedPlaceId, allBevcoOutlets]);

  const currentDistrict = useMemo(() => {
    if (!selectedPlace) return 'Ernakulam';
    const districts = [
      'Kasaragod', 'Kannur', 'Wayanad', 'Kozhikode', 'Malappuram',
      'Palakkad', 'Thrissur', 'Ernakulam', 'Idukki', 'Kottayam',
      'Alappuzha', 'Pathanamthitta', 'Kollam', 'Thiruvananthapuram'
    ];
    const combinedText = `${selectedPlace.name} ${selectedPlace.address}`.toLowerCase();
    if (combinedText.includes('kochi') || combinedText.includes('kaloor') || combinedText.includes('kakkanad') || combinedText.includes('edappally')) {
      return 'Ernakulam';
    }
    if (combinedText.includes('trivandrum') || combinedText.includes('east fort')) {
      return 'Thiruvananthapuram';
    }
    for (const dist of districts) {
      if (combinedText.includes(dist.toLowerCase())) {
        return dist;
      }
    }
    return 'Ernakulam';
  }, [selectedPlace]);

  const quickNavigationPlaces = useMemo(() => {
    if (allBevcoOutlets.length === 0) return [];
    const districtOutlets = allBevcoOutlets.filter(
      (outlet) => outlet.District && outlet.District.toLowerCase() === currentDistrict.toLowerCase()
    );

    // Deduplicate district list
    const seen = new Set<string>();
    const uniqueDistrictOutlets: typeof districtOutlets = [];
    for (const outlet of districtOutlets) {
      const pin = outlet.Address.match(/\b\d{6}\b/)?.[0] || '';
      const key = `${outlet.ShopName.toLowerCase().trim()}_${pin}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueDistrictOutlets.push(outlet);
      }
    }

    return uniqueDistrictOutlets
      .map((outlet) => {
        const cleanName = `BEVCO Outlet, ${outlet.ShopName}`;
        const pin = outlet.Address.match(/\b\d{6}\b/)?.[0] || '682016';
        const cleanId = 'custom-' + cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + pin;
        const activeReported = places.find(p => p.id === cleanId || p.name.toLowerCase().includes(outlet.ShopName.toLowerCase()));
        return {
          id: activeReported?.id || cleanId,
          name: cleanName,
          shopName: outlet.ShopName,
          pincode: pin,
          address: outlet.Address,
          crowdStatus: activeReported?.crowdStatus || 'moderate',
          waitMinutes: activeReported?.waitMinutes || 15,
          latitude: Number(outlet.Latitude),
          longitude: Number(outlet.Longitude)
        };
      })
      .filter((p) => {
        const selectedName = selectedPlace ? selectedPlace.name.toLowerCase() : '';
        return !selectedName.includes(p.shopName.toLowerCase());
      })
      .slice(0, 15);
  }, [allBevcoOutlets, currentDistrict, places, selectedPlace]);

  const handleQuickNavSelect = (navItem: any) => {
    dispatch(setSelectedPlaceId(navItem.id));
  };

  // Local state for reporting wait times
  const [reportWait, setReportWait] = useState<number | null>(null);
  const [reportStatus, setReportStatus] = useState<CrowdStatus | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [lastAction, setLastAction] = useState<{ type: string; payload: any; timestamp: string } | null>(null);
  const [detailPlace, setDetailPlace] = useState<(typeof places)[0] | null>(null);
  const [activeFormTab, setActiveFormTab] = useState<'availability' | 'reporting'>('availability');
  const [refreshTick, setRefreshTick] = useState<number>(0);
  const [showCoffeeModal, setShowCoffeeModal] = useState<boolean>(false);
  const [selectedDonation, setSelectedDonation] = useState<number | 'custom'>(60);
  const [customAmount, setCustomAmount] = useState<string>('');

  // Disable background scrolling when any modal is open
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (showCoffeeModal || detailPlace) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }
    return () => {
      if (typeof window !== 'undefined') {
        document.body.style.overflow = '';
      }
    };
  }, [showCoffeeModal, detailPlace]);

  // Local state for pincode and outlet name inputs
  const [reportOutletName, setReportOutletName] = useState<string>('');
  const [reportPincode, setReportPincode] = useState<string>('');
  const [reportNotAvailable, setReportNotAvailable] = useState<string>('');
  const [isFetchingLocation, setIsFetchingLocation] = useState<boolean>(false);
  const [locationStatus, setLocationStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });
  const [reportCoords, setReportCoords] = useState<[number, number] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Local state for searching/filtering outlets in real time
  const [searchOutletQuery, setSearchOutletQuery] = useState<string>('');
  const searchedOutlets = useMemo(() => {
    if (!searchOutletQuery.trim()) return [];
    const query = searchOutletQuery.toLowerCase().trim();
    
    const filtered = allBevcoOutlets.filter(outlet => {
      const name = (outlet.ShopName || '').toLowerCase();
      const dist = (outlet.District || '').toLowerCase();
      const addr = (outlet.Address || '').toLowerCase();
      return name.includes(query) || dist.includes(query) || addr.includes(query);
    });

    // Deduplicate by normalized name and pincode key
    const seen = new Set<string>();
    const deduped: any[] = [];
    
    for (const outlet of filtered) {
      const pin = (outlet.Address || '').match(/\b\d{6}\b/)?.[0] || '';
      const key = `${(outlet.ShopName || '').toLowerCase().trim()}_${pin}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(outlet);
      }
    }

    return deduped.slice(0, 5);
  }, [searchOutletQuery, allBevcoOutlets]);



  const lastSelectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedPlace && selectedPlaceId) {
      setReportOutletName(selectedPlace.name.replace('BEVCO Outlet, ', ''));
      const pinMatch = selectedPlace.address.match(/\b\d{6}\b/);
      if (pinMatch) {
        setReportPincode(pinMatch[0]);
      } else {
        setReportPincode('');
      }
      if (selectedPlace.latitude && selectedPlace.longitude) {
        setReportCoords([selectedPlace.latitude, selectedPlace.longitude]);
      }
      
      // ONLY automatically switch to availability tab if they selected a DIFFERENT shop!
      if (lastSelectedIdRef.current !== selectedPlaceId) {
        setActiveFormTab('availability');
        lastSelectedIdRef.current = selectedPlaceId;
      }
    } else if (!selectedPlaceId) {
      // Keep form clean and empty on initial page load
      setReportOutletName('');
      setReportPincode('');
      setReportCoords(null);
      lastSelectedIdRef.current = null;
    }
  }, [selectedPlace, selectedPlaceId]);

  // Trigger automatic Kerala pincode location fetch when 6 digits are typed
  useEffect(() => {
    if (reportPincode.length === 6) {
      // Avoid overwriting if this pincode matches the selected map marker
      if (selectedPlace) {
        const pinMatch = selectedPlace.address.match(/\b\d{6}\b/);
        const selectedPin = pinMatch ? pinMatch[0] : '';
        if (selectedPin === reportPincode) {
          setLocationStatus({
            type: 'success',
            message: `${selectedPlace.name.replace('BEVCO Outlet, ', '')} (Selected)`
          });
          if (selectedPlace.latitude && selectedPlace.longitude) {
            setReportCoords([selectedPlace.latitude, selectedPlace.longitude]);
          }
          return;
        }
      }

      if (!/^(67|68|69)/.test(reportPincode)) {
        setLocationStatus({ type: 'error', message: 'Outside Kerala boundaries' });
        return;
      }

      // Verify if there is an official BEVCO outlet in this pincode
      if (allBevcoOutlets.length > 0) {
        const pinRegex = new RegExp(`\\b${reportPincode}\\b|PIN[-:\\s]*${reportPincode}`, 'i');
        const matchedOutlets = allBevcoOutlets.filter((outlet) => {
          return outlet.Address && pinRegex.test(outlet.Address);
        });

        if (matchedOutlets.length === 0) {
          setLocationStatus({
            type: 'error',
            message: `No official BEVCO outlets in pincode ${reportPincode}`
          });
          setReportCoords(null);
          setIsFetchingLocation(false);
          return;
        }

        // Auto-fill/suggest the official name of the BEVCO outlet!
        const firstOutlet = matchedOutlets[0];
        setReportOutletName(`BEVCO Outlet, ${firstOutlet.ShopName}`);
      }

      // Get standard coordinate of district
      const DISTRICT_COORDS: Record<string, [number, number]> = {
        'Kasaragod': [12.50, 74.99],
        'Kannur': [11.87, 75.37],
        'Wayanad': [11.60, 76.08],
        'Kozhikode': [11.25, 75.78],
        'Malappuram': [11.07, 76.07],
        'Palakkad': [10.78, 76.65],
        'Thrissur': [10.52, 76.21],
        'Ernakulam': [9.98, 76.28],
        'Idukki': [9.85, 77.04],
        'Kottayam': [9.59, 76.52],
        'Alappuzha': [9.49, 76.33],
        'Pathanamthitta': [9.26, 76.78],
        'Kollam': [8.89, 76.61],
        'Thiruvananthapuram': [8.50, 76.95]
      };



      const match = LOCAL_PINCODES[reportPincode];
      if (match) {
        setReportOutletName(`BEVCO Outlet, ${match.name}`);
        const baseCoord = DISTRICT_COORDS[match.district] || [9.98, 76.28];
        const jitterLat = baseCoord[0] + (Math.random() - 0.5) * 0.08;
        const jitterLng = baseCoord[1] + (Math.random() - 0.5) * 0.08;
        setReportCoords([jitterLat, jitterLng]);
        setLocationStatus({
          type: 'success',
          message: `${match.name}, ${match.district}`
        });
        setIsFetchingLocation(false);
        return;
      }

      const prefix3 = reportPincode.substring(0, 3);
      let guessedDistrict = 'Ernakulam';

      if (prefix3 === '695') guessedDistrict = 'Thiruvananthapuram';
      else if (prefix3 === '691') guessedDistrict = 'Kollam';
      else if (prefix3 === '689') guessedDistrict = 'Pathanamthitta';
      else if (prefix3 === '688') guessedDistrict = 'Alappuzha';
      else if (prefix3 === '686') guessedDistrict = 'Kottayam';
      else if (prefix3 === '685') guessedDistrict = 'Idukki';
      else if (prefix3 === '682' || prefix3 === '683') guessedDistrict = 'Ernakulam';
      else if (prefix3 === '680') guessedDistrict = 'Thrissur';
      else if (prefix3 === '678') guessedDistrict = 'Palakkad';
      else if (prefix3 === '676') guessedDistrict = 'Malappuram';
      else if (prefix3 === '679') {
        if (reportPincode.startsWith('6793')) {
          guessedDistrict = 'Malappuram';
        } else {
          guessedDistrict = 'Palakkad';
        }
      }
      else if (prefix3 === '673') guessedDistrict = 'Kozhikode';
      else if (prefix3 === '671') guessedDistrict = 'Kasaragod';
      else if (prefix3 === '670') {
        if (reportPincode.startsWith('6706') || reportPincode.startsWith('6707')) {
          guessedDistrict = 'Wayanad';
        } else {
          guessedDistrict = 'Kannur';
        }
      }

      setReportOutletName(`BEVCO Outlet, Pincode ${reportPincode}`);
      const baseCoord = DISTRICT_COORDS[guessedDistrict] || [9.98, 76.28];
      const jitterLat = baseCoord[0] + (Math.random() - 0.5) * 0.08;
      const jitterLng = baseCoord[1] + (Math.random() - 0.5) * 0.08;
      setReportCoords([jitterLat, jitterLng]);

      setLocationStatus({
        type: 'success',
        message: `Area ${reportPincode}, ${guessedDistrict}`
      });
      setIsFetchingLocation(false);
    } else {
      setLocationStatus({ type: 'idle', message: '' });
      setReportCoords(null);
    }
  }, [reportPincode, allBevcoOutlets]);
  
  // Track redux action log for visualization
  const [actionHistory, setActionHistory] = useState<Array<{ type: string; payload: any; timestamp: string }>>([
    { type: '@@INIT', payload: {}, timestamp: new Date().toLocaleTimeString() }
  ]);


  // Handle Dispatch with custom log recording for our Dev Panel
  const dispatchWithLog = (action: any) => {
    dispatch(action);
    const newLog = {
      type: action.type,
      payload: action.payload,
      timestamp: new Date().toLocaleTimeString()
    };
    setLastAction(newLog);
    setActionHistory(prev => [newLog, ...prev].slice(0, 8));
  };

  // Filter spots based on selection and search
  const filteredPlaces = useMemo(() => {
    return places.filter((place) => {
      const matchesCategory = filterCategory === 'all' || place.category === filterCategory;
      const matchesSearch =
        place.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        place.address.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [places, filterCategory, searchQuery]);

  // Submit new crowd report
  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportStatus) {
      setFormError('Please select a Queue & Crowd Density status (Mandatory).');
      return;
    }
    if (reportWait === null) {
      setFormError('Please select a Wait Duration (Mandatory).');
      return;
    }
    if (!reportOutletName.trim() || !reportPincode.trim()) {
      setFormError('Please enter both Outlet Name and Pincode.');
      return;
    }

    if (locationStatus.type === 'error') {
      setFormError(locationStatus.message);
      return;
    }

    const lat = reportCoords ? reportCoords[0] : undefined;
    const lng = reportCoords ? reportCoords[1] : undefined;

    const prefix3 = reportPincode.substring(0, 3);
    let guessedDistrict = 'Ernakulam';
    if (prefix3 === '695') guessedDistrict = 'Thiruvananthapuram';
    else if (prefix3 === '691') guessedDistrict = 'Kollam';
    else if (prefix3 === '689') guessedDistrict = 'Pathanamthitta';
    else if (prefix3 === '688') guessedDistrict = 'Alappuzha';
    else if (prefix3 === '686') guessedDistrict = 'Kottayam';
    else if (prefix3 === '685') guessedDistrict = 'Idukki';
    else if (prefix3 === '682' || prefix3 === '683') guessedDistrict = 'Ernakulam';
    else if (prefix3 === '680') guessedDistrict = 'Thrissur';
    else if (prefix3 === '678') guessedDistrict = 'Palakkad';
    else if (prefix3 === '676') guessedDistrict = 'Malappuram';
    else if (prefix3 === '673') guessedDistrict = 'Kozhikode';
    else if (prefix3 === '671') guessedDistrict = 'Kasaragod';
    else if (prefix3 === '670') {
      if (reportPincode.startsWith('6706') || reportPincode.startsWith('6707')) {
        guessedDistrict = 'Wayanad';
      } else {
        guessedDistrict = 'Kannur';
      }
    }

    // Call addCustomPlaceReport to add/update custom outlet place
    const notAvailableArr = reportNotAvailable
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const generatedId = 'custom-' + reportOutletName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + reportPincode;
    
    // Determine the true database and state ID: Use selected official ID if names match
    let targetId = generatedId;
    if (selectedPlace) {
      const cleanSelected = selectedPlace.name.toLowerCase().replace('bevco outlet, ', '').replace(/[^a-z0-9]/g, '');
      const cleanReported = reportOutletName.toLowerCase().replace('bevco outlet, ', '').replace(/[^a-z0-9]/g, '');
      if (cleanSelected.includes(cleanReported) || cleanReported.includes(cleanSelected)) {
        targetId = selectedPlace.id;
      }
    }



    dispatchWithLog(addCustomPlaceReport({
      id: targetId,
      name: reportOutletName,
      pincode: reportPincode,
      crowdStatus: reportStatus,
      waitMinutes: Number(reportWait),
      latitude: lat,
      longitude: lng,
      district: guessedDistrict,
      notAvailableItems: notAvailableArr
    }));

    // Push report to Supabase in parallel if configured
    if (isSupabaseConfigured) {
      supabase
        .from('outlets')
        .upsert({
          id: targetId,
          name: reportOutletName.toUpperCase().includes('OUTLET') || reportOutletName.toUpperCase().includes('BEVCO') ? reportOutletName : `BEVCO Outlet, ${reportOutletName}`,
          category: 'bevco',
          address: guessedDistrict ? `${guessedDistrict} District, Pincode: ${reportPincode}, Kerala` : `Pincode: ${reportPincode}, Kerala`,
          district: guessedDistrict,
          pincode: reportPincode,
          latitude: lat || 10.8505,
          longitude: lng || 76.2711
        }, { onConflict: 'id' })
        .then(({ error: outletError }: any) => {
          if (outletError) {
            console.warn('Outlet upsert bypassed/failed (usually RLS for existing outlet):', outletError.message);
          }
          supabase
            .from('reports')
            .insert({
              outlet_id: targetId,
              crowd_status: reportStatus,
              wait_minutes: Number(reportWait),
              not_available_items: notAvailableArr,
              reported_at: new Date().toISOString()
            })
            .then(({ error: reportError }: any) => {
              if (reportError) {
                console.error('Failed to submit wait report to Supabase:', reportError);
              } else {
                console.log('Successfully saved report to Supabase!');
              }
            });
        });
    }

    dispatchWithLog(setSelectedPlaceId(targetId));
    setActiveFormTab('availability');

    setShowSuccessToast(true);
    setReportStatus(null); // Reset crowd status to unselected after successful submission
    setReportWait(null); // Reset wait duration to force selection next time
    setFormError(null); // Clear any existing form error
    setTimeout(() => setShowSuccessToast(false), 3000);
  };

  // Status-based color class map (Sophisticated Monochrome Zinc/Silver)
  const getStatusDetails = (status: CrowdStatus) => {
    switch (status) {
      case 'empty':
        return {
          bg: 'bg-zinc-900/50 text-zinc-400 border-zinc-800/80',
          glow: 'bg-zinc-500',
          label: 'Empty / No Queue',
        };
      case 'moderate':
        return {
          bg: 'bg-zinc-800/40 text-zinc-300 border-zinc-700/60',
          glow: 'bg-zinc-400',
          label: 'Moderate / Fast-moving',
        };
      case 'busy':
        return {
          bg: 'bg-zinc-850/60 text-zinc-200 border-zinc-700/50',
          glow: 'bg-zinc-300',
          label: 'Busy / Heavy Queue',
        };
      case 'packed':
        return {
          bg: 'bg-zinc-100 text-zinc-950 border-white',
          glow: 'bg-zinc-100',
          label: 'Packed / Extreme Wait',
        };
    }
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 flex flex-col gap-6 relative">

      {/* Recent Updates Scrolling Marquee Ticker */}
      <div className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-xl py-2 px-4 flex items-center gap-3 overflow-hidden shadow-sm">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 shrink-0 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-emerald-500 animate-ping" />
          Live
        </span>
        {React.createElement(
          'marquee',
          {
            behavior: 'scroll',
            direction: 'left',
            scrollamount: '4',
            className: 'text-xs',
            onMouseOver: (e: any) => e.currentTarget.stop(),
            onMouseOut: (e: any) => e.currentTarget.start(),
          } as any,
          (() => {
            const reported = places.filter(p => p.reportedAtTimestamp);
            if (reported.length === 0) {
              return (
                <span style={{ color: '#a1a1aa', fontWeight: 500, fontStyle: 'italic', letterSpacing: '0.02em' }}>
                  📢 Welcome to Thirakkundo! Click on any BEVCO outlet on the map or use search to submit a live wait time report and help other citizens!
                </span>
              );
            }
            return reported.map((place, idx) => {
              const statusLabel = place.crowdStatus.toUpperCase();
              let statusColorHex = '#6b7280';
              if (place.crowdStatus === 'moderate') statusColorHex = '#22c55e';
              if (place.crowdStatus === 'busy')     statusColorHex = '#f59e0b';
              if (place.crowdStatus === 'packed')   statusColorHex = '#ef4444';

              return (
                <span key={place.id} style={{ margin: '0 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ color: '#e4e4e7', fontWeight: 600 }}>{place.name.replace('BEVCO Outlet, ', '')}</span>
                  <span style={{ color: '#52525b' }}>·</span>
                  <span style={{ fontWeight: 700, fontSize: '10px', color: statusColorHex }}>{statusLabel}</span>
                  <span style={{ color: '#71717a', fontSize: '10px' }}>{place.waitMinutes} min</span>
                  {idx < reported.length - 1 && <span style={{ color: '#3f3f46', marginLeft: '12px' }}>·</span>}
                </span>
              );
            });
          })()
        )}
      </div>

      {/* Toast Notification */}
      {showSuccessToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 glass border-emerald-500/30 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in">
          <CheckIcon />
          <div>
            <p className="font-bold text-emerald-400 text-sm">Report Submitted!</p>
          </div>
        </div>
      )}

      {/* Header Panel */}
      <header className="glass p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        {/* Subtle Top Border Line */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-zinc-800" />
        
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-5xl font-extrabold tracking-tight text-zinc-100">
              <span style={{ fontFamily: "'Baloo Chettan 2', sans-serif", fontWeight: 800 }}>തിരക്കുണ്ടോ</span><span className='text-sm tracking-wide'>.in</span>{' '}<span className="font-sans text-lg font-medium text-zinc-400 ml-1">/ Thirakkundo</span><span className='text-xs font-medium tracking-wide'>.in</span>
            </h1>
          
          </div>
          <p className="text-zinc-400 text-sm mt-1">
            Live crowds & waiting queue times tracker for Kerala <span className="text-red-500 font-black">BEVCO</span>.
          </p>
        </div>

        {/* Real-time State & Firebase Guidance Badge */}
        
      </header>

      {/* Main Content Layout */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Citizen Crowd Reporting Card (5 Cols) */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Search Outlets Card */}
          <div className="glass rounded-2xl overflow-hidden border border-white/5 shadow-2xl relative flex flex-col transition-all duration-300">
            <div className="absolute top-0 left-0 right-0 h-0.5" />
            <div className="p-5 flex flex-col gap-4">
              <div>
                <h3 className="font-bold text-zinc-200 text-sm flex items-center gap-2">
                  <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Find Outlets
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">Enter pincode or place name to fetch outlets instantly.</p>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by place name, district, or pincode..."
                  value={searchOutletQuery}
                  onChange={(e) => setSearchOutletQuery(e.target.value)}
                  className="w-full bg-zinc-950/60 text-zinc-100 placeholder-zinc-500 pl-10 pr-10 py-2.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-800/55 text-xs transition-all"
                />
                {searchOutletQuery && (
                  <button
                    onClick={() => setSearchOutletQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Search Results Dropdown */}
              {searchedOutlets.length > 0 && (
                <div className="flex flex-col gap-2 animate-fade-in mt-1">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 px-1">Matching Hotspots</p>
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {searchedOutlets.map((outlet) => {
                      const pin = outlet.Address.match(/\b\d{6}\b/)?.[0] || '';
                      const cleanName = `BEVCO Outlet, ${outlet.ShopName}`;
                      const cleanId = 'custom-' + cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + pin;
                      const targetId = `bevco-${outlet.ShopCode.toLowerCase()}`;
                      
                      return (
                        <button
                          key={outlet.ShopCode}
                          type="button"
                          onClick={() => {
                            dispatch(setSelectedPlaceId(`bevco-${outlet.ShopCode.toLowerCase()}`));
                            setSearchOutletQuery(''); // clear query on selection
                          }}
                          className="w-full text-left flex justify-between items-center px-3.5 py-2.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/80 hover:border-zinc-700/60 transition-all group cursor-pointer"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-bold text-zinc-200 group-hover:text-white transition-colors">
                              {outlet.ShopName}
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              {outlet.District} District {pin && `· PIN-${pin}`}
                            </span>
                          </div>
                          <span className="text-[10px] font-semibold text-zinc-400 group-hover:text-zinc-200 group-hover:translate-x-0.5 transition-all">
                            Select →
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {searchOutletQuery.trim() !== '' && searchedOutlets.length === 0 && (
                <div className="text-center py-4 bg-zinc-900/20 border border-zinc-800/40 rounded-xl">
                  <p className="text-xs text-zinc-500">No outlets found matching "{searchOutletQuery}"</p>
                </div>
              )}
            </div>
          </div>

          <div className="glass rounded-2xl overflow-hidden border border-white/5 shadow-2xl relative flex flex-col transition-all duration-300">
            
            {/* Top Decorative Border Line */}
            <div className="absolute top-0 left-0 right-0 h-0.5 " />
            
            {/* Tab Bar Navigation */}
            <div className="flex border-b border-zinc-900 bg-zinc-950/40 p-1">
              <button
                type="button"
                onClick={() => setActiveFormTab('availability')}
                className={`flex-1 text-center py-2.5 text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                  activeFormTab === 'availability'
                    ? 'bg-zinc-800/60 text-zinc-100 shadow'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40'
                }`}
              >
                Availability Status
              </button>
              <button
                type="button"
                onClick={() => setActiveFormTab('reporting')}
                className={`flex-1 text-center py-2.5 text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                  activeFormTab === 'reporting'
                    ? 'bg-zinc-800/60 text-zinc-100 shadow'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40'
                }`}
              >
                Report Queue
              </button>
            </div>

            <div className="p-5 flex flex-col gap-5">
              
              {activeFormTab === 'availability' ? (
                /* Tab 1: Live Availability Status */
                <div className="flex flex-col gap-4 animate-fade-in">
                  <div>
                    <h3 className="font-bold text-zinc-200 text-sm">Outlet Availability Status</h3>
                    <p className="text-xs text-zinc-400">Current live crowd density and queue reports for the selected location.</p>
                  </div>

                  {selectedPlace ? (
                    (() => {
                      const minutesAgo = selectedPlace.reportedAtTimestamp
                        ? Math.floor((Date.now() - selectedPlace.reportedAtTimestamp) / 60000)
                        : 0;
                      const timeLabel = selectedPlace.reportedAtTimestamp
                        ? (minutesAgo < 1 ? 'Just now' : `${minutesAgo}m ago`)
                        : selectedPlace.lastUpdated;
                      const pinMatch = selectedPlace.address.match(/\b\d{6}\b/);
                      const currentPin = pinMatch ? pinMatch[0] : '';
                      
                      const crowdBgMap: Record<string, string> = {
                        empty: 'bg-zinc-900/50 text-zinc-400 border-zinc-800/80',
                        moderate: 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30',
                        busy: 'bg-amber-950/40 text-amber-400 border-amber-500/30',
                        packed: 'bg-red-950/40 text-red-400 border-red-500/30',
                      };
                      const crowdGlowMap: Record<string, string> = {
                        empty: 'bg-zinc-500',
                        moderate: 'bg-emerald-500 animate-pulse',
                        busy: 'bg-amber-500 animate-pulse',
                        packed: 'bg-red-500 animate-pulse',
                      };

                      const hasActiveReports = (selectedPlace.reportsCount || 0) > 0 || !!selectedPlace.reportedAtTimestamp;

                      return (
                        <div className="flex flex-col gap-4">
                          {/* Selected Shop Info Card */}
                          <div className="bg-zinc-900/35 border border-zinc-850 p-3.5 rounded-xl flex justify-between items-start gap-2">
                            <div className="min-w-0">
                              <h4 className="text-xs font-extrabold text-zinc-200 truncate">
                                {selectedPlace.name.replace('BEVCO Outlet, ', '')}
                              </h4>
                              {selectedPlace.address && (
                                <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                                  {selectedPlace.address}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              {currentPin && (
                                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-zinc-950/60 text-zinc-400 border border-zinc-850 font-bold leading-none">
                                  PIN {currentPin}
                                </span>
                              )}
                              <span className="text-[8.5px] font-bold text-zinc-500 uppercase tracking-wider leading-none">
                                {selectedPlace.reportsCount || 0} SUBMISSION{selectedPlace.reportsCount !== 1 ? 'S' : ''}
                              </span>
                            </div>
                          </div>
                          {!hasActiveReports ? (
                            /* When no active reports exist, show a direct, simple text message and action button to prevent showing fake metrics */
                            <div className="flex flex-col gap-3 py-4 text-center items-center justify-center animate-fade-in">
                              <p className="text-[11px] text-zinc-400 max-w-[280px] leading-relaxed">
                                No real-time crowd or queue updates have been submitted for this outlet in the last 10 minutes.
                              </p>
                              
                              <button
                                type="button"
                                onClick={() => setActiveFormTab('reporting')}
                                className="w-full mt-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 text-xs font-bold py-2.5 rounded-xl shadow-lg transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                              >
                                Submit First Status Report
                              </button>
                            </div>
                          ) : (
                            /* Live Metrics Cards Grid - shown ONLY when active reports exist */
                            <div className="flex flex-col gap-3.5 animate-fade-in">
                              {/* Dynamic Queue Density Metric Counters */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-zinc-900/20 border border-zinc-850 p-3 rounded-xl flex flex-col gap-1 items-center text-center justify-center">
                                  <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">Queue Density</span>
                                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wide mt-1.5 ${crowdBgMap[selectedPlace.crowdStatus] ?? crowdBgMap.empty}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${crowdGlowMap[selectedPlace.crowdStatus] ?? 'bg-zinc-500'}`} />
                                    {selectedPlace.crowdStatus}
                                  </span>
                                </div>

                                <div className="bg-zinc-900/20 border border-zinc-850 p-3 rounded-xl flex flex-col gap-1 items-center text-center justify-center">
                                  <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">Wait Duration</span>
                                  <span className="text-base font-extrabold text-zinc-200 mt-1">
                                    {selectedPlace.waitMinutes} <span className="text-[10px] text-zinc-500 font-bold uppercase">min</span>
                                  </span>
                                </div>
                              </div>

                              {/* Unavailable items report list */}
                              <div className="bg-zinc-900/20 border border-zinc-850 p-3 rounded-xl flex flex-col gap-2">
                                <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">Out of Stock Items</span>
                                {selectedPlace.notAvailableItems && selectedPlace.notAvailableItems.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {selectedPlace.notAvailableItems.map((item, idx) => (
                                      <span key={idx} className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-lg border border-red-500/20 leading-none font-medium">
                                        {item}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 mt-1">
                                    <span>🟢</span>
                                    <span className="font-semibold">All standard items reported in stock!</span>
                                  </div>
                                )}
                              </div>

                              {/* Last updated timing stats */}
                              <div className="flex items-center justify-between px-1 text-[10px] text-zinc-500 border-t border-zinc-900 pt-3">
                                <span className="flex items-center gap-1">
                                  <span>Reported:</span>
                                  <span className="font-bold text-zinc-400">{timeLabel}</span>
                                </span>
                                <span>{selectedPlace.reportsCount || 0} crowd report{selectedPlace.reportsCount !== 1 ? 's' : ''}</span>
                              </div>

                              {/* Action Button transition to reporting tab */}
                              <button
                                type="button"
                                onClick={() => setActiveFormTab('reporting')}
                                className="w-full mt-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 text-xs font-bold py-2.5 rounded-xl shadow-lg transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                              >
                                Submit Wait Time Update
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="py-8 bg-zinc-900/10 border border-zinc-850 rounded-2xl p-6 text-center flex flex-col gap-2 items-center justify-center text-zinc-500 animate-fade-in">
                      <svg className="w-6 h-6 text-zinc-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="text-xs font-bold text-zinc-400">No Outlet Selected</p>
                      <p className="text-[10px] text-zinc-500 leading-normal max-w-[240px] mx-auto">
                        Please search and select a BEVCO shop using the "Find Outlets" section above to instantly view its live status.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* Tab 2: Queue Report Submission Form */
                <form onSubmit={handleSubmitReport} className="flex flex-col gap-4 animate-fade-in">
                  <div>
                    <h3 className="font-bold text-zinc-200 text-sm">Citizen Crowd Reporting</h3>
                    <p className="text-xs text-zinc-400">Report wait time at this location to help fellow Malayalis avoid the queue rush.</p>
                  </div>

                  {/* Pincode & Outlet Name Inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                        Outlet Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. East Fort"
                        value={reportOutletName}
                        onChange={(e) => setReportOutletName(e.target.value)}
                        className="w-full bg-zinc-950/60 text-zinc-100 placeholder-zinc-600 px-3 py-2 rounded-lg border border-zinc-800/80 focus:outline-none focus:border-zinc-700 text-xs transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5 flex justify-between">
                        <span>Pincode</span>
                        {isFetchingLocation && <span className="text-[9px] text-pink-400 animate-pulse lowercase font-normal">fetching...</span>}
                      </label>
                      <input
                        type="text"
                        placeholder="6-digit pincode"
                        maxLength={6}
                        value={reportPincode}
                        onChange={(e) => setReportPincode(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-zinc-950/60 text-zinc-100 placeholder-zinc-600 px-3 py-2 rounded-lg border border-zinc-800/80 focus:outline-none focus:border-zinc-700 text-xs transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* Fetched Location Live Preview Status Indicator */}
                  {locationStatus.type !== 'idle' && (
                    <div className={`text-[10px] rounded-lg px-3 py-1.5 border flex items-center gap-2 transition-all ${
                      locationStatus.type === 'loading' ? 'bg-zinc-800/40 border-zinc-700/50 text-zinc-400 animate-pulse' :
                      locationStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-sm shadow-emerald-500/5' :
                      'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        locationStatus.type === 'loading' ? 'bg-zinc-400' :
                        locationStatus.type === 'success' ? 'bg-emerald-400 animate-pulse' :
                        'bg-red-400'
                      }`} />
                      <span className="font-bold">
                        {locationStatus.type === 'loading' ? 'Locating:' :
                         locationStatus.type === 'success' ? 'Location verified:' :
                         'Lookup Error:'}
                      </span>
                      <span>{locationStatus.message}</span>
                    </div>
                  )}

                  {/* Status selection buttons */}
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                      <span>Queue & Crowd Density</span>
                      <span className="text-red-500 text-xs font-black leading-none">*</span>
                      <span className="text-[9px] text-zinc-500 font-medium normal-case">(Mandatory)</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['empty', 'moderate', 'busy', 'packed'] as CrowdStatus[]).map((status) => {
                        const isSelected = reportStatus === status;
                        
                        const activeColorMap: Record<CrowdStatus, string> = {
                          empty: 'border-zinc-500 text-zinc-200 bg-zinc-900/60 shadow-lg shadow-zinc-500/5',
                          moderate: 'border-emerald-500 text-emerald-400 bg-emerald-950/20 shadow-lg shadow-emerald-500/5',
                          busy: 'border-amber-500 text-amber-400 bg-amber-950/20 shadow-lg shadow-amber-500/5',
                          packed: 'border-red-500 text-red-400 bg-red-950/20 shadow-lg shadow-red-500/5',
                        };

                        return (
                          <button
                            key={status}
                            type="button"
                            onClick={() => { setReportStatus(status); setFormError(null); }}
                            className={`px-3 py-2.5 text-xs font-bold border rounded-lg cursor-pointer transition-all ${
                              isSelected
                                ? activeColorMap[status]
                                : 'border-zinc-800/80 text-zinc-400 bg-zinc-900/20 hover:bg-zinc-900/40 hover:text-zinc-300 hover:border-zinc-700/60'
                            }`}
                          >
                            {status.toUpperCase()}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Wait Time Range Slider */}
                  <div>
                    <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                      <span className="flex items-center gap-1.5">
                        <span>Wait Duration</span>
                        <span className="text-red-500 text-xs font-black leading-none">*</span>
                        <span className="text-[9px] text-zinc-500 font-medium normal-case">(Mandatory)</span>
                      </span>
                      <span className={reportWait === null ? "text-red-400 font-bold text-[9.5px] uppercase tracking-wider animate-pulse" : "text-zinc-200 font-extrabold"}>
                        {reportWait === null ? "Select Duration" : `${reportWait} minutes`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="120"
                      step="5"
                      value={reportWait ?? 0}
                      onChange={(e) => setReportWait(Number(e.target.value))}
                      className="w-full accent-zinc-200 bg-zinc-800 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-zinc-500 font-medium">
                      <span>0 mins (No Wait)</span>
                      <span>60 mins</span>
                      <span>120 mins (Huge)</span>
                    </div>
                  </div>

                  {/* Not Available Items */}
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                      Not Available Items
                      <span className="normal-case font-normal text-zinc-600 ml-1">(comma separated)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Kingfisher Strong, Old Monk, Royal Stag"
                      value={reportNotAvailable}
                      onChange={(e) => setReportNotAvailable(e.target.value)}
                      className="w-full bg-zinc-950/60 text-zinc-100 placeholder-zinc-600 px-3 py-2 rounded-lg border border-zinc-800/80 focus:outline-none focus:border-amber-500/60 text-xs transition-all"
                    />
                  </div>

                  {/* Inline Form Warning Badge */}
                  {formError && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex items-start gap-2.5 text-xs text-amber-400 animate-pulse">
                      <span className="text-base shrink-0 leading-none">⚠</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold">Crowd Report Alert</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5 whitespace-normal break-words">{formError}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormError(null)}
                        className="text-zinc-500 hover:text-zinc-300 text-xs font-bold cursor-pointer shrink-0 ml-1"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isFetchingLocation || locationStatus.type === 'error'}
                    className={`w-full font-bold py-2.5 rounded-lg text-xs cursor-pointer shadow-lg transition-all uppercase tracking-wider ${
                      isFetchingLocation || locationStatus.type === 'error'
                        ? 'bg-zinc-800/80 text-zinc-500 cursor-not-allowed border border-zinc-700/30'
                        : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-950 active:scale-[0.98]'
                    }`}
                  >
                    {isFetchingLocation
                      ? 'Locating...'
                      : locationStatus.type === 'error'
                      ? 'No Outlets Found'
                      : 'Submit Wait Report'}
                  </button>
                </form>
              )}
            </div>
          </div>

        </section>

        {/* RIGHT COLUMN: Interactive Geolocation BEVCO Outlets Map (7 Cols) */}
        <section className="lg:col-span-7 w-full">
          <BevcoMap />
        </section>

      </main>

      {/* Full-width horizontal Recent Updates Section above the footer */}
      {(() => {
        const reportedPlaces = [...places]
          .filter(p => p.reportedAtTimestamp)
          .sort((a, b) => (b.reportedAtTimestamp ?? 0) - (a.reportedAtTimestamp ?? 0))
          .slice(0, 8);

        const crowdColorMap: Record<string, string> = {
          empty:    'text-zinc-500',
          moderate: 'text-emerald-400',
          busy:     'text-amber-400',
          packed:   'text-red-400',
        };

        if (reportedPlaces.length === 0) {
          return (
            <div className="w-full mt-8 glass rounded-2xl border border-white/5 shadow-2xl relative p-8 text-center flex flex-col gap-3 items-center justify-center animate-fade-in">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-zinc-800" />
              <span className="text-3xl">📝</span>
              <h3 className="font-bold text-zinc-300 text-sm">No Active User Reports Yet</h3>
              <p className="text-xs text-zinc-500 max-w-md leading-relaxed">
                Use the <span className="text-zinc-300 font-bold">Report Queue</span> tab inside the Citizen Crowd Reporting card above to submit a live wait time update for any outlet. Your update will instantly show up below as an interactive status dashboard!
              </p>
            </div>
          );
        }

        return (
          <div className="w-full mt-8 glass rounded-2xl border border-white/5 shadow-2xl overflow-hidden relative p-5 flex flex-col gap-4 animate-fade-in animate-duration-300">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-zinc-800" />
            
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-zinc-200 text-sm flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Recent Updates
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Real-time crowd-sourced status indicators submitted by citizens.
                </p>
              </div>
              <span className="text-[10px] font-medium text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-xl  tracking-wider shrink-0">
                {reportedPlaces.length} Active Update{reportedPlaces.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Grid display layout (Spans 3 cols on mobile, and 2-4 cols on desktop to keep boxes wide and proportional) */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-5">
              {reportedPlaces.map((place) => {
                const minutesAgo = place.reportedAtTimestamp
                  ? Math.floor((Date.now() - place.reportedAtTimestamp) / 60000)
                  : 0;
                const timeLabel = minutesAgo < 1 ? 'Just now' : `${minutesAgo}m ago`;
                
                const cleanName = place.name.replace('BEVCO Outlet, ', '');
                
                // Colors mapped directly to the uploaded image's style
                const metricColorClass = place.crowdStatus === 'empty' ? 'text-zinc-500' :
                                         place.crowdStatus === 'moderate' ? 'text-emerald-400' :
                                         place.crowdStatus === 'busy' ? 'text-amber-400' : 'text-red-400';
                                         
                const dotGlowClass = place.crowdStatus === 'empty' ? 'bg-zinc-500' :
                                     place.crowdStatus === 'moderate' ? 'bg-emerald-500 animate-pulse' :
                                     place.crowdStatus === 'busy' ? 'bg-amber-500 animate-pulse' : 'bg-red-500 animate-pulse';

                return (
                  <div
                    key={place.id}
                    onClick={() => {
                      dispatch(setSelectedPlaceId(place.id));
                      setDetailPlace(place);
                    }}
                    className="w-full bg-zinc-950/85 border border-zinc-900 rounded-xl sm:rounded-2xl p-2.5 sm:p-4.5 flex flex-col justify-between transition-all hover:border-zinc-800/80 shadow-2xl relative group cursor-pointer active:scale-[0.98]"
                  >
                    {/* Top row: Title (Outlet name) and active status dot */}
                    <div className="flex items-start justify-between gap-1 sm:gap-2">
                      <div className="min-w-0">
                        <h4 className="text-[10px] sm:text-sm font-bold text-zinc-100 group-hover:text-white transition-colors tracking-tight line-clamp-1">
                          {cleanName}
                        </h4>
                        <p className={`hidden sm:block text-[10px] font-medium mt-0.5 uppercase tracking-wider ${metricColorClass}`}>
                          {place.address.split(',')[0]}
                        </p>
                      </div>
                      <div className="flex flex-col items-end shrink-0 gap-1.5 mt-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] sm:text-[9px] font-normal text-white tracking-wider  leading-none">
                            {timeLabel}
                          </span>
                          <span className={`w-0.5 h-0.5 sm:w-1 sm:h-1 rounded-full shadow-sm ${dotGlowClass}`} />
                        </div>
                        <span className="hidden sm:inline-block text-[8.5px] font-mono font-bold text-zinc-500 bg-zinc-900/80 px-1.5 py-0.5 rounded border border-zinc-800/80 leading-none">
                          {place.reportsCount || 1} Sub{(place.reportsCount || 1) !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Middle row: Large Metric and Operational status tracking */}
                    <div className="flex items-center sm:items-end justify-between mt-2.5 sm:mt-4">
                      <div className="flex flex-col">
                        <span className={`text-xs sm:text-xl font-bold tracking-tight leading-none ${metricColorClass}`}>
                          {place.waitMinutes} <span className="text-[7.5px] sm:text-[9px] font-semibold tracking-wide uppercase sm:ml-0.5">min</span>
                        </span>
                        <span className="hidden sm:block text-[9px] text-zinc-500 font-bold uppercase tracking-wider mt-1">
                          WAIT DURATION
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className={`text-[8.5px] sm:text-[10px] font-bold tracking-wider uppercase ${metricColorClass}`}>
                          {place.crowdStatus}
                        </span>
                        <span className="hidden sm:block text-[9px] text-zinc-500 font-bold tracking-wider mt-1 uppercase">
                          CROWD DENSITY
                        </span>
                      </div>
                    </div>

                    {/* Footer live inspect status button - Desktop only */}
                    <div className="hidden sm:block mt-4 border-t border-zinc-900 pt-3">
                      <button
                        type="button"
                        className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/80 hover:border-zinc-700/80 text-zinc-300 hover:text-white text-[10px] font-bold uppercase tracking-wider py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
                      >
                        Inspect Live Status
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Live Community Statistics Banner */}
      <div className="w-full bg-zinc-950/40 border border-zinc-900 rounded-2xl py-3 px-5 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-8 shadow-2xl relative overflow-hidden animate-fade-in">
        
        {/* Banner Left: Label */}
        <div className="flex items-center">
          <div>
            <h4 className="text-[10px] font-medium tracking-wider text-white">Live Telemetry</h4>
            <p className="text-[8.5px] text-zinc-500 font-medium mt-0.5">Real-time citizen-submitted crowd reports.</p>
          </div>
        </div>

        {/* Banner Right: Key Data Indicators Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 w-full md:w-auto shrink-0 pt-3 md:pt-0 border-t border-zinc-900 md:border-t-0 justify-items-center sm:justify-items-start">
          
          {/* Stat 1 */}
          <div className="flex flex-col items-center sm:items-start">
            <span className="text-[7.5px] font-bold text-zinc-500 uppercase tracking-widest">Total Reports</span>
            <span className="text-xs font-black text-zinc-300 mt-0.5 font-mono">{totalSubmissions}</span>
          </div>

          {/* Stat 2 */}
          <div className="flex flex-col items-center sm:items-start">
            <span className="text-[7.5px] font-bold text-zinc-500 uppercase tracking-widest">Active Outlets</span>
            <span className="text-xs font-black text-zinc-300 mt-0.5 font-mono">{crowdStats.activeCount}</span>
          </div>

          {/* Stat 3 */}
          <div className="flex flex-col items-center sm:items-start">
            <span className="text-[7.5px] font-bold text-emerald-500/80 uppercase tracking-widest">Low Crowd</span>
            <span className="text-xs font-black text-emerald-400 mt-0.5 font-mono">{crowdStats.emptyModerate}</span>
          </div>

          {/* Stat 4 */}
          <div className="flex flex-col items-center sm:items-start">
            <span className="text-[7.5px] font-bold text-amber-500/80 uppercase tracking-widest">Heavy Crowd</span>
            <span className="text-xs font-black text-amber-400 mt-0.5 font-mono">{crowdStats.busyPacked}</span>
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer className="w-full mt-8 border-t border-zinc-800/60 pt-6 pb-4 flex flex-col items-center gap-3">

        {/* Disclaimer banner */}
        <div className="w-full max-w-3xl bg-zinc-900/60 border border-zinc-700/40 rounded-xl px-5 py-3.5 flex items-start gap-3">
          <span className="text-amber-400 text-base shrink-0 mt-0.5">⚠</span>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            <span className="font-bold text-zinc-200">Disclaimer:</span> This platform is{' '}
            <span className="text-zinc-300 font-semibold">not affiliated with, endorsed by, or connected to BEVCO</span>,
            the Kerala Government, or any official body. All queue and crowd data displayed here is{' '}
            <span className="text-zinc-300 font-semibold">submitted entirely by citizens</span> and reflects
            real-time crowd-sourced reports only. Accuracy is not guaranteed. Do not rely on this
            information for official or legal purposes.
          </p>
        </div>

        {/* Creator Links: Buy Me A Coffee & Instagram */}
        <div className="mt-3 mb-1 flex flex-wrap items-center justify-center gap-3 animate-fade-in">
          {/* Buy Me A Coffee - Simple Minimal Style Button */}
          <button
            type="button"
            onClick={() => setShowCoffeeModal(true)}
            className="inline-flex items-center gap-1.5 bg-zinc-900/30 hover:bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/60 text-zinc-400 hover:text-amber-400 text-[10px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-xl transition-all duration-200 cursor-pointer active:scale-[0.98] outline-none"
          >
            <span className="text-[11px]">☕</span>
            <span>Buy Me A Coffee</span>
          </button>

          {/* Instagram - Simple Minimal Style */}
          <a
            href="https://www.instagram.com/ajaykc_?igsh=MTl5NzB3d21zd29tYQ%3D%3D&utm_source=qr"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-zinc-900/30 hover:bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/60 text-zinc-400 hover:text-rose-400 text-[10px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-xl transition-all duration-200 cursor-pointer active:scale-[0.98]"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
            </svg>
            <span>Instagram</span>
          </a>
        </div>

        {/* Malayalam Health Warning */}
        <p className="text-xs sm:text-xs font-bold text-zinc-400 tracking-wider text-center mt-2" style={{ fontFamily: "'Baloo Chettan 2', sans-serif" }}>
          മദ്യപാനം <span className="text-red-500"> ആരോഗ്യത്തിന് </span>ഹാനികരം
        </p>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between w-full max-w-3xl gap-2 px-1">
          <p className="text-[10px] text-zinc-600 font-medium tracking-wide">
            തിരക്കുണ്ടോ? &nbsp;·&nbsp; Crowd-sourced queue tracker for Kerala
          </p>
          <p className="text-[10px] text-zinc-700">
            Data is community-powered &nbsp;·&nbsp; No official source &nbsp;·&nbsp; Expires every 10 mins
          </p>
        </div>

      </footer>

      {/* Centered Small Compact Modal */}
      {detailPlace && (() => {
        const crowdBgMap: Record<string, string> = {
          empty:    'bg-zinc-800/60 text-zinc-400 border-zinc-700/50',
          moderate: 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30',
          busy:     'bg-amber-950/40 text-amber-400 border-amber-500/30',
          packed:   'bg-red-950/40 text-red-400 border-red-500/30',
        };
        const crowdGlowMap: Record<string, string> = {
          empty:    'bg-zinc-500',
          moderate: 'bg-emerald-500',
          busy:     'bg-amber-500',
          packed:   'bg-red-500',
        };
        const minutesAgo = detailPlace.reportedAtTimestamp
          ? Math.floor((Date.now() - detailPlace.reportedAtTimestamp) / 60000)
          : 0;
        const timeLabel = minutesAgo < 1 ? 'Just now' : `${minutesAgo}m ago`;
        const expiresIn = detailPlace.reportedAtTimestamp
          ? Math.max(0, 10 - minutesAgo)
          : 0;

        return (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
              onClick={() => setDetailPlace(null)}
            >
              {/* Small Centered Modal Panel */}
              <div
                className="w-full max-w-xs bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-5 flex flex-col gap-4 relative"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close Button */}
                <button
                  onClick={() => setDetailPlace(null)}
                  className="absolute top-3.5 right-3.5 text-zinc-500 hover:text-zinc-300 w-6 h-6 rounded-full bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-xs font-bold cursor-pointer transition-colors border border-zinc-800/40"
                >
                  ✕
                </button>

                <div className="flex flex-col gap-1 pr-6">
                  <h3 className="text-sm font-bold text-zinc-200 leading-snug">
                    {detailPlace.name.replace('BEVCO Outlet, ', '')}
                  </h3>
                  {detailPlace.address && (
                    <p className="text-[10px] text-zinc-500 leading-normal">
                      {detailPlace.address}
                    </p>
                  )}
                </div>

                {/* Status & Wait */}
                <div className="flex flex-col gap-2 bg-zinc-900/40 rounded-xl p-3 border border-zinc-900/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">Queue Status</span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wide ${crowdBgMap[detailPlace.crowdStatus] ?? crowdBgMap.empty}`}>
                      <span className={`w-1 h-1 rounded-full ${crowdGlowMap[detailPlace.crowdStatus] ?? 'bg-zinc-500'}`} />
                      {detailPlace.crowdStatus}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between border-t border-zinc-900/80 pt-2">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">Wait Duration</span>
                    <span className="text-xs font-extrabold text-zinc-200">
                      {detailPlace.waitMinutes} minutes
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-900/80 pt-2">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">Submissions</span>
                    <span className="text-xs font-extrabold text-zinc-200 font-mono">
                      {detailPlace.reportsCount || 1} report{(detailPlace.reportsCount || 1) !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Not Available Stock Items */}
                {detailPlace.notAvailableItems && detailPlace.notAvailableItems.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">Out of Stock</span>
                    <div className="flex flex-wrap gap-1">
                      {detailPlace.notAvailableItems.map((item, idx) => (
                        <span key={idx} className="text-[9px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/20 leading-none">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expiration Meta Info */}
                <div className="flex items-center justify-between border-t border-zinc-900 pt-3 text-[9px] text-zinc-500 font-medium">
                  <span>Reported {timeLabel}</span>
                  {expiresIn > 0 ? (
                    <span className="text-amber-500/80">Expires in ~{expiresIn}m</span>
                  ) : (
                    <span className="text-red-500/60">Expired</span>
                  )}
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* Buy Me A Coffee (UPI Donation) Modal */}
      {showCoffeeModal && (() => {
        const donationOptions = [
          { id: 30, emoji: '🍌', label: 'Pazhampori', desc: 'Chaya break fuel and local gossip.', amount: 30 },
          { id: 60, emoji: '🍳', label: 'Porotta Set', desc: 'Beef is extra. Salna adjustment.', amount: 60 },
          { id: 150, emoji: '🍗', label: 'Biriyani', desc: 'Code will not compile hungry.', amount: 150 },
          { id: 250, emoji: '🍖', label: 'Kuzhi Mandi', desc: 'Weekend server fuel. Food coma.', amount: 250 },
          { id: 500, emoji: '🍽️', label: 'Full Feast', desc: 'Sugar daddy mode. Sadya vibes.', amount: 500 },
        ];

        const donateAmount = selectedDonation === 'custom' ? Number(customAmount) || 0 : selectedDonation;
        const upiId = "kcajay72@oksbi";
        const name = "Ajay K C";
        const note = "Support Thirakkundo";
        const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&am=${donateAmount}&cu=INR&tn=${encodeURIComponent(note)}`;
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&color=212-212-216&bgcolor=9-9-11&data=${encodeURIComponent(upiUrl)}`;

        const handleDonateSubmit = () => {
          if (donateAmount <= 0) return;
          window.location.href = upiUrl;
        };

        return (
          <>
            {/* Glassmorphic Backdrop */}
            <div
              className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
              onClick={() => setShowCoffeeModal(false)}
            >
              {/* Premium Wide Modal Panel */}
              <div
                className="w-full max-w-2xl bg-zinc-950/95 border border-white/5 rounded-3xl shadow-2xl p-5 md:p-6 flex flex-col gap-4 relative animate-scale-in my-8 max-h-[95vh] overflow-y-auto custom-scrollbar overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Subtle Top Accent */}
                <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-zinc-700/40 via-zinc-800/20 to-transparent" />

                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-zinc-900/60">
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-base font-bold text-zinc-100 tracking-tight">
                      Support Thirakkundo
                    </h3>
                  </div>
                  {/* Close Button */}
                  <button
                    onClick={() => setShowCoffeeModal(false)}
                    className="text-zinc-500 hover:text-zinc-300 w-7 h-7 rounded-full bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-[10px] font-medium cursor-pointer transition-colors border border-white/5"
                  >
                    ✕
                  </button>
                </div>

                {/* Content Layout: 2 Columns on desktop, stacked on mobile */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                  
                  {/* Left Column: Description & Options Selector */}
                  <div className="md:col-span-7 flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="bg-zinc-900/40 border border-zinc-800/80 text-zinc-400 text-[9px] font-medium py-2 px-3 rounded-xl flex items-center gap-1.5 leading-none w-fit">
                        <svg className="w-3 h-3 shrink-0 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Every contribution helps keep the service running.</span>
                      </div>
                    </div>

                    {/* Options List */}
                    <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                      {donationOptions.map((opt) => {
                        const isSelected = selectedDonation === opt.amount;
                        return (
                          <div
                            key={opt.id}
                            onClick={() => setSelectedDonation(opt.amount)}
                            className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-zinc-900/50 border-zinc-700 shadow-inner'
                                : 'bg-zinc-900/20 border-white/5 hover:border-zinc-800'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {/* Custom Radio Button */}
                              <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                                isSelected ? 'border-zinc-400' : 'border-zinc-800'
                              }`}>
                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-zinc-200" />}
                              </div>
                              
                              <span className="text-base shrink-0">{opt.emoji}</span>
                              <div className="min-w-0">
                                <h4 className="text-[11px] font-semibold text-zinc-200">{opt.label}</h4>
                                <p className="text-[9.5px] text-zinc-500 truncate leading-normal font-normal">{opt.desc}</p>
                              </div>
                            </div>
                            <span className="text-[11px] font-semibold text-zinc-200 shrink-0 font-mono">₹{opt.amount}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Custom Option - Fixed at Bottom */}
                    <div
                      onClick={() => setSelectedDonation('custom')}
                      className={`flex flex-col gap-1.5 p-2.5 rounded-xl border transition-all cursor-pointer mt-1 ${
                        selectedDonation === 'custom'
                          ? 'bg-zinc-900/50 border-zinc-700'
                          : 'bg-zinc-900/20 border-white/5 hover:border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                          selectedDonation === 'custom' ? 'border-zinc-400' : 'border-zinc-800'
                        }`}>
                          {selectedDonation === 'custom' && <div className="w-1.5 h-1.5 rounded-full bg-zinc-200" />}
                        </div>
                        <span className="text-[11px] font-semibold text-zinc-200">Enter custom amount</span>
                      </div>

                      {selectedDonation === 'custom' && (
                        <div className="relative mt-0.5 flex items-center">
                          <span className="absolute left-2.5 text-[10px] font-medium text-zinc-500">₹</span>
                          <input
                            type="number"
                            value={customAmount}
                            onChange={(e) => setCustomAmount(e.target.value)}
                            placeholder="Amount"
                            className="w-full bg-zinc-950 border border-zinc-900 focus:border-zinc-700 rounded-lg py-1.5 pl-6 pr-2 text-[10px] text-zinc-200 font-mono font-medium outline-none"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Checkout Details & Action Trigger */}
                  <div className="md:col-span-5 flex flex-col gap-3.5 bg-zinc-900/10 border border-white/5 p-3.5 md:p-4 rounded-2xl font-normal">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      Payment Checkout
                    </h4>

                    {/* QR Code and Scan info - Beautiful row layout for perfect mobile & desktop space utilization */}
                    {donateAmount > 0 ? (
                      <div className="flex flex-row items-center gap-3.5 py-1">
                        {/* Compact QR Code (Always displayed, scannable, muted zinc-200) */}
                        <div className="bg-zinc-950 p-1.5 rounded-xl border border-zinc-900 shadow-inner shrink-0">
                          <img
                            src={qrCodeUrl}
                            alt="UPI QR Code"
                            className="w-16 h-16 rounded-lg shrink-0"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[10.5px] font-semibold text-zinc-300">Scan to pay with UPI</h4>
                          <p className="text-[9px] text-zinc-500 leading-normal mt-0.5 font-normal">
                            Works on GPay, PhonePe, Paytm, etc.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-row items-center gap-3 py-4 text-left">
                        <span className="text-xl opacity-40 shrink-0">☕</span>
                        <p className="text-[9.5px] text-zinc-500 font-normal">
                          Select an amount to generate UPI scan code.
                        </p>
                      </div>
                    )}

                    {/* UPI Details Card (Always visible when amount is selected, highly compact) */}
                    {donateAmount > 0 && (
                      <div className="bg-zinc-950/60 border border-zinc-900 px-3 py-2 rounded-xl w-full flex items-center justify-between">
                        <span className="text-[8.5px] uppercase tracking-wider text-zinc-500 font-semibold">UPI ID</span>
                        <span className="text-[9px] font-mono text-zinc-300 font-semibold">{upiId}</span>
                      </div>
                    )}

                    {/* Minimalist Matte White Checkout Button */}
                    <button
                      type="button"
                      disabled={donateAmount <= 0}
                      onClick={handleDonateSubmit}
                      className="w-full py-2.5 px-4 bg-zinc-100 hover:bg-zinc-200 disabled:bg-zinc-900 disabled:text-zinc-700 disabled:cursor-not-allowed text-zinc-950 font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-[0_4px_16px_rgba(255,255,255,0.05)] hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center justify-between"
                    >
                      <span className="font-bold">Pay ₹{donateAmount}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[7.5px] text-zinc-950/70 font-semibold">gpay / upi</span>
                        <svg className="w-3 h-3 text-zinc-950" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>

                    <p className="text-[8.5px] text-zinc-600 text-center tracking-wider font-semibold">
                      Thank you! You keep Thirakkundo running.
                    </p>
                  </div>

                </div>

              </div>
            </div>
          </>
        );
      })()}

    </div>
  );
}
