import { Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import InvestigationPage from './pages/InvestigationPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/investigation/:id" element={<InvestigationPage />} />
    </Routes>
  );
}

export default App;