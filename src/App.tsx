import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LiveJourneyPage } from './pages/LiveJourneyPage';
import { DashboardPage } from './pages/DashboardPage';
import { VisitorsPage } from './pages/VisitorsPage';
import { SecurityEventsPage } from './pages/SecurityEventsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SitePagesPage } from './pages/SitePagesPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <WorkspaceProvider>
        <Layout>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Navigate to="/live" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/live" element={<LiveJourneyPage />} />
              <Route path="/visitors" element={<VisitorsPage />} />
              <Route path="/security" element={<SecurityEventsPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/pages" element={<SitePagesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/live" replace />} />
            </Routes>
          </ErrorBoundary>
        </Layout>
      </WorkspaceProvider>
    </BrowserRouter>
  );
}
