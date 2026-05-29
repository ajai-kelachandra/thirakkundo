import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type CrowdStatus = 'empty' | 'moderate' | 'busy' | 'packed';

export interface WaitReport {
  id: string;
  placeId: string;
  crowdStatus: CrowdStatus;
  waitMinutes: number;
  reportedAt: string;
}

export interface Place {
  id: string;
  name: string;
  category: 'bevco' | 'cafe' | 'supermarket' | 'transit' | 'government';
  address: string;
  crowdStatus: CrowdStatus;
  waitMinutes: number;
  reportsCount: number;
  lastUpdated: string;
  hourlyWait: number[]; // 24 numbers for wait time per hour
  latitude?: number;
  longitude?: number;
  reportedAtTimestamp?: number; // Live user report epoch timestamp
  notAvailableItems?: string[];  // Items reported as out of stock
}

interface PlacesState {
  items: Place[];
  filterCategory: string;
  searchQuery: string;
  recentReports: WaitReport[];
}

const initialHourlyWait = [10, 15, 20, 30, 45, 55, 60, 75, 80, 85, 90, 85, 80, 70, 75, 85, 95, 90, 80, 60, 45, 30, 20, 10];

const initialState: PlacesState = {
  items: [
    {
      id: 'bevco-ekm',
      name: 'BEVCO Outlet, Ernakulam',
      category: 'bevco',
      address: 'Jose Junction, M.G. Road, Ernakulam',
      crowdStatus: 'busy',
      waitMinutes: 45,
      reportsCount: 42,
      lastUpdated: '5 mins ago',
      hourlyWait: [5, 5, 10, 15, 25, 45, 65, 80, 75, 60, 50, 45, 55, 70, 85, 90, 95, 80, 60, 40, 25, 15, 10, 5],
    },
    {
      id: 'bevco-tvm',
      name: 'BEVCO Outlet, East Fort',
      category: 'bevco',
      address: 'East Fort, Thiruvananthapuram',
      crowdStatus: 'packed',
      waitMinutes: 80,
      reportsCount: 89,
      lastUpdated: 'Just now',
      hourlyWait: [10, 10, 15, 30, 50, 70, 90, 95, 90, 85, 75, 70, 75, 80, 90, 95, 100, 90, 80, 65, 50, 30, 15, 10],
    },
    {
      id: 'kawa-kochi',
      name: 'Kawa Specialty Cafe',
      category: 'cafe',
      address: 'Panampilly Nagar, Kochi',
      crowdStatus: 'moderate',
      waitMinutes: 15,
      reportsCount: 18,
      lastUpdated: '12 mins ago',
      hourlyWait: [5, 5, 5, 10, 15, 20, 30, 45, 50, 40, 30, 35, 45, 40, 35, 40, 55, 65, 60, 50, 35, 20, 10, 5],
    },
    {
      id: 'lulu-supermarket',
      name: 'Lulu Hypermarket',
      category: 'supermarket',
      address: 'Lulu Mall, Edappally, Kochi',
      crowdStatus: 'busy',
      waitMinutes: 30,
      reportsCount: 156,
      lastUpdated: '3 mins ago',
      hourlyWait: [0, 0, 5, 15, 25, 35, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 85, 70, 50, 30, 10, 0, 0],
    },
    {
      id: 'rto-kakkanad',
      name: 'RTO Office, Civil Station',
      category: 'government',
      address: 'Civil Station, Kakkanad',
      crowdStatus: 'packed',
      waitMinutes: 95,
      reportsCount: 64,
      lastUpdated: '20 mins ago',
      hourlyWait: [0, 0, 0, 0, 20, 50, 80, 95, 90, 85, 75, 80, 85, 90, 75, 50, 20, 0, 0, 0, 0, 0, 0, 0],
    },
    {
      id: 'kochi-metro-kaloor',
      name: 'Kaloor Metro Station',
      category: 'transit',
      address: 'Kaloor Junction, Kochi',
      crowdStatus: 'empty',
      waitMinutes: 3,
      reportsCount: 124,
      lastUpdated: '8 mins ago',
      hourlyWait: [5, 10, 15, 40, 65, 85, 70, 50, 45, 40, 40, 45, 50, 55, 65, 80, 85, 70, 50, 35, 20, 15, 10, 5],
    }
  ],
  filterCategory: 'all',
  searchQuery: '',
  recentReports: []
};

const placesSlice = createSlice({
  name: 'places',
  initialState,
  reducers: {
    setFilterCategory: (state, action: PayloadAction<string>) => {
      state.filterCategory = action.payload;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    reportCrowdStatus: (state, action: PayloadAction<WaitReport>) => {
      const { placeId, crowdStatus, waitMinutes } = action.payload;
      const place = state.items.find(item => item.id === placeId);
      if (place) {
        // Calculate new moving average / weighted update
        place.reportsCount += 1;
        place.crowdStatus = crowdStatus;
        place.waitMinutes = Math.round((place.waitMinutes * 4 + waitMinutes) / 5);
        place.lastUpdated = 'Just now';
        place.reportedAtTimestamp = Date.now(); // Record current user report epoch
        
        // Update the current hour's value in the chart history (e.g. current hour is 20:00 - index 20)
        const currentHour = new Date().getHours();
        place.hourlyWait[currentHour] = Math.round((place.hourlyWait[currentHour] * 3 + waitMinutes) / 4);
      }
      state.recentReports.unshift(action.payload);
      if (state.recentReports.length > 20) {
        state.recentReports.pop();
      }
    },
    addCustomPlaceReport: (state, action: PayloadAction<{ id?: string; name: string; pincode: string; crowdStatus: CrowdStatus; waitMinutes: number; latitude?: number; longitude?: number; district?: string; notAvailableItems?: string[] }>) => {
      const { id: passedId, name, pincode, crowdStatus, waitMinutes, latitude, longitude, district, notAvailableItems } = action.payload;
      const id = passedId || ('custom-' + name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + pincode);
      
      const cleanStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanTargetName = cleanStr(name).replace('bevcooutlet', '');
      
      const existing = state.items.find(item => {
        if (item.id === id) return true;
        const itemClean = cleanStr(item.name).replace('bevcooutlet', '');
        const itemPin = (item.address || '').match(/\b\d{6}\b/)?.[0] || '';
        return (itemClean.includes(cleanTargetName) || cleanTargetName.includes(itemClean)) && itemPin === pincode;
      });
      if (existing) {
        existing.reportsCount += 1;
        existing.crowdStatus = crowdStatus;
        existing.waitMinutes = Math.round((existing.waitMinutes * 4 + waitMinutes) / 5);
        existing.lastUpdated = 'Just now';
        existing.reportedAtTimestamp = Date.now(); // Record current user report epoch
        const currentHour = new Date().getHours();
        existing.hourlyWait[currentHour] = Math.round((existing.hourlyWait[currentHour] * 3 + waitMinutes) / 4);
        if (latitude) existing.latitude = latitude;
        if (longitude) existing.longitude = longitude;
        if (notAvailableItems !== undefined) existing.notAvailableItems = notAvailableItems;
        if (district && !existing.address.toLowerCase().includes(district.toLowerCase())) {
          existing.address = `${district} District, Pincode: ${pincode}, Kerala`;
        }
      } else {
        const newPlace: Place = {
          id,
          name: name.toUpperCase().includes('OUTLET') || name.toUpperCase().includes('BEVCO') ? name : `BEVCO Outlet, ${name}`,
          category: 'bevco',
          address: district ? `${district} District, Pincode: ${pincode}, Kerala` : `Pincode: ${pincode}, Kerala`,
          crowdStatus,
          waitMinutes,
          reportsCount: 1,
          lastUpdated: 'Just now',
          hourlyWait: [5, 10, 15, 25, 35, 45, 55, 60, 65, 70, 75, 80, 85, 90, 80, 70, 60, 50, 40, 30, 20, 15, 10, 5],
          latitude,
          longitude,
          notAvailableItems: notAvailableItems ?? [],
          reportedAtTimestamp: Date.now() // Record current user report epoch
        };
        const currentHour = new Date().getHours();
        newPlace.hourlyWait[currentHour] = waitMinutes;
        
        state.items.unshift(newPlace);
      }
    },
    cleanExpiredReports: (state) => {
      // Allow 10 minutes
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
      
      state.items.forEach(item => {
        // Revert expired reported items in-place
        if (item.reportedAtTimestamp && item.reportedAtTimestamp < tenMinutesAgo) {
          if (item.id === 'bevco-ekm') {
            item.crowdStatus = 'busy';
            item.waitMinutes = 45;
            item.reportsCount = 42;
            item.lastUpdated = 'Expired';
            item.reportedAtTimestamp = undefined;
          } else if (item.id === 'bevco-tvm') {
            item.crowdStatus = 'packed';
            item.waitMinutes = 80;
            item.reportsCount = 89;
            item.lastUpdated = 'Expired';
            item.reportedAtTimestamp = undefined;
          } else {
            item.crowdStatus = 'moderate';
            item.waitMinutes = 15;
            item.reportsCount = 0;
            item.lastUpdated = 'Expired';
            item.reportedAtTimestamp = undefined;
          }
        }
      });

      // Completely delete expired purely custom pincode user locations
      state.items = state.items.filter(item => {
        const isCustom = item.id.startsWith('custom-') && !item.address.toLowerCase().includes('jose junction') && !item.address.toLowerCase().includes('east fort');
        if (isCustom) {
          if (!item.reportedAtTimestamp || item.reportedAtTimestamp < tenMinutesAgo) {
            return false;
          }
        }
        return true;
      });
    },
    syncFromDatabase: (state, action: PayloadAction<Place[]>) => {
      const dbItems = action.payload;
      
      // Merge database items into local state.items array
      dbItems.forEach(dbItem => {
        const existing = state.items.find(item => item.id === dbItem.id);
        if (existing) {
          // Avoid overwriting a locally submitted report that is fresh (under 15s old)
          const isRecentlySubmittedLocally = existing.reportedAtTimestamp && (Date.now() - existing.reportedAtTimestamp < 15000);
          
          if (!isRecentlySubmittedLocally) {
            existing.crowdStatus = dbItem.crowdStatus;
            existing.waitMinutes = dbItem.waitMinutes;
            existing.reportsCount = dbItem.reportsCount;
            existing.lastUpdated = dbItem.lastUpdated;
            existing.reportedAtTimestamp = dbItem.reportedAtTimestamp;
            existing.notAvailableItems = dbItem.notAvailableItems || [];
            if (dbItem.latitude) existing.latitude = dbItem.latitude;
            if (dbItem.longitude) existing.longitude = dbItem.longitude;
          }
        } else {
          // Append new custom places reported by other citizens if they have active reports
          if (dbItem.reportedAtTimestamp !== undefined) {
            state.items.push(dbItem);
          }
        }
      });

      // Completely remove expired custom items that are no longer active in the database
      state.items = state.items.filter(item => {
        if (item.id.startsWith('custom-')) {
          const inDb = dbItems.some(dbItem => dbItem.id === item.id && dbItem.reportedAtTimestamp !== undefined);
          const isRecentlySubmittedLocally = item.reportedAtTimestamp && (Date.now() - item.reportedAtTimestamp < 15000);
          if (!inDb && !isRecentlySubmittedLocally) {
            return false;
          }
        }
        return true;
      });
    },
    loadLocalReports: (state, action: PayloadAction<Place[]>) => {
      const localItems = action.payload;
      localItems.forEach(localItem => {
        const existingIdx = state.items.findIndex(item => item.id === localItem.id);
        if (existingIdx !== -1) {
          state.items[existingIdx] = localItem;
        } else {
          state.items.unshift(localItem);
        }
      });
    }
  }
});

export const { setFilterCategory, setSearchQuery, reportCrowdStatus, addCustomPlaceReport, cleanExpiredReports, syncFromDatabase, loadLocalReports } = placesSlice.actions;
export default placesSlice.reducer;
