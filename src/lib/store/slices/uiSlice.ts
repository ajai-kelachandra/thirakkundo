import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UiState {
  theme: 'dark' | 'light';
  selectedPlaceId: string | null;
  isReportModalOpen: boolean;
  isFirebaseConnected: boolean;
}

const initialState: UiState = {
  theme: 'dark',
  selectedPlaceId: null,
  isReportModalOpen: false,
  isFirebaseConnected: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleTheme: (state) => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
    },
    setSelectedPlaceId: (state, action: PayloadAction<string | null>) => {
      state.selectedPlaceId = action.payload;
    },
    setReportModalOpen: (state, action: PayloadAction<boolean>) => {
      state.isReportModalOpen = action.payload;
    },
    setFirebaseConnected: (state, action: PayloadAction<boolean>) => {
      state.isFirebaseConnected = action.payload;
    }
  }
});

export const { toggleTheme, setSelectedPlaceId, setReportModalOpen, setFirebaseConnected } = uiSlice.actions;
export default uiSlice.reducer;
