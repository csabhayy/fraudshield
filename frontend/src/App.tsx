import { Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import InvestigationPage from './pages/InvestigationPage';
import InvestigationsPage from './pages/InvestigationsPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/investigation/:id" element={<InvestigationPage />} />
      <Route path="/investigations" element={<InvestigationsPage />} />
    </Routes>
  );
}

export default App;