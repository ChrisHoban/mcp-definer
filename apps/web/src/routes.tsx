import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from '@/components';

import { CreateWizardPage } from '@/features/authoring/CreateWizardPage';

import { EditWizardPage } from '@/features/authoring/EditWizardPage';

import { McpDetailPage } from '@/features/management/McpDetailPage';

import { McpListPage } from '@/features/management/McpListPage';

import { RegistryBrowsePage } from '@/features/management/RegistryBrowsePage';

import { SettingsPage } from '@/features/management/SettingsPage';

import { TestConsolePage } from '@/features/management/TestConsolePage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<McpListPage />} />

        <Route path="mcps/new" element={<CreateWizardPage />} />

        <Route path="mcps/:id" element={<McpDetailPage />} />

        <Route path="mcps/:id/versions/:ver/edit" element={<EditWizardPage />} />

        <Route path="mcps/:id/test" element={<TestConsolePage />} />

        <Route path="registry" element={<RegistryBrowsePage />} />

        <Route path="settings" element={<SettingsPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
