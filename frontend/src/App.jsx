import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import NavBar from './components/NavBar.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import CashierPage from './pages/CashierPage.jsx';
import ManagerPage from './pages/ManagerPage.jsx';
import SalesPage from './pages/SalesPage.jsx';
import KioskPage from './pages/KioskPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import AccessibilityWidget from './components/AccessibilityWidget.jsx';
import ChatWidget from './components/ChatWidget.jsx';

export default function App() {
  const location = useLocation();
  const chromePages = new Set(['/sales']);
  const showNav = chromePages.has(location.pathname);
  const chatPages = new Set(['/', '/kiosk']);
  const showChat = chatPages.has(location.pathname);

  useEffect(() => {
    if (showChat) {
      document.body.dataset.chatPage = 'true';
    } else {
      delete document.body.dataset.chatPage;
    }

    return () => {
      delete document.body.dataset.chatPage;
    };
  }, [showChat]);

  return (
    <>
      <div className="app-shell">
        {showNav ? <NavBar /> : null}
        <main className="page-shell">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/cashier" element={<CashierPage />} />
            <Route path="/manager" element={<ManagerPage />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/kiosk" element={<KioskPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
      </div>
      <AccessibilityWidget />
      {showChat ? <ChatWidget /> : null}
    </>
  );
}
