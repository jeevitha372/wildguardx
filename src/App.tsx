import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { DataLayerProvider } from '@/data/DataContext'
import { StateOverrideProvider } from '@/lib/dataState'
import { SosProvider } from '@/components/sos/SosProvider'
import { AppShell } from '@/components/shell/AppShell'

import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { MapPage } from '@/pages/MapPage'
import { AlertsPage } from '@/pages/AlertsPage'
import { IncidentDetailPage } from '@/pages/IncidentDetailPage'
import { DevicesPage } from '@/pages/DevicesPage'
import { DeviceDetailPage } from '@/pages/DeviceDetailPage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { TeamPage } from '@/pages/TeamPage'
import { NotificationsPage } from '@/pages/NotificationsPage'
import { SettingsPage } from '@/pages/SettingsPage'

export function App() {
  return (
    <BrowserRouter>
      <DataLayerProvider>
        <StateOverrideProvider>
          <SosProvider>
            <Routes>
              {/* Public */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />

              {/* Operations console */}
              <Route path="/app" element={<AppShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="map" element={<MapPage />} />
                <Route path="alerts" element={<AlertsPage />} />
                <Route path="incidents/:id" element={<IncidentDetailPage />} />
                <Route path="devices" element={<DevicesPage />} />
                <Route path="devices/:id" element={<DeviceDetailPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="team" element={<TeamPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </SosProvider>
        </StateOverrideProvider>
      </DataLayerProvider>
    </BrowserRouter>
  )
}
