import { AppProvider, useApp } from './contexts/AppContext';
import { ToastProvider } from './contexts/ToastContext';
import { Login } from './components/Login';
import { SupplierDashboard } from './components/SupplierDashboard';
import { RFDashboard } from './components/RFDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';

function AppContent() {
  const { session } = useApp();

  if (!session) {
    return <Login />;
  }

  if (session.role === 'supplier') {
    return <SupplierDashboard />;
  }

  return <RFDashboard />;
}

function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
